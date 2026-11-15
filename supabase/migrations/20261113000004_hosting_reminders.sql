-- Current hosting windows, atomic in-app delivery, and an optional fenced email outbox.
BEGIN;
CREATE TABLE public.hosting_reminders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES public.payment_orders(id) ON DELETE CASCADE,
 project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
 recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, days_before integer NOT NULL CHECK(days_before IN(90,30)),
 notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
 sent_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 email_state text NOT NULL CHECK(email_state IN('disabled','queued','preparing','outbound','sent','unknown','failed','canceled')),
 email_attempts integer NOT NULL DEFAULT 0 CHECK(email_attempts BETWEEN 0 AND 5),
 email_token uuid, email_lease_until timestamptz, email_receipt text CHECK(length(email_receipt)<=200),
 email_sent_at timestamptz, email_outbound_at timestamptz, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(order_id,expires_at,days_before)
);
ALTER TABLE public.hosting_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hosting_reminders FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX hosting_reminder_email_queue ON public.hosting_reminders(created_at) WHERE email_state IN('queued','preparing');

CREATE FUNCTION public.hosting_reminder_source_valid(p_order uuid,p_project uuid,p_recipient uuid,p_expiry timestamptz,p_days integer)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.payment_project_rights r JOIN public.payment_orders o ON o.id=r.order_id
 JOIN public.projects p ON p.id=r.project_id
 WHERE r.order_id=p_order AND r.project_id=p_project AND r.payer_id=p_recipient AND o.payer_id=p_recipient
 AND r.status='active' AND o.status='paid' AND r.hosting_expires_at=p_expiry AND p.status IS DISTINCT FROM 'deleted'
 AND (p.facilitator_id=p_recipient OR EXISTS(SELECT 1 FROM public.project_roles pr WHERE pr.project_id=p.id AND pr.user_id=p_recipient AND pr.status='active'))
 AND NOT EXISTS(SELECT 1 FROM public.deletion_requests d WHERE d.project_id=p.id AND d.subject_id=p.id::text AND d.tombstone_at IS NOT NULL)
 AND p_expiry>clock_timestamp() AND clock_timestamp()>=p_expiry-make_interval(days=>p_days)
 AND (p_days=30 OR clock_timestamp()<p_expiry-interval '30 days'));
$$;
REVOKE ALL ON FUNCTION public.hosting_reminder_source_valid(uuid,uuid,uuid,timestamptz,integer) FROM PUBLIC,anon,authenticated,service_role;

-- Locks use the same order as payment events: order, project, then rights.
CREATE FUNCTION public.lock_hosting_reminder_source(p_order uuid,p_project uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET lock_timeout='3s' AS $$
BEGIN
 PERFORM 1 FROM public.payment_orders WHERE id=p_order FOR UPDATE NOWAIT;
 PERFORM 1 FROM public.projects WHERE id=p_project FOR SHARE NOWAIT;
 PERFORM 1 FROM public.payment_project_rights WHERE order_id=p_order FOR UPDATE NOWAIT;
 PERFORM 1 FROM public.project_roles WHERE project_id=p_project FOR SHARE NOWAIT;
 PERFORM 1 FROM auth.users WHERE id=(SELECT payer_id FROM public.payment_project_rights WHERE order_id=p_order) FOR SHARE NOWAIT;
 RETURN true;
EXCEPTION WHEN lock_not_available THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.lock_hosting_reminder_source(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.tick_hosting_reminders(p_limit integer DEFAULT 100,p_email_enabled boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET timezone='UTC' SET lock_timeout='3s' AS $$
DECLARE c record; reminder uuid; notification uuid; sent integer:=0;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_email_enabled IS NULL THEN RAISE EXCEPTION 'Invalid reminder batch' USING ERRCODE='22023'; END IF;
 LOCK TABLE public.deletion_requests IN SHARE MODE NOWAIT;
 FOR c IN SELECT r.order_id,r.project_id,r.payer_id,r.hosting_expires_at,
  CASE WHEN r.hosting_expires_at<=clock_timestamp()+interval '30 days' THEN 30 ELSE 90 END AS days
 FROM public.payment_project_rights r JOIN public.payment_orders o ON o.id=r.order_id
 WHERE r.project_id IS NOT NULL AND r.status='active' AND o.status='paid' AND r.hosting_expires_at>clock_timestamp()
  AND r.hosting_expires_at<=clock_timestamp()+interval '90 days'
  AND public.hosting_reminder_source_valid(r.order_id,r.project_id,r.payer_id,r.hosting_expires_at,
   CASE WHEN r.hosting_expires_at<=clock_timestamp()+interval '30 days' THEN 30 ELSE 90 END)
  AND NOT EXISTS(SELECT 1 FROM public.hosting_reminders h WHERE h.order_id=r.order_id AND h.expires_at=r.hosting_expires_at
   AND h.days_before=CASE WHEN r.hosting_expires_at<=clock_timestamp()+interval '30 days' THEN 30 ELSE 90 END)
 ORDER BY r.hosting_expires_at,r.order_id LIMIT p_limit LOOP
  IF NOT public.lock_hosting_reminder_source(c.order_id,c.project_id) THEN CONTINUE; END IF;
  IF NOT public.hosting_reminder_source_valid(c.order_id,c.project_id,c.payer_id,c.hosting_expires_at,c.days) THEN CONTINUE; END IF;
  reminder:=NULL;
  INSERT INTO public.hosting_reminders(order_id,project_id,recipient_id,expires_at,days_before,email_state)
   VALUES(c.order_id,c.project_id,c.payer_id,c.hosting_expires_at,c.days,CASE WHEN p_email_enabled THEN 'queued' ELSE 'disabled' END)
   ON CONFLICT DO NOTHING RETURNING id INTO reminder;
  IF reminder IS NULL THEN CONTINUE; END IF;
  INSERT INTO public.notifications(recipient_id,type,title,message,action_url,data)
   VALUES(c.payer_id,'hosting_expiry','Your project hosting period ends soon',
    'Your hosting period ends on '||to_char(c.hosting_expires_at AT TIME ZONE 'UTC','YYYY-MM-DD')||'. Review your project and download your archive before that date.',
    '/dashboard/projects/'||c.project_id::text,
    jsonb_build_object('hosting_reminder_id',reminder,'hosting_order_id',c.order_id,'hosting_project_id',c.project_id,
     'hosting_expires_at',c.hosting_expires_at,'days_before',c.days)) RETURNING id INTO notification;
  UPDATE public.hosting_reminders SET notification_id=notification WHERE id=reminder;
  sent:=sent+1;
 END LOOP;
 RETURN jsonb_build_object('inAppSent',sent);
END $$;
REVOKE ALL ON FUNCTION public.tick_hosting_reminders(integer,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.tick_hosting_reminders(integer,boolean) TO service_role;

CREATE FUNCTION public.hosting_reminder_email_payload(h public.hosting_reminders) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_object('id',h.id,'token',h.email_token,'orderId',h.order_id,'projectId',h.project_id,
  'expiresAt',h.expires_at,'daysBefore',h.days_before,'email',u.email)
 FROM auth.users u WHERE u.id=h.recipient_id AND u.email_confirmed_at IS NOT NULL AND u.email IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.hosting_reminder_email_payload(public.hosting_reminders) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.claim_hosting_reminder_email() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET timezone='UTC' SET lock_timeout='3s' AS $$
DECLARE c record; h public.hosting_reminders; payload jsonb;
BEGIN
 LOCK TABLE public.deletion_requests IN SHARE MODE NOWAIT;
 -- Outbound permits are never re-claimed, even after the provider's 24h key expires.
 -- Surface abandoned calls as unknown for operator reconciliation.
 UPDATE public.hosting_reminders SET email_state='unknown' WHERE id IN (
  SELECT id FROM public.hosting_reminders WHERE email_state='outbound' AND email_outbound_at<clock_timestamp()-interval '15 minutes'
  ORDER BY email_outbound_at LIMIT 100 FOR UPDATE SKIP LOCKED);
 FOR c IN SELECT id,order_id,project_id FROM public.hosting_reminders
 WHERE email_state='queued' OR (email_state='preparing' AND email_lease_until<=clock_timestamp())
 ORDER BY created_at,id LIMIT 100 LOOP
  IF NOT public.lock_hosting_reminder_source(c.order_id,c.project_id) THEN CONTINUE; END IF;
  SELECT * INTO h FROM public.hosting_reminders WHERE id=c.id FOR UPDATE;
  IF NOT FOUND OR NOT(h.email_state='queued' OR (h.email_state='preparing' AND h.email_lease_until<=clock_timestamp())) THEN CONTINUE; END IF;
  IF NOT public.hosting_reminder_source_valid(h.order_id,h.project_id,h.recipient_id,h.expires_at,h.days_before) THEN
   UPDATE public.hosting_reminders SET email_state='canceled',email_token=NULL,email_lease_until=NULL WHERE id=h.id;CONTINUE;
  END IF;
  IF h.email_attempts>=5 OR public.hosting_reminder_email_payload(h) IS NULL THEN
   UPDATE public.hosting_reminders SET email_state='failed',email_token=NULL,email_lease_until=NULL WHERE id=h.id;CONTINUE;
  END IF;
  UPDATE public.hosting_reminders SET email_state='preparing',email_attempts=email_attempts+1,
   email_token=gen_random_uuid(),email_lease_until=clock_timestamp()+interval '2 minutes' WHERE id=h.id RETURNING * INTO h;
  payload:=public.hosting_reminder_email_payload(h);
  RETURN payload;
 END LOOP;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.claim_hosting_reminder_email() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.claim_hosting_reminder_email() TO service_role;

CREATE FUNCTION public.begin_hosting_reminder_email(p_id uuid,p_token uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET timezone='UTC' SET lock_timeout='3s' AS $$
DECLARE h public.hosting_reminders; payload jsonb;
BEGIN
 LOCK TABLE public.deletion_requests IN SHARE MODE NOWAIT;
 SELECT * INTO h FROM public.hosting_reminders WHERE id=p_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','canceled'); END IF;
 IF NOT public.lock_hosting_reminder_source(h.order_id,h.project_id) THEN RAISE EXCEPTION 'Reminder source is busy' USING ERRCODE='55P03'; END IF;
 SELECT * INTO h FROM public.hosting_reminders WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR h.email_state='canceled' THEN RETURN jsonb_build_object('status','canceled'); END IF;
 IF p_token IS NULL OR h.email_token IS DISTINCT FROM p_token THEN RAISE EXCEPTION 'Reminder lease changed' USING ERRCODE='23505'; END IF;
 IF h.email_state='sent' THEN RETURN jsonb_build_object('status','sent'); END IF;
 IF NOT public.hosting_reminder_source_valid(h.order_id,h.project_id,h.recipient_id,h.expires_at,h.days_before) OR public.hosting_reminder_email_payload(h) IS NULL THEN
  UPDATE public.hosting_reminders SET email_state='canceled',email_lease_until=NULL WHERE id=h.id;
  RETURN jsonb_build_object('status','canceled');
 END IF;
 IF h.email_state<>'preparing' THEN RETURN jsonb_build_object('status','unknown'); END IF;
 IF h.email_lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'Reminder lease expired' USING ERRCODE='23505'; END IF;
 UPDATE public.hosting_reminders SET email_state='outbound',email_outbound_at=clock_timestamp(),email_lease_until=NULL WHERE id=h.id RETURNING * INTO h;
 RETURN public.hosting_reminder_email_payload(h)||jsonb_build_object('status','outbound');
END $$;
REVOKE ALL ON FUNCTION public.begin_hosting_reminder_email(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.begin_hosting_reminder_email(uuid,uuid) TO service_role;

CREATE FUNCTION public.complete_hosting_reminder_email(p_id uuid,p_token uuid,p_status text,p_receipt text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET timezone='UTC' SET lock_timeout='3s' AS $$
DECLARE h public.hosting_reminders;
BEGIN
 IF p_status IS NULL OR p_status NOT IN('sent','unknown','failed') OR
 (p_status='sent' AND (p_receipt IS NULL OR p_receipt !~ '^[A-Za-z0-9_-]{1,200}$')) THEN RAISE EXCEPTION 'Invalid email receipt' USING ERRCODE='22023'; END IF;
 SELECT * INTO h FROM public.hosting_reminders WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR h.email_state='canceled' THEN RETURN jsonb_build_object('status','canceled'); END IF;
 IF p_token IS NULL OR h.email_token IS DISTINCT FROM p_token THEN RAISE EXCEPTION 'Reminder lease changed' USING ERRCODE='23505'; END IF;
 IF h.email_state='sent' AND p_status='sent' AND h.email_receipt=p_receipt THEN RETURN jsonb_build_object('status','sent'); END IF;
 IF h.email_state NOT IN('outbound','unknown') THEN RAISE EXCEPTION 'No outbound reminder' USING ERRCODE='23505'; END IF;
 UPDATE public.hosting_reminders SET email_state=p_status,email_receipt=CASE WHEN p_status='sent' THEN p_receipt ELSE NULL END,
  email_sent_at=CASE WHEN p_status='sent' THEN clock_timestamp() ELSE NULL END WHERE id=p_id;
 RETURN jsonb_build_object('status',p_status);
END $$;
REVOKE ALL ON FUNCTION public.complete_hosting_reminder_email(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.complete_hosting_reminder_email(uuid,uuid,text,text) TO service_role;

CREATE FUNCTION public.cancel_changed_hosting_reminders() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 DELETE FROM public.notifications n USING public.hosting_reminders h WHERE n.id=h.notification_id AND h.order_id=NEW.order_id
  AND (NEW.status<>'active' OR NEW.project_id IS DISTINCT FROM h.project_id OR NEW.hosting_expires_at IS DISTINCT FROM h.expires_at);
 UPDATE public.hosting_reminders h SET email_state='canceled',email_lease_until=NULL
 WHERE h.order_id=NEW.order_id AND (NEW.status<>'active' OR NEW.project_id IS DISTINCT FROM h.project_id OR NEW.hosting_expires_at IS DISTINCT FROM h.expires_at);
 RETURN NEW;
END $$;
CREATE TRIGGER cancel_changed_hosting_reminders AFTER UPDATE ON public.payment_project_rights
FOR EACH ROW EXECUTE FUNCTION public.cancel_changed_hosting_reminders();
REVOKE ALL ON FUNCTION public.cancel_changed_hosting_reminders() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.erase_hosting_reminders() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE pid uuid;
BEGIN
 IF TG_TABLE_NAME='deletion_requests' THEN
  IF NEW.tombstone_at IS NULL OR NEW.subject_id IS DISTINCT FROM NEW.project_id::text THEN RETURN NEW; END IF;
  pid:=NEW.project_id;
 ELSIF TG_OP='DELETE' THEN pid:=OLD.id;
 ELSE IF NEW.status IS DISTINCT FROM 'deleted' THEN RETURN NEW; END IF;pid:=NEW.id;
 END IF;
 DELETE FROM public.notifications WHERE data->>'hosting_project_id'=pid::text;
 DELETE FROM public.hosting_reminders WHERE project_id=pid;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;RETURN NEW;
END $$;
CREATE TRIGGER erase_hosting_reminders_before_project_delete BEFORE DELETE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.erase_hosting_reminders();
CREATE TRIGGER erase_hosting_reminders_on_project_status AFTER UPDATE OF status ON public.projects FOR EACH ROW EXECUTE FUNCTION public.erase_hosting_reminders();
CREATE TRIGGER erase_hosting_reminders_on_tombstone AFTER INSERT OR UPDATE OF tombstone_at ON public.deletion_requests FOR EACH ROW EXECUTE FUNCTION public.erase_hosting_reminders();
REVOKE ALL ON FUNCTION public.erase_hosting_reminders() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;

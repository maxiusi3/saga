-- Synthetic PG17 composition only; intentionally not a production migration.
BEGIN;
DO $$ BEGIN
 IF pg_catalog.current_database()<>'saga_pg17_rehearsal'
 OR pg_catalog.current_setting('saga.invitation_management',true) IS DISTINCT FROM 'only_synthetic_local' THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='local candidate only';
 END IF;
END $$;
SET ROLE fixture_owner;

CREATE OR REPLACE FUNCTION invitation_candidate._management_confirmed(p_actor uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE mail text;
BEGIN
 SELECT u.email INTO mail FROM auth.users u WHERE u.id=$1 AND u.email_confirmed_at IS NOT NULL;
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM invitation_candidate._email(mail);
 RETURN true;
EXCEPTION WHEN invalid_parameter_value THEN RETURN false;
END $$;

-- The wallet is a mirror. Authority requires the durable grant event AND its
-- matching purchase audit; fixture-manager or legacy wallet rows cannot mint it.
CREATE OR REPLACE FUNCTION invitation_candidate._management_source_valid(p_source_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(
  SELECT 1 FROM invitation_candidate.trusted_seat_sources s
  JOIN entitlement_candidate.sources l ON l.source_id=s.id
  JOIN public.seat_transactions t ON t.id=l.grant_transaction_id
  WHERE s.id=$1 AND (l.payer_id,l.resource_type,l.quantity)=(s.payer_id,s.resource_type,s.issued)
  AND t.user_id=s.payer_id AND t.resource_type=s.resource_type
  AND t.transaction_type='purchase' AND t.amount=l.quantity AND t.project_id IS NULL
  AND t.metadata->>'entitlement_source_id'=s.id::text
  AND EXISTS(SELECT 1 FROM entitlement_candidate.events e
   WHERE e.source_id=s.id AND e.provider=l.provider AND e.source_key=l.source_key
   AND e.payer_id=l.payer_id AND e.resource_type=l.resource_type AND e.quantity=l.quantity
   AND e.kind='grant' AND e.outcome='granted'))
$$;

CREATE OR REPLACE FUNCTION invitation_candidate.available_sources(p_project_id uuid,p_role text)
RETURNS TABLE(source_id uuid,project_id uuid,role text,remaining integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();
BEGIN
 IF $1 IS NULL OR $2 IS NULL OR $2 NOT IN ('facilitator','storyteller') THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid management payload';
 END IF;
 IF actor IS NULL OR NOT invitation_candidate._management_confirmed(actor)
 OR NOT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=$1 AND p.facilitator_id=actor AND p.status='active') THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='management access denied';
 END IF;
 IF $2='storyteller' AND (
  EXISTS(SELECT 1 FROM public.project_roles m WHERE m.project_id=$1 AND m.role='storyteller' AND m.status IN ('active','pending'))
  OR EXISTS(SELECT 1 FROM invitation_candidate.bindings b WHERE b.project_id=$1 AND b.role='storyteller' AND b.state='reserved')) THEN RETURN; END IF;
 RETURN QUERY SELECT s.id,$1,$2,s.remaining
 FROM invitation_candidate.trusted_seat_sources s
 JOIN public.user_resource_wallets w ON w.user_id=s.payer_id
 WHERE s.payer_id=actor AND s.resource_type=$2||'_seat' AND s.verified AND NOT s.revoked
 AND s.remaining>0 AND s.remaining<=s.issued
 AND CASE $2 WHEN 'facilitator' THEN w.facilitator_seats ELSE w.storyteller_seats END>0
 AND invitation_candidate._management_source_valid(s.id)
 ORDER BY s.id LIMIT 100;
END $$;

CREATE OR REPLACE FUNCTION invitation_candidate.management_list(p_project_id uuid,p_after uuid DEFAULT NULL)
RETURNS TABLE(invitation_id uuid,project_id uuid,invitee_email text,role text,status text,expires_at timestamptz,created_at timestamptz,request_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); b invitation_candidate.bindings; i public.invitations;
 s invitation_candidate.trusted_seat_sources; m public.project_roles;
BEGIN
 IF $1 IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid management payload'; END IF;
 IF actor IS NULL OR NOT invitation_candidate._management_confirmed(actor)
 OR NOT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=$1 AND p.facilitator_id=actor) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='management access denied';
 END IF;
 -- Validate the complete project history in this statement's snapshot before
 -- pagination. Transfer/revocation are history; inconsistent durable data is not.
 FOR b IN SELECT x.* FROM invitation_candidate.bindings x WHERE x.project_id=$1 LOOP
  SELECT x.* INTO i FROM public.invitations x WHERE x.id=b.invitation_id;
  IF NOT FOUND OR (i.project_id,i.inviter_id,i.invitee_email,i.role,i.token,i.expires_at,i.message)
   IS DISTINCT FROM (b.project_id,b.payer_id,b.invitee_email,b.role,b.token,b.expires_at,b.message)
   OR i.created_at IS NULL OR i.expires_at<=i.created_at
   OR b.invitee_email IS DISTINCT FROM invitation_candidate._email(b.invitee_email)
   OR b.quantity<>1 OR b.role NOT IN ('facilitator','storyteller')
   OR NOT invitation_candidate._log_matches(b.reserve_transaction_id,b.payer_id,b.project_id,b.role||'_seat','reserve',-1) THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='management binding denied';
  END IF;
  SELECT x.* INTO s FROM invitation_candidate.trusted_seat_sources x WHERE x.id=b.source_id;
  IF NOT FOUND OR (s.payer_id,s.resource_type) IS DISTINCT FROM (b.payer_id,b.role||'_seat')
   OR NOT invitation_candidate._management_source_valid(s.id) THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='management source denied';
  END IF;
  IF EXISTS(SELECT 1 FROM invitation_candidate.requests r WHERE r.invitation_id=b.invitation_id
   AND (r.actor_id,r.project_id,r.invitee_email,r.role,r.source_id,r.message)
    IS DISTINCT FROM (b.payer_id,b.project_id,b.invitee_email,b.role,b.source_id,b.message)) THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='management request denied';
  END IF;
  IF b.state='reserved' THEN
   IF i.status IS DISTINCT FROM 'pending' OR i.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='management state denied'; END IF;
  ELSIF b.state='released' THEN
   IF i.status IS DISTINCT FROM (CASE b.release_reason WHEN 'cancelled' THEN 'declined' WHEN 'expired' THEN 'expired' END)
    OR i.accepted_at IS NOT NULL
    OR NOT invitation_candidate._log_matches(b.release_transaction_id,b.payer_id,b.project_id,b.role||'_seat','release',1) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='management state denied'; END IF;
  ELSIF b.state='consumed' THEN
   IF i.status IS DISTINCT FROM 'accepted' OR i.accepted_at IS DISTINCT FROM b.joined_at
    OR NOT invitation_candidate._log_matches(b.activation_transaction_id,b.payer_id,b.project_id,b.role||'_seat','activate',0) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='management state denied'; END IF;
   SELECT x.* INTO m FROM public.project_roles x WHERE x.id=b.member_id;
   IF FOUND AND (m.project_id,m.user_id,m.role,m.invited_by,m.joined_at)
    IS DISTINCT FROM (b.project_id,b.accepted_user_id,b.role,b.payer_id,b.joined_at) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='management member denied'; END IF;
  ELSE RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='management state denied';
  END IF;
 END LOOP;
 RETURN QUERY SELECT v.id,v.project_id,v.invitee_email,v.role,v.status,v.expires_at,v.created_at,
  (SELECT r.request_id FROM invitation_candidate.requests r WHERE r.invitation_id=v.id AND r.actor_id=actor ORDER BY r.request_id LIMIT 1)
 FROM invitation_candidate.bindings x JOIN public.invitations v ON v.id=x.invitation_id
 WHERE x.project_id=$1 AND ($2 IS NULL OR x.invitation_id>$2)
 ORDER BY x.invitation_id LIMIT 50;
END $$;

REVOKE ALL ON FUNCTION invitation_candidate._management_confirmed(uuid),invitation_candidate._management_source_valid(uuid),invitation_candidate.available_sources(uuid,text),invitation_candidate.management_list(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role,metadata_reader,entitlement_writer;
GRANT EXECUTE ON FUNCTION invitation_candidate.available_sources(uuid,text),invitation_candidate.management_list(uuid,uuid) TO authenticated;
RESET ROLE;
COMMIT;

-- Empty-environment composition only; not a production migration/payment adapter.
BEGIN;
DO $$ BEGIN
 IF pg_catalog.current_database()<>'saga_pg17_rehearsal'
 OR pg_catalog.current_setting('saga.entitlement_events',true) IS DISTINCT FROM 'only_synthetic_local' THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='local candidate only';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='entitlement_writer' AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolinherit)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE roleid=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='entitlement_writer') OR member=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='entitlement_writer')) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='writer boundary invalid';
 END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS entitlement_candidate AUTHORIZATION fixture_owner;
REVOKE ALL ON SCHEMA entitlement_candidate FROM PUBLIC,anon,authenticated,service_role,metadata_reader,entitlement_writer;
GRANT USAGE ON SCHEMA entitlement_candidate TO entitlement_writer;
SET ROLE fixture_owner;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE TABLE IF NOT EXISTS entitlement_candidate.sources(
 source_id uuid PRIMARY KEY REFERENCES invitation_candidate.trusted_seat_sources(id),
 provider text COLLATE "C" NOT NULL CHECK(provider ~ '^[A-Za-z0-9_.:-]{1,64}$'),
 source_key text COLLATE "C" NOT NULL CHECK(source_key ~ '^[A-Za-z0-9_.:-]{1,128}$'),
 payer_id uuid NOT NULL REFERENCES auth.users(id),
 resource_type text NOT NULL CHECK(resource_type IN ('facilitator_seat','storyteller_seat')),
 quantity integer NOT NULL CHECK(quantity>0),
 first_event_id text COLLATE "C" NOT NULL,
 grant_transaction_id uuid UNIQUE REFERENCES public.seat_transactions(id),
 UNIQUE(provider,source_key)
);
CREATE TABLE IF NOT EXISTS entitlement_candidate.events(
 provider text COLLATE "C" NOT NULL CHECK(provider ~ '^[A-Za-z0-9_.:-]{1,64}$'),
 event_id text COLLATE "C" NOT NULL CHECK(event_id ~ '^[A-Za-z0-9_.:-]{1,128}$'),
 source_key text COLLATE "C" NOT NULL CHECK(source_key ~ '^[A-Za-z0-9_.:-]{1,128}$'),
 kind text NOT NULL CHECK(kind IN ('grant','revoke')),
 payer_id uuid NOT NULL REFERENCES auth.users(id),
 resource_type text NOT NULL CHECK(resource_type IN ('facilitator_seat','storyteller_seat')),
 quantity integer NOT NULL CHECK(quantity>0),
 source_id uuid NOT NULL REFERENCES entitlement_candidate.sources(source_id),
 outcome text NOT NULL CHECK(outcome IN ('granted','already_granted','revoked','already_revoked','grant_suppressed')),
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 PRIMARY KEY(provider,event_id),UNIQUE(provider,event_id,source_id)
);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='entitlement_candidate.sources'::regclass AND conname='source_first_event') THEN
  ALTER TABLE entitlement_candidate.sources ADD CONSTRAINT source_first_event FOREIGN KEY(provider,first_event_id,source_id) REFERENCES entitlement_candidate.events(provider,event_id,source_id) DEFERRABLE INITIALLY DEFERRED;
 END IF;
 -- Never silently adopt old fixture-manager sources or bindings.
 IF EXISTS(SELECT 1 FROM invitation_candidate.trusted_seat_sources s LEFT JOIN entitlement_candidate.sources l ON l.source_id=s.id WHERE l.source_id IS NULL)
 OR EXISTS(SELECT 1 FROM invitation_candidate.bindings b LEFT JOIN entitlement_candidate.sources l ON l.source_id=b.source_id WHERE l.source_id IS NULL) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='unbacked source rejected';
 END IF;
END $$;
ALTER TABLE entitlement_candidate.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlement_candidate.events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA entitlement_candidate FROM PUBLIC,anon,authenticated,service_role,metadata_reader,entitlement_writer;
REVOKE ALL ON ALL TABLES IN SCHEMA invitation_candidate FROM PUBLIC,anon,authenticated,service_role,metadata_reader,entitlement_writer;
REVOKE ALL ON SCHEMA invitation_candidate FROM entitlement_writer;

CREATE OR REPLACE FUNCTION entitlement_candidate._identifier(value text,max_length integer) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$ BEGIN
 IF $1 IS NULL OR pg_catalog.octet_length($1)<1 OR pg_catalog.octet_length($1)>$2 OR $1 !~ '^[A-Za-z0-9_.:-]+$' THEN
 RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid event identifier'; END IF;
END $$;
CREATE OR REPLACE FUNCTION entitlement_candidate.apply_event(provider text,event_id text,source_key text,kind text,payer_id uuid,resource_type text,quantity integer)
RETURNS TABLE(source_id uuid,outcome text,revoked boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE
 e entitlement_candidate.events; l entitlement_candidate.sources;
 s invitation_candidate.trusted_seat_sources; w public.user_resource_wallets;
 b invitation_candidate.bindings; m public.project_roles;
 sid uuid; logid uuid; projects uuid[]; project uuid; outcome_value text;
BEGIN
 PERFORM entitlement_candidate._identifier($1,64);
 PERFORM entitlement_candidate._identifier($2,128);
 PERFORM entitlement_candidate._identifier($3,128);
 IF $4 IS NULL OR $4 NOT IN ('grant','revoke') OR $5 IS NULL OR $6 IS NULL OR $6 NOT IN ('facilitator_seat','storyteller_seat') OR $7 IS NULL OR $7<=0 THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid event payload';
 END IF;
 -- Separate event/source serialization gates precede all row locks. They cannot
 -- depend on user-controlled JWT claims and hash collisions only serialize work.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('event:'||pg_catalog.length($1)||':'||$1||$2,0));
 SELECT * INTO e FROM entitlement_candidate.events x WHERE x.provider=$1 AND x.event_id=$2;
 IF FOUND THEN
  IF (e.source_key,e.kind,e.payer_id,e.resource_type,e.quantity) IS DISTINCT FROM ($3,$4,$5,$6,$7) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='event payload conflict'; END IF;
  RETURN QUERY SELECT e.source_id,e.outcome,x.revoked FROM invitation_candidate.trusted_seat_sources x WHERE x.id=e.source_id;RETURN;
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('source:'||pg_catalog.length($1)||':'||$1||$3,0));
 SELECT * INTO l FROM entitlement_candidate.sources x WHERE x.provider=$1 AND x.source_key=$3;
 IF FOUND AND (l.payer_id,l.resource_type,l.quantity) IS DISTINCT FROM ($5,$6,$7) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='source payload conflict'; END IF;
 sid:=l.source_id;
 -- Discovery is only a locator. Projects must precede wallet/source/member locks.
 SELECT COALESCE(pg_catalog.array_agg(q.project_id ORDER BY q.project_id),ARRAY[]::uuid[]) INTO projects
 FROM (SELECT DISTINCT x.project_id FROM invitation_candidate.bindings x WHERE x.source_id=sid) q;
 FOREACH project IN ARRAY projects LOOP
  PERFORM 1 FROM public.projects x WHERE x.id=project FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='source project missing'; END IF;
 END LOOP;
 -- ON CONFLICT serializes initially absent wallets, without legacy gift routines.
 IF sid IS NULL AND $4='grant' THEN
  INSERT INTO public.user_resource_wallets(user_id,project_vouchers,facilitator_seats,storyteller_seats) VALUES($5,0,0,0) ON CONFLICT(user_id) DO NOTHING;
 END IF;
 SELECT * INTO w FROM public.user_resource_wallets x WHERE x.user_id=$5 FOR UPDATE;
 -- All invitation mutations serialize on this wallet. A newly committed project
 -- cannot be locked here without inverting the documented order: refuse/retry.
 IF EXISTS(SELECT 1 FROM invitation_candidate.bindings x WHERE x.source_id=sid AND NOT (x.project_id=ANY(projects))) THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='source project discovery changed'; END IF;
 IF sid IS NULL THEN
  sid:=pg_catalog.gen_random_uuid();
  INSERT INTO invitation_candidate.trusted_seat_sources(id,payer_id,resource_type,issued,remaining,verified,revoked)
  VALUES(sid,$5,$6,$7,CASE $4 WHEN 'grant' THEN $7 ELSE 0 END,true,$4='revoke');
  INSERT INTO entitlement_candidate.sources(source_id,provider,source_key,payer_id,resource_type,quantity,first_event_id) VALUES(sid,$1,$3,$5,$6,$7,$2) RETURNING * INTO l;
 END IF;
 SELECT * INTO s FROM invitation_candidate.trusted_seat_sources x WHERE x.id=sid FOR UPDATE;
 IF NOT FOUND OR (s.payer_id,s.resource_type,s.issued,s.verified) IS DISTINCT FROM ($5,$6,$7,true) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='source ledger mismatch'; END IF;
 IF $4='grant' THEN
  IF s.revoked THEN outcome_value:='grant_suppressed';
  ELSIF l.grant_transaction_id IS NOT NULL THEN outcome_value:='already_granted';
  ELSE
   IF w.user_id IS NULL OR w.project_vouchers IS NULL OR w.facilitator_seats IS NULL OR w.storyteller_seats IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='wallet state invalid'; END IF;
   UPDATE public.user_resource_wallets x SET facilitator_seats=x.facilitator_seats+CASE $6 WHEN 'facilitator_seat' THEN $7 ELSE 0 END,storyteller_seats=x.storyteller_seats+CASE $6 WHEN 'storyteller_seat' THEN $7 ELSE 0 END WHERE x.user_id=$5;
   INSERT INTO public.seat_transactions AS x(user_id,transaction_type,resource_type,amount,metadata) VALUES($5,'purchase',$6,$7,pg_catalog.jsonb_build_object('entitlement_source_id',sid)) RETURNING x.id INTO logid;
   UPDATE entitlement_candidate.sources x SET grant_transaction_id=logid WHERE x.source_id=sid;
   outcome_value:='granted';
  END IF;
 ELSE
  outcome_value:=CASE WHEN s.revoked AND l.first_event_id<>$2 THEN 'already_revoked' ELSE 'revoked' END;
  -- Check the durable mappings even on later distinct revoke events; never
  -- recreate deleted/inactive access and never touch unrelated membership.
  FOR b IN SELECT * FROM invitation_candidate.bindings x WHERE x.source_id=sid ORDER BY x.project_id,x.invitation_id FOR UPDATE LOOP
   IF (b.payer_id,b.role||'_seat') IS DISTINCT FROM ($5,$6) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='binding source mismatch'; END IF;
   IF b.state='consumed' THEN
    SELECT * INTO m FROM public.project_roles x WHERE x.id=b.member_id FOR UPDATE;
    IF FOUND THEN
     IF (m.project_id,m.user_id,m.role) IS DISTINCT FROM (b.project_id,b.accepted_user_id,b.role) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='member binding mismatch'; END IF;
     IF m.status='active' THEN UPDATE public.project_roles x SET status='inactive' WHERE x.id=m.id; END IF;
    END IF;
   END IF;
  END LOOP;
  IF NOT s.revoked THEN UPDATE invitation_candidate.trusted_seat_sources x SET revoked=true WHERE x.id=sid; END IF;
 END IF;
 INSERT INTO entitlement_candidate.events VALUES($1,$2,$3,$4,$5,$6,$7,sid,outcome_value,pg_catalog.clock_timestamp());
 RETURN QUERY SELECT sid,outcome_value,x.revoked FROM invitation_candidate.trusted_seat_sources x WHERE x.id=sid;
END $$;
CREATE OR REPLACE FUNCTION entitlement_candidate.lookup_event(provider text,event_id text)
RETURNS TABLE(source_id uuid,outcome text,revoked boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM entitlement_candidate._identifier($1,64);PERFORM entitlement_candidate._identifier($2,128);
 RETURN QUERY SELECT e.source_id,e.outcome,s.revoked FROM entitlement_candidate.events e JOIN invitation_candidate.trusted_seat_sources s ON s.id=e.source_id WHERE e.provider=$1 AND e.event_id=$2;
END $$;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA entitlement_candidate FROM PUBLIC,anon,authenticated,service_role,metadata_reader,entitlement_writer;
GRANT EXECUTE ON FUNCTION entitlement_candidate.apply_event(text,text,text,text,uuid,text,integer),entitlement_candidate.lookup_event(text,text) TO entitlement_writer;
-- Close every table AND explicit column grant, including PUBLIC grants. REVOKE
-- table privileges alone does not remove column ACLs in PostgreSQL.
DO $$ DECLARE t text; columns text; BEGIN
 FOREACH t IN ARRAY ARRAY['public.projects','public.project_roles','public.project_members','public.user_resource_wallets','public.seat_transactions','public.invitations','invitation_candidate.trusted_seat_sources','invitation_candidate.bindings','invitation_candidate.requests','entitlement_candidate.sources','entitlement_candidate.events'] LOOP
  EXECUTE 'REVOKE ALL ON TABLE '||t||' FROM PUBLIC,anon,authenticated,service_role,metadata_reader,entitlement_writer';
  SELECT pg_catalog.string_agg(pg_catalog.quote_ident(a.attname),',') INTO columns FROM pg_catalog.pg_attribute a WHERE a.attrelid=t::regclass AND a.attnum>0 AND NOT a.attisdropped;
  EXECUTE 'REVOKE INSERT('||columns||'),UPDATE('||columns||'),REFERENCES('||columns||'),SELECT('||columns||') ON TABLE '||t||' FROM PUBLIC,anon,authenticated,service_role,metadata_reader,entitlement_writer';
 END LOOP;
END $$;
RESET ROLE;
-- PUBLIC would also authorize the writer on unrelated public business RPCs.
-- Ordinary explicit grants remain; the writer receives only its two entries.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,entitlement_writer;
-- Exact reviewed unsafe write-RPC signatures. Their definitions stay unchanged.
DO $$ DECLARE identity text; BEGIN
 FOREACH identity IN ARRAY ARRAY[
 'public.accept_project_invitation(uuid,uuid)',
 'public.cleanup_expired_invitations()',
 'public.create_project_with_role(text,text,uuid,text)',
 'public.initialize_user_wallet(uuid)',
 'public.process_package_purchase(uuid,text,integer,integer,text)',
 'public.process_package_purchase(text,text,uuid)',
 'public.send_project_invitation(uuid,uuid,text,uuid,text)'
 ] LOOP
  EXECUTE 'REVOKE EXECUTE ON FUNCTION '||identity||' FROM PUBLIC,anon,authenticated,service_role,metadata_reader,entitlement_writer';
 END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.request_data_export(uuid,uuid,boolean,boolean),public.request_data_export(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role,metadata_reader,entitlement_writer;
GRANT EXECUTE ON FUNCTION public.request_data_export(uuid,uuid,boolean,boolean),public.request_data_export(uuid,uuid,jsonb) TO authenticated;
COMMIT;

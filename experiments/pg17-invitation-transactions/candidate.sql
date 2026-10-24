-- Synthetic local candidate only. The old public RPC definitions remain untouched.
BEGIN;
DO $$ BEGIN
 IF pg_catalog.current_database() <> 'saga_pg17_rehearsal'
 OR pg_catalog.current_setting('saga.invitation_transactions',true) IS DISTINCT FROM 'only_synthetic_local' THEN
  RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='local candidate only';
 END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS invitation_candidate AUTHORIZATION fixture_owner;
REVOKE ALL ON SCHEMA invitation_candidate FROM PUBLIC,anon,authenticated,metadata_reader,service_role;
GRANT USAGE ON SCHEMA invitation_candidate TO authenticated;
SET ROLE fixture_owner;
CREATE TABLE IF NOT EXISTS invitation_candidate.trusted_seat_sources (
 id uuid PRIMARY KEY,
 payer_id uuid NOT NULL REFERENCES auth.users(id),
 resource_type text NOT NULL CHECK(resource_type IN ('facilitator_seat','storyteller_seat')),
 issued integer NOT NULL CHECK(issued>=0),
 remaining integer NOT NULL CHECK(remaining>=0 AND remaining<=issued),
 verified boolean NOT NULL,
 revoked boolean NOT NULL
);
COMMENT ON TABLE invitation_candidate.trusted_seat_sources IS 'Synthetic trusted entitlement port. Fixture-manager supplied; not evidence of a real payment provider.';
CREATE TABLE IF NOT EXISTS invitation_candidate.bindings (
 invitation_id uuid PRIMARY KEY REFERENCES public.invitations(id),
 project_id uuid NOT NULL REFERENCES public.projects(id),
 payer_id uuid NOT NULL REFERENCES auth.users(id),
 invitee_email text NOT NULL,
 role text NOT NULL CHECK(role IN ('facilitator','storyteller')),
 token text NOT NULL UNIQUE CHECK(token ~ '^v1_[0-9a-f]{32}$' AND length(token)=35),
 expires_at timestamptz NOT NULL,
 message text,
 source_id uuid NOT NULL REFERENCES invitation_candidate.trusted_seat_sources(id),
 quantity integer NOT NULL DEFAULT 1 CHECK(quantity=1),
 state text NOT NULL CHECK(state IN ('reserved','consumed','released')),
 reserve_transaction_id uuid NOT NULL UNIQUE REFERENCES public.seat_transactions(id),
 activation_transaction_id uuid UNIQUE REFERENCES public.seat_transactions(id),
 release_transaction_id uuid UNIQUE REFERENCES public.seat_transactions(id),
 release_reason text CHECK(release_reason IN ('cancelled','expired')),
 member_id uuid,
 accepted_user_id uuid REFERENCES auth.users(id),
 joined_at timestamptz,
 CHECK((state='reserved' AND member_id IS NULL AND accepted_user_id IS NULL AND joined_at IS NULL AND release_reason IS NULL AND activation_transaction_id IS NULL AND release_transaction_id IS NULL)
 OR (state='consumed' AND member_id IS NOT NULL AND accepted_user_id IS NOT NULL AND joined_at IS NOT NULL AND activation_transaction_id IS NOT NULL AND release_reason IS NULL AND release_transaction_id IS NULL)
 OR (state='released' AND member_id IS NULL AND accepted_user_id IS NULL AND joined_at IS NULL AND activation_transaction_id IS NULL AND release_reason IS NOT NULL AND release_transaction_id IS NOT NULL))
);
-- No member FK: deletion/revocation must retain the durable historical mapping,
-- so retries can deny instead of recreating deleted access.
CREATE UNIQUE INDEX IF NOT EXISTS one_reserved_target ON invitation_candidate.bindings(project_id,invitee_email,role) WHERE state='reserved';
CREATE TABLE IF NOT EXISTS invitation_candidate.requests (
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 request_id uuid NOT NULL,
 invitation_id uuid NOT NULL REFERENCES invitation_candidate.bindings(invitation_id),
 project_id uuid NOT NULL,
 invitee_email text NOT NULL,
 role text NOT NULL,
 source_id uuid NOT NULL,
 message text,
 PRIMARY KEY(actor_id,request_id)
);
ALTER TABLE invitation_candidate.trusted_seat_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_candidate.bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_candidate.requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA invitation_candidate FROM PUBLIC,anon,authenticated,metadata_reader,service_role;

CREATE OR REPLACE FUNCTION invitation_candidate._email(value text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE normalized text;
BEGIN
 -- Only outer ASCII whitespace is removed; no Unicode folding or provider rules.
 normalized:=pg_catalog.btrim($1,E' \t\n\r\f\013');
 IF normalized IS NULL OR normalized !~ '^[!-~]+@[!-~]+$'
 OR pg_catalog.length(normalized)-pg_catalog.length(pg_catalog.replace(normalized,'@',''))<>1 THEN
  RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='invalid candidate email';
 END IF;
 RETURN pg_catalog.lower(normalized);
END $$;
CREATE OR REPLACE FUNCTION invitation_candidate._token(value text) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$ BEGIN
 IF $1 IS NULL OR pg_catalog.length($1)<>35 OR $1 !~ '^v1_[0-9a-f]{32}$' THEN
  RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='invalid candidate token';
 END IF;
END $$;
CREATE OR REPLACE FUNCTION invitation_candidate._log_matches(log_id uuid,payer uuid,project uuid,resource text,kind text,amount integer) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.seat_transactions t WHERE t.id=$1 AND t.user_id=$2 AND t.project_id=$3 AND t.resource_type=$4 AND t.transaction_type=$5 AND t.amount=$6)
$$;

-- One lock/validation path for all already-persisted invitations. Initial reads
-- locate only; each authorization decision uses rows reread after row locks.
CREATE OR REPLACE FUNCTION invitation_candidate._load(invitation uuid,audience text) RETURNS invitation_candidate.bindings
LANGUAGE plpgsql VOLATILE SET search_path='' AS $$
DECLARE
 b invitation_candidate.bindings; located invitation_candidate.bindings;
 i public.invitations; p public.projects; u auth.users;
 w public.user_resource_wallets; s invitation_candidate.trusted_seat_sources;
 m public.project_roles; actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL OR $1 IS NULL OR $2 NOT IN ('recipient','sender','release') THEN
  RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate access denied';
 END IF;
 SELECT * INTO located FROM invitation_candidate.bindings x WHERE x.invitation_id=$1;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate access denied'; END IF;
 SELECT * INTO p FROM public.projects x WHERE x.id=located.project_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate access denied'; END IF;
 -- Exclude identity updates/deletion, but allow later member/log FK KEY SHARE.
 SELECT * INTO u FROM auth.users x WHERE x.id=actor FOR NO KEY UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate access denied'; END IF;
 SELECT * INTO i FROM public.invitations x WHERE x.id=$1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate access denied'; END IF;
 SELECT * INTO w FROM public.user_resource_wallets x WHERE x.user_id=located.payer_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate access denied'; END IF;
 SELECT * INTO s FROM invitation_candidate.trusted_seat_sources x WHERE x.id=located.source_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate access denied'; END IF;
 SELECT * INTO b FROM invitation_candidate.bindings x WHERE x.invitation_id=$1 FOR UPDATE;
 IF NOT FOUND OR (b.project_id,b.payer_id,b.source_id) IS DISTINCT FROM (located.project_id,located.payer_id,located.source_id)
 OR (i.project_id,i.inviter_id,i.invitee_email,i.role,i.token,i.expires_at,i.message)
 IS DISTINCT FROM (b.project_id,b.payer_id,b.invitee_email,b.role,b.token,b.expires_at,b.message)
 OR b.role NOT IN ('facilitator','storyteller') OR b.quantity<>1
 OR (s.payer_id,s.resource_type) IS DISTINCT FROM (b.payer_id,b.role||'_seat')
 OR s.remaining<0 OR s.remaining>s.issued
 OR NOT invitation_candidate._log_matches(b.reserve_transaction_id,b.payer_id,b.project_id,b.role||'_seat','reserve',-1) THEN
  RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate binding denied';
 END IF;
 IF $2='release' THEN
  IF p.facilitator_id IS DISTINCT FROM actor THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate access denied'; END IF;
 ELSE
  IF p.status IS DISTINCT FROM 'active' OR p.facilitator_id IS DISTINCT FROM b.payer_id
  OR (b.state<>'released' AND (NOT s.verified OR s.revoked)) THEN
   RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate access denied';
  END IF;
  IF $2='sender' THEN
   IF actor IS DISTINCT FROM b.payer_id THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate access denied'; END IF;
  ELSE
   IF u.email_confirmed_at IS NULL OR invitation_candidate._email(u.email) IS DISTINCT FROM b.invitee_email THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate access denied';
   END IF;
  END IF;
 END IF;
 IF b.state='reserved' THEN
  IF i.status IS DISTINCT FROM 'pending' OR i.accepted_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate state denied'; END IF;
 ELSIF b.state='released' THEN
  IF i.status IS DISTINCT FROM (CASE b.release_reason WHEN 'cancelled' THEN 'declined' WHEN 'expired' THEN 'expired' END)
  OR i.accepted_at IS NOT NULL
  OR NOT invitation_candidate._log_matches(b.release_transaction_id,b.payer_id,b.project_id,b.role||'_seat','release',1) THEN
   RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate state denied';
  END IF;
 ELSE
  IF i.status IS DISTINCT FROM 'accepted' OR i.accepted_at IS DISTINCT FROM b.joined_at
  OR NOT invitation_candidate._log_matches(b.activation_transaction_id,b.payer_id,b.project_id,b.role||'_seat','activate',0) THEN
   RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate state denied';
  END IF;
  SELECT * INTO m FROM public.project_roles x WHERE x.id=b.member_id FOR UPDATE;
  IF NOT FOUND OR (m.project_id,m.user_id,m.role,m.status,m.invited_by,m.joined_at)
  IS DISTINCT FROM (b.project_id,b.accepted_user_id,b.role,'active'::text,b.payer_id,b.joined_at)
  OR ($2='recipient' AND b.accepted_user_id IS DISTINCT FROM actor) THEN
   RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate member denied';
  END IF;
 END IF;
 RETURN b;
END $$;

CREATE OR REPLACE FUNCTION invitation_candidate.send(p_project_id uuid,p_request_id uuid,p_invitee_email text,p_role text,p_source_id uuid,p_message text DEFAULT NULL)
RETURNS TABLE(invitation_id uuid,project_id uuid,token text,role text,status text,expires_at timestamptz,outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE
 actor uuid:=auth.uid(); mail text; msg text:=NULLIF($6,''); p public.projects;
 r invitation_candidate.requests; b invitation_candidate.bindings;
 s invitation_candidate.trusted_seat_sources; w public.user_resource_wallets;
 iid uuid; tok text; deadline timestamptz; logid uuid; existing uuid;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate access denied'; END IF;
 IF $1 IS NULL OR $2 IS NULL OR $5 IS NULL OR $4 IS NULL OR $4 NOT IN ('facilitator','storyteller') OR pg_catalog.length(msg)>2000 THEN
  RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='invalid candidate payload';
 END IF;
 mail:=invitation_candidate._email($3);
 SELECT * INTO p FROM public.projects x WHERE x.id=$1 FOR UPDATE;
 IF NOT FOUND OR p.status IS DISTINCT FROM 'active' OR p.facilitator_id IS DISTINCT FROM actor THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate access denied'; END IF;
 PERFORM 1 FROM auth.users x WHERE x.id=actor FOR NO KEY UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate access denied'; END IF;
 SELECT * INTO r FROM invitation_candidate.requests x WHERE x.actor_id=actor AND x.request_id=$2;
 IF FOUND THEN
  IF (r.project_id,r.invitee_email,r.role,r.source_id,r.message) IS DISTINCT FROM ($1,mail,$4,$5,msg) THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='request payload conflict'; END IF;
  b:=invitation_candidate._load(r.invitation_id,'sender');
  IF (r.project_id,r.invitee_email,r.role,r.source_id,r.message) IS DISTINCT FROM (b.project_id,b.invitee_email,b.role,b.source_id,b.message) THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='request binding denied'; END IF;
  IF b.state='reserved' AND b.expires_at<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='expired reservation requires release'; END IF;
  RETURN QUERY SELECT b.invitation_id,b.project_id,b.token,b.role,CASE b.state WHEN 'reserved' THEN 'pending' WHEN 'consumed' THEN 'accepted' ELSE CASE b.release_reason WHEN 'cancelled' THEN 'declined' ELSE 'expired' END END,b.expires_at,'reused'::text;
  RETURN;
 END IF;
 SELECT x.invitation_id INTO existing FROM invitation_candidate.bindings x WHERE x.project_id=$1 AND x.invitee_email=mail AND x.role=$4 AND x.state='reserved';
 IF FOUND THEN
  b:=invitation_candidate._load(existing,'sender');
  IF (b.source_id,b.message) IS DISTINCT FROM ($5,msg) THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='pending target payload conflict'; END IF;
  IF b.expires_at<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='expired reservation requires release'; END IF;
  INSERT INTO invitation_candidate.requests VALUES(actor,$2,b.invitation_id,$1,mail,$4,$5,msg);
  RETURN QUERY SELECT b.invitation_id,b.project_id,b.token,b.role,'pending'::text,b.expires_at,'reused'::text;
  RETURN;
 END IF;
 SELECT * INTO w FROM public.user_resource_wallets x WHERE x.user_id=actor FOR UPDATE;
 IF NOT FOUND OR (CASE $4 WHEN 'facilitator' THEN w.facilitator_seats ELSE w.storyteller_seats END) IS NULL
 OR (CASE $4 WHEN 'facilitator' THEN w.facilitator_seats ELSE w.storyteller_seats END)<1 THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate resource denied'; END IF;
 SELECT * INTO s FROM invitation_candidate.trusted_seat_sources x WHERE x.id=$5 FOR UPDATE;
 IF NOT FOUND OR s.payer_id IS DISTINCT FROM actor OR s.resource_type IS DISTINCT FROM $4||'_seat' OR NOT s.verified OR s.revoked OR s.remaining<1 THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate source denied'; END IF;
 IF $4='storyteller' AND (EXISTS(SELECT 1 FROM public.project_roles x WHERE x.project_id=$1 AND x.role='storyteller' AND x.status IN ('active','pending'))
 OR EXISTS(SELECT 1 FROM invitation_candidate.bindings x WHERE x.project_id=$1 AND x.role='storyteller' AND x.state='reserved')) THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='storyteller reservation conflict'; END IF;
 deadline:=pg_catalog.clock_timestamp()+interval '7 days';
 tok:='v1_'||pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-','');
 INSERT INTO public.invitations AS x(project_id,inviter_id,invitee_email,role,token,expires_at,message)
 VALUES($1,actor,mail,$4,tok,deadline,msg) RETURNING x.id INTO iid;
 UPDATE public.user_resource_wallets x SET facilitator_seats=x.facilitator_seats-CASE WHEN $4='facilitator' THEN 1 ELSE 0 END,storyteller_seats=x.storyteller_seats-CASE WHEN $4='storyteller' THEN 1 ELSE 0 END WHERE x.user_id=actor;
 UPDATE invitation_candidate.trusted_seat_sources x SET remaining=x.remaining-1 WHERE x.id=$5;
 INSERT INTO public.seat_transactions AS x(user_id,transaction_type,resource_type,amount,project_id) VALUES(actor,'reserve',$4||'_seat',-1,$1) RETURNING x.id INTO logid;
 INSERT INTO invitation_candidate.bindings(invitation_id,project_id,payer_id,invitee_email,role,token,expires_at,message,source_id,state,reserve_transaction_id)
 VALUES(iid,$1,actor,mail,$4,tok,deadline,msg,$5,'reserved',logid);
 INSERT INTO invitation_candidate.requests VALUES(actor,$2,iid,$1,mail,$4,$5,msg);
 RETURN QUERY SELECT iid,$1,tok,$4,'pending'::text,deadline,'created'::text;
END $$;

CREATE OR REPLACE FUNCTION invitation_candidate.accept(token text)
RETURNS TABLE(invitation_id uuid,project_id uuid,user_id uuid,member_id uuid,role text,status text,joined_at timestamptz,outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE iid uuid; b invitation_candidate.bindings; mid uuid; stamp timestamptz; logid uuid;
BEGIN
 PERFORM invitation_candidate._token($1);
 SELECT x.invitation_id INTO iid FROM invitation_candidate.bindings x WHERE x.token=$1;
 b:=invitation_candidate._load(iid,'recipient');
 IF b.token IS DISTINCT FROM $1 OR b.state='released' THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate acceptance denied'; END IF;
 IF b.state='consumed' THEN
  RETURN QUERY SELECT b.invitation_id,b.project_id,b.accepted_user_id,b.member_id,b.role,'accepted'::text,b.joined_at,'already_accepted'::text;
  RETURN;
 END IF;
 -- Member locks are last; inspect any existing membership without adopting it.
 PERFORM 1 FROM public.project_roles x WHERE x.project_id=b.project_id AND (x.user_id=auth.uid() OR (b.role='storyteller' AND x.role='storyteller' AND x.status IN ('active','pending'))) FOR UPDATE;
 IF FOUND THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate member conflict'; END IF;
 stamp:=pg_catalog.clock_timestamp();
 IF b.expires_at<=stamp THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate invitation expired'; END IF;
 INSERT INTO public.project_roles AS x(user_id,project_id,role,status,invited_by,joined_at) VALUES(auth.uid(),b.project_id,b.role,'active',b.payer_id,stamp) RETURNING x.id INTO mid;
 UPDATE public.invitations x SET status='accepted',accepted_at=stamp WHERE x.id=b.invitation_id;
 INSERT INTO public.seat_transactions AS x(user_id,transaction_type,resource_type,amount,project_id) VALUES(b.payer_id,'activate',b.role||'_seat',0,b.project_id) RETURNING x.id INTO logid;
 UPDATE invitation_candidate.bindings x SET state='consumed',member_id=mid,accepted_user_id=auth.uid(),joined_at=stamp,activation_transaction_id=logid WHERE x.invitation_id=b.invitation_id;
 RETURN QUERY SELECT b.invitation_id,b.project_id,auth.uid(),mid,b.role,'accepted'::text,stamp,'accepted'::text;
END $$;

CREATE OR REPLACE FUNCTION invitation_candidate.release(p_invitation_id uuid,p_reason text)
RETURNS TABLE(invitation_id uuid,project_id uuid,status text,outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE b invitation_candidate.bindings; terminal text; logid uuid;
BEGIN
 IF $2 IS NULL OR $2 NOT IN ('cancelled','expired') THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='invalid release reason'; END IF;
 b:=invitation_candidate._load($1,'release');
 terminal:=CASE $2 WHEN 'cancelled' THEN 'declined' ELSE 'expired' END;
 IF b.state='released' AND b.release_reason=$2 THEN
  RETURN QUERY SELECT b.invitation_id,b.project_id,terminal,'already_released'::text;RETURN;
 END IF;
 IF b.state<>'reserved' OR ($2='expired' AND b.expires_at>pg_catalog.clock_timestamp()) THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate release denied'; END IF;
 UPDATE public.invitations x SET status=terminal WHERE x.id=b.invitation_id;
 UPDATE public.user_resource_wallets x SET facilitator_seats=x.facilitator_seats+CASE WHEN b.role='facilitator' THEN 1 ELSE 0 END,storyteller_seats=x.storyteller_seats+CASE WHEN b.role='storyteller' THEN 1 ELSE 0 END WHERE x.user_id=b.payer_id;
 -- A NULL balance is corruption, not a reason to silently lose the refund.
 IF EXISTS(SELECT 1 FROM public.user_resource_wallets x WHERE x.user_id=b.payer_id AND CASE b.role WHEN 'facilitator' THEN x.facilitator_seats ELSE x.storyteller_seats END IS NULL) THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate refund denied'; END IF;
 UPDATE invitation_candidate.trusted_seat_sources x SET remaining=x.remaining+1 WHERE x.id=b.source_id;
 INSERT INTO public.seat_transactions AS x(user_id,transaction_type,resource_type,amount,project_id) VALUES(b.payer_id,'release',b.role||'_seat',1,b.project_id) RETURNING x.id INTO logid;
 UPDATE invitation_candidate.bindings x SET state='released',release_reason=$2,release_transaction_id=logid WHERE x.invitation_id=b.invitation_id;
 RETURN QUERY SELECT b.invitation_id,b.project_id,terminal,'released'::text;
END $$;

CREATE OR REPLACE FUNCTION invitation_candidate.status(p_token text)
RETURNS TABLE(invitation_id uuid,project_id uuid,token text,role text,status text,expires_at timestamptz,is_expired boolean,user_id uuid,member_id uuid,joined_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE iid uuid; b invitation_candidate.bindings;
BEGIN
 PERFORM invitation_candidate._token($1);
 SELECT x.invitation_id INTO iid FROM invitation_candidate.bindings x WHERE x.token=$1;
 b:=invitation_candidate._load(iid,'recipient');
 IF b.token IS DISTINCT FROM $1 THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate query denied'; END IF;
 RETURN QUERY SELECT b.invitation_id,b.project_id,b.token,b.role,CASE b.state WHEN 'reserved' THEN 'pending' WHEN 'consumed' THEN 'accepted' ELSE CASE b.release_reason WHEN 'cancelled' THEN 'declined' ELSE 'expired' END END,b.expires_at,b.expires_at<=pg_catalog.clock_timestamp(),b.accepted_user_id,b.member_id,b.joined_at;
END $$;
CREATE OR REPLACE FUNCTION invitation_candidate.lookup(request_id uuid)
RETURNS TABLE(invitation_id uuid,project_id uuid,token text,role text,status text,expires_at timestamptz,is_expired boolean,user_id uuid,member_id uuid,joined_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE r invitation_candidate.requests; b invitation_candidate.bindings;
BEGIN
 SELECT * INTO r FROM invitation_candidate.requests x WHERE x.actor_id=auth.uid() AND x.request_id=$1;
 b:=invitation_candidate._load(r.invitation_id,'sender');
 IF (r.actor_id,r.project_id,r.invitee_email,r.role,r.source_id,r.message) IS DISTINCT FROM (b.payer_id,b.project_id,b.invitee_email,b.role,b.source_id,b.message) THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='request binding denied'; END IF;
 RETURN QUERY SELECT b.invitation_id,b.project_id,b.token,b.role,CASE b.state WHEN 'reserved' THEN 'pending' WHEN 'consumed' THEN 'accepted' ELSE CASE b.release_reason WHEN 'cancelled' THEN 'declined' ELSE 'expired' END END,b.expires_at,b.expires_at<=pg_catalog.clock_timestamp(),b.accepted_user_id,b.member_id,b.joined_at;
END $$;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA invitation_candidate FROM PUBLIC,anon,authenticated,metadata_reader,service_role;
GRANT EXECUTE ON FUNCTION invitation_candidate.send(uuid,uuid,text,text,uuid,text),invitation_candidate.accept(text),invitation_candidate.release(uuid,text),invitation_candidate.status(text),invitation_candidate.lookup(uuid) TO authenticated;
RESET ROLE;
COMMIT;

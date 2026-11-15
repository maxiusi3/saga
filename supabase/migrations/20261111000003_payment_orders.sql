-- T11: verified Stripe test-mode orders and trusted invitation fulfillment.
-- Promoted dependency definitions from experiments/pg17-invitation-transactions/candidate.sql,
-- experiments/pg17-entitlement-events/candidate.sql and experiments/pg17-invitation-management/candidate.sql.
-- No fixture data, legacy wallet adoption, new LOGIN roles, or live payment enablement.
BEGIN;
-- New accounts start without synthetic legacy welcome credits. Existing balances
-- remain historical and cannot be spent through trusted invitation sources.
ALTER TABLE public.user_resource_wallets ALTER COLUMN project_vouchers SET DEFAULT 0,
 ALTER COLUMN facilitator_seats SET DEFAULT 0, ALTER COLUMN storyteller_seats SET DEFAULT 0;
-- The complete bootstrap used invitee_role; the reviewed remote invitation
-- contract used role/message. Keep both shapes without adopting legacy rows.
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS role text,
 ADD COLUMN IF NOT EXISTS invitee_role text, ADD COLUMN IF NOT EXISTS message text;
CREATE SCHEMA IF NOT EXISTS invitation_candidate;
REVOKE ALL ON SCHEMA invitation_candidate FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA invitation_candidate TO authenticated;

CREATE TABLE IF NOT EXISTS invitation_candidate.trusted_seat_sources (
 id uuid PRIMARY KEY,
 payer_id uuid NOT NULL REFERENCES auth.users(id),
 resource_type text NOT NULL CHECK(resource_type IN ('facilitator_seat','storyteller_seat')),
 issued integer NOT NULL CHECK(issued>=0),
 remaining integer NOT NULL CHECK(remaining>=0 AND remaining<=issued),
 verified boolean NOT NULL,
 revoked boolean NOT NULL
);
COMMENT ON TABLE invitation_candidate.trusted_seat_sources IS 'Trusted source ledger. New sources are issued only by verified payment fulfillment; no legacy balances are adopted.';
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
REVOKE ALL ON ALL TABLES IN SCHEMA invitation_candidate FROM PUBLIC,anon,authenticated,service_role;

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
 OR NOT invitation_candidate._payment_project_matches(s.id,b.project_id) OR NOT invitation_candidate._management_source_valid(s.id) OR s.remaining<0 OR s.remaining>s.issued
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
 IF NOT FOUND OR s.payer_id IS DISTINCT FROM actor OR s.resource_type IS DISTINCT FROM $4||'_seat' OR NOT invitation_candidate._payment_project_matches(s.id,$1) OR NOT invitation_candidate._management_source_valid(s.id) OR NOT s.verified OR s.revoked OR s.remaining<1 THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate source denied'; END IF;
 IF $4='storyteller' AND (EXISTS(SELECT 1 FROM public.project_roles x WHERE x.project_id=$1 AND x.role='storyteller' AND x.status IN ('active','pending'))
 OR EXISTS(SELECT 1 FROM invitation_candidate.bindings x WHERE x.project_id=$1 AND x.role='storyteller' AND x.state='reserved')) THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='storyteller reservation conflict'; END IF;
 deadline:=pg_catalog.clock_timestamp()+interval '7 days';
 tok:='v1_'||pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-','');
 INSERT INTO public.invitations AS x(project_id,inviter_id,invitee_email,role,invitee_role,token,expires_at,message)
 VALUES($1,actor,mail,$4,$4,tok,deadline,msg) RETURNING x.id INTO iid;
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
 IF NOT (SELECT s.revoked FROM invitation_candidate.trusted_seat_sources s WHERE s.id=b.source_id) THEN
 UPDATE public.user_resource_wallets x SET facilitator_seats=x.facilitator_seats+CASE WHEN b.role='facilitator' THEN 1 ELSE 0 END,storyteller_seats=x.storyteller_seats+CASE WHEN b.role='storyteller' THEN 1 ELSE 0 END WHERE x.user_id=b.payer_id;
 -- A NULL balance is corruption, not a reason to silently lose the refund.
 IF EXISTS(SELECT 1 FROM public.user_resource_wallets x WHERE x.user_id=b.payer_id AND CASE b.role WHEN 'facilitator' THEN x.facilitator_seats ELSE x.storyteller_seats END IS NULL) THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='candidate refund denied'; END IF;
 UPDATE invitation_candidate.trusted_seat_sources x SET remaining=x.remaining+1 WHERE x.id=b.source_id;
 END IF;
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
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA invitation_candidate FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION invitation_candidate.send(uuid,uuid,text,text,uuid,text),invitation_candidate.accept(text),invitation_candidate.release(uuid,text),invitation_candidate.status(text),invitation_candidate.lookup(uuid) TO authenticated;

CREATE SCHEMA IF NOT EXISTS entitlement_candidate;
REVOKE ALL ON SCHEMA entitlement_candidate FROM PUBLIC,anon,authenticated,service_role;



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
REVOKE ALL ON ALL TABLES IN SCHEMA entitlement_candidate FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA invitation_candidate FROM PUBLIC,anon,authenticated,service_role;


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
     IF m.status='active' THEN UPDATE public.project_roles x SET status='removed' WHERE x.id=m.id; END IF;
    END IF;
   END IF;
  END LOOP;
  IF NOT s.revoked THEN
   IF s.remaining>0 THEN
    IF w.user_id IS NULL OR (CASE $6 WHEN 'facilitator_seat' THEN w.facilitator_seats ELSE w.storyteller_seats END)<s.remaining THEN
     RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='source wallet mismatch'; END IF;
    UPDATE public.user_resource_wallets x SET facilitator_seats=x.facilitator_seats-CASE $6 WHEN 'facilitator_seat' THEN s.remaining ELSE 0 END,storyteller_seats=x.storyteller_seats-CASE $6 WHEN 'storyteller_seat' THEN s.remaining ELSE 0 END WHERE x.user_id=$5;
   END IF;
   UPDATE invitation_candidate.trusted_seat_sources x SET revoked=true,remaining=0 WHERE x.id=sid;
  END IF;
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
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA entitlement_candidate FROM PUBLIC,anon,authenticated,service_role;

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
 AND invitation_candidate._management_source_valid(s.id) AND invitation_candidate._payment_project_matches(s.id,$1)
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
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION invitation_candidate.available_sources(uuid,text),invitation_candidate.management_list(uuid,uuid) TO authenticated;

CREATE TABLE public.payment_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payer_id uuid NOT NULL REFERENCES auth.users(id),
 package_id text NOT NULL CHECK(package_id='digital_project_59'), amount_cents integer NOT NULL CHECK(amount_cents=5900),
 currency text NOT NULL CHECK(currency='usd'), mode text NOT NULL CHECK(mode='test'),
 status text NOT NULL DEFAULT 'created' CHECK(status IN ('created','awaiting_payment','paid','refunded','refund_review','failed','canceled')),
 intent_id text UNIQUE CHECK(intent_id ~ '^pi_[A-Za-z0-9]+$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), paid_at timestamptz, refunded_at timestamptz,
 refunded_cents integer NOT NULL DEFAULT 0 CHECK(refunded_cents BETWEEN 0 AND 5900)
);
CREATE TABLE public.payment_order_requests (
 payer_id uuid NOT NULL REFERENCES auth.users(id),request_id uuid NOT NULL,order_id uuid NOT NULL REFERENCES public.payment_orders(id),
 PRIMARY KEY(payer_id,request_id)
);
CREATE TABLE public.payment_order_events (
 event_id text COLLATE "C" PRIMARY KEY CHECK(event_id ~ '^evt_[A-Za-z0-9_]+$'),
 order_id uuid NOT NULL REFERENCES public.payment_orders(id), event_type text NOT NULL,
 payload_sha256 text NOT NULL CHECK(length(payload_sha256)=64), created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- A voucher is owned by this order. No unbacked legacy project wallet credits.
-- Allocation/hosting starts need an explicit project/publication operation; downloads never set these dates.
CREATE TABLE public.payment_project_rights (
 order_id uuid PRIMARY KEY REFERENCES public.payment_orders(id),payer_id uuid NOT NULL REFERENCES auth.users(id),
 project_id uuid UNIQUE REFERENCES public.projects(id) ON DELETE SET NULL,
 status text NOT NULL CHECK(status IN ('active','refunded')),
 hosting_started_at timestamptz,hosting_expires_at timestamptz,allocation_request jsonb,
 CHECK((hosting_started_at IS NULL)=(hosting_expires_at IS NULL))
);
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_order_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_project_rights ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_orders,public.payment_order_requests,public.payment_order_events,public.payment_project_rights FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.reserve_payment_order(p_actor uuid,p_request uuid,p_package text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.payment_orders;
BEGIN
 IF p_actor IS NULL OR p_request IS NULL OR p_package IS DISTINCT FROM 'digital_project_59' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid order'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('payment_payer:'||p_actor::text,0));
 SELECT x.* INTO o FROM public.payment_orders x JOIN public.payment_order_requests r ON r.order_id=x.id WHERE r.payer_id=p_actor AND r.request_id=p_request;
 IF NOT FOUND THEN
  SELECT * INTO o FROM public.payment_orders x WHERE x.payer_id=p_actor AND x.status IN ('created','awaiting_payment','failed','refund_review') ORDER BY x.created_at LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
   INSERT INTO public.payment_orders(payer_id,package_id,amount_cents,currency,mode) VALUES(p_actor,p_package,5900,'usd','test') RETURNING * INTO o;
  END IF;
  INSERT INTO public.payment_order_requests VALUES(p_actor,p_request,o.id);
 END IF;
 RETURN to_jsonb(o);
END $$;
CREATE FUNCTION public.read_payment_order(p_actor uuid,p_order uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.payment_orders;
BEGIN
 SELECT * INTO o FROM public.payment_orders x WHERE x.id=p_order AND x.payer_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='order unavailable'; END IF;
 RETURN to_jsonb(o)||jsonb_build_object('rights',(SELECT to_jsonb(r) FROM public.payment_project_rights r WHERE r.order_id=o.id),
  'available_projects',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM (SELECT id,name FROM public.projects x WHERE x.facilitator_id=p_actor AND x.status='active'
   AND NOT EXISTS(SELECT 1 FROM public.payment_project_rights r WHERE r.project_id=x.id) ORDER BY x.created_at DESC LIMIT 100) p),'[]'::jsonb));
END $$;
CREATE FUNCTION public.bind_payment_intent(p_order uuid,p_actor uuid,p_intent text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.payment_orders;
BEGIN
 SELECT * INTO o FROM public.payment_orders x WHERE x.id=p_order AND x.payer_id=p_actor FOR UPDATE;
 IF NOT FOUND OR p_intent IS NULL OR p_intent !~ '^pi_[A-Za-z0-9]+$' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid intent binding'; END IF;
 IF o.intent_id IS NOT NULL AND o.intent_id<>p_intent THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='intent conflict'; END IF;
 UPDATE public.payment_orders SET intent_id=p_intent,status=CASE WHEN status='created' THEN 'awaiting_payment' ELSE status END WHERE id=p_order RETURNING * INTO o;
 RETURN to_jsonb(o);
END $$;
CREATE FUNCTION public.apply_verified_payment_event(p_order uuid,p_event text,p_type text,p_intent text,p_payer uuid,p_amount integer,p_currency text,p_live boolean,p_hash text,p_refunded integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.payment_orders; e public.payment_order_events; kind text; resource text; project uuid;
BEGIN
 IF p_event IS NULL OR p_hash IS NULL OR length(p_hash)<>64 OR p_refunded IS NULL OR p_refunded<0 OR p_refunded>5900 OR p_type IS NULL OR p_type NOT IN ('payment_intent.succeeded','payment_intent.payment_failed','payment_intent.canceled','charge.refunded') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid payment event'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('payment_event:'||p_event,0));
 SELECT * INTO o FROM public.payment_orders x WHERE x.id=p_order FOR UPDATE;
 IF NOT FOUND OR (o.payer_id,o.amount_cents,o.currency,o.mode,o.intent_id) IS DISTINCT FROM (p_payer,p_amount,p_currency,'test'::text,p_intent) OR p_live IS DISTINCT FROM false THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='payment identity mismatch'; END IF;
 SELECT * INTO e FROM public.payment_order_events x WHERE x.event_id=p_event;
 IF FOUND THEN
  IF (e.order_id,e.event_type,e.payload_sha256) IS DISTINCT FROM (p_order,p_type,p_hash) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='payment event conflict'; END IF;
  RETURN to_jsonb(o);
 END IF;
 -- All project locks precede wallet/source/member locks across both seat types.
 FOR project IN SELECT q.project_id FROM (SELECT b.project_id FROM invitation_candidate.bindings b JOIN entitlement_candidate.sources s ON s.source_id=b.source_id WHERE s.provider='stripe_test' AND s.source_key IN (p_intent||':facilitator_seat',p_intent||':storyteller_seat') UNION SELECT r.project_id FROM public.payment_project_rights r WHERE r.order_id=p_order AND r.project_id IS NOT NULL) q ORDER BY q.project_id LOOP
  PERFORM 1 FROM public.projects p WHERE p.id=project FOR UPDATE;
 END LOOP;
 IF p_type='charge.refunded' AND p_refunded=5900 THEN
  kind:='revoke';
  UPDATE public.payment_orders SET status='refunded',refunded_at=coalesce(refunded_at,clock_timestamp()),refunded_cents=5900 WHERE id=p_order;
  INSERT INTO public.payment_project_rights(order_id,payer_id,status) VALUES(p_order,p_payer,'refunded') ON CONFLICT(order_id) DO UPDATE SET status='refunded';
 ELSIF p_type='payment_intent.succeeded' AND o.refunded_cents=0 AND o.status NOT IN ('refunded','refund_review','canceled') THEN
  kind:='grant';
  UPDATE public.payment_orders SET status='paid',paid_at=coalesce(paid_at,clock_timestamp()) WHERE id=p_order;
  INSERT INTO public.payment_project_rights(order_id,payer_id,status) VALUES(p_order,p_payer,'active') ON CONFLICT(order_id) DO NOTHING;
 ELSIF p_type='payment_intent.canceled' AND o.status NOT IN ('paid','refunded') THEN
  UPDATE public.payment_orders SET status='canceled' WHERE id=p_order;
 ELSIF p_type='payment_intent.payment_failed' AND o.status IN ('created','awaiting_payment','failed') THEN
  UPDATE public.payment_orders SET status='failed' WHERE id=p_order;
 END IF;
 IF p_type='charge.refunded' THEN
  UPDATE public.payment_orders SET refunded_cents=greatest(refunded_cents,p_refunded),
   status=CASE WHEN p_refunded>0 AND p_refunded<5900 AND paid_at IS NULL AND status<>'refunded' THEN 'refund_review' ELSE status END WHERE id=p_order;
 END IF;
 IF kind IS NOT NULL THEN
  FOREACH resource IN ARRAY ARRAY['facilitator_seat','storyteller_seat'] LOOP
   PERFORM entitlement_candidate.apply_event('stripe_test',p_event||':'||resource,p_intent||':'||resource,kind,p_payer,resource,1);
  END LOOP;
 END IF;
 INSERT INTO public.payment_order_events VALUES(p_event,p_order,p_type,p_hash,clock_timestamp());
 SELECT * INTO o FROM public.payment_orders x WHERE x.id=p_order;
 RETURN to_jsonb(o);
END $$;
CREATE FUNCTION public.allocate_payment_project(p_actor uuid,p_order uuid,p_project uuid,p_name text,p_description text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.payment_orders; r public.payment_project_rights; project uuid:=p_project; payload jsonb; stamp timestamptz:=clock_timestamp();
BEGIN
 LOCK TABLE public.deletion_requests IN SHARE MODE;
 SELECT * INTO o FROM public.payment_orders x WHERE x.id=p_order AND x.payer_id=p_actor FOR UPDATE;
 IF NOT FOUND OR o.status<>'paid' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='paid order required'; END IF;
 SELECT * INTO r FROM public.payment_project_rights x WHERE x.order_id=p_order;
 IF NOT FOUND OR r.status<>'active' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='active order right required'; END IF;
 IF p_project IS NULL AND (p_name IS NULL OR length(btrim(p_name))<1 OR length(p_name)>200 OR length(coalesce(p_description,''))>2000) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid project name'; END IF;
 IF p_project IS NOT NULL AND (p_name IS NOT NULL OR p_description IS NOT NULL) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ambiguous allocation'; END IF;
 payload:=jsonb_build_object('project',p_project,'name',p_name,'description',p_description);
 IF r.allocation_request IS NOT NULL THEN
  IF r.allocation_request IS DISTINCT FROM payload OR r.project_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='allocation conflict'; END IF;
  project:=r.project_id;
 ELSE
  IF project IS NULL THEN
   INSERT INTO public.projects(name,title,description,facilitator_id,owner_id,status,payment_status) VALUES(btrim(p_name),btrim(p_name),p_description,p_actor,p_actor,'active','paid') RETURNING id INTO project;
   INSERT INTO public.project_roles(project_id,user_id,role,status,joined_at) VALUES(project,p_actor,'facilitator','active',clock_timestamp());
  END IF;
 END IF;
 PERFORM 1 FROM public.projects p WHERE p.id=project AND p.facilitator_id=p_actor AND p.status='active' FOR UPDATE;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM public.deletion_requests d WHERE d.project_id=project AND d.subject_id=project::text AND d.tombstone_at IS NOT NULL) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='project allocation denied'; END IF;
 IF EXISTS(SELECT 1 FROM public.payment_project_rights x WHERE x.project_id=project AND x.order_id<>p_order) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='project already allocated'; END IF;
 UPDATE public.payment_project_rights SET project_id=project,allocation_request=payload,
  hosting_started_at=coalesce(hosting_started_at,stamp),
  hosting_expires_at=coalesce(hosting_expires_at,stamp+interval '12 months') WHERE order_id=p_order;
 RETURN public.read_payment_order(p_actor,p_order);
END $$;
REVOKE ALL ON FUNCTION public.allocate_payment_project(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_payment_project(uuid,uuid,uuid,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.reserve_payment_order(uuid,uuid,text),public.read_payment_order(uuid,uuid),public.bind_payment_intent(uuid,uuid,text),public.apply_verified_payment_event(uuid,text,text,text,uuid,integer,text,boolean,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_payment_order(uuid,uuid,text),public.read_payment_order(uuid,uuid),public.bind_payment_intent(uuid,uuid,text),public.apply_verified_payment_event(uuid,text,text,text,uuid,integer,text,boolean,text,integer) TO service_role;
-- Compatibility entry now consumes an explicitly paid source, never a legacy
-- wallet number. New UI uses order allocation directly for visible identity.
CREATE OR REPLACE FUNCTION public.create_project_with_role(project_name text,project_description text,facilitator_id uuid,creator_role text DEFAULT 'facilitator')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE oid uuid; value jsonb;
BEGIN
 IF auth.uid() IS NULL OR facilitator_id IS DISTINCT FROM auth.uid() OR creator_role IS DISTINCT FROM 'facilitator' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Use the purchased project allocation page'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('payment_payer:'||facilitator_id::text,0));
 SELECT r.order_id INTO oid FROM public.payment_project_rights r JOIN public.payment_orders o ON o.id=r.order_id
 WHERE r.payer_id=facilitator_id AND r.status='active' AND o.status='paid'
 AND r.allocation_request=jsonb_build_object('project',NULL::uuid,'name',project_name,'description',project_description)
 ORDER BY o.created_at DESC LIMIT 1;
 IF oid IS NULL THEN
  SELECT r.order_id INTO oid FROM public.payment_project_rights r JOIN public.payment_orders o ON o.id=r.order_id
  WHERE r.payer_id=facilitator_id AND r.status='active' AND o.status='paid' AND r.allocation_request IS NULL ORDER BY o.created_at LIMIT 1;
 END IF;
 IF oid IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Purchase a project first; historical wallet credits do not verify payment'; END IF;
 value:=public.allocate_payment_project(facilitator_id,oid,NULL,project_name,project_description);
 RETURN (value->'rights'->>'project_id')::uuid;
END $$;
REVOKE ALL ON FUNCTION public.create_project_with_role(text,text,uuid,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.create_project_with_role(text,text,uuid,text) TO authenticated;
-- Client table insertion bypassed the paid-source compatibility RPC. Only the
-- service/definer allocation path may create projects; remove column grants too.
REVOKE INSERT ON public.projects FROM PUBLIC,anon,authenticated;
DO $$
DECLARE columns text;
BEGIN
 SELECT string_agg(quote_ident(attname),',') INTO columns FROM pg_catalog.pg_attribute
 WHERE attrelid='public.projects'::regclass AND attnum>0 AND NOT attisdropped;
 EXECUTE format('REVOKE INSERT (%s) ON public.projects FROM PUBLIC,anon,authenticated',columns);
END $$;
DROP POLICY IF EXISTS projects_insert_authenticated ON public.projects;
CREATE FUNCTION invitation_candidate._payment_project_matches(p_source uuid,p_project uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM entitlement_candidate.sources s JOIN public.payment_orders o ON s.provider='stripe_test' AND s.source_key=o.intent_id||':'||s.resource_type
 JOIN public.payment_project_rights r ON r.order_id=o.id WHERE s.source_id=p_source AND r.project_id=p_project AND r.payer_id=s.payer_id)
$$;
REVOKE ALL ON FUNCTION invitation_candidate._payment_project_matches(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
-- The unbound legacy fulfillment RPC is no longer an accepted write path.
REVOKE EXECUTE ON FUNCTION public.apply_entitlement_event(text,text,text,text,text,uuid,integer,uuid) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;

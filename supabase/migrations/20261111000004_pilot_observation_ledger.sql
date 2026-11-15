-- G4: operator-verified evidence snapshots, never implicit production telemetry.
BEGIN;

-- Historical rows are unclassified and must not be exposed to family clients.
REVOKE ALL ON public.pilot_households FROM anon, authenticated;

CREATE TABLE public.pilot_cohort_batches (
  cohort_key text NOT NULL CHECK (cohort_key ~ '^[a-zA-Z0-9_.:-]{1,100}$'),
  observation_kind text NOT NULL CHECK (observation_kind IN ('observed','synthetic')),
  closed_at timestamptz,
  closed_by text,
  close_reason text,
  erased_households integer NOT NULL DEFAULT 0 CHECK (erased_households >= 0),
  PRIMARY KEY (cohort_key, observation_kind)
);
CREATE TABLE public.pilot_cohort_entries (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  household_key uuid NOT NULL,
  cohort_key text NOT NULL,
  observation_kind text NOT NULL,
  cohort_type text NOT NULL CHECK (cohort_type IN ('prototype_study','ai_eval_holdout','longitudinal_pilot')),
  revision integer NOT NULL CHECK (revision > 0),
  FOREIGN KEY (cohort_key, observation_kind) REFERENCES public.pilot_cohort_batches,
  UNIQUE (cohort_key, observation_kind, cohort_type, household_key),
  UNIQUE (cohort_key, observation_kind, cohort_type, project_id)
);
CREATE TABLE public.pilot_observation_revisions (
  household_id uuid NOT NULL REFERENCES public.pilot_cohort_entries(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  recorded_by text NOT NULL,
  reason text NOT NULL,
  values jsonb NOT NULL CHECK (jsonb_typeof(values)='object'),
  evidence jsonb NOT NULL CHECK (jsonb_typeof(evidence)='object'),
  PRIMARY KEY (household_id, revision)
);
CREATE TABLE public.pilot_observation_requests (
  request_id uuid PRIMARY KEY,
  household_id uuid REFERENCES public.pilot_cohort_entries(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  result jsonb NOT NULL
);

ALTER TABLE public.pilot_cohort_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_cohort_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_observation_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_observation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pilot_cohort_batches,public.pilot_cohort_entries,public.pilot_observation_revisions,public.pilot_observation_requests FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.count_erased_pilot_household() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF OLD.cohort_type='longitudinal_pilot' THEN
    UPDATE public.pilot_cohort_batches SET erased_households=erased_households+1
    WHERE cohort_key=OLD.cohort_key AND observation_kind=OLD.observation_kind;
  END IF;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.count_erased_pilot_household() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER pilot_household_erasure AFTER DELETE ON public.pilot_cohort_entries
FOR EACH ROW EXECUTE FUNCTION public.count_erased_pilot_household();

-- G1 story erasure is a soft purge, so project FK cascade alone is insufficient.
-- Conservatively erase the project's entire research record and all revisions.
CREATE FUNCTION public.erase_pilot_on_story_purge() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.status='deleted' THEN
    PERFORM 1 FROM public.projects WHERE id=NEW.project_id FOR UPDATE;
    DELETE FROM public.pilot_cohort_entries WHERE project_id=NEW.project_id;
    DELETE FROM public.pilot_households WHERE project_id=NEW.project_id;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.erase_pilot_on_story_purge() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER pilot_story_erasure AFTER UPDATE OF status ON public.stories
FOR EACH ROW EXECUTE FUNCTION public.erase_pilot_on_story_purge();

CREATE FUNCTION public.record_pilot_observation(p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE
  c jsonb:=p_command; rid uuid; hid uuid; project uuid; fingerprint text;
  previous public.pilot_observation_requests; entry public.pilot_cohort_entries;
  batch public.pilot_cohort_batches; result jsonb; rev integer;
BEGIN
  IF jsonb_typeof(c)<>'object' OR c->>'action' NOT IN ('record','close_cohort')
    OR NOT (c ?& ARRAY['requestId','cohortKey','observationKind','recordedBy','reason','action'])
    OR c->>'cohortKey' !~ '^[a-zA-Z0-9_.:-]{1,100}$'
    OR c->>'recordedBy' !~ '^[a-zA-Z0-9_.:-]{1,100}$'
    OR c->>'reason' !~ '^[a-zA-Z0-9_.:-]{1,100}$'
    OR c->>'observationKind' NOT IN ('synthetic','observed')
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid pilot command'; END IF;
  rid:=(c->>'requestId')::uuid;
  fingerprint:=encode(extensions.digest(c::text,'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(rid::text,411));
  SELECT * INTO previous FROM public.pilot_observation_requests WHERE request_id=rid;
  IF FOUND THEN
    IF previous.fingerprint<>fingerprint THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='request identity conflict'; END IF;
    RETURN previous.result;
  END IF;
  IF c->>'action'='record' THEN
    IF NOT(c ?& ARRAY['householdId','householdKey','projectId','cohortType','expectedRevision','values','evidence'])
      OR jsonb_typeof(c->'values')<>'object' OR jsonb_typeof(c->'evidence')<>'object'
      OR NOT(c->'evidence' ? 'enrollment')
      OR c->>'cohortType' NOT IN ('prototype_study','ai_eval_holdout','longitudinal_pilot')
      OR (c->>'expectedRevision')::integer<0
    THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid pilot record'; END IF;
    hid:=(c->>'householdId')::uuid; project:=(c->>'projectId')::uuid;
    PERFORM 1 FROM public.projects WHERE id=project FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='pilot project unavailable'; END IF;
    IF EXISTS(SELECT 1 FROM public.stories WHERE project_id=project AND status='deleted')
    THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='pilot source was erased'; END IF;
    -- Current G3 payments are stripe_test only: they are never observed sales.
    IF c->>'observationKind'='observed' AND EXISTS(SELECT 1 FROM public.payment_project_rights WHERE project_id=project)
    THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='test payment project cannot be observed'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_each(c->'evidence') e WHERE
      (c->>'observationKind'='synthetic' AND e.value->>'source' IS DISTINCT FROM 'synthetic_fixture') OR
      (c->>'observationKind'='observed' AND (e.value->>'source'='synthetic_fixture' OR e.value->>'reference' ~ '^(fixture|synthetic|test):')))
    THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='observation provenance mismatch'; END IF;
  END IF;
  INSERT INTO public.pilot_cohort_batches(cohort_key,observation_kind) VALUES(c->>'cohortKey',c->>'observationKind') ON CONFLICT DO NOTHING;
  SELECT * INTO batch FROM public.pilot_cohort_batches WHERE cohort_key=c->>'cohortKey' AND observation_kind=c->>'observationKind' FOR UPDATE;
  IF c->>'action'='close_cohort' THEN
    UPDATE public.pilot_cohort_batches SET closed_at=coalesce(closed_at,clock_timestamp()),closed_by=coalesce(closed_by,c->>'recordedBy'),close_reason=coalesce(close_reason,c->>'reason')
    WHERE cohort_key=batch.cohort_key AND observation_kind=batch.observation_kind;
    result:=jsonb_build_object('closed',true,'cohortKey',batch.cohort_key);
  ELSE
    SELECT * INTO entry FROM public.pilot_cohort_entries WHERE id=hid FOR UPDATE;
    IF FOUND THEN
      IF entry.project_id<>project OR entry.household_key<>(c->>'householdKey')::uuid OR entry.cohort_key<>c->>'cohortKey'
        OR entry.observation_kind<>c->>'observationKind' OR entry.cohort_type<>c->>'cohortType'
      THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='pilot identity is immutable'; END IF;
      IF entry.revision<>(c->>'expectedRevision')::integer THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='pilot revision conflict'; END IF;
      rev:=entry.revision+1;
      UPDATE public.pilot_cohort_entries SET revision=rev WHERE id=hid;
    ELSE
      IF batch.closed_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='pilot roster is closed'; END IF;
      IF (c->>'expectedRevision')::integer<>0 THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='pilot revision conflict'; END IF;
      rev:=1;
      INSERT INTO public.pilot_cohort_entries VALUES(hid,project,(c->>'householdKey')::uuid,c->>'cohortKey',c->>'observationKind',c->>'cohortType',rev);
    END IF;
    INSERT INTO public.pilot_observation_revisions(household_id,revision,recorded_by,reason,values,evidence)
    VALUES(hid,rev,c->>'recordedBy',c->>'reason',c->'values',c->'evidence');
    result:=jsonb_build_object('householdId',hid,'revision',rev);
  END IF;
  INSERT INTO public.pilot_observation_requests VALUES(rid,hid,fingerprint,result);
  RETURN result;
END $$;

CREATE FUNCTION public.read_pilot_cohort(p_cohort text,p_kind text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE batch public.pilot_cohort_batches; result jsonb;
BEGIN
  IF p_kind NOT IN ('observed','synthetic') OR p_cohort !~ '^[a-zA-Z0-9_.:-]{1,100}$'
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid pilot selector'; END IF;
  SELECT * INTO batch FROM public.pilot_cohort_batches WHERE cohort_key=p_cohort AND observation_kind=p_kind;
  IF (SELECT count(*) FROM public.pilot_cohort_entries WHERE cohort_key=p_cohort AND observation_kind=p_kind)>10000
  THEN RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='pilot report exceeds explicit limit'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'householdId',e.id,'householdKey',e.household_key,'projectId',e.project_id,'cohortKey',e.cohort_key,
    'observationKind',e.observation_kind,'cohortType',e.cohort_type,'revision',e.revision,
    'recordedAt',r.recorded_at,'recordedBy',r.recorded_by,'reason',r.reason,'values',r.values,'evidence',r.evidence
  ) ORDER BY e.id),'[]'::jsonb) INTO result
  FROM public.pilot_cohort_entries e JOIN public.pilot_observation_revisions r ON r.household_id=e.id AND r.revision=e.revision
  WHERE e.cohort_key=p_cohort AND e.observation_kind=p_kind;
  RETURN jsonb_build_object('batch',jsonb_build_object('cohortKey',p_cohort,'observationKind',p_kind,'closedAt',batch.closed_at,'erasedHouseholds',coalesce(batch.erased_households,0)),
    'entries',result,'legacyUnclassifiedCount',(SELECT count(*) FROM public.pilot_households));
END $$;

CREATE FUNCTION public.read_pilot_history(p_household uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY revision),'[]'::jsonb) FROM public.pilot_observation_revisions r WHERE household_id=p_household
$$;
REVOKE ALL ON FUNCTION public.record_pilot_observation(jsonb),public.read_pilot_cohort(text,text),public.read_pilot_history(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_pilot_observation(jsonb),public.read_pilot_cohort(text,text),public.read_pilot_history(uuid) TO service_role;
COMMIT;

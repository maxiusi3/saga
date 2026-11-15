-- Ownership only: immutable capture remains the work order, never a delete permit.
BEGIN;
CREATE TABLE public.media_deletion_jobs (
  request_id uuid PRIMARY KEY REFERENCES public.deletion_requests(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  subject_id uuid NOT NULL,
  subject_type text NOT NULL CHECK (subject_type IN ('media_asset','story')),
  capture_targets_sha256 text NOT NULL CHECK (capture_targets_sha256 ~ '^[0-9a-f]{64}$'),
  target_count integer NOT NULL CHECK (target_count > 0),
  state text NOT NULL CHECK (state IN ('leased','running','retry_wait','failed','outcome_unknown')),
  attempt_no integer NOT NULL CHECK (attempt_no BETWEEN 1 AND 3),
  worker_id text,
  lease_expires_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT media_deletion_job_shape CHECK (
    isfinite(created_at) AND isfinite(updated_at) AND updated_at >= created_at
    AND ((state IN ('leased','running') AND worker_id IS NOT NULL AND worker_id ~ '^[A-Za-z0-9_-]{1,128}$'
      AND lease_expires_at IS NOT NULL AND isfinite(lease_expires_at) AND lease_expires_at > updated_at
      AND lease_expires_at <= updated_at + interval '120 seconds')
      OR (state IN ('retry_wait','failed','outcome_unknown') AND worker_id IS NULL AND lease_expires_at IS NULL))
    AND (state <> 'retry_wait' OR attempt_no < 3) AND (state <> 'failed' OR attempt_no = 3))
);
CREATE TABLE public.media_deletion_attempts (
  request_id uuid NOT NULL REFERENCES public.media_deletion_jobs(request_id) ON DELETE RESTRICT,
  attempt_no integer NOT NULL CHECK (attempt_no BETWEEN 1 AND 3),
  worker_id text NOT NULL CHECK (worker_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  state text NOT NULL CHECK (state IN ('leased','running','expired','outcome_unknown')),
  claimed_at timestamptz NOT NULL,
  started_at timestamptz,
  heartbeat_at timestamptz,
  lease_expires_at timestamptz NOT NULL,
  finished_at timestamptz,
  PRIMARY KEY (request_id,attempt_no),
  CONSTRAINT media_deletion_attempt_shape CHECK (
    isfinite(claimed_at) AND isfinite(lease_expires_at)
    AND lease_expires_at >= coalesce(heartbeat_at,claimed_at) + interval '1 second'
    AND lease_expires_at <= coalesce(heartbeat_at,claimed_at) + interval '120 seconds'
    AND (started_at IS NULL OR (isfinite(started_at) AND started_at >= claimed_at AND started_at < lease_expires_at))
    AND (heartbeat_at IS NULL OR (started_at IS NOT NULL AND isfinite(heartbeat_at) AND heartbeat_at >= started_at))
    AND ((state IN ('leased','expired') AND started_at IS NULL AND heartbeat_at IS NULL)
      OR (state IN ('running','outcome_unknown') AND started_at IS NOT NULL))
    AND ((state IN ('leased','running') AND finished_at IS NULL)
      OR (state IN ('expired','outcome_unknown') AND finished_at IS NOT NULL AND isfinite(finished_at) AND finished_at >= lease_expires_at)))
);
ALTER TABLE public.media_deletion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_deletion_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.media_deletion_jobs,public.media_deletion_attempts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.media_deletion_jobs,public.media_deletion_attempts TO service_role;
CREATE POLICY media_deletion_jobs_service_read ON public.media_deletion_jobs FOR SELECT TO service_role USING (true);
CREATE POLICY media_deletion_attempts_service_read ON public.media_deletion_attempts FOR SELECT TO service_role USING (true);

CREATE FUNCTION public.media_deletion_job_lease(
  p_request_id uuid, p_action text, p_worker_id text, p_attempt integer, p_lease_ms integer
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
SET timezone = 'UTC'
SET lock_timeout = '3s'
AS $$
DECLARE
  v_request public.deletion_requests%ROWTYPE;
  v_job public.media_deletion_jobs%ROWTYPE;
  v_attempt public.media_deletion_attempts%ROWTYPE;
  v_prior public.media_deletion_attempts%ROWTYPE;
  v_now timestamptz;
  v_return_now timestamptz;
  v_previous_finish timestamptz;
  v_first_claim timestamptz;
  v_expected_job jsonb;
  v_expected_attempts jsonb;
  v_capture jsonb;
  v_targets jsonb;
  v_actual jsonb;
  v_target public.deletion_targets%ROWTYPE;
  v_count integer;
  v_index integer := 0;
  v_exists boolean;
  v_write boolean := false;
  v_uuid text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
BEGIN
  IF p_request_id IS NULL OR p_action IS NULL OR p_action NOT IN ('claim','start','heartbeat','check','recover')
    OR current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Invalid deletion lease arguments' USING ERRCODE = '22023';
  END IF;
  IF p_action='recover' THEN
    IF p_worker_id IS NOT NULL OR p_attempt IS NOT NULL OR p_lease_ms IS NOT NULL THEN
      RAISE EXCEPTION 'Invalid deletion recovery arguments' USING ERRCODE = '22023';
    END IF;
  ELSIF p_worker_id IS NULL OR p_worker_id !~ '^[A-Za-z0-9_-]{1,128}$'
    OR (p_action='claim' AND p_attempt IS NOT NULL)
    OR (p_action<>'claim' AND (p_attempt IS NULL OR p_attempt NOT BETWEEN 1 AND 3))
    OR (p_action IN ('claim','heartbeat') AND (p_lease_ms IS NULL OR p_lease_ms NOT BETWEEN 1000 AND 120000))
    OR (p_action IN ('start','check') AND p_lease_ms IS NOT NULL) THEN
    RAISE EXCEPTION 'Invalid deletion ownership arguments' USING ERRCODE = '22023';
  END IF;

  -- Same first fence as capture/publication; do not read capture before waiting.
  LOCK TABLE public.deletion_requests IN SHARE MODE;
  LOCK TABLE public.deletion_targets IN SHARE MODE;
  PERFORM pg_advisory_xact_lock(hashtextextended('media-deletion-lease:'||p_request_id::text,0));
  SELECT j.* INTO v_job FROM public.media_deletion_jobs j WHERE j.request_id=p_request_id FOR UPDATE;
  v_exists := FOUND;
  PERFORM 1 FROM public.media_deletion_attempts a WHERE a.request_id=p_request_id ORDER BY a.attempt_no FOR UPDATE;
  v_now := clock_timestamp();
  SELECT r.* INTO v_request FROM public.deletion_requests r WHERE r.id=p_request_id;
  IF NOT FOUND OR v_request.capture_version IS DISTINCT FROM 1
    OR v_request.subject_id !~ v_uuid OR v_request.subject_type IS NULL OR v_request.subject_type NOT IN ('media_asset','story')
    OR v_request.state IS DISTINCT FROM 'requested' OR v_request.attempt IS DISTINCT FROM 0
    OR v_request.tombstone_at IS NULL OR NOT isfinite(v_request.tombstone_at) OR v_request.tombstone_at > v_now
    OR v_request.requested_at IS DISTINCT FROM v_request.tombstone_at
    OR v_request.processing_at IS NOT NULL OR v_request.completed_at IS NOT NULL OR v_request.error_code IS NOT NULL
    OR v_request.capture_target_count IS NULL OR v_request.capture_target_count < 1
    OR v_request.capture_targets_sha256 IS NULL OR v_request.capture_targets_sha256 !~ '^[0-9a-f]{64}$'
    OR (SELECT count(*) FROM public.deletion_requests r WHERE r.project_id=v_request.project_id AND r.subject_id=v_request.subject_id) <> 1 THEN
    RAISE EXCEPTION 'Deletion capture unavailable' USING ERRCODE = '23505';
  END IF;
  v_capture := to_jsonb(v_request);
  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.target_id),'[]'::jsonb) INTO v_targets
    FROM public.deletion_targets t WHERE t.deletion_request_id=p_request_id;
  IF jsonb_array_length(v_targets) <> v_request.capture_target_count
    OR encode(sha256(convert_to(v_targets::text,'UTF8')),'hex') IS DISTINCT FROM v_request.capture_targets_sha256 THEN
    RAISE EXCEPTION 'Deletion capture digest conflict' USING ERRCODE = '23505';
  END IF;
  FOR v_target IN SELECT t.* FROM public.deletion_targets t WHERE t.deletion_request_id=p_request_id LOOP
    IF v_target.state IS DISTINCT FROM 'pending' OR v_target.error_code IS NOT NULL
      OR v_target.updated_at IS DISTINCT FROM v_request.tombstone_at
      OR v_target.kind NOT IN ('media_asset','story','storage_object')
      OR (v_target.kind IN ('media_asset','story') AND (v_target.bucket IS NOT NULL OR v_target.object_key IS NOT NULL
        OR split_part(v_target.target_id,':',2) !~ v_uuid
        OR v_target.target_id IS DISTINCT FROM CASE WHEN v_target.kind='story' THEN 'story:' ELSE 'asset:' END||split_part(v_target.target_id,':',2)
        OR (v_target.kind='story' AND (v_request.subject_type<>'story' OR v_target.target_id<>'story:'||v_request.subject_id))
        OR (v_target.kind='media_asset' AND v_request.subject_type='media_asset' AND v_target.target_id<>'asset:'||v_request.subject_id)))
      OR (v_target.kind='storage_object' AND (v_target.bucket IS NULL OR v_target.bucket NOT IN ('saga','audio-recordings','recording-candidates')
        OR v_target.object_key IS NULL OR length(v_target.object_key)>1024
        OR v_target.object_key !~ '^[A-Za-z0-9_-]+(/[A-Za-z0-9_.-]+)+$' OR v_target.object_key ~ '(^|/)\.{1,2}(/|$)'
        OR v_target.target_id IS DISTINCT FROM 'storage:'||v_target.bucket||':'||v_target.object_key)) THEN
      RAISE EXCEPTION 'Deletion target shape conflict' USING ERRCODE = '23505';
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM public.deletion_targets t WHERE t.deletion_request_id=p_request_id
    AND t.target_id=CASE WHEN v_request.subject_type='story' THEN 'story:' ELSE 'asset:' END||v_request.subject_id) <> 1
    OR EXISTS (SELECT 1 FROM public.deletion_targets t WHERE t.deletion_request_id=p_request_id GROUP BY t.target_id HAVING count(*)>1)
    OR EXISTS (SELECT 1 FROM public.deletion_targets t WHERE t.deletion_request_id=p_request_id AND t.kind='storage_object'
      GROUP BY t.bucket,t.object_key HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Deletion target identity conflict' USING ERRCODE = '23505';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.attempt_no),'[]'::jsonb) INTO v_expected_attempts
    FROM public.media_deletion_attempts a WHERE a.request_id=p_request_id;
  v_count := jsonb_array_length(v_expected_attempts);
  IF NOT v_exists THEN
    IF v_count<>0 OR p_action<>'claim' THEN RAISE EXCEPTION 'Deletion job unavailable' USING ERRCODE='23505'; END IF;
  ELSE
    -- Validate history before deriving any new row; no malformed old attempt may
    -- be cleaned up by claim/recover. Every prior attempt was undispatched.
    IF v_job.project_id IS DISTINCT FROM v_request.project_id OR v_job.subject_id::text IS DISTINCT FROM v_request.subject_id
      OR v_job.subject_type IS DISTINCT FROM v_request.subject_type OR v_job.capture_targets_sha256 IS DISTINCT FROM v_request.capture_targets_sha256
      OR v_job.target_count IS DISTINCT FROM v_request.capture_target_count OR v_count IS DISTINCT FROM v_job.attempt_no
      OR v_job.attempt_no NOT BETWEEN 1 AND 3 OR v_job.state NOT IN ('leased','running','retry_wait','failed','outcome_unknown')
      OR NOT isfinite(v_job.created_at) OR NOT isfinite(v_job.updated_at) OR v_job.updated_at > v_now
      OR v_job.created_at < v_request.tombstone_at OR v_job.updated_at < v_job.created_at THEN
      RAISE EXCEPTION 'Deletion job binding conflict' USING ERRCODE='23505';
    END IF;
    FOR v_prior IN SELECT a.* FROM public.media_deletion_attempts a WHERE a.request_id=p_request_id ORDER BY a.attempt_no LOOP
      v_index := v_index+1;
      IF v_index=1 THEN v_first_claim:=v_prior.claimed_at; END IF;
      IF v_prior.attempt_no<>v_index OR v_prior.worker_id IS NULL OR v_prior.worker_id !~ '^[A-Za-z0-9_-]{1,128}$'
        OR v_prior.state NOT IN ('leased','running','expired','outcome_unknown')
        OR v_prior.claimed_at IS NULL OR NOT isfinite(v_prior.claimed_at) OR v_prior.claimed_at>v_now OR v_prior.claimed_at<v_request.tombstone_at
        OR (v_previous_finish IS NOT NULL AND v_prior.claimed_at<v_previous_finish)
        OR v_prior.lease_expires_at IS NULL OR NOT isfinite(v_prior.lease_expires_at)
        OR v_prior.lease_expires_at<coalesce(v_prior.heartbeat_at,v_prior.claimed_at)+interval '1 second'
        OR v_prior.lease_expires_at>coalesce(v_prior.heartbeat_at,v_prior.claimed_at)+interval '120 seconds'
        OR (v_prior.started_at IS NOT NULL AND (NOT isfinite(v_prior.started_at) OR v_prior.started_at<v_prior.claimed_at
          OR v_prior.started_at>v_now OR v_prior.started_at>=v_prior.lease_expires_at))
        OR (v_prior.heartbeat_at IS NOT NULL AND (v_prior.started_at IS NULL OR NOT isfinite(v_prior.heartbeat_at)
          OR v_prior.heartbeat_at<v_prior.started_at OR v_prior.heartbeat_at>v_now))
        OR (v_prior.state IN ('leased','expired') AND (v_prior.started_at IS NOT NULL OR v_prior.heartbeat_at IS NOT NULL))
        OR (v_prior.state IN ('running','outcome_unknown') AND v_prior.started_at IS NULL)
        OR (v_prior.state IN ('leased','running') AND v_prior.finished_at IS NOT NULL)
        OR (v_prior.state IN ('expired','outcome_unknown') AND (v_prior.finished_at IS NULL OR NOT isfinite(v_prior.finished_at)
          OR v_prior.finished_at<v_prior.lease_expires_at OR v_prior.finished_at>v_now))
        OR (v_index<v_count AND v_prior.state<>'expired') THEN
        RAISE EXCEPTION 'Deletion attempt history conflict' USING ERRCODE='23505';
      END IF;
      v_previous_finish:=v_prior.finished_at;
      v_attempt:=v_prior;
    END LOOP;
    IF v_job.created_at IS DISTINCT FROM v_first_claim
      OR v_job.updated_at IS DISTINCT FROM coalesce(v_attempt.finished_at,v_attempt.heartbeat_at,v_attempt.started_at,v_attempt.claimed_at)
      OR (v_job.state IN ('leased','running') AND (v_attempt.state IS DISTINCT FROM v_job.state
        OR v_job.worker_id IS DISTINCT FROM v_attempt.worker_id OR v_job.lease_expires_at IS DISTINCT FROM v_attempt.lease_expires_at))
      OR (v_job.state IN ('retry_wait','failed','outcome_unknown') AND (v_job.worker_id IS NOT NULL OR v_job.lease_expires_at IS NOT NULL
        OR v_attempt.state IS DISTINCT FROM CASE WHEN v_job.state='outcome_unknown' THEN 'outcome_unknown' ELSE 'expired' END))
      OR (v_job.state='retry_wait' AND v_job.attempt_no>=3) OR (v_job.state='failed' AND v_job.attempt_no<>3) THEN
      RAISE EXCEPTION 'Deletion current attempt conflict' USING ERRCODE='23505';
    END IF;
  END IF;

  v_now := clock_timestamp();
  IF p_action='claim' THEN
    IF v_exists AND (v_job.state<>'retry_wait' OR v_job.attempt_no>=3) THEN
      RAISE EXCEPTION 'Deletion job cannot be claimed' USING ERRCODE='23505';
    END IF;
    IF NOT v_exists THEN
      v_job.request_id:=p_request_id; v_job.project_id:=v_request.project_id; v_job.subject_id:=v_request.subject_id::uuid;
      v_job.subject_type:=v_request.subject_type; v_job.capture_targets_sha256:=v_request.capture_targets_sha256;
      v_job.target_count:=v_request.capture_target_count; v_job.attempt_no:=0; v_job.created_at:=v_now;
    END IF;
    v_job.attempt_no:=v_job.attempt_no+1; v_job.state:='leased'; v_job.worker_id:=p_worker_id;
    v_job.lease_expires_at:=v_now+p_lease_ms*interval '1 millisecond'; v_job.updated_at:=v_now;
    v_attempt:=NULL; v_attempt.request_id:=p_request_id; v_attempt.attempt_no:=v_job.attempt_no;
    v_attempt.worker_id:=p_worker_id; v_attempt.state:='leased'; v_attempt.claimed_at:=v_now; v_attempt.lease_expires_at:=v_job.lease_expires_at;
    v_expected_attempts:=v_expected_attempts||jsonb_build_array(to_jsonb(v_attempt));
    v_write:=true;
  ELSIF p_action='recover' THEN
    IF v_job.state IN ('leased','running') THEN
      IF v_job.lease_expires_at>v_now THEN RAISE EXCEPTION 'Deletion lease has not expired' USING ERRCODE='23505'; END IF;
      v_attempt.state:=CASE WHEN v_job.state='running' THEN 'outcome_unknown' ELSE 'expired' END;
      v_attempt.finished_at:=v_now;
      v_job.state:=CASE WHEN v_job.state='running' THEN 'outcome_unknown' WHEN v_job.attempt_no=3 THEN 'failed' ELSE 'retry_wait' END;
      v_job.worker_id:=NULL; v_job.lease_expires_at:=NULL; v_job.updated_at:=v_now; v_write:=true;
    END IF;
  ELSE
    IF v_job.state NOT IN ('leased','running') OR v_job.worker_id IS DISTINCT FROM p_worker_id
      OR v_job.attempt_no IS DISTINCT FROM p_attempt OR v_job.lease_expires_at<=v_now THEN
      RAISE EXCEPTION 'Deletion lease fence rejected' USING ERRCODE='23505';
    END IF;
    IF p_action='start' AND v_job.state='leased' THEN
      v_job.state:='running'; v_job.updated_at:=v_now; v_attempt.state:='running'; v_attempt.started_at:=v_now; v_write:=true;
    ELSIF p_action='heartbeat' THEN
      IF v_job.state<>'running' THEN RAISE EXCEPTION 'Deletion attempt not running' USING ERRCODE='23505'; END IF;
      v_job.lease_expires_at:=greatest(v_job.lease_expires_at,v_now+p_lease_ms*interval '1 millisecond');
      v_job.updated_at:=v_now; v_attempt.lease_expires_at:=v_job.lease_expires_at; v_attempt.heartbeat_at:=v_now; v_write:=true;
    END IF;
  END IF;
  v_expected_job:=to_jsonb(v_job);
  IF v_write THEN
    IF p_action<>'claim' THEN
      v_expected_attempts:=jsonb_set(v_expected_attempts,ARRAY[(v_job.attempt_no-1)::text],to_jsonb(v_attempt));
    END IF;
    IF NOT v_exists THEN
      INSERT INTO public.media_deletion_jobs SELECT (v_job).*;
    ELSE
      UPDATE public.media_deletion_jobs SET state=v_job.state,attempt_no=v_job.attempt_no,worker_id=v_job.worker_id,
        lease_expires_at=v_job.lease_expires_at,updated_at=v_job.updated_at WHERE request_id=p_request_id;
    END IF;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count<>1 THEN RAISE EXCEPTION 'Deletion job write suppressed' USING ERRCODE='23505'; END IF;
    SELECT to_jsonb(j) INTO v_actual FROM public.media_deletion_jobs j WHERE j.request_id=p_request_id;
    IF v_actual IS DISTINCT FROM v_expected_job THEN RAISE EXCEPTION 'Deletion job write altered' USING ERRCODE='23505'; END IF;
    IF p_action='claim' THEN
      INSERT INTO public.media_deletion_attempts SELECT (v_attempt).*;
    ELSE
      UPDATE public.media_deletion_attempts SET state=v_attempt.state,started_at=v_attempt.started_at,heartbeat_at=v_attempt.heartbeat_at,
        lease_expires_at=v_attempt.lease_expires_at,finished_at=v_attempt.finished_at WHERE request_id=p_request_id AND attempt_no=v_job.attempt_no;
    END IF;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count<>1 THEN RAISE EXCEPTION 'Deletion attempt write suppressed' USING ERRCODE='23505'; END IF;
  END IF;
  -- Compare independent complete expectations after ALL triggers, including the
  -- untouched attempts. RETURNING alone misses suppression and cross-row edits.
  SELECT to_jsonb(j) INTO v_actual FROM public.media_deletion_jobs j WHERE j.request_id=p_request_id;
  IF v_actual IS DISTINCT FROM v_expected_job THEN RAISE EXCEPTION 'Deletion job write conflict' USING ERRCODE='23505'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.attempt_no),'[]'::jsonb) INTO v_actual
    FROM public.media_deletion_attempts a WHERE a.request_id=p_request_id;
  IF v_actual IS DISTINCT FROM v_expected_attempts THEN RAISE EXCEPTION 'Deletion attempt write conflict' USING ERRCODE='23505'; END IF;
  SELECT to_jsonb(r) INTO v_actual FROM public.deletion_requests r WHERE r.id=p_request_id;
  IF v_actual IS DISTINCT FROM v_capture OR (SELECT count(*) FROM public.deletion_requests r
    WHERE r.project_id=v_request.project_id AND r.subject_id=v_request.subject_id)<>1 THEN
    RAISE EXCEPTION 'Deletion capture write conflict' USING ERRCODE='23505';
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.target_id),'[]'::jsonb) INTO v_actual
    FROM public.deletion_targets t WHERE t.deletion_request_id=p_request_id;
  IF v_actual IS DISTINCT FROM v_targets THEN RAISE EXCEPTION 'Deletion targets write conflict' USING ERRCODE='23505'; END IF;
  v_return_now:=clock_timestamp();
  IF v_job.state IN ('leased','running') AND (v_job.lease_expires_at<=v_return_now
    OR v_job.lease_expires_at>v_return_now+interval '120 seconds'
    OR (p_action='claim' AND v_job.lease_expires_at>v_return_now+p_lease_ms*interval '1 millisecond')) THEN
    RAISE EXCEPTION 'Deletion lease expired during operation' USING ERRCODE='23505';
  END IF;
  RETURN jsonb_build_object('schemaVersion',1,'requestId',p_request_id,'projectId',v_job.project_id,'subjectId',v_job.subject_id,
    'subjectType',v_job.subject_type,'captureTargetsSha256',v_job.capture_targets_sha256,'targetCount',v_job.target_count,
    'state',v_job.state,'attempt',v_job.attempt_no,'workerId',v_job.worker_id,'leaseExpiresAt',v_job.lease_expires_at,
    'serverNow',v_return_now,'canDeleteStorage',false,'physicalDeletionComplete',false);
END;
$$;
REVOKE ALL ON FUNCTION public.media_deletion_job_lease(uuid,text,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.media_deletion_job_lease(uuid,text,text,integer,integer) TO service_role;
COMMIT;

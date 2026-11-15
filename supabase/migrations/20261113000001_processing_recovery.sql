-- Persistent pre-send recovery. Existing reservations have no proof of whether
-- bytes left the process and deliberately remain unknown/non-retryable.
BEGIN;
ALTER TABLE public.story_transcription_requests
 ADD COLUMN execution_phase text NOT NULL DEFAULT 'unknown' CHECK(execution_phase IN('unknown','preparing','outbound')),
 ADD COLUMN preparation_lease_token uuid,
 ADD COLUMN preparation_lease_until timestamptz,
 ADD COLUMN preparation_attempt integer NOT NULL DEFAULT 0 CHECK(preparation_attempt BETWEEN 0 AND 5),
 ADD COLUMN outbound_started_at timestamptz,
 ADD CONSTRAINT transcription_preparation_identity CHECK(
  (execution_phase='unknown' AND preparation_lease_token IS NULL AND preparation_attempt=0 AND outbound_started_at IS NULL)
  OR (execution_phase='preparing' AND preparation_lease_token IS NOT NULL AND preparation_lease_until IS NOT NULL AND preparation_attempt>0 AND outbound_started_at IS NULL)
  OR (execution_phase='outbound' AND preparation_lease_token IS NOT NULL AND preparation_attempt>0 AND outbound_started_at IS NOT NULL));

ALTER FUNCTION public.story_review(uuid,uuid,text,uuid,integer,jsonb) RENAME TO story_review_before_recovery;
ALTER FUNCTION public.reserve_story_transcription(uuid,uuid,uuid,integer,jsonb) RENAME TO reserve_story_transcription_before_recovery;
ALTER FUNCTION public.read_story_transcription_status(uuid,uuid,uuid) RENAME TO read_story_transcription_status_before_recovery;
REVOKE ALL ON FUNCTION public.story_review_before_recovery(uuid,uuid,text,uuid,integer,jsonb),
 public.reserve_story_transcription_before_recovery(uuid,uuid,uuid,integer,jsonb),
 public.read_story_transcription_status_before_recovery(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Base review performs the existing membership, deletion, source and CAS locks.
-- Keeping the token outside the base payload preserves existing idempotent hashes.
CREATE FUNCTION public.story_review(p_actor_id uuid,p_story_id uuid,p_operation text,p_request_id uuid,p_expected_version integer,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET lock_timeout='3s' AS $$
DECLARE reservation public.story_transcription_requests%ROWTYPE;
BEGIN
 IF p_operation='ingest_transcript' AND coalesce((p_payload->>'local_worker')::boolean,false)=false THEN
  PERFORM public.story_review_before_recovery(p_actor_id,p_story_id,'read',NULL,NULL,'{}');
  SELECT * INTO reservation FROM public.story_transcription_requests WHERE actor_id=p_actor_id AND request_id=p_request_id AND story_id=p_story_id FOR UPDATE;
  IF NOT FOUND OR reservation.execution_phase<>'outbound' OR reservation.preparation_lease_token IS DISTINCT FROM (p_payload->>'lease_token')::uuid THEN
   RAISE EXCEPTION 'Transcription outbound permit required' USING ERRCODE='23505';
  END IF;
  IF reservation.completed_at IS NULL AND (SELECT audio_url FROM public.stories WHERE id=p_story_id)
   IS DISTINCT FROM '/api/media/assets/'||reservation.asset_id::text||'/play' THEN
   RAISE EXCEPTION 'Transcription audio source changed' USING ERRCODE='23505';
  END IF;
 END IF;
 RETURN public.story_review_before_recovery(p_actor_id,p_story_id,p_operation,p_request_id,p_expected_version,p_payload-'lease_token');
END $$;

CREATE FUNCTION public.reserve_story_transcription(p_actor_id uuid,p_story_id uuid,p_request_id uuid,p_expected_version integer,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET lock_timeout='3s' AS $$
DECLARE result jsonb; reservation public.story_transcription_requests%ROWTYPE; token uuid; prev_attempt integer:=0; stale_preparing boolean:=false;
BEGIN
 PERFORM public.story_review_before_recovery(p_actor_id,p_story_id,'read',NULL,NULL,'{}');
 SELECT * INTO reservation FROM public.story_transcription_requests WHERE story_id=p_story_id AND completed_at IS NULL FOR UPDATE;
 IF FOUND AND reservation.request_id IS DISTINCT FROM p_request_id
  AND reservation.execution_phase='preparing' AND reservation.preparation_lease_until<=clock_timestamp() AND reservation.preparation_attempt<5 THEN
  BEGIN
   PERFORM public.read_story_transcription_status_before_recovery(reservation.actor_id,p_story_id,reservation.request_id);
   IF reservation.actor_id IS DISTINCT FROM p_actor_id
    OR (SELECT audio_url FROM public.stories WHERE id=p_story_id) IS DISTINCT FROM '/api/media/assets/'||reservation.asset_id::text||'/play'
    OR reservation.policy_version IS DISTINCT FROM p_payload->>'policy_version'
    OR reservation.provider IS DISTINCT FROM p_payload->>'provider'
    OR reservation.model IS DISTINCT FROM p_payload->>'model'
    OR reservation.region IS DISTINCT FROM p_payload->>'region' THEN
    stale_preparing:=true;
   END IF;
  EXCEPTION WHEN SQLSTATE '23505' OR SQLSTATE '42501' THEN
   stale_preparing:=true;
  END;
  IF stale_preparing THEN
   prev_attempt:=reservation.preparation_attempt;
   DELETE FROM public.story_transcription_requests WHERE actor_id=reservation.actor_id AND request_id=reservation.request_id;
  END IF;
 END IF;
 -- This validates request equality including model/policy/source/asset metadata,
 -- and serializes every reservation and phase transition on the story row.
 result:=public.reserve_story_transcription_before_recovery(p_actor_id,p_story_id,p_request_id,p_expected_version,p_payload);
 SELECT * INTO reservation FROM public.story_transcription_requests WHERE actor_id=p_actor_id AND request_id=p_request_id AND story_id=p_story_id FOR UPDATE;
 IF result->>'status'='reserved' OR (result->>'status'='pending' AND reservation.execution_phase='preparing'
  AND reservation.preparation_lease_until<=clock_timestamp() AND reservation.preparation_attempt<5 AND reservation.completed_at IS NULL) THEN
  -- Existing reservations must also satisfy current source, consent and CAS.
  PERFORM public.read_story_transcription_status_before_recovery(p_actor_id,p_story_id,p_request_id);
  IF (SELECT audio_url FROM public.stories WHERE id=p_story_id)
   IS DISTINCT FROM '/api/media/assets/'||reservation.asset_id::text||'/play' THEN
   RAISE EXCEPTION 'Transcription audio source changed' USING ERRCODE='23505';
  END IF;
  token:=gen_random_uuid();
  UPDATE public.story_transcription_requests SET execution_phase='preparing',preparation_lease_token=token,
   preparation_lease_until=clock_timestamp()+interval '120 seconds',
   preparation_attempt=CASE WHEN result->>'status'='reserved' THEN prev_attempt+1 ELSE preparation_attempt+1 END
   WHERE actor_id=p_actor_id AND request_id=p_request_id;
  RETURN result||jsonb_build_object('status','reserved','leaseToken',token);
 END IF;
 RETURN result;
END $$;

CREATE FUNCTION public.begin_story_transcription(p_actor_id uuid,p_story_id uuid,p_request_id uuid,p_lease_token uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET lock_timeout='3s' AS $$
DECLARE status jsonb; reservation public.story_transcription_requests%ROWTYPE; asset public.media_assets%ROWTYPE;
BEGIN
 IF p_request_id IS NULL OR p_lease_token IS NULL THEN RAISE EXCEPTION 'Invalid outbound identity' USING ERRCODE='22023'; END IF;
 status:=public.read_story_transcription_status_before_recovery(p_actor_id,p_story_id,p_request_id);
 SELECT * INTO reservation FROM public.story_transcription_requests WHERE actor_id=p_actor_id AND request_id=p_request_id AND story_id=p_story_id FOR UPDATE;
 IF NOT FOUND OR reservation.completed_at IS NOT NULL OR reservation.execution_phase<>'preparing'
  OR reservation.preparation_lease_token IS DISTINCT FROM p_lease_token OR reservation.preparation_lease_until<=clock_timestamp() THEN
  RETURN jsonb_build_object('started',false);
 END IF;
 SELECT * INTO asset FROM public.media_assets WHERE id=reservation.asset_id FOR SHARE;
 IF NOT FOUND OR asset.state<>'ready' OR asset.story_id IS DISTINCT FROM p_story_id
  OR asset.kind NOT IN('original_audio','derived_audio')
  OR (SELECT audio_url FROM public.stories WHERE id=p_story_id) IS DISTINCT FROM '/api/media/assets/'||asset.id::text||'/play' THEN
  RAISE EXCEPTION 'Transcription audio source changed' USING ERRCODE='23505';
 END IF;
 UPDATE public.story_transcription_requests SET execution_phase='outbound',outbound_started_at=clock_timestamp()
  WHERE actor_id=p_actor_id AND request_id=p_request_id;
 RETURN jsonb_build_object('started',true);
END $$;

-- Release is an idempotent capability on a preparing lease. It does not trust a
-- caller's claim that no send occurred; SQL outbound state is authoritative.
CREATE FUNCTION public.release_story_transcription(p_actor_id uuid,p_story_id uuid,p_request_id uuid,p_lease_token uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET lock_timeout='3s' AS $$
DECLARE reservation public.story_transcription_requests%ROWTYPE;
BEGIN
 IF p_request_id IS NULL OR p_lease_token IS NULL THEN RAISE EXCEPTION 'Invalid preparation identity' USING ERRCODE='22023'; END IF;
 PERFORM public.story_review(p_actor_id,p_story_id,'read',NULL,NULL,'{}');
 SELECT * INTO reservation FROM public.story_transcription_requests WHERE actor_id=p_actor_id AND request_id=p_request_id AND story_id=p_story_id FOR UPDATE;
 IF NOT FOUND OR reservation.completed_at IS NOT NULL OR reservation.execution_phase<>'preparing'
  OR reservation.preparation_lease_token IS DISTINCT FROM p_lease_token THEN RETURN jsonb_build_object('released',false); END IF;
 UPDATE public.story_transcription_requests SET preparation_lease_until=least(preparation_lease_until,clock_timestamp())
  WHERE actor_id=p_actor_id AND request_id=p_request_id;
 RETURN jsonb_build_object('released',true);
END $$;

CREATE FUNCTION public.read_story_transcription_status(p_actor_id uuid,p_story_id uuid,p_request_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET lock_timeout='3s' AS $$
DECLARE result jsonb; reservation public.story_transcription_requests%ROWTYPE; retryable uuid; stale_preparing boolean:=false;
BEGIN
 result:=public.read_story_transcription_status_before_recovery(p_actor_id,p_story_id,p_request_id);
 SELECT * INTO reservation FROM public.story_transcription_requests WHERE story_id=p_story_id AND completed_at IS NULL;
 IF FOUND AND reservation.execution_phase='preparing' AND reservation.preparation_lease_until<=clock_timestamp() AND reservation.preparation_attempt<5 THEN
  -- Readiness never advertises a retry whose metadata, consent or CAS is stale.
  BEGIN
   PERFORM public.read_story_transcription_status_before_recovery(reservation.actor_id,p_story_id,reservation.request_id);
   IF reservation.actor_id=p_actor_id AND (SELECT audio_url FROM public.stories WHERE id=p_story_id)
    IS NOT DISTINCT FROM '/api/media/assets/'||reservation.asset_id::text||'/play' THEN
    retryable:=reservation.request_id;
   ELSE
    stale_preparing:=true;
   END IF;
  EXCEPTION WHEN SQLSTATE '23505' OR SQLSTATE '42501' THEN
   retryable:=NULL;
   stale_preparing:=true;
  END;
 END IF;
 IF stale_preparing AND (p_request_id IS NULL OR p_request_id IS DISTINCT FROM reservation.request_id) THEN
  RETURN result||jsonb_build_object('pendingRequestId',NULL,'status',NULL,'retryableRequestId',NULL);
 END IF;
 RETURN result||jsonb_build_object('retryableRequestId',retryable);
END $$;

REVOKE ALL ON FUNCTION public.story_review(uuid,uuid,text,uuid,integer,jsonb),
 public.reserve_story_transcription(uuid,uuid,uuid,integer,jsonb),public.read_story_transcription_status(uuid,uuid,uuid),
 public.begin_story_transcription(uuid,uuid,uuid,uuid),public.release_story_transcription(uuid,uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.story_review(uuid,uuid,text,uuid,integer,jsonb),
 public.reserve_story_transcription(uuid,uuid,uuid,integer,jsonb),public.read_story_transcription_status(uuid,uuid,uuid),
 public.begin_story_transcription(uuid,uuid,uuid,uuid),public.release_story_transcription(uuid,uuid,uuid,uuid) TO service_role;
COMMIT;

-- Source-bound AI editing. No provider prose is retained outside G1's existing erasure graph.
BEGIN;
ALTER TABLE public.story_assertions ADD COLUMN ai_evidence jsonb;
CREATE TABLE public.story_ai_edit_requests (
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL, story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
 revision_id uuid NOT NULL REFERENCES public.story_revisions(id) ON DELETE CASCADE,
 transcript_id uuid NOT NULL REFERENCES public.transcript_versions(id) ON DELETE CASCADE,
 expected_version integer NOT NULL CHECK(expected_version>=0), source_hash text NOT NULL, source_fingerprint text NOT NULL,
 policy_version text NOT NULL, configuration jsonb NOT NULL, request_sha256 text NOT NULL,
 editor_consent_id uuid NOT NULL REFERENCES public.consent_records(id) ON DELETE RESTRICT,
 reviewer_consent_id uuid NOT NULL REFERENCES public.consent_records(id) ON DELETE RESTRICT,
 lease_token uuid NOT NULL DEFAULT gen_random_uuid(),
 status text NOT NULL DEFAULT 'prepared' CHECK(status IN ('prepared','editing','reviewing','completed','rejected','invalidated')),
 result_revision_id uuid REFERENCES public.story_revisions(id) ON DELETE CASCADE,
 result_sha256 text, failure_code text, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), completed_at timestamptz,
 PRIMARY KEY(actor_id,request_id)
);
CREATE UNIQUE INDEX story_ai_edit_one_pending ON public.story_ai_edit_requests(story_id) WHERE status IN ('prepared','editing','reviewing');
ALTER TABLE public.story_ai_edit_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.story_ai_edit_requests FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER story_deleted_content_guard BEFORE INSERT OR UPDATE ON public.story_ai_edit_requests FOR EACH ROW EXECUTE FUNCTION public.guard_story_deleted_content();
CREATE FUNCTION public.purge_story_ai_edit_requests() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF NEW.status='deleted' AND EXISTS(SELECT 1 FROM public.story_deletion_context c WHERE c.transaction_id=txid_current() AND c.story_id=NEW.id) THEN
  DELETE FROM public.story_ai_edit_requests WHERE story_id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER story_ai_edit_erasure AFTER UPDATE ON public.stories FOR EACH ROW EXECUTE FUNCTION public.purge_story_ai_edit_requests();
REVOKE ALL ON FUNCTION public.purge_story_ai_edit_requests() FROM PUBLIC,anon,authenticated,service_role;

-- Evidence is private to the atomic draft writer. Family edits change claim hash / remove source and
-- cannot retain this capability. Approval still verifies source quote/times and renders actual assertions.
CREATE FUNCTION public.story_ai_claim_supported(a public.story_assertions) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT coalesce(a.ai_evidence->>'claim_sha256'=encode(sha256(convert_to(a.claim_text,'UTF8')),'hex')
  AND a.ai_evidence->>'supported'='true' AND a.ai_evidence->>'severity' IN ('none','warning')
  AND NOT a.is_severe_fabrication AND a.ai_evidence->>'source_fingerprint'=public.story_review_transcript_fingerprint(a.transcript_version_id)
  AND EXISTS(SELECT 1 FROM public.transcript_segments seg JOIN public.transcript_versions t ON t.id=seg.transcript_version_id
   WHERE seg.id=a.segment_id AND seg.transcript_version_id=a.transcript_version_id AND seg.project_id=a.project_id
    AND t.project_id=a.project_id AND t.story_id=a.story_id AND seg.text=a.source_quote
    AND CASE WHEN t.alignment_status='human_corrected' OR seg.is_human_corrected THEN
     a.memory_attribution='family_supplement' AND a.supplemented_by=t.created_by AND a.start_ms IS NULL AND a.end_ms IS NULL
    ELSE a.memory_attribution<>'family_supplement' AND a.start_ms IS NOT DISTINCT FROM seg.start_ms AND a.end_ms IS NOT DISTINCT FROM seg.end_ms END)
  AND EXISTS(SELECT 1 FROM public.story_ai_edit_requests q WHERE q.story_id=a.story_id AND q.result_revision_id=a.revision_id
   AND q.status='completed' AND q.policy_version=a.ai_evidence->>'policy_version'
   AND q.request_id::text=a.ai_evidence->>'request_id'),false)
$$;
REVOKE ALL ON FUNCTION public.story_ai_claim_supported(public.story_assertions) FROM PUBLIC,anon,authenticated,service_role;

DO $$
DECLARE definition text; fragment text:='''review_decision'',CASE';
BEGIN
 SELECT pg_get_functiondef('public.story_review_state(uuid,boolean)'::regprocedure) INTO definition;
 IF (length(definition)-length(replace(definition,fragment,'')))/length(fragment)<>1 THEN RAISE EXCEPTION 'AI review JSON baseline changed'; END IF;
 EXECUTE replace(definition,fragment,'''ai_review'',CASE WHEN public.story_ai_claim_supported(a) THEN a.ai_evidence ELSE NULL END,''review_decision'',CASE');
END $$;

-- 00001 wraps the original review implementation to fence transcription outbound leases. Extend only
-- the private inner approval predicate; leave that public recovery wrapper and all old guards intact.
DO $$
DECLARE definition text; old_fragment text:='AND a.claim_text=a.source_quote AND seg.start_ms';
BEGIN
 SELECT pg_get_functiondef('public.story_review_before_recovery(uuid,uuid,text,uuid,integer,jsonb)'::regprocedure) INTO definition;
 IF (length(definition)-length(replace(definition,old_fragment,'')))/length(old_fragment)<>1 THEN RAISE EXCEPTION 'AI approval predicate baseline changed'; END IF;
 definition:=replace(definition,old_fragment,'AND (a.claim_text=a.source_quote OR public.story_ai_claim_supported(a)) AND seg.start_ms');
 EXECUTE definition;
END $$;

CREATE FUNCTION public.story_ai_edit(p_actor_id uuid,p_story_id uuid,p_operation text,p_request_id uuid,p_payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET timezone='UTC' SET lock_timeout='3s' AS $$
DECLARE review jsonb; q public.story_ai_edit_requests%ROWTYPE; s public.stories%ROWTYPE;
 r public.story_revisions%ROWTYPE; seg public.transcript_segments%ROWTYPE; source_transcript public.transcript_versions%ROWTYPE; corrected_source boolean; v jsonb; item jsonb; config jsonb;
 request_hash text; result_hash text; stamp timestamptz:=clock_timestamp(); ec uuid; rc uuid; n integer; total integer; body_text text;
 pending uuid; latest_status text; latest_code text;
BEGIN
 IF p_operation IS NULL OR p_operation NOT IN ('status','reserve','editor','reviewer','complete','reject') OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object'
  OR octet_length(p_payload::text)>800000 OR current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'Invalid AI request' USING ERRCODE='22023'; END IF;
 -- Authoritative read takes story/membership/media/deletion locks through the existing G1/G2 guard.
 review:=public.story_review(p_actor_id,p_story_id,'read',NULL,NULL,'{}');
 SELECT * INTO s FROM public.stories WHERE id=p_story_id;
 IF p_request_id IS NOT NULL THEN
  SELECT * INTO q FROM public.story_ai_edit_requests WHERE actor_id=p_actor_id AND request_id=p_request_id FOR UPDATE;
  IF FOUND AND q.story_id<>p_story_id THEN RAISE EXCEPTION 'AI identity changed' USING ERRCODE='23505'; END IF;
 END IF;
 IF p_operation='status' AND p_request_id IS NULL THEN
  SELECT * INTO q FROM public.story_ai_edit_requests WHERE story_id=p_story_id AND status IN ('prepared','editing','reviewing') ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF q.request_id IS NOT NULL AND (q.source_hash IS DISTINCT FROM encode(sha256(convert_to(coalesce(s.transcript,''),'UTF8')),'hex')
   OR q.transcript_id::text IS DISTINCT FROM review->'transcript'->>'id' OR q.source_fingerprint IS DISTINCT FROM public.story_review_transcript_fingerprint(q.transcript_id)
   OR q.revision_id::text IS DISTINCT FROM review->'revision'->>'id' OR q.expected_version IS DISTINCT FROM (review->'revision'->>'edit_version')::integer) THEN
   UPDATE public.story_ai_edit_requests SET status='invalidated',failure_code='source_changed',completed_at=stamp WHERE actor_id=q.actor_id AND request_id=q.request_id;
   RETURN jsonb_build_object('status','invalidated','pendingRequestId',NULL,'code','source_changed','review',review);
  END IF;
  IF q.request_id IS NOT NULL AND (
   NOT EXISTS(SELECT 1 FROM public.consent_records c WHERE c.id=q.editor_consent_id AND c.project_id=s.project_id AND c.grantor_id=q.actor_id AND c.subject_id=s.id::text
    AND c.purpose='cloud_ai' AND c.provider=q.configuration->'editor'->>'provider' AND c.region=q.configuration->'editor'->>'region' AND c.policy_version=q.policy_version
    AND c.withdrawn_at IS NULL AND c.granted_at<=stamp)
   OR NOT EXISTS(SELECT 1 FROM public.consent_records c WHERE c.id=q.reviewer_consent_id AND c.project_id=s.project_id AND c.grantor_id=q.actor_id AND c.subject_id=s.id::text
    AND c.purpose='cloud_ai' AND c.provider=q.configuration->'reviewer'->>'provider' AND c.region=q.configuration->'reviewer'->>'region' AND c.policy_version=q.policy_version
    AND c.withdrawn_at IS NULL AND c.granted_at<=stamp)) THEN
   UPDATE public.story_ai_edit_requests SET status='invalidated',failure_code='consent_withdrawn',completed_at=stamp WHERE actor_id=q.actor_id AND request_id=q.request_id;
   RETURN jsonb_build_object('status','invalidated','pendingRequestId',NULL,'code','consent_withdrawn','review',review);
  END IF;
 END IF;
 IF q.request_id IS NOT NULL THEN
  IF q.source_hash IS DISTINCT FROM encode(sha256(convert_to(coalesce(s.transcript,''),'UTF8')),'hex')
   OR q.transcript_id::text IS DISTINCT FROM review->'transcript'->>'id' OR q.source_fingerprint IS DISTINCT FROM public.story_review_transcript_fingerprint(q.transcript_id)
   OR (q.status IN ('prepared','editing','reviewing') AND (q.revision_id::text IS DISTINCT FROM review->'revision'->>'id' OR q.expected_version IS DISTINCT FROM (review->'revision'->>'edit_version')::integer)) THEN
   RAISE EXCEPTION 'AI source changed' USING ERRCODE='23505'; END IF;
  -- Consent bindings must match both original destinations on every dispatch and commit.
  PERFORM 1 FROM public.consent_records c WHERE c.id=q.editor_consent_id AND c.project_id=s.project_id AND c.grantor_id=q.actor_id AND c.subject_id=s.id::text
   AND c.purpose='cloud_ai' AND c.provider=q.configuration->'editor'->>'provider' AND c.region=q.configuration->'editor'->>'region' AND c.policy_version=q.policy_version
   AND c.withdrawn_at IS NULL AND c.granted_at<=stamp FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AI consent withdrawn' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.consent_records c WHERE c.id=q.reviewer_consent_id AND c.project_id=s.project_id AND c.grantor_id=q.actor_id AND c.subject_id=s.id::text
   AND c.purpose='cloud_ai' AND c.provider=q.configuration->'reviewer'->>'provider' AND c.region=q.configuration->'reviewer'->>'region' AND c.policy_version=q.policy_version
   AND c.withdrawn_at IS NULL AND c.granted_at<=stamp FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AI consent withdrawn' USING ERRCODE='42501'; END IF;
 END IF;
 IF p_operation='status' THEN
  RETURN jsonb_build_object('status',q.status,'pendingRequestId',CASE WHEN q.status IN ('prepared','editing','reviewing') THEN q.request_id END,'code',q.failure_code,'review',review);
 END IF;
 IF p_request_id IS NULL THEN RAISE EXCEPTION 'AI request ID required' USING ERRCODE='22023'; END IF;
 IF p_operation='reserve' THEN
  config:=p_payload->'configuration';
  IF p_payload->'consent' IS DISTINCT FROM 'true'::jsonb OR jsonb_typeof(config) IS DISTINCT FROM 'object'
   OR config->'editor'->>'provider' IS DISTINCT FROM 'anthropic' OR config->'reviewer'->>'provider' IS DISTINCT FROM 'openai'
   OR config->'editor'->>'region' IS DISTINCT FROM 'us' OR config->'reviewer'->>'region' IS DISTINCT FROM 'us'
   OR config->'editor'->>'model' IS DISTINCT FROM 'claude-opus-5-5' OR config->'reviewer'->>'model' IS DISTINCT FROM 'gpt-6-astra'
   OR coalesce(p_payload->>'policy_version','') !~ '^g2-ai-[a-f0-9]{64}$' OR p_payload->>'expected_version' !~ '^[0-9]+$'
   OR octet_length(p_payload::text)>12000 THEN RAISE EXCEPTION 'Invalid AI consent/configuration' USING ERRCODE='22023'; END IF;
  request_hash:=encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
  IF q.request_id IS NOT NULL THEN
   IF q.request_sha256<>request_hash THEN RAISE EXCEPTION 'AI retry changed' USING ERRCODE='23505'; END IF;
   RETURN jsonb_build_object('status',q.status,'review',review);
  END IF;
  IF review->'revision'->>'id' IS NULL OR (review->>'sourceChanged')::boolean OR p_payload->>'revision_id' IS DISTINCT FROM review->'revision'->>'id'
   OR (p_payload->>'expected_version')::integer IS DISTINCT FROM (review->'revision'->>'edit_version')::integer
   OR p_payload->>'source_hash' IS DISTINCT FROM review->'revision'->>'source_hash'
   OR p_payload->>'source_fingerprint' IS DISTINCT FROM public.story_review_transcript_fingerprint((review->'transcript'->>'id')::uuid)
   OR p_payload->>'transcript_id' IS DISTINCT FROM review->'transcript'->>'id' THEN RAISE EXCEPTION 'AI source changed' USING ERRCODE='23505'; END IF;
  -- A new explicit source/CAS request may retire an obsolete in-flight attempt. The old
  -- lease can never commit; unchanged unknown attempts remain blocked rather than resent.
  UPDATE public.story_ai_edit_requests old SET status='invalidated',failure_code='source_changed',completed_at=stamp
   WHERE old.story_id=s.id AND old.status IN ('prepared','editing','reviewing') AND (
    old.source_hash IS DISTINCT FROM p_payload->>'source_hash' OR old.source_fingerprint IS DISTINCT FROM p_payload->>'source_fingerprint'
    OR old.transcript_id::text IS DISTINCT FROM p_payload->>'transcript_id' OR old.revision_id::text IS DISTINCT FROM p_payload->>'revision_id'
    OR old.expected_version IS DISTINCT FROM (p_payload->>'expected_version')::integer
    OR (old.status='prepared' AND old.policy_version IS DISTINCT FROM p_payload->>'policy_version')
    OR NOT EXISTS(SELECT 1 FROM public.consent_records c WHERE c.id=old.editor_consent_id AND c.project_id=s.project_id AND c.grantor_id=old.actor_id AND c.subject_id=s.id::text
     AND c.purpose='cloud_ai' AND c.provider=old.configuration->'editor'->>'provider' AND c.region=old.configuration->'editor'->>'region' AND c.policy_version=old.policy_version
     AND c.withdrawn_at IS NULL AND c.granted_at<=stamp)
    OR NOT EXISTS(SELECT 1 FROM public.consent_records c WHERE c.id=old.reviewer_consent_id AND c.project_id=s.project_id AND c.grantor_id=old.actor_id AND c.subject_id=s.id::text
     AND c.purpose='cloud_ai' AND c.provider=old.configuration->'reviewer'->>'provider' AND c.region=old.configuration->'reviewer'->>'region' AND c.policy_version=old.policy_version
     AND c.withdrawn_at IS NULL AND c.granted_at<=stamp));
  IF EXISTS(SELECT 1 FROM public.story_ai_edit_requests WHERE story_id=s.id AND status IN ('prepared','editing','reviewing')) THEN
   RETURN jsonb_build_object('status','pending','review',review);
  END IF;
  FOR n IN 1..2 LOOP
   v:=CASE WHEN n=1 THEN config->'editor' ELSE config->'reviewer' END;
   SELECT id INTO ec FROM public.consent_records WHERE project_id=s.project_id AND grantor_id=p_actor_id AND subject_id=s.id::text AND purpose='cloud_ai'
    AND provider=v->>'provider' AND region=v->>'region' AND policy_version=p_payload->>'policy_version' AND withdrawn_at IS NULL AND granted_at<=stamp ORDER BY granted_at DESC LIMIT 1 FOR SHARE;
   IF ec IS NULL THEN INSERT INTO public.consent_records(project_id,grantor_id,subject_id,purpose,provider,region,policy_version)
    VALUES(s.project_id,p_actor_id,s.id::text,'cloud_ai',v->>'provider',v->>'region',p_payload->>'policy_version') RETURNING id INTO ec; END IF;
   IF n=1 THEN rc:=ec; END IF;
  END LOOP;
  INSERT INTO public.story_ai_edit_requests(actor_id,request_id,story_id,revision_id,transcript_id,expected_version,source_hash,source_fingerprint,policy_version,configuration,request_sha256,editor_consent_id,reviewer_consent_id)
   VALUES(p_actor_id,p_request_id,s.id,(p_payload->>'revision_id')::uuid,(p_payload->>'transcript_id')::uuid,(p_payload->>'expected_version')::integer,p_payload->>'source_hash',p_payload->>'source_fingerprint',p_payload->>'policy_version',config,request_hash,rc,ec) RETURNING * INTO q;
  RETURN jsonb_build_object('status','reserved','leaseToken',q.lease_token,'review',review);
 END IF;
 IF q.request_id IS NULL OR p_payload->>'lease_token' IS DISTINCT FROM q.lease_token::text OR p_payload->>'policy_version' IS DISTINCT FROM q.policy_version THEN RAISE EXCEPTION 'AI lease unavailable' USING ERRCODE='42501'; END IF;
 IF p_operation IN ('editor','reviewer') THEN
  IF q.status IS DISTINCT FROM (CASE WHEN p_operation='editor' THEN 'prepared' ELSE 'editing' END) THEN
   RAISE EXCEPTION 'AI outbound outcome unresolved' USING ERRCODE='23505'; END IF;
  UPDATE public.story_ai_edit_requests SET status=CASE WHEN p_operation='editor' THEN 'editing' ELSE 'reviewing' END WHERE actor_id=p_actor_id AND request_id=p_request_id;
  RETURN jsonb_build_object('status','dispatch_allowed');
 END IF;
 IF p_operation='reject' THEN
  IF q.status NOT IN ('editing','reviewing') OR p_payload->>'code' NOT IN ('source_evidence_invalid','provider_invalid_response','review_invalid','review_rejected') THEN RAISE EXCEPTION 'Invalid AI rejection' USING ERRCODE='22023'; END IF;
  UPDATE public.story_ai_edit_requests SET status='rejected',failure_code=p_payload->>'code',completed_at=stamp WHERE actor_id=p_actor_id AND request_id=p_request_id;
  RETURN jsonb_build_object('status','rejected');
 END IF;
 result_hash:=encode(sha256(convert_to((p_payload->'result')::text,'UTF8')),'hex');
 IF q.status='completed' THEN
  IF q.result_sha256 IS DISTINCT FROM result_hash THEN RAISE EXCEPTION 'AI result identity changed' USING ERRCODE='23505'; END IF;
  RETURN jsonb_build_object('status','completed','review',review);
 END IF;
 IF q.status<>'reviewing' OR jsonb_typeof(p_payload->'result'->'paragraphs') IS DISTINCT FROM 'array' OR jsonb_typeof(p_payload->'result'->'verdicts') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'AI result unavailable' USING ERRCODE='23505'; END IF;
 total:=jsonb_array_length(p_payload->'result'->'paragraphs');
 IF total NOT BETWEEN 1 AND 200 OR total<>jsonb_array_length(p_payload->'result'->'verdicts') OR total<>(SELECT count(*) FROM public.transcript_segments WHERE transcript_version_id=q.transcript_id)
  OR p_payload->'result'->'metadata'->'editor'->>'model' IS DISTINCT FROM q.configuration->'editor'->>'model'
  OR p_payload->'result'->'metadata'->'reviewer'->>'model' IS DISTINCT FROM q.configuration->'reviewer'->>'model' THEN RAISE EXCEPTION 'Invalid AI model result' USING ERRCODE='23514'; END IF;
 FOR n IN 0..total-1 LOOP
  item:=p_payload->'result'->'paragraphs'->n; v:=p_payload->'result'->'verdicts'->n;
  SELECT * INTO seg FROM public.transcript_segments WHERE transcript_version_id=q.transcript_id ORDER BY segment_index OFFSET n LIMIT 1;
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(item))<>5 OR item->>'segmentId' IS DISTINCT FROM seg.id::text OR item->>'sourceQuote' IS DISTINCT FROM seg.text
   OR item->'startMs' IS DISTINCT FROM coalesce(to_jsonb(seg.start_ms),'null') OR item->'endMs' IS DISTINCT FROM coalesce(to_jsonb(seg.end_ms),'null')
   OR length(btrim(coalesce(item->>'text',''))) NOT BETWEEN 1 AND 10000 OR item->>'text' IS DISTINCT FROM btrim(item->>'text')
   OR v->'index' IS DISTINCT FROM to_jsonb(n) OR v->'supported' IS DISTINCT FROM 'true'::jsonb OR coalesce(v->>'severity','') NOT IN ('none','warning')
   OR jsonb_typeof(v->'risks') IS DISTINCT FROM 'array' OR jsonb_array_length(v->'risks')>10 OR octet_length((v->'risks')::text)>12000 THEN RAISE EXCEPTION 'AI source or risk rejected' USING ERRCODE='23514'; END IF;
 END LOOP;
 INSERT INTO public.story_review_context VALUES(txid_current(),s.id);
 UPDATE public.story_revisions SET status='invalidated',updated_at=stamp WHERE story_id=s.id AND status='draft';
 INSERT INTO public.story_revisions(project_id,story_id,transcript_version_id,revision_number,title,body,summary,content_sha256,created_by,source_hash,provenance_snapshot)
  SELECT s.project_id,s.id,q.transcript_id,coalesce(max(revision_number),0)+1,coalesce(nullif(s.title,''),'Family memory'),'','',encode(sha256(convert_to('','UTF8')),'hex'),p_actor_id,q.source_hash,
   jsonb_build_object('source_fingerprint',q.source_fingerprint,'ai',jsonb_build_object('policy_version',q.policy_version,'request_id',q.request_id,'processor','paragraph-editor-v1','models',p_payload->'result'->'metadata'))
  FROM public.story_revisions WHERE story_id=s.id RETURNING * INTO r;
 SELECT * INTO source_transcript FROM public.transcript_versions WHERE id=q.transcript_id FOR SHARE;
 FOR n IN 0..total-1 LOOP
  item:=p_payload->'result'->'paragraphs'->n;v:=p_payload->'result'->'verdicts'->n;
  SELECT * INTO seg FROM public.transcript_segments WHERE id=(item->>'segmentId')::uuid AND transcript_version_id=q.transcript_id;
  corrected_source:=source_transcript.alignment_status='human_corrected' OR seg.is_human_corrected;
  INSERT INTO public.story_assertions(project_id,story_id,transcript_version_id,segment_id,revision_id,ordinal,assertion_type,subject,claim_text,source_quote,start_ms,end_ms,date_precision,memory_attribution,supplemented_by,verification_status,ai_evidence)
   VALUES(s.project_id,s.id,q.transcript_id,seg.id,r.id,n,'event',seg.speaker_label,item->>'text',seg.text,
    CASE WHEN NOT corrected_source THEN seg.start_ms END,CASE WHEN NOT corrected_source THEN seg.end_ms END,'not_applicable',
    CASE WHEN corrected_source THEN 'family_supplement' ELSE 'storyteller_memory' END,
    CASE WHEN corrected_source THEN source_transcript.created_by END,CASE WHEN corrected_source THEN 'family_supplement' ELSE 'pending_review' END,
    jsonb_build_object('claim_sha256',encode(sha256(convert_to(item->>'text','UTF8')),'hex'),'source_fingerprint',q.source_fingerprint,'request_id',q.request_id,'policy_version',q.policy_version,'supported',true,'severity',v->>'severity','risks',v->'risks','models',p_payload->'result'->'metadata'));
 END LOOP;
 body_text:=public.story_review_render_body(r.id);
 UPDATE public.story_revisions SET body=body_text,summary=left(body_text,500),content_sha256=encode(sha256(convert_to(body_text,'UTF8')),'hex') WHERE id=r.id;
 UPDATE public.story_ai_edit_requests SET status='completed',completed_at=stamp,result_revision_id=r.id,result_sha256=result_hash WHERE actor_id=p_actor_id AND request_id=p_request_id;
 DELETE FROM public.story_review_context WHERE transaction_id=txid_current() AND story_id=s.id;
 RETURN jsonb_build_object('status','completed','review',public.story_review_state(s.id,(review->>'canApprove')::boolean));
END $$;
REVOKE ALL ON FUNCTION public.story_ai_edit(uuid,uuid,text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.story_ai_edit(uuid,uuid,text,uuid,jsonb) TO service_role;
COMMIT;

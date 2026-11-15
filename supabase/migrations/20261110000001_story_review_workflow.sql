-- Atomic family review, revision-owned assertions and contentless retry identities.
BEGIN;
ALTER TABLE public.transcript_segments ALTER COLUMN confidence DROP NOT NULL;
ALTER TABLE public.transcript_segments ALTER COLUMN confidence DROP DEFAULT;
ALTER TABLE public.story_revisions ADD COLUMN edit_version integer NOT NULL DEFAULT 0 CHECK(edit_version>=0);
ALTER TABLE public.story_revisions ADD COLUMN source_hash text CHECK(source_hash ~ '^[a-f0-9]{64}$');
ALTER TABLE public.story_revisions ADD COLUMN provenance_snapshot jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.story_assertions ADD COLUMN revision_id uuid REFERENCES public.story_revisions(id) ON DELETE CASCADE;
ALTER TABLE public.story_assertions ADD COLUMN ordinal integer NOT NULL DEFAULT 0 CHECK(ordinal>=0);
ALTER TABLE public.story_assertions ADD COLUMN supplemented_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE public.story_assertions ADD COLUMN alternatives jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(alternatives)='array');
CREATE INDEX story_assertions_revision ON public.story_assertions(revision_id,ordinal);
CREATE TABLE public.story_review_requests (
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  revision_id uuid NOT NULL REFERENCES public.story_revisions(id) ON DELETE CASCADE,
  request_sha256 text NOT NULL CHECK(request_sha256 ~ '^[a-f0-9]{64}$'),
  result_version integer NOT NULL CHECK(result_version>=0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(actor_id,request_id)
);
ALTER TABLE public.story_review_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.story_review_requests FROM PUBLIC,anon,authenticated,service_role;
-- All prose stays in the existing G1 purge graph. The FK clears retry hashes too.
CREATE TRIGGER story_deleted_content_guard BEFORE INSERT OR UPDATE ON public.story_review_requests
 FOR EACH ROW EXECUTE FUNCTION public.guard_story_deleted_content();

CREATE OR REPLACE FUNCTION public.prevent_approved_story_revision_overwrite() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF OLD.status IN ('approved','superseded') OR OLD.approved_at IS NOT NULL OR OLD.approved_by IS NOT NULL THEN
  IF TG_OP='DELETE' THEN
   IF EXISTS(SELECT 1 FROM public.story_deletion_context c WHERE c.transaction_id=txid_current() AND c.story_id=OLD.story_id) THEN RETURN OLD; END IF;
  ELSIF to_jsonb(NEW)-ARRAY['status','updated_at']=to_jsonb(OLD)-ARRAY['status','updated_at']
    AND (NEW.status=OLD.status OR (OLD.status='approved' AND NEW.status='superseded')) THEN RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Approved story revision is immutable' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER trg_prevent_approved_story_revision_overwrite ON public.story_revisions;
CREATE TRIGGER trg_prevent_approved_story_revision_overwrite BEFORE UPDATE OR DELETE ON public.story_revisions
 FOR EACH ROW EXECUTE FUNCTION public.prevent_approved_story_revision_overwrite();
REVOKE ALL ON FUNCTION public.prevent_approved_story_revision_overwrite() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.guard_approved_story_assertion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF TG_OP='DELETE' AND EXISTS(SELECT 1 FROM public.story_deletion_context c WHERE c.transaction_id=txid_current() AND c.story_id=OLD.story_id) THEN RETURN OLD; END IF;
 IF EXISTS(SELECT 1 FROM public.story_revisions r WHERE r.id IN (
   CASE WHEN TG_OP<>'INSERT' THEN OLD.revision_id END, CASE WHEN TG_OP<>'DELETE' THEN NEW.revision_id END)
   AND (r.status IN ('approved','superseded') OR r.approved_at IS NOT NULL OR r.approved_by IS NOT NULL)) THEN
  RAISE EXCEPTION 'Approved assertion is immutable' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER approved_story_assertion_guard BEFORE INSERT OR UPDATE OR DELETE ON public.story_assertions
 FOR EACH ROW EXECUTE FUNCTION public.guard_approved_story_assertion();
REVOKE ALL ON FUNCTION public.guard_approved_story_assertion() FROM PUBLIC,anon,authenticated,service_role;

-- Only the atomic review RPC can change the membership/decisions of a G2 draft.
-- This capability is table-backed and inaccessible to callers, not a spoofable GUC.
CREATE TABLE public.story_review_context(transaction_id bigint NOT NULL,story_id uuid NOT NULL,PRIMARY KEY(transaction_id,story_id));
ALTER TABLE public.story_review_context ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.story_review_context FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.guard_owned_story_review_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE previous jsonb; following jsonb; tracked boolean;
BEGIN
 IF TG_OP<>'INSERT' THEN previous:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN following:=to_jsonb(NEW); END IF;
 tracked:=CASE WHEN TG_TABLE_NAME='story_revisions' THEN coalesce(previous->>'source_hash',following->>'source_hash') IS NOT NULL
  ELSE coalesce(previous->>'revision_id',following->>'revision_id') IS NOT NULL END;
 IF tracked THEN
  IF TG_OP='DELETE' AND EXISTS(SELECT 1 FROM public.story_deletion_context c WHERE c.transaction_id=txid_current() AND c.story_id::text=previous->>'story_id') THEN RETURN OLD; END IF;
  -- The separate immutable-snapshot trigger permits only approved->superseded.
  IF TG_TABLE_NAME='story_revisions' AND TG_OP='UPDATE' AND previous->>'status' IN ('approved','superseded') THEN RETURN NEW; END IF;
  IF (previous IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.story_review_context c WHERE c.transaction_id=txid_current() AND c.story_id::text=previous->>'story_id'))
   OR (following IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.story_review_context c WHERE c.transaction_id=txid_current() AND c.story_id::text=following->>'story_id')) THEN
   RAISE EXCEPTION 'Revision changes require the review transaction' USING ERRCODE='23514'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER owned_story_review_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.story_assertions FOR EACH ROW EXECUTE FUNCTION public.guard_owned_story_review_write();
CREATE TRIGGER owned_story_review_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.story_revisions FOR EACH ROW EXECUTE FUNCTION public.guard_owned_story_review_write();
REVOKE ALL ON FUNCTION public.guard_owned_story_review_write() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.guard_review_transcript_source() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE old_id uuid; new_id uuid;
BEGIN
 IF TG_TABLE_NAME='transcript_versions' THEN
  IF TG_OP<>'INSERT' THEN old_id:=OLD.id; END IF;
  IF TG_OP<>'DELETE' THEN new_id:=NEW.id; END IF;
  IF TG_OP='UPDATE' AND to_jsonb(NEW)-'is_current'=to_jsonb(OLD)-'is_current' THEN RETURN NEW; END IF;
 ELSE
  IF TG_OP<>'INSERT' THEN old_id:=OLD.transcript_version_id; END IF;
  IF TG_OP<>'DELETE' THEN new_id:=NEW.transcript_version_id; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM public.story_revisions r WHERE r.transcript_version_id IN (old_id,new_id)) THEN
  IF TG_OP='DELETE' AND EXISTS(SELECT 1 FROM public.transcript_versions t JOIN public.story_deletion_context c ON c.story_id=t.story_id WHERE t.id=old_id AND c.transaction_id=txid_current()) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Reviewed transcript source is immutable' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER review_transcript_source_guard BEFORE UPDATE OR DELETE ON public.transcript_versions FOR EACH ROW EXECUTE FUNCTION public.guard_review_transcript_source();
CREATE TRIGGER review_transcript_source_guard BEFORE INSERT OR UPDATE OR DELETE ON public.transcript_segments FOR EACH ROW EXECUTE FUNCTION public.guard_review_transcript_source();
REVOKE ALL ON FUNCTION public.guard_review_transcript_source() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.story_review_asset_hash(m public.media_assets) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
 SELECT encode(sha256(convert_to(jsonb_build_object('id',m.id,'project_id',m.project_id,'story_id',m.story_id,'version',m.version,
  'bucket',m.bucket,'object_key',m.object_key,'sha256',m.sha256,'byte_size',m.byte_size,'duration_ms',m.duration_ms,'mime_type',m.mime_type,'state',m.state)::text,'UTF8')),'hex')
$$;
REVOKE ALL ON FUNCTION public.story_review_asset_hash(public.media_assets) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.story_review_transcript_fingerprint(p_transcript_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT encode(sha256(convert_to(jsonb_build_object('version',to_jsonb(t)-'is_current','asset',(SELECT public.story_review_asset_hash(m) FROM public.media_assets m WHERE m.id=t.asset_id),'segments',
  (SELECT coalesce(jsonb_agg(to_jsonb(seg) ORDER BY seg.segment_index),'[]') FROM public.transcript_segments seg WHERE seg.transcript_version_id=t.id))::text,'UTF8')),'hex')
 FROM public.transcript_versions t WHERE t.id=p_transcript_id
$$;
REVOKE ALL ON FUNCTION public.story_review_transcript_fingerprint(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.story_review_render_body(p_revision_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT coalesce(string_agg(a.claim_text||CASE WHEN a.memory_attribution='family_supplement' THEN E'\n[Family supplement: '||coalesce(a.supplemented_by::text,a.reviewed_by::text,r.created_by::text)||']' ELSE '' END||
   coalesce((SELECT string_agg(E'\n[Alternative: '||(alt->>'actor_id')||'] '||(alt->>'text'),'' ORDER BY n) FROM jsonb_array_elements(a.alternatives) WITH ORDINALITY q(alt,n)),''),E'\n\n' ORDER BY a.ordinal),'')
 FROM public.story_assertions a JOIN public.story_revisions r ON r.id=a.revision_id
 WHERE a.revision_id=p_revision_id AND a.review_decision NOT IN ('rejected','skipped')
$$;
REVOKE ALL ON FUNCTION public.story_review_render_body(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.story_review_revision_json(r public.story_revisions) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_object('id',r.id,'story_id',r.story_id,'status',r.status,'title',r.title,'body',r.body,'summary',r.summary,
  'revision_number',r.revision_number,'edit_version',r.edit_version,'approved_at',r.approved_at,'approved_by',r.approved_by,
  'source_transcript_id',r.transcript_version_id,'source_hash',r.source_hash,'provenance_snapshot',r.provenance_snapshot,'content_sha256',r.content_sha256)
$$;
REVOKE ALL ON FUNCTION public.story_review_revision_json(public.story_revisions) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.story_review_state(p_story_id uuid,p_can_approve boolean) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE r public.story_revisions%ROWTYPE; t public.transcript_versions%ROWTYPE; assertions jsonb; versions jsonb; transcript jsonb; current_hash text;
BEGIN
 SELECT encode(sha256(convert_to(coalesce(s.transcript,''),'UTF8')),'hex') INTO current_hash FROM public.stories s WHERE s.id=p_story_id;
 SELECT * INTO r FROM public.story_revisions WHERE story_id=p_story_id ORDER BY revision_number DESC LIMIT 1;
 SELECT * INTO t FROM public.transcript_versions WHERE story_id=p_story_id AND is_current ORDER BY version DESC LIMIT 1;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'revision_id',a.revision_id,'claim_text',a.claim_text,'assertion_type',a.assertion_type,
  'review_decision',CASE a.review_decision WHEN 'accepted' THEN 'accept' WHEN 'modified' THEN 'modify' WHEN 'disputed' THEN 'dispute' WHEN 'skipped' THEN 'skip' WHEN 'rejected' THEN 'reject' ELSE NULL END,
  'review_status',a.verification_status,'source_transcript_id',a.transcript_version_id,
  'source_segment_ids',CASE WHEN a.segment_id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(a.segment_id) END,
  'evidence_refs',CASE WHEN a.memory_attribution='family_supplement' OR a.segment_id IS NULL OR a.start_ms IS NULL OR a.end_ms IS NULL THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object('segment_id',a.segment_id,'start_ms',a.start_ms,'end_ms',a.end_ms)) END,
  'alternatives',a.alternatives,'confidence_score',s.confidence,'ordinal',a.ordinal,'memory_attribution',a.memory_attribution,
  'source_quote',a.source_quote,'supplemented_by',a.supplemented_by,'reviewed_by',a.reviewed_by,'start_ms',a.start_ms,'end_ms',a.end_ms) ORDER BY a.ordinal),'[]') INTO assertions
 FROM public.story_assertions a LEFT JOIN public.transcript_segments s ON s.id=a.segment_id WHERE a.revision_id=r.id;
 SELECT coalesce(jsonb_agg(public.story_review_revision_json(v) ORDER BY v.revision_number DESC),'[]') INTO versions FROM public.story_revisions v
 WHERE v.story_id=p_story_id AND (v.status IN ('approved','superseded') OR v.approved_at IS NOT NULL);
 IF t.id IS NOT NULL THEN
  SELECT jsonb_build_object('id',t.id,'provider',t.provider,'model',t.model,'alignment_status',t.alignment_status,'asset_id',t.asset_id,
   'segments',coalesce(jsonb_agg(jsonb_build_object('id',s.id,'text',s.text,'start_ms',s.start_ms,'end_ms',s.end_ms,'confidence',s.confidence,'speaker_label',s.speaker_label) ORDER BY s.segment_index),'[]')) INTO transcript
  FROM public.transcript_segments s WHERE s.transcript_version_id=t.id;
 END IF;
 RETURN jsonb_build_object('revision',CASE WHEN r.id IS NULL THEN NULL ELSE public.story_review_revision_json(r) END,'assertions',assertions,
  'transcript',transcript,'approvedRevisions',versions,'sourceChanged',coalesce(r.source_hash IS DISTINCT FROM current_hash AND r.id IS NOT NULL,false),'canApprove',p_can_approve);
END $$;
REVOKE ALL ON FUNCTION public.story_review_state(uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;

-- A pending reservation is never re-issued, including after an unknown provider outcome.
-- No audio or transcript prose is retained here. The G1 scrub deletes these identities.
CREATE TABLE public.story_transcription_requests (
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
 asset_id uuid NOT NULL,
 revision_id uuid,
 expected_version integer NOT NULL,
 source_hash text NOT NULL,
 asset_hash text NOT NULL,
 provider text NOT NULL,
 model text NOT NULL,
 region text NOT NULL,
 policy_version text NOT NULL,
 consent_id uuid NOT NULL REFERENCES public.consent_records(id) ON DELETE RESTRICT,
 request_sha256 text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 completed_at timestamptz,
 PRIMARY KEY(actor_id,request_id)
);
CREATE UNIQUE INDEX story_transcription_one_pending ON public.story_transcription_requests(story_id) WHERE completed_at IS NULL;
ALTER TABLE public.story_transcription_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.story_transcription_requests FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER story_deleted_content_guard BEFORE INSERT OR UPDATE ON public.story_transcription_requests
 FOR EACH ROW EXECUTE FUNCTION public.guard_story_deleted_content();
CREATE FUNCTION public.purge_story_transcription_requests() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF NEW.status='deleted' AND EXISTS(SELECT 1 FROM public.story_deletion_context c WHERE c.transaction_id=txid_current() AND c.story_id=NEW.id) THEN
  DELETE FROM public.story_transcription_requests WHERE story_id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER story_transcription_erasure AFTER UPDATE ON public.stories FOR EACH ROW EXECUTE FUNCTION public.purge_story_transcription_requests();
REVOKE ALL ON FUNCTION public.purge_story_transcription_requests() FROM PUBLIC,anon,authenticated,service_role;


CREATE FUNCTION public.story_review(p_actor_id uuid,p_story_id uuid,p_operation text,p_request_id uuid,p_expected_version integer,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET timezone='UTC' SET lock_timeout='3s' AS $$
DECLARE s public.stories%ROWTYPE; p public.projects%ROWTYPE; role_row public.project_roles%ROWTYPE;
 r public.story_revisions%ROWTYPE; current_revision public.story_revisions%ROWTYPE; t public.transcript_versions%ROWTYPE;
 assertion_row public.story_assertions%ROWTYPE; asset public.media_assets%ROWTYPE; request_row public.story_review_requests%ROWTYPE; reservation public.story_transcription_requests%ROWTYPE;
 can_approve boolean; source_hash text; request_hash text; full_text text; segment jsonb; position integer; next_version integer;
 create_transcript boolean:=false; create_draft boolean:=false; aligned boolean:=false; body_text text; snapshot jsonb; links jsonb; action text; stamp timestamptz:=clock_timestamp();
BEGIN
 IF p_actor_id IS NULL OR p_story_id IS NULL OR p_operation IS NULL OR p_operation NOT IN ('read','prepare','decide_assertion','correct_transcript','approve_revision','ingest_transcript')
  OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>1500000
  OR current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'Invalid review request' USING ERRCODE='22023'; END IF;
 -- Same lock order as G1 capture/purge; no request replay bypasses this fence.
 LOCK TABLE public.deletion_requests IN SHARE MODE;
 SELECT * INTO s FROM public.stories WHERE id=p_story_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Story unavailable' USING ERRCODE='P0002'; END IF;
 SELECT * INTO p FROM public.projects WHERE id=s.project_id FOR SHARE;
 SELECT * INTO role_row FROM public.project_roles WHERE project_id=s.project_id AND user_id=p_actor_id FOR SHARE;
 can_approve:=p.facilitator_id=p_actor_id OR p.owner_id=p_actor_id OR (role_row.status='active' AND role_row.role IN ('owner','facilitator','co_facilitator'));
 IF NOT coalesce(p.facilitator_id=p_actor_id OR p.owner_id=p_actor_id OR role_row.status='active',false) THEN RAISE EXCEPTION 'Review access denied' USING ERRCODE='42501'; END IF;
 can_approve:=coalesce(can_approve,false);
 IF s.status='deleted' OR p.status='deleted' OR EXISTS(SELECT 1 FROM public.deletion_requests d WHERE d.project_id=s.project_id AND d.tombstone_at IS NOT NULL
   AND (d.subject_id IN (s.id::text,p.id::text) OR d.subject_id IN (SELECT tv.asset_id::text FROM public.transcript_versions tv WHERE tv.story_id=s.id)))
  OR EXISTS(SELECT 1 FROM public.transcript_versions tv JOIN public.media_assets m ON m.id=tv.asset_id WHERE tv.story_id=s.id AND m.state IN ('deleting','deleted')) THEN
  RAISE EXCEPTION 'Review source unavailable' USING ERRCODE='23505'; END IF;
 IF EXISTS(SELECT 1 FROM public.transcript_versions tv LEFT JOIN public.media_assets m ON m.id=tv.asset_id WHERE tv.story_id=s.id AND
  (tv.project_id<>s.project_id OR (tv.asset_id IS NOT NULL AND (m.id IS NULL OR m.project_id<>s.project_id OR m.story_id IS DISTINCT FROM s.id)))) THEN
  RAISE EXCEPTION 'Review asset lineage changed' USING ERRCODE='23505'; END IF;
 -- Pin initial recording assets and every referenced transcript source before checking tombstones.
 PERFORM 1 FROM public.media_assets m WHERE m.story_id=s.id OR m.id IN (SELECT tv.asset_id FROM public.transcript_versions tv WHERE tv.story_id=s.id) FOR SHARE;
 IF EXISTS(SELECT 1 FROM public.media_assets m WHERE (m.story_id=s.id OR m.id IN (SELECT tv.asset_id FROM public.transcript_versions tv WHERE tv.story_id=s.id)) AND
  (m.state IN ('deleting','deleted') OR EXISTS(SELECT 1 FROM public.deletion_requests d WHERE d.project_id=s.project_id AND d.subject_id=m.id::text AND d.tombstone_at IS NOT NULL)))
  OR EXISTS(SELECT 1 FROM public.recording_output_candidates c JOIN public.deletion_requests d ON d.project_id=c.project_id AND d.subject_id=c.session_id::text AND d.tombstone_at IS NOT NULL
   WHERE c.asset_id IN (SELECT m.id FROM public.media_assets m WHERE m.story_id=s.id)) THEN RAISE EXCEPTION 'Review source unavailable' USING ERRCODE='23505'; END IF;
 IF EXISTS(SELECT 1 FROM public.transcript_versions tv LEFT JOIN public.media_assets m ON m.id=tv.asset_id WHERE tv.story_id=s.id AND tv.asset_id IS NOT NULL
  AND (m.id IS NULL OR m.project_id<>s.project_id OR m.story_id IS DISTINCT FROM s.id)) THEN RAISE EXCEPTION 'Review asset lineage changed' USING ERRCODE='23505'; END IF;
 source_hash:=encode(sha256(convert_to(coalesce(s.transcript,''),'UTF8')),'hex');
 SELECT * INTO current_revision FROM public.story_revisions WHERE story_id=s.id ORDER BY revision_number DESC LIMIT 1;
 SELECT * INTO t FROM public.transcript_versions WHERE story_id=s.id AND is_current ORDER BY version DESC LIMIT 1 FOR SHARE;
 IF current_revision.id IS NOT NULL AND t.id IS DISTINCT FROM current_revision.transcript_version_id THEN RAISE EXCEPTION 'Review current source changed' USING ERRCODE='23505'; END IF;
 IF current_revision.provenance_snapshot->>'source_fingerprint' IS NOT NULL AND current_revision.provenance_snapshot->>'source_fingerprint'
  IS DISTINCT FROM public.story_review_transcript_fingerprint(current_revision.transcript_version_id) THEN RAISE EXCEPTION 'Review media identity changed' USING ERRCODE='23505'; END IF;
 IF p_operation='read' THEN RETURN public.story_review_state(s.id,can_approve); END IF;
 IF p_request_id IS NULL OR (p_operation NOT IN ('prepare') AND (p_expected_version IS NULL OR p_expected_version<0)) THEN
  RAISE EXCEPTION 'Review identity required' USING ERRCODE='22023'; END IF;
 IF p_operation='ingest_transcript' AND coalesce((p_payload->>'local_worker')::boolean,false)=false THEN
  SELECT * INTO reservation FROM public.story_transcription_requests WHERE actor_id=p_actor_id AND request_id=p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transcription reservation required' USING ERRCODE='42501'; END IF;
  IF reservation.story_id<>s.id OR reservation.source_hash IS DISTINCT FROM p_payload->>'source_hash' OR reservation.asset_id::text IS DISTINCT FROM p_payload->>'asset_id'
   OR reservation.expected_version<>p_expected_version OR reservation.revision_id::text IS DISTINCT FROM p_payload->>'revision_id'
   OR reservation.provider IS DISTINCT FROM p_payload->>'provider' OR reservation.model IS DISTINCT FROM p_payload->>'model'
   OR reservation.region IS DISTINCT FROM p_payload->>'region' OR reservation.policy_version IS DISTINCT FROM p_payload->>'policy_version' THEN
   RAISE EXCEPTION 'Transcription reservation changed' USING ERRCODE='23505'; END IF;
  SELECT * INTO asset FROM public.media_assets WHERE id=reservation.asset_id FOR SHARE;
  IF NOT FOUND OR public.story_review_asset_hash(asset)<>reservation.asset_hash THEN RAISE EXCEPTION 'Transcription asset changed' USING ERRCODE='23505'; END IF;
  PERFORM 1 FROM public.consent_records c WHERE c.id=reservation.consent_id AND c.project_id=s.project_id AND c.grantor_id=p_actor_id AND c.subject_id=s.id::text
   AND c.purpose='cloud_ai' AND c.provider=reservation.provider AND c.region=reservation.region AND c.policy_version=reservation.policy_version
   AND c.granted_at<=stamp AND c.withdrawn_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transcription consent withdrawn' USING ERRCODE='42501'; END IF;
 END IF;
 request_hash:=encode(sha256(convert_to(jsonb_build_object('story_id',p_story_id,'operation',p_operation,'expected_version',p_expected_version,'payload',p_payload)::text,'UTF8')),'hex');
 SELECT * INTO request_row FROM public.story_review_requests WHERE actor_id=p_actor_id AND request_id=p_request_id;
 IF FOUND THEN
  IF request_row.story_id<>s.id OR request_row.request_sha256<>request_hash THEN RAISE EXCEPTION 'Review retry identity changed' USING ERRCODE='23505'; END IF;
  IF current_revision.source_hash IS DISTINCT FROM source_hash THEN RAISE EXCEPTION 'Review source changed' USING ERRCODE='23505'; END IF;
  IF p_operation='approve_revision' AND NOT can_approve THEN RAISE EXCEPTION 'Approval denied' USING ERRCODE='42501'; END IF;
  RETURN public.story_review_state(s.id,can_approve);
 END IF;
 INSERT INTO public.story_review_context(transaction_id,story_id) VALUES(txid_current(),s.id);
 SELECT * INTO t FROM public.transcript_versions WHERE story_id=s.id AND is_current ORDER BY version DESC LIMIT 1;
 IF p_operation='prepare' THEN
  IF current_revision.status='draft' AND current_revision.source_hash=source_hash AND t.full_text=s.transcript THEN r:=current_revision;
  ELSE create_draft:=true;
   IF t.id IS NULL OR t.full_text IS DISTINCT FROM s.transcript THEN create_transcript:=true; full_text:=s.transcript; END IF;
  END IF;
 ELSE
  IF p_operation='ingest_transcript' AND current_revision.id IS NULL THEN
   IF p_expected_version<>0 OR p_payload->>'revision_id' IS NOT NULL THEN RAISE EXCEPTION 'Review version changed' USING ERRCODE='23505'; END IF;
  ELSE
   IF current_revision.id IS NULL OR p_payload->>'revision_id' IS DISTINCT FROM current_revision.id::text OR p_expected_version<>current_revision.edit_version THEN
    RAISE EXCEPTION 'Review version changed' USING ERRCODE='23505'; END IF;
   IF current_revision.source_hash IS DISTINCT FROM source_hash THEN RAISE EXCEPTION 'Review source changed' USING ERRCODE='23505'; END IF;
  END IF;
  r:=current_revision;
  IF p_operation IN ('correct_transcript','ingest_transcript') THEN create_draft:=true; create_transcript:=true;
   IF p_operation='correct_transcript' THEN full_text:=p_payload->>'text';
   ELSE
    IF p_payload->>'source_hash' IS DISTINCT FROM source_hash OR jsonb_typeof(p_payload->'segments') IS DISTINCT FROM 'array'
      OR jsonb_array_length(p_payload->'segments') NOT BETWEEN 1 AND 2000 OR length(coalesce(p_payload->>'provider','')) NOT BETWEEN 1 AND 100
      OR length(coalesce(p_payload->>'model','')) NOT BETWEEN 1 AND 200 OR length(coalesce(p_payload->>'language','')) NOT BETWEEN 1 AND 35 THEN
      RAISE EXCEPTION 'Invalid transcript input' USING ERRCODE='22023'; END IF;
    SELECT * INTO asset FROM public.media_assets WHERE id=(p_payload->>'asset_id')::uuid FOR SHARE;
    IF NOT FOUND OR asset.story_id IS DISTINCT FROM s.id OR asset.project_id<>s.project_id OR asset.state<>'ready' OR asset.kind NOT IN ('original_audio','derived_audio')
      OR EXISTS(SELECT 1 FROM public.deletion_requests d WHERE d.project_id=s.project_id AND d.subject_id=asset.id::text AND d.tombstone_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Transcript asset unavailable' USING ERRCODE='23505'; END IF;
    IF coalesce((p_payload->>'local_worker')::boolean,false)=false THEN
     PERFORM 1 FROM public.consent_records c WHERE c.project_id=s.project_id AND c.grantor_id=p_actor_id AND c.subject_id=s.id::text AND c.purpose='cloud_ai'
      AND c.provider=p_payload->>'provider' AND c.region=p_payload->>'region' AND c.policy_version=p_payload->>'policy_version' AND c.granted_at<=stamp AND c.withdrawn_at IS NULL FOR SHARE;
     IF NOT FOUND THEN RAISE EXCEPTION 'Transcript consent unavailable' USING ERRCODE='42501'; END IF;
    END IF;
    full_text:='';aligned:=true;position:=0;
    FOR segment IN SELECT value FROM jsonb_array_elements(p_payload->'segments') LOOP
     IF jsonb_typeof(segment)<>'object' OR jsonb_typeof(segment->'text') IS DISTINCT FROM 'string' OR length(btrim(segment->>'text')) NOT BETWEEN 1 AND 100000
       OR (segment->>'confidence' IS NOT NULL AND (jsonb_typeof(segment->'confidence')<>'number' OR (segment->>'confidence')::numeric NOT BETWEEN 0 AND 1))
       OR (segment->>'start_ms' IS NOT NULL AND (jsonb_typeof(segment->'start_ms')<>'number' OR segment->>'start_ms' !~ '^[0-9]+$'))
       OR (segment->>'end_ms' IS NOT NULL AND (jsonb_typeof(segment->'end_ms')<>'number' OR segment->>'end_ms' !~ '^[0-9]+$'))
       OR ((segment->>'start_ms' IS NULL)<>(segment->>'end_ms' IS NULL)) THEN RAISE EXCEPTION 'Invalid transcript segment' USING ERRCODE='22023'; END IF;
     IF segment->>'start_ms' IS NULL THEN aligned:=false;
     ELSIF (segment->>'start_ms')::numeric<position OR (segment->>'end_ms')::numeric<=(segment->>'start_ms')::numeric OR (segment->>'end_ms')::numeric>coalesce(asset.duration_ms,7200000) THEN
      RAISE EXCEPTION 'Invalid transcript timing' USING ERRCODE='22023';
     ELSE position:=(segment->>'end_ms')::integer; END IF;
     full_text:=full_text||CASE WHEN full_text='' THEN '' ELSE E'\n\n' END||btrim(segment->>'text');
    END LOOP;
   END IF;
  ELSIF r.status<>'draft' THEN RAISE EXCEPTION 'Review is not editable' USING ERRCODE='23505';
  ELSIF p_operation='decide_assertion' THEN
   action:=p_payload->>'action';IF action IS NULL OR action NOT IN ('accept','modify','dispute','skip','reject') THEN RAISE EXCEPTION 'Invalid decision' USING ERRCODE='22023'; END IF;
   SELECT * INTO assertion_row FROM public.story_assertions WHERE id=(p_payload->>'assertion_id')::uuid AND revision_id=r.id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Assertion unavailable' USING ERRCODE='P0002'; END IF;
   IF action IN ('modify','dispute') AND length(btrim(coalesce(p_payload->>'text',''))) NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'Decision text required' USING ERRCODE='22023'; END IF;
   UPDATE public.story_assertions SET review_decision=CASE action WHEN 'accept' THEN 'accepted' WHEN 'modify' THEN 'modified' WHEN 'dispute' THEN 'disputed' WHEN 'skip' THEN 'skipped' ELSE 'rejected' END,
    claim_text=CASE WHEN action='modify' THEN btrim(p_payload->>'text') ELSE claim_text END,
    memory_attribution=CASE WHEN action='modify' OR assertion_row.memory_attribution='family_supplement' THEN 'family_supplement' WHEN action='dispute' THEN 'disputed_memory' ELSE memory_attribution END,
    supplemented_by=CASE WHEN action='modify' THEN p_actor_id ELSE supplemented_by END,
    verification_status=CASE WHEN action='modify' OR assertion_row.memory_attribution='family_supplement' THEN 'family_supplement' WHEN action='dispute' THEN 'disputed'
     WHEN action='reject' THEN 'unverified_rejected' WHEN action='accept' AND assertion_row.start_ms IS NOT NULL AND assertion_row.end_ms IS NOT NULL AND assertion_row.claim_text=assertion_row.source_quote THEN 'verified' ELSE 'pending_review' END,
    segment_id=CASE WHEN action='modify' THEN NULL ELSE segment_id END,source_quote=CASE WHEN action='modify' THEN NULL ELSE source_quote END,
    start_ms=CASE WHEN action='modify' THEN NULL ELSE start_ms END,end_ms=CASE WHEN action='modify' THEN NULL ELSE end_ms END,
    alternatives=CASE WHEN action='dispute' THEN alternatives||jsonb_build_array(jsonb_build_object('text',btrim(p_payload->>'text'),'actor_id',p_actor_id,'created_at',stamp)) ELSE alternatives END,
    disputed_alternative_text=CASE WHEN action='dispute' THEN btrim(p_payload->>'text') ELSE disputed_alternative_text END,
    disputed_by=CASE WHEN action='dispute' THEN p_actor_id ELSE disputed_by END,reviewed_by=p_actor_id,updated_at=stamp WHERE id=assertion_row.id;
   body_text:=public.story_review_render_body(r.id);
   UPDATE public.story_revisions SET body=body_text,summary=left(body_text,500),content_sha256=encode(sha256(convert_to(body_text,'UTF8')),'hex'),edit_version=edit_version+1,updated_at=stamp WHERE id=r.id RETURNING * INTO r;
  ELSIF p_operation='approve_revision' THEN
   IF NOT can_approve THEN RAISE EXCEPTION 'Approval denied' USING ERRCODE='42501'; END IF;
   IF t.id IS DISTINCT FROM r.transcript_version_id OR t.full_text IS DISTINCT FROM s.transcript OR r.provenance_snapshot->>'source_fingerprint' IS DISTINCT FROM public.story_review_transcript_fingerprint(t.id) THEN RAISE EXCEPTION 'Review transcript changed' USING ERRCODE='23505'; END IF;
   IF regexp_replace(btrim(t.full_text),'[[:space:]]+',' ','g') IS DISTINCT FROM
    (SELECT regexp_replace(btrim(string_agg(ts.text,' ' ORDER BY ts.segment_index)),'[[:space:]]+',' ','g') FROM public.transcript_segments ts WHERE ts.transcript_version_id=t.id) THEN RAISE EXCEPTION 'Review source coverage changed' USING ERRCODE='23505'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.story_assertions WHERE revision_id=r.id AND review_decision IN ('accepted','modified','disputed')) OR EXISTS(
     SELECT 1 FROM public.story_assertions a WHERE a.revision_id=r.id AND (a.review_decision NOT IN ('accepted','modified','disputed','rejected')
      OR a.reviewed_by IS NULL OR a.verification_status='invalidated' OR (a.is_severe_fabrication AND a.review_decision<>'rejected')
      OR (a.review_decision='disputed' AND jsonb_array_length(a.alternatives)=0)
      OR (a.review_decision='modified' AND a.memory_attribution<>'family_supplement')
      OR a.transcript_version_id<>r.transcript_version_id
      OR (a.review_decision IN ('accepted','disputed') AND a.memory_attribution<>'family_supplement' AND NOT EXISTS(SELECT 1 FROM public.transcript_segments seg WHERE seg.id=a.segment_id AND seg.transcript_version_id=r.transcript_version_id AND seg.text=a.source_quote AND a.claim_text=a.source_quote AND seg.start_ms IS NOT DISTINCT FROM a.start_ms AND seg.end_ms IS NOT DISTINCT FROM a.end_ms)))) THEN
    RAISE EXCEPTION 'Review decisions incomplete' USING ERRCODE='23514'; END IF;
   body_text:=public.story_review_render_body(r.id);
   SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.ordinal),'[]') INTO snapshot FROM public.story_assertions a WHERE a.revision_id=r.id;
   SELECT coalesce(jsonb_agg(jsonb_build_object('assertion_id',a.id,'transcript_version_id',a.transcript_version_id,'segment_id',a.segment_id,'start_ms',a.start_ms,'end_ms',a.end_ms) ORDER BY a.ordinal),'[]') INTO links
     FROM public.story_assertions a WHERE a.revision_id=r.id AND a.review_decision<>'rejected' AND a.memory_attribution<>'family_supplement';
   snapshot:=jsonb_build_object('assertions',snapshot,'transcript',to_jsonb(t),'segments',(SELECT coalesce(jsonb_agg(to_jsonb(ts) ORDER BY ts.segment_index),'[]') FROM public.transcript_segments ts WHERE ts.transcript_version_id=t.id),
     'approved_by',p_actor_id,'approved_at',stamp,'source_hash',source_hash,'source_fingerprint',public.story_review_transcript_fingerprint(t.id));
   UPDATE public.story_revisions SET status='approved',body=body_text,summary=left(body_text,500),provenance_links=links,provenance_snapshot=snapshot,
    content_sha256=encode(sha256(convert_to(jsonb_build_object('title',title,'body',body_text,'summary',left(body_text,500),'provenance',snapshot,'links',links)::text,'UTF8')),'hex'),
    approved_at=stamp,approved_by=p_actor_id,edit_version=edit_version+1,updated_at=stamp WHERE id=r.id RETURNING * INTO r;
  END IF;
 END IF;
 IF create_transcript THEN
  IF length(btrim(coalesce(full_text,''))) NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'Transcript text required' USING ERRCODE='22023'; END IF;
  IF p_operation IN ('correct_transcript','ingest_transcript') THEN UPDATE public.stories SET transcript=full_text,updated_at=stamp WHERE id=s.id;source_hash:=encode(sha256(convert_to(full_text,'UTF8')),'hex'); END IF;
  SELECT coalesce(max(version),0)+1 INTO next_version FROM public.transcript_versions WHERE story_id=s.id;
  UPDATE public.transcript_versions SET is_current=false WHERE story_id=s.id AND is_current;
  INSERT INTO public.transcript_versions(project_id,story_id,asset_id,version,language,provider,model,alignment_status,content_sha256,full_text,created_by)
   VALUES(s.project_id,s.id,CASE WHEN p_operation='ingest_transcript' THEN asset.id ELSE t.asset_id END,next_version,CASE WHEN p_operation='ingest_transcript' THEN p_payload->>'language' ELSE coalesce(t.language,'und') END,
    CASE WHEN p_operation='ingest_transcript' THEN p_payload->>'provider' WHEN p_operation='correct_transcript' THEN 'human' ELSE 'legacy' END,
    CASE WHEN p_operation='ingest_transcript' THEN p_payload->>'model' WHEN p_operation='correct_transcript' THEN 'family-correction' ELSE 'imported-text' END,
    CASE WHEN p_operation='correct_transcript' THEN 'human_corrected' WHEN p_operation='ingest_transcript' AND aligned THEN 'aligned' ELSE 'legacy_unaligned' END,source_hash,full_text,p_actor_id) RETURNING * INTO t;
  IF p_operation='ingest_transcript' THEN
   INSERT INTO public.transcript_segments(project_id,transcript_version_id,segment_index,speaker_label,start_ms,end_ms,text,confidence)
    SELECT s.project_id,t.id,n-1,coalesce(nullif(left(value->>'speaker_label',100),''),'storyteller'),(value->>'start_ms')::integer,(value->>'end_ms')::integer,btrim(value->>'text'),(value->>'confidence')::numeric
    FROM jsonb_array_elements(p_payload->'segments') WITH ORDINALITY q(value,n);
  ELSE
   INSERT INTO public.transcript_segments(project_id,transcript_version_id,segment_index,text,confidence,is_human_corrected)
    SELECT s.project_id,t.id,n-1,btrim(value),NULL,p_operation='correct_transcript' FROM regexp_split_to_table(full_text,E'\n[\t\r ]*\n+') WITH ORDINALITY q(value,n) WHERE btrim(value)<>'';
  END IF;
 END IF;
 IF create_draft THEN
  IF NOT create_transcript THEN
   LOCK TABLE public.transcript_segments IN SHARE MODE;
   SELECT * INTO t FROM public.transcript_versions WHERE id=t.id FOR SHARE;
   IF t.full_text IS DISTINCT FROM s.transcript THEN RAISE EXCEPTION 'Review transcript changed during capture' USING ERRCODE='23505'; END IF;
  END IF;
  -- Older transcript hashes may include provider metadata. Validate actual ordered source coverage instead of assuming a hash algorithm.
  IF regexp_replace(btrim(t.full_text),'[[:space:]]+',' ','g') IS DISTINCT FROM
   (SELECT regexp_replace(btrim(string_agg(ts.text,' ' ORDER BY ts.segment_index)),'[[:space:]]+',' ','g') FROM public.transcript_segments ts WHERE ts.transcript_version_id=t.id) THEN
   RAISE EXCEPTION 'Transcript segment coverage changed' USING ERRCODE='23505'; END IF;
  IF t.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.transcript_segments WHERE transcript_version_id=t.id) OR (SELECT count(*) FROM public.transcript_segments WHERE transcript_version_id=t.id)>2000 THEN RAISE EXCEPTION 'Transcript segments unavailable' USING ERRCODE='23514'; END IF;
  UPDATE public.story_revisions SET status='invalidated',updated_at=stamp WHERE story_id=s.id AND status='draft';
  SELECT coalesce(max(revision_number),0)+1 INTO next_version FROM public.story_revisions WHERE story_id=s.id;
  INSERT INTO public.story_revisions(project_id,story_id,transcript_version_id,revision_number,title,body,summary,content_sha256,created_by,source_hash,provenance_snapshot)
   VALUES(s.project_id,s.id,t.id,next_version,coalesce(nullif(s.title,''),'Untitled story'),'','',encode(sha256(convert_to('','UTF8')),'hex'),p_actor_id,source_hash,jsonb_build_object('source_fingerprint',public.story_review_transcript_fingerprint(t.id))) RETURNING * INTO r;
  INSERT INTO public.story_assertions(project_id,story_id,transcript_version_id,segment_id,revision_id,ordinal,assertion_type,subject,claim_text,source_quote,start_ms,end_ms,date_precision,memory_attribution,supplemented_by)
   SELECT s.project_id,s.id,t.id,ts.id,r.id,ts.segment_index,'quote',ts.speaker_label,ts.text,ts.text,ts.start_ms,ts.end_ms,'not_applicable',
    CASE WHEN t.alignment_status='human_corrected' THEN 'family_supplement' ELSE 'storyteller_memory' END,
    CASE WHEN t.alignment_status='human_corrected' THEN t.created_by ELSE NULL END FROM public.transcript_segments ts WHERE ts.transcript_version_id=t.id ORDER BY ts.segment_index;
  body_text:=public.story_review_render_body(r.id);
  UPDATE public.story_revisions SET body=body_text,summary=left(body_text,500),content_sha256=encode(sha256(convert_to(body_text,'UTF8')),'hex') WHERE id=r.id RETURNING * INTO r;
 END IF;
 IF p_operation='ingest_transcript' AND reservation.request_id IS NOT NULL THEN
  UPDATE public.story_transcription_requests SET completed_at=stamp WHERE actor_id=p_actor_id AND request_id=p_request_id;
 END IF;
 INSERT INTO public.story_review_requests(actor_id,request_id,story_id,revision_id,request_sha256,result_version) VALUES(p_actor_id,p_request_id,s.id,r.id,request_hash,r.edit_version);
 DELETE FROM public.story_review_context WHERE transaction_id=txid_current() AND story_id=s.id;
 RETURN public.story_review_state(s.id,can_approve);
END $$;
REVOKE ALL ON FUNCTION public.story_review(uuid,uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.story_review(uuid,uuid,text,uuid,integer,jsonb) TO service_role;
CREATE FUNCTION public.reserve_story_transcription(p_actor_id uuid,p_story_id uuid,p_request_id uuid,p_expected_version integer,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET timezone='UTC' SET lock_timeout='3s' AS $$
DECLARE review jsonb; s public.stories%ROWTYPE; asset public.media_assets%ROWTYPE; reservation public.story_transcription_requests%ROWTYPE;
 request_hash text; asset_hash text; consent_id uuid; stamp timestamptz:=clock_timestamp();
BEGIN
 -- The read RPC pins membership, source and deletion state for this whole transaction.
 review:=public.story_review(p_actor_id,p_story_id,'read',NULL,NULL,'{}');
 IF p_request_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR octet_length(p_payload::text)>12000 OR p_payload->>'source_hash' !~ '^[a-f0-9]{64}$' OR p_payload->>'asset_sha256' !~ '^[a-f0-9]{64}$'
  OR p_payload->>'asset_version' !~ '^[0-9]+$' OR length(coalesce(p_payload->>'provider','')) NOT BETWEEN 1 AND 100
  OR length(coalesce(p_payload->>'model','')) NOT BETWEEN 1 AND 200 OR length(coalesce(p_payload->>'region','')) NOT BETWEEN 1 AND 100
  OR length(coalesce(p_payload->>'policy_version','')) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid transcription reservation' USING ERRCODE='22023'; END IF;
 IF p_payload->'consent' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Explicit transcription consent required' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.stories WHERE id=p_story_id;
 SELECT * INTO asset FROM public.media_assets WHERE id=(p_payload->>'asset_id')::uuid FOR SHARE;
 IF NOT FOUND OR asset.story_id IS DISTINCT FROM s.id OR asset.project_id<>s.project_id OR asset.state<>'ready' OR asset.kind NOT IN ('original_audio','derived_audio')
  OR asset.version IS DISTINCT FROM (p_payload->>'asset_version')::integer OR asset.sha256 IS DISTINCT FROM p_payload->>'asset_sha256'
  OR asset.bucket IS DISTINCT FROM p_payload->>'asset_bucket' OR asset.object_key IS DISTINCT FROM p_payload->>'asset_object_key' THEN
  RAISE EXCEPTION 'Transcription asset changed' USING ERRCODE='23505'; END IF;
 asset_hash:=public.story_review_asset_hash(asset);
 request_hash:=encode(sha256(convert_to(jsonb_build_object('story_id',p_story_id,'expected_version',p_expected_version,'payload',p_payload)::text,'UTF8')),'hex');
 SELECT * INTO reservation FROM public.story_transcription_requests WHERE actor_id=p_actor_id AND request_id=p_request_id;
 IF FOUND THEN
  IF reservation.story_id<>s.id OR reservation.request_sha256<>request_hash OR reservation.asset_hash<>asset_hash THEN RAISE EXCEPTION 'Transcription retry changed' USING ERRCODE='23505'; END IF;
  PERFORM 1 FROM public.consent_records c WHERE c.id=reservation.consent_id AND c.withdrawn_at IS NULL AND c.granted_at<=stamp FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transcription consent withdrawn' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('status',CASE WHEN reservation.completed_at IS NULL THEN 'pending' ELSE 'completed' END,'review',review);
 END IF;
 IF EXISTS(SELECT 1 FROM public.story_transcription_requests WHERE story_id=s.id AND completed_at IS NULL) THEN
  RETURN jsonb_build_object('status','pending','review',review);
 END IF;
 IF encode(sha256(convert_to(coalesce(s.transcript,''),'UTF8')),'hex') IS DISTINCT FROM p_payload->>'source_hash'
  OR coalesce((review->'revision'->>'edit_version')::integer,0)<>p_expected_version OR p_payload->>'revision_id' IS DISTINCT FROM review->'revision'->>'id' THEN
  RAISE EXCEPTION 'Transcription source changed' USING ERRCODE='23505'; END IF;
 SELECT c.id INTO consent_id FROM public.consent_records c WHERE c.project_id=s.project_id AND c.grantor_id=p_actor_id AND c.subject_id=s.id::text
  AND c.purpose='cloud_ai' AND c.provider=p_payload->>'provider' AND c.region=p_payload->>'region' AND c.policy_version=p_payload->>'policy_version'
  AND c.granted_at<=stamp AND c.withdrawn_at IS NULL ORDER BY c.granted_at DESC LIMIT 1 FOR SHARE;
 IF consent_id IS NULL THEN
  INSERT INTO public.consent_records(project_id,grantor_id,subject_id,purpose,provider,region,policy_version)
   VALUES(s.project_id,p_actor_id,s.id::text,'cloud_ai',p_payload->>'provider',p_payload->>'region',p_payload->>'policy_version') RETURNING id INTO consent_id;
 END IF;
 INSERT INTO public.story_transcription_requests(actor_id,request_id,story_id,asset_id,revision_id,expected_version,source_hash,asset_hash,provider,model,region,policy_version,consent_id,request_sha256)
  VALUES(p_actor_id,p_request_id,s.id,asset.id,(p_payload->>'revision_id')::uuid,p_expected_version,p_payload->>'source_hash',asset_hash,
   p_payload->>'provider',p_payload->>'model',p_payload->>'region',p_payload->>'policy_version',consent_id,request_hash);
 RETURN jsonb_build_object('status','reserved','review',review);
END $$;
REVOKE ALL ON FUNCTION public.reserve_story_transcription(uuid,uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_story_transcription(uuid,uuid,uuid,integer,jsonb) TO service_role;
CREATE FUNCTION public.read_story_transcription_status(p_actor_id uuid,p_story_id uuid,p_request_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE review jsonb; pending uuid; state text; reservation public.story_transcription_requests%ROWTYPE; source_text text; current_asset public.media_assets%ROWTYPE;
BEGIN
 review:=public.story_review(p_actor_id,p_story_id,'read',NULL,NULL,'{}');
 SELECT request_id INTO pending FROM public.story_transcription_requests WHERE story_id=p_story_id AND completed_at IS NULL;
 IF p_request_id IS NOT NULL THEN
  SELECT CASE WHEN completed_at IS NULL THEN 'pending' ELSE 'completed' END INTO state FROM public.story_transcription_requests WHERE story_id=p_story_id AND actor_id=p_actor_id AND request_id=p_request_id;
  IF state='pending' THEN
   SELECT * INTO reservation FROM public.story_transcription_requests WHERE actor_id=p_actor_id AND request_id=p_request_id AND story_id=p_story_id;
   SELECT transcript INTO source_text FROM public.stories WHERE id=p_story_id;
   SELECT * INTO current_asset FROM public.media_assets WHERE id=reservation.asset_id FOR SHARE;
   IF NOT FOUND OR public.story_review_asset_hash(current_asset)<>reservation.asset_hash
    OR encode(sha256(convert_to(coalesce(source_text,''),'UTF8')),'hex')<>reservation.source_hash
    OR coalesce((review->'revision'->>'edit_version')::integer,0)<>reservation.expected_version OR review->'revision'->>'id' IS DISTINCT FROM reservation.revision_id::text THEN
    RAISE EXCEPTION 'Pending transcription source changed' USING ERRCODE='23505'; END IF;
   PERFORM 1 FROM public.consent_records c WHERE c.id=reservation.consent_id AND c.project_id=current_asset.project_id AND c.grantor_id=p_actor_id AND c.subject_id=p_story_id::text
    AND c.purpose='cloud_ai' AND c.provider=reservation.provider AND c.region=reservation.region AND c.policy_version=reservation.policy_version
    AND c.granted_at<=clock_timestamp() AND c.withdrawn_at IS NULL FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Transcription consent withdrawn' USING ERRCODE='42501'; END IF;
  END IF;
 ELSE state:=CASE WHEN pending IS NULL THEN NULL ELSE 'pending' END; END IF;
 RETURN jsonb_build_object('pendingRequestId',pending,'status',state,'review',review);
END $$;
REVOKE ALL ON FUNCTION public.read_story_transcription_status(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_story_transcription_status(uuid,uuid,uuid) TO service_role;

COMMIT;

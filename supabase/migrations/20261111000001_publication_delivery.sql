-- G3 private, immutable publication identity and bounded durable delivery leases.
BEGIN;
ALTER TABLE public.publication_snapshots ADD COLUMN source_sha256 text CHECK(source_sha256 ~ '^[a-f0-9]{64}$');
ALTER TABLE public.publication_snapshots ALTER COLUMN hosting_months DROP NOT NULL;
ALTER TABLE public.publication_snapshots ALTER COLUMN hosting_months DROP DEFAULT;
ALTER TABLE public.publication_snapshots ALTER COLUMN retention_expires_at DROP NOT NULL;
ALTER TABLE public.publication_snapshots ALTER COLUMN reminder_90d_at DROP NOT NULL;
ALTER TABLE public.publication_snapshots ALTER COLUMN reminder_30d_at DROP NOT NULL;
CREATE UNIQUE INDEX publication_source_identity ON public.publication_snapshots(project_id,source_sha256);
CREATE TABLE public.publication_delivery_jobs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,source_sha256 text NOT NULL CHECK(source_sha256 ~ '^[a-f0-9]{64}$'),
 snapshot_version integer NOT NULL CHECK(snapshot_version>0),source_subjects text[] NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','running','ready','failed','revoked')),
 attempt integer NOT NULL DEFAULT 0 CHECK(attempt BETWEEN 0 AND 5),lease_token uuid,lease_until timestamptz,
 error_code text CHECK(error_code IN('source_changed','source_unavailable','assembly_failed','lease_expired','revoked','unsupported_text')),
 byte_size bigint CHECK(byte_size BETWEEN 0 AND 2306867200),zip_sha256 text CHECK(zip_sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(project_id,source_sha256),UNIQUE(project_id,snapshot_version)
);
-- Contains no prose or paths. Deletion remains recoverable even if the worker is down.
CREATE TABLE public.publication_artifact_cleanup(job_id uuid PRIMARY KEY,requested_at timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE public.publication_delivery_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_artifact_cleanup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.publication_delivery_jobs,public.publication_artifact_cleanup FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.publication_delivery_jobs,public.publication_artifact_cleanup TO service_role;
CREATE POLICY service_read ON public.publication_delivery_jobs FOR SELECT TO service_role USING(true);
CREATE POLICY service_read ON public.publication_artifact_cleanup FOR SELECT TO service_role USING(true);
-- Full equality, including row counts, is verified at reservation and completion;
-- neither client selected revision IDs nor a self-reported digest is authority.
CREATE FUNCTION public.publication_source_identity(p_project uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET timezone='UTC' AS $$
DECLARE result jsonb;
BEGIN
 IF (SELECT count(*) FROM public.stories WHERE project_id=p_project)>2000 OR (SELECT count(*) FROM public.media_assets WHERE project_id=p_project)>5000
 OR (SELECT count(*) FROM public.transcript_versions WHERE project_id=p_project)>10000 OR (SELECT count(*) FROM public.story_revisions WHERE project_id=p_project)>10000 THEN
 RAISE EXCEPTION 'Archive source exceeds worker bounds' USING ERRCODE='54000'; END IF;
 IF EXISTS(SELECT 1 FROM (SELECT DISTINCT ON(story_id) * FROM public.story_revisions WHERE project_id=p_project AND status='approved' AND approved_at IS NOT NULL AND source_hash IS NOT NULL ORDER BY story_id,revision_number DESC) r
 WHERE r.provenance_snapshot->>'source_fingerprint' IS DISTINCT FROM public.story_review_transcript_fingerprint(r.transcript_version_id)) THEN
 RAISE EXCEPTION 'Approved publication source changed' USING ERRCODE='23505';END IF;
 SELECT jsonb_build_object('project',(SELECT jsonb_build_object('id',p.id,'name',p.name,'description',p.description,'facilitator_id',p.facilitator_id) FROM public.projects p WHERE p.id=p_project),
 'stories',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]') FROM public.stories s WHERE s.project_id=p_project),
 'assets',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.id),'[]') FROM public.media_assets m WHERE m.project_id=p_project),
 'transcripts',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]') FROM public.transcript_versions t JOIN public.stories s ON s.id=t.story_id
 WHERE t.project_id=p_project AND NOT public.story_is_deleted(s.id)),
 'revisions',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]') FROM public.story_revisions r WHERE r.project_id=p_project),
 'tombstones',(SELECT coalesce(jsonb_agg(jsonb_build_object('subject_id',d.subject_id,'tombstone_at',d.tombstone_at) ORDER BY d.subject_id),'[]') FROM public.deletion_requests d WHERE d.project_id=p_project AND d.tombstone_at IS NOT NULL)) INTO result;
 IF octet_length(result::text)>16777216 THEN RAISE EXCEPTION 'Archive metadata exceeds worker bounds' USING ERRCODE='54000'; END IF;
 RETURN result;
END $$;
CREATE FUNCTION public.publication_normalize_source(p_source jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_object('project',p_source->'project','stories',(SELECT coalesce(jsonb_agg(x ORDER BY x->>'id'),'[]') FROM jsonb_array_elements(p_source->'stories') x),
 'assets',(SELECT coalesce(jsonb_agg(x ORDER BY x->>'id'),'[]') FROM jsonb_array_elements(p_source->'assets') x),
 'transcripts',(SELECT coalesce(jsonb_agg(x ORDER BY x->>'id'),'[]') FROM jsonb_array_elements(p_source->'transcripts') x),
 'revisions',(SELECT coalesce(jsonb_agg(x ORDER BY x->>'id'),'[]') FROM jsonb_array_elements(p_source->'revisions') x),
 'tombstones',(SELECT coalesce(jsonb_agg(x ORDER BY x->>'subject_id'),'[]') FROM jsonb_array_elements(p_source->'tombstones') x))
$$;
CREATE FUNCTION public.publication_delivery(p_actor uuid,p_project uuid,p_operation text,p_job uuid DEFAULT NULL,p_payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET lock_timeout='3s' AS $$
DECLARE j public.publication_delivery_jobs%ROWTYPE; source jsonb; fingerprint text; subjects text[]; version integer; token uuid; snap jsonb;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' OR p_actor IS NULL OR p_project IS NULL THEN RAISE EXCEPTION 'Invalid publication request' USING ERRCODE='22023'; END IF;
 LOCK TABLE public.deletion_requests IN SHARE MODE;
 PERFORM pg_advisory_xact_lock(hashtextextended('publication:'||p_project::text,0));
 IF NOT (EXISTS(SELECT 1 FROM public.projects WHERE id=p_project AND facilitator_id=p_actor) OR EXISTS(SELECT 1 FROM public.project_roles WHERE project_id=p_project AND user_id=p_actor AND status='active')) THEN RAISE EXCEPTION 'Publication access denied' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.projects WHERE id=p_project AND status IS DISTINCT FROM 'deleted') OR EXISTS(SELECT 1 FROM public.deletion_requests WHERE project_id=p_project AND subject_id=p_project::text AND tombstone_at IS NOT NULL) THEN RAISE EXCEPTION 'Publication source unavailable' USING ERRCODE='23505'; END IF;
 IF p_operation='prepare' THEN
  source:=public.publication_source_identity(p_project);
  IF public.publication_normalize_source(p_payload->'source') IS DISTINCT FROM source THEN RAISE EXCEPTION 'Archive source changed' USING ERRCODE='23505'; END IF;
  fingerprint:=encode(sha256(convert_to(source::text,'UTF8')),'hex');
  SELECT array_agg(DISTINCT value) INTO subjects FROM jsonb_array_elements_text(p_payload->'subjects');
  IF subjects IS NULL OR NOT p_project::text=ANY(subjects) OR cardinality(subjects)>25000 OR EXISTS(SELECT 1 FROM public.deletion_requests d WHERE d.project_id=p_project AND d.subject_id=ANY(subjects) AND d.tombstone_at IS NOT NULL) THEN RAISE EXCEPTION 'Archive source deleted' USING ERRCODE='23505'; END IF;
  SELECT * INTO j FROM public.publication_delivery_jobs WHERE project_id=p_project AND source_sha256=fingerprint;
  IF NOT FOUND THEN
   SELECT greatest(coalesce((SELECT max(snapshot_version) FROM public.publication_delivery_jobs WHERE project_id=p_project),0),coalesce((SELECT max(snapshot_version) FROM public.publication_snapshots WHERE project_id=p_project),0))+1 INTO version;
   INSERT INTO public.publication_delivery_jobs(project_id,actor_id,source_sha256,snapshot_version,source_subjects) VALUES(p_project,p_actor,fingerprint,version,subjects) RETURNING * INTO j;
  END IF;
 ELSE
  SELECT * INTO j FROM public.publication_delivery_jobs WHERE id=p_job AND project_id=p_project FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Publication job not found' USING ERRCODE='P0002'; END IF;
  IF EXISTS(SELECT 1 FROM public.deletion_requests d WHERE d.project_id=p_project AND d.subject_id=ANY(j.source_subjects) AND d.tombstone_at IS NOT NULL) OR j.status='revoked' THEN RAISE EXCEPTION 'Publication revoked' USING ERRCODE='23505'; END IF;
  IF p_operation IN('claim','finish','validate','sync_finish') THEN
   source:=public.publication_source_identity(p_project);fingerprint:=encode(sha256(convert_to(source::text,'UTF8')),'hex');
   IF fingerprint IS DISTINCT FROM j.source_sha256 THEN RAISE EXCEPTION 'Archive source changed' USING ERRCODE='23505'; END IF;
  END IF;
  IF p_operation='claim' THEN
   IF j.status='ready' THEN RETURN to_jsonb(j)||jsonb_build_object('claimed',false);END IF;
   IF j.attempt>=5 THEN UPDATE public.publication_delivery_jobs SET status='failed',error_code='lease_expired',lease_token=NULL,lease_until=NULL WHERE id=j.id RETURNING * INTO j;RETURN to_jsonb(j)||jsonb_build_object('claimed',false);END IF;
   IF (j.status='running' AND j.lease_until>clock_timestamp()) OR j.status='ready' OR j.status='failed' THEN RETURN to_jsonb(j)||jsonb_build_object('claimed',false); END IF;
   token:=gen_random_uuid();UPDATE public.publication_delivery_jobs SET status='running',attempt=attempt+1,lease_token=token,lease_until=clock_timestamp()+interval '10 minutes',error_code=NULL,updated_at=clock_timestamp() WHERE id=j.id RETURNING * INTO j;
  ELSIF p_operation='retry' THEN
   IF j.status='failed' AND j.attempt<5 THEN UPDATE public.publication_delivery_jobs SET status='queued',error_code=NULL,updated_at=clock_timestamp() WHERE id=j.id RETURNING * INTO j; END IF;
  ELSIF p_operation IN('finish','sync_finish','fail','heartbeat') THEN
   IF p_operation<>'sync_finish' AND (j.status<>'running' OR j.lease_token IS DISTINCT FROM (p_payload->>'token')::uuid OR j.lease_until<=clock_timestamp()) THEN RAISE EXCEPTION 'Publication lease lost' USING ERRCODE='23505'; END IF;
   IF p_operation='heartbeat' THEN UPDATE public.publication_delivery_jobs SET lease_until=clock_timestamp()+interval '10 minutes',updated_at=clock_timestamp() WHERE id=j.id RETURNING * INTO j;
   ELSIF p_operation='fail' THEN UPDATE public.publication_delivery_jobs SET status='failed',error_code=CASE WHEN p_payload->>'errorCode'='unsupported_text' THEN 'unsupported_text' ELSE 'assembly_failed' END,lease_until=NULL,updated_at=clock_timestamp() WHERE id=j.id RETURNING * INTO j;
   ELSE
    snap:=p_payload->'snapshot';
    IF snap->>'snapshotId' IS DISTINCT FROM j.id::text OR (snap->>'snapshotVersion')::integer IS DISTINCT FROM j.snapshot_version OR snap->>'projectId' IS DISTINCT FROM p_project::text OR (snap->>'createdAt')::timestamptz IS DISTINCT FROM j.created_at THEN RAISE EXCEPTION 'Publication identity mismatch' USING ERRCODE='23505'; END IF;
    IF jsonb_typeof(p_payload->'stories') IS DISTINCT FROM 'array' OR
      (SELECT count(*) FROM jsonb_array_elements(p_payload->'stories'))<>(SELECT count(*) FROM public.stories s WHERE s.project_id=p_project AND s.status IS DISTINCT FROM 'deleted' AND NOT public.story_is_deleted(s.id)) OR
      (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(p_payload->'stories') x)<>jsonb_array_length(p_payload->'stories') OR EXISTS(
       SELECT 1 FROM jsonb_array_elements(p_payload->'stories') x LEFT JOIN public.stories s ON s.id::text=x->>'id' AND s.project_id=p_project
       LEFT JOIN LATERAL(SELECT rr.* FROM public.story_revisions rr WHERE rr.story_id=s.id AND rr.status='approved' AND rr.approved_at IS NOT NULL AND rr.source_hash IS NOT NULL ORDER BY rr.revision_number DESC LIMIT 1) r ON true
       LEFT JOIN public.transcript_versions t ON t.id=r.transcript_version_id
       WHERE s.id IS NULL OR public.story_is_deleted(s.id) OR s.status='deleted' OR x->>'revisionId' IS DISTINCT FROM r.id::text
       OR x->>'transcript' IS DISTINCT FROM coalesce(r.body,s.transcript) OR x->>'title' IS DISTINCT FROM coalesce(r.title,s.title)
       OR x->>'summary' IS DISTINCT FROM r.summary OR x->>'rawTranscript' IS DISTINCT FROM CASE WHEN r.id IS NULL THEN s.transcript ELSE coalesce(t.full_text,s.transcript) END
       OR (x->>'revisionVersion')::integer IS DISTINCT FROM r.revision_number
       OR x->'assertions' IS DISTINCT FROM coalesce(r.provenance_snapshot->'assertions','[]'::jsonb)
       OR (r.id IS NULL AND EXISTS(SELECT 1 FROM public.story_revisions rr WHERE rr.story_id=s.id))) THEN
      RAISE EXCEPTION 'Publication rendition is not authoritative' USING ERRCODE='23505';END IF;
    IF (SELECT coalesce(jsonb_agg(x->>'revisionId' ORDER BY x->>'revisionId'),'[]') FROM jsonb_array_elements(p_payload->'stories') x WHERE x->>'revisionId' IS NOT NULL) IS DISTINCT FROM
       (SELECT coalesce(jsonb_agg(x ORDER BY x),'[]') FROM jsonb_array_elements_text(snap->'storyRevisionIds') x) THEN
      RAISE EXCEPTION 'Publication revision identity mismatch' USING ERRCODE='23505';END IF;
    INSERT INTO public.publication_snapshots(id,project_id,snapshot_version,created_by,story_revision_ids,chapter_outline,manifest_json,pdf_sha256,source_sha256,created_at,hosting_months)
    VALUES(j.id,p_project,j.snapshot_version,j.actor_id,ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(snap->'storyRevisionIds')),snap->'chapters',
     jsonb_build_object('snapshot',snap,'media',p_payload->'manifest','stories',p_payload->'stories','sourceSubjects',to_jsonb(j.source_subjects)),snap->>'pdfSha256',j.source_sha256,j.created_at,NULL) ON CONFLICT(id) DO NOTHING;
    IF (SELECT pdf_sha256 FROM public.publication_snapshots WHERE id=j.id) IS DISTINCT FROM snap->>'pdfSha256' THEN RAISE EXCEPTION 'Frozen publication renderer changed' USING ERRCODE='23505';END IF;
    IF p_operation<>'sync_finish' THEN UPDATE public.publication_delivery_jobs SET status='ready',byte_size=(p_payload->>'byteSize')::bigint,zip_sha256=p_payload->>'zipSha256',lease_until=NULL,updated_at=clock_timestamp() WHERE id=j.id RETURNING * INTO j; END IF;
   END IF;
  ELSIF p_operation NOT IN('status','validate') THEN RAISE EXCEPTION 'Invalid publication operation' USING ERRCODE='22023'; END IF;
 END IF;
 RETURN to_jsonb(j)||jsonb_build_object('claimed',p_operation='claim');
END $$;
-- Revocation takes effect in the tombstone transaction. Artifact cleanup is
-- durably retried by the same external worker, including backup/restore replay.
CREATE FUNCTION public.revoke_publication_delivery() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF NEW.tombstone_at IS NOT NULL THEN
  INSERT INTO public.publication_artifact_cleanup(job_id) SELECT id FROM public.publication_delivery_jobs WHERE project_id=NEW.project_id AND NEW.subject_id=ANY(source_subjects) ON CONFLICT DO NOTHING;
  UPDATE public.publication_delivery_jobs SET status='revoked',lease_token=NULL,lease_until=NULL,error_code='revoked',updated_at=clock_timestamp() WHERE project_id=NEW.project_id AND NEW.subject_id=ANY(source_subjects);
  DELETE FROM public.publication_snapshots WHERE project_id=NEW.project_id AND manifest_json->'sourceSubjects' ? NEW.subject_id;
  DELETE FROM public.publication_delivery_jobs WHERE project_id=NEW.project_id AND NEW.subject_id=ANY(source_subjects);
 END IF;RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.prevent_publication_snapshot_mutation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF TG_OP='DELETE' AND (EXISTS(SELECT 1 FROM public.story_deletion_fences f JOIN public.story_deletion_context c USING(story_id) WHERE c.transaction_id=txid_current() AND f.entity_table='publication_snapshots' AND f.entity_id=OLD.id)
 OR EXISTS(SELECT 1 FROM public.deletion_requests d WHERE d.project_id=OLD.project_id AND d.tombstone_at IS NOT NULL AND OLD.manifest_json->'sourceSubjects' ? d.subject_id)) THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'Published snapshots are immutable outside erasure' USING ERRCODE='23514';
END $$;
CREATE FUNCTION public.queue_removed_publication_artifact() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN INSERT INTO public.publication_artifact_cleanup(job_id) VALUES(OLD.id) ON CONFLICT DO NOTHING;IF TG_TABLE_NAME='publication_snapshots' THEN DELETE FROM public.publication_delivery_jobs WHERE id=OLD.id;END IF;RETURN OLD;END $$;
CREATE TRIGGER publication_job_removed AFTER DELETE ON public.publication_delivery_jobs FOR EACH ROW EXECUTE FUNCTION public.queue_removed_publication_artifact();
CREATE TRIGGER publication_removed AFTER DELETE ON public.publication_snapshots FOR EACH ROW EXECUTE FUNCTION public.queue_removed_publication_artifact();
CREATE TRIGGER publication_revoked AFTER INSERT OR UPDATE ON public.deletion_requests FOR EACH ROW EXECUTE FUNCTION public.revoke_publication_delivery();
CREATE FUNCTION public.complete_publication_cleanup(p_job uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ DELETE FROM public.publication_artifact_cleanup WHERE job_id=p_job $$;
REVOKE ALL ON FUNCTION public.publication_source_identity(uuid),public.publication_normalize_source(jsonb),public.publication_delivery(uuid,uuid,text,uuid,jsonb),public.revoke_publication_delivery(),public.queue_removed_publication_artifact(),public.complete_publication_cleanup(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.publication_delivery(uuid,uuid,text,uuid,jsonb),public.complete_publication_cleanup(uuid) TO service_role;
CREATE FUNCTION public.invalidate_publication_job(p_job uuid,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF p_reason NOT IN('revoked','source_changed') THEN RAISE EXCEPTION 'Invalid invalidation' USING ERRCODE='22023';END IF;
 UPDATE public.publication_delivery_jobs SET status=CASE WHEN p_reason='revoked' THEN 'revoked' ELSE 'failed' END,error_code=p_reason,lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=p_job;
 INSERT INTO public.publication_artifact_cleanup(job_id) VALUES(p_job) ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.invalidate_publication_job(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.invalidate_publication_job(uuid,text) TO service_role;
COMMIT;

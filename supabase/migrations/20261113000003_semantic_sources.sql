-- Shared current-authority projection, with an explicit whole-corpus branch.
-- No durable vector or source-text copy; literal callers retain their 50-result contract.
-- Approved supported AI paraphrases point back to their exact source_quote; they
-- must never be displayed as verbatim original audio themselves.
CREATE FUNCTION public.project_source_projection_v2(
 p_actor_id uuid,p_project_id uuid,p_query text DEFAULT '',p_person text DEFAULT '',p_year text DEFAULT '',p_place text DEFAULT '',
 p_story_id uuid DEFAULT NULL,p_entry_id text DEFAULT NULL,p_semantic boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='UTC' SET lock_timeout='2s' AS $$
DECLARE p public.projects%ROWTYPE; role_row public.project_roles%ROWTYPE; s public.stories%ROWTYPE;
 t public.transcript_versions%ROWTYPE; r public.story_revisions%ROWTYPE; m public.media_assets%ROWTYPE;
 story_ids uuid[]; sid uuid; tokens text[]; needle text; source_hash text; fingerprint text; row_data record;
 segment_count integer; total_segments integer:=0; total_bytes bigint:=0; start_offset integer; found_at integer;
 excerpt text; entries jsonb:='[]'; has_more boolean:=false; is_approved boolean;
BEGIN
 IF p_actor_id IS NULL OR p_project_id IS NULL OR p_query IS NULL OR p_person IS NULL OR p_year IS NULL OR p_place IS NULL
  OR length(p_query)>240 OR length(p_person)>80 OR length(p_year)>4 OR length(p_place)>80
  OR (p_query||p_person||p_year||p_place) ~ '[[:cntrl:]]'
  OR (p_year<>'' AND p_year !~ '^[0-9]{4}$') OR (btrim(p_query||p_person||p_year||p_place)='' AND p_story_id IS NULL AND NOT p_semantic)
  OR (p_story_id IS NULL)<>(p_entry_id IS NULL)
  OR current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'Invalid search input' USING ERRCODE='22023'; END IF;
 tokens:=array_remove(regexp_split_to_array(lower(btrim(p_query)),'[[:space:]]+'),'');
 IF cardinality(tokens)>16 THEN RAISE EXCEPTION 'Too many search words' USING ERRCODE='22023'; END IF;
 -- G1 deletion capture takes ROW EXCLUSIVE on this ledger. Keep the fence until
 -- the result is materialized; roles and project ownership are pinned too.
 LOCK TABLE public.deletion_requests IN SHARE MODE;
 SELECT * INTO p FROM public.projects WHERE id=p_project_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Search access denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO role_row FROM public.project_roles WHERE project_id=p_project_id AND user_id=p_actor_id FOR SHARE;
 IF NOT coalesce(p.facilitator_id=p_actor_id OR p.owner_id=p_actor_id OR role_row.status='active',false) THEN
  RAISE EXCEPTION 'Search access denied' USING ERRCODE='42501'; END IF;
 IF p.status='deleted' OR EXISTS(SELECT 1 FROM public.deletion_requests d WHERE d.project_id=p.id AND d.subject_id=p.id::text AND d.tombstone_at IS NOT NULL) THEN
  RETURN jsonb_build_object('entries','[]'::jsonb,'hasMore',false); END IF;
 SELECT array_agg(q.id ORDER BY q.id) INTO story_ids FROM (SELECT id FROM public.stories WHERE project_id=p.id AND status<>'deleted' AND (p_story_id IS NULL OR id=p_story_id) ORDER BY id LIMIT 201) q;
 IF cardinality(story_ids)>200 THEN RAISE EXCEPTION 'Search archive work limit' USING ERRCODE='54000'; END IF;
 FOREACH sid IN ARRAY coalesce(story_ids,'{}'::uuid[]) LOOP
  SELECT * INTO s FROM public.stories WHERE id=sid AND project_id=p.id FOR SHARE;
  IF s.status='deleted' OR EXISTS(SELECT 1 FROM public.deletion_requests d WHERE d.project_id=p.id AND d.subject_id=s.id::text AND d.tombstone_at IS NOT NULL) THEN CONTINUE; END IF;
  IF (SELECT count(*) FROM (SELECT id FROM public.transcript_versions WHERE story_id=s.id AND is_current LIMIT 2) q)<>1 THEN CONTINUE; END IF;
  SELECT * INTO t FROM public.transcript_versions WHERE story_id=s.id AND is_current FOR SHARE;
  IF t.project_id<>p.id OR t.full_text IS DISTINCT FROM s.transcript THEN CONTINUE; END IF;
  SELECT * INTO m FROM public.media_assets WHERE id=t.asset_id FOR SHARE;
  IF NOT FOUND OR m.project_id<>p.id OR m.story_id IS DISTINCT FROM s.id OR m.state<>'ready' OR m.kind NOT IN ('original_audio','derived_audio') THEN CONTINUE; END IF;
  IF EXISTS(SELECT 1 FROM public.deletion_requests d WHERE d.project_id=p.id AND d.tombstone_at IS NOT NULL AND (
    d.subject_id=m.id::text OR d.subject_id IN (SELECT c.session_id::text FROM public.recording_output_candidates c WHERE c.asset_id=m.id)
    OR d.subject_id IN (SELECT i.session_id::text FROM public.recording_story_intents i WHERE i.story_id=s.id)
    OR d.subject_id IN (SELECT rs.id::text FROM public.recording_sessions rs WHERE rs.project_id=p.id AND (rs.story_id=s.id OR rs.confirmed_asset_id=m.id)))) THEN CONTINUE; END IF;
  -- Published recording output must still be the exact finalized candidate.
  IF m.bucket='recording-candidates' AND NOT EXISTS(SELECT 1 FROM public.recording_output_candidates c JOIN public.recording_sessions rs ON rs.id=c.session_id
   WHERE c.asset_id=m.id AND c.project_id=p.id AND c.state='prepared' AND c.bucket=m.bucket AND c.object_key=m.object_key
    AND c.sha256=m.sha256 AND c.byte_size=m.byte_size AND c.mime_type=m.mime_type AND c.duration_ms=m.duration_ms AND rs.project_id=p.id AND rs.state='cloud_confirmed' AND rs.confirmed_asset_id=m.id) THEN CONTINUE; END IF;
  SELECT count(*) INTO segment_count FROM (SELECT id FROM public.transcript_segments WHERE transcript_version_id=t.id LIMIT 2001) q;
  total_segments:=total_segments+segment_count;total_bytes:=total_bytes+octet_length(t.full_text);
  IF segment_count>2000 OR total_segments>10000 OR length(t.full_text)>100000 OR total_bytes>2000000 THEN RAISE EXCEPTION 'Search archive work limit' USING ERRCODE='54000'; END IF;
  IF segment_count=0 THEN CONTINUE; END IF;
  PERFORM 1 FROM public.transcript_segments WHERE transcript_version_id=t.id FOR SHARE;
  IF EXISTS(SELECT 1 FROM public.transcript_segments seg WHERE seg.transcript_version_id=t.id AND seg.project_id<>p.id)
   OR regexp_replace(btrim(t.full_text),'[[:space:]]+',' ','g') IS DISTINCT FROM (SELECT regexp_replace(btrim(string_agg(seg.text,' ' ORDER BY seg.segment_index)),'[[:space:]]+',' ','g') FROM public.transcript_segments seg WHERE seg.transcript_version_id=t.id) THEN CONTINUE; END IF;
  source_hash:=encode(sha256(convert_to(t.full_text,'UTF8')),'hex');
  fingerprint:=public.story_review_transcript_fingerprint(t.id);
  SELECT * INTO r FROM public.story_revisions WHERE story_id=s.id ORDER BY revision_number DESC LIMIT 1 FOR SHARE;
  IF r.id IS NOT NULL AND (r.project_id<>p.id OR r.transcript_version_id<>t.id OR r.source_hash IS DISTINCT FROM source_hash
    OR r.provenance_snapshot->>'source_fingerprint' IS DISTINCT FROM fingerprint OR r.status NOT IN ('draft','approved')) THEN CONTINUE; END IF;
  IF r.id IS NULL AND t.content_sha256<>source_hash THEN CONTINUE; END IF;
  is_approved:=coalesce(r.status='approved' AND r.approved_at IS NOT NULL AND r.approved_by IS NOT NULL,false);
  IF is_approved THEN
   total_bytes:=total_bytes+octet_length(r.body);
   IF total_bytes>4000000 OR (SELECT count(*) FROM (SELECT id FROM public.story_assertions WHERE revision_id=r.id LIMIT 2001) q)>2000
      OR EXISTS(SELECT 1 FROM public.story_assertions a WHERE a.revision_id=r.id AND (jsonb_array_length(a.alternatives)>128 OR octet_length(a.alternatives::text)>200000)) THEN RAISE EXCEPTION 'Search archive work limit' USING ERRCODE='54000'; END IF;
   -- A citation can only inherit approval from a revision with exact source links.
   IF EXISTS(SELECT 1 FROM public.story_assertions a WHERE a.revision_id=r.id AND (
      a.project_id<>p.id OR a.story_id<>s.id OR a.transcript_version_id<>t.id OR a.reviewed_by IS NULL
      OR a.review_decision NOT IN ('accepted','modified','disputed','rejected') OR a.verification_status='invalidated'
      OR (a.is_severe_fabrication AND a.review_decision<>'rejected')
      OR (a.review_decision='modified' AND a.memory_attribution<>'family_supplement')
      OR (a.review_decision<>'rejected' AND a.memory_attribution<>'family_supplement' AND NOT EXISTS(
        SELECT 1 FROM public.transcript_segments seg WHERE seg.id=a.segment_id AND seg.transcript_version_id=t.id AND seg.project_id=p.id
         AND (a.claim_text=seg.text OR public.story_ai_claim_supported(a)) AND a.source_quote=seg.text AND a.start_ms IS NOT DISTINCT FROM seg.start_ms AND a.end_ms IS NOT DISTINCT FROM seg.end_ms)))) THEN CONTINUE; END IF;
  END IF;
  FOR row_data IN
   SELECT 'segment:'||seg.id::text entry_id,seg.id segment_id,seg.text text,
    CASE WHEN t.alignment_status='human_corrected' OR seg.is_human_corrected THEN 'family_supplement' ELSE 'original_transcript' END source_kind,
    CASE WHEN t.alignment_status='aligned' AND NOT seg.is_human_corrected AND seg.end_ms>seg.start_ms AND seg.end_ms<=coalesce(m.duration_ms,7200000) THEN seg.start_ms END start_ms,
    CASE WHEN t.alignment_status='aligned' AND NOT seg.is_human_corrected AND seg.end_ms>seg.start_ms AND seg.end_ms<=coalesce(m.duration_ms,7200000) THEN seg.end_ms END end_ms,
    CASE WHEN t.alignment_status='human_corrected' OR seg.is_human_corrected THEN t.created_by::text END attributed_to
   FROM public.transcript_segments seg WHERE seg.transcript_version_id=t.id AND NOT is_approved
   UNION ALL
   SELECT 'assertion:'||a.id::text,a.segment_id,CASE WHEN a.memory_attribution='family_supplement' THEN a.claim_text WHEN public.story_ai_claim_supported(a) THEN a.source_quote ELSE a.claim_text END,
    CASE WHEN a.memory_attribution='family_supplement' THEN 'family_supplement' WHEN a.review_decision='disputed' THEN 'disputed_memory' ELSE 'original_transcript' END,
    CASE WHEN a.review_decision='accepted' AND a.memory_attribution<>'family_supplement' AND t.alignment_status='aligned' AND NOT seg.is_human_corrected AND seg.end_ms>seg.start_ms AND seg.end_ms<=coalesce(m.duration_ms,7200000) THEN seg.start_ms END,
    CASE WHEN a.review_decision='accepted' AND a.memory_attribution<>'family_supplement' AND t.alignment_status='aligned' AND NOT seg.is_human_corrected AND seg.end_ms>seg.start_ms AND seg.end_ms<=coalesce(m.duration_ms,7200000) THEN seg.end_ms END,
    CASE WHEN a.memory_attribution='family_supplement' THEN a.supplemented_by::text END
   FROM public.story_assertions a LEFT JOIN public.transcript_segments seg ON seg.id=a.segment_id AND seg.transcript_version_id=t.id
   WHERE is_approved AND a.revision_id=r.id AND a.review_decision IN ('accepted','modified','disputed')
   UNION ALL
   SELECT 'alternative:'||a.id::text||':'||alt.n::text,NULL::uuid,alt.value->>'text','dispute_alternative',NULL::integer,NULL::integer,alt.value->>'actor_id'
   FROM public.story_assertions a CROSS JOIN LATERAL jsonb_array_elements(a.alternatives) WITH ORDINALITY alt(value,n)
   WHERE is_approved AND a.revision_id=r.id AND a.review_decision='disputed'
   ORDER BY entry_id
  LOOP
   IF p_entry_id IS NOT NULL AND row_data.entry_id<>p_entry_id THEN CONTINUE; END IF;
   IF row_data.text IS NULL OR EXISTS(SELECT 1 FROM unnest(tokens) q(word) WHERE strpos(lower(row_data.text),q.word)=0)
    OR (p_person<>'' AND strpos(lower(row_data.text),lower(btrim(p_person)))=0)
    OR (p_year<>'' AND strpos(row_data.text,p_year)=0)
    OR (p_place<>'' AND strpos(lower(row_data.text),lower(btrim(p_place)))=0) THEN CONTINUE; END IF;
   -- Byte-independent offsets identify the literal substring within the source field.
   found_at:=length(row_data.text)+1;
   FOREACH needle IN ARRAY tokens||ARRAY[lower(btrim(p_person)),p_year,lower(btrim(p_place))] LOOP
    IF needle<>'' AND strpos(lower(row_data.text),needle)>0 THEN found_at:=least(found_at,strpos(lower(row_data.text),needle)); END IF;
   END LOOP;
   IF p_semantic THEN
    IF length(row_data.text)>1200 OR jsonb_array_length(entries)>=256 OR
     (SELECT coalesce(sum(octet_length(e->>'quotedText')),0) FROM jsonb_array_elements(entries) e)+octet_length(row_data.text)>65536 THEN
     RAISE EXCEPTION 'Semantic archive exceeds 256 sources, 1200 characters per source or 64 KiB total' USING ERRCODE='54000'; END IF;
    start_offset:=0;excerpt:=row_data.text;
   ELSE start_offset:=greatest(0,found_at-161);excerpt:=substring(row_data.text FROM start_offset+1 FOR 1200); END IF;
   IF NOT p_semantic AND jsonb_array_length(entries)=50 THEN has_more:=true; CONTINUE; END IF;
   entries:=entries||jsonb_build_array(jsonb_build_object('entryId',row_data.entry_id,'projectId',p.id,'storyId',s.id,'storyTitle',left(coalesce(nullif(s.title,''),'Untitled story'),500),
    'transcriptVersionId',t.id,'storyRevisionId',CASE WHEN is_approved THEN r.id END,'segmentId',row_data.segment_id,
    'mediaAssetId',CASE WHEN row_data.source_kind='original_transcript' AND row_data.start_ms IS NOT NULL THEN m.id END,
    'startMs',row_data.start_ms,'endMs',row_data.end_ms,'quotedText',excerpt,'excerptStart',start_offset,'excerptEnd',start_offset+length(excerpt),
    'sourceKind',row_data.source_kind,'reviewStatus',CASE WHEN is_approved THEN 'approved' ELSE 'source_only' END,
    'sourceHash',source_hash,'sourceFingerprint',fingerprint,'attributedTo',row_data.attributed_to));
  END LOOP;
 END LOOP;
 RETURN jsonb_build_object('entries',entries,'hasMore',has_more);
END $$;
REVOKE ALL ON FUNCTION public.project_source_projection_v2(uuid,uuid,text,text,text,text,uuid,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.project_source_search_projection(
 p_actor_id uuid,p_project_id uuid,p_query text DEFAULT '',p_person text DEFAULT '',p_year text DEFAULT '',p_place text DEFAULT '',
 p_story_id uuid DEFAULT NULL,p_entry_id text DEFAULT NULL
) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' SET timezone='UTC' AS $$
 SELECT public.project_source_projection_v2(p_actor_id,p_project_id,p_query,p_person,p_year,p_place,p_story_id,p_entry_id,false)
$$;

-- Each call renews the current permission/deletion/source and consent fence.
-- Only the initial explicit POST may grant consent. Later calls must find that grant active.
CREATE FUNCTION public.semantic_source_snapshot(p_actor_id uuid,p_project_id uuid,p_policy text,p_region text,p_grant boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='UTC' SET lock_timeout='2s' AS $$
DECLARE result jsonb; consent_id uuid;
BEGIN
 IF p_policy IS NULL OR p_policy !~ '^[a-f0-9]{64}$' OR p_region IS NULL OR p_region NOT IN ('us','eu') OR p_grant IS NULL THEN
  RAISE EXCEPTION 'Invalid semantic policy' USING ERRCODE='22023'; END IF;
 result:=public.project_source_projection_v2(p_actor_id,p_project_id,'','','','',NULL,NULL,true);
 IF EXISTS(SELECT 1 FROM public.projects WHERE id=p_project_id AND status='deleted') OR
  EXISTS(SELECT 1 FROM public.deletion_requests WHERE project_id=p_project_id AND subject_id=p_project_id::text AND tombstone_at IS NOT NULL) THEN
  RAISE EXCEPTION 'Project deleted' USING ERRCODE='42501'; END IF;
 -- Serialize consent writes with withdrawal and recheck on every outbound/result boundary.
 LOCK TABLE public.consent_records IN SHARE ROW EXCLUSIVE MODE;
 SELECT id INTO consent_id FROM public.consent_records WHERE project_id=p_project_id AND grantor_id=p_actor_id
  AND subject_id=p_project_id::text AND purpose='cloud_ai' AND provider='voyage' AND region=p_region AND policy_version=p_policy
  AND withdrawn_at IS NULL AND granted_at<=now() ORDER BY granted_at DESC LIMIT 1 FOR SHARE;
 IF consent_id IS NULL THEN
  IF NOT p_grant THEN RAISE EXCEPTION 'Semantic consent required' USING ERRCODE='42501'; END IF;
  INSERT INTO public.consent_records(project_id,grantor_id,subject_id,purpose,policy_version,provider,region)
   VALUES(p_project_id,p_actor_id,p_project_id::text,'cloud_ai',p_policy,'voyage',p_region) RETURNING id INTO consent_id;
 END IF;
 RETURN result||jsonb_build_object('consentId',consent_id);
END $$;
REVOKE ALL ON FUNCTION public.semantic_source_snapshot(uuid,uuid,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.semantic_source_snapshot(uuid,uuid,text,text,boolean) TO service_role;

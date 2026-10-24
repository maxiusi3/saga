-- ISOLATED REHEARSAL ONLY. This is deliberately outside supabase/migrations.
-- Missing production Storage configuration, lifecycle adapters and rollback
-- evidence prohibit treating this candidate as a deployable migration.
BEGIN;
DO $$
BEGIN
  IF current_database() <> 'saga_rls_rehearsal'
     OR current_setting('listen_addresses') <> ''
     OR current_setting('saga.rls_rehearsal', true) IS DISTINCT FROM 'only_synthetic_local' THEN
    RAISE EXCEPTION 'Local synthetic rehearsal required' USING ERRCODE='42501';
  END IF;
END;
$$;

CREATE SCHEMA IF NOT EXISTS saga_rls_guard;
REVOKE ALL ON SCHEMA saga_rls_guard FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA saga_rls_guard TO anon, authenticated;

-- This deliberately narrow helper reads membership without re-entering its RLS
-- policies. The actor always comes from the trusted authentication context.
CREATE OR REPLACE FUNCTION saga_rls_guard.project_allowed(target uuid, action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT auth.role() = 'authenticated' AND auth.uid() IS NOT NULL AND
    action IN ('read','record','manage') AND EXISTS (
      SELECT 1 FROM public.projects p WHERE p.id=target AND (
        (p.facilitator_id=auth.uid() AND action IN ('read','manage')) OR EXISTS (
          SELECT 1 FROM public.project_roles pr
          WHERE pr.project_id=p.id AND pr.user_id=auth.uid() AND pr.status='active'
            AND ((pr.role='facilitator' AND action IN ('read','manage'))
              OR (pr.role='storyteller' AND action IN ('read','record')))
        )
      )
    )
$$;

CREATE OR REPLACE FUNCTION saga_rls_guard.object_readable(target_bucket text, object_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  parts text[];
  target_project uuid;
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' OR auth.uid() IS NULL
     OR target_bucket IS NULL OR target_bucket NOT IN ('saga','audio-recordings')
     OR object_key IS NULL OR object_key=''
     OR object_key<>btrim(object_key, E' \t\n\r\f' || chr(11) || chr(160) || chr(5760)
       || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196) || chr(8197)
       || chr(8198) || chr(8199) || chr(8200) || chr(8201) || chr(8202)
       || chr(8232) || chr(8233) || chr(8239) || chr(8287) || chr(12288) || chr(65279))
     OR object_key ~ '[%?#:]' OR strpos(object_key,chr(92))>0 THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM regexp_split_to_table(object_key,'') AS t(ch)
             WHERE ascii(ch)<32 OR ascii(ch) BETWEEN 127 AND 159) THEN RETURN false; END IF;
  parts := string_to_array(object_key,'/');
  IF cardinality(parts)<2 OR parts[1] !~ uuid_pattern
     OR EXISTS (SELECT 1 FROM unnest(parts) AS t(part) WHERE part IN ('','.','..'))
     OR array_position(parts[3:cardinality(parts)],'projects') IS NOT NULL THEN RETURN false; END IF;
  IF parts[2]='projects' THEN
    IF cardinality(parts)<4 OR parts[3] !~ uuid_pattern THEN RETURN false; END IF;
    target_project := parts[3]::uuid;
  ELSIF parts[2]='images' AND parts[3] IN ('stories','interactions') THEN
    IF cardinality(parts)<5 OR parts[4] !~ uuid_pattern THEN RETURN false; END IF;
    SELECT s.project_id INTO target_project FROM public.stories s WHERE s.id=parts[4]::uuid;
    IF target_project IS NULL THEN RETURN false; END IF;
  ELSE
    RETURN parts[1]=auth.uid()::text;
  END IF;
  RETURN saga_rls_guard.project_allowed(target_project,'read');
END;
$$;

CREATE OR REPLACE FUNCTION saga_rls_guard.object_insertable(target_bucket text, object_key text, object_owner uuid, object_owner_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT saga_rls_guard.object_readable(target_bucket,object_key)
    AND split_part(object_key,'/',1)=auth.uid()::text
    AND (object_owner IS NULL OR object_owner=auth.uid())
    AND (object_owner_id IS NULL OR object_owner_id=auth.uid()::text)
$$;

CREATE OR REPLACE FUNCTION saga_rls_guard.story_writable(target_project uuid, storyteller uuid, author uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT storyteller=auth.uid() AND (author IS NULL OR author=auth.uid())
    AND saga_rls_guard.project_allowed(target_project,'record')
$$;

CREATE OR REPLACE FUNCTION saga_rls_guard.keep_story_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF (NEW.id,NEW.project_id,NEW.storyteller_id,NEW.user_id)
     IS DISTINCT FROM (OLD.id,OLD.project_id,OLD.storyteller_id,OLD.user_id) THEN
    RAISE EXCEPTION 'Story identity is immutable' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA saga_rls_guard FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION saga_rls_guard.project_allowed(uuid,text),
  saga_rls_guard.object_readable(text,text), saga_rls_guard.object_insertable(text,text,uuid,text),
  saga_rls_guard.story_writable(uuid,uuid,uuid) TO anon, authenticated;
DROP TRIGGER IF EXISTS saga_keep_story_identity ON public.stories;
CREATE TRIGGER saga_keep_story_identity BEFORE UPDATE ON public.stories
  FOR EACH ROW EXECUTE FUNCTION saga_rls_guard.keep_story_identity();

-- Replace the cyclic SELECT graph, preserving the existing management policies.
DROP POLICY IF EXISTS projects_select ON public.projects;
DROP POLICY IF EXISTS projects_select_members ON public.projects;
DROP POLICY IF EXISTS saga_allow_project_read ON public.projects;
DROP POLICY IF EXISTS saga_guard_project_read ON public.projects;
CREATE POLICY saga_allow_project_read ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY saga_guard_project_read ON public.projects AS RESTRICTIVE FOR SELECT TO PUBLIC
  USING (saga_rls_guard.project_allowed(projects.id,'read'));

DROP POLICY IF EXISTS project_roles_select ON public.project_roles;
DROP POLICY IF EXISTS project_roles_select_self ON public.project_roles;
DROP POLICY IF EXISTS saga_allow_role_read ON public.project_roles;
DROP POLICY IF EXISTS saga_guard_role_read ON public.project_roles;
CREATE POLICY saga_allow_role_read ON public.project_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY saga_guard_role_read ON public.project_roles AS RESTRICTIVE FOR SELECT TO PUBLIC
  USING (auth.role()='authenticated' AND auth.uid() IS NOT NULL
    AND (project_roles.user_id=auth.uid() OR saga_rls_guard.project_allowed(project_roles.project_id,'manage')));

-- Remove known obsolete Storage rules, not arbitrary policies on other buckets.
DROP POLICY IF EXISTS "Allow authenticated users to upload audio jf5dkp_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to audio jf5dkp_0" ON storage.objects;
DROP POLICY IF EXISTS "Project facilitators can delete project files" ON storage.objects;
DROP POLICY IF EXISTS "Project facilitators can update project files" ON storage.objects;
DROP POLICY IF EXISTS "Project facilitators can upload project files" ON storage.objects;
DROP POLICY IF EXISTS "Project members can view project files" ON storage.objects;
DROP POLICY IF EXISTS "Storytellers can upload story files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload files to their own folders" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS saga_allow_object_read ON storage.objects;
DROP POLICY IF EXISTS saga_allow_object_insert ON storage.objects;
DROP POLICY IF EXISTS saga_guard_object_read ON storage.objects;
DROP POLICY IF EXISTS saga_guard_object_insert ON storage.objects;
DROP POLICY IF EXISTS saga_guard_object_update ON storage.objects;
DROP POLICY IF EXISTS saga_guard_object_delete ON storage.objects;
CREATE POLICY saga_allow_object_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('saga','audio-recordings'));
CREATE POLICY saga_allow_object_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('saga','audio-recordings'));
CREATE POLICY saga_guard_object_read ON storage.objects AS RESTRICTIVE FOR SELECT TO PUBLIC
  USING (bucket_id NOT IN ('saga','audio-recordings') OR saga_rls_guard.object_readable(bucket_id,storage.objects.name));
CREATE POLICY saga_guard_object_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO PUBLIC
  WITH CHECK (bucket_id NOT IN ('saga','audio-recordings') OR saga_rls_guard.object_insertable(bucket_id,storage.objects.name,owner,owner_id));
CREATE POLICY saga_guard_object_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO PUBLIC
  USING (bucket_id NOT IN ('saga','audio-recordings')) WITH CHECK (bucket_id NOT IN ('saga','audio-recordings'));
CREATE POLICY saga_guard_object_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO PUBLIC
  USING (bucket_id NOT IN ('saga','audio-recordings'));

-- Every permissive story branch is bounded by a command-specific restrictive gate.
DROP POLICY IF EXISTS stories_select ON public.stories;
DROP POLICY IF EXISTS stories_select_members ON public.stories;
DROP POLICY IF EXISTS stories_insert ON public.stories;
DROP POLICY IF EXISTS stories_insert_members ON public.stories;
DROP POLICY IF EXISTS stories_update ON public.stories;
DROP POLICY IF EXISTS stories_delete ON public.stories;
DROP POLICY IF EXISTS saga_allow_story_read ON public.stories;
DROP POLICY IF EXISTS saga_allow_story_insert ON public.stories;
DROP POLICY IF EXISTS saga_allow_story_update ON public.stories;
DROP POLICY IF EXISTS saga_guard_story_read ON public.stories;
DROP POLICY IF EXISTS saga_guard_story_insert ON public.stories;
DROP POLICY IF EXISTS saga_guard_story_update ON public.stories;
DROP POLICY IF EXISTS saga_guard_story_delete ON public.stories;
CREATE POLICY saga_allow_story_read ON public.stories FOR SELECT TO authenticated USING (true);
CREATE POLICY saga_allow_story_insert ON public.stories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY saga_allow_story_update ON public.stories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY saga_guard_story_read ON public.stories AS RESTRICTIVE FOR SELECT TO PUBLIC
  USING (saga_rls_guard.project_allowed(stories.project_id,'read'));
CREATE POLICY saga_guard_story_insert ON public.stories AS RESTRICTIVE FOR INSERT TO PUBLIC
  WITH CHECK (saga_rls_guard.story_writable(stories.project_id,storyteller_id,user_id));
CREATE POLICY saga_guard_story_update ON public.stories AS RESTRICTIVE FOR UPDATE TO PUBLIC
  USING (saga_rls_guard.story_writable(stories.project_id,storyteller_id,user_id))
  WITH CHECK (saga_rls_guard.story_writable(stories.project_id,storyteller_id,user_id));
CREATE POLICY saga_guard_story_delete ON public.stories AS RESTRICTIVE FOR DELETE TO PUBLIC USING (false);
COMMIT;

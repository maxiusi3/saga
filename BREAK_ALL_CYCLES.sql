-- BREAK ALL CYCLES: Completely eliminate circular dependencies
-- Strategy: Use only direct, non-recursive checks

BEGIN;

-- ============================================
-- 1. projects - Only check direct ownership and roles
-- ============================================

DROP POLICY IF EXISTS "projects_select" ON projects;

CREATE POLICY "projects_select" ON projects
  FOR SELECT
  USING (
    -- User is the facilitator/owner (direct check)
    auth.uid() = facilitator_id OR
    -- User has an active role in the project (direct check, no further recursion)
    EXISTS (
      SELECT 1 FROM project_roles pr
      WHERE pr.project_id = projects.id
        AND pr.user_id = auth.uid()
        AND pr.status = 'active'
    )
    -- REMOVED: project_members check to break cycle
  );

-- ============================================
-- 2. project_roles - Only check project ownership
-- ============================================

DROP POLICY IF EXISTS "project_roles_select" ON project_roles;

CREATE POLICY "project_roles_select" ON project_roles
  FOR SELECT
  USING (
    -- User is viewing their own role (direct check)
    auth.uid() = user_id OR
    -- User is the project facilitator (direct check, no recursion)
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_roles.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

-- ============================================
-- 3. project_members - Only check project ownership
-- ============================================

DROP POLICY IF EXISTS "project_members_select" ON project_members;

CREATE POLICY "project_members_select" ON project_members
  FOR SELECT
  USING (
    -- User is viewing their own membership (direct check)
    auth.uid() = user_id OR
    -- User is the project facilitator (direct check, no recursion)
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

-- ============================================
-- 4. stories - Simplified to avoid all cycles
-- ============================================

DROP POLICY IF EXISTS "stories_select" ON stories;

CREATE POLICY "stories_select" ON stories
  FOR SELECT
  USING (
    -- User is the storyteller (direct check)
    auth.uid() = storyteller_id OR
    -- User is the project facilitator (direct check)
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = stories.project_id
        AND p.facilitator_id = auth.uid()
    ) OR
    -- User has an active role (direct check)
    EXISTS (
      SELECT 1 FROM project_roles pr
      WHERE pr.project_id = stories.project_id
        AND pr.user_id = auth.uid()
        AND pr.status = 'active'
    )
    -- REMOVED: project_members check to avoid potential cycles
  );

-- ============================================
-- 5. Fix user_settings 400 error
-- ============================================

-- Check if user_settings table exists and has correct structure
DO $$
BEGIN
  -- Ensure the table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_settings') THEN
    RAISE NOTICE 'user_settings table does not exist!';
  END IF;
  
  -- Check if user_id column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_settings' AND column_name = 'user_id'
  ) THEN
    RAISE NOTICE 'user_settings.user_id column does not exist!';
  END IF;
END $$;

-- Recreate user_settings policies with proper checks
DROP POLICY IF EXISTS "user_settings_select" ON user_settings;
DROP POLICY IF EXISTS "user_settings_insert" ON user_settings;
DROP POLICY IF EXISTS "user_settings_update" ON user_settings;
DROP POLICY IF EXISTS "user_settings_delete" ON user_settings;

CREATE POLICY "user_settings_select" ON user_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_settings_insert" ON user_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings_update" ON user_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "user_settings_delete" ON user_settings
  FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;

-- ============================================
-- Verification
-- ============================================

-- Check policy count (should be 20)
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('projects', 'project_members', 'project_roles', 'stories', 'user_settings')
GROUP BY tablename
ORDER BY tablename;

-- List all policies
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('projects', 'project_members', 'project_roles', 'stories', 'user_settings')
ORDER BY tablename, cmd, policyname;

-- Check user_settings table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'user_settings'
ORDER BY ordinal_position;

-- Test queries (run these one by one to identify any remaining issues)
-- SELECT auth.uid(); -- Should return your user ID
-- SELECT * FROM user_settings WHERE user_id = auth.uid();
-- SELECT * FROM projects WHERE facilitator_id = auth.uid();
-- SELECT * FROM stories WHERE id = 'aa512e1c-9640-41a9-b572-898af1318149';

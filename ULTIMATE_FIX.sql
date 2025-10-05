-- ULTIMATE FIX: Break ALL recursion chains
-- Root cause analysis:
-- stories → project_members → project_members (self-reference causes recursion)
-- Solution: Remove self-referencing check from project_members

BEGIN;

-- ============================================
-- 1. Remove duplicate projects policy
-- ============================================

DROP POLICY IF EXISTS "Users can view projects they're members of" ON projects;

-- ============================================
-- 2. Fix project_members - REMOVE SELF-REFERENCE
-- ============================================

-- Drop all project_members policies
DROP POLICY IF EXISTS "project_members_select" ON project_members;
DROP POLICY IF EXISTS "project_members_insert" ON project_members;
DROP POLICY IF EXISTS "project_members_update" ON project_members;
DROP POLICY IF EXISTS "project_members_delete" ON project_members;

-- Recreate WITHOUT self-reference (this was causing the recursion!)
CREATE POLICY "project_members_select" ON project_members
  FOR SELECT
  USING (
    -- User is viewing their own membership
    auth.uid() = user_id OR
    -- User is the project facilitator
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.facilitator_id = auth.uid()
    )
    -- REMOVED: Check if user is member of same project (this caused recursion!)
  );

CREATE POLICY "project_members_insert" ON project_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

CREATE POLICY "project_members_update" ON project_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

CREATE POLICY "project_members_delete" ON project_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

-- ============================================
-- 3. Verify no recursion in other policies
-- ============================================

-- Ensure projects_select doesn't cause issues
DROP POLICY IF EXISTS "projects_select" ON projects;

CREATE POLICY "projects_select" ON projects
  FOR SELECT
  USING (
    -- User is the facilitator/owner
    auth.uid() = facilitator_id OR
    -- User has an active role in the project
    EXISTS (
      SELECT 1 FROM project_roles pr
      WHERE pr.project_id = projects.id
        AND pr.user_id = auth.uid()
        AND pr.status = 'active'
    ) OR
    -- User is an active member (safe now that project_members doesn't self-reference)
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = projects.id
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    )
  );

-- ============================================
-- 4. Ensure stories_select is safe
-- ============================================

DROP POLICY IF EXISTS "stories_select" ON stories;

CREATE POLICY "stories_select" ON stories
  FOR SELECT
  USING (
    -- User is the storyteller
    auth.uid() = storyteller_id OR
    -- User is the project facilitator
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = stories.project_id
        AND p.facilitator_id = auth.uid()
    ) OR
    -- User has an active role
    EXISTS (
      SELECT 1 FROM project_roles pr
      WHERE pr.project_id = stories.project_id
        AND pr.user_id = auth.uid()
        AND pr.status = 'active'
    ) OR
    -- User is an active member (safe now!)
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = stories.project_id
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    )
  );

COMMIT;

-- ============================================
-- Verification
-- ============================================

-- Should show exactly 20 policies
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

-- Test query (should work without recursion)
-- SELECT * FROM stories WHERE id = 'aa512e1c-9640-41a9-b572-898af1318149';

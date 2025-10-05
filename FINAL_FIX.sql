-- FINAL FIX: Remove last duplicate and fix infinite recursion
-- This is the definitive fix for all RLS issues

BEGIN;

-- ============================================
-- 1. Remove the last duplicate policy
-- ============================================

DROP POLICY IF EXISTS "Users can view projects they're members of" ON projects;

-- ============================================
-- 2. Fix project_members infinite recursion
-- ============================================

-- The problem: project_members_select checks other project_members,
-- which creates recursion when stories policy checks project_members

-- Drop the recursive policy
DROP POLICY IF EXISTS "project_members_select" ON project_members;

-- Create a simpler, non-recursive policy
-- Users can view members if they are:
-- 1. Viewing their own membership
-- 2. The project facilitator
CREATE POLICY "project_members_select" ON project_members
  FOR SELECT
  USING (
    -- User is viewing their own membership
    auth.uid() = user_id OR
    -- User is the project facilitator (direct check, no recursion)
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

-- ============================================
-- 3. Simplify stories_select to avoid recursion
-- ============================================

-- Drop the current stories policy
DROP POLICY IF EXISTS "stories_select" ON stories;

-- Create a simpler policy that doesn't cause recursion
CREATE POLICY "stories_select" ON stories
  FOR SELECT
  USING (
    -- User is the storyteller
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
  );

-- Note: Removed project_members check from stories to break recursion chain

COMMIT;

-- ============================================
-- Verification
-- ============================================

-- Should show exactly 20 policies (5 tables × 4 operations each)
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('projects', 'project_members', 'project_roles', 'stories', 'user_settings')
GROUP BY tablename
ORDER BY tablename;

-- Should show no duplicates
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('projects', 'project_members', 'project_roles', 'stories', 'user_settings')
ORDER BY tablename, cmd, policyname;

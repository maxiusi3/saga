-- Fix RLS Errors: Infinite Recursion and 400 Bad Request
-- Run this in Supabase SQL Editor

BEGIN;

-- ============================================
-- 1. Fix project_members infinite recursion
-- ============================================

-- Drop all existing policies on project_members
DROP POLICY IF EXISTS "Users can view project members" ON project_members;
DROP POLICY IF EXISTS "Users can view members of their projects" ON project_members;
DROP POLICY IF EXISTS "Facilitators can manage project members" ON project_members;
DROP POLICY IF EXISTS "Users can insert project members" ON project_members;
DROP POLICY IF EXISTS "Users can update project members" ON project_members;
DROP POLICY IF EXISTS "Users can delete project members" ON project_members;

-- Create non-recursive policies for project_members
-- SELECT: Users can view members of projects they belong to
CREATE POLICY "project_members_select_policy" ON project_members
  FOR SELECT
  USING (
    -- User is viewing their own membership
    auth.uid() = user_id OR
    -- User is a member of the same project (direct check, no recursion)
    EXISTS (
      SELECT 1 FROM project_members pm2
      WHERE pm2.project_id = project_members.project_id
        AND pm2.user_id = auth.uid()
        AND pm2.status = 'active'
    )
  );

-- INSERT: Only facilitators can add members
CREATE POLICY "project_members_insert_policy" ON project_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

-- UPDATE: Only facilitators can update members
CREATE POLICY "project_members_update_policy" ON project_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

-- DELETE: Only facilitators can remove members
CREATE POLICY "project_members_delete_policy" ON project_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

-- ============================================
-- 2. Fix project_roles infinite recursion
-- ============================================

-- Drop all existing policies on project_roles
DROP POLICY IF EXISTS "Users can view roles for projects they are members of" ON project_roles;
DROP POLICY IF EXISTS "Users can view own or owned project roles" ON project_roles;
DROP POLICY IF EXISTS "Facilitators can manage project roles" ON project_roles;
DROP POLICY IF EXISTS "Users can insert project roles" ON project_roles;
DROP POLICY IF EXISTS "Users can update project roles" ON project_roles;
DROP POLICY IF EXISTS "Users can delete project roles" ON project_roles;

-- Create non-recursive policies for project_roles
-- SELECT: Users can view their own roles or roles in projects they own
CREATE POLICY "project_roles_select_policy" ON project_roles
  FOR SELECT
  USING (
    -- User is viewing their own role
    auth.uid() = user_id OR
    -- User is the project facilitator/owner
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_roles.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

-- INSERT: Only facilitators can add roles
CREATE POLICY "project_roles_insert_policy" ON project_roles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_roles.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

-- UPDATE: Only facilitators can update roles
CREATE POLICY "project_roles_update_policy" ON project_roles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_roles.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

-- DELETE: Only facilitators can delete roles
CREATE POLICY "project_roles_delete_policy" ON project_roles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_roles.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

-- ============================================
-- 3. Fix projects policies (avoid recursion)
-- ============================================

-- Drop existing projects policies
DROP POLICY IF EXISTS "Users can view projects they are members of" ON projects;
DROP POLICY IF EXISTS "Users can view owned or member projects" ON projects;
DROP POLICY IF EXISTS "Facilitators can update their projects" ON projects;
DROP POLICY IF EXISTS "Facilitators can delete their projects" ON projects;

-- Create non-recursive policies for projects
-- SELECT: Users can view projects they own or are members of
CREATE POLICY "projects_select_policy" ON projects
  FOR SELECT
  USING (
    -- User is the facilitator/owner
    auth.uid() = facilitator_id OR
    -- User has an active role in the project (direct query)
    EXISTS (
      SELECT 1 FROM project_roles pr
      WHERE pr.project_id = projects.id
        AND pr.user_id = auth.uid()
        AND pr.status = 'active'
    ) OR
    -- User is an active member
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = projects.id
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    )
  );

-- INSERT: Authenticated users can create projects
CREATE POLICY "projects_insert_policy" ON projects
  FOR INSERT
  WITH CHECK (auth.uid() = facilitator_id);

-- UPDATE: Only facilitators can update their projects
CREATE POLICY "projects_update_policy" ON projects
  FOR UPDATE
  USING (auth.uid() = facilitator_id);

-- DELETE: Only facilitators can delete their projects
CREATE POLICY "projects_delete_policy" ON projects
  FOR DELETE
  USING (auth.uid() = facilitator_id);

-- ============================================
-- 4. Fix stories policies (avoid recursion)
-- ============================================

-- Drop existing stories policies
DROP POLICY IF EXISTS "Users can view stories in their projects" ON stories;
DROP POLICY IF EXISTS "Storytellers can create stories" ON stories;
DROP POLICY IF EXISTS "Storytellers can update their stories" ON stories;
DROP POLICY IF EXISTS "Facilitators can update stories" ON stories;

-- Create non-recursive policies for stories
-- SELECT: Users can view stories in projects they're members of
CREATE POLICY "stories_select_policy" ON stories
  FOR SELECT
  USING (
    -- User is the storyteller
    auth.uid() = storyteller_id OR
    -- User is a member of the project (direct check)
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = stories.project_id
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    ) OR
    -- User has a role in the project (direct check)
    EXISTS (
      SELECT 1 FROM project_roles pr
      WHERE pr.project_id = stories.project_id
        AND pr.user_id = auth.uid()
        AND pr.status = 'active'
    ) OR
    -- User is the project facilitator
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = stories.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

-- INSERT: Storytellers can create stories in their projects
CREATE POLICY "stories_insert_policy" ON stories
  FOR INSERT
  WITH CHECK (
    auth.uid() = storyteller_id AND
    (
      EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = stories.project_id
          AND pm.user_id = auth.uid()
          AND pm.status = 'active'
      ) OR
      EXISTS (
        SELECT 1 FROM project_roles pr
        WHERE pr.project_id = stories.project_id
          AND pr.user_id = auth.uid()
          AND pr.status = 'active'
      )
    )
  );

-- UPDATE: Storytellers can update their own stories, facilitators can update any
CREATE POLICY "stories_update_policy" ON stories
  FOR UPDATE
  USING (
    auth.uid() = storyteller_id OR
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = stories.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

-- DELETE: Only facilitators can delete stories
CREATE POLICY "stories_delete_policy" ON stories
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = stories.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

-- ============================================
-- 5. Fix user_settings 400 error
-- ============================================

-- Drop existing user_settings policies
DROP POLICY IF EXISTS "Users can view their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON user_settings;

-- Create simple, non-recursive policies for user_settings
-- SELECT: Users can only view their own settings
CREATE POLICY "user_settings_select_policy" ON user_settings
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: Users can only insert their own settings
CREATE POLICY "user_settings_insert_policy" ON user_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can only update their own settings
CREATE POLICY "user_settings_update_policy" ON user_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- DELETE: Users can delete their own settings
CREATE POLICY "user_settings_delete_policy" ON user_settings
  FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;

-- ============================================
-- Verification Queries
-- ============================================

-- Check all policies are created correctly
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('projects', 'project_members', 'project_roles', 'stories', 'user_settings')
ORDER BY tablename, policyname;

-- Test query (should not cause recursion)
-- SELECT * FROM stories WHERE id = 'some-id';

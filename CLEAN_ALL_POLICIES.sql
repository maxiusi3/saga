-- Clean ALL existing RLS policies and create fresh ones
-- This ensures no duplicate or conflicting policies

BEGIN;

-- ============================================
-- STEP 1: Drop ALL existing policies
-- ============================================

-- Drop all project_members policies
DROP POLICY IF EXISTS "Users can view project members" ON project_members;
DROP POLICY IF EXISTS "Users can view members of their projects" ON project_members;
DROP POLICY IF EXISTS "Facilitators can manage project members" ON project_members;
DROP POLICY IF EXISTS "Users can insert project members" ON project_members;
DROP POLICY IF EXISTS "Users can update project members" ON project_members;
DROP POLICY IF EXISTS "Users can delete project members" ON project_members;
DROP POLICY IF EXISTS "project_members_select_policy" ON project_members;
DROP POLICY IF EXISTS "project_members_insert_policy" ON project_members;
DROP POLICY IF EXISTS "project_members_update_policy" ON project_members;
DROP POLICY IF EXISTS "project_members_delete_policy" ON project_members;

-- Drop all project_roles policies
DROP POLICY IF EXISTS "Users can view roles for projects they are members of" ON project_roles;
DROP POLICY IF EXISTS "Users can view own or owned project roles" ON project_roles;
DROP POLICY IF EXISTS "Facilitators can manage project roles" ON project_roles;
DROP POLICY IF EXISTS "Users can insert project roles" ON project_roles;
DROP POLICY IF EXISTS "Users can update project roles" ON project_roles;
DROP POLICY IF EXISTS "Users can delete project roles" ON project_roles;
DROP POLICY IF EXISTS "project_roles_select_policy" ON project_roles;
DROP POLICY IF EXISTS "project_roles_insert_policy" ON project_roles;
DROP POLICY IF EXISTS "project_roles_update_policy" ON project_roles;
DROP POLICY IF EXISTS "project_roles_delete_policy" ON project_roles;
DROP POLICY IF EXISTS "Facilitators can manage project_roles" ON project_roles;
DROP POLICY IF EXISTS "Users can insert their own project role" ON project_roles;
DROP POLICY IF EXISTS "Users can view project roles they're involved in" ON project_roles;

-- Drop all projects policies
DROP POLICY IF EXISTS "Users can view projects they are members of" ON projects;
DROP POLICY IF EXISTS "Users can view owned or member projects" ON projects;
DROP POLICY IF EXISTS "Facilitators can update their projects" ON projects;
DROP POLICY IF EXISTS "Facilitators can delete their projects" ON projects;
DROP POLICY IF EXISTS "projects_select_policy" ON projects;
DROP POLICY IF EXISTS "projects_insert_policy" ON projects;
DROP POLICY IF EXISTS "projects_update_policy" ON projects;
DROP POLICY IF EXISTS "projects_delete_policy" ON projects;
DROP POLICY IF EXISTS "Facilitators can create projects" ON projects;
DROP POLICY IF EXISTS "Users can create projects" ON projects;
DROP POLICY IF EXISTS "Users can view projects they're involved in" ON projects;
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;

-- Drop all stories policies
DROP POLICY IF EXISTS "Users can view stories in their projects" ON stories;
DROP POLICY IF EXISTS "Storytellers can create stories" ON stories;
DROP POLICY IF EXISTS "Storytellers can update their stories" ON stories;
DROP POLICY IF EXISTS "Facilitators can update stories" ON stories;
DROP POLICY IF EXISTS "stories_select_policy" ON stories;
DROP POLICY IF EXISTS "stories_insert_policy" ON stories;
DROP POLICY IF EXISTS "stories_update_policy" ON stories;
DROP POLICY IF EXISTS "stories_delete_policy" ON stories;
DROP POLICY IF EXISTS "Project members can view stories" ON stories;
DROP POLICY IF EXISTS "Storytellers can update own stories" ON stories;
DROP POLICY IF EXISTS "Users can create stories in their projects" ON stories;
DROP POLICY IF EXISTS "Users can update their own stories" ON stories;

-- Drop all user_settings policies
DROP POLICY IF EXISTS "Users can view their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON user_settings;
DROP POLICY IF EXISTS "user_settings_select_policy" ON user_settings;
DROP POLICY IF EXISTS "user_settings_insert_policy" ON user_settings;
DROP POLICY IF EXISTS "user_settings_update_policy" ON user_settings;
DROP POLICY IF EXISTS "user_settings_delete_policy" ON user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;

-- ============================================
-- STEP 2: Create fresh, non-recursive policies
-- ============================================

-- ============================================
-- user_settings (simplest, no dependencies)
-- ============================================

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

-- ============================================
-- projects (base level)
-- ============================================

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
    -- User is an active member
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = projects.id
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    )
  );

CREATE POLICY "projects_insert" ON projects
  FOR INSERT
  WITH CHECK (auth.uid() = facilitator_id);

CREATE POLICY "projects_update" ON projects
  FOR UPDATE
  USING (auth.uid() = facilitator_id);

CREATE POLICY "projects_delete" ON projects
  FOR DELETE
  USING (auth.uid() = facilitator_id);

-- ============================================
-- project_roles (depends on projects only)
-- ============================================

CREATE POLICY "project_roles_select" ON project_roles
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

CREATE POLICY "project_roles_insert" ON project_roles
  FOR INSERT
  WITH CHECK (
    -- Only facilitators can add roles
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_roles.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

CREATE POLICY "project_roles_update" ON project_roles
  FOR UPDATE
  USING (
    -- Only facilitators can update roles
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_roles.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

CREATE POLICY "project_roles_delete" ON project_roles
  FOR DELETE
  USING (
    -- Only facilitators can delete roles
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_roles.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

-- ============================================
-- project_members (depends on projects only)
-- ============================================

CREATE POLICY "project_members_select" ON project_members
  FOR SELECT
  USING (
    -- User is viewing their own membership
    auth.uid() = user_id OR
    -- User is a member of the same project
    EXISTS (
      SELECT 1 FROM project_members pm2
      WHERE pm2.project_id = project_members.project_id
        AND pm2.user_id = auth.uid()
        AND pm2.status = 'active'
    ) OR
    -- User is the project facilitator
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

CREATE POLICY "project_members_insert" ON project_members
  FOR INSERT
  WITH CHECK (
    -- Only facilitators can add members
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

CREATE POLICY "project_members_update" ON project_members
  FOR UPDATE
  USING (
    -- Only facilitators can update members
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

CREATE POLICY "project_members_delete" ON project_members
  FOR DELETE
  USING (
    -- Only facilitators can remove members
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

-- ============================================
-- stories (depends on projects and members)
-- ============================================

CREATE POLICY "stories_select" ON stories
  FOR SELECT
  USING (
    -- User is the storyteller
    auth.uid() = storyteller_id OR
    -- User is a member of the project
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = stories.project_id
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    ) OR
    -- User has a role in the project
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

CREATE POLICY "stories_insert" ON stories
  FOR INSERT
  WITH CHECK (
    -- User must be storyteller and member of project
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
      ) OR
      EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = stories.project_id
          AND p.facilitator_id = auth.uid()
      )
    )
  );

CREATE POLICY "stories_update" ON stories
  FOR UPDATE
  USING (
    -- Storytellers can update their own stories
    auth.uid() = storyteller_id OR
    -- Facilitators can update any story in their projects
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = stories.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

CREATE POLICY "stories_delete" ON stories
  FOR DELETE
  USING (
    -- Only facilitators can delete stories
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = stories.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

COMMIT;

-- ============================================
-- Verification
-- ============================================

SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('projects', 'project_members', 'project_roles', 'stories', 'user_settings')
ORDER BY tablename, cmd, policyname;

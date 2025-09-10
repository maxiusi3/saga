-- Completely eliminate circular dependency between projects and project_roles
-- The issue: project_roles policy references projects, projects policy references project_roles
-- Solution: Make project_roles policy completely independent of projects table

BEGIN;

-- Drop the current project_roles SELECT policy that causes recursion
DROP POLICY IF EXISTS "Users can view own or owned project roles" ON project_roles;
DROP POLICY IF EXISTS "Users can view roles for projects they are members of" ON project_roles;

-- Create a simple, non-recursive project_roles SELECT policy
-- Users can only see their own role records, period.
-- Facilitators will see project roles through the projects table relationship, not through this policy
CREATE POLICY "Users can view their own project roles" ON project_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Also ensure the projects policy is correct and doesn't cause issues
DROP POLICY IF EXISTS "Users can view owned or member projects" ON projects;
DROP POLICY IF EXISTS "Users can view projects they are members of" ON projects;

-- Recreate projects SELECT policy with explicit logic
CREATE POLICY "Users can view their projects" ON projects
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
    )
  );

COMMIT;

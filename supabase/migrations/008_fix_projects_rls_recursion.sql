-- Fix RLS infinite recursion between projects and project_roles policies
-- Root cause: projects SELECT policy calls is_project_member() which queries project_roles,
-- creating circular dependency when project_roles policy also references projects

BEGIN;

-- First, drop the problematic projects SELECT policy
DROP POLICY IF EXISTS "Users can view projects they are members of" ON projects;

-- Create a new projects SELECT policy that doesn't use is_project_member()
-- This avoids the circular dependency entirely
CREATE POLICY "Users can view owned or member projects" ON projects
  FOR SELECT
  USING (
    -- User is the facilitator/owner
    auth.uid() = facilitator_id OR
    -- User has an active role in the project (direct query, no function call)
    EXISTS (
      SELECT 1 FROM project_roles pr
      WHERE pr.project_id = projects.id
        AND pr.user_id = auth.uid()
        AND pr.status = 'active'
    )
  );

COMMIT;

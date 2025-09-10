-- Emergency fix: Temporarily disable RLS on project_roles to break recursion
-- This will allow project creation to work while we debug the root cause

BEGIN;

-- Drop ALL policies on project_roles table
DROP POLICY IF EXISTS "Users can view their own project roles" ON project_roles;
DROP POLICY IF EXISTS "Users can view own or owned project roles" ON project_roles;
DROP POLICY IF EXISTS "Users can view roles for projects they are members of" ON project_roles;
DROP POLICY IF EXISTS "Facilitators can manage project roles" ON project_roles;
DROP POLICY IF EXISTS "Users can insert their own project roles" ON project_roles;

-- Temporarily disable RLS on project_roles
ALTER TABLE project_roles DISABLE ROW LEVEL SECURITY;

-- Keep projects policy simple and working
DROP POLICY IF EXISTS "Users can view their projects" ON projects;
DROP POLICY IF EXISTS "Users can view owned or member projects" ON projects;
DROP POLICY IF EXISTS "Users can view projects they are members of" ON projects;

-- Simple projects policy that only checks facilitator_id (no project_roles dependency)
CREATE POLICY "Users can view their own projects" ON projects
  FOR SELECT
  USING (auth.uid() = facilitator_id);

COMMIT;

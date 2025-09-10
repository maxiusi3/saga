-- Fix RLS infinite recursion for project_roles policies
-- Context: Previous policy used is_project_member() inside project_roles SELECT policy,
-- which is also referenced by projects' SELECT policy. This caused infinite recursion
-- when evaluating visibility across these relations.

BEGIN;

-- Drop the recursive policy on project_roles if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'project_roles' 
      AND policyname = 'Users can view roles for projects they are members of'
  ) THEN
    EXECUTE 'DROP POLICY "Users can view roles for projects they are members of" ON project_roles';
  END IF;
END
$$;

-- Replace with a non-recursive, explicit policy
-- Allow:
-- 1) a user to view their own role rows
-- 2) a facilitator (project owner) to view all roles in their projects
CREATE POLICY "Users can view own or owned project roles" ON project_roles
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_roles.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

COMMIT;


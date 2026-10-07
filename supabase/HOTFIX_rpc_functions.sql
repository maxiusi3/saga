-- ============================================================================
-- HOTFIX: RPC Functions Architecture Alignment
-- ============================================================================
-- Purpose: Fix RPC functions to match actual database schema
-- Issue: Functions referenced non-existent project_invitations table
-- Solution: Update to use project_roles table (the actual implementation)
-- Date: 2026-10-07

-- ============================================================================
-- Drop old function signatures
-- ============================================================================
DROP FUNCTION IF EXISTS cleanup_expired_invitations();
DROP FUNCTION IF EXISTS send_project_invitation(uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS accept_project_invitation(text, uuid);

-- ============================================================================
-- 1. Cleanup Expired Invitations (Fixed)
-- ============================================================================
-- Cleans up expired pending invitations in project_roles table
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Note: project_roles doesn't have expires_at, so we clean up old pending invites
  -- Consider invitations older than 7 days as expired
  DELETE FROM project_roles
  WHERE status = 'pending'
    AND invited_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- ============================================================================
-- 2. Send Project Invitation (Fixed)
-- ============================================================================
-- Creates a pending invitation in project_roles
CREATE OR REPLACE FUNCTION send_project_invitation(
  p_project_id UUID,
  p_invitee_id UUID,
  p_role TEXT,
  p_invited_by UUID,
  p_invitation_message TEXT DEFAULT NULL
)
RETURNS TABLE(
  invitation_id UUID,
  project_id UUID,
  invitee_id UUID,
  role TEXT,
  status TEXT,
  invited_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation_id UUID;
  v_invited_at TIMESTAMPTZ;
BEGIN
  -- Validate: inviter must be project owner or facilitator
  IF NOT EXISTS (
    SELECT 1 FROM project_roles pr
    WHERE pr.project_id = p_project_id
      AND pr.user_id = p_invited_by
      AND pr.role IN ('owner', 'facilitator')
      AND pr.status = 'active'
  ) THEN
    RAISE EXCEPTION 'User does not have permission to send invitations for this project';
  END IF;

  -- Validate: role must be valid
  IF p_role NOT IN ('owner', 'facilitator', 'co_facilitator', 'storyteller') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  -- Check if invitation already exists
  IF EXISTS (
    SELECT 1 FROM project_roles pr
    WHERE pr.project_id = p_project_id AND pr.user_id = p_invitee_id
  ) THEN
    RAISE EXCEPTION 'User already has a role or pending invitation for this project';
  END IF;

  -- Create invitation
  INSERT INTO project_roles (
    project_id,
    user_id,
    role,
    invited_by,
    invited_at,
    status
  ) VALUES (
    p_project_id,
    p_invitee_id,
    p_role,
    p_invited_by,
    NOW(),
    'pending'
  )
  RETURNING id, invited_at INTO v_invitation_id, v_invited_at;

  -- Return invitation details
  RETURN QUERY SELECT
    v_invitation_id,
    p_project_id,
    p_invitee_id,
    p_role,
    'pending'::TEXT,
    v_invited_at;
END;
$$;

-- ============================================================================
-- 3. Accept Project Invitation (Fixed)
-- ============================================================================
-- Accepts a pending invitation by updating project_roles status
CREATE OR REPLACE FUNCTION accept_project_invitation(
  p_invitation_id UUID,
  p_user_id UUID
)
RETURNS TABLE(
  project_id UUID,
  user_id UUID,
  role TEXT,
  status TEXT,
  joined_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_id UUID;
  v_role TEXT;
  v_joined_at TIMESTAMPTZ;
BEGIN
  -- Validate: invitation exists and belongs to user
  SELECT pr.project_id, pr.role INTO v_project_id, v_role
  FROM project_roles pr
  WHERE pr.id = p_invitation_id
    AND pr.user_id = p_user_id
    AND pr.status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or already processed';
  END IF;

  -- Accept invitation
  v_joined_at := NOW();

  UPDATE project_roles pr
  SET
    status = 'active',
    joined_at = v_joined_at,
    updated_at = v_joined_at
  WHERE pr.id = p_invitation_id;

  -- Return accepted invitation details
  RETURN QUERY SELECT
    v_project_id,
    p_user_id,
    v_role,
    'active'::TEXT,
    v_joined_at;
END;
$$;

-- ============================================================================
-- Grant Permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION cleanup_expired_invitations() TO service_role;
GRANT EXECUTE ON FUNCTION send_project_invitation(UUID, UUID, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_project_invitation(UUID, UUID) TO authenticated;

-- ============================================================================
-- Verification
-- ============================================================================
-- Test that functions exist
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname = 'cleanup_expired_invitations') = 1,
    'cleanup_expired_invitations function not created';
  ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname = 'send_project_invitation') = 1,
    'send_project_invitation function not created';
  ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname = 'accept_project_invitation') = 1,
    'accept_project_invitation function not created';

  RAISE NOTICE '✅ All 3 RPC functions created successfully';
END $$;

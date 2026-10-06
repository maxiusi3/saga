-- Migration: Fix Wallet RLS + Implement Missing RPCs
-- Created: 2026-10-06
-- Purpose: SEC-02 (wallet RLS lockdown) + SEC-03 (missing RPC functions)

-- ============================================================================
-- PART 1: WALLET RLS LOCKDOWN (SEC-02)
-- ============================================================================

-- Drop insecure RLS policies that allowed direct client updates
DROP POLICY IF EXISTS "wallet_update_self" ON user_resource_wallets;
DROP POLICY IF EXISTS "wallet_insert_self" ON user_resource_wallets;

-- Keep read-only policy
-- Ensure users can still SELECT their own wallet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_resource_wallets'
    AND policyname = 'wallet_select_self'
  ) THEN
    CREATE POLICY "wallet_select_self" ON user_resource_wallets
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- PART 2: WALLET RPC FUNCTIONS (SEC-02 + SEC-03)
-- ============================================================================

-- Initialize user wallet (idempotent, safe to call multiple times)
CREATE OR REPLACE FUNCTION initialize_user_wallet(p_user_id UUID)
RETURNS TABLE(
  user_id UUID,
  standard_hours INTEGER,
  premium_hours INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only allow users to initialize their own wallet
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot initialize wallet for another user';
  END IF;

  -- Insert if not exists, return existing if already created
  INSERT INTO user_resource_wallets (user_id, standard_hours, premium_hours)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN QUERY
  SELECT w.user_id, w.standard_hours, w.premium_hours, w.created_at, w.updated_at
  FROM user_resource_wallets w
  WHERE w.user_id = p_user_id;
END;
$$;

-- Process package purchase (atomic transaction with idempotency)
CREATE OR REPLACE FUNCTION process_package_purchase(
  p_user_id UUID,
  p_package_code TEXT,
  p_standard_hours INTEGER,
  p_premium_hours INTEGER,
  p_payment_reference TEXT
)
RETURNS TABLE(
  user_id UUID,
  standard_hours INTEGER,
  premium_hours INTEGER,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_record TEXT;
BEGIN
  -- Check for duplicate payment reference (idempotency)
  SELECT payment_reference INTO v_existing_record
  FROM user_resource_wallets
  WHERE user_id = p_user_id AND last_payment_reference = p_payment_reference;

  IF v_existing_record IS NOT NULL THEN
    RAISE NOTICE 'Payment reference % already processed, skipping', p_payment_reference;
    RETURN QUERY
    SELECT w.user_id, w.standard_hours, w.premium_hours, w.updated_at
    FROM user_resource_wallets w
    WHERE w.user_id = p_user_id;
    RETURN;
  END IF;

  -- Atomic update: add hours and record payment
  UPDATE user_resource_wallets
  SET
    standard_hours = standard_hours + p_standard_hours,
    premium_hours = premium_hours + p_premium_hours,
    last_payment_reference = p_payment_reference,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Return updated wallet
  RETURN QUERY
  SELECT w.user_id, w.standard_hours, w.premium_hours, w.updated_at
  FROM user_resource_wallets w
  WHERE w.user_id = p_user_id;
END;
$$;

-- Add last_payment_reference column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_resource_wallets'
    AND column_name = 'last_payment_reference'
  ) THEN
    ALTER TABLE user_resource_wallets
    ADD COLUMN last_payment_reference TEXT;

    CREATE INDEX IF NOT EXISTS idx_wallet_payment_ref
    ON user_resource_wallets(last_payment_reference);
  END IF;
END $$;

-- ============================================================================
-- PART 3: INVITATION RPCs (SEC-03)
-- ============================================================================

-- Send project invitation
CREATE OR REPLACE FUNCTION send_project_invitation(
  p_project_id UUID,
  p_inviter_id UUID,
  p_invitee_email TEXT,
  p_role TEXT,
  p_token TEXT
)
RETURNS TABLE(
  id UUID,
  token TEXT,
  email TEXT,
  role TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  -- Check inviter has permission (owner or facilitator)
  SELECT pm.role INTO v_user_role
  FROM project_members pm
  WHERE pm.project_id = p_project_id AND pm.user_id = p_inviter_id;

  IF v_user_role IS NULL THEN
    SELECT p.owner_id INTO v_user_role
    FROM projects p
    WHERE p.id = p_project_id AND p.owner_id = p_inviter_id;

    IF v_user_role IS NOT NULL THEN
      v_user_role := 'owner';
    END IF;
  END IF;

  IF v_user_role NOT IN ('owner', 'facilitator') THEN
    RAISE EXCEPTION 'Unauthorized: Only owners and facilitators can send invitations';
  END IF;

  -- Create invitation (7-day expiry)
  INSERT INTO project_invitations (
    project_id,
    inviter_id,
    invitee_email,
    role,
    token,
    expires_at,
    status
  )
  VALUES (
    p_project_id,
    p_inviter_id,
    LOWER(p_invitee_email),
    p_role,
    p_token,
    NOW() + INTERVAL '7 days',
    'pending'
  )
  RETURNING
    project_invitations.id,
    project_invitations.token,
    project_invitations.invitee_email,
    project_invitations.role,
    project_invitations.expires_at
  INTO id, token, email, role, expires_at;

  RETURN NEXT;
END;
$$;

-- Accept project invitation
CREATE OR REPLACE FUNCTION accept_project_invitation(
  p_token TEXT,
  p_user_id UUID
)
RETURNS TABLE(
  project_id UUID,
  role TEXT,
  success BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  -- Fetch and validate invitation
  SELECT * INTO v_invitation
  FROM project_invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > NOW();

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  -- Add user to project members (idempotent)
  INSERT INTO project_members (project_id, user_id, role, joined_at)
  VALUES (v_invitation.project_id, p_user_id, v_invitation.role, NOW())
  ON CONFLICT (project_id, user_id) DO NOTHING;

  -- Mark invitation as accepted
  UPDATE project_invitations
  SET status = 'accepted', accepted_at = NOW()
  WHERE token = p_token;

  RETURN QUERY
  SELECT v_invitation.project_id, v_invitation.role::TEXT, TRUE;
END;
$$;

-- Cleanup expired invitations (for cron jobs)
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM project_invitations
  WHERE status = 'pending' AND expires_at < NOW();

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- ============================================================================
-- PART 4: EXPORT RPC (SEC-03)
-- ============================================================================

-- Request data export (placeholder for export queue)
CREATE OR REPLACE FUNCTION request_data_export(
  p_user_id UUID,
  p_project_id UUID,
  p_include_audio BOOLEAN,
  p_include_photos BOOLEAN
)
RETURNS TABLE(
  export_id UUID,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_access BOOLEAN;
BEGIN
  -- Verify user has access to project
  SELECT EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = p_project_id AND pm.user_id = p_user_id
    UNION
    SELECT 1 FROM projects p
    WHERE p.id = p_project_id AND p.owner_id = p_user_id
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Unauthorized: No access to project';
  END IF;

  -- TODO: Create export_requests table and insert record
  -- For now, return placeholder
  RETURN QUERY
  SELECT
    gen_random_uuid() AS export_id,
    'queued'::TEXT AS status,
    NOW() AS created_at;
END;
$$;

-- ============================================================================
-- PART 5: GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION initialize_user_wallet(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_package_purchase(UUID, TEXT, INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION send_project_invitation(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_project_invitation(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_invitations() TO authenticated;
GRANT EXECUTE ON FUNCTION request_data_export(UUID, UUID, BOOLEAN, BOOLEAN) TO authenticated;

-- Grant service role for admin operations
GRANT EXECUTE ON FUNCTION cleanup_expired_invitations() TO service_role;
GRANT EXECUTE ON FUNCTION process_package_purchase(UUID, TEXT, INTEGER, INTEGER, TEXT) TO service_role;

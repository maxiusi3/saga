-- Make invitation tokens URL-safe and robust in both creation and acceptance
-- 1) Use base64url (replace +/ with -_ and drop = padding) when creating tokens
-- 2) Accept both legacy base64 tokens and new base64url tokens in accept_project_invitation

BEGIN;

-- Update send_project_invitation to generate URL-safe tokens
CREATE OR REPLACE FUNCTION send_project_invitation(
  project_id UUID,
  inviter_id UUID,
  invitee_email TEXT,
  invitation_role TEXT,
  invitation_message TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_id UUID;
  invitation_token TEXT;
  available_seats INTEGER;
BEGIN
  -- Ensure inviter is a facilitator (either project owner or facilitator role)
  IF NOT EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = send_project_invitation.project_id AND p.facilitator_id = inviter_id
  ) AND NOT EXISTS (
    SELECT 1 FROM project_roles pr
    WHERE pr.project_id = send_project_invitation.project_id
      AND pr.user_id = inviter_id
      AND pr.role = 'facilitator'
      AND pr.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Only project facilitators can send invitations';
  END IF;

  -- Check seat availability (1 seat required)
  IF invitation_role = 'facilitator' THEN
    SELECT facilitator_seats INTO available_seats FROM user_resource_wallets WHERE user_id = inviter_id;
  ELSE
    SELECT storyteller_seats INTO available_seats FROM user_resource_wallets WHERE user_id = inviter_id;
  END IF;

  IF available_seats IS NULL OR available_seats < 1 THEN
    RAISE EXCEPTION 'Insufficient % seats. Available: %, Required: %', invitation_role, COALESCE(available_seats, 0), 1;
  END IF;

  -- Generate URL-safe token: base64 -> replace +/ with -_ and trim = padding
  invitation_token := encode(gen_random_bytes(32), 'base64');
  invitation_token := translate(invitation_token, '+/', '-_');
  invitation_token := regexp_replace(invitation_token, '=+$', '');

  -- Create invitation
  INSERT INTO invitations (
    project_id, inviter_id, invitee_email, role, status, token, expires_at, message
  ) VALUES (
    send_project_invitation.project_id,
    inviter_id,
    lower(invitee_email),
    invitation_role,
    'pending',
    invitation_token,
    NOW() + INTERVAL '72 hours',
    invitation_message
  ) RETURNING id INTO invitation_id;

  -- Reserve seat
  IF invitation_role = 'facilitator' THEN
    UPDATE user_resource_wallets SET facilitator_seats = facilitator_seats - 1, updated_at = NOW() WHERE user_id = inviter_id;
  ELSE
    UPDATE user_resource_wallets SET storyteller_seats = storyteller_seats - 1, updated_at = NOW() WHERE user_id = inviter_id;
  END IF;

  -- Record seat transaction
  INSERT INTO seat_transactions (
    user_id, transaction_type, resource_type, amount, project_id, metadata
  ) VALUES (
    inviter_id,
    'reserve',
    invitation_role || '_seat',
    -1,
    send_project_invitation.project_id,
    jsonb_build_object('action','invitation_sent','invitee_email', lower(invitee_email), 'invitation_id', invitation_id, 'message', invitation_message)
  );

  RETURN jsonb_build_object('invitation_id', invitation_id, 'token', invitation_token);
END;
$$;

-- Update accept_project_invitation to accept both legacy and url-safe tokens
CREATE OR REPLACE FUNCTION accept_project_invitation(
  invitation_token TEXT,
  user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_record RECORD;
  user_email TEXT;
  token_candidates TEXT[];
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = user_id;

  -- Build candidate tokens to match against stored token
  token_candidates := ARRAY[
    invitation_token,
    replace(invitation_token, ' ', '+'),
    replace(invitation_token, '%2B', '+'),
    replace(invitation_token, '%3D', '='),
    translate(invitation_token, '-_', '+/')
  ];

  -- Find a valid invitation
  SELECT * INTO invitation_record
  FROM invitations
  WHERE token = ANY(token_candidates)
    AND status = 'pending'
    AND expires_at > NOW()
    AND invitee_email = lower(user_email)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation token';
  END IF;

  -- Ensure user does not already have the role
  IF EXISTS (
    SELECT 1 FROM project_roles
    WHERE project_id = invitation_record.project_id
      AND user_id = accept_project_invitation.user_id
      AND role = invitation_record.role
  ) THEN
    RAISE EXCEPTION 'User already has this role in the project';
  END IF;

  -- Add role
  INSERT INTO project_roles (project_id, user_id, role, status)
  VALUES (invitation_record.project_id, accept_project_invitation.user_id, invitation_record.role, 'active');

  -- Update invitation status
  UPDATE invitations SET status = 'accepted', updated_at = NOW() WHERE id = invitation_record.id;

  -- Record seat activation
  INSERT INTO seat_transactions (
    user_id, transaction_type, resource_type, amount, project_id, metadata
  ) VALUES (
    accept_project_invitation.user_id,
    'activate',
    invitation_record.role || '_seat',
    1,
    invitation_record.project_id,
    jsonb_build_object('action','invitation_accepted','invitation_id', invitation_record.id)
  );

  RETURN jsonb_build_object('project_id', invitation_record.project_id, 'role', invitation_record.role);
END;
$$;

-- Helpful index for lookups
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);

COMMIT;


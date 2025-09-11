-- Add message field to invitations table for personal messages

BEGIN;

-- Add message column to invitations table
ALTER TABLE invitations 
ADD COLUMN IF NOT EXISTS message TEXT;

-- Update the send_project_invitation function to support message parameter
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
  required_seats INTEGER;
  available_seats INTEGER;
BEGIN
  -- 验证邀请者是否是项目的facilitator (检查 projects.facilitator_id 或 project_roles)
  IF NOT EXISTS (
    SELECT 1 FROM projects 
    WHERE id = send_project_invitation.project_id 
    AND facilitator_id = inviter_id
  ) AND NOT EXISTS (
    SELECT 1 FROM project_roles 
    WHERE project_roles.project_id = send_project_invitation.project_id 
    AND user_id = inviter_id 
    AND role = 'facilitator' 
    AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Only project facilitators can send invitations';
  END IF;

  -- 检查是否有足够的座位
  IF invitation_role = 'facilitator' THEN
    SELECT facilitator_seats INTO available_seats
    FROM user_resource_wallets
    WHERE user_id = inviter_id;
    required_seats := 1;
  ELSE
    SELECT storyteller_seats INTO available_seats
    FROM user_resource_wallets
    WHERE user_id = inviter_id;
    required_seats := 1;
  END IF;

  IF available_seats IS NULL OR available_seats < required_seats THEN
    RAISE EXCEPTION 'Insufficient % seats. Available: %, Required: %', 
      invitation_role, COALESCE(available_seats, 0), required_seats;
  END IF;

  -- 生成邀请令牌
  invitation_token := encode(gen_random_bytes(32), 'base64');

  -- 创建邀请
  INSERT INTO invitations (
    project_id,
    inviter_id,
    invitee_email,
    role,
    status,
    token,
    expires_at,
    message
  )
  VALUES (
    send_project_invitation.project_id,
    inviter_id,
    invitee_email,
    invitation_role,
    'pending',
    invitation_token,
    NOW() + INTERVAL '72 hours',
    invitation_message
  )
  RETURNING id INTO invitation_id;

  -- 预留座位
  IF invitation_role = 'facilitator' THEN
    UPDATE user_resource_wallets
    SET facilitator_seats = facilitator_seats - 1,
        updated_at = NOW()
    WHERE user_id = inviter_id;
  ELSE
    UPDATE user_resource_wallets
    SET storyteller_seats = storyteller_seats - 1,
        updated_at = NOW()
    WHERE user_id = inviter_id;
  END IF;

  -- 记录座位预留交易
  INSERT INTO seat_transactions (
    user_id,
    transaction_type,
    resource_type,
    amount,
    project_id,
    metadata
  )
  VALUES (
    inviter_id,
    'reserve',
    invitation_role || '_seat',
    -1,
    send_project_invitation.project_id,
    jsonb_build_object(
      'action', 'invitation_sent',
      'invitee_email', invitee_email,
      'invitation_id', invitation_id,
      'message', invitation_message
    )
  );

  -- 返回邀请ID
  RETURN jsonb_build_object('invitation_id', invitation_id);
END;
$$;

COMMIT;

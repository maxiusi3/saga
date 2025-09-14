-- Fix ambiguous reference to user_id in accept_project_invitation by renaming parameter
-- and qualifying references. Keeps behavior and compatibility intact.

BEGIN;

CREATE OR REPLACE FUNCTION accept_project_invitation(
  invitation_token TEXT,
  _user_id UUID
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
  -- 获取用户邮箱
  SELECT email INTO user_email FROM auth.users WHERE id = _user_id;

  -- 构造候选 token（兼容多种变体）
  token_candidates := ARRAY[
    invitation_token,
    replace(invitation_token, ' ', '+'),
    replace(invitation_token, '%2B', '+'),
    replace(invitation_token, '%3D', '='),
    translate(invitation_token, '-_', '+/')
  ];

  -- 查找有效邀请
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

  -- 用户是否已拥有该角色
  IF EXISTS (
    SELECT 1 FROM project_roles
    WHERE project_id = invitation_record.project_id
      AND user_id = _user_id
      AND role = invitation_record.role
  ) THEN
    RAISE EXCEPTION 'User already has this role in the project';
  END IF;

  -- 赋予角色
  INSERT INTO project_roles (project_id, user_id, role, status)
  VALUES (invitation_record.project_id, _user_id, invitation_record.role, 'active');

  -- 更新邀请状态
  UPDATE invitations SET status = 'accepted', updated_at = NOW() WHERE id = invitation_record.id;

  -- 记录席位激活
  INSERT INTO seat_transactions (
    user_id, transaction_type, resource_type, amount, project_id, metadata
  ) VALUES (
    _user_id,
    'activate',
    invitation_record.role || '_seat',
    1,
    invitation_record.project_id,
    jsonb_build_object('action','invitation_accepted','invitation_id', invitation_record.id)
  );

  RETURN jsonb_build_object('project_id', invitation_record.project_id, 'role', invitation_record.role);
END;
$$;

COMMIT;


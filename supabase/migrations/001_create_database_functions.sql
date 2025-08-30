-- Supabase数据库函数，用于处理复杂的业务逻辑
-- 这些函数将替换后端API的核心功能

-- 1. 创建项目并分配角色的函数
CREATE OR REPLACE FUNCTION create_project_with_role(
  project_name TEXT,
  project_description TEXT,
  facilitator_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_project_id UUID;
  wallet_vouchers INTEGER;
BEGIN
  -- 检查用户是否有足够的项目券
  SELECT project_vouchers INTO wallet_vouchers
  FROM user_resource_wallets
  WHERE user_id = facilitator_id;

  IF wallet_vouchers IS NULL OR wallet_vouchers < 1 THEN
    RAISE EXCEPTION 'Insufficient project vouchers. Current: %, Required: 1', COALESCE(wallet_vouchers, 0);
  END IF;

  -- 开始事务
  BEGIN
    -- 创建项目
    INSERT INTO projects (name, description, facilitator_id, status)
    VALUES (project_name, project_description, facilitator_id, 'active')
    RETURNING id INTO new_project_id;

    -- 添加facilitator角色
    INSERT INTO project_roles (user_id, project_id, role, status)
    VALUES (facilitator_id, new_project_id, 'facilitator', 'active');

    -- 消费项目券
    UPDATE user_resource_wallets
    SET project_vouchers = project_vouchers - 1,
        updated_at = NOW()
    WHERE user_id = facilitator_id;

    -- 记录交易
    INSERT INTO seat_transactions (
      user_id, 
      transaction_type, 
      resource_type, 
      amount, 
      project_id,
      metadata
    )
    VALUES (
      facilitator_id, 
      'consume', 
      'project_voucher', 
      -1, 
      new_project_id,
      jsonb_build_object('action', 'project_creation', 'project_name', project_name)
    );

    RETURN new_project_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Failed to create project: %', SQLERRM;
  END;
END;
$$;

-- 2. 发送项目邀请的函数
CREATE OR REPLACE FUNCTION send_project_invitation(
  project_id UUID,
  inviter_id UUID,
  invitee_email TEXT,
  invitation_role TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_id UUID;
  invitation_token TEXT;
  required_seats INTEGER;
  available_seats INTEGER;
BEGIN
  -- 验证邀请者是否是项目的facilitator
  IF NOT EXISTS (
    SELECT 1 FROM project_roles 
    WHERE project_id = send_project_invitation.project_id 
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
  ELSIF invitation_role = 'storyteller' THEN
    SELECT storyteller_seats INTO available_seats
    FROM user_resource_wallets
    WHERE user_id = inviter_id;
    required_seats := 1;
  ELSE
    RAISE EXCEPTION 'Invalid role: %', invitation_role;
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
    expires_at
  )
  VALUES (
    send_project_invitation.project_id,
    inviter_id,
    invitee_email,
    invitation_role,
    'pending',
    invitation_token,
    NOW() + INTERVAL '7 days'
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
      'invitation_id', invitation_id
    )
  );

  RETURN invitation_id;
END;
$$;

-- 3. 接受项目邀请的函数
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
BEGIN
  -- 获取用户邮箱
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = user_id;

  -- 查找有效的邀请
  SELECT * INTO invitation_record
  FROM invitations
  WHERE token = invitation_token
    AND status = 'pending'
    AND expires_at > NOW()
    AND invitee_email = user_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation token';
  END IF;

  -- 检查用户是否已经在项目中
  IF EXISTS (
    SELECT 1 FROM project_roles
    WHERE project_id = invitation_record.project_id
    AND user_id = accept_project_invitation.user_id
    AND role = invitation_record.role
  ) THEN
    RAISE EXCEPTION 'User already has this role in the project';
  END IF;

  BEGIN
    -- 添加用户到项目
    INSERT INTO project_roles (user_id, project_id, role, status)
    VALUES (
      accept_project_invitation.user_id,
      invitation_record.project_id,
      invitation_record.role,
      'active'
    );

    -- 更新邀请状态
    UPDATE invitations
    SET status = 'accepted',
        updated_at = NOW()
    WHERE id = invitation_record.id;

    -- 记录座位激活交易
    INSERT INTO seat_transactions (
      user_id,
      transaction_type,
      resource_type,
      amount,
      project_id,
      metadata
    )
    VALUES (
      invitation_record.inviter_id,
      'activate',
      invitation_record.role || '_seat',
      0, -- 座位已经被预留，这里只是激活
      invitation_record.project_id,
      jsonb_build_object(
        'action', 'invitation_accepted',
        'accepted_by', accept_project_invitation.user_id,
        'invitation_id', invitation_record.id
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'project_id', invitation_record.project_id,
      'role', invitation_record.role,
      'message', 'Invitation accepted successfully'
    );

  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Failed to accept invitation: %', SQLERRM;
  END;
END;
$$;

-- 4. 处理包购买的函数
CREATE OR REPLACE FUNCTION process_package_purchase(
  package_id TEXT,
  payment_intent_id TEXT,
  user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  package_contents JSONB;
  purchase_record RECORD;
BEGIN
  -- 定义包内容
  CASE package_id
    WHEN 'saga-package' THEN
      package_contents := jsonb_build_object(
        'project_vouchers', 1,
        'facilitator_seats', 2,
        'storyteller_seats', 8
      );
    WHEN 'saga-package-family' THEN
      package_contents := jsonb_build_object(
        'project_vouchers', 3,
        'facilitator_seats', 5,
        'storyteller_seats', 20
      );
    WHEN 'saga-package-premium' THEN
      package_contents := jsonb_build_object(
        'project_vouchers', 5,
        'facilitator_seats', 10,
        'storyteller_seats', 50
      );
    ELSE
      RAISE EXCEPTION 'Unknown package ID: %', package_id;
  END CASE;

  -- 检查是否已经处理过这个支付
  SELECT * INTO purchase_record
  FROM seat_transactions
  WHERE metadata->>'payment_intent_id' = payment_intent_id
    AND transaction_type = 'purchase';

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Package already activated',
      'package_id', package_id,
      'wallet_update', package_contents
    );
  END IF;

  BEGIN
    -- 更新或创建用户钱包
    INSERT INTO user_resource_wallets (
      user_id,
      project_vouchers,
      facilitator_seats,
      storyteller_seats
    )
    VALUES (
      process_package_purchase.user_id,
      (package_contents->>'project_vouchers')::INTEGER,
      (package_contents->>'facilitator_seats')::INTEGER,
      (package_contents->>'storyteller_seats')::INTEGER
    )
    ON CONFLICT (user_id) DO UPDATE SET
      project_vouchers = user_resource_wallets.project_vouchers + (package_contents->>'project_vouchers')::INTEGER,
      facilitator_seats = user_resource_wallets.facilitator_seats + (package_contents->>'facilitator_seats')::INTEGER,
      storyteller_seats = user_resource_wallets.storyteller_seats + (package_contents->>'storyteller_seats')::INTEGER,
      updated_at = NOW();

    -- 记录购买交易
    INSERT INTO seat_transactions (
      user_id,
      transaction_type,
      resource_type,
      amount,
      metadata
    )
    VALUES (
      process_package_purchase.user_id,
      'purchase',
      'package',
      1,
      jsonb_build_object(
        'package_id', package_id,
        'payment_intent_id', payment_intent_id,
        'package_contents', package_contents,
        'action', 'package_purchase'
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Package activated successfully',
      'package_id', package_id,
      'wallet_update', package_contents
    );

  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Failed to process package purchase: %', SQLERRM;
  END;
END;
$$;

-- 5. 请求数据导出的函数
CREATE OR REPLACE FUNCTION request_data_export(
  project_id UUID,
  user_id UUID,
  export_options JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  export_id UUID;
BEGIN
  -- 验证用户是否有访问项目的权限
  IF NOT EXISTS (
    SELECT 1 FROM project_roles
    WHERE project_id = request_data_export.project_id
    AND user_id = request_data_export.user_id
    AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Access denied to project';
  END IF;

  -- 创建导出请求
  INSERT INTO export_requests (
    project_id,
    user_id,
    status,
    options,
    created_at
  )
  VALUES (
    request_data_export.project_id,
    request_data_export.user_id,
    'pending',
    export_options,
    NOW()
  )
  RETURNING id INTO export_id;

  RETURN export_id;
END;
$$;

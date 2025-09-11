-- Fix project creation to consume creator's role seat properly
-- This addresses the issue where project creators don't consume their chosen role seat

BEGIN;

-- Update the create_project_with_role function to handle creator role properly
CREATE OR REPLACE FUNCTION create_project_with_role(
  project_name TEXT,
  project_description TEXT,
  facilitator_id UUID,
  creator_role TEXT DEFAULT 'facilitator'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_project_id UUID;
  wallet_vouchers INTEGER;
  available_seats INTEGER;
  seat_type TEXT;
BEGIN
  -- 检查用户是否有足够的项目券
  SELECT project_vouchers INTO wallet_vouchers
  FROM user_resource_wallets
  WHERE user_id = facilitator_id;

  IF wallet_vouchers IS NULL OR wallet_vouchers < 1 THEN
    RAISE EXCEPTION 'Insufficient project vouchers. Current: %, Required: 1', COALESCE(wallet_vouchers, 0);
  END IF;

  -- 检查用户是否有足够的角色席位
  IF creator_role = 'facilitator' THEN
    SELECT facilitator_seats INTO available_seats
    FROM user_resource_wallets
    WHERE user_id = facilitator_id;
    seat_type := 'facilitator_seat';
  ELSE
    SELECT storyteller_seats INTO available_seats
    FROM user_resource_wallets
    WHERE user_id = facilitator_id;
    seat_type := 'storyteller_seat';
  END IF;

  IF available_seats IS NULL OR available_seats < 1 THEN
    RAISE EXCEPTION 'Insufficient % seats. Current: %, Required: 1', creator_role, COALESCE(available_seats, 0);
  END IF;

  -- 开始事务
  BEGIN
    -- 创建项目
    INSERT INTO projects (name, description, facilitator_id, status)
    VALUES (project_name, project_description, facilitator_id, 'active')
    RETURNING id INTO new_project_id;

    -- 添加创建者的角色
    INSERT INTO project_roles (user_id, project_id, role, status)
    VALUES (facilitator_id, new_project_id, creator_role, 'active');

    -- 消费项目券
    UPDATE user_resource_wallets
    SET project_vouchers = project_vouchers - 1,
        updated_at = NOW()
    WHERE user_id = facilitator_id;

    -- 消费角色席位
    IF creator_role = 'facilitator' THEN
      UPDATE user_resource_wallets
      SET facilitator_seats = facilitator_seats - 1,
          updated_at = NOW()
      WHERE user_id = facilitator_id;
    ELSE
      UPDATE user_resource_wallets
      SET storyteller_seats = storyteller_seats - 1,
          updated_at = NOW()
      WHERE user_id = facilitator_id;
    END IF;

    -- 记录项目券交易
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

    -- 记录席位交易
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
      seat_type, 
      -1, 
      new_project_id,
      jsonb_build_object('action', 'project_creation', 'role', creator_role, 'project_name', project_name)
    );

    RETURN new_project_id;
  EXCEPTION
    WHEN OTHERS THEN
      -- 回滚事务
      RAISE;
  END;
END;
$$;

COMMIT;

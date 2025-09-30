-- Create function to clean up expired invitations and release reserved seats
-- This should be run periodically (e.g., by a cron job)

BEGIN;

-- Function to handle expired invitations cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_invitation RECORD;
  processed_count INTEGER := 0;
  released_seats jsonb := '{}';
BEGIN
  -- Process all expired pending invitations
  FOR expired_invitation IN 
    SELECT id, inviter_id, role
    FROM invitations 
    WHERE status = 'pending' 
      AND expires_at < NOW()
  LOOP
    -- Update invitation status to expired
    UPDATE invitations 
    SET status = 'expired', 
        updated_at = NOW()
    WHERE id = expired_invitation.id;
    
    -- Release the reserved seat back to the inviter
    IF expired_invitation.role = 'facilitator' THEN
      UPDATE user_resource_wallets
      SET facilitator_seats = facilitator_seats + 1,
          updated_at = NOW()
      WHERE user_id = expired_invitation.inviter_id;
      
      -- Update released seats counter
      released_seats := jsonb_set(
        released_seats, 
        '{facilitator_seats}', 
        to_jsonb(COALESCE((released_seats->>'facilitator_seats')::integer, 0) + 1)
      );
    ELSE
      UPDATE user_resource_wallets
      SET storyteller_seats = storyteller_seats + 1,
          updated_at = NOW()
      WHERE user_id = expired_invitation.inviter_id;
      
      -- Update released seats counter  
      released_seats := jsonb_set(
        released_seats, 
        '{storyteller_seats}', 
        to_jsonb(COALESCE((released_seats->>'storyteller_seats')::integer, 0) + 1)
      );
    END IF;
    
    -- Record seat release transaction
    INSERT INTO seat_transactions (
      user_id,
      transaction_type,
      resource_type,
      amount,
      metadata
    )
    VALUES (
      expired_invitation.inviter_id,
      'refund',
      expired_invitation.role || '_seat',
      1,
      jsonb_build_object(
        'action', 'invitation_expired',
        'invitation_id', expired_invitation.id,
        'reason', 'automatic_cleanup'
      )
    );
    
    processed_count := processed_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'processed_invitations', processed_count,
    'released_seats', released_seats,
    'timestamp', NOW()
  );
END;
$$;

-- Create a trigger to automatically run cleanup when checking invitations
-- This ensures expired invitations are cleaned up during normal operations
CREATE OR REPLACE FUNCTION trigger_invitation_cleanup()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only run cleanup if we're selecting from invitations table
  -- and there might be expired invitations
  IF TG_OP = 'SELECT' AND EXISTS (
    SELECT 1 FROM invitations 
    WHERE status = 'pending' AND expires_at < NOW() 
    LIMIT 1
  ) THEN
    PERFORM cleanup_expired_invitations();
  END IF;
  
  RETURN NULL;
END;
$$;

-- Note: We don't create an actual SELECT trigger as it would be too frequent
-- Instead, this function can be called manually or via cron job

COMMIT;
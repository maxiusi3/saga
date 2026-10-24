-- Synthetic local rehearsal only; this file is not a deployable migration.
BEGIN;
DO $$ BEGIN
  IF pg_catalog.current_database() <> 'saga_pg17_rehearsal'
     OR pg_catalog.current_setting('saga.pg17_access_guards', true) IS DISTINCT FROM 'only_synthetic_local' THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='local rehearsal only';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.accept_project_invitation(p_invitation_id uuid, p_user_id uuid)
RETURNS TABLE(project_id uuid, user_id uuid, role text, status text, joined_at timestamp with time zone)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  target_project uuid;
  initial_user uuid;
  current_facilitator uuid;
  project_status text;
  member public.project_roles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR $2 IS DISTINCT FROM auth.uid() OR $1 IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='access denied';
  END IF;
  -- The first tuple is a binding-consistency reference, never authorization.
  SELECT r.project_id,r.user_id INTO target_project,initial_user
    FROM public.project_roles AS r WHERE r.id=$1;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='access denied';
  END IF;
  -- Share the export candidate's project -> member lock order. Both locks live
  -- through the caller transaction, and waited-on rows are checked again.
  SELECT p.facilitator_id,p.status INTO current_facilitator,project_status
    FROM public.projects AS p WHERE p.id=target_project FOR UPDATE;
  IF NOT FOUND OR project_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='access denied';
  END IF;
  SELECT r.* INTO member FROM public.project_roles AS r
    WHERE r.id=$1 AND r.project_id=target_project FOR UPDATE;
  IF NOT FOUND
     OR member.project_id IS DISTINCT FROM target_project
     OR member.user_id IS DISTINCT FROM initial_user
     OR member.user_id IS DISTINCT FROM $2
     OR member.status IS DISTINCT FROM 'pending'
     OR member.role IS NULL OR member.role NOT IN ('facilitator','storyteller')
     OR member.invited_by IS NULL OR member.invited_by IS DISTINCT FROM current_facilitator THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='access denied';
  END IF;
  RETURN QUERY UPDATE public.project_roles AS r SET status='active',joined_at=pg_catalog.now()
    WHERE r.id=$1 AND r.project_id=target_project
    RETURNING r.project_id,r.user_id,r.role,r.status,r.joined_at;
END $$;

CREATE OR REPLACE FUNCTION public.create_project_with_role(
  project_name text, project_description text, facilitator_id uuid, creator_role text DEFAULT 'facilitator'::text
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  wallet public.user_resource_wallets%ROWTYPE;
  new_project uuid;
  requested_seats integer;
BEGIN
  IF auth.uid() IS NULL OR $3 IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='access denied';
  END IF;
  IF $4 IS NULL OR $4 NOT IN ('facilitator','storyteller')
     OR $1 IS NULL OR $1 ~ '^[[:space:]]*$' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='valid project name and creator role required';
  END IF;
  -- Never initialize or grant a wallet here. The locked existing balance is the
  -- only resource source for this compatibility entry point.
  SELECT w.* INTO wallet FROM public.user_resource_wallets AS w WHERE w.user_id=$3 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='resources unavailable';
  END IF;
  requested_seats := CASE WHEN $4='facilitator' THEN wallet.facilitator_seats ELSE wallet.storyteller_seats END;
  IF wallet.project_vouchers IS NULL OR wallet.project_vouchers<1
     OR requested_seats IS NULL OR requested_seats<1 THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='resources unavailable';
  END IF;
  UPDATE public.user_resource_wallets AS w SET
    project_vouchers=w.project_vouchers-1,
    facilitator_seats=CASE WHEN $4='facilitator' THEN w.facilitator_seats-1 ELSE w.facilitator_seats END,
    storyteller_seats=CASE WHEN $4='storyteller' THEN w.storyteller_seats-1 ELSE w.storyteller_seats END
    WHERE w.user_id=$3;
  INSERT INTO public.projects AS p(name,description,facilitator_id,owner_id,status,payment_status)
    VALUES($1,NULLIF($2,''),$3,$3,'active','unverified') RETURNING p.id INTO new_project;
  INSERT INTO public.project_roles(user_id,project_id,role,status,invited_by,joined_at)
    VALUES($3,new_project,$4,'active',$3,pg_catalog.now());
  INSERT INTO public.seat_transactions(user_id,transaction_type,resource_type,amount,project_id)
    VALUES($3,'consume','project_voucher',-1,new_project),($3,'consume',$4||'_seat',-1,new_project);
  RETURN new_project;
END $$;

REVOKE EXECUTE ON FUNCTION public.accept_project_invitation(uuid,uuid) FROM PUBLIC, anon, metadata_reader, service_role;
REVOKE EXECUTE ON FUNCTION public.create_project_with_role(text,text,uuid,text) FROM PUBLIC, anon, metadata_reader, service_role;
GRANT EXECUTE ON FUNCTION public.accept_project_invitation(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_project_with_role(text,text,uuid,text) TO authenticated;
COMMIT;

-- Local rehearsal only. Register durable requests; no worker or delivery promise.
BEGIN;
DO $$ BEGIN
  IF pg_catalog.current_database() <> 'saga_pg17_rehearsal'
     OR pg_catalog.current_setting('saga.pg17_rehearsal', true) IS DISTINCT FROM 'only_synthetic_local' THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='local rehearsal only';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.request_data_export(
  p_user_id uuid, p_project_id uuid, p_include_audio boolean, p_include_photos boolean
) RETURNS TABLE(export_id uuid, status text, created_at timestamp with time zone)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  facilitator uuid;
  member_id uuid;
BEGIN
  IF auth.uid() IS NULL OR $1 IS DISTINCT FROM auth.uid() OR $2 IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='export access denied';
  END IF;
  IF $3 IS NULL OR $4 IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='boolean options required';
  END IF;
  -- Hold project first, then the membership row through the caller transaction.
  SELECT p.facilitator_id INTO facilitator FROM public.projects AS p WHERE p.id=$2 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='export access denied';
  END IF;
  IF facilitator IS DISTINCT FROM $1 THEN
    SELECT r.id INTO member_id FROM public.project_roles AS r
      WHERE r.project_id=$2 AND r.user_id=$1 AND r.status='active' FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='export access denied';
    END IF;
  END IF;
  RETURN QUERY INSERT INTO public.export_requests AS e(project_id,user_id,status,options)
    VALUES($2,$1,'pending',pg_catalog.jsonb_build_object('includeAudio',$3,'includePhotos',$4))
    RETURNING e.id,'queued'::text,e.created_at;
END $$;

CREATE OR REPLACE FUNCTION public.request_data_export(project_id uuid, user_id uuid, export_options jsonb)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  facilitator uuid;
  member_id uuid;
  request_id uuid;
  normalized jsonb;
BEGIN
  IF auth.uid() IS NULL OR $2 IS DISTINCT FROM auth.uid() OR $1 IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='export access denied';
  END IF;
  IF $3 IS NULL OR pg_catalog.jsonb_typeof($3) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='option object required';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_each($3) AS o
    WHERE o.key NOT IN ('includeAudio','includePhotos','includeTranscripts','includeInteractions')
      OR pg_catalog.jsonb_typeof(o.value) IS DISTINCT FROM 'boolean') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='unapproved export option';
  END IF;
  -- Missing keys default true, matching the existing dialog's initial choices.
  normalized := pg_catalog.jsonb_build_object(
    'includeAudio',COALESCE(($3->>'includeAudio')::boolean,true),
    'includePhotos',COALESCE(($3->>'includePhotos')::boolean,true),
    'includeTranscripts',COALESCE(($3->>'includeTranscripts')::boolean,true),
    'includeInteractions',COALESCE(($3->>'includeInteractions')::boolean,true));
  SELECT p.facilitator_id INTO facilitator FROM public.projects AS p WHERE p.id=$1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='export access denied';
  END IF;
  IF facilitator IS DISTINCT FROM $2 THEN
    SELECT r.id INTO member_id FROM public.project_roles AS r
      WHERE r.project_id=$1 AND r.user_id=$2 AND r.status='active' FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='export access denied';
    END IF;
  END IF;
  INSERT INTO public.export_requests AS e(project_id,user_id,status,options)
    VALUES($1,$2,'pending',normalized) RETURNING e.id INTO request_id;
  RETURN request_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.request_data_export(uuid,uuid,boolean,boolean)
  FROM PUBLIC, anon, metadata_reader, service_role;
REVOKE EXECUTE ON FUNCTION public.request_data_export(uuid,uuid,jsonb)
  FROM PUBLIC, anon, metadata_reader, service_role;
GRANT EXECUTE ON FUNCTION public.request_data_export(uuid,uuid,boolean,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_data_export(uuid,uuid,jsonb) TO authenticated;
COMMIT;

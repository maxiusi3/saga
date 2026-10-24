-- =============================================================================
-- Migration: 20261024000001_p1_foundation_and_reconciliation.sql
-- Purpose:
--   1. Idempotently reconcile the 7 unregistered 2026 root migrations against
--      the captured remote schema/ACL/policy snapshot without destructive replay.
--   2. Establish the P1 reliable data foundation tables (T02 media_assets &
--      legacy_media_references, T05 processing_jobs & processing_attempts,
--      T03 consent_records, deletion_requests & deletion_targets, and
--      T04 recording_sessions & recording_chunks) with strict RLS & grants.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Part 1: Idempotent Reconciliation of Unregistered Root Migrations
-- -----------------------------------------------------------------------------

-- 1.1 Revoke blanket authenticated/anon DML grants re-opened by 20260625081000
REVOKE INSERT, UPDATE, DELETE ON public.agent_runs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.story_artifacts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.public_archive_entries FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_resource_wallets FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.waitlist FROM anon, authenticated;

-- 1.2 Drop surviving permissive client wallet write policies missed by 20261006000001
DROP POLICY IF EXISTS "Users can insert own wallet" ON public.user_resource_wallets;
DROP POLICY IF EXISTS "Users can update own wallet" ON public.user_resource_wallets;
DROP POLICY IF EXISTS "wallet_insert_self" ON public.user_resource_wallets;
DROP POLICY IF EXISTS "wallet_update_self" ON public.user_resource_wallets;

-- 1.3 Idempotently add missing columns expected by settings-service.ts & notifications.ts
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone_number text;

ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS email_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_enabled boolean DEFAULT false;

-- 1.4 Revoke public/authenticated SELECT on waitlist_stats view
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'waitlist_stats'
  ) THEN
    EXECUTE 'REVOKE SELECT ON public.waitlist_stats FROM anon, authenticated';
    EXECUTE 'GRANT SELECT ON public.waitlist_stats TO service_role';
  END IF;
END $$;

-- 1.5 Narrow SECURITY DEFINER project membership helpers (preventing RLS recursion)
CREATE OR REPLACE FUNCTION public.is_project_facilitator(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_project_id IS NOT NULL
    AND p_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = p_project_id
        AND p.facilitator_id = p_user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.is_active_project_member(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_project_id IS NOT NULL
    AND p_user_id IS NOT NULL
    AND (
      public.is_project_facilitator(p_project_id, p_user_id)
      OR EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = p_project_id
          AND pm.user_id = p_user_id
          AND pm.status = 'active'
      )
      OR EXISTS (
        SELECT 1 FROM public.project_roles pr
        WHERE pr.project_id = p_project_id
          AND pr.user_id = p_user_id
          AND pr.status = 'active'
      )
    );
$$;

REVOKE ALL ON FUNCTION public.is_project_facilitator(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_project_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_project_facilitator(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_active_project_member(uuid, uuid) TO authenticated, service_role;

-- 1.6 Fix storage.objects saga policies (storage.foldername(objects.name) instead of p.name)
DROP POLICY IF EXISTS "Project members can view project files" ON storage.objects;
CREATE POLICY "Project members can view project files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'saga'
    AND (storage.foldername(objects.name))[1] = 'projects'
    AND (storage.foldername(objects.name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_active_project_member(((storage.foldername(objects.name))[2])::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "Project members can upload project files" ON storage.objects;
CREATE POLICY "Project members can upload project files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'saga'
    AND (storage.foldername(objects.name))[1] = 'projects'
    AND (storage.foldername(objects.name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_active_project_member(((storage.foldername(objects.name))[2])::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "Project owners and facilitators can delete project files" ON storage.objects;
CREATE POLICY "Project owners and facilitators can delete project files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'saga'
    AND (storage.foldername(objects.name))[1] = 'projects'
    AND (storage.foldername(objects.name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_project_facilitator(((storage.foldername(objects.name))[2])::uuid, auth.uid())
  );

-- -----------------------------------------------------------------------------
-- Part 2: P1 Reliable Data Foundation Tables (T02 / T05 / T03 / T04)
-- -----------------------------------------------------------------------------

-- 2.1 T02: media_assets & legacy_media_references
CREATE TABLE IF NOT EXISTS public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  story_id uuid REFERENCES public.stories(id) ON DELETE SET NULL,
  parent_asset_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  bucket text NOT NULL CHECK (bucket IN ('audio-recordings', 'saga')),
  object_key text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('original_audio', 'original_image', 'thumbnail', 'derived_audio')),
  mime_type text NOT NULL,
  byte_size bigint CHECK (byte_size IS NULL OR byte_size >= 0),
  sha256 text CHECK (sha256 IS NULL OR sha256 ~* '^[a-f0-9]{64}$'),
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms > 0),
  original_filename text NOT NULL DEFAULT 'unnamed-asset',
  state text NOT NULL DEFAULT 'pending_upload'
    CHECK (state IN ('pending_upload', 'uploaded', 'verifying', 'ready', 'quarantined', 'deleting', 'deleted')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  idempotency_key text,
  verification_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  content_verified_at timestamptz,
  UNIQUE (bucket, object_key),
  UNIQUE (project_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_media_assets_project_state
  ON public.media_assets(project_id, state);
CREATE INDEX IF NOT EXISTS idx_media_assets_story_id
  ON public.media_assets(story_id);

CREATE TABLE IF NOT EXISTS public.legacy_media_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_table text NOT NULL,
  source_row_id uuid NOT NULL,
  source_field text NOT NULL,
  source_index integer NOT NULL DEFAULT 0 CHECK (source_index >= 0),
  raw_reference text NOT NULL,
  resolved_bucket text,
  resolved_object_key text,
  asset_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  mapping_state text NOT NULL DEFAULT 'unresolved'
    CHECK (mapping_state IN ('mapped', 'bound', 'unresolved', 'conflict', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  UNIQUE (project_id, source_table, source_row_id, source_field, source_index, raw_reference)
);

-- 2.2 T03: consent_records, deletion_requests & deletion_targets
CREATE TABLE IF NOT EXISTS public.consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  grantor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  subject_id text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('recording', 'cloud_ai', 'family_share', 'public_archive')),
  policy_version text NOT NULL,
  provider text NOT NULL,
  region text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_consent_records_lookup
  ON public.consent_records(project_id, subject_id, purpose);

CREATE TABLE IF NOT EXISTS public.deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  subject_id text NOT NULL,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'requested'
    CHECK (state IN ('requested', 'processing', 'failed', 'completed')),
  tombstone_at timestamptz NOT NULL DEFAULT now(),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  requested_at timestamptz NOT NULL DEFAULT now(),
  processing_at timestamptz,
  completed_at timestamptz,
  error_code text
);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_subject_tombstone
  ON public.deletion_requests(project_id, subject_id)
  WHERE tombstone_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.deletion_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deletion_request_id uuid NOT NULL REFERENCES public.deletion_requests(id) ON DELETE CASCADE,
  target_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('media_asset', 'storage_object', 'story', 'derived_artifact')),
  bucket text,
  object_key text,
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'processing', 'failed', 'deleted', 'not_found')),
  error_code text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deletion_request_id, target_id)
);

-- 2.3 T05: processing_jobs & processing_attempts
CREATE TABLE IF NOT EXISTS public.processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  input_version integer NOT NULL DEFAULT 1 CHECK (input_version > 0),
  job_type text NOT NULL,
  processor_version text NOT NULL,
  model_config_version text NOT NULL,
  parameter_version text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'queued'
    CHECK (state IN ('queued', 'leased', 'running', 'retry_wait', 'succeeded', 'failed', 'outcome_unknown', 'awaiting_review', 'cancelled')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  not_before timestamptz,
  lease_owner text,
  lease_expires_at timestamptz,
  cancel_requested_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  result_ref text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_project_state
  ON public.processing_jobs(project_id, state);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_asset_id
  ON public.processing_jobs(asset_id);

CREATE TABLE IF NOT EXISTS public.processing_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.processing_jobs(id) ON DELETE CASCADE,
  attempt_no integer NOT NULL CHECK (attempt_no > 0),
  worker_id text NOT NULL,
  provider text,
  provider_request_id text,
  dispatched_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  result_state text NOT NULL DEFAULT 'running'
    CHECK (result_state IN ('running', 'succeeded', 'retryable_error', 'fatal_error', 'outcome_unknown', 'cancelled')),
  usage_units numeric(12, 4),
  reserved_cost_usd numeric(12, 6),
  settled_cost_usd numeric(12, 6),
  error_code text,
  UNIQUE (job_id, attempt_no)
);

-- 2.4 T04: recording_sessions & recording_chunks
CREATE TABLE IF NOT EXISTS public.recording_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  story_id uuid REFERENCES public.stories(id) ON DELETE SET NULL,
  mime_type text NOT NULL,
  state text NOT NULL DEFAULT 'recording'
    CHECK (state IN ('recording', 'sealing', 'merging', 'cloud_confirmed', 'failed', 'aborted')),
  total_chunks integer CHECK (total_chunks IS NULL OR total_chunks > 0),
  total_input_bytes bigint CHECK (total_input_bytes IS NULL OR total_input_bytes > 0),
  manifest_sha256 text CHECK (manifest_sha256 IS NULL OR manifest_sha256 ~* '^[a-f0-9]{64}$'),
  confirmed_asset_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  merge_job_id uuid REFERENCES public.processing_jobs(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  sealed_at timestamptz,
  confirmed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.recording_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.recording_sessions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  bucket text NOT NULL DEFAULT 'audio-recordings' CHECK (bucket = 'audio-recordings'),
  object_key text NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size > 0),
  sha256 text NOT NULL CHECK (sha256 ~* '^[a-f0-9]{64}$'),
  persisted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, chunk_index),
  UNIQUE (bucket, object_key)
);

-- -----------------------------------------------------------------------------
-- Part 3: RLS & Least-Privilege Grants on P1 Foundation Tables
-- -----------------------------------------------------------------------------

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_media_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletion_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_chunks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
  public.media_assets,
  public.legacy_media_references,
  public.consent_records,
  public.deletion_requests,
  public.deletion_targets,
  public.processing_jobs,
  public.processing_attempts,
  public.recording_sessions,
  public.recording_chunks
FROM anon, authenticated;

GRANT SELECT ON
  public.media_assets,
  public.consent_records,
  public.deletion_requests,
  public.processing_jobs,
  public.recording_sessions
TO authenticated;

GRANT ALL ON
  public.media_assets,
  public.legacy_media_references,
  public.consent_records,
  public.deletion_requests,
  public.deletion_targets,
  public.processing_jobs,
  public.processing_attempts,
  public.recording_sessions,
  public.recording_chunks
TO service_role;

-- Read policies for authenticated active project members (excluding tombstoned/deleted assets)
DROP POLICY IF EXISTS "media_assets_select_active_member" ON public.media_assets;
CREATE POLICY "media_assets_select_active_member" ON public.media_assets
  FOR SELECT TO authenticated
  USING (
    state = 'ready'
    AND public.is_active_project_member(project_id, auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.deletion_requests dr
      WHERE dr.project_id = media_assets.project_id
        AND (dr.subject_id = media_assets.id::text OR dr.subject_id = media_assets.story_id::text)
        AND dr.tombstone_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "consent_records_select_active_member" ON public.consent_records;
CREATE POLICY "consent_records_select_active_member" ON public.consent_records
  FOR SELECT TO authenticated
  USING (public.is_active_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "deletion_requests_select_active_member" ON public.deletion_requests;
CREATE POLICY "deletion_requests_select_active_member" ON public.deletion_requests
  FOR SELECT TO authenticated
  USING (public.is_active_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "processing_jobs_select_active_member" ON public.processing_jobs;
CREATE POLICY "processing_jobs_select_active_member" ON public.processing_jobs
  FOR SELECT TO authenticated
  USING (public.is_active_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "recording_sessions_select_owner_or_member" ON public.recording_sessions;
CREATE POLICY "recording_sessions_select_owner_or_member" ON public.recording_sessions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND public.is_active_project_member(project_id, auth.uid())
  );

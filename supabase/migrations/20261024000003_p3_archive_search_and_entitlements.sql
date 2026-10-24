-- =============================================================================
-- Migration: 20261024000003_p3_archive_search_and_entitlements.sql
-- Phase P3: Complete Archival Snapshot (T09), Provenance Search Index (T10),
--           and US$59 Project Package Entitlements & Idempotent Webhooks (T11)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. T09: Immutable Publication Snapshots (public.publication_snapshots)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.publication_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  snapshot_version integer NOT NULL CHECK (snapshot_version > 0),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  story_revision_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  chapter_outline jsonb NOT NULL DEFAULT '[]'::jsonb,
  manifest_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  pdf_sha256 text NOT NULL CHECK (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  archive_zip_sha256 text CHECK (archive_zip_sha256 IS NULL OR archive_zip_sha256 ~ '^[0-9a-f]{64}$'),
  hosting_months integer NOT NULL DEFAULT 12 CHECK (hosting_months > 0),
  retention_expires_at timestamptz NOT NULL,
  reminder_90d_at timestamptz NOT NULL,
  reminder_30d_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, snapshot_version)
);

CREATE INDEX IF NOT EXISTS idx_publication_snapshots_project
  ON public.publication_snapshots (project_id, snapshot_version DESC);

CREATE OR REPLACE FUNCTION public.prevent_publication_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Published snapshots are immutable and cannot be deleted directly (snapshot_id=%).', OLD.id
      USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Published snapshots are immutable and cannot be overwritten directly (snapshot_id=%). Create a new snapshot_version instead.', OLD.id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_publication_snapshot_mutation ON public.publication_snapshots;
CREATE TRIGGER trg_prevent_publication_snapshot_mutation
  BEFORE UPDATE OR DELETE ON public.publication_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_publication_snapshot_mutation();

-- -----------------------------------------------------------------------------
-- 2. T10: Versioned Permission-Filtered Provenance Search Index
--         (public.search_index_entries)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.search_index_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  transcript_version_id uuid NOT NULL REFERENCES public.transcript_versions(id) ON DELETE CASCADE,
  story_revision_id uuid REFERENCES public.story_revisions(id) ON DELETE CASCADE,
  segment_id uuid NOT NULL REFERENCES public.transcript_segments(id) ON DELETE CASCADE,
  index_version integer NOT NULL DEFAULT 1 CHECK (index_version > 0),
  is_active_index boolean NOT NULL DEFAULT true,
  entity_people text[] NOT NULL DEFAULT '{}'::text[],
  entity_dates text[] NOT NULL DEFAULT '{}'::text[],
  entity_places text[] NOT NULL DEFAULT '{}'::text[],
  searchable_text text NOT NULL,
  start_ms integer NOT NULL CHECK (start_ms >= 0),
  end_ms integer NOT NULL CHECK (end_ms > start_ms),
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(searchable_text, ''))) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_index_entries_project_active
  ON public.search_index_entries (project_id, is_active_index, index_version DESC);

CREATE INDEX IF NOT EXISTS idx_search_index_entries_tsv
  ON public.search_index_entries USING GIN (tsv);

CREATE INDEX IF NOT EXISTS idx_search_index_entries_people
  ON public.search_index_entries USING GIN (entity_people);

CREATE INDEX IF NOT EXISTS idx_search_index_entries_dates
  ON public.search_index_entries USING GIN (entity_dates);

CREATE INDEX IF NOT EXISTS idx_search_index_entries_places
  ON public.search_index_entries USING GIN (entity_places);

-- -----------------------------------------------------------------------------
-- 3. T11: US$59 Project Package Entitlements & Out-of-Order/Duplicate Webhooks
--         (public.entitlement_sources, public.entitlement_events)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.entitlement_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text COLLATE "C" NOT NULL CHECK (provider ~ '^[A-Za-z0-9_.:-]{1,64}$'),
  source_key text COLLATE "C" NOT NULL CHECK (source_key ~ '^[A-Za-z0-9_.:-]{1,128}$'),
  package_id text NOT NULL CHECK (package_id IN ('digital_project_59', 'starter', 'family', 'extended')),
  payer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'usd' CHECK (currency = 'usd'),
  project_vouchers_issued integer NOT NULL DEFAULT 1 CHECK (project_vouchers_issued >= 0),
  facilitator_seats_issued integer NOT NULL DEFAULT 1 CHECK (facilitator_seats_issued >= 0),
  storyteller_seats_issued integer NOT NULL DEFAULT 1 CHECK (storyteller_seats_issued >= 0),
  storyteller_limit integer NOT NULL DEFAULT 1 CHECK (storyteller_limit > 0),
  audio_minutes_limit integer NOT NULL DEFAULT 120 CHECK (audio_minutes_limit > 0),
  photos_limit integer NOT NULL DEFAULT 20 CHECK (photos_limit >= 0),
  hosting_months integer NOT NULL DEFAULT 12 CHECK (hosting_months > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'refunded')),
  first_event_id text COLLATE "C" NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, source_key)
);

CREATE TABLE IF NOT EXISTS public.entitlement_events (
  provider text COLLATE "C" NOT NULL CHECK (provider ~ '^[A-Za-z0-9_.:-]{1,64}$'),
  event_id text COLLATE "C" NOT NULL CHECK (event_id ~ '^[A-Za-z0-9_.:-]{1,128}$'),
  source_key text COLLATE "C" NOT NULL CHECK (source_key ~ '^[A-Za-z0-9_.:-]{1,128}$'),
  event_kind text NOT NULL CHECK (event_kind IN ('grant', 'revoke', 'refund', 'cancel', 'failed')),
  package_id text NOT NULL CHECK (package_id IN ('digital_project_59', 'starter', 'family', 'extended')),
  payer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  source_id uuid REFERENCES public.entitlement_sources(id) ON DELETE SET NULL,
  outcome text NOT NULL CHECK (outcome IN ('granted', 'already_granted', 'revoked', 'already_revoked', 'grant_suppressed', 'recorded_failure')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, event_id)
);

CREATE OR REPLACE FUNCTION public.apply_entitlement_event(
  p_provider text,
  p_event_id text,
  p_source_key text,
  p_event_kind text,
  p_package_id text,
  p_payer_id uuid,
  p_amount_cents integer,
  p_project_id uuid DEFAULT NULL
)
RETURNS TABLE (
  source_id uuid,
  outcome text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing_event public.entitlement_events;
  v_source public.entitlement_sources;
  v_vouchers integer := 1;
  v_fac_seats integer := 1;
  v_sto_seats integer := 1;
  v_outcome text;
BEGIN
  IF p_provider IS NULL OR p_event_id IS NULL OR p_source_key IS NULL OR p_payer_id IS NULL THEN
    RAISE EXCEPTION 'Missing required entitlement event parameters' USING ERRCODE = '22023';
  END IF;
  IF p_event_kind NOT IN ('grant', 'revoke', 'refund', 'cancel', 'failed') THEN
    RAISE EXCEPTION 'Invalid entitlement event_kind: %', p_event_kind USING ERRCODE = '22023';
  END IF;
  IF p_package_id NOT IN ('digital_project_59', 'starter', 'family', 'extended') THEN
    RAISE EXCEPTION 'Invalid package_id: %', p_package_id USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('entitlement_event:' || p_provider || ':' || p_event_id, 0));

  SELECT * INTO v_existing_event
  FROM public.entitlement_events e
  WHERE e.provider = p_provider AND e.event_id = p_event_id;

  IF FOUND THEN
    IF (v_existing_event.source_key, v_existing_event.event_kind, v_existing_event.package_id, v_existing_event.payer_id, v_existing_event.amount_cents)
       IS DISTINCT FROM (p_source_key, p_event_kind, p_package_id, p_payer_id, p_amount_cents) THEN
      RAISE EXCEPTION 'Entitlement event payload conflict for (%, %)', p_provider, p_event_id USING ERRCODE = '22023';
    END IF;
    IF v_existing_event.source_id IS NOT NULL THEN
      SELECT * INTO v_source FROM public.entitlement_sources s WHERE s.id = v_existing_event.source_id;
    END IF;
    RETURN QUERY SELECT
      v_existing_event.source_id,
      CASE v_existing_event.outcome
        WHEN 'granted' THEN 'already_granted'::text
        WHEN 'revoked' THEN 'already_revoked'::text
        ELSE v_existing_event.outcome
      END,
      COALESCE(v_source.status, 'failed');
    RETURN;
  END IF;

  IF p_event_kind IN ('cancel', 'failed') THEN
    INSERT INTO public.entitlement_events (
      provider, event_id, source_key, event_kind, package_id, payer_id, amount_cents, source_id, outcome
    ) VALUES (
      p_provider, p_event_id, p_source_key, p_event_kind, p_package_id, p_payer_id, p_amount_cents, NULL, 'recorded_failure'
    );
    RETURN QUERY SELECT NULL::uuid, 'recorded_failure'::text, 'failed'::text;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('entitlement_source:' || p_provider || ':' || p_source_key, 0));

  IF p_package_id = 'digital_project_59' THEN
    v_vouchers := 1; v_fac_seats := 1; v_sto_seats := 1;
  ELSIF p_package_id = 'starter' THEN
    v_vouchers := 1; v_fac_seats := 1; v_sto_seats := 2;
  ELSIF p_package_id = 'family' THEN
    v_vouchers := 1; v_fac_seats := 2; v_sto_seats := 4;
  ELSIF p_package_id = 'extended' THEN
    v_vouchers := 2; v_fac_seats := 4; v_sto_seats := 8;
  END IF;

  SELECT * INTO v_source
  FROM public.entitlement_sources s
  WHERE s.provider = p_provider AND s.source_key = p_source_key
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.user_resource_wallets (user_id, project_vouchers, facilitator_seats, storyteller_seats)
    VALUES (p_payer_id, 0, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.entitlement_sources (
      provider, source_key, package_id, payer_id, project_id, amount_cents, currency,
      project_vouchers_issued, facilitator_seats_issued, storyteller_seats_issued,
      status, first_event_id, revoked_at
    ) VALUES (
      p_provider, p_source_key, p_package_id, p_payer_id, p_project_id, p_amount_cents, 'usd',
      CASE WHEN p_event_kind = 'grant' THEN v_vouchers ELSE 0 END,
      CASE WHEN p_event_kind = 'grant' THEN v_fac_seats ELSE 0 END,
      CASE WHEN p_event_kind = 'grant' THEN v_sto_seats ELSE 0 END,
      CASE
        WHEN p_event_kind = 'grant' THEN 'active'
        WHEN p_event_kind = 'refund' THEN 'refunded'
        ELSE 'revoked'
      END,
      p_event_id,
      CASE WHEN p_event_kind IN ('revoke', 'refund') THEN pg_catalog.clock_timestamp() ELSE NULL END
    )
    RETURNING * INTO v_source;

    IF p_event_kind = 'grant' THEN
      UPDATE public.user_resource_wallets w
      SET project_vouchers = COALESCE(w.project_vouchers, 0) + v_vouchers,
          facilitator_seats = COALESCE(w.facilitator_seats, 0) + v_fac_seats,
          storyteller_seats = COALESCE(w.storyteller_seats, 0) + v_sto_seats,
          updated_at = pg_catalog.clock_timestamp()
      WHERE w.user_id = p_payer_id;
      v_outcome := 'granted';
    ELSE
      v_outcome := 'revoked';
    END IF;
  ELSE
    IF (v_source.payer_id, v_source.package_id) IS DISTINCT FROM (p_payer_id, p_package_id) THEN
      RAISE EXCEPTION 'Entitlement source payload conflict for (%, %)', p_provider, p_source_key USING ERRCODE = '22023';
    END IF;

    IF p_event_kind = 'grant' THEN
      IF v_source.status IN ('revoked', 'refunded') THEN
        v_outcome := 'grant_suppressed';
      ELSE
        v_outcome := 'already_granted';
      END IF;
    ELSE
      IF v_source.status IN ('revoked', 'refunded') THEN
        v_outcome := 'already_revoked';
      ELSE
        UPDATE public.entitlement_sources s
        SET status = CASE WHEN p_event_kind = 'refund' THEN 'refunded' ELSE 'revoked' END,
            revoked_at = pg_catalog.clock_timestamp(),
            updated_at = pg_catalog.clock_timestamp()
        WHERE s.id = v_source.id
        RETURNING * INTO v_source;

        IF v_source.project_id IS NOT NULL THEN
          UPDATE public.project_roles pr
          SET status = 'revoked'
          WHERE pr.project_id = v_source.project_id
            AND pr.user_id <> p_payer_id
            AND pr.status = 'active';
        END IF;
        v_outcome := 'revoked';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.entitlement_events (
    provider, event_id, source_key, event_kind, package_id, payer_id, amount_cents, source_id, outcome
  ) VALUES (
    p_provider, p_event_id, p_source_key, p_event_kind, p_package_id, p_payer_id, p_amount_cents, v_source.id, v_outcome
  );

  RETURN QUERY SELECT v_source.id, v_outcome, v_source.status;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_entitlement_event(text, text, text, text, text, uuid, integer, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_entitlement_event(text, text, text, text, text, uuid, integer, uuid)
  TO service_role;

-- -----------------------------------------------------------------------------
-- 4. RLS & Privileges on P3 Tables
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'publication_snapshots',
    'search_index_entries',
    'entitlement_sources',
    'entitlement_events'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', v_table);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', v_table);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', v_table);
  END LOOP;
END $$;

-- publication_snapshots: readable by active project members
DROP POLICY IF EXISTS "p3_publication_snapshots_select_member" ON public.publication_snapshots;
CREATE POLICY "p3_publication_snapshots_select_member"
  ON public.publication_snapshots
  FOR SELECT
  TO authenticated
  USING (public.is_active_project_member(project_id, auth.uid()));

-- search_index_entries: readable only when active index, active member, and neither story nor media asset is tombstoned
DROP POLICY IF EXISTS "p3_search_index_entries_select_member" ON public.search_index_entries;
CREATE POLICY "p3_search_index_entries_select_member"
  ON public.search_index_entries
  FOR SELECT
  TO authenticated
  USING (
    is_active_index = true
    AND public.is_active_project_member(project_id, auth.uid())
    AND NOT EXISTS (
      SELECT 1
      FROM public.deletion_requests dr
      WHERE dr.project_id = search_index_entries.project_id
        AND dr.subject_id = search_index_entries.story_id::text
        AND dr.tombstone_at IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.transcript_versions tv
      WHERE tv.id = search_index_entries.transcript_version_id
        AND tv.asset_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.deletion_requests dr2
          WHERE dr2.project_id = search_index_entries.project_id
            AND dr2.subject_id = tv.asset_id::text
            AND dr2.tombstone_at IS NOT NULL
        )
    )
  );

-- entitlement_sources & entitlement_events: readable only by the payer
DROP POLICY IF EXISTS "p3_entitlement_sources_select_payer" ON public.entitlement_sources;
CREATE POLICY "p3_entitlement_sources_select_payer"
  ON public.entitlement_sources
  FOR SELECT
  TO authenticated
  USING (payer_id = auth.uid());

DROP POLICY IF EXISTS "p3_entitlement_events_select_payer" ON public.entitlement_events;
CREATE POLICY "p3_entitlement_events_select_payer"
  ON public.entitlement_events
  FOR SELECT
  TO authenticated
  USING (payer_id = auth.uid());

COMMIT;

-- =============================================================================
-- Migration: 20261024000004_p4_pilot_cohort_and_g4_analytics.sql
-- Phase P4: Longitudinal Household Pilot Ledger & G4 Decision Analytics (T13)
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.pilot_households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  household_User_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cohort_type text NOT NULL CHECK (cohort_type IN ('prototype_study', 'ai_eval_holdout', 'longitudinal_pilot')),
  pricing_tier text NOT NULL CHECK (pricing_tier IN ('free', 'half_price', 'subsidized', 'paid_59')),
  support_mode text NOT NULL DEFAULT 'self_serve' CHECK (support_mode IN ('self_serve', 'family_assisted')),
  acquisition_channel text NOT NULL DEFAULT 'direct_invite',
  country text NOT NULL DEFAULT 'US',
  product_version text NOT NULL DEFAULT '2026.10-p4',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  invite_accepted_at timestamptz,
  first_recording_saved_at timestamptz,
  first_approved_download_at timestamptz,
  project_completed_at timestamptz,
  delivered_at timestamptz,
  replayed_within_14d_at timestamptz,
  withdrawn_at timestamptz,
  incomplete_reason text,
  family_revision_minutes numeric(8, 2) NOT NULL DEFAULT 0 CHECK (family_revision_minutes >= 0),
  ops_support_minutes numeric(8, 2) NOT NULL DEFAULT 0 CHECK (ops_support_minutes >= 0),
  paid_amount_cents integer NOT NULL DEFAULT 0 CHECK (paid_amount_cents >= 0),
  refunded_amount_cents integer NOT NULL DEFAULT 0 CHECK (refunded_amount_cents >= 0),
  payment_fee_cents integer NOT NULL DEFAULT 0 CHECK (payment_fee_cents >= 0),
  ai_and_storage_cost_cents integer NOT NULL DEFAULT 0 CHECK (ai_and_storage_cost_cents >= 0),
  nps_score integer CHECK (nps_score IS NULL OR (nps_score >= 0 AND nps_score <= 10)),
  would_recommend boolean,
  referrals_count integer NOT NULL DEFAULT 0 CHECK (referrals_count >= 0),
  severe_data_incidents integer NOT NULL DEFAULT 0 CHECK (severe_data_incidents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, cohort_type)
);

CREATE INDEX IF NOT EXISTS idx_pilot_households_cohort_pricing
  ON public.pilot_households (cohort_type, pricing_tier, enrolled_at);

ALTER TABLE public.pilot_households ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.pilot_households FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.pilot_households TO authenticated;
GRANT ALL ON TABLE public.pilot_households TO service_role;

DROP POLICY IF EXISTS "p4_pilot_households_select_facilitator" ON public.pilot_households;
CREATE POLICY "p4_pilot_households_select_facilitator"
  ON public.pilot_households
  FOR SELECT
  TO authenticated
  USING (
    household_user_id = auth.uid()
    OR public.is_project_facilitator(project_id, auth.uid())
  );

COMMIT;

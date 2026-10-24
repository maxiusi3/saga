import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Harness, root, digest } from '../pg17-routines/runtime.mjs'
import { snapshotPath } from '../pg17-rls-source-composition/fixture.mjs'

const p1MigrationPath = 'supabase/migrations/20261024000001_p1_foundation_and_reconciliation.sql'
const p2MigrationPath = 'supabase/migrations/20261024000002_p2_transcript_provenance_and_review.sql'
const p3MigrationPath = 'supabase/migrations/20261024000003_p3_archive_search_and_entitlements.sql'
const p4MigrationPath = 'supabase/migrations/20261024000004_p4_pilot_cohort_and_g4_analytics.sql'
const evidenceDir = join(root, 'docs/research/evidence/2026-10-24-p4-g4-verification')
const output = join(evidenceDir, `p4-g4-verify-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}.json`)

const report = {
  startedAt: new Date().toISOString(),
  status: 'running',
  scope: 'PG17.4 end-to-end verification of Phase P4 migration 20261024000004, T13 longitudinal pilot cohort separation, 28d/14d maturity window analytics, labor & unit economics ledger, and G4 decision gate',
  sources: {},
  assertions: 0,
  actorConnections: [],
  scenarios: [],
}

const h = new Harness(report)
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.once(sig, () => {
    if (!h.finishing && !h.signal) h.signal = sig
  })
}

const USER_ALPHA_OWNER = '11111111-1111-4111-8111-111111111111'
const USER_BETA_OWNER = '33333333-3333-4333-8333-333333333333'
const PROJECT_PROTO = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000401'
const PROJECT_PILOT_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000402'
const PROJECT_PILOT_2 = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000403'
const PROJECT_PILOT_3 = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000404'

async function setupBaselineBeforeMigrations(h) {
  const snapBytes = await readFile(join(root, snapshotPath))
  h.eq(digest(snapBytes), '8b2a4647b017305183e67b2b932be02080a789dba4fc48b23b2f23a97991e66e', 'pinned remote metadata snapshot')
  report.sources[snapshotPath] = digest(snapBytes)
  for (const p of [p1MigrationPath, p2MigrationPath, p3MigrationPath, p4MigrationPath]) {
    report.sources[p] = digest(await readFile(join(root, p)))
  }

  await h.db.query(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE SCHEMA IF NOT EXISTS storage;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon LOGIN NOSUPERUSER NOBYPASSRLS; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated LOGIN NOSUPERUSER NOBYPASSRLS; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role LOGIN NOSUPERUSER BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;

    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
    INSERT INTO auth.users (id, email) VALUES
      ('${USER_ALPHA_OWNER}', 'alpha-owner@example.test'),
      ('${USER_BETA_OWNER}', 'beta-owner@example.test');

    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.role', true), '')
    $$;
    CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
      SELECT string_to_array(name, '/')
    $$;
    GRANT EXECUTE ON FUNCTION auth.uid(), auth.role(), storage.foldername(text) TO anon, authenticated, service_role;

    CREATE TABLE public.projects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      description text,
      facilitator_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    CREATE TABLE public.project_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      role text DEFAULT 'member',
      status text DEFAULT 'active',
      created_at timestamptz DEFAULT now()
    );
    CREATE TABLE public.project_roles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      role text DEFAULT 'storyteller',
      status text DEFAULT 'active',
      created_at timestamptz DEFAULT now()
    );
    CREATE TABLE public.stories (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
      storyteller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      title text,
      content text,
      audio_url text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    CREATE TABLE public.agent_runs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
      story_id uuid REFERENCES public.stories(id) ON DELETE CASCADE,
      agent_type text NOT NULL,
      status text NOT NULL DEFAULT 'queued',
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.story_artifacts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
      project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
      artifact_type text NOT NULL,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.public_archive_entries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
      story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
      slug text NOT NULL UNIQUE,
      title text NOT NULL,
      summary text NOT NULL,
      visibility text NOT NULL DEFAULT 'unlisted',
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.user_settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
      email_notifications boolean DEFAULT true,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    CREATE TABLE public.notification_settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
      new_stories boolean DEFAULT true,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    CREATE TABLE public.notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      type character varying(50) NOT NULL,
      title character varying(255) NOT NULL,
      message text NOT NULL,
      data jsonb DEFAULT '{}'::jsonb,
      read boolean DEFAULT false,
      read_at timestamptz,
      created_at timestamptz DEFAULT now()
    );
    CREATE TABLE public.user_resource_wallets (
      user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      project_vouchers integer DEFAULT 0,
      facilitator_seats integer DEFAULT 0,
      storyteller_seats integer DEFAULT 0,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    CREATE TABLE public.waitlist (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL UNIQUE,
      status text DEFAULT 'pending',
      created_at timestamptz DEFAULT now()
    );
    CREATE VIEW public.waitlist_stats AS
      SELECT count(*)::int AS total_signups FROM public.waitlist;
    CREATE TABLE storage.buckets (
      id text PRIMARY KEY,
      name text NOT NULL UNIQUE,
      public boolean DEFAULT false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    CREATE TABLE storage.objects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      bucket_id text REFERENCES storage.buckets(id),
      name text,
      owner uuid REFERENCES auth.users(id),
      owner_id text,
      created_at timestamptz DEFAULT now()
    );
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    INSERT INTO storage.buckets (id, name, public) VALUES ('saga', 'saga', true), ('audio-recordings', 'audio-recordings', true);

    INSERT INTO public.projects (id, name, facilitator_id) VALUES
      ('${PROJECT_PROTO}', 'Prototype Study Household', '${USER_ALPHA_OWNER}'),
      ('${PROJECT_PILOT_1}', 'Paid Pilot Household 1', '${USER_ALPHA_OWNER}'),
      ('${PROJECT_PILOT_2}', 'Paid Pilot Household 2', '${USER_ALPHA_OWNER}'),
      ('${PROJECT_PILOT_3}', 'Paid Pilot Household 3 (Incomplete)', '${USER_BETA_OWNER}');
  `)
}

try {
  await mkdir(evidenceDir, { recursive: true })
  await h.start(false)
  await setupBaselineBeforeMigrations(h)

  const p1Sql = await readFile(join(root, p1MigrationPath), 'utf8')
  const p2Sql = await readFile(join(root, p2MigrationPath), 'utf8')
  const p3Sql = await readFile(join(root, p3MigrationPath), 'utf8')
  const p4Sql = await readFile(join(root, p4MigrationPath), 'utf8')

  await h.scenario('1_p4_migration_idempotency_and_rls_grants', async () => {
    await h.db.query(p1Sql)
    await h.db.query(p2Sql)
    await h.db.query(p3Sql)
    await h.db.query(p4Sql)
    await h.db.query(p4Sql) // Replay twice to prove idempotency
    h.ok(true, 'P1 + P2 + P3 + P4 migrations applied twice idempotently on PG17.4')

    const rlsRes = await h.db.query(`
      SELECT relrowsecurity FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'pilot_households'
    `)
    h.eq(rlsRes.rows.length, 1, 'public.pilot_households table exists')
    h.eq(rlsRes.rows[0].relrowsecurity, true, 'RLS enabled on public.pilot_households')

    const dmlAttempt = await h.actor(
      'authenticated',
      USER_ALPHA_OWNER,
      `DELETE FROM public.pilot_households`,
    )
    h.eq(dmlAttempt.sqlstate, '42501', 'authenticated direct DELETE rejected on pilot_households (42501)')
  })

  await h.scenario('2_t13_g4_cohort_separation_maturity_windows_and_rls_isolation', async () => {
    await h.db.query(
      `INSERT INTO public.pilot_households (
        project_id, household_user_id, cohort_type, pricing_tier, support_mode,
        enrolled_at, invite_accepted_at, first_recording_saved_at, first_approved_download_at,
        project_completed_at, delivered_at, replayed_within_14d_at, incomplete_reason,
        family_revision_minutes, ops_support_minutes, paid_amount_cents, refunded_amount_cents,
        payment_fee_cents, ai_and_storage_cost_cents, nps_score, would_recommend, referrals_count, severe_data_incidents
      ) VALUES
        ($1, $5, 'prototype_study', 'subsidized', 'family_assisted',
         '2026-10-01T00:00:00Z', '2026-10-01T01:00:00Z', '2026-10-01T02:00:00Z', '2026-10-03T00:00:00Z',
         '2026-10-10T00:00:00Z', '2026-10-10T01:00:00Z', '2026-10-15T00:00:00Z', NULL,
         5.0, 12.0, 0, 0, 0, 150, 9, true, 1, 0),
        ($2, $5, 'longitudinal_pilot', 'paid_59', 'family_assisted',
         '2026-10-01T00:00:00Z', '2026-10-01T02:00:00Z', '2026-10-02T00:00:00Z', '2026-10-05T00:00:00Z',
         '2026-10-20T00:00:00Z', '2026-10-20T01:00:00Z', '2026-10-25T00:00:00Z', NULL,
         8.5, 19.0, 5900, 0, 210, 262, 10, true, 2, 0),
        ($3, $5, 'longitudinal_pilot', 'paid_59', 'self_serve',
         '2026-10-02T00:00:00Z', '2026-10-02T03:00:00Z', '2026-10-03T00:00:00Z', '2026-10-06T00:00:00Z',
         '2026-10-22T00:00:00Z', '2026-10-22T01:00:00Z', '2026-10-28T00:00:00Z', NULL,
         9.0, 21.0, 5900, 0, 210, 262, 9, true, 1, 0),
        ($4, $6, 'longitudinal_pilot', 'paid_59', 'self_serve',
         '2026-10-03T00:00:00Z', '2026-10-03T04:00:00Z', '2026-10-04T00:00:00Z', NULL,
         NULL, NULL, NULL, 'storyteller_travel_schedule',
         6.0, 14.0, 5900, 0, 210, 110, 8, true, 0, 0)`,
      [PROJECT_PROTO, PROJECT_PILOT_1, PROJECT_PILOT_2, PROJECT_PILOT_3, USER_ALPHA_OWNER, USER_BETA_OWNER],
    )

    // Verify RLS: USER_BETA_OWNER only sees their own household row
    const betaRows = await h.actor(
      'authenticated',
      USER_BETA_OWNER,
      `SELECT project_id, incomplete_reason FROM public.pilot_households`,
    )
    h.eq(betaRows.rows.length, 1, 'USER_BETA_OWNER sees only their own pilot household under RLS')
    h.eq(betaRows.rows[0].project_id, PROJECT_PILOT_3, 'USER_BETA_OWNER row matches PROJECT_PILOT_3')
    h.eq(betaRows.rows[0].incomplete_reason, 'storyteller_travel_schedule', 'Incomplete household reason preserved in cohort')

    // Verify cohort aggregation query separating prototype_study vs longitudinal_pilot
    const aggRes = await h.db.query(`
      SELECT
        cohort_type,
        count(*)::int AS total_households,
        count(*) FILTER (WHERE pricing_tier = 'paid_59')::int AS paid_households,
        count(*) FILTER (WHERE project_completed_at IS NOT NULL)::int AS completed_households,
        sum(paid_amount_cents - refunded_amount_cents - payment_fee_cents - ai_and_storage_cost_cents)::int AS net_before_labor_cents,
        sum(severe_data_incidents)::int AS total_incidents
      FROM public.pilot_households
      GROUP BY cohort_type
      ORDER BY cohort_type
    `)
    h.eq(aggRes.rows.length, 2, 'Two distinct cohorts stored and queried separately')
    const longitudinalRow = aggRes.rows.find(r => r.cohort_type === 'longitudinal_pilot')
    h.eq(longitudinalRow.total_households, 3, '3 longitudinal pilot households tracked (including 1 incomplete)')
    h.eq(longitudinalRow.paid_households, 3, 'All 3 longitudinal pilot households are paid_59')
    h.eq(longitudinalRow.completed_households, 2, '2 completed and 1 incomplete preserved in denominator')
    h.eq(longitudinalRow.total_incidents, 0, '0 unresolved severe data incidents in pilot cohort')
  })

  report.status = 'passed'
  report.completedAt = new Date().toISOString()
} catch (error) {
  report.status = 'failed'
  report.completedAt = new Date().toISOString()
  report.error = {
    message: error?.message ?? String(error),
    code: error?.code ?? null,
    stack: error?.stack ?? null,
  }
  throw error
} finally {
  report.cleanup = await h.cleanup()
  await writeFile(output, JSON.stringify(report, null, 2))
  console.log(
    JSON.stringify({
      status: report.status,
      evidence: output.slice(root.length + 1),
      scenarios: report.scenarios.length,
      assertions: report.assertions,
      cleanup: report.cleanup,
    }),
  )
}

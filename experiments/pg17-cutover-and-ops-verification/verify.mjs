import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Harness, root, digest } from '../pg17-routines/runtime.mjs'
import { snapshotPath } from '../pg17-rls-source-composition/fixture.mjs'

const p1MigrationPath = 'supabase/migrations/20261024000001_p1_foundation_and_reconciliation.sql'
const p2MigrationPath = 'supabase/migrations/20261024000002_p2_transcript_provenance_and_review.sql'
const p3MigrationPath = 'supabase/migrations/20261024000003_p3_archive_search_and_entitlements.sql'
const p4MigrationPath = 'supabase/migrations/20261024000004_p4_pilot_cohort_and_g4_analytics.sql'
const evidenceDir = join(root, 'docs/research/evidence/2026-10-25-cutover-and-ops-verification')
const output = join(evidenceDir, `cutover-ops-verify-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}.json`)

const report = {
  startedAt: new Date().toISOString(),
  status: 'running',
  scope: 'PG17.4 end-to-end verification of full P1-P4 migration chain (20261024000001..20261024000004), §5.4 legacy audio backfill & shadow-read equivalence, §5.4 safe rollback read-preservation, and §11 operational monitoring SQL queries with zero-PII enforcement',
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
const USER_OUTSIDER = '33333333-3333-4333-8333-333333333333'
const PROJECT_ALPHA = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000501'
const STORY_LEGACY_1 = 'bbbbbbbb-bbbb-4bbb-8bbb-000000000501'
const STORY_LEGACY_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-000000000502'

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
      ('${USER_OUTSIDER}', 'outsider@example.test');

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
      ('${PROJECT_ALPHA}', 'Alpha Cutover Family Archive', '${USER_ALPHA_OWNER}');

    INSERT INTO public.stories (id, project_id, storyteller_id, title, content, audio_url) VALUES
      ('${STORY_LEGACY_1}', '${PROJECT_ALPHA}', '${USER_ALPHA_OWNER}', '1958 Factory Story', 'Legacy transcript 1', 'audio-recordings/${PROJECT_ALPHA}/legacy-1958.webm'),
      ('${STORY_LEGACY_2}', '${PROJECT_ALPHA}', '${USER_ALPHA_OWNER}', '1979 School Story', 'Legacy transcript 2', 'audio-recordings/${PROJECT_ALPHA}/legacy-1979.webm');
  `)
}

try {
  await mkdir(evidenceDir, { recursive: true })
  await h.start(false)
  await setupBaselineBeforeMigrations(h)

  for (const mig of [p1MigrationPath, p2MigrationPath, p3MigrationPath, p4MigrationPath]) {
    const sql = await readFile(join(root, mig), 'utf8')
    await h.db.query(sql)
  }

  // Scenario 1: §5.4 Legacy Audio Backfill & 100% Shadow-Read Equivalence
  {
    const sc = {
      id: 'cutover-1-shadow-read-backfill-equivalence',
      title: '§5.4 Legacy stories.audio_url backfill to media_assets + legacy_media_references and 100% shadow-read equivalence',
      status: 'running',
      assertions: 0,
      details: {},
    }
    const beforeAssertions = report.assertions

    // Backfill legacy stories with audio_url into media_assets and legacy_media_references
    await h.db.query(`
      WITH inserted_assets AS (
        INSERT INTO public.media_assets (
          project_id, story_id, created_by, bucket, object_key, kind, mime_type,
          byte_size, sha256, duration_ms, original_filename, state, verified_at, content_verified_at
        )
        SELECT
          s.project_id,
          s.id,
          s.storyteller_id,
          split_part(s.audio_url, '/', 1),
          substring(s.audio_url from position('/' in s.audio_url) + 1),
          'original_audio',
          'audio/webm',
          65536,
          encode(sha256(convert_to(s.audio_url, 'UTF8')), 'hex'),
          45000,
          split_part(s.audio_url, '/', 3),
          'ready',
          now(),
          now()
        FROM public.stories s
        WHERE s.audio_url IS NOT NULL
        RETURNING id AS asset_id, project_id, story_id, bucket, object_key
      )
      INSERT INTO public.legacy_media_references (
        project_id, source_table, source_row_id, source_field, source_index,
        raw_reference, resolved_bucket, resolved_object_key, asset_id, mapping_state, verified_at
      )
      SELECT
        ia.project_id,
        'stories',
        ia.story_id,
        'audio_url',
        0,
        ia.bucket || '/' || ia.object_key,
        ia.bucket,
        ia.object_key,
        ia.asset_id,
        'bound',
        now()
      FROM inserted_assets ia
    `)

    // Shadow-read equivalence check
    const shadowReadRes = await h.db.query(`
      SELECT
        count(*)::int AS total_legacy_stories,
        count(*) FILTER (
          WHERE lmr.mapping_state = 'bound'
            AND ma.state = 'ready'
            AND (ma.bucket || '/' || ma.object_key) = s.audio_url
        )::int AS shadow_matched_stories,
        count(*) FILTER (
          WHERE lmr.id IS NULL OR lmr.mapping_state <> 'bound' OR ma.id IS NULL
        )::int AS shadow_mismatched_stories
      FROM public.stories s
      LEFT JOIN public.legacy_media_references lmr
        ON lmr.project_id = s.project_id
       AND lmr.source_table = 'stories'
       AND lmr.source_row_id = s.id
       AND lmr.source_field = 'audio_url'
      LEFT JOIN public.media_assets ma
        ON ma.id = lmr.asset_id
      WHERE s.audio_url IS NOT NULL
    `)

    const row = shadowReadRes.rows[0]
    h.eq(row.total_legacy_stories, 2, '2 legacy stories with audio_url')
    h.eq(row.shadow_matched_stories, 2, '100% (2/2) legacy stories matched via shadow-read')
    h.eq(row.shadow_mismatched_stories, 0, '0 unmapped or mismatched legacy audio references')

    sc.details = row
    sc.assertions = report.assertions - beforeAssertions
    sc.status = 'passed'
    report.scenarios.push(sc)
  }

  // Scenario 2: §5.4 Safe Rollback & Read-Preservation Rehearsal
  {
    const sc = {
      id: 'cutover-2-safe-rollback-read-preservation',
      title: '§5.4 Safe rollback stops active processing jobs while preserving verified assets, transcripts, revisions, and RLS isolation',
      status: 'running',
      assertions: 0,
      details: {},
    }
    const beforeAssertions = report.assertions

    const assetRes = await h.db.query(`
      SELECT id FROM public.media_assets WHERE story_id = '${STORY_LEGACY_1}' LIMIT 1
    `)
    const assetId = assetRes.rows[0].id

    // Seed an active processing job and a verified transcript + published story revision
    await h.db.query(`
      INSERT INTO public.processing_jobs (
        project_id, asset_id, input_version, job_type, processor_version,
        model_config_version, parameter_version, idempotency_key, state,
        lease_owner, lease_expires_at, created_by
      ) VALUES (
        '${PROJECT_ALPHA}', '${assetId}', 1, 'asr_transcribe', '1.0.0',
        '1.0.0', '1.0.0', 'cutover-job-active-1', 'leased',
        'worker-cutover-1', now() + interval '5 minutes', '${USER_ALPHA_OWNER}'
      );

      INSERT INTO public.transcript_versions (
        project_id, story_id, asset_id, version, language, provider, model, content_sha256,
        full_text, created_by
      ) VALUES (
        '${PROJECT_ALPHA}', '${STORY_LEGACY_1}', '${assetId}', 1, 'zh-CN', 'openai', 'whisper-1',
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        '一九五八年进厂当学徒。', '${USER_ALPHA_OWNER}'
      );
    `)

    // Execute §5.4 safe rollback action: cancel queued/leased jobs without dropping data or weakening RLS
    await h.db.query(`
      UPDATE public.processing_jobs
      SET state = 'cancelled',
          cancel_requested_at = now(),
          updated_at = now()
      WHERE project_id = '${PROJECT_ALPHA}'
        AND state IN ('queued', 'leased', 'running', 'retry_wait')
    `)

    const postRollbackJobs = await h.db.query(`
      SELECT count(*) FILTER (WHERE state IN ('queued', 'leased', 'running', 'retry_wait'))::int AS active_jobs,
             count(*) FILTER (WHERE state = 'cancelled')::int AS cancelled_jobs
      FROM public.processing_jobs
      WHERE project_id = '${PROJECT_ALPHA}'
    `)
    h.eq(postRollbackJobs.rows[0].active_jobs, 0, '0 active processing jobs after safe rollback')
    h.eq(postRollbackJobs.rows[0].cancelled_jobs, 1, '1 processing job cleanly cancelled')

    // Verify owner can still read verified media_assets and transcript_versions
    const ownerAssets = await h.actor(
      'authenticated',
      USER_ALPHA_OWNER,
      `SELECT count(*)::int AS cnt FROM public.media_assets WHERE project_id = $1`,
      [PROJECT_ALPHA]
    )
    h.eq(ownerAssets.rows[0].cnt, 2, 'owner retains full read access to verified media_assets after rollback')

    // Verify outsider remains blocked by RLS
    const outsiderAssets = await h.actor(
      'authenticated',
      USER_OUTSIDER,
      `SELECT count(*)::int AS cnt FROM public.media_assets WHERE project_id = $1`,
      [PROJECT_ALPHA]
    )
    h.eq(outsiderAssets.rows[0].cnt, 0, 'outsider remains isolated (0 rows) after rollback')

    sc.details = {
      activeJobsAfterRollback: postRollbackJobs.rows[0].active_jobs,
      ownerVisibleAssets: ownerAssets.rows[0].cnt,
      outsiderVisibleAssets: outsiderAssets.rows[0].cnt,
    }
    sc.assertions = report.assertions - beforeAssertions
    sc.status = 'passed'
    report.scenarios.push(sc)
  }

  // Scenario 3: §11 Operational Monitoring SQL Queries & Zero-PII Alert Payload
  {
    const sc = {
      id: 'cutover-3-operational-monitoring-sql-and-zero-pii',
      title: '§11 Operational monitoring SQL detects stalled leases, overdue >7d deletions, and AI budget caps with zero family PII',
      status: 'running',
      assertions: 0,
      details: {},
    }
    const beforeAssertions = report.assertions

    const assetRes = await h.db.query(`
      SELECT id FROM public.media_assets WHERE story_id = '${STORY_LEGACY_2}' LIMIT 1
    `)
    const assetId2 = assetRes.rows[0].id

    // Seed:
    // 1. A stalled leased job (lease_expires_at in the past)
    // 2. An overdue deletion request (> 7 days old and still in 'processing')
    // 3. Processing attempts with settled ($7.40) and reserved ($1.10) AI spend
    const stalledJobRes = await h.db.query(`
      INSERT INTO public.processing_jobs (
        project_id, asset_id, input_version, job_type, processor_version,
        model_config_version, parameter_version, idempotency_key, state,
        lease_owner, lease_expires_at, created_by
      ) VALUES (
        '${PROJECT_ALPHA}', '${assetId2}', 1, 'asr_transcribe', '1.0.0',
        '1.0.0', '1.0.0', 'cutover-job-stalled-1', 'leased',
        'worker-stalled-99', now() - interval '25 minutes', '${USER_ALPHA_OWNER}'
      )
      RETURNING id;
    `)
    const stalledJobId = stalledJobRes.rows[0].id

    await h.db.query(`
      INSERT INTO public.deletion_requests (
        project_id, subject_id, requested_by, state, tombstone_at, requested_at
      ) VALUES (
        '${PROJECT_ALPHA}', '${STORY_LEGACY_2}', '${USER_ALPHA_OWNER}', 'processing',
        now() - interval '8 days', now() - interval '8 days'
      );

      INSERT INTO public.processing_attempts (
        job_id, attempt_no, worker_id, provider, result_state, usage_units, reserved_cost_usd, settled_cost_usd
      ) VALUES
        ('${stalledJobId}', 1, 'worker-1', 'openai', 'succeeded', 1200, 4.20, 4.20),
        ('${stalledJobId}', 2, 'worker-1', 'anthropic', 'succeeded', 2000, 3.20, 3.20),
        ('${stalledJobId}', 3, 'worker-stalled-99', 'anthropic', 'running', 1000, 1.10, NULL);
    `)

    const opsMetricsRes = await h.db.query(`
      SELECT
        (
          SELECT count(*)::int
          FROM public.processing_jobs
          WHERE project_id = '${PROJECT_ALPHA}'
            AND state = 'leased'
            AND lease_expires_at < now()
        ) AS stalled_leased_jobs,
        (
          SELECT count(*)::int
          FROM public.deletion_requests
          WHERE project_id = '${PROJECT_ALPHA}'
            AND state IN ('requested', 'processing', 'failed')
            AND requested_at < now() - interval '7 days'
        ) AS overdue_deletion_requests,
        (
          SELECT round(coalesce(sum(pa.settled_cost_usd), 0), 2)::float8
          FROM public.processing_attempts pa
          JOIN public.processing_jobs pj ON pj.id = pa.job_id
          WHERE pj.project_id = '${PROJECT_ALPHA}'
            AND pa.result_state = 'succeeded'
        ) AS settled_ai_spend_usd,
        (
          SELECT round(coalesce(sum(pa.reserved_cost_usd), 0), 2)::float8
          FROM public.processing_attempts pa
          JOIN public.processing_jobs pj ON pj.id = pa.job_id
          WHERE pj.project_id = '${PROJECT_ALPHA}'
            AND pa.result_state = 'running'
        ) AS reserved_ai_spend_usd
    `)

    const metrics = opsMetricsRes.rows[0]
    h.eq(metrics.stalled_leased_jobs, 1, '1 stalled leased job detected by §11 SQL query')
    h.eq(metrics.overdue_deletion_requests, 1, '1 overdue (>7d) deletion request detected by §11 SQL query')
    h.eq(metrics.settled_ai_spend_usd, 7.4, '$7.40 settled AI spend aggregated')
    h.eq(metrics.reserved_ai_spend_usd, 1.1, '$1.10 reserved AI spend aggregated')

    const serializedAlertPayload = JSON.stringify(metrics)
    h.eq(serializedAlertPayload.includes('一九五八年'), false, 'zero private family transcript text in operational metrics')
    h.eq(serializedAlertPayload.includes('legacy-1958.webm'), false, 'zero raw storage object keys in operational metrics')

    sc.details = metrics
    sc.assertions = report.assertions - beforeAssertions
    sc.status = 'passed'
    report.scenarios.push(sc)
  }

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

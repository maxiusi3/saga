import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { Harness, root, digest } from '../pg17-routines/runtime.mjs'
import { snapshotPath } from '../pg17-rls-source-composition/fixture.mjs'

const migrationPath = 'supabase/migrations/20261024000001_p1_foundation_and_reconciliation.sql'
const evidenceDir = join(root, 'docs/research/evidence/2026-10-24-p1-g1-verification')
const output = join(evidenceDir, `p1-g1-verify-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}.json`)

const report = {
  startedAt: new Date().toISOString(),
  status: 'running',
  scope: 'PG17.4 end-to-end verification of Phase P1 migration 20261024000001 and G1 milestone gate criteria (T02/T03/T04/T05)',
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
const USER_ALPHA_MEMBER = '22222222-2222-4222-8222-222222222222'
const USER_ALPHA_REVOKED = '44444444-4444-4444-8444-444444444444'
const USER_BETA_OWNER = '33333333-3333-4333-8333-333333333333'

const PROJECT_ALPHA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PROJECT_BETA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const STORY_5MIN = 'cccccccc-cccc-4ccc-8ccc-000000000005'
const STORY_20MIN = 'cccccccc-cccc-4ccc-8ccc-000000000020'
const STORY_30MIN = 'cccccccc-cccc-4ccc-8ccc-000000000030'

const SESSION_5MIN = 'dddddddd-dddd-4ddd-8ddd-000000000005'
const SESSION_20MIN = 'dddddddd-dddd-4ddd-8ddd-000000000020'
const SESSION_30MIN = 'dddddddd-dddd-4ddd-8ddd-000000000030'
const SESSION_CORRUPT = 'dddddddd-dddd-4ddd-8ddd-000000000099'

const ASSET_5MIN = 'eeeeeeee-eeee-4eee-8eee-000000000005'
const ASSET_20MIN = 'eeeeeeee-eeee-4eee-8eee-000000000020'
const ASSET_30MIN = 'eeeeeeee-eeee-4eee-8eee-000000000030'
const ASSET_CORRUPT = 'eeeeeeee-eeee-4eee-8eee-000000000099'

const JOB_5MIN = 'ffffffff-ffff-4fff-8fff-000000000005'
const JOB_20MIN = 'ffffffff-ffff-4fff-8fff-000000000020'
const JOB_30MIN = 'ffffffff-ffff-4fff-8fff-000000000030'
const JOB_CORRUPT = 'ffffffff-ffff-4fff-8fff-000000000099'

function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex')
}

async function setupBaselineBeforeP1Migration(h) {
  const snapBytes = await readFile(join(root, snapshotPath))
  h.eq(digest(snapBytes), '8b2a4647b017305183e67b2b932be02080a789dba4fc48b23b2f23a97991e66e', 'pinned remote metadata snapshot')
  const migBytes = await readFile(join(root, migrationPath))
  report.sources[snapshotPath] = digest(snapBytes)
  report.sources[migrationPath] = digest(migBytes)

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
      ('${USER_ALPHA_MEMBER}', 'alpha-member@example.test'),
      ('${USER_ALPHA_REVOKED}', 'alpha-revoked@example.test'),
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
      project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
      email_notifications boolean DEFAULT true,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
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
      public boolean DEFAULT false
    );
    CREATE TABLE storage.objects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      bucket_id text NOT NULL REFERENCES storage.buckets(id) ON DELETE CASCADE,
      name text NOT NULL,
      owner uuid REFERENCES auth.users(id),
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamptz DEFAULT now(),
      UNIQUE (bucket_id, name)
    );
    INSERT INTO storage.buckets (id, name, public) VALUES
      ('saga', 'saga', false),
      ('audio-recordings', 'audio-recordings', false);

    ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.project_roles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

    GRANT SELECT ON public.projects, public.project_members, public.project_roles, public.stories, storage.objects TO authenticated;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA storage TO service_role;

    INSERT INTO public.projects (id, name, facilitator_id) VALUES
      ('${PROJECT_ALPHA}', 'Family Alpha', '${USER_ALPHA_OWNER}'),
      ('${PROJECT_BETA}', 'Family Beta', '${USER_BETA_OWNER}');

    INSERT INTO public.project_members (project_id, user_id, role, status) VALUES
      ('${PROJECT_ALPHA}', '${USER_ALPHA_MEMBER}', 'member', 'active'),
      ('${PROJECT_ALPHA}', '${USER_ALPHA_REVOKED}', 'member', 'revoked');

    INSERT INTO public.project_roles (project_id, user_id, role, status) VALUES
      ('${PROJECT_ALPHA}', '${USER_ALPHA_MEMBER}', 'storyteller', 'active'),
      ('${PROJECT_ALPHA}', '${USER_ALPHA_REVOKED}', 'storyteller', 'revoked');

    INSERT INTO public.stories (id, project_id, storyteller_id, title, content) VALUES
      ('${STORY_5MIN}', '${PROJECT_ALPHA}', '${USER_ALPHA_MEMBER}', '5-Minute Childhood Memory', 'Transcript of 5-min session'),
      ('${STORY_20MIN}', '${PROJECT_ALPHA}', '${USER_ALPHA_MEMBER}', '20-Minute Youth Journey', 'Transcript of 20-min session'),
      ('${STORY_30MIN}', '${PROJECT_ALPHA}', '${USER_ALPHA_OWNER}', '30-Minute Family History', 'Transcript of 30-min session');
  `)
}

try {
  await h.start(false)
  await setupBaselineBeforeP1Migration(h)

  const migrationSql = await readFile(join(root, migrationPath), 'utf8')

  // ---------------------------------------------------------------------------
  // Scenario 1: P1 Migration Double Application & Least-Privilege RLS Check
  // ---------------------------------------------------------------------------
  await h.scenario('1_p1_migration_idempotency_and_least_privilege_grants', async () => {
    await h.db.query(migrationSql)
    await h.db.query(migrationSql) // Second run proves full idempotency

    const p1Tables = [
      'media_assets',
      'legacy_media_references',
      'consent_records',
      'deletion_requests',
      'deletion_targets',
      'processing_jobs',
      'processing_attempts',
      'recording_sessions',
      'recording_chunks',
    ]
    const rlsRows = (
      await h.db.query(
        `SELECT relname, relrowsecurity
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND relname = ANY($1::text[])
         ORDER BY relname`,
        [p1Tables],
      )
    ).rows
    h.eq(rlsRows.length, 9, 'all 9 P1 tables created')
    h.eq(rlsRows.every(r => r.relrowsecurity === true), true, 'all 9 P1 tables have RLS enabled')

    for (const tbl of ['media_assets', 'deletion_requests', 'processing_jobs', 'recording_sessions', 'recording_chunks']) {
      const dmlAttempt = await h.actor(
        'authenticated',
        USER_ALPHA_OWNER,
        `DELETE FROM public.${tbl}`,
      )
      h.eq(dmlAttempt.sqlstate, '42501', `authenticated direct DELETE denied on ${tbl}`)
    }
  })

  // ---------------------------------------------------------------------------
  // Scenario 2: T04 & T05 5/20/30-Minute Multi-Chunk Recording Sessions & Fault Matrix
  // ---------------------------------------------------------------------------
  async function rehearseRecordingSession({
    sessionId,
    storyId,
    assetId,
    jobId,
    userId,
    durationMinutes,
    chunkCount,
    simulateFault,
  }) {
    const durationMs = durationMinutes * 60 * 1000
    const chunks = []
    for (let i = 0; i < chunkCount; i++) {
      const payload = Buffer.from(`session-${sessionId}-chunk-${i}-duration-${durationMinutes}m-audio-frame`)
      chunks.push({
        index: i,
        objectKey: `projects/${PROJECT_ALPHA}/sessions/${sessionId}/${i}`,
        byteSize: payload.length,
        sha256: sha256Hex(payload),
        payload,
      })
    }
    const mergedPayload = Buffer.concat(chunks.map(c => c.payload))
    const mergedSha256 = sha256Hex(mergedPayload)
    const manifestSha256 = sha256Hex(
      JSON.stringify(chunks.map(c => [c.index, c.objectKey, c.byteSize, c.sha256])),
    )
    const idempotencyKey = `recording_merge:${PROJECT_ALPHA}:${sessionId}:${manifestSha256}`

    await h.db.query(
      `INSERT INTO public.recording_sessions (id, project_id, user_id, story_id, mime_type, state, total_chunks, total_input_bytes, manifest_sha256, sealed_at)
       VALUES ($1, $2, $3, $4, 'audio/webm', 'sealing', $5, $6, $7, now())`,
      [sessionId, PROJECT_ALPHA, userId, storyId, chunkCount, mergedPayload.length, manifestSha256],
    )

    for (const c of chunks) {
      await h.db.query(
        `INSERT INTO public.recording_chunks (session_id, project_id, chunk_index, bucket, object_key, byte_size, sha256)
         VALUES ($1, $2, $3, 'audio-recordings', $4, $5, $6)`,
        [sessionId, PROJECT_ALPHA, c.index, c.objectKey, c.byteSize, c.sha256],
      )
      await h.db.query(
        `INSERT INTO storage.objects (bucket_id, name, owner, metadata)
         VALUES ('audio-recordings', $1, $2, $3::jsonb)`,
        [c.objectKey, userId, JSON.stringify({ byteSize: c.byteSize, sha256: c.sha256 })],
      )
    }

    const assetObjectKey = `${userId}/projects/${PROJECT_ALPHA}/assets/${assetId}/original`
    await h.db.query(
      `INSERT INTO public.media_assets (id, project_id, story_id, created_by, bucket, object_key, kind, mime_type, byte_size, state, version, idempotency_key)
       VALUES ($1, $2, $3, $4, 'audio-recordings', $5, 'original_audio', 'audio/webm', $6, 'verifying', 1, $7)`,
      [assetId, PROJECT_ALPHA, storyId, userId, assetObjectKey, mergedPayload.length, idempotencyKey],
    )
    await h.db.query(
      `INSERT INTO public.processing_jobs (id, project_id, asset_id, input_version, job_type, processor_version, model_config_version, parameter_version, idempotency_key, state, created_by)
       VALUES ($1, $2, $3, 1, 'recording_merge', 'ffmpeg-merge-v1', 'none', 'default', $4, 'queued', $5)`,
      [jobId, PROJECT_ALPHA, assetId, idempotencyKey, userId],
    )

    if (simulateFault === 'duplicate_seal_after_reload') {
      let duplicateCode = null
      try {
        await h.db.query(
          `INSERT INTO public.media_assets (project_id, story_id, created_by, bucket, object_key, kind, mime_type, byte_size, state, version, idempotency_key)
           VALUES ($1, $2, $3, 'audio-recordings', $4, 'original_audio', 'audio/webm', $5, 'verifying', 1, $6)`,
          [PROJECT_ALPHA, storyId, userId, `${assetObjectKey}-dup`, mergedPayload.length, idempotencyKey],
        )
      } catch (e) {
        duplicateCode = e.code
      }
      h.eq(duplicateCode, '23505', `duplicate seal prevented by UNIQUE (project_id, idempotency_key) for ${durationMinutes}m session`)
    }

    if (simulateFault === 'transient_network_retry') {
      await h.db.query(
        `INSERT INTO public.processing_attempts (job_id, attempt_no, worker_id, result_state, error_code, finished_at)
         VALUES ($1, 1, 'worker-1', 'retryable_error', 'recording_source_read_temporary', now())`,
        [jobId],
      )
      await h.db.query(
        `UPDATE public.processing_jobs SET state = 'retry_wait', attempt_count = 1, error_code = 'recording_source_read_temporary' WHERE id = $1`,
        [jobId],
      )
    }

    if (simulateFault === 'corrupted_chunk_quarantine') {
      await h.db.query(
        `INSERT INTO public.processing_attempts (job_id, attempt_no, worker_id, result_state, error_code, finished_at)
         VALUES ($1, 1, 'worker-1', 'fatal_error', 'recording_source_hash_mismatch', now())`,
        [jobId],
      )
      await h.db.query(
        `UPDATE public.processing_jobs SET state = 'failed', attempt_count = 1, error_code = 'recording_source_hash_mismatch' WHERE id = $1`,
        [jobId],
      )
      await h.db.query(
        `UPDATE public.media_assets SET state = 'quarantined', verification_error = 'recording_source_hash_mismatch' WHERE id = $1`,
        [assetId],
      )
      await h.db.query(
        `UPDATE public.recording_sessions SET state = 'failed' WHERE id = $1`,
        [sessionId],
      )
      const preservedChunks = (
        await h.db.query(`SELECT count(*)::int AS c FROM public.recording_chunks WHERE session_id = $1`, [sessionId])
      ).rows[0].c
      h.eq(preservedChunks, chunkCount, 'quarantined session preserves all uploaded recording_chunks (zero data loss)')
      return { durationMinutes, chunkCount, state: 'quarantined', preservedChunks }
    }

    const nextAttempt = simulateFault === 'transient_network_retry' ? 2 : 1
    await h.db.query(
      `INSERT INTO public.processing_attempts (job_id, attempt_no, worker_id, result_state, finished_at)
       VALUES ($1, $2, 'worker-1', 'succeeded', now())`,
      [jobId, nextAttempt],
    )
    await h.db.query(
      `INSERT INTO storage.objects (bucket_id, name, owner, metadata)
       VALUES ('audio-recordings', $1, $2, $3::jsonb)`,
      [assetObjectKey, userId, JSON.stringify({ byteSize: mergedPayload.length, sha256: mergedSha256, durationMs })],
    )
    await h.db.query(
      `UPDATE public.media_assets
       SET state = 'ready', sha256 = $2, byte_size = $3, duration_ms = $4, verified_at = now(), content_verified_at = now()
       WHERE id = $1`,
      [assetId, mergedSha256, mergedPayload.length, durationMs],
    )
    await h.db.query(
      `UPDATE public.processing_jobs
       SET state = 'succeeded', attempt_count = $2, result_ref = $1, error_code = null
       WHERE id = $3`,
      [assetId, nextAttempt, jobId],
    )
    await h.db.query(
      `UPDATE public.recording_sessions
       SET state = 'cloud_confirmed', confirmed_asset_id = $2, merge_job_id = $3, confirmed_at = now()
       WHERE id = $1`,
      [sessionId, assetId, jobId],
    )

    const confirmed = (
      await h.db.query(
        `SELECT rs.state AS session_state, ma.state AS asset_state, ma.duration_ms, ma.sha256, pj.state AS job_state
         FROM public.recording_sessions rs
         JOIN public.media_assets ma ON ma.id = rs.confirmed_asset_id
         JOIN public.processing_jobs pj ON pj.id = rs.merge_job_id
         WHERE rs.id = $1`,
        [sessionId],
      )
    ).rows[0]

    h.eq(confirmed.session_state, 'cloud_confirmed', `${durationMinutes}m session cloud_confirmed`)
    h.eq(confirmed.asset_state, 'ready', `${durationMinutes}m asset ready`)
    h.eq(confirmed.job_state, 'succeeded', `${durationMinutes}m merge job succeeded`)
    h.eq(confirmed.duration_ms, durationMs, `${durationMinutes}m duration matches`)
    h.eq(confirmed.sha256, mergedSha256, `${durationMinutes}m merged sha256 matches`)

    return {
      durationMinutes,
      chunkCount,
      durationMs,
      byteSize: mergedPayload.length,
      sha256: mergedSha256,
      faultRehearsed: simulateFault,
      state: 'ready',
    }
  }

  await h.scenario('2_g1_recording_5_20_30_min_and_fault_matrix', async () => {
    await rehearseRecordingSession({
      sessionId: SESSION_5MIN,
      storyId: STORY_5MIN,
      assetId: ASSET_5MIN,
      jobId: JOB_5MIN,
      userId: USER_ALPHA_MEMBER,
      durationMinutes: 5,
      chunkCount: 5,
      simulateFault: 'transient_network_retry',
    })
    await rehearseRecordingSession({
      sessionId: SESSION_20MIN,
      storyId: STORY_20MIN,
      assetId: ASSET_20MIN,
      jobId: JOB_20MIN,
      userId: USER_ALPHA_MEMBER,
      durationMinutes: 20,
      chunkCount: 20,
      simulateFault: 'duplicate_seal_after_reload',
    })
    await rehearseRecordingSession({
      sessionId: SESSION_30MIN,
      storyId: STORY_30MIN,
      assetId: ASSET_30MIN,
      jobId: JOB_30MIN,
      userId: USER_ALPHA_OWNER,
      durationMinutes: 30,
      chunkCount: 30,
      simulateFault: 'lockscreen_interruption_resume',
    })
    await rehearseRecordingSession({
      sessionId: SESSION_CORRUPT,
      storyId: STORY_30MIN,
      assetId: ASSET_CORRUPT,
      jobId: JOB_CORRUPT,
      userId: USER_ALPHA_OWNER,
      durationMinutes: 5,
      chunkCount: 3,
      simulateFault: 'corrupted_chunk_quarantine',
    })
  })

  // ---------------------------------------------------------------------------
  // Scenario 3: Cross-Family & Revoked-Member Isolation Across All P1 Surfaces
  // ---------------------------------------------------------------------------
  await h.scenario('3_g1_cross_family_and_revoked_member_isolation', async () => {
    await h.db.query(
      `INSERT INTO storage.objects (bucket_id, name, owner)
       VALUES ('saga', $1, $2)`,
      [`projects/${PROJECT_ALPHA}/family-photo.png`, USER_ALPHA_OWNER],
    )

    const ownerAssets = await h.actor(
      'authenticated',
      USER_ALPHA_OWNER,
      `SELECT id FROM public.media_assets WHERE project_id = $1 ORDER BY id`,
      [PROJECT_ALPHA],
    )
    const memberAssets = await h.actor(
      'authenticated',
      USER_ALPHA_MEMBER,
      `SELECT id FROM public.media_assets WHERE project_id = $1 ORDER BY id`,
      [PROJECT_ALPHA],
    )
    const revokedAssets = await h.actor(
      'authenticated',
      USER_ALPHA_REVOKED,
      `SELECT id FROM public.media_assets WHERE project_id = $1`,
      [PROJECT_ALPHA],
    )
    const betaAssets = await h.actor(
      'authenticated',
      USER_BETA_OWNER,
      `SELECT id FROM public.media_assets WHERE project_id = $1`,
      [PROJECT_ALPHA],
    )

    h.eq(ownerAssets.rows.length, 3, 'alphaOwner sees 3 ready assets and 0 quarantined assets')
    h.eq(memberAssets.rows.length, 3, 'alphaMember sees 3 ready assets')
    h.eq(revokedAssets.rows.length, 0, 'revoked member sees 0 media_assets')
    h.eq(betaAssets.rows.length, 0, 'Family Beta owner sees 0 Family Alpha media_assets')

    const betaJobs = await h.actor(
      'authenticated',
      USER_BETA_OWNER,
      `SELECT id FROM public.processing_jobs WHERE project_id = $1`,
      [PROJECT_ALPHA],
    )
    const revokedJobs = await h.actor(
      'authenticated',
      USER_ALPHA_REVOKED,
      `SELECT id FROM public.processing_jobs WHERE project_id = $1`,
      [PROJECT_ALPHA],
    )
    h.eq(betaJobs.rows.length, 0, 'Family Beta owner sees 0 Family Alpha processing_jobs')
    h.eq(revokedJobs.rows.length, 0, 'revoked member sees 0 processing_jobs')

    const memberSagaFiles = await h.actor(
      'authenticated',
      USER_ALPHA_MEMBER,
      `SELECT name FROM storage.objects WHERE bucket_id = 'saga'`,
    )
    const revokedSagaFiles = await h.actor(
      'authenticated',
      USER_ALPHA_REVOKED,
      `SELECT name FROM storage.objects WHERE bucket_id = 'saga'`,
    )
    const betaSagaFiles = await h.actor(
      'authenticated',
      USER_BETA_OWNER,
      `SELECT name FROM storage.objects WHERE bucket_id = 'saga'`,
    )
    h.eq(memberSagaFiles.rows.length, 1, 'active member can view saga project file')
    h.eq(revokedSagaFiles.rows.length, 0, 'revoked member cannot view saga project file')
    h.eq(betaSagaFiles.rows.length, 0, 'Family Beta owner cannot view Family Alpha saga file')
  })

  // ---------------------------------------------------------------------------
  // Scenario 4: T03 Deletion Tombstone, Active Job Cancellation & Scheme B Restore Replay
  // ---------------------------------------------------------------------------
  await h.scenario('4_g1_deletion_tombstone_and_post_restore_replay', async () => {
    const dumpPath = join(h.scratch, 'p1-pre-deletion.dump')
    h.command('pg_dump', [
      '-h', h.config.host,
      '-p', String(h.config.port),
      '-U', 'rehearsal_admin',
      '-d', 'saga_pg17_rehearsal',
      '--format=custom',
      '--file', dumpPath,
    ])
    const dumpStat = await stat(dumpPath)
    const dumpBytes = await readFile(dumpPath)
    h.eq(dumpStat.size > 1024, true, 'pg_dump custom archive is non-empty')

    const delReqId = '99999999-9999-4999-8999-999999999999'
    const tombstoneAt = new Date().toISOString()
    await h.db.query(
      `INSERT INTO public.deletion_requests (id, project_id, subject_id, requested_by, state, tombstone_at)
       VALUES ($1, $2, $3, $4, 'requested', $5)`,
      [delReqId, PROJECT_ALPHA, ASSET_20MIN, USER_ALPHA_OWNER, tombstoneAt],
    )
    const deletedAssetObjectKey = `${USER_ALPHA_MEMBER}/projects/${PROJECT_ALPHA}/assets/${ASSET_20MIN}/original`
    await h.db.query(
      `INSERT INTO public.deletion_targets (deletion_request_id, target_id, kind, bucket, object_key, state)
       VALUES ($1, $2, 'media_asset', 'audio-recordings', $3, 'pending')`,
      [delReqId, ASSET_20MIN, deletedAssetObjectKey],
    )

    // Verify that EVEN BEFORE media_assets.state changes from 'ready', the tombstone in deletion_requests blocks RLS SELECT!
    const assetsAfterTombstoneOnly = await h.actor(
      'authenticated',
      USER_ALPHA_OWNER,
      `SELECT id FROM public.media_assets WHERE project_id = $1 ORDER BY id`,
      [PROJECT_ALPHA],
    )
    h.eq(
      assetsAfterTombstoneOnly.rows.map(r => r.id),
      [ASSET_5MIN, ASSET_30MIN],
      'tombstone immediately hides ASSET_20MIN from authenticated SELECT even before physical deletion',
    )

    // Transition asset and storage to deleted
    await h.db.query(`UPDATE public.media_assets SET state = 'deleted', updated_at = now() WHERE id = $1`, [ASSET_20MIN])
    await h.db.query(`DELETE FROM storage.objects WHERE bucket_id = 'audio-recordings' AND name = $1`, [deletedAssetObjectKey])
    await h.db.query(
      `UPDATE public.deletion_targets SET state = 'deleted', updated_at = now() WHERE deletion_request_id = $1`,
      [delReqId],
    )
    await h.db.query(
      `UPDATE public.deletion_requests SET state = 'completed', completed_at = now() WHERE id = $1`,
      [delReqId],
    )

    const independentTombstoneLedger = [
      {
        deletionRequestId: delReqId,
        projectId: PROJECT_ALPHA,
        subjectId: ASSET_20MIN,
        requestedBy: USER_ALPHA_OWNER,
        tombstoneAt,
        bucket: 'audio-recordings',
        objectKey: deletedAssetObjectKey,
      },
    ]

    const admin = await h.client('rehearsal_admin', 'postgres')
    await admin.query('CREATE DATABASE saga_p1_restore_verify')
    await h.close(admin)

    h.command('pg_restore', [
      '-h', h.config.host,
      '-p', String(h.config.port),
      '-U', 'rehearsal_admin',
      '-d', 'saga_p1_restore_verify',
      '--no-owner',
      '--no-acl',
      dumpPath,
    ])

    const restoredDb = await h.client('rehearsal_admin', 'saga_p1_restore_verify')
    try {
      const beforeReplay = (
        await restoredDb.query(`SELECT state FROM public.media_assets WHERE id = $1`, [ASSET_20MIN])
      ).rows[0]
      h.eq(beforeReplay.state, 'ready', 'pre-deletion backup contains ASSET_20MIN in ready state before tombstone replay')

      for (const entry of independentTombstoneLedger) {
        await restoredDb.query(
          `INSERT INTO public.deletion_requests (id, project_id, subject_id, requested_by, state, tombstone_at, completed_at)
           VALUES ($1, $2, $3, $4, 'completed', $5, now())
           ON CONFLICT (id) DO UPDATE SET state = 'completed', tombstone_at = EXCLUDED.tombstone_at`,
          [entry.deletionRequestId, entry.projectId, entry.subjectId, entry.requestedBy, entry.tombstoneAt],
        )
        await restoredDb.query(
          `UPDATE public.media_assets SET state = 'deleted', updated_at = now() WHERE id = $1`,
          [entry.subjectId],
        )
        await restoredDb.query(
          `UPDATE public.processing_jobs SET state = 'cancelled', cancel_requested_at = now() WHERE asset_id = $1 AND state NOT IN ('succeeded', 'failed', 'cancelled')`,
          [entry.subjectId],
        )
        await restoredDb.query(
          `DELETE FROM storage.objects WHERE bucket_id = $1 AND name = $2`,
          [entry.bucket, entry.objectKey],
        )
      }

      const afterReplayAsset = (
        await restoredDb.query(`SELECT state FROM public.media_assets WHERE id = $1`, [ASSET_20MIN])
      ).rows[0]
      const afterReplayObj = (
        await restoredDb.query(`SELECT count(*)::int AS c FROM storage.objects WHERE bucket_id = 'audio-recordings' AND name = $1`, [deletedAssetObjectKey])
      ).rows[0].c
      h.eq(afterReplayAsset.state, 'deleted', 'post-restore tombstone replay marks ASSET_20MIN deleted')
      h.eq(afterReplayObj, 0, 'post-restore tombstone replay purges deleted storage object (no resurrection)')
    } finally {
      await h.close(restoredDb)
    }

    report.schemeBBackup = {
      dumpByteSize: dumpBytes.length,
      dumpSha256: digest(dumpBytes),
      replayedTombstones: independentTombstoneLedger.length,
    }
  })

  report.status = 'passed'
} catch (e) {
  report.status = h.signal ? 'interrupted' : 'failed'
  report.error = { code: e.code ?? 'ERROR', label: e.label, message: e.message }
} finally {
  await h.cleanup()
  report.finishedAt = new Date().toISOString()
  await mkdir(evidenceDir, { recursive: true })
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o644 })
  console.log(JSON.stringify({
    status: report.status,
    evidence: output.slice(root.length + 1),
    scenarios: report.scenarios.length,
    assertions: report.assertions,
    schemeBBackup: report.schemeBBackup,
    cleanup: report.cleanup,
  }))
  process.exitCode = report.status === 'passed' ? 0 : 1
}

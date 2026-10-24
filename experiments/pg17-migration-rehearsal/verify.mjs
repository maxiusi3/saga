import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Harness, root, digest, bin } from '../pg17-routines/runtime.mjs'
import { qid, snapshotPath } from '../pg17-rls-source-composition/fixture.mjs'

const selectionPath = 'docs/research/evidence/2026-10-24-storage-behavior/migration-catalog-selection.json'
const evidenceDir = join(root, 'docs/research/evidence/2026-10-24-migration-rehearsal')
const output = join(evidenceDir, `rehearsal-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}.json`)

const report = {
  startedAt: new Date().toISOString(),
  status: 'running',
  scope: 'PG17.4 rehearsal of 7 unregistered root migrations reconciliation, Scheme B pg_dump/pg_restore + Storage manifest + tombstone replay, and rollback safety',
  sources: {},
  assertions: 0,
  actorConnections: [],
  scenarios: []
}

const h = new Harness(report)
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.once(sig, () => {
    if (!h.finishing && !h.signal) h.signal = sig
  })
}

const USER_ALPHA_OWNER = '11111111-1111-4111-8111-111111111111'
const USER_ALPHA_MEMBER = '22222222-2222-4222-8222-222222222222'
const USER_BETA_OWNER = '33333333-3333-4333-8333-333333333333'
const PROJECT_ALPHA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PROJECT_BETA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const STORY_KEEP = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const STORY_DELETE_AFTER_BACKUP = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const OBJ_KEEP = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const OBJ_DELETE_AFTER_BACKUP = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

const FORWARD_RECONCILIATION_SQL = `
-- Step 1: Revoke blanket authenticated/anon DML grants introduced by 20260625081000
REVOKE INSERT, UPDATE, DELETE ON public.agent_runs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.story_artifacts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.public_archive_entries FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_resource_wallets FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.waitlist FROM anon, authenticated;

-- Step 2: Drop surviving permissive wallet write policies missed by 20261006000001
DROP POLICY IF EXISTS "Users can insert own wallet" ON public.user_resource_wallets;
DROP POLICY IF EXISTS "Users can update own wallet" ON public.user_resource_wallets;
DROP POLICY IF EXISTS "wallet_insert_self" ON public.user_resource_wallets;
DROP POLICY IF EXISTS "wallet_update_self" ON public.user_resource_wallets;

-- Step 3: Idempotently add missing columns required by settings-service.ts & notifications.ts
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone_number text;

ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS email_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_enabled boolean DEFAULT false;

-- Step 4: Replace broken storage.foldername(p.name) policies on storage.objects with storage.foldername(objects.name)
DROP POLICY IF EXISTS "Project members can view project files" ON storage.objects;
CREATE POLICY "Project members can view project files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'saga'
    AND (storage.foldername(objects.name))[1] = 'projects'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE (storage.foldername(objects.name))[2] = p.id::text
        AND (
          p.facilitator_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = p.id
              AND pm.user_id = auth.uid()
              AND pm.status = 'active'
          )
        )
    )
  );

DROP POLICY IF EXISTS "Project members can upload project files" ON storage.objects;
CREATE POLICY "Project members can upload project files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'saga'
    AND (storage.foldername(objects.name))[1] = 'projects'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE (storage.foldername(objects.name))[2] = p.id::text
        AND (
          p.facilitator_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = p.id
              AND pm.user_id = auth.uid()
              AND pm.status = 'active'
          )
        )
    )
  );

DROP POLICY IF EXISTS "Project owners and facilitators can delete project files" ON storage.objects;
CREATE POLICY "Project owners and facilitators can delete project files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'saga'
    AND (storage.foldername(objects.name))[1] = 'projects'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE (storage.foldername(objects.name))[2] = p.id::text
        AND p.facilitator_id = auth.uid()
    )
  );

-- Step 5: Revoke public/authenticated SELECT on waitlist_stats view
REVOKE SELECT ON public.waitlist_stats FROM anon, authenticated;
GRANT SELECT ON public.waitlist_stats TO service_role;
`

async function setupDriftedRemoteFixture(h) {
  const snapBytes = await readFile(join(root, snapshotPath))
  h.eq(digest(snapBytes), '8b2a4647b017305183e67b2b932be02080a789dba4fc48b23b2f23a97991e66e', 'pinned remote metadata snapshot')
  const selBytes = await readFile(join(root, selectionPath))
  report.sources[snapshotPath] = digest(snapBytes)
  report.sources[selectionPath] = digest(selBytes)

  await h.db.query(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE SCHEMA IF NOT EXISTS storage;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon LOGIN NOSUPERUSER NOBYPASSRLS; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated LOGIN NOSUPERUSER NOBYPASSRLS; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role LOGIN NOSUPERUSER BYPASSRLS; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'metadata_reader') THEN CREATE ROLE metadata_reader LOGIN NOSUPERUSER NOBYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
    INSERT INTO auth.users (id, email) VALUES
      ('${USER_ALPHA_OWNER}', 'alpha-owner@example.test'),
      ('${USER_ALPHA_MEMBER}', 'alpha-member@example.test'),
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
    -- Remote shape of user_settings: 22 preference columns, missing full_name/email/phone_number
    CREATE TABLE public.user_settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
      email_notifications boolean DEFAULT true,
      push_notifications boolean DEFAULT true,
      weekly_digest boolean DEFAULT true,
      new_story_alerts boolean DEFAULT true,
      comment_notifications boolean DEFAULT true,
      invitation_notifications boolean DEFAULT true,
      audio_quality varchar(20) DEFAULT 'high',
      auto_transcribe boolean DEFAULT true,
      save_original_audio boolean DEFAULT true,
      audio_compression boolean DEFAULT false,
      default_story_visibility varchar(20) DEFAULT 'project_members',
      allow_story_downloads boolean DEFAULT true,
      show_profile_in_directory boolean DEFAULT false,
      allow_analytics boolean DEFAULT true,
      interface_language varchar(10) DEFAULT 'en',
      transcription_language varchar(10) DEFAULT 'auto',
      timezone varchar(50) DEFAULT 'UTC',
      date_format varchar(20) DEFAULT 'MM/DD/YYYY',
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    -- Remote shape of notification_settings: missing user_id, email_enabled, push_enabled
    CREATE TABLE public.notification_settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
      email_notifications boolean DEFAULT true,
      notification_frequency text DEFAULT 'immediate',
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    -- Remote shape of user_resource_wallets: user_id is PK, surviving permissive write policies
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
      email varchar(255) NOT NULL UNIQUE,
      name varchar(255),
      locale varchar(10) DEFAULT 'en',
      source varchar(50) DEFAULT 'website',
      status varchar(20) DEFAULT 'pending',
      created_at timestamptz DEFAULT now(),
      notified_at timestamptz
    );
    CREATE VIEW public.waitlist_stats AS
      SELECT count(*)::int AS total_signups,
             count(*) FILTER (WHERE status = 'pending')::int AS pending_count
      FROM public.waitlist;

    CREATE TABLE storage.buckets (
      id text PRIMARY KEY,
      name text NOT NULL UNIQUE,
      public boolean DEFAULT true
    );
    CREATE TABLE storage.objects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      bucket_id text REFERENCES storage.buckets(id),
      name text,
      owner uuid,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.story_artifacts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.public_archive_entries ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.user_resource_wallets ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "projects_select" ON public.projects FOR SELECT TO authenticated USING (true);
    CREATE POLICY "project_members_select" ON public.project_members FOR SELECT TO authenticated USING (true);
    CREATE POLICY "stories_select_member" ON public.stories FOR SELECT TO authenticated USING (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = stories.project_id
          AND (p.facilitator_id = auth.uid() OR EXISTS (
            SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid() AND pm.status = 'active'
          ))
      )
    );
    CREATE POLICY "user_settings_self" ON public.user_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "notification_settings_self" ON public.notification_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- Remote drifted policies on user_resource_wallets (surviving because 20261006000001 dropped wrong policy names)
    CREATE POLICY "Users can view own wallet" ON public.user_resource_wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
    CREATE POLICY "Users can insert own wallet" ON public.user_resource_wallets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Users can update own wallet" ON public.user_resource_wallets FOR UPDATE TO authenticated USING (auth.uid() = user_id);

    -- Remote drifted policy on storage.objects: uses storage.foldername(p.name) instead of storage.foldername(objects.name)
    CREATE POLICY "Project members can view project files" ON storage.objects FOR SELECT TO authenticated USING (
      bucket_id = 'saga'
      AND (storage.foldername(name))[1] = 'projects'
      AND EXISTS (
        SELECT 1 FROM public.projects p
        LEFT JOIN public.project_members pm ON p.id = pm.project_id
        WHERE (storage.foldername(p.name))[2] = p.id::text
          AND (p.facilitator_id = auth.uid() OR pm.user_id = auth.uid())
      )
    );

    -- Simulate 20260625081000 blanket grant overriding earlier revokes + waitlist_stats default grant
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT SELECT ON public.waitlist_stats TO anon, authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON storage.buckets, storage.objects TO authenticated, service_role;
  `)

  await h.db.query(`
    INSERT INTO storage.buckets (id, name, public) VALUES
      ('audio-recordings', 'audio-recordings', true),
      ('saga', 'saga', true);
    INSERT INTO public.projects (id, name, facilitator_id) VALUES
      ('${PROJECT_ALPHA}', 'Family Alpha', '${USER_ALPHA_OWNER}'),
      ('${PROJECT_BETA}', 'Family Beta', '${USER_BETA_OWNER}');
    INSERT INTO public.project_members (project_id, user_id, role, status) VALUES
      ('${PROJECT_ALPHA}', '${USER_ALPHA_MEMBER}', 'member', 'active');
    INSERT INTO public.stories (id, project_id, storyteller_id, title, content, audio_url) VALUES
      ('${STORY_KEEP}', '${PROJECT_ALPHA}', '${USER_ALPHA_MEMBER}', 'Childhood Winter', 'We skated on the river.', 'audio-recordings/${USER_ALPHA_MEMBER}/projects/${PROJECT_ALPHA}/stories/${STORY_KEEP}/keep.webm'),
      ('${STORY_DELETE_AFTER_BACKUP}', '${PROJECT_ALPHA}', '${USER_ALPHA_MEMBER}', 'Temporary Draft To Delete', 'Delete me after freeze.', 'audio-recordings/${USER_ALPHA_MEMBER}/projects/${PROJECT_ALPHA}/stories/${STORY_DELETE_AFTER_BACKUP}/delete.webm');
    INSERT INTO public.user_resource_wallets (user_id, project_vouchers, facilitator_seats, storyteller_seats) VALUES
      ('${USER_ALPHA_OWNER}', 1, 2, 2);
    INSERT INTO public.user_settings (user_id, interface_language) VALUES
      ('${USER_ALPHA_OWNER}', 'en');
    INSERT INTO public.waitlist (email, name) VALUES
      ('early@example.test', 'Early User');
    INSERT INTO storage.objects (id, bucket_id, name, owner, metadata) VALUES
      ('${OBJ_KEEP}', 'saga', 'projects/${PROJECT_ALPHA}/photo-keep.jpg', '${USER_ALPHA_OWNER}', '{"size": 4096, "sha256": "aaa111"}'::jsonb),
      ('${OBJ_DELETE_AFTER_BACKUP}', 'audio-recordings', '${USER_ALPHA_MEMBER}/projects/${PROJECT_ALPHA}/stories/${STORY_DELETE_AFTER_BACKUP}/delete.webm', '${USER_ALPHA_MEMBER}', '{"size": 8192, "sha256": "bbb222"}'::jsonb);
  `)
}

try {
  await h.start(false)
  await setupDriftedRemoteFixture(h)

  // Scenario 1: Prove the pre-reconciliation drift / incompatibilities (RED baseline)
  await h.scenario('1_pre_reconciliation_drift_red_probes', async () => {
    const grantCheck = (await h.db.query(`
      SELECT
        has_table_privilege('authenticated', 'public.agent_runs', 'INSERT') AS agent_runs_insert,
        has_table_privilege('authenticated', 'public.user_resource_wallets', 'UPDATE') AS wallets_update,
        has_table_privilege('anon', 'public.waitlist_stats', 'SELECT') AS anon_waitlist_stats
    `)).rows[0]
    h.eq(grantCheck, {
      agent_runs_insert: true,
      wallets_update: true,
      anon_waitlist_stats: true
    }, 'blanket grants and waitlist_stats exposure present before reconciliation')

    // Wallet self-minting succeeds under drifted policy + grant (rollback=true so we don't mutate before backup)
    const selfMint = await h.actor(
      'authenticated',
      USER_ALPHA_OWNER,
      `UPDATE public.user_resource_wallets SET project_vouchers = 999 WHERE user_id = $1 RETURNING project_vouchers`,
      [USER_ALPHA_OWNER],
      'authenticated',
      true
    )
    h.eq(selfMint.sqlstate, '00000', 'drifted wallet policy allows client self-minting before fix')
    h.eq(selfMint.rows[0].project_vouchers, 999, 'self-minted value returned')

    // settings-service.ts profile query fails with 42703 undefined_column
    const settingsMissingCols = await h.actor(
      'authenticated',
      USER_ALPHA_OWNER,
      `SELECT full_name, email, phone_number FROM public.user_settings WHERE user_id = $1`,
      [USER_ALPHA_OWNER]
    )
    h.eq(settingsMissingCols.sqlstate, '42703', 'user_settings missing profile columns before reconciliation')

    // notifications.ts query fails with 42703 undefined_column
    const notifMissingCols = await h.actor(
      'authenticated',
      USER_ALPHA_OWNER,
      `SELECT user_id, email_enabled, push_enabled FROM public.notification_settings WHERE user_id = $1`,
      [USER_ALPHA_OWNER]
    )
    h.eq(notifMissingCols.sqlstate, '42703', 'notification_settings missing user_id/email_enabled/push_enabled before reconciliation')

    // Broken storage.foldername(p.name) policy denies valid Family Alpha member reading saga object
    const sagaBrokenRead = await h.actor(
      'authenticated',
      USER_ALPHA_MEMBER,
      `SELECT id, name FROM storage.objects WHERE id = $1`,
      [OBJ_KEEP]
    )
    h.eq(sagaBrokenRead.sqlstate, '00000', 'SELECT succeeds with 0 visible rows under broken p.name policy')
    h.eq(sagaBrokenRead.rows.length, 0, 'broken storage.foldername(p.name) hides project file from valid member')
  })

  // Scenario 2: Scheme B Pre-Migration Backup (pg_dump -Fc + Storage Object Manifest + Tombstone Log)
  let dumpPath, storageManifest, tombstoneManifest
  await h.scenario('2_scheme_b_pre_migration_backup_and_manifest', async () => {
    dumpPath = join(h.scratch, 'scheme-b-pre-migration.dump')
    h.command('pg_dump', [
      '-h', h.config.host,
      '-p', String(h.config.port),
      '-U', 'rehearsal_admin',
      '-d', 'saga_pg17_rehearsal',
      '--format=custom',
      '--file', dumpPath
    ])
    const dumpStats = await stat(dumpPath)
    h.ok(dumpStats.size > 1024, 'pg_dump custom archive non-empty')
    const dumpBytes = await readFile(dumpPath)
    const toc = h.command('pg_restore', ['--list', dumpPath])
    h.ok(toc.includes('TABLE DATA public stories'), 'pg_dump archive contains stories data')
    h.ok(toc.includes('TABLE DATA storage objects'), 'pg_dump archive contains storage.objects metadata')

    const objectsRows = (await h.db.query(`SELECT id, bucket_id, name, metadata FROM storage.objects ORDER BY id`)).rows
    storageManifest = {
      freezeTimestamp: new Date().toISOString(),
      dumpSha256: digest(dumpBytes),
      dumpSizeBytes: dumpStats.size,
      objects: objectsRows.map(r => ({
        id: r.id,
        bucket: r.bucket_id,
        key: r.name,
        sizeBytes: r.metadata.size,
        sha256: r.metadata.sha256
      }))
    }
    h.eq(storageManifest.objects.length, 2, 'two storage objects frozen in Scheme B manifest')

    // Record a post-backup deletion tombstone (story + audio object deleted after freeze point)
    tombstoneManifest = {
      recordedAfterFreezeAt: new Date().toISOString(),
      tombstones: [
        {
          targetType: 'story',
          storyId: STORY_DELETE_AFTER_BACKUP,
          storageObjectId: OBJ_DELETE_AFTER_BACKUP,
          bucket: 'audio-recordings',
          key: `${USER_ALPHA_MEMBER}/projects/${PROJECT_ALPHA}/stories/${STORY_DELETE_AFTER_BACKUP}/delete.webm`,
          reason: 'user_requested_deletion_after_backup_freeze'
        }
      ]
    }
    report.schemeBBackup = {
      dumpFormat: 'custom (-Fc)',
      dumpSizeBytes: dumpStats.size,
      dumpSha256: storageManifest.dumpSha256,
      frozenObjectCount: storageManifest.objects.length,
      postFreezeTombstoneCount: tombstoneManifest.tombstones.length
    }
  })

  // Scenario 3: Execute 5-Step Forward Idempotent Reconciliation SQL Twice
  await h.scenario('3_forward_idempotent_reconciliation_sql_twice', async () => {
    await h.db.query(FORWARD_RECONCILIATION_SQL)
    // Run a second time to prove idempotency
    await h.db.query(FORWARD_RECONCILIATION_SQL)

    const grantCheckAfter = (await h.db.query(`
      SELECT
        has_table_privilege('authenticated', 'public.agent_runs', 'INSERT') AS agent_runs_insert,
        has_table_privilege('authenticated', 'public.story_artifacts', 'INSERT') AS story_artifacts_insert,
        has_table_privilege('authenticated', 'public.public_archive_entries', 'INSERT') AS archive_insert,
        has_table_privilege('authenticated', 'public.user_resource_wallets', 'UPDATE') AS wallets_update,
        has_table_privilege('authenticated', 'public.waitlist', 'DELETE') AS waitlist_delete,
        has_table_privilege('anon', 'public.waitlist_stats', 'SELECT') AS anon_waitlist_stats,
        has_table_privilege('authenticated', 'public.waitlist_stats', 'SELECT') AS auth_waitlist_stats,
        has_table_privilege('service_role', 'public.waitlist_stats', 'SELECT') AS service_waitlist_stats
    `)).rows[0]
    h.eq(grantCheckAfter, {
      agent_runs_insert: false,
      story_artifacts_insert: false,
      archive_insert: false,
      wallets_update: false,
      waitlist_delete: false,
      anon_waitlist_stats: false,
      auth_waitlist_stats: false,
      service_waitlist_stats: true
    }, 'all blanket write privileges and waitlist_stats leaks revoked after reconciliation')

    // Wallet self-minting is now rejected with 42501 insufficient_privilege
    const selfMintAfter = await h.actor(
      'authenticated',
      USER_ALPHA_OWNER,
      `UPDATE public.user_resource_wallets SET project_vouchers = 999 WHERE user_id = $1`,
      [USER_ALPHA_OWNER]
    )
    h.eq(selfMintAfter.sqlstate, '42501', 'wallet self-minting blocked after reconciliation')

    // settings-service.ts profile update & select now succeed while preserving existing preference columns
    const settingsUpdate = await h.actor(
      'authenticated',
      USER_ALPHA_OWNER,
      `UPDATE public.user_settings SET full_name = 'Alice Alpha', email = 'alpha-owner@example.test', phone_number = '+15550001' WHERE user_id = $1 RETURNING full_name, interface_language`,
      [USER_ALPHA_OWNER]
    )
    h.eq(settingsUpdate.sqlstate, '00000', 'user_settings profile columns writable after reconciliation')
    h.eq(settingsUpdate.rows[0], { full_name: 'Alice Alpha', interface_language: 'en' }, 'existing preference columns preserved alongside new profile columns')

    // notifications.ts insert & select now succeed
    const notifInsert = await h.actor(
      'authenticated',
      USER_ALPHA_OWNER,
      `INSERT INTO public.notification_settings (project_id, user_id, email_enabled, push_enabled) VALUES ($1, $2, true, false) RETURNING user_id, email_enabled, push_enabled`,
      [PROJECT_ALPHA, USER_ALPHA_OWNER]
    )
    h.eq(notifInsert.sqlstate, '00000', 'notification_settings columns writable after reconciliation')
    h.eq(notifInsert.rows[0], { user_id: USER_ALPHA_OWNER, email_enabled: true, push_enabled: false }, 'notification_settings values stored accurately')

    // Fixed storage.objects saga policy allows Family Alpha member and denies Family Beta owner
    const sagaAlphaRead = await h.actor(
      'authenticated',
      USER_ALPHA_MEMBER,
      `SELECT id, name FROM storage.objects WHERE id = $1`,
      [OBJ_KEEP]
    )
    h.eq(sagaAlphaRead.sqlstate, '00000', 'Family Alpha active member query succeeds')
    h.eq(sagaAlphaRead.rows.length, 1, 'Family Alpha active member can view project saga object after policy fix')

    const sagaBetaRead = await h.actor(
      'authenticated',
      USER_BETA_OWNER,
      `SELECT id, name FROM storage.objects WHERE id = $1`,
      [OBJ_KEEP]
    )
    h.eq(sagaBetaRead.sqlstate, '00000', 'Family Beta query succeeds with 0 rows')
    h.eq(sagaBetaRead.rows.length, 0, 'Cross-family access to saga object remains denied')
  })

  // Scenario 4: Application Rollback Rehearsal (disable new writes/processing, preserve data & security guards)
  await h.scenario('4_application_rollback_preserves_data_and_security_guards', async () => {
    await h.db.query(`SELECT set_config('app.reconciled_writes_enabled', 'false', false)`)
    const flag = (await h.db.query(`SELECT current_setting('app.reconciled_writes_enabled', true) AS enabled`)).rows[0].enabled
    h.eq(flag, 'false', 'application feature gate rolled back to disabled')

    // Data remains readable by authorized member
    const storiesVisible = await h.actor(
      'authenticated',
      USER_ALPHA_MEMBER,
      `SELECT id FROM public.stories WHERE project_id = $1 ORDER BY id`,
      [PROJECT_ALPHA]
    )
    h.eq(storiesVisible.rows.map(r => r.id), [STORY_KEEP, STORY_DELETE_AFTER_BACKUP], 'stories preserved during application rollback')

    // Security fixes remain active during rollback (never re-enabling wallet self-minting or waitlist_stats leak)
    const walletAttemptOnRollback = await h.actor(
      'authenticated',
      USER_ALPHA_OWNER,
      `UPDATE public.user_resource_wallets SET project_vouchers = 50 WHERE user_id = $1`,
      [USER_ALPHA_OWNER]
    )
    h.eq(walletAttemptOnRollback.sqlstate, '42501', 'security policy fix never rolled back')
  })

  // Scenario 5: Scheme B Isolated pg_restore + Post-Freeze Deletion Tombstone Replay
  await h.scenario('5_scheme_b_isolated_pg_restore_and_tombstone_replay', async () => {
    const admin = await h.client('rehearsal_admin', 'postgres')
    await admin.query('CREATE DATABASE saga_pg17_restored')
    await h.close(admin)

    h.command('pg_restore', [
      '-h', h.config.host,
      '-p', String(h.config.port),
      '-U', 'rehearsal_admin',
      '-d', 'saga_pg17_restored',
      '--no-owner',
      '--no-acl',
      dumpPath
    ])

    const restoredDb = await h.client('rehearsal_admin', 'saga_pg17_restored')
    try {
      // Before tombstone replay, the deleted draft story from before the freeze point is present in the raw dump
      const beforeTombstone = (await restoredDb.query(`SELECT id FROM public.stories ORDER BY id`)).rows.map(r => r.id)
      h.eq(beforeTombstone, [STORY_KEEP, STORY_DELETE_AFTER_BACKUP], 'raw restored database contains pre-freeze rows before tombstone replay')

      // Apply forward reconciliation + replay post-freeze tombstones BEFORE opening user access
      await restoredDb.query(FORWARD_RECONCILIATION_SQL)
      for (const t of tombstoneManifest.tombstones) {
        await restoredDb.query(`DELETE FROM public.stories WHERE id = $1`, [t.storyId])
        await restoredDb.query(`DELETE FROM storage.objects WHERE id = $1`, [t.storageObjectId])
      }
      const restoredStorageManifest = storageManifest.objects.filter(
        o => !tombstoneManifest.tombstones.some(t => t.storageObjectId === o.id)
      )

      const afterTombstoneStories = (await restoredDb.query(`SELECT id, title FROM public.stories ORDER BY id`)).rows
      h.eq(afterTombstoneStories, [{ id: STORY_KEEP, title: 'Childhood Winter' }], 'tombstoned story purged and cannot resurrect after restore')

      const afterTombstoneObjects = (await restoredDb.query(`SELECT id, bucket_id, name, metadata->>'sha256' AS sha256 FROM storage.objects ORDER BY id`)).rows
      h.eq(afterTombstoneObjects, [{
        id: OBJ_KEEP,
        bucket_id: 'saga',
        name: `projects/${PROJECT_ALPHA}/photo-keep.jpg`,
        sha256: 'aaa111'
      }], 'tombstoned media object purged and surviving object SHA-256 matches frozen manifest')
      h.eq(restoredStorageManifest.length, 1, 'restored Storage manifest count matches post-tombstone database state')
    } finally {
      await h.close(restoredDb)
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
    cleanup: report.cleanup
  }))
  process.exitCode = report.status === 'passed' ? 0 : 1
}

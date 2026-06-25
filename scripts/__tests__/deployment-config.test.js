const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')
const yaml = require('js-yaml')

const rootDir = path.resolve(__dirname, '../..')

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath))
}

function workflow() {
  return yaml.load(read('.github/workflows/deploy.yml'))
}

function job(id) {
  const jobs = workflow().jobs || {}
  assert.ok(jobs[id], `expected GitHub Actions job "${id}" to exist`)
  return jobs[id]
}

function stepRuns(jobConfig, commandFragment) {
  return (jobConfig.steps || []).some((step) =>
    typeof step.run === 'string' && step.run.includes(commandFragment),
  )
}

function stepUses(jobConfig, actionName) {
  return (jobConfig.steps || []).some((step) =>
    typeof step.uses === 'string' && step.uses.startsWith(actionName),
  )
}

test('GitHub Actions separates CI, Vercel preview, Supabase production, and Vercel production jobs', () => {
  const permissions = workflow().permissions || {}
  assert.equal(permissions.contents, 'read')
  assert.equal(permissions['pull-requests'], 'write')
  assert.equal(permissions.issues, 'write')
  assert.equal(permissions.deployments, 'write')

  const ci = job('ci')
  assert.equal(ci['runs-on'], 'ubuntu-latest')
  assert.ok(stepUses(ci, 'actions/checkout@v4'))
  assert.ok(stepUses(ci, 'actions/setup-node@v4'))
  assert.ok(stepRuns(ci, 'npm ci'))
  assert.ok(stepRuns(ci, 'npm run test:infra'))
  assert.ok(stepRuns(ci, 'npm run type-check'))
  assert.ok(stepRuns(ci, 'npm run lint'))
  assert.ok(stepRuns(ci, 'npm test --workspace=packages/web -- --runInBand'))

  const preview = job('vercel-preview')
  assert.equal(preview.needs, 'ci')
  assert.match(String(preview.if), /pull_request/)
  assert.ok(stepRuns(preview, 'vercel pull --yes --environment=preview'))
  assert.ok(stepRuns(preview, 'vercel deploy --yes'))

  const database = job('supabase-production')
  assert.equal(database.needs, 'ci')
  assert.match(String(database.if), /refs\/heads\/main/)
  assert.ok(stepUses(database, 'supabase/setup-cli@v1'))
  assert.ok(stepRuns(database, 'supabase db push --linked'))

  const production = job('vercel-production')
  assert.deepEqual(production.needs, ['ci', 'supabase-production'])
  assert.match(String(production.if), /refs\/heads\/main/)
  assert.ok(stepRuns(production, 'vercel pull --yes --environment=production'))
  assert.ok(stepRuns(production, 'vercel deploy --prod --yes'))
})

test('Vercel project config builds the web workspace from the monorepo root and defines cron jobs', () => {
  const config = readJson('packages/web/vercel.json')

  assert.equal(config.framework, 'nextjs')
  assert.equal(config.installCommand, 'cd ../.. && npm ci')
  assert.equal(config.buildCommand, 'cd ../.. && npm run build:vercel')
  assert.equal(config.outputDirectory, '.next')
  assert.ok(Array.isArray(config.crons), 'expected crons array')
  assert.deepEqual(config.crons, [
    {
      path: '/api/admin/cleanup-invitations',
      schedule: '0 9 * * *',
    },
  ])
})

test('Supabase CLI migrations contain the shipped database scripts in dependency order', () => {
  const migrationsDir = path.join(rootDir, 'supabase/migrations')
  const migrations = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort()

  assert.deepEqual(migrations, [
    '20250731012532_remote_history_placeholder.sql',
    '20250731015259_remote_history_placeholder.sql',
    '20250802015525_remote_history_placeholder.sql',
    '20250802015612_remote_history_placeholder.sql',
    '20260611000000_agent_phase1.sql',
    '20260612000000_agent_phase2_public_archive.sql',
    '20260621000000_storage_policies.sql',
    '20260625081000_dashboard_support_tables.sql',
  ])

  assert.equal(
    read('supabase/migrations/20260611000000_agent_phase1.sql'),
    read('packages/web/supabase/agent-phase1.sql'),
  )
  assert.equal(
    read('supabase/migrations/20260612000000_agent_phase2_public_archive.sql'),
    read('packages/web/supabase/agent-phase2-public-archive.sql'),
  )
  assert.equal(
    read('supabase/migrations/20260621000000_storage_policies.sql'),
    read('packages/web/supabase/storage-policies.sql'),
  )

  const dashboardSql = read('supabase/migrations/20260625081000_dashboard_support_tables.sql')
  assert.match(dashboardSql, /create table if not exists public\.notifications/)
  assert.match(dashboardSql, /create policy "wallet_insert_self"/)
})

test('storage policy migration can run after policies already exist', () => {
  const storageSql = read('supabase/migrations/20260621000000_storage_policies.sql')

  for (const policyName of [
    'Users can upload files to their own folders',
    'Users can view their own files',
    'Users can update their own files',
    'Users can delete their own files',
    'Project members can view project files',
    'Project facilitators can upload project files',
    'Storytellers can upload story files',
  ]) {
    assert.match(
      storageSql,
      new RegExp(`DROP POLICY IF EXISTS "${policyName}" ON storage\\.objects;`),
      `${policyName} should be dropped before create for repeatable deploys`,
    )
  }

  assert.doesNotMatch(
    storageSql,
    /^ALTER TABLE storage\.objects ENABLE ROW LEVEL SECURITY;$/m,
    'managed Supabase projects do not allow postgres to alter storage.objects ownership-level settings',
  )
  assert.match(
    storageSql,
    /Skipping storage\.objects RLS enablement/,
    'storage migration should document why storage.objects RLS enablement is skipped',
  )
  for (const managedStorageStatement of [
    'CREATE OR REPLACE FUNCTION storage.get_file_path_parts',
    'CREATE OR REPLACE FUNCTION storage.user_can_access_project',
    'CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket_user',
    'COMMENT ON TABLE storage.objects',
  ]) {
    assert.doesNotMatch(
      storageSql,
      new RegExp(managedStorageStatement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      'storage migration should not modify Supabase-owned storage schema objects',
    )
  }
})

test('environment example files document required deployment variables without real secrets', () => {
  const examples = ['.env.production.example', 'packages/web/.env.example']
  const forbiddenPatterns = [
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
    /sk-or-v1-[A-Za-z0-9]+/,
    /encdblxyxztvfxotfuyh/,
  ]

  for (const file of examples) {
    const content = read(file)
    for (const pattern of forbiddenPatterns) {
      assert.doesNotMatch(content, pattern, `${file} contains a real-looking secret or project id`)
    }
  }

  const productionExample = read('.env.production.example')
  for (const key of [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENROUTER_API_KEY',
    'SILICONFLOW_API_KEY',
    'STRIPE_SECRET_KEY',
    'ADMIN_CRON_SECRET',
    'NEXT_PUBLIC_WEB_URL',
  ]) {
    assert.match(productionExample, new RegExp(`^${key}=`, 'm'), `${key} missing from production env example`)
  }
})

test('deployment runbook lists GitHub secrets, Vercel variables, and Supabase migration flow', () => {
  const runbook = read('docs/deployment/github-vercel-supabase.md')

  for (const text of [
    'VERCEL_TOKEN',
    'VERCEL_ORG_ID',
    'VERCEL_PROJECT_ID',
    'SUPABASE_ACCESS_TOKEN',
    'SUPABASE_DB_PASSWORD',
    'supabase db push --linked',
    'vercel pull --yes --environment=production',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]) {
    assert.match(runbook, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('Supabase restore tooling bootstraps the current app schema before migrations', () => {
  const bootstrapSql = read('supabase/bootstrap/20260624000000_app_base_schema.sql')
  const restoreScript = read('scripts/supabase/restore-new-project.sh')
  const runbook = read('docs/deployment/supabase-new-project-restore.md')

  for (const tableName of [
    'profiles',
    'projects',
    'project_roles',
    'stories',
    'interactions',
    'user_resource_wallets',
    'seat_transactions',
    'invitations',
    'chapters',
    'prompts',
    'project_prompt_state',
    'privacy_agreements',
  ]) {
    assert.match(
      bootstrapSql,
      new RegExp(`create table if not exists public\\.${tableName}\\b`, 'i'),
      `base schema should create public.${tableName}`,
    )
  }

  for (const text of [
    'alter table public.projects add column if not exists name text',
    'alter table public.stories add column if not exists user_id uuid',
    'create or replace function public.create_project_with_role',
    'create policy "projects_select_members"',
  ]) {
    assert.match(bootstrapSql, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
  }

  assert.match(restoreScript, /psql "\$DATABASE_URL" -v ON_ERROR_STOP=0 -f "\$BACKUP_FILE"/)
  assert.match(restoreScript, /supabase\/bootstrap\/20260624000000_app_base_schema\.sql/)
  assert.match(restoreScript, /supabase\/migrations\/20260611000000_agent_phase1\.sql/)
  assert.match(restoreScript, /supabase\/migrations\/20260612000000_agent_phase2_public_archive\.sql/)
  assert.match(restoreScript, /supabase\/migrations\/20260621000000_storage_policies\.sql/)

  for (const text of [
    'db_cluster-08-08-2025@05-34-47.backup',
    'DATABASE_URL',
    'restore-new-project.sh',
    'Supabase Dashboard > Project Settings > Database',
    'rotate',
  ]) {
    assert.match(runbook, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
  }
})

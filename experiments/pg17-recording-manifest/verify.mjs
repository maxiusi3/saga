import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { setTimeout as delay } from 'node:timers/promises'
import { Harness, root, digest, exists } from '../pg17-routines/runtime.mjs'

const migrationPath = 'supabase/migrations/20261102000001_recording_seal_manifest.sql'
const foundationPath = 'supabase/migrations/20261024000001_p1_foundation_and_reconciliation.sql'
const runnerPath = 'experiments/pg17-recording-manifest/verify.mjs'
const evidenceDir = join(root, 'docs/research/evidence/2026-11-02-g1-durable-manifest')
const mode = process.argv.includes('--without-migration') ? 'red-without-migration' : 'verify'
const runId = `pg-${mode}-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`
const output = join(evidenceDir, `${runId}.json`)
const report = {
  startedAt: new Date().toISOString(), status: 'running', mode,
  scope: 'Synthetic isolated PG17.4 manifest identity/durability only; no full migration chain, PostgREST, Storage readback, real audio, decode, ready or cleanup authorization',
  sources: {}, sourceSnapshots: {}, assertions: 0, actorConnections: [], scenarios: [],
}
const h = new Harness(report)
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => { if (!h.finishing && !h.signal) h.signal = signal })
}
const USER = '11111111-1111-4111-8111-111111111111'
const OTHER_USER = '22222222-2222-4222-8222-222222222222'
const PROJECT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_PROJECT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const STORY = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const HASH = '0123456789abcdef'.repeat(4)
const rpc = 'SELECT public.seal_recording_manifest($1::jsonb) AS receipt'
let migration

async function source(path) {
  const content = await readFile(join(root, path), 'utf8')
  report.sources[path] = digest(content)
  if (path === runnerPath || path === migrationPath) {
    const filename = `raw/${runId}-${path === runnerPath ? 'runner.mjs' : 'migration.sql'}.gz`
    const compressed = gzipSync(content)
    await mkdir(join(evidenceDir, 'raw'), { recursive: true })
    await writeFile(join(evidenceDir, filename), compressed, { flag: 'wx' })
    report.sourceSnapshots[path] = { path: filename, sha256: digest(compressed), decodedSha256: digest(content) }
  }
  return content
}

function manifest(overrides = {}, count = 2) {
  const sessionId = overrides.sessionId ?? randomUUID()
  const projectId = overrides.projectId ?? PROJECT
  const userId = overrides.userId ?? USER
  return {
    schemaVersion: 1, projectId, sessionId, userId, storyId: null, assetId: randomUUID(), mimeType: 'audio/webm;codecs=opus',
    chunks: Array.from({ length: count }, (_, index) => {
      const objectKey = `projects/${projectId}/sessions/${sessionId}/${index}`
      return { index, chunkId: `chunk-${index}`, bucket: 'audio-recordings', objectKey,
        storageObjectKey: `${userId}/${objectKey}`, byteSize: 4 + index, sha256: HASH }
    }), ...overrides,
  }
}

async function setup() {
  const foundation = await source(foundationPath)
  await source(runnerPath)
  await source('experiments/pg17-routines/runtime.mjs')
  await source('experiments/pg17-routines/runtime-pins.json')
  await h.db.query(`
    CREATE SCHEMA auth;
    CREATE ROLE anon LOGIN NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE authenticated LOGIN NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE service_role LOGIN NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE metadata_reader LOGIN NOSUPERUSER NOBYPASSRLS;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role, metadata_reader;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE TABLE public.projects (id uuid PRIMARY KEY, facilitator_id uuid REFERENCES auth.users(id));
    CREATE TABLE public.project_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid REFERENCES public.projects(id),
      user_id uuid REFERENCES auth.users(id), role text, status text, UNIQUE(project_id, user_id));
    CREATE TABLE public.project_members (project_id uuid REFERENCES public.projects(id), user_id uuid REFERENCES auth.users(id), status text);
    CREATE TABLE public.stories (id uuid PRIMARY KEY, project_id uuid REFERENCES public.projects(id), storyteller_id uuid REFERENCES auth.users(id));
    INSERT INTO auth.users VALUES ('${USER}'), ('${OTHER_USER}');
    INSERT INTO public.projects VALUES ('${PROJECT}', '${OTHER_USER}'), ('${OTHER_PROJECT}', '${OTHER_USER}');
    INSERT INTO public.project_roles (project_id, user_id, role, status) VALUES
      ('${PROJECT}', '${USER}', 'storyteller', 'active'), ('${OTHER_PROJECT}', '${OTHER_USER}', 'storyteller', 'active');
    INSERT INTO public.stories VALUES ('${STORY}', '${PROJECT}', '${USER}');
  `)
  const tables = ['media_assets', 'deletion_requests', 'processing_jobs', 'recording_sessions', 'recording_chunks']
  report.fixture = {
    syntheticPrerequisites: ['auth.users', 'auth.uid()', 'projects', 'project_roles', 'project_members', 'stories'],
    exactP1Tables: tables,
    exactP1Functions: ['is_project_facilitator', 'is_active_project_member'],
    exactP1Policies: ['recording_sessions_select_owner_or_member'],
    excluded: 'Other foundation DDL, indexes, policies and other migrations; not a complete migration-chain rehearsal',
  }
  for (const table of tables) {
    const ddl = foundation.match(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} \\([\\s\\S]*?\n\\);`))?.[0]
    h.ok(ddl, `exact foundation ${table} DDL extracted`)
    await h.db.query(ddl)
  }
  for (const name of report.fixture.exactP1Functions) {
    const ddl = foundation.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\n\\$\\$;`))?.[0]
    h.ok(ddl, `exact foundation ${name} function extracted`)
    await h.db.query(ddl)
  }
  const policy = foundation.match(/CREATE POLICY "recording_sessions_select_owner_or_member"[\s\S]*?\n  \);/)?.[0]
  h.ok(policy, 'exact foundation authenticated session policy extracted')
  await h.db.query(`
    ALTER TABLE public.recording_sessions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.recording_chunks ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.recording_sessions, public.recording_chunks FROM PUBLIC, anon, authenticated;
    GRANT SELECT ON public.recording_sessions TO authenticated;
    GRANT ALL ON public.recording_sessions, public.recording_chunks TO service_role;
    ${policy}
  `)
}

async function outcome(client, sql, values = []) {
  try { return { code: '00000', result: await client.query(sql, values) } }
  catch (error) { return { code: error.code ?? 'QUERY_FAILED' } }
}

async function seal(client, input) {
  return (await client.query(rpc, [JSON.stringify(input)])).rows[0].receipt
}

async function denied(client, input, expected, label) {
  const before = await ledgerState()
  h.eq((await outcome(client, rpc, [JSON.stringify(input)])).code, expected, label)
  h.eq(await ledgerState(), before, `${label}: failure mutates no ledger bytes`)
}

async function ledgerState() {
  return (await h.db.query(`SELECT jsonb_build_object(
    'sessions', (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM public.recording_sessions s),
    'chunks', (SELECT jsonb_agg(to_jsonb(c) ORDER BY c.session_id, c.chunk_index) FROM public.recording_chunks c)) AS state`)).rows[0].state
}

async function checkReceipt(value, input) {
  const canonical = (await h.db.query('SELECT $1::jsonb::text AS text', [JSON.stringify(input)])).rows[0].text
  h.eq(value, { schemaVersion: 1, sessionId: input.sessionId, state: 'sealing', manifestSha256: digest(canonical),
    manifest: input, canClearLocalDrafts: false }, 'exact canonical identity receipt; DB digest independently hashed in Node; never ready/cleanup')
  const row = (await h.db.query('SELECT * FROM public.recording_sessions WHERE id = $1', [input.sessionId])).rows[0]
  h.eq([row.project_id, row.user_id, row.story_id, row.mime_type, row.state, row.total_chunks, Number(row.total_input_bytes),
    row.manifest_sha256, row.seal_input, row.confirmed_asset_id, row.merge_job_id, row.confirmed_at],
  [input.projectId, input.userId, input.storyId, input.mimeType, 'sealing', input.chunks.length,
    input.chunks.reduce((sum, chunk) => sum + chunk.byteSize, 0), value.manifestSha256, input, null, null, null],
  'session pins all supplied identity and declared totals without fabricated asset/job/confirmation')
  h.ok(row.sealed_at instanceof Date && row.sealed_at >= row.started_at, 'database seal timestamp is finite and ordered')
  const chunks = (await h.db.query(`SELECT chunk_index, seal_chunk_id, project_id, bucket, object_key, byte_size, sha256
    FROM public.recording_chunks WHERE session_id = $1 ORDER BY chunk_index`, [input.sessionId])).rows
  h.eq(chunks, input.chunks.map((c) => ({ chunk_index: c.index, seal_chunk_id: c.chunkId, project_id: input.projectId,
    bucket: c.bucket, object_key: c.storageObjectKey, byte_size: c.byteSize, sha256: c.sha256 })),
  'each physical bucket path and immutable declared chunk identity is durably persisted')
}

async function waitForLock(client) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if ((await h.db.query("SELECT wait_event_type = 'Lock' AS waiting FROM pg_stat_activity WHERE pid = $1", [client.processID])).rows[0]?.waiting) {
      h.ok(true, 'separate real backend demonstrably waits on database lock')
      return
    }
    await delay(10)
  }
  h.ok(false, 'concurrent backend must reach actual lock wait')
}

async function race(service, first, second) {
  const contender = await h.actorClient('service_role', USER)
  let pending
  await service.query('BEGIN')
  try {
    const winner = await seal(service, first)
    pending = outcome(contender, rpc, [JSON.stringify(second)])
    await waitForLock(contender)
    await service.query('COMMIT')
    return [winner, await pending]
  } finally {
    await service.query('ROLLBACK')
    if (pending) await pending
    await h.close(contender)
  }
}

try {
  await h.start()
  await setup()
  const legacyId = randomUUID()
  await h.db.query(`INSERT INTO public.recording_sessions(id, project_id, user_id, mime_type, state)
    VALUES ($1, $2, $3, 'audio/webm', 'recording')`, [legacyId, PROJECT, USER])
  await h.db.query(`INSERT INTO public.recording_chunks(session_id, project_id, chunk_index, object_key, byte_size, sha256)
    VALUES ($1, $2, 0, 'synthetic-legacy/0', 4, $3)`, [legacyId, PROJECT, HASH])
  const legacyBefore = (await h.db.query('SELECT to_jsonb(s) AS row FROM public.recording_sessions s WHERE id = $1', [legacyId])).rows[0].row
  const legacyChunkBefore = (await h.db.query('SELECT to_jsonb(c) AS row FROM public.recording_chunks c WHERE session_id = $1', [legacyId])).rows[0].row
  const policyBefore = (await h.db.query("SELECT pg_get_expr(polqual, polrelid) AS expr FROM pg_policy WHERE polname = 'recording_sessions_select_owner_or_member'")).rows
  if (mode !== 'red-without-migration') {
    migration = await source(migrationPath)
    await h.db.query(migration)
  }
  const service = await h.actorClient('service_role', USER)
  await h.scenario('Missing service RPC is genuine pre-implementation RED', async () => {
    const input = manifest()
    const probe = await outcome(service, rpc, [JSON.stringify(input)])
    report.rpcProbeSqlstate = probe.code
    h.eq(probe.code, '00000', 'new seal RPC must exist; 42883 is missing-feature RED')
    await checkReceipt(probe.result.rows[0].receipt, input)
  })

  await h.scenario('Exact replay preserves rows, timestamps and complete input; JSON key order does not change identity', async () => {
    const input = manifest({ storyId: STORY })
    const first = await seal(service, input)
    await checkReceipt(first, input)
    const before = await ledgerState()
    await delay(5)
    h.eq(await seal(service, input), first, 'exact replay has same receipt')
    const reordered = Object.fromEntries(Object.entries(input).reverse())
    reordered.chunks = input.chunks.map((chunk) => Object.fromEntries(Object.entries(chunk).reverse()))
    h.eq(await seal(service, reordered), first, 'JSON object key order is not manifest identity')
    h.eq(await ledgerState(), before, 'replay writes no fields or timestamps')
    for (const change of [
      { assetId: randomUUID() }, { storyId: null }, { mimeType: 'audio/ogg' },
      { chunks: input.chunks.map((chunk, index) => index ? chunk : { ...chunk, byteSize: 6 }) },
      { chunks: input.chunks.map((chunk, index) => index ? chunk : { ...chunk, sha256: 'f'.repeat(64) }) },
      { chunks: input.chunks.map((chunk, index) => index ? chunk : { ...chunk, chunkId: 'different' }) },
    ]) await denied(service, { ...input, ...change }, '23505', 'changed input cannot rebind a sealed session')
  })

  await h.scenario('Malformed roots, identity fields and MIME values cannot bypass strict canonical schema', async () => {
    const before = await ledgerState()
    h.eq((await outcome(service, rpc, [null])).code, '22023', 'SQL NULL cannot bypass validation through null-valued predicates')
    h.eq(await ledgerState(), before, 'SQL NULL writes no ledger rows')
    for (const bad of [null, true, false, 1, 'manifest', [], {}, { schemaVersion: 1 }]) {
      await denied(service, bad, '22023', 'root must be the exact complete object')
    }
    const base = manifest()
    for (const key of Object.keys(base)) {
      const missing = { ...base }; delete missing[key]
      await denied(service, missing, '22023', `required root key ${key} cannot be omitted`)
    }
    await denied(service, { ...base, extra: true }, '22023', 'extra root keys rejected')
    for (const key of ['projectId', 'sessionId', 'userId', 'storyId', 'assetId']) {
      for (const value of ['', true, 17, {}, [], 'not-a-uuid', PROJECT.toUpperCase(), `${PROJECT}/x`, `${PROJECT}\n`, PROJECT.replaceAll('-', '')]) {
        await denied(service, { ...base, [key]: value }, '22023', `${key} requires lowercase canonical UUID`)
      }
      if (key !== 'storyId') await denied(service, { ...base, [key]: null }, '22023', `${key} cannot be null`)
    }
    for (const value of [null, '1', 0, 2, true, {}, []]) await denied(service, { ...base, schemaVersion: value }, '22023', 'schema version is numeric one')
    for (const [search, replace] of [['"schemaVersion":1', '"schemaVersion":1.0'], ['"index":0', '"index":0.0'], ['"byteSize":4', '"byteSize":4.0']]) {
      h.eq((await outcome(service, rpc, [JSON.stringify(base).replace(search, replace)])).code, '22023', 'fractional JSON numeric encoding is not canonical integer input')
    }
    for (const value of [null, true, 1, {}, [], '', 'audio/wav', 'Audio/webm', 'audio/webm; codecs=opus', 'audio/webm\n']) {
      await denied(service, { ...base, mimeType: value }, '22023', 'MIME matches the exact existing route allowlist')
    }
    for (const mimeType of ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/webm;codecs=opus', 'audio/ogg;codecs=vorbis', 'audio/mp4;codecs=mp4a.40.2']) {
      const input = manifest({ mimeType })
      await checkReceipt(await seal(service, input), input)
    }
  })

  await h.scenario('Malformed chunks, duplicate identity, noncontiguous order and all unsafe namespace substitutions reject', async () => {
    const base = manifest()
    for (const chunks of [null, true, 1, 'chunks', {}, [], [null], [true], [1], ['chunk'], [[]], [{}]]) {
      await denied(service, { ...base, chunks }, '22023', 'chunks is a bounded nonempty array of exact objects')
    }
    const original = base.chunks[0]
    const badChunk = async (chunk, label) => denied(service, { ...base, chunks: [chunk, base.chunks[1]] }, '22023', label)
    for (const key of Object.keys(original)) {
      const missing = { ...original }; delete missing[key]
      await badChunk(missing, `required chunk key ${key}`)
      await badChunk({ ...original, [key]: null }, `nonnull chunk key ${key}`)
    }
    await badChunk({ ...original, extra: true }, 'unknown chunk keys rejected')
    for (const index of [-1, 1, 0.5, '0', true, [], {}, Number.MAX_SAFE_INTEGER]) await badChunk({ ...original, index }, 'index matches contiguous array order')
    await denied(service, { ...base, chunks: [...base.chunks].reverse() }, '22023', 'array order cannot change logical order')
    for (const chunkId of ['', 'a'.repeat(129), '../x', 'x/y', 'x.y', 'x y', 'x\n', true, 1, [], {}]) {
      await badChunk({ ...original, chunkId }, 'chunk identity is safe and bounded')
    }
    await denied(service, { ...base, chunks: [original, { ...base.chunks[1], chunkId: original.chunkId }] }, '22023', 'chunk ids are unique')
    for (const bucket of ['saga', 'AUDIO-recordings', true, [], {}]) await badChunk({ ...original, bucket }, 'bucket cannot be substituted')
    for (const key of ['objectKey', 'storageObjectKey']) {
      for (const value of [true, 1, {}, [], '', '../x', `${original[key]}/..`, `${original[key]}\n`, `${original[key]}.webm`, original[key].replace(PROJECT, OTHER_PROJECT), original[key].replace(base.sessionId, randomUUID())]) {
        await badChunk({ ...original, [key]: value }, 'paths cannot escape canonical owner/project/session/index')
      }
    }
    await badChunk({ ...original, storageObjectKey: original.storageObjectKey.replace(USER, OTHER_USER) }, 'physical owner cannot be substituted')
    for (const byteSize of [0, -1, 0.5, '4', true, [], {}, 104857601, Number.MAX_SAFE_INTEGER]) {
      await badChunk({ ...original, byteSize }, 'byte size is a bounded positive integer')
    }
    for (const sha256 of ['', 'f'.repeat(63), 'f'.repeat(65), HASH.toUpperCase(), `${HASH}\n`, true, 1, [], {}]) {
      await badChunk({ ...original, sha256 }, 'SHA256 is exactly 64 lowercase hex characters')
    }
  })

  await h.scenario('Byte and chunk quotas accept exact boundary and reject one beyond without writes', async () => {
    const full = manifest({}, 2000)
    full.chunks.forEach((chunk) => { chunk.byteSize = 1 })
    await checkReceipt(await seal(service, full), full)
    await denied(service, manifest({}, 2001), '22023', '2001 chunks exceed maximum')
    const exact = manifest({}, 1); exact.chunks[0].byteSize = 104857600
    await checkReceipt(await seal(service, exact), exact)
    const overflow = manifest(); overflow.chunks[0].byteSize = 104857600; overflow.chunks[1].byteSize = 1
    await denied(service, overflow, '22023', 'aggregate size cannot exceed 100 MiB')
    const safeId = manifest({}, 1); safeId.chunks[0].chunkId = 'A-_0'.repeat(32)
    await checkReceipt(await seal(service, safeId), safeId)
  })

  await h.scenario('Only service role can call RPC; PUBLIC and forged JWT roles cannot confer capabilities', async () => {
    const functionRow = (await h.db.query(`SELECT prosecdef, proconfig, pg_get_function_identity_arguments(oid) AS args,
      (SELECT count(*)::int FROM aclexplode(proacl) WHERE grantee = 0) AS public_grants
      FROM pg_proc WHERE oid = 'public.seal_recording_manifest(jsonb)'::regprocedure`)).rows[0]
    h.eq(functionRow, { prosecdef: true, proconfig: ['search_path=pg_catalog, pg_temp'], args: 'p_manifest jsonb', public_grants: 0 },
      'security definer is pinned to trusted catalog with no PUBLIC ACL or overload')
    for (const role of ['anon', 'authenticated', 'metadata_reader']) {
      const client = await h.actorClient(role, USER, 'service_role')
      try {
        await client.query("SELECT set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role: 'service_role', sub: USER })])
        await denied(client, manifest(), '42501', `${role} real login cannot forge service RPC capability`)
      } finally { await h.close(client) }
    }
    for (const role of ['anon', 'authenticated', 'service_role', 'metadata_reader']) {
      const client = await h.actorClient(role, USER)
      try {
        for (const table of ['recording_sessions', 'recording_chunks']) {
          for (const sql of [`INSERT INTO public.${table} DEFAULT VALUES`, `UPDATE public.${table} SET id = id`,
            `DELETE FROM public.${table}`, `TRUNCATE public.${table}`]) {
            h.eq((await outcome(client, sql)).code, '42501', `${role} has no direct ${table} DML/TRUNCATE`)
          }
        }
      } finally { await h.close(client) }
    }
    for (const table of ['recording_sessions', 'recording_chunks']) {
      h.ok((await service.query(`SELECT * FROM public.${table}`)).rows.length > 0, 'non-bypass service SELECT works through explicit read policy')
    }
    h.eq((await h.db.query("SELECT pg_get_expr(polqual, polrelid) AS expr FROM pg_policy WHERE polname = 'recording_sessions_select_owner_or_member'")).rows,
      policyBefore, 'authenticated read policy is preserved verbatim')
    const owner = await h.actorClient('authenticated', USER)
    const other = await h.actorClient('authenticated', OTHER_USER)
    try {
      h.ok((await owner.query('SELECT * FROM public.recording_sessions')).rows.length > 0, 'active owner retains existing read access')
      h.eq((await other.query('SELECT * FROM public.recording_sessions')).rows, [], 'other user cannot read these sessions')
      h.eq((await outcome(owner, 'SELECT * FROM public.recording_chunks')).code, '42501', 'authenticated chunk reads not widened')
    } finally { await h.close(owner); await h.close(other) }
  })

  await h.scenario('Current project, active storyteller and optional story ownership are mandatory on create and replay', async () => {
    await denied(service, manifest({ projectId: randomUUID() }), '42501', 'missing project denied')
    await denied(service, manifest({ projectId: OTHER_PROJECT }), '42501', 'cross-project storyteller denied')
    await denied(service, manifest({ userId: OTHER_USER }), '42501', 'facilitator is not an active storyteller')
    await denied(service, manifest({ userId: randomUUID() }), '42501', 'missing owner denied')
    await denied(service, manifest({ storyId: randomUUID() }), '42501', 'missing story denied')
    const bound = manifest(); await seal(service, bound)
    await h.db.query(`INSERT INTO public.project_roles(project_id, user_id, role, status)
      VALUES ($1, $2, 'storyteller', 'active'), ($3, $4, 'storyteller', 'active')`, [OTHER_PROJECT, USER, PROJECT, OTHER_USER])
    try {
      const movedProject = manifest({ projectId: OTHER_PROJECT, sessionId: bound.sessionId, assetId: bound.assetId })
      const movedOwner = manifest({ userId: OTHER_USER, sessionId: bound.sessionId, assetId: bound.assetId })
      await denied(service, movedProject, '23505', 'valid storyteller in another project cannot rebind existing session')
      await denied(service, movedOwner, '23505', 'another active storyteller cannot claim existing session')
    } finally {
      await h.db.query('DELETE FROM public.project_roles WHERE (project_id = $1 AND user_id = $2) OR (project_id = $3 AND user_id = $4)',
        [OTHER_PROJECT, USER, PROJECT, OTHER_USER])
    }
    const own = manifest({ storyId: STORY }); await seal(service, own)
    for (const sql of [
      "UPDATE public.project_roles SET status = 'removed' WHERE project_id = $1 AND user_id = $2",
      "UPDATE public.project_roles SET status = 'pending' WHERE project_id = $1 AND user_id = $2",
      "UPDATE public.project_roles SET role = 'facilitator' WHERE project_id = $1 AND user_id = $2",
    ]) {
      await h.db.query(sql, [PROJECT, USER])
      try {
        await denied(service, manifest(), '42501', 'removed/pending/non-storyteller cannot create')
        await denied(service, own, '42501', 'revoked storyteller cannot replay')
      } finally { await h.db.query("UPDATE public.project_roles SET status = 'active', role = 'storyteller' WHERE project_id = $1 AND user_id = $2", [PROJECT, USER]) }
    }
    for (const [column, value] of [['project_id', OTHER_PROJECT], ['storyteller_id', OTHER_USER]]) {
      await h.db.query(`UPDATE public.stories SET ${column} = $1 WHERE id = $2`, [value, STORY])
      try {
        await denied(service, own, '42501', 'story scope change invalidates replay')
        await denied(service, manifest({ storyId: STORY }), '42501', 'story scope change invalidates creation')
      } finally { await h.db.query('UPDATE public.stories SET project_id = $1, storyteller_id = $2 WHERE id = $3', [PROJECT, USER, STORY]) }
    }
  })

  await h.scenario('Session, story and asset tombstones deny both new sealing and exact replay', async () => {
    for (const target of ['sessionId', 'storyId', 'assetId']) {
      const input = manifest({ storyId: STORY })
      const replay = manifest({ storyId: STORY }); await seal(service, replay)
      const subjectIds = [input[target], replay[target]]
      await h.db.query(`INSERT INTO public.deletion_requests(project_id, subject_id, requested_by)
        SELECT $1, unnest($2::text[]), $3`, [PROJECT, subjectIds, USER])
      try {
        await denied(service, input, '23505', `${target} tombstone prevents creation`)
        await denied(service, replay, '23505', `${target} tombstone prevents replay`)
      } finally { await h.db.query('DELETE FROM public.deletion_requests WHERE subject_id = ANY($1::text[])', [subjectIds]) }
    }
    const unrelated = manifest()
    await h.db.query('INSERT INTO public.deletion_requests(project_id, subject_id, requested_by) VALUES ($1, $2, $3)', [OTHER_PROJECT, unrelated.sessionId, OTHER_USER])
    await checkReceipt(await seal(service, unrelated), unrelated)
  })

  await h.scenario('Legacy seal_input-null rows are preserved and refused in every prior state', async () => {
    const after = (await h.db.query('SELECT to_jsonb(s) - \'seal_input\' AS row FROM public.recording_sessions s WHERE id = $1', [legacyId])).rows[0].row
    h.eq(after, legacyBefore, 'migration does not relabel or mutate legacy sessions')
    h.eq((await h.db.query('SELECT to_jsonb(c) - \'seal_chunk_id\' AS row FROM public.recording_chunks c WHERE session_id = $1', [legacyId])).rows[0].row,
      legacyChunkBefore, 'migration does not relabel or mutate legacy chunk paths or identities')
    for (const state of ['recording', 'sealing', 'merging', 'cloud_confirmed', 'failed', 'aborted']) {
      await h.db.query('UPDATE public.recording_sessions SET state = $1 WHERE id = $2', [state, legacyId])
      await denied(service, manifest({ sessionId: legacyId }), '23505', 'legacy input cannot be adopted')
    }
  })

  await h.scenario('Corrupt sealed session fields and chunk rows never earn a replay receipt or repair writes', async () => {
    const input = manifest({ storyId: STORY }); await seal(service, input)
    const mutations = [
      "state = 'merging'", 'seal_input = NULL', "seal_input = jsonb_set(seal_input, '{assetId}', to_jsonb(gen_random_uuid()::text))",
      "manifest_sha256 = repeat('a', 64)", `project_id = '${OTHER_PROJECT}'`, `user_id = '${OTHER_USER}'`,
      'story_id = NULL', "mime_type = 'audio/ogg'", 'total_chunks = total_chunks + 1',
      'total_input_bytes = total_input_bytes + 1', 'sealed_at = NULL', "sealed_at = 'infinity'::timestamptz",
      'confirmed_at = now()', "sealed_at = now() + interval '1 day'",
    ]
    for (const mutation of mutations) {
      await h.db.query(`UPDATE public.recording_sessions SET ${mutation} WHERE id = $1`, [input.sessionId])
      await denied(service, input, '23505', 'incoherent session must reject exact replay')
      await h.db.query(`UPDATE public.recording_sessions SET state = 'sealing', seal_input = $2::jsonb,
        manifest_sha256 = encode(sha256(convert_to($2::jsonb::text, 'UTF8')), 'hex'), project_id = $3,
        user_id = $4, story_id = $5, mime_type = $6, total_chunks = 2, total_input_bytes = 9,
        sealed_at = now(), confirmed_at = NULL WHERE id = $1`,
      [input.sessionId, JSON.stringify(input), PROJECT, USER, STORY, input.mimeType])
    }
    for (const mutation of ["seal_chunk_id = 'different'", 'seal_chunk_id = NULL', "sha256 = repeat('b', 64)",
      'byte_size = byte_size + 1', `project_id = '${OTHER_PROJECT}'`, "object_key = object_key || '/wrong'", 'chunk_index = 5']) {
      await h.db.query(`UPDATE public.recording_chunks SET ${mutation} WHERE session_id = $1 AND chunk_index = 0`, [input.sessionId])
      await denied(service, input, '23505', 'incoherent chunk must reject exact replay')
      await h.db.query(`UPDATE public.recording_chunks SET seal_chunk_id = 'chunk-0', sha256 = $2, byte_size = 4,
        project_id = $3, object_key = $4, chunk_index = 0 WHERE session_id = $1 AND chunk_index != 1`,
      [input.sessionId, HASH, PROJECT, input.chunks[0].storageObjectKey])
    }
    await h.db.query('DELETE FROM public.recording_chunks WHERE session_id = $1 AND chunk_index = 1', [input.sessionId])
    await denied(service, input, '23505', 'missing chunk must reject exact replay')
  })

  await h.scenario('Identical concurrent seals converge and competing changed input has one durable winner', async () => {
    const equal = manifest()
    const [first, second] = await race(service, equal, equal)
    h.eq(second.code, '00000', 'identical concurrent seal succeeds after lock')
    h.eq(second.result.rows[0].receipt, first, 'concurrent identical input has one exact receipt')
    await checkReceipt(first, equal)
    const input = manifest()
    const competing = { ...input, assetId: randomUUID() }
    const [winner, loser] = await race(service, input, competing)
    h.eq(loser.code, '23505', 'competing manifest is refused after first commit')
    await checkReceipt(winner, input)
  })

  await h.scenario('Late chunk insertion error rolls back the session and all preceding chunks', async () => {
    const input = manifest()
    await h.db.query(`CREATE FUNCTION public.synthetic_fail_second_chunk() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.chunk_index = 1 THEN RAISE EXCEPTION 'synthetic insert failure' USING ERRCODE = '23514'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER synthetic_failure BEFORE INSERT ON public.recording_chunks FOR EACH ROW EXECUTE FUNCTION public.synthetic_fail_second_chunk();`)
    try { await denied(service, input, '23514', 'late insertion failure atomically rolls back earlier ledger writes') }
    finally { await h.db.query('DROP TRIGGER synthetic_failure ON public.recording_chunks; DROP FUNCTION public.synthetic_fail_second_chunk()') }
    await checkReceipt(await seal(service, input), input)
  })

  await h.scenario('Existing permission rows are locked during sealing; revocation after commit defeats replay', async () => {
    const editor = await h.client()
    const input = manifest()
    let pending
    await service.query('BEGIN')
    try {
      await seal(service, input)
      pending = outcome(editor, "UPDATE public.project_roles SET status = 'removed' WHERE project_id = $1 AND user_id = $2", [PROJECT, USER])
      await waitForLock(editor)
      await service.query('COMMIT')
      h.eq((await pending).code, '00000', 'existing-row revocation proceeds only after sealing transaction ends')
      await denied(service, input, '42501', 'post-commit revocation prevents receipt replay')
    } finally {
      await service.query('ROLLBACK')
      if (pending) await pending
      await h.close(editor)
      await h.db.query("UPDATE public.project_roles SET status = 'active' WHERE project_id = $1 AND user_id = $2", [PROJECT, USER])
    }
  })

  await h.scenario('Hostile temp shadows cannot redirect security-definer reads or writes', async () => {
    await service.query(`CREATE TEMP TABLE recording_sessions (id uuid); CREATE TEMP TABLE recording_chunks (id uuid);
      CREATE TEMP TABLE project_roles (id uuid); CREATE TEMP TABLE projects (id uuid); CREATE TEMP TABLE stories (id uuid);
      CREATE TEMP TABLE deletion_requests (id uuid); SET search_path = pg_temp;`)
    const input = manifest({ storyId: STORY })
    await checkReceipt(await seal(service, input), input)
    h.eq((await service.query('SELECT * FROM pg_temp.recording_sessions')).rows, [], 'temp session shadow remains untouched')
    await service.query('RESET search_path')
  })

  await h.scenario('Migration replay preserves data, receipts, read policies and restricted grants', async () => {
    const input = manifest(); const receipt = await seal(service, input)
    const before = await ledgerState()
    const grants = (await h.db.query(`SELECT relname, relacl::text FROM pg_class WHERE oid IN
      ('public.recording_sessions'::regclass, 'public.recording_chunks'::regclass) ORDER BY relname`)).rows
    await h.db.query(migration)
    h.eq(await ledgerState(), before, 'migration replay leaves all legacy/new/corrupt fixtures unchanged')
    h.eq(await seal(service, input), receipt, 'exact immutable receipt survives migration replay')
    h.eq((await h.db.query(`SELECT relname, relacl::text FROM pg_class WHERE oid IN
      ('public.recording_sessions'::regclass, 'public.recording_chunks'::regclass) ORDER BY relname`)).rows,
    grants, 'migration replay maintains ACLs')
    h.eq((await outcome(service, 'DELETE FROM public.recording_sessions')).code, '42501', 'replay never widens service writes')
  })
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'
  report.failure = { code: /^[A-Z0-9_]+$/.test(error.code ?? '') ? error.code : 'UNEXPECTED_FAILURE', label: error.label ?? 'runner or SQL failure; raw error omitted' }
  report.failureKind = report.rpcProbeSqlstate === '42883' && report.scenarios.length === 1 ? 'expected_product_red_missing_rpc' : 'runner_or_implementation_failure_not_product_red'
} finally {
  await h.cleanup()
  if (report.cleanup) {
    report.cleanup.socketRemoved = !h.scratch || !await exists(join(h.scratch, 'socket/.s.PGSQL.5432'))
    report.cleanup.parentDirectoryRemoved = !h.scratch || !await exists(h.scratch)
    try { if (Number.isInteger(report.runtime.serverPid)) process.kill(report.runtime.serverPid, 0); report.cleanup.serverPidGone = !Number.isInteger(report.runtime.serverPid) }
    catch (error) { report.cleanup.serverPidGone = error.code === 'ESRCH' }
    if (!report.cleanup.socketRemoved || !report.cleanup.parentDirectoryRemoved || !report.cleanup.serverPidGone) report.status = 'failed'
  }
  report.completedAt = new Date().toISOString()
  await mkdir(evidenceDir, { recursive: true })
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify({ status: report.status, scenarios: report.scenarios.length, assertions: report.assertions,
    failureKind: report.failureKind, failure: report.failure, cleanup: report.cleanup, output }))
  process.exitCode = report.status === 'passed' ? 0 : 1
}

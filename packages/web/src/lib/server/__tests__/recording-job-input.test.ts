/** @jest-environment node */

import { createHash } from 'node:crypto'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { prepareRecordingSessionSeal } from '@/lib/server/recording-session-service'
import { loadRecordingJobInput } from '@/lib/server/recording-job-input'
import { verifyRecordingJobInput } from '@/lib/server/recording-job-verifier'
import type { RecordingJobLease } from '@/lib/server/recording-job-lease'

type Row = Record<string, unknown>
const PROJECT = '11111111-1111-4111-8111-111111111111'
const SESSION = '22222222-2222-4222-8222-222222222222'
const USER = '33333333-3333-4333-8333-333333333333'
const STORY = '44444444-4444-4444-8444-444444444444'
const JOB = '55555555-5555-4555-8555-555555555555'
const OTHER = '66666666-6666-4666-8666-666666666666'
const DATE = '2026-11-02T00:00:00.000Z'
const ERROR = 'Recording job input is unavailable'

// Golden canonical text/hash obtained from PostgreSQL 14.17 jsonb::text, not JSON.stringify.
const PG_HASH = 'c4b187f47ca380860f2bf43bd67a737e69e2df25070133f4130ca5dadf086a36'
function pgText(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(pgText).join(', ')}]`
  if (value && typeof value === 'object') {
    const object = value as Row
    return `{${Object.keys(object).sort((a, b) => a.length - b.length || (a < b ? -1 : 1))
      .map(key => `${JSON.stringify(key)}: ${pgText(object[key])}`).join(', ')}}`
  }
  return JSON.stringify(value)
}

function fixture(count = 1, storyId: string | null = STORY) {
  const chunks = Array.from({ length: count }, (_, index) => ({
    index, chunkId: `chunk-${index}`, bucket: 'audio-recordings' as const,
    objectKey: `projects/${PROJECT}/sessions/${SESSION}/${index}`, byteSize: 3, sha256: 'a'.repeat(64),
  }))
  const sealed = prepareRecordingSessionSeal({ projectId: PROJECT, sessionId: SESSION, actorId: USER,
    actorRole: 'storyteller', actorActive: true, storyId, jobId: JOB, mimeType: 'audio/webm', chunks })
  const manifest = { schemaVersion: 1, projectId: PROJECT, sessionId: SESSION, userId: USER, storyId,
    assetId: sealed.task.assetId, mimeType: 'audio/webm',
    chunks: chunks.map(chunk => ({ ...chunk, storageObjectKey: `${USER}/${chunk.objectKey}` })) }
  const rows: Record<string, Row[]> = {
    processing_jobs: [{ id: JOB, project_id: PROJECT, asset_id: sealed.task.assetId, created_by: USER,
      input_version: 1, job_type: 'recording_merge', processor_version: 'ffmpeg-merge-v1',
      parameter_version: 'default', model_config_version: 'none', idempotency_key: sealed.task.idempotencyKey,
      state: 'queued', attempt_count: 0, max_attempts: 3, not_before: null, lease_owner: null,
      lease_expires_at: null, cancel_requested_at: null, result_ref: null, error_code: null }],
    media_assets: [{ ...sealed.assetRecord, parent_asset_id: null, original_filename: 'unnamed-asset',
      sha256: null, duration_ms: null, verified_at: null, content_verified_at: null, verification_error: null }],
    recording_sessions: [{ id: SESSION, project_id: PROJECT, user_id: USER, story_id: storyId,
      mime_type: 'audio/webm', state: 'sealing', total_chunks: count, total_input_bytes: count * 3,
      manifest_sha256: count === 1 && storyId === STORY ? PG_HASH : createHash('sha256').update(pgText(manifest)).digest('hex'),
      started_at: DATE, sealed_at: DATE, confirmed_asset_id: null, merge_job_id: null, confirmed_at: null,
      seal_input: manifest }],
    recording_chunks: chunks.map(chunk => ({
      id: `77777777-7777-4777-8777-${String(chunk.index).padStart(12, '0')}`,
      session_id: SESSION, project_id: PROJECT, chunk_index: chunk.index, seal_chunk_id: chunk.chunkId,
      bucket: chunk.bucket, object_key: `${USER}/${chunk.objectKey}`, byte_size: chunk.byteSize,
      sha256: chunk.sha256, persisted_at: DATE,
    })),
    projects: [{ id: PROJECT }],
    project_roles: [{ project_id: PROJECT, user_id: USER, role: 'storyteller', status: 'active' }],
    stories: [{ id: STORY, project_id: PROJECT, storyteller_id: USER }],
    deletion_requests: [],
  }
  const requests: Array<{ table: string; url: URL; signal?: AbortSignal | null; headers: Headers }> = []
  let hook: ((table: string) => void | Promise<void>) | undefined
  let failure: string | undefined
  let corruptCount: string | undefined
  let truncate: string | undefined
  let rpcOverride: Row = {}
  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const table = url.pathname.split('/').at(-1)!
    requests.push({ table, url, signal: init?.signal, headers: new Headers(init?.headers) })
    await hook?.(table)
    if (failure === table) return new Response(JSON.stringify({ message: 'SECRET storage/path key', code: 'XX000' }), { status: 500 })
    if (table === 'recording_job_lease') {
      const job = rows.processing_jobs[0]
      return new Response(JSON.stringify({ schemaVersion: 1, jobId: JOB, projectId: PROJECT, assetId: sealed.task.assetId,
        sessionId: SESSION, manifestSha256: rows.recording_sessions[0].manifest_sha256,
        state: job.state, attempt: job.attempt_count, workerId: job.lease_owner, leaseExpiresAt: job.lease_expires_at,
        serverNow: new Date().toISOString(), canClearLocalDrafts: false, ...rpcOverride }),
      { headers: { 'content-type': 'application/json' } })
    }
    let matches = (rows[table] ?? []).filter(row => [...url.searchParams].every(([key, filter]) => {
      if (['select', 'order', 'limit', 'offset'].includes(key)) return true
      if (filter.startsWith('eq.')) return String(row[key]) === filter.slice(3)
      if (filter.startsWith('cs.')) return Object.entries(JSON.parse(filter.slice(3))).every(([k, v]) => (row[key] as Row)?.[k] === v)
      if (filter.startsWith('in.(')) return filter.slice(4, -1).split(',').includes(String(row[key]))
      if (filter === 'not.is.null') return row[key] !== null && row[key] !== undefined
      throw new Error(`Unsupported fixture filter: ${filter}`)
    }))
    if (url.searchParams.get('order')) matches.sort((a, b) => Number(a.chunk_index) - Number(b.chunk_index))
    const countBeforeLimit = matches.length
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const limit = Math.min(1000, Number(url.searchParams.get('limit') ?? 1000))
    matches = matches.slice(offset, offset + limit)
    if (truncate === table) matches = matches.slice(0, 1)
    const count = corruptCount === table ? '*' : String(countBeforeLimit)
    return new Response(JSON.stringify(matches), {
      status: 200, headers: { 'content-type': 'application/json', 'content-range': `${offset}-${offset + matches.length - 1}/${count}` },
    })
  })
  const admin = createClient('https://ledger.invalid', 'test-service-key', {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchMock },
  })
  return { rows, sealed, manifest, requests, admin, fetchMock,
    runningLease: (): RecordingJobLease => {
      const leaseExpiresAt = new Date(Date.now() + 60000).toISOString()
      Object.assign(rows.processing_jobs[0], { state: 'running', attempt_count: 1, lease_owner: 'worker-1', lease_expires_at: leaseExpiresAt })
      return { schemaVersion: 1, jobId: JOB, projectId: PROJECT, assetId: sealed.task.assetId, sessionId: SESSION,
        manifestSha256: String(rows.recording_sessions[0].manifest_sha256), state: 'running', attempt: 1,
        workerId: 'worker-1', leaseExpiresAt, serverNow: new Date().toISOString(), canClearLocalDrafts: false,
        deadline: performance.now() + 60000 }
    },
    rpcOverride: (next: Row) => { rpcOverride = next },
    setHook: (next: typeof hook) => { hook = next }, fail: (table: string) => { failure = table },
    loseCount: (table: string) => { corruptCount = table }, truncate: (table: string) => { truncate = table } }
}

describe('trusted queued recording job input ledger', () => {
  it('loads a running attempt only with its database-checked fence', async () => {
    const f = fixture(); const lease = f.runningLease()
    await expect(loadRecordingJobInput(JOB, { admin: f.admin })).rejects.toThrow(ERROR)
    f.requests.length = 0
    const trusted = await loadRecordingJobInput(JOB, { admin: f.admin, lease })
    expect(trusted.task).toEqual(f.sealed.task)
    expect(f.requests[0].table).toBe('recording_job_lease')
    expect(f.requests.at(-1)?.table).toBe('recording_job_lease')
  })

  it('accepts a normal heartbeat without loosening other pinned input state', async () => {
    const f = fixture(); const lease = f.runningLease()
    const trusted = await loadRecordingJobInput(JOB, { admin: f.admin, lease })
    Object.assign(f.rows.processing_jobs[0], { lease_expires_at: new Date(Date.now() + 65000).toISOString(), updated_at: new Date().toISOString() })
    await expect(trusted.revalidate()).resolves.toBeUndefined()
    f.rows.processing_jobs[0].processor_version = 'changed'
    await expect(trusted.revalidate()).rejects.toThrow(ERROR)
  })

  it.each([{ workerId: 'other' }, { attempt: 2 }, { manifestSha256: 'b'.repeat(64) },
    { state: 'leased' }, { leaseExpiresAt: '2020-01-01T00:00:00Z' }])('rejects invalid live fence %j before reading ledger tables', async override => {
    const f = fixture(); const lease = f.runningLease(); f.rpcOverride(override)
    await expect(loadRecordingJobInput(JOB, { admin: f.admin, lease })).rejects.toThrow(ERROR)
    expect(f.requests.every(request => request.table === 'recording_job_lease')).toBe(true)
  })

  it('rechecks the fence after the last ledger await and rejects a lost attempt', async () => {
    const f = fixture(); const lease = f.runningLease()
    f.setHook(table => { if (table === 'deletion_requests') f.rpcOverride({ attempt: 2 }) })
    await expect(loadRecordingJobInput(JOB, { admin: f.admin, lease })).rejects.toThrow(ERROR)
    expect(f.requests.at(-1)?.table).toBe('recording_job_lease')
  })

  it('loads by job ID, validates the PostgreSQL golden manifest, and exposes only derived locations', async () => {
    const f = fixture()
    expect(createHash('sha256').update(JSON.stringify(f.manifest)).digest('hex')).not.toBe(PG_HASH)
    const result = await loadRecordingJobInput(JOB, { admin: f.admin })
    expect(result.task).toEqual(f.sealed.task)
    expect(result.storageObjectKeys).toEqual([`${USER}/projects/${PROJECT}/sessions/${SESSION}/0`])
    expect(f.requests.find(request => request.table === 'recording_sessions')?.url.searchParams.get('seal_input'))
      .toBe(`cs.${JSON.stringify({ assetId: f.sealed.task.assetId })}`)
    expect(f.requests.every(request => request.signal instanceof AbortSignal)).toBe(true)
    expect(f.requests.at(-1)?.table).toBe('deletion_requests')
    await expect(result.revalidate()).resolves.toBeUndefined()
    expect(f.requests.at(-1)?.table).toBe('deletion_requests')
  })

  it('accepts an optional null story without requiring a stories row', async () => {
    const f = fixture(1, null)
    f.rows.stories = []
    await expect(loadRecordingJobInput(JOB, { admin: f.admin })).resolves.toHaveProperty('task')
    expect(f.requests.some(request => request.table === 'stories')).toBe(false)
  })

  it.each([1001, 2000])('paginates all %i chunk rows with exact counts despite the default 1000-row cap', async count => {
    const f = fixture(count)
    const result = await loadRecordingJobInput(JOB, { admin: f.admin })
    expect(result.task.chunks).toHaveLength(count)
    expect(result.storageObjectKeys.at(-1)).toBe(`${USER}/projects/${PROJECT}/sessions/${SESSION}/${count - 1}`)
    const pages = f.requests.filter(request => request.table === 'recording_chunks')
    expect(pages.length).toBeGreaterThan(1)
    expect(pages.every(request => request.headers.get('prefer')?.includes('count=exact'))).toBe(true)
  })

  it.each(['../job', '', ' JOB ', 1, undefined])('rejects malformed job IDs before querying: %s', async id => {
    const f = fixture()
    await expect(loadRecordingJobInput(id as string, { admin: f.admin })).rejects.toThrow(ERROR)
    expect(f.fetchMock).not.toHaveBeenCalled()
  })

  it.each(['processing_jobs', 'media_assets', 'recording_sessions', 'recording_chunks', 'projects', 'project_roles', 'stories'])
  ('rejects missing %s rows', async table => {
    const f = fixture(); f.rows[table] = []
    await expect(loadRecordingJobInput(JOB, { admin: f.admin })).rejects.toThrow(ERROR)
  })

  it.each(['processing_jobs', 'media_assets', 'recording_sessions', 'project_roles'])('rejects ambiguous %s rows', async table => {
    const f = fixture(); f.rows[table].push({ ...f.rows[table][0] })
    await expect(loadRecordingJobInput(JOB, { admin: f.admin })).rejects.toThrow(ERROR)
  })

  const badFields: Array<[string, string, unknown]> = [
    ['processing_jobs', 'project_id', OTHER], ['processing_jobs', 'created_by', OTHER],
    ['processing_jobs', 'asset_id', OTHER], ['processing_jobs', 'input_version', 2],
    ['processing_jobs', 'processor_version', 'future'], ['processing_jobs', 'parameter_version', 'other'],
    ['processing_jobs', 'model_config_version', 'model'], ['processing_jobs', 'job_type', 'transcribe'],
    ['processing_jobs', 'state', 'running'], ['processing_jobs', 'attempt_count', 1],
    ['processing_jobs', 'max_attempts', 4], ['processing_jobs', 'idempotency_key', 'forged'],
    ...['not_before', 'lease_owner', 'lease_expires_at', 'cancel_requested_at', 'result_ref', 'error_code']
      .map(field => ['processing_jobs', field, 'set'] as [string, string, unknown]),
    ['media_assets', 'state', 'ready'], ['media_assets', 'story_id', null], ['media_assets', 'created_by', OTHER],
    ['media_assets', 'object_key', 'another-owner/original'], ['media_assets', 'byte_size', 4],
    ['media_assets', 'version', 2], ['media_assets', 'mime_type', 'audio/ogg'],
    ['media_assets', 'idempotency_key', 'wrong'], ['media_assets', 'original_filename', 'other'],
    ...['sha256', 'duration_ms', 'verified_at', 'content_verified_at', 'verification_error', 'parent_asset_id']
      .map(field => ['media_assets', field, 'set'] as [string, string, unknown]),
    ['recording_sessions', 'state', 'merging'], ['recording_sessions', 'project_id', OTHER],
    ['recording_sessions', 'user_id', OTHER], ['recording_sessions', 'story_id', null],
    ['recording_sessions', 'total_chunks', 2], ['recording_sessions', 'total_input_bytes', 4],
    ['recording_sessions', 'manifest_sha256', 'b'.repeat(64)], ['recording_sessions', 'seal_input', null],
    ['recording_sessions', 'sealed_at', null], ['recording_sessions', 'started_at', 'infinity'],
    ['recording_sessions', 'sealed_at', '2020-01-01T00:00:00Z'], ['recording_sessions', 'sealed_at', '2999-01-01T00:00:00Z'],
    ...['confirmed_asset_id', 'merge_job_id', 'confirmed_at'].map(field => ['recording_sessions', field, 'set'] as [string, string, unknown]),
    ['recording_chunks', 'seal_chunk_id', 'other'], ['recording_chunks', 'object_key', 'other/physical/path'],
    ['recording_chunks', 'project_id', OTHER], ['recording_chunks', 'chunk_index', 1],
    ['recording_chunks', 'sha256', 'b'.repeat(64)], ['recording_chunks', 'byte_size', 4],
    ['recording_chunks', 'bucket', 'saga'], ['recording_chunks', 'id', null],
    ['project_roles', 'status', 'removed'], ['project_roles', 'role', 'owner'],
    ['stories', 'project_id', OTHER], ['stories', 'storyteller_id', OTHER],
    ['media_assets', 'tombstone_at', DATE], ['recording_sessions', 'deletion_requested_at', DATE],
    ['processing_jobs', 'deletion_requested_at', DATE], ['projects', 'tombstone_at', DATE],
  ]
  it.each(badFields)('fails closed for %s.%s=%s', async (table, key, value) => {
    const f = fixture(); f.rows[table][0][key] = value
    await expect(loadRecordingJobInput(JOB, { admin: f.admin })).rejects.toThrow(ERROR)
  })

  it.each(['processing_jobs', 'media_assets', 'recording_sessions'])('rejects missing mandatory null markers in %s', async table => {
    const f = fixture()
    delete f.rows[table][0][{ processing_jobs: 'cancel_requested_at', media_assets: 'content_verified_at', recording_sessions: 'confirmed_at' }[table]!]
    await expect(loadRecordingJobInput(JOB, { admin: f.admin })).rejects.toThrow(ERROR)
  })

  it.each(['schema', 'extra', 'uuid', 'mime', 'path', 'storage-path', 'hash', 'duplicate', 'order', 'negative', 'unsafe', 'quota', 'count'])
  ('rejects a malformed sealed manifest (%s) even with a recomputed manifest hash', async mode => {
    const f = fixture(2)
    const m = f.manifest as unknown as Row
    const c = f.manifest.chunks[0]
    if (mode === 'schema') m.schemaVersion = 2
    if (mode === 'extra') m.unexpected = true
    if (mode === 'uuid') m.userId = '../actor'
    if (mode === 'mime') m.mimeType = 'audio/webm;codecs=unexpected'
    if (mode === 'path') c.objectKey += '/..'
    if (mode === 'storage-path') c.storageObjectKey = c.objectKey
    if (mode === 'hash') c.sha256 = 'A'.repeat(64)
    if (mode === 'duplicate') f.manifest.chunks[1].chunkId = c.chunkId
    if (mode === 'order') f.manifest.chunks.reverse()
    if (mode === 'negative') c.byteSize = -1
    if (mode === 'unsafe') c.byteSize = Number.MAX_SAFE_INTEGER + 1
    if (mode === 'quota') c.byteSize = 100 * 1024 * 1024
    if (mode === 'count') f.manifest.chunks = Array.from({ length: 2001 }, () => c)
    f.rows.recording_sessions[0].manifest_sha256 = createHash('sha256').update(pgText(m)).digest('hex')
    await expect(loadRecordingJobInput(JOB, { admin: f.admin })).rejects.toThrow(ERROR)
  })

  it.each(['extra', 'duplicate', 'missing', 'no-count', 'truncated'])('does not trust a partial or corrupt chunk ledger (%s)', async mode => {
    const f = fixture(1001)
    if (mode === 'extra') f.rows.recording_chunks.push({ ...f.rows.recording_chunks[0] })
    if (mode === 'duplicate') f.rows.recording_chunks[1].id = f.rows.recording_chunks[0].id
    if (mode === 'missing') f.rows.recording_chunks.pop()
    if (mode === 'no-count') f.loseCount('recording_chunks')
    if (mode === 'truncated') f.truncate('recording_chunks')
    await expect(loadRecordingJobInput(JOB, { admin: f.admin })).rejects.toThrow(ERROR)
  })

  it.each([SESSION, STORY, PROJECT, 'asset'])('rejects a current tombstone for %s', async subject => {
    const f = fixture()
    f.rows.deletion_requests.push({ project_id: PROJECT, subject_id: subject === 'asset' ? f.sealed.task.assetId : subject,
      tombstone_at: DATE, state: 'completed' })
    await expect(loadRecordingJobInput(JOB, { admin: f.admin })).rejects.toThrow(ERROR)
  })

  it.each(['processing_jobs', 'media_assets', 'recording_sessions', 'recording_chunks', 'projects', 'project_roles', 'stories', 'deletion_requests'])
  ('sanitizes %s failures and disables automatic HTTP retries', async table => {
    const f = fixture(); f.fail(table)
    await expect(loadRecordingJobInput(JOB, { admin: f.admin })).rejects.toThrow(ERROR)
    expect(f.requests.filter(request => request.table === table)).toHaveLength(1)
  })

  it('rejects pre-abort before dispatch and mid-abort even if fetch ignores the signal', async () => {
    const f = fixture(); const controller = new AbortController(); controller.abort('SECRET')
    await expect(loadRecordingJobInput(JOB, { admin: f.admin, signal: controller.signal })).rejects.toThrow(ERROR)
    expect(f.fetchMock).not.toHaveBeenCalled()
    const second = new AbortController()
    f.setHook(() => new Promise(() => {}))
    const pending = loadRecordingJobInput(JOB, { admin: f.admin, signal: second.signal })
    await new Promise(resolve => setImmediate(resolve))
    second.abort('SECRET')
    await expect(pending).rejects.toThrow(ERROR)
    expect(f.requests[0].signal?.aborted).toBe(true)
  })

  it('bounds a stalled query and aborts it', async () => {
    const f = fixture(); f.setHook(() => new Promise(() => {}))
    await expect(loadRecordingJobInput(JOB, { admin: f.admin, queryTimeoutMs: 15 })).rejects.toThrow(ERROR)
    expect(f.requests[0].signal?.aborted).toBe(true)
  })

  it.each(badFields)('revalidation catches pinned state drift at %s.%s', async (table, key, value) => {
    const f = fixture(); const trusted = await loadRecordingJobInput(JOB, { admin: f.admin })
    f.rows[table][0][key] = value
    await expect(trusted.revalidate()).rejects.toThrow(ERROR)
  })

  it('pins otherwise-valid sealed timestamps and chunk row identities', async () => {
    for (const [table, key, value] of [['recording_sessions', 'sealed_at', '2026-11-02T01:00:00Z'], ['recording_chunks', 'id', OTHER]]) {
      const f = fixture(); const trusted = await loadRecordingJobInput(JOB, { admin: f.admin })
      f.rows[table][0][key] = value
      await expect(trusted.revalidate()).rejects.toThrow(ERROR)
    }
  })

  it('rejects a coherently rewritten input even when its new hashes and idempotency keys all agree', async () => {
    const f = fixture(); const trusted = await loadRecordingJobInput(JOB, { admin: f.admin })
    f.manifest.chunks[0].sha256 = 'b'.repeat(64)
    f.rows.recording_chunks[0].sha256 = 'b'.repeat(64)
    f.rows.recording_sessions[0].manifest_sha256 = createHash('sha256').update(pgText(f.manifest)).digest('hex')
    const changed = prepareRecordingSessionSeal({ projectId: PROJECT, sessionId: SESSION, actorId: USER,
      actorRole: 'storyteller', actorActive: true, storyId: STORY, jobId: JOB, mimeType: 'audio/webm', chunks: f.manifest.chunks })
    f.rows.media_assets[0].idempotency_key = changed.task.idempotencyKey
    f.rows.processing_jobs[0].idempotency_key = changed.task.idempotencyKey
    await expect(loadRecordingJobInput(JOB, { admin: f.admin })).resolves.toHaveProperty('task')
    await expect(trusted.revalidate()).rejects.toThrow(ERROR)
  })

  it('accepts equivalent JSON object key ordering without mistaking it for manifest drift', async () => {
    const f = fixture(); const trusted = await loadRecordingJobInput(JOB, { admin: f.admin })
    f.rows.recording_sessions[0].seal_input = Object.fromEntries(Object.entries(f.manifest).reverse())
    await expect(trusted.revalidate()).resolves.toBeUndefined()
  })

  it.each(['processing_jobs', 'recording_sessions', 'deletion_requests'])('rejects missing exact counts for %s', async table => {
    const f = fixture(); f.loseCount(table)
    await expect(loadRecordingJobInput(JOB, { admin: f.admin })).rejects.toThrow(ERROR)
  })

  it('honors abort at the last awaited read and retains that signal on revalidation', async () => {
    const f = fixture(); const controller = new AbortController()
    const trusted = await loadRecordingJobInput(JOB, { admin: f.admin, signal: controller.signal })
    f.setHook(table => { if (table === 'deletion_requests') controller.abort('SECRET') })
    await expect(trusted.revalidate()).rejects.toThrow(ERROR)
    const calls = f.requests.length
    await expect(trusted.revalidate()).rejects.toThrow(ERROR)
    expect(f.requests).toHaveLength(calls)
  })

  it('sanitizes a thrown transport failure during final revalidation', async () => {
    const f = fixture(); const trusted = await loadRecordingJobInput(JOB, { admin: f.admin })
    f.setHook(table => { if (table === 'deletion_requests') throw new Error('SECRET storage/path token') })
    await expect(trusted.revalidate()).rejects.toThrow(ERROR)
  })

  it('checks tombstones after the other reads and again on revalidation', async () => {
    const f = fixture(); const trusted = await loadRecordingJobInput(JOB, { admin: f.admin })
    f.setHook(table => {
      if (table === 'stories') f.rows.deletion_requests.push({ project_id: PROJECT, subject_id: SESSION, tombstone_at: DATE })
    })
    await expect(trusted.revalidate()).rejects.toThrow(ERROR)
    expect(f.requests.at(-1)?.table).toBe('deletion_requests')
  })

  it('keeps task and derived physical locations immutable after handing them to a caller', async () => {
    const f = fixture(); const trusted = await loadRecordingJobInput(JOB, { admin: f.admin })
    expect(Object.isFrozen(trusted.task)).toBe(true)
    expect(Object.isFrozen(trusted.task.chunks)).toBe(true)
    expect(Object.isFrozen(trusted.task.chunks[0])).toBe(true)
    expect(Object.isFrozen(trusted.storageObjectKeys)).toBe(true)
  })

  it.each(['original', 'scope'])('retains the %s cancellation signal when revalidation receives a scoped signal', async source => {
    const f = fixture()
    const original = new AbortController()
    const scope = new AbortController()
    const trusted = await loadRecordingJobInput(JOB, { admin: f.admin, signal: original.signal })
    const calls = f.requests.length
    const cancelled = source === 'original' ? original : scope
    cancelled.abort()
    await expect(trusted.revalidate(scope.signal)).rejects.toThrow(ERROR)
    expect(f.requests).toHaveLength(calls)
  })

  it.each(['headers', 'body'])('aborts pending ledger rechecks after the Storage %s timeout without starting later queries', async phase => {
    const f = fixture()
    const tempRoot = await mkdtemp(join(tmpdir(), 'saga-job-recheck-'))
    let finish: (() => void) | undefined
    const stall = () => f.setHook(table => {
      if (table === 'processing_jobs') return new Promise<void>(resolve => { finish = resolve })
    })
    try {
      await expect(verifyRecordingJobInput(JOB, {
        admin: f.admin, storageUrl: 'https://storage.invalid', serviceRoleKey: 'test-service-key',
        ffmpeg: { executable: '/unused-test-ffmpeg', timeoutMs: 1000, maxDurationMs: 1000 },
        tempRoot, ioTimeoutMs: 30,
        fetch: async () => {
          if (phase === 'headers') { stall(); return new Response('abc') }
          return new Response(new ReadableStream({
            pull(controller) { stall(); controller.enqueue(Buffer.from('abc')); controller.close() },
          }, { highWaterMark: 0 }))
        },
      })).rejects.toThrow('recording_input_unavailable')
      expect(finish).toBeDefined()
      const pendingQuery = f.requests.at(-1)!
      expect(pendingQuery.table).toBe('processing_jobs')
      const wasAborted = pendingQuery.signal?.aborted
      const callsAfterRejection = f.requests.length
      finish!()
      await new Promise(resolve => setImmediate(resolve))
      expect({ wasAborted, laterQueries: f.requests.length - callsAfterRejection })
        .toEqual({ wasAborted: true, laterQueries: 0 })
      expect(await readdir(tempRoot)).toEqual([])
    } finally {
      finish?.()
      await rm(tempRoot, { recursive: true, force: true })
    }
  })
})

import { randomUUID } from 'node:crypto'
import { digest } from '../pg17-routines/runtime.mjs'
import { fixture, rpc as leaseRpc, USER, PROJECT } from '../pg17-recording-worker/fixture.mjs'
import { candidateRpc } from '../pg17-recording-candidates/fixture.mjs'
import { WORKER } from '../pg17-recording-finalization/fixture.mjs'

export const SNAPSHOT = 'supabase/migrations/20261105000001_recording_session_snapshot.sql'
export const SIGNATURE = 'public.read_recording_session_snapshot(uuid,uuid,uuid,text)'
export const RPC = 'SELECT public.read_recording_session_snapshot($1::uuid,$2::uuid,$3::uuid,$4::text) AS snapshot'
export const args = f => [USER, PROJECT, f.sessionId, f.manifestSha256]
export const input = f => ({ actorId: USER, projectId: PROJECT, sessionId: f.sessionId, manifestSha256: f.manifestSha256 })
export async function snapshot(client, values) { return (await client.query(RPC, values)).rows[0].snapshot }
export async function outcome(client, values) {
  try { return { code: '00000', snapshot: await snapshot(client, values) } }
  catch (error) { return { code: error.code ?? 'QUERY_FAILED', message: error.message } }
}
export async function fresh(h, service, prepare, { running = true, candidate = true, ttl = 120000 } = {}) {
  const f = await fixture(h, service, prepare)
  if (running) {
    const began = performance.now()
    await leaseRpc(service, f.jobId, 'claim', WORKER, null, ttl)
    const lease = await leaseRpc(service, f.jobId, 'start', WORKER, 1)
    f.lease = { ...lease, deadline: began + ttl - Math.min(100, ttl / 10) }
  }
  if (candidate) {
    f.candidateId = randomUUID()
    f.output = { byteSize: f.bytes.length, sha256: digest(f.bytes), mimeType: f.mimeType, durationMs: 1250 }
    await candidateRpc(service, [f.jobId, 'reserve', WORKER, 1, f.manifestSha256, f.candidateId, f.output])
    f.candidate = await candidateRpc(service, [f.jobId, 'prepare', WORKER, 1, f.manifestSha256, f.candidateId, f.output])
  }
  return f
}

// JSON is built by PG, preserving every tuple field and timestamp microsecond.
// Compare the entire synthetic database, including authorization and Storage.
export async function allState(h) {
  const tables = ['auth.users', 'public.projects', 'public.project_roles', 'public.stories',
    'public.deletion_requests', 'public.media_assets', 'public.processing_jobs', 'public.processing_attempts',
    'public.recording_sessions', 'public.recording_chunks', 'public.recording_output_candidates',
    'storage.buckets', 'storage.objects']
  const rows = {}
  for (const table of tables) rows[table] = (await h.db.query(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]') AS rows FROM ${table} t`)).rows[0].rows
  return rows
}

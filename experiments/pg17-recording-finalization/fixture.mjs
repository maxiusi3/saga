import { setup as setupCandidates, CANDIDATE } from '../pg17-recording-candidates/fixture.mjs'

export const FINALIZATION = 'supabase/migrations/20261104000001_recording_job_finalization.sql'
export const SIGNATURE = 'public.finalize_recording_job(uuid,text,text,integer,text,uuid,jsonb,text)'
export const RPC = 'SELECT public.finalize_recording_job($1::uuid,$2::text,$3::text,$4::integer,$5::text,$6::uuid,$7::jsonb,$8::text) AS receipt'
export const WORKER = 'finalization-worker-1'
export const PERMANENT_CODES = ['recording_source_missing', 'recording_source_not_private_file',
  'recording_source_size_mismatch', 'recording_source_hash_mismatch',
  'recording_decode_invalid_pcm', 'recording_decode_duration_exceeded']

export async function setup(h, source) {
  await setupCandidates(h, source)
  await h.db.query("SET timezone='UTC'")
  await h.db.query(await source(CANDIDATE))
  h.report.fixture.fullMigrations.push(CANDIDATE)
}

export const args = (f, action = 'publish', code = PERMANENT_CODES[0]) => [f.jobId, action, WORKER, 1,
  f.manifestSha256, action === 'publish' ? f.candidateId : null, action === 'publish' ? f.output : null,
  action === 'fail' ? code : null]

export async function rpc(client, values) {
  const parameters = [...values]
  // pg serializes JavaScript arrays as PostgreSQL arrays, so encode JSON
  // explicitly to exercise malformed JSON shapes inside the actual RPC.
  if (parameters[6] !== null) parameters[6] = JSON.stringify(parameters[6])
  return (await client.query(RPC, parameters)).rows[0].receipt
}

export async function outcome(client, values) {
  try { return { code: '00000', receipt: await rpc(client, values) } }
  catch (error) { return { code: error.code ?? 'QUERY_FAILED' } }
}

// JSON is built inside PostgreSQL so timestamps retain microseconds. Every
// affected tuple, all attempts/candidates and immutable input rows are retained.
export async function state(h, f) {
  return (await h.db.query(`SELECT jsonb_build_object(
    'job',(SELECT to_jsonb(j) FROM public.processing_jobs j WHERE j.id=$1),
    'asset',(SELECT to_jsonb(a) FROM public.media_assets a WHERE a.id=$2),
    'session',(SELECT to_jsonb(s) FROM public.recording_sessions s WHERE s.id=$3),
    'attempts',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.attempt_no),'[]') FROM public.processing_attempts a WHERE a.job_id=$1),
    'candidates',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]') FROM public.recording_output_candidates c WHERE c.job_id=$1),
    'chunks',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.chunk_index),'[]') FROM public.recording_chunks c WHERE c.session_id=$3)
  ) AS state`, [f.jobId, f.assetId, f.sessionId])).rows[0].state
}

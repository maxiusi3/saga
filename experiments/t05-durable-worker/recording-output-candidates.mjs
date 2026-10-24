import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const referencePattern = /^local-recording:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const candidateSchema = `
  CREATE TABLE IF NOT EXISTS public.poc_recording_outputs (
    ref text PRIMARY KEY, job_id text NOT NULL, attempt int NOT NULL CHECK (attempt > 0),
    worker_id text NOT NULL, queue_id uuid NOT NULL, queue_retry_count int NOT NULL CHECK (queue_retry_count >= 0),
    input_digest text NOT NULL, state text NOT NULL CHECK (state IN ('reserved','prepared','publishing','published','cleaned','quarantined')),
    metadata jsonb, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), prepared_at timestamptz,
    publishing_at timestamptz, published_at timestamptz, cleaned_at timestamptz, quarantined_at timestamptz,
    UNIQUE (job_id, attempt), FOREIGN KEY (job_id, attempt) REFERENCES public.poc_attempts(job_id, attempt),
    CHECK ((state IN ('reserved','cleaned') AND metadata IS NULL AND prepared_at IS NULL) OR
           (state IN ('prepared','publishing','published','quarantined') AND metadata IS NOT NULL AND prepared_at IS NOT NULL)),
    CHECK ((publishing_at IS NOT NULL) = (state IN ('publishing','published'))),
    CHECK ((published_at IS NOT NULL) = (state = 'published')),
    CHECK ((cleaned_at IS NOT NULL) = (state = 'cleaned')),
    CHECK ((quarantined_at IS NOT NULL) = (state = 'quarantined'))
  );`;

export function assertCandidateReference(ref) {
  if (typeof ref !== 'string' || !referencePattern.test(ref)) throw new Error('Invalid recording candidate reference');
}

export function candidateIdentity(info, inputDigest, ref = `local-recording:${randomUUID()}`) {
  assertCandidateReference(ref);
  if (!info || typeof info.jobId !== 'string' || !info.jobId || !Number.isSafeInteger(info.attempt) || info.attempt <= 0 ||
      typeof info.workerId !== 'string' || !info.workerId.trim() || typeof info.queueId !== 'string' ||
      !Number.isSafeInteger(info.retryCount) || info.retryCount < 0 || !/^[a-f0-9]{64}$/.test(inputDigest)) {
    throw new Error('Invalid recording candidate identity');
  }
  return { ref, job_id: info.jobId, attempt: info.attempt, worker_id: info.workerId,
    queue_id: info.queueId, queue_retry_count: info.retryCount, input_digest: inputDigest };
}

export function assertCandidate(candidate, identity, { state, metadata } = {}) {
  assertCandidateReference(identity.ref);
  if (!candidate || Object.entries(identity).some(([key, value]) => candidate[key] !== value)) throw new Error('Recording candidate identity mismatch');
  if (state !== undefined && candidate.state !== state) throw new Error(`Recording candidate state must be ${state}`);
  if (metadata !== undefined && !isDeepStrictEqual(candidate.metadata, metadata)) throw new Error('Recording candidate metadata mismatch');
  return candidate;
}

// The store owns the transaction and job -> queue -> candidate locking order.
export async function reserveCandidate(client, identity) {
  await client.query(`INSERT INTO public.poc_recording_outputs(ref,job_id,attempt,worker_id,queue_id,queue_retry_count,input_digest,state)
    VALUES ($1,$2,$3,$4,$5,$6,$7,'reserved')`,
  [identity.ref,identity.job_id,identity.attempt,identity.worker_id,identity.queue_id,identity.queue_retry_count,identity.input_digest]);
}

export async function lockCandidate(client, identity, expected) {
  const candidate = (await client.query('SELECT * FROM public.poc_recording_outputs WHERE ref = $1 FOR UPDATE', [identity.ref])).rows[0];
  return assertCandidate(candidate, identity, expected);
}

export async function advanceCandidate(client, identity, from, to, metadata) {
  const transitions = { 'reserved:prepared': 'prepared_at', 'reserved:cleaned': 'cleaned_at',
    'prepared:publishing': 'publishing_at', 'publishing:published': 'published_at', 'prepared:quarantined': 'quarantined_at' };
  const timestamp = transitions[`${from}:${to}`];
  if (!timestamp || (to === 'prepared') !== (metadata !== undefined)) throw new Error('Invalid recording candidate transition');
  const result = await client.query(`UPDATE public.poc_recording_outputs SET state = $3, ${timestamp} = clock_timestamp()
    ${to === 'prepared' ? ', metadata = $4' : ''} WHERE ref = $1 AND state = $2 RETURNING *`,
  to === 'prepared' ? [identity.ref,from,to,metadata] : [identity.ref,from,to]);
  return assertCandidate(result.rows[0], identity, { state: to, metadata });
}

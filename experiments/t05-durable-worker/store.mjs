import { randomUUID } from 'node:crypto';
import { dirname, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import pg from 'pg';
import { PgBoss } from 'pg-boss';
import { createLocalRecordingMerge } from './local-recording-merge.mjs';
import { candidateSchema, candidateIdentity, assertCandidateReference, assertCandidate, reserveCandidate, lockCandidate, advanceCandidate } from './recording-output-candidates.mjs';

const QUEUE = 'saga-poc';
const LEASE_MS = 5_000;
const SEND_OPTIONS = { expireInSeconds: 5, retryLimit: 5, retryDelay: 0, retryBackoff: false };
const adapter = (client) => ({ executeSql: (sql, values) => client.query(sql, values) });

class LostQueueClaim extends Error {}
class ExpiredPublication extends Error {}

function checkedNow(nowISO) {
  const value = nowISO ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(value))) throw new Error('Invalid logical clock');
  return value;
}

export async function openPoc(config, { supervise = false } = {}) {
  // Never accept a connection string or fall back to a developer's database settings.
  if (!config || !/^\/tmp\/saga-t05-[A-Za-z0-9_-]+\/socket$/.test(config.host ?? '') ||
      config.user !== 'saga_poc' || config.database !== 'postgres' ||
      !Number.isInteger(config.port) || config.port < 1 || config.port > 65535 ||
      typeof config.stateModule !== 'string' || !isAbsolute(config.stateModule) ||
      config.connectionString !== undefined) {
    throw new Error('PoC requires an explicit private /tmp/saga-t05-*/socket, port, saga_poc user, postgres database and absolute stateModule');
  }
  const state = await import(pathToFileURL(config.stateModule).href);
  const recording = config.recording === undefined ? undefined : await createLocalRecordingMerge(config.recording, dirname(config.host));
  const applicationName = `t05-${process.pid}-${randomUUID()}`;
  const connection = {
    host: config.host, port: config.port, user: 'saga_poc', database: 'postgres',
    password: '', ssl: false, max: 4, connectionTimeoutMillis: 5_000,
    application_name: applicationName,
  };
  const pool = new pg.Pool(connection);
  const cancelPendingQueries = async () => {
    // Use a fresh connection to the already validated private cluster. The unique
    // instance tag fences cancellation to this pool, never sibling workers/harnesses.
    const control = new pg.Client({ ...connection, application_name: `${applicationName}-cancel`, connectionTimeoutMillis: 1_000, statement_timeout: 1_000 });
    try {
      await control.connect();
      return (await control.query(
        "SELECT pid, pg_cancel_backend(pid) AS cancelled FROM pg_stat_activity WHERE application_name = $1 AND state = 'active' AND pid <> pg_backend_pid()",
        [applicationName],
      )).rows;
    } finally { await control.end(); }
  };
  const boss = new PgBoss({
    db: adapter(pool), schema: 'pgboss', supervise, schedule: false,
    registerInstance: false, monitorIntervalSeconds: 1, superviseIntervalSeconds: 1,
  });
  const errors = [];
  boss.on('error', (error) => errors.push(error));
  pool.on('error', (error) => errors.push(error));
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    try { await boss.stop({ graceful: false }); } finally { await pool.end(); }
  };
  try {
    await boss.start();
    return { pool, boss, state, recording, errors, close, cancelPendingQueries };
  } catch (error) {
    await close();
    throw error;
  }
}

async function transaction(context, action, { rollback = false, signal } = {}) {
  const client = await context.pool.connect();
  try {
    await client.query('BEGIN');
    const result = await action(client);
    // An abort observed before COMMIT is sent must roll all staged writes back.
    // This cannot undo a COMMIT that was already sent to PostgreSQL.
    signal?.throwIfAborted();
    await client.query(rollback ? 'ROLLBACK' : 'COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function installPoc(context) {
  await context.pool.query(`
    CREATE TABLE IF NOT EXISTS public.poc_jobs (
      id text PRIMARY KEY, snapshot jsonb NOT NULL, revision bigint NOT NULL DEFAULT 0,
      allowed boolean NOT NULL DEFAULT true, review boolean NOT NULL DEFAULT false
    );
    CREATE TABLE IF NOT EXISTS public.poc_attempts (
      job_id text NOT NULL REFERENCES public.poc_jobs(id), attempt int NOT NULL,
      worker_id text NOT NULL, state text NOT NULL, queue_id uuid, queue_retry_count int,
      PRIMARY KEY (job_id, attempt)
    );
    CREATE TABLE IF NOT EXISTS public.poc_calls (
      id uuid PRIMARY KEY, job_id text NOT NULL REFERENCES public.poc_jobs(id), attempt int NOT NULL,
      UNIQUE (job_id, attempt)
    );
    CREATE TABLE IF NOT EXISTS public.poc_artifacts (
      job_id text PRIMARY KEY REFERENCES public.poc_jobs(id), ref text NOT NULL,
      published boolean NOT NULL DEFAULT false
    );
    CREATE TABLE IF NOT EXISTS public.poc_retry_authorizations (
      job_id text PRIMARY KEY REFERENCES public.poc_jobs(id), revision bigint NOT NULL,
      approved_by text NOT NULL, approval_ref text NOT NULL, authorized_at timestamptz NOT NULL,
      used boolean NOT NULL DEFAULT false
    );
    ALTER TABLE public.poc_jobs ADD COLUMN IF NOT EXISTS frozen_input jsonb;
    ALTER TABLE public.poc_attempts ADD COLUMN IF NOT EXISTS input_digest text;
    ALTER TABLE public.poc_attempts ADD COLUMN IF NOT EXISTS failure jsonb;
    ALTER TABLE public.poc_artifacts ADD COLUMN IF NOT EXISTS metadata jsonb;
    CREATE UNIQUE INDEX IF NOT EXISTS poc_recording_idempotency
      ON public.poc_jobs ((frozen_input->'task'->>'idempotencyKey')) WHERE frozen_input IS NOT NULL;
  `);
  await context.pool.query(candidateSchema);
  await context.boss.createQueue(QUEUE, SEND_OPTIONS);
}

function assertPositiveDuration(leaseMs) {
  if (!Number.isFinite(leaseMs) || leaseMs <= 0) throw new Error('Lease duration must be positive');
}

async function lockQueue(client, queueId) {
  return (await client.query('SELECT * FROM pgboss.job WHERE name = $1 AND id = $2 FOR UPDATE', [QUEUE, queueId])).rows[0];
}

const databaseNow = async (client) => (await client.query('SELECT clock_timestamp() AS now')).rows[0].now.toISOString();

function queueDeadline(queue) {
  if (!queue?.started_on) return -Infinity;
  const hard = new Date(queue.started_on).getTime() + queue.expire_seconds * 1_000;
  const heartbeat = queue.heartbeat_seconds === null ? Infinity
    : new Date(queue.heartbeat_on).getTime() + queue.heartbeat_seconds * 1_000;
  return Math.min(hard, heartbeat);
}

function assertQueueClaim(queue, { queueId, retryCount }, now) {
  if (!queue || queue.id !== queueId || queue.state !== 'active' || queue.retry_count !== retryCount) {
    throw new LostQueueClaim('Queue attempt is no longer active');
  }
  if (queueDeadline(queue) <= Date.parse(now)) throw new LostQueueClaim('Queue claim has expired');
}

/** One transaction locks business then queue, touches the exact claim and bounds the lease. */
export async function heartbeatJob(context, id, { workerId, attempt, queueId, retryCount, nowISO, leaseMs = LEASE_MS } = {}) {
  if (typeof workerId !== 'string' || !workerId.trim()) throw new Error('Worker id is required');
  if (!Number.isSafeInteger(attempt) || attempt <= 0) throw new Error('Attempt is required');
  if (typeof queueId !== 'string' || !Number.isSafeInteger(retryCount) || retryCount < 0) throw new Error('Exact queue claim is required');
  checkedNow(nowISO); // Explicit logical input is validated but never controls a heartbeat.
  assertPositiveDuration(leaseMs);
  if (leaseMs > LEASE_MS) throw new Error('Lease duration cannot exceed 5 seconds');
  return transaction(context, async (client) => {
    const row = await lockJob(client, id);
    if (!row) throw new Error('Job does not exist');
    const queue = await lockQueue(client, queueId);
    // BOTH locks may wait. Neither application time nor transaction-start now() is authoritative.
    const now = await databaseNow(client);
    const snapshot = row.snapshot;
    if (!row.allowed || snapshot.cancelRequestedAt !== null || snapshot.deletionRequestedAt !== null) throw new Error('Job is cancelled or revoked');
    if (!active(snapshot)) throw new Error('Job is not leased or running');
    if (snapshot.leaseOwner !== workerId || snapshot.attemptCount !== attempt) throw new Error('Stale worker or attempt');
    if (!snapshot.leaseExpiresAt || Date.parse(snapshot.leaseExpiresAt) <= Date.parse(now)) throw new Error('Lease has expired');
    const binding = (await client.query('SELECT * FROM public.poc_attempts WHERE job_id = $1 AND attempt = $2', [id, attempt])).rows[0];
    const frozen = recordingBinding(context, row, binding?.input_digest ?? undefined);
    if ((frozen?.digest ?? null) !== binding?.input_digest) throw new Error('Recording attempt input binding changed');
    if (!binding || binding.worker_id !== workerId || binding.queue_id !== queueId || binding.queue_retry_count !== retryCount || queue?.data?.jobId !== id) {
      throw new LostQueueClaim('Queue claim does not match business attempt');
    }
    assertQueueClaim(queue, { queueId, retryCount }, now);
    const touched = await context.boss.touch(QUEUE, { id: queueId, retryCount }, { db: adapter(client) });
    if (touched.affected !== 1) throw new LostQueueClaim('Queue touch lost its attempt');
    // pg-boss job_now() uses transaction-start time; read the actual stored heartbeat.
    const refreshedQueue = await lockQueue(client, queueId);
    const afterTouch = await databaseNow(client);
    assertQueueClaim(refreshedQueue, { queueId, retryCount }, afterTouch);
    snapshot.leaseExpiresAt = new Date(Math.min(Date.parse(afterTouch) + leaseMs, queueDeadline(refreshedQueue))).toISOString();
    await saveSnapshot(client, id, snapshot);
    return snapshot;
  });
}

/** Reconcile an outcome_unknown row without ever dispatching the synthetic provider. */
export async function reconcileUnknownJob(context, id, options = {}) {
  const { decision, revision } = options;
  if (!['reuse_prepared', 'controlled_retry', 'keep_unknown'].includes(decision)) throw new Error('Invalid reconciliation decision');
  if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Revision is required');
  return transaction(context, async (client) => {
    const row = await lockJob(client, id);
    if (!row) throw new Error('Job does not exist');
    rejectRecordingReview(row);
    if (Number(row.revision) !== revision) throw new Error('Stale revision');
    const snapshot = row.snapshot;
    if (!row.allowed || snapshot.cancelRequestedAt !== null || snapshot.deletionRequestedAt !== null || snapshot.state === 'cancelled') {
      throw new Error('Job is cancelled or revoked');
    }
    if (snapshot.state !== 'outcome_unknown') {
      throw new Error('Job is not outcome_unknown');
    }
    if (decision === 'keep_unknown') return snapshot;
    const now = (await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
    if (decision === 'reuse_prepared') {
      const artifact = (await client.query('SELECT * FROM public.poc_artifacts WHERE job_id = $1 FOR UPDATE', [id])).rows[0];
      if (!artifact || artifact.published || artifact.ref !== snapshot.resultRef) throw new Error('Prepared artifact is missing or mismatched');
      snapshot.state = 'succeeded';
      snapshot.errorCode = null;
      snapshot.notBefore = null;
      snapshot.leaseOwner = null;
      snapshot.leaseExpiresAt = null;
      await client.query('UPDATE public.poc_artifacts SET published = true WHERE job_id = $1', [id]);
      await saveSnapshot(client, id, snapshot);
      await saveAttemptState(client, snapshot, 'succeeded');
      return snapshot;
    }
    const approvedBy = typeof options.approvedBy === 'string' ? options.approvedBy.trim() : '';
    const approvalRef = typeof options.approvalRef === 'string' ? options.approvalRef.trim() : '';
    if (!approvedBy || !approvalRef) throw new Error('Explicit human approval is required');
    const existing = (await client.query('SELECT * FROM public.poc_retry_authorizations WHERE job_id = $1 FOR UPDATE', [id])).rows[0];
    if (existing) throw new Error('Controlled retry authorization already used');
    await client.query(`INSERT INTO public.poc_retry_authorizations(job_id, revision, approved_by, approval_ref, authorized_at)
      VALUES ($1, $2, $3, $4, $5)`, [id, revision, approvedBy, approvalRef, now]);
    snapshot.state = 'retry_wait';
    snapshot.errorCode = 'controlled_retry_authorized';
    snapshot.notBefore = now;
    snapshot.leaseOwner = null;
    snapshot.leaseExpiresAt = null;
    snapshot.resultRef = null;
    await saveSnapshot(client, id, snapshot);
    await saveAttemptState(client, snapshot, 'retry_wait');
    await context.boss.send(QUEUE, { jobId: id }, { ...SEND_OPTIONS, db: adapter(client) });
    return snapshot;
  });
}

function initialSnapshot(id) {
  return {
    id, projectId: 'fictional-project', assetId: `fictional-asset:${id}`,
    state: 'queued', inputVersion: 1, jobType: 'poc-only',
    processorVersion: 'poc-v1', modelConfigVersion: 'poc-v1', parameterVersion: 'poc-v1',
    attemptCount: 0, maxAttempts: 5, notBefore: null,
    leaseOwner: null, leaseExpiresAt: null, cancelRequestedAt: null,
    deletionRequestedAt: null, errorCode: null, resultRef: null,
  };
}

export async function enqueueJob(context, id, { rollback = false, review = false, expireInSeconds = 5, heartbeatSeconds } = {}) {
  if (typeof id !== 'string' || !id.trim()) throw new Error('Job id is required');
  if (!Number.isSafeInteger(expireInSeconds) || expireInSeconds < 1) throw new Error('A finite positive hard cap is required');
  return transaction(context, async (client) => {
    const inserted = await client.query(
      'INSERT INTO public.poc_jobs(id, snapshot, review) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id',
      [id, initialSnapshot(id), review],
    );
    if (!inserted.rowCount) {
      const existing = await lockJob(client, id);
      if (isRecording(existing)) throw new Error('Job id is already bound to recording input');
      return null;
    }
    return context.boss.send(QUEUE, { jobId: id }, { ...SEND_OPTIONS, expireInSeconds, ...(heartbeatSeconds === undefined ? {} : { heartbeatSeconds }), db: adapter(client) });
  }, { rollback });
}

function isRecording(row) { return row?.frozen_input != null || row?.snapshot?.jobType === 'recording_merge'; }

function recordingBinding(context, row, expectedDigest) {
  if (!isRecording(row)) {
    if (expectedDigest !== undefined) throw new Error('Recording input binding is missing');
    return null;
  }
  if (!context.recording) throw new Error('Recording adapter is not configured');
  return context.recording.assertBinding(row, expectedDigest);
}

function rejectRecordingReview(row) {
  if (isRecording(row)) throw new Error('Real recording merge does not support synthetic review or reconciliation');
}

export async function enqueueRecordingMerge(context, id, input, { rollback = false, review = false, expireInSeconds = 30, heartbeatSeconds = 10 } = {}) {
  if (!context.recording) throw new Error('Recording adapter is not configured');
  if (review) throw new Error('Real recording merge does not support synthetic review');
  if (!Number.isSafeInteger(expireInSeconds) || expireInSeconds < 1) throw new Error('A finite positive hard cap is required');
  const frozen = context.recording.freeze(id, input);
  const task = frozen.task;
  const snapshot = { ...initialSnapshot(id), projectId: task.projectId, sessionId: task.sessionId,
    assetId: task.assetId, inputVersion: task.inputVersion, jobType: task.jobType,
    processorVersion: task.processorVersion, modelConfigVersion: 'none', parameterVersion: task.parameterVersion,
    idempotencyKey: task.idempotencyKey };
  return transaction(context, async client => {
    const inserted = await client.query('INSERT INTO public.poc_jobs(id, snapshot, frozen_input) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id', [id, snapshot, frozen]);
    if (!inserted.rowCount) {
      const existing = await lockJob(client, id);
      if (!existing) throw new Error('Recording idempotency key is already bound to another job ID');
      const bound = recordingBinding(context, existing, frozen.digest);
      if (!bound || !isDeepStrictEqual(bound, frozen)) throw new Error('Job id is already bound to different recording input');
      return null;
    }
    return context.boss.send(QUEUE, { jobId: id }, { ...SEND_OPTIONS, expireInSeconds, heartbeatSeconds, db: adapter(client) });
  }, { rollback });
}

/** Local allowed flag simulation, not production authorization/RLS. Never accepts a file path. */
export async function readPublishedRecording(context, id, { signal } = {}) {
  const readReference = async () => {
    signal?.throwIfAborted();
    const row = (await context.pool.query(`SELECT j.*, a.ref, a.published, a.metadata, to_jsonb(c) AS candidate, to_jsonb(t) AS attempt_binding FROM public.poc_jobs j
      LEFT JOIN public.poc_artifacts a ON a.job_id = j.id
      LEFT JOIN public.poc_recording_outputs c ON c.ref = a.ref
      LEFT JOIN public.poc_attempts t ON t.job_id = j.id AND t.attempt = (j.snapshot->>'attemptCount')::int WHERE j.id = $1`, [id])).rows[0];
    signal?.throwIfAborted();
    if (!row || !row.allowed || row.snapshot.cancelRequestedAt !== null || row.snapshot.deletionRequestedAt !== null ||
        row.snapshot.state !== 'succeeded' || row.published !== true || row.ref !== row.snapshot.resultRef) throw new Error('Published recording is unavailable');
    const frozen = recordingBinding(context, row);
    if (!frozen) throw new Error('Published recording input is missing');
    const binding = row.attempt_binding;
    if (!binding || binding.state !== 'succeeded' || binding.input_digest !== frozen.digest) throw new Error('Published recording attempt identity mismatch');
    const identity = candidateIdentity({ jobId: id, attempt: binding.attempt, workerId: binding.worker_id, queueId: binding.queue_id, retryCount: binding.queue_retry_count }, frozen.digest, row.ref);
    const candidate = assertCandidate(row.candidate, identity, { state: 'published', metadata: row.metadata });
    context.recording.checkMetadata({ ref: candidate.ref, metadata: candidate.metadata }, frozen);
    return { frozen, identity, prepared: { ref: row.ref, metadata: row.metadata } };
  };
  const before = await readReference();
  const bytes = await context.recording.readOutput(before.prepared, before.frozen, { signal, collect: true });
  signal?.throwIfAborted();
  // I/O is outside a transaction; recheck revocation/deletion/version after it.
  const after = await readReference();
  if (!isDeepStrictEqual(before, after)) throw new Error('Published recording changed during read');
  signal?.throwIfAborted();
  return { bytes, ...before.prepared.metadata };
}

async function lockJob(client, id) {
  return (await client.query('SELECT * FROM public.poc_jobs WHERE id = $1 FOR UPDATE', [id])).rows[0];
}

async function saveSnapshot(client, id, snapshot) {
  await client.query('UPDATE public.poc_jobs SET snapshot = $2, revision = revision + 1 WHERE id = $1', [id, snapshot]);
}

async function saveAttemptState(client, snapshot, state = snapshot.state) {
  await client.query('UPDATE public.poc_attempts SET state = $3 WHERE job_id = $1 AND attempt = $2',
    [snapshot.id, snapshot.attemptCount, state]);
}

export async function approveJob(context, id, nowISO) {
  const now = checkedNow(nowISO);
  return transaction(context, async (client) => {
    const row = await lockJob(client, id);
    if (!row || !row.allowed) throw new Error('Job is unavailable for approval');
    rejectRecordingReview(row);
    const snapshot = context.state.approveProcessingJobReview(row.snapshot, now);
    const artifact = (await client.query('SELECT ref, published FROM public.poc_artifacts WHERE job_id = $1', [id])).rows[0];
    if (!artifact || artifact.published || artifact.ref !== snapshot.resultRef) throw new Error('Prepared artifact is missing');
    await saveSnapshot(client, id, snapshot);
    await client.query('UPDATE public.poc_jobs SET review = false WHERE id = $1', [id]);
    return context.boss.send(QUEUE, { jobId: id }, { ...SEND_OPTIONS, db: adapter(client) });
  });
}

export async function cancelJob(context, id, nowISO) {
  const now = checkedNow(nowISO);
  return transaction(context, async (client) => {
    const row = await lockJob(client, id);
    if (!row) throw new Error('Job does not exist');
    const snapshot = context.state.requestProcessingJobCancellation(row.snapshot, now);
    await client.query('UPDATE public.poc_jobs SET allowed = false WHERE id = $1', [id]);
    await saveSnapshot(client, id, snapshot);
    await saveAttemptState(client, snapshot);
    return snapshot;
  });
}

function resultFor(envelope, status) {
  return { status, jobId: envelope.data.jobId, queueId: envelope.id };
}

async function settle(context, client, envelope, status) {
  const result = resultFor(envelope, status);
  const completed = await context.boss.complete(QUEUE,
    { id: envelope.id, retryCount: envelope.retryCount }, result, { db: adapter(client) });
  // A newer queue attempt must never be acknowledged by an old process. Throwing also
  // rolls back any business writes in this transaction, including artifact publication.
  if (completed.affected !== 1) throw new LostQueueClaim('Queue attempt is no longer active');
  return result;
}

function active(snapshot) {
  return snapshot.state === 'leased' || snapshot.state === 'running';
}

function liveLease(snapshot, now) {
  return active(snapshot) && snapshot.leaseExpiresAt !== null && Date.parse(snapshot.leaseExpiresAt) > Date.parse(now);
}

async function settledState(context, client, row, envelope, now) {
  if (!row) return settle(context, client, envelope, 'duplicate');
  const snapshot = row.snapshot;
  if (!row.allowed || snapshot.cancelRequestedAt !== null || snapshot.deletionRequestedAt !== null || snapshot.state === 'cancelled') {
    if (snapshot.state !== 'cancelled' && !['succeeded', 'failed'].includes(snapshot.state)) {
      row.snapshot = context.state.requestProcessingJobCancellation(snapshot, now);
      await saveSnapshot(client, row.id, row.snapshot);
      await saveAttemptState(client, row.snapshot);
    }
    return settle(context, client, envelope, 'cancelled');
  }
  if (snapshot.state === 'outcome_unknown') return settle(context, client, envelope, 'unknown');
  if (snapshot.state === 'awaiting_review') return settle(context, client, envelope, 'review');
  if (snapshot.state === 'succeeded' || snapshot.state === 'failed') return settle(context, client, envelope, 'duplicate');
  return null;
}

async function recover(context, client, row, now) {
  row.snapshot = context.state.recoverExpiredProcessingLease(row.snapshot, now);
  await saveSnapshot(client, row.id, row.snapshot);
  await saveAttemptState(client, row.snapshot);
}

// Every write after a checkpoint reads the authoritative row again. An envelope is
// independent of the business lease: a duplicate can be settled without revoking it.
async function guard(context, client, envelope, claim, clock) {
  const row = await lockJob(client, envelope.data.jobId);
  // A row-lock wait can consume the entire lease. Sample only after acquiring
  // the authoritative row; the supplied clock also preserves logical review time.
  const queue = await lockQueue(client, envelope.id);
  const now = clock.logical ? clock() : await databaseNow(client);
  recordingBinding(context, row, claim.recordingDigest);
  const terminal = await settledState(context, client, row, envelope, now);
  if (terminal) return { result: terminal };
  const snapshot = row.snapshot;
  if (snapshot.leaseOwner !== claim.leaseOwner || snapshot.attemptCount !== claim.attemptCount || !active(snapshot)) {
    return { result: await settle(context, client, envelope, 'duplicate') };
  }
  if (!liveLease(snapshot, now)) {
    await recover(context, client, row, now);
    const recovered = await settledState(context, client, row, envelope, now);
    // An expired pre-dispatch lease is safe to retry, so leave the envelope for the
    // real pg-boss supervisor. A running lease instead settles as outcome_unknown.
    return { result: recovered ?? resultFor(envelope, 'duplicate') };
  }
  assertQueueClaim(queue, { queueId: envelope.id, retryCount: envelope.retryCount }, clock.logical ? await databaseNow(client) : now);
  if (queue.data?.jobId !== row.id) throw new LostQueueClaim('Queue job identity changed');
  if (claim.recordingDigest !== undefined) {
    const binding = (await client.query('SELECT * FROM public.poc_attempts WHERE job_id = $1 AND attempt = $2', [row.id, claim.attemptCount])).rows[0];
    if (!binding || binding.worker_id !== claim.leaseOwner || binding.queue_id !== envelope.id ||
        binding.queue_retry_count !== envelope.retryCount || binding.input_digest !== claim.recordingDigest) {
      throw new LostQueueClaim('Recording attempt binding changed');
    }
  }
  return { row };
}

// Job and queue locks are already held before taking a candidate lock. A wait
// for that third lock (or a checkpoint) must not extend either execution lease.
async function candidateFence(context, client, envelope, claim, snapshot, signal) {
  signal?.throwIfAborted();
  const queue = (await client.query('SELECT * FROM pgboss.job WHERE name = $1 AND id = $2', [QUEUE, envelope.id])).rows[0];
  const now = await databaseNow(client);
  signal?.throwIfAborted();
  if (!liveLease(snapshot, now)) throw new ExpiredPublication('Lease expired while waiting for recording candidate');
  assertQueueClaim(queue, { queueId: envelope.id, retryCount: envelope.retryCount }, now);
  if (queue.data?.jobId !== claim.id) throw new LostQueueClaim('Queue job identity changed');
  const binding = (await client.query('SELECT * FROM public.poc_attempts WHERE job_id = $1 AND attempt = $2', [claim.id,claim.attemptCount])).rows[0];
  signal?.throwIfAborted();
  if (!binding || binding.worker_id !== claim.leaseOwner || binding.queue_id !== envelope.id ||
      binding.queue_retry_count !== envelope.retryCount || binding.input_digest !== claim.recordingDigest) throw new LostQueueClaim('Recording attempt binding changed');
}

/** A durable exclusion from publication, never a deletion or permission to unlink. */
export async function quarantineRecordingOutput(context, id, { ref, attempt, inputDigest, signal } = {}) {
  assertCandidateReference(ref);
  if (!Number.isSafeInteger(attempt) || attempt <= 0 || !/^[a-f0-9]{64}$/.test(inputDigest)) throw new Error('Invalid recording candidate identity');
  signal?.throwIfAborted();
  return transaction(context, async client => {
    const row = await lockJob(client, id);
    signal?.throwIfAborted();
    if (!row) throw new Error('Recording candidate job is unavailable');
    const frozen = recordingBinding(context, row, inputDigest);
    if (!frozen) throw new Error('Recording candidate input is missing');
    const binding = (await client.query('SELECT * FROM public.poc_attempts WHERE job_id = $1 AND attempt = $2', [id,attempt])).rows[0];
    if (!binding || binding.input_digest !== frozen.digest) throw new Error('Recording candidate attempt identity mismatch');
    const identity = candidateIdentity({ jobId: id, attempt, workerId: binding.worker_id, queueId: binding.queue_id,
      retryCount: binding.queue_retry_count }, inputDigest, ref);
    const queue = await lockQueue(client, binding.queue_id);
    const candidate = await lockCandidate(client, identity);
    const now = await databaseNow(client);
    signal?.throwIfAborted();
    if (candidate.metadata !== null) context.recording.checkMetadata({ ref, metadata: candidate.metadata }, frozen);
    if (queue && (queue.data?.jobId !== id || queue.retry_count !== binding.queue_retry_count)) throw new Error('Recording candidate queue identity mismatch');
    // Check every reference, including unpublished artifacts and another job's
    // resultRef. Supported publishers must own this job/candidate before writing.
    const references = await client.query(`SELECT 1 FROM public.poc_artifacts WHERE ref = $1
      UNION ALL SELECT 1 FROM public.poc_jobs WHERE snapshot->>'resultRef' = $1`, [ref]);
    signal?.throwIfAborted();
    const retained = reason => ({ status: 'retained', ref, state: candidate.state, reason });
    if (references.rowCount) return retained('referenced');
    if (!['prepared','quarantined'].includes(candidate.state)) return retained('state');
    const snapshot = row.snapshot;
    if (snapshot.state === 'outcome_unknown' || binding.state === 'outcome_unknown' ||
        snapshot.errorCode === 'lease_expired_after_dispatch_unknown') return retained('outcome_unknown');
    if (!['cancelled','failed'].includes(snapshot.state) || !['cancelled','failed'].includes(binding.state) ||
        snapshot.attemptCount !== attempt || snapshot.resultRef !== null || snapshot.leaseOwner !== null || snapshot.leaseExpiresAt !== null) return retained('not_stopped');
    if (queue?.state === 'active' && queueDeadline(queue) > Date.parse(now)) return retained('queue_active');
    if (candidate.state === 'quarantined') return { status: 'quarantined', ref, state: 'quarantined' };
    await advanceCandidate(client, identity, 'prepared', 'quarantined');
    signal?.throwIfAborted();
    return { status: 'quarantined', ref, state: 'quarantined' };
  }, { signal });
}

export async function processOne(context, { workerId, checkpoint = async () => {}, nowISO, jobId, signal } = {}) {
  if (typeof workerId !== 'string' || !workerId.trim()) throw new Error('Worker id is required');
  checkedNow(nowISO);
  const processingTransaction = action => transaction(context, action, { signal });
  let envelope;
  for (let i = 0; i < 20; i += 1) {
    const [candidate] = await context.boss.fetch(QUEUE, { batchSize: 1, includeMetadata: true });
    if (!candidate) break;
    if (!jobId || candidate.data?.jobId === jobId) { envelope = candidate; break; }
    await context.boss.complete(QUEUE, { id: candidate.id, retryCount: candidate.retryCount }, { status: 'duplicate' });
  }
  if (!envelope) return { status: 'empty' };
  if (typeof envelope.data?.jobId !== 'string' || Object.keys(envelope.data).length !== 1) throw new Error('Invalid PoC envelope');
  const now = () => checkedNow(nowISO);
  now.logical = nowISO !== undefined;
  let claim;
  try {
    const claimed = await processingTransaction(async (client) => {
      const row = await lockJob(client, envelope.data.jobId);
      const queue = await lockQueue(client, envelope.id);
      assertQueueClaim(queue, { queueId: envelope.id, retryCount: envelope.retryCount }, await databaseNow(client));
      if (queue.data?.jobId !== envelope.data.jobId) throw new LostQueueClaim('Queue job identity changed');
      const frozen = recordingBinding(context, row);
      if (frozen && now.logical) throw new Error('Recording merge requires the database wall clock');
      const terminal = await settledState(context, client, row, envelope, now());
      if (terminal) return { result: terminal };
      if (active(row.snapshot)) {
        if (liveLease(row.snapshot, now())) return { result: await settle(context, client, envelope, 'duplicate') };
        await recover(context, client, row, now());
        const recovered = await settledState(context, client, row, envelope, now());
        if (recovered) return { result: recovered };
      }
      // Recovery can set notBefore later than the first locked clock sample.
      // Claim with a fresh locked DB timestamp after recovery has finished.
      const claimNow = now.logical ? now() : await databaseNow(client);
      assertQueueClaim(queue, { queueId: envelope.id, retryCount: envelope.retryCount }, await databaseNow(client));
      if (row.snapshot.state === 'retry_wait' && row.snapshot.notBefore !== null && Date.parse(row.snapshot.notBefore) > Date.parse(claimNow)) {
        return { result: await settle(context, client, envelope, 'retry_wait') };
      }
      const snapshot = context.state.claimProcessingJob(row.snapshot, { workerId, now: claimNow, leaseMs: LEASE_MS });
      if (nowISO === undefined) {
        // Fetch starts the queue expiry just before this business claim. Bound the
        // business lease to that deadline so a refetched envelope cannot be settled
        // as an active-lease duplicate in the tiny interval between the two clocks.
        snapshot.leaseExpiresAt = new Date(Math.min(Date.parse(snapshot.leaseExpiresAt), queueDeadline(queue))).toISOString();
      }
      await saveSnapshot(client, row.id, snapshot);
      await client.query('INSERT INTO public.poc_attempts(job_id, attempt, worker_id, state, queue_id, queue_retry_count, input_digest) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [row.id, snapshot.attemptCount, workerId, snapshot.state, envelope.id, envelope.retryCount, frozen?.digest ?? null]);
      return { snapshot, frozen };
    });
    if (claimed.result) return claimed.result;
    claim = { ...claimed.snapshot, ...(claimed.frozen ? { recordingDigest: claimed.frozen.digest } : {}) };
    const info = { jobId: claim.id, queueId: envelope.id, attempt: claim.attemptCount, workerId, retryCount: envelope.retryCount };
    await checkpoint('leased', info);
    signal?.throwIfAborted();

    const started = await processingTransaction(async (client) => {
      const checked = await guard(context, client, envelope, claim, now);
      signal?.throwIfAborted();
      if (checked.result) return checked.result;
      const snapshot = checked.row.snapshot;
      context.state.assertProcessingJobTransition(snapshot.state, 'running');
      snapshot.state = 'running';
      await saveSnapshot(client, claim.id, snapshot);
      await saveAttemptState(client, snapshot);
      return null;
    });
    if (started) return started;
    await checkpoint('before_dispatch', info);
    signal?.throwIfAborted();

    const dispatched = await processingTransaction(async (client) => {
      const checked = await guard(context, client, envelope, claim, now);
      signal?.throwIfAborted();
      if (checked.result) return checked.result;
      // This INSERT is the entire simulated provider. It happens only after running
      // was committed, and no real external service or user content is involved.
      if (!claimed.frozen && checked.row.snapshot.resultRef === null) {
        await client.query('INSERT INTO public.poc_calls(id, job_id, attempt) VALUES ($1, $2, $3)',
          [randomUUID(), claim.id, claim.attemptCount]);
      }
      return null;
    });
    if (dispatched) return dispatched;
    if (claimed.frozen) {
      const identity = candidateIdentity(info, claimed.frozen.digest);
      // No reference reaches filesystem code until reservation COMMIT is confirmed.
      const reserved = await processingTransaction(async client => {
        const checked = await guard(context, client, envelope, claim, now);
        signal?.throwIfAborted();
        if (checked.result) return checked.result;
        await reserveCandidate(client, identity);
        await checkpoint('before_output_reservation_commit', { ...info, ref: identity.ref });
        await candidateFence(context, client, envelope, claim, checked.row.snapshot, signal);
        return null;
      });
      if (reserved) return reserved;
      await checkpoint('output_reserved', { ...info, ref: identity.ref });
      signal?.throwIfAborted();
      let prepared;
      try {
        prepared = await context.recording.prepare(claimed.frozen, { ref: identity.ref, signal,
          checkpoint: (stage, details, operationSignal) => checkpoint(stage, { ...info, ...details }, operationSignal) });
      } catch (error) {
        signal?.throwIfAborted();
        if (!context.recording.isProcessingError(error)) throw error;
        // Only prepare failures whose local cleanup completed enter this path.
        // Prepared output/readback/publication/COMMIT exceptions are outside it.
        await checkpoint('merge_failure', { ...info, code: error.code });
        signal?.throwIfAborted();
        return await processingTransaction(async client => {
          const checked = await guard(context, client, envelope, claim, now);
          signal?.throwIfAborted();
          if (checked.result) return checked.result;
          await lockCandidate(client, identity, { state: 'reserved' });
          await candidateFence(context, client, envelope, claim, checked.row.snapshot, signal);
          const snapshot = checked.row.snapshot;
          const failedAt = await databaseNow(client);
          signal?.throwIfAborted();
          if (!liveLease(snapshot, failedAt)) throw new ExpiredPublication('Lease expired before failure persistence');
          let finished;
          if (error.disposition === 'transient') {
            finished = context.state.retryProcessingJob(snapshot, { now: failedAt, errorCode: error.code,
              delayMs: Math.min(1000 * 2 ** (snapshot.attemptCount - 1), 5000) });
          } else {
            context.state.assertProcessingJobTransition(snapshot.state, 'failed');
            finished = { ...snapshot, state: 'failed', leaseOwner: null, leaseExpiresAt: null, notBefore: null, errorCode: error.code };
          }
          await advanceCandidate(client, identity, 'reserved', 'cleaned');
          await saveSnapshot(client, claim.id, finished);
          await client.query('UPDATE public.poc_attempts SET state = $3, failure = $4 WHERE job_id = $1 AND attempt = $2',
            [claim.id, claim.attemptCount, finished.state, { code: error.code, disposition: error.disposition, phase: 'prepare' }]);
          if (finished.state === 'retry_wait') {
            const retryId = await context.boss.send(QUEUE, { jobId: claim.id }, { ...SEND_OPTIONS,
              expireInSeconds: envelope.expireInSeconds, heartbeatSeconds: envelope.heartbeatSeconds ?? undefined,
              startAfter: new Date(finished.notBefore), db: adapter(client) });
            if (!retryId) throw new Error('Recording retry envelope was not created');
          }
          const result = await settle(context, client, envelope, finished.state);
          await checkpoint('before_failure_commit', { ...info, status: result.status });
          signal?.throwIfAborted();
          const queue = await lockQueue(client, envelope.id);
          const commitNow = await databaseNow(client);
          signal?.throwIfAborted();
          if (!liveLease(snapshot, commitNow)) throw new ExpiredPublication('Lease expired before failure commit');
          if (queue.retry_count !== envelope.retryCount || queue.data?.jobId !== claim.id || queueDeadline(queue) <= Date.parse(commitNow)) {
            throw new LostQueueClaim('Queue claim expired before failure commit');
          }
          return result;
        });
      }
      signal?.throwIfAborted();
      // A prepared file stays private even if this process dies or COMMIT's reply
      // is lost. Never delete/reuse it after handing preparation back to the store.
      if (prepared.ref !== identity.ref) throw new Error('Recording candidate reference changed');
      context.recording.checkMetadata(prepared, claimed.frozen);
      await checkpoint('merge_file_prepared', { ...info, ref: prepared.ref });
      signal?.throwIfAborted();
      const preparedResult = await processingTransaction(async client => {
        const checked = await guard(context, client, envelope, claim, now);
        signal?.throwIfAborted();
        if (checked.result) return checked.result;
        await lockCandidate(client, identity, { state: 'reserved' });
        await candidateFence(context, client, envelope, claim, checked.row.snapshot, signal);
        await advanceCandidate(client, identity, 'reserved', 'prepared', prepared.metadata);
        await checkpoint('before_output_prepared_commit', { ...info, ref: prepared.ref });
        await candidateFence(context, client, envelope, claim, checked.row.snapshot, signal);
        return null;
      });
      if (preparedResult) return preparedResult;
      await checkpoint('merge_prepared', { ...info, ref: prepared.ref });
      signal?.throwIfAborted();
      // Recheck disk after the externally injectable preparation checkpoint.
      await context.recording.readOutput(prepared, claimed.frozen, { signal });
      signal?.throwIfAborted();
      await checkpoint('before_publication', info);
      signal?.throwIfAborted();
      const publishingResult = await processingTransaction(async client => {
        const checked = await guard(context, client, envelope, claim, now);
        signal?.throwIfAborted();
        if (checked.result) return checked.result;
        await lockCandidate(client, identity, { state: 'prepared', metadata: prepared.metadata });
        await candidateFence(context, client, envelope, claim, checked.row.snapshot, signal);
        await advanceCandidate(client, identity, 'prepared', 'publishing');
        await checkpoint('before_output_publishing_commit', { ...info, ref: prepared.ref });
        await candidateFence(context, client, envelope, claim, checked.row.snapshot, signal);
        return null;
      });
      if (publishingResult) return publishingResult;
      await checkpoint('output_publishing', { ...info, ref: prepared.ref });
      signal?.throwIfAborted();
      return await processingTransaction(async client => {
        const checked = await guard(context, client, envelope, claim, now);
        signal?.throwIfAborted();
        if (checked.result) return checked.result;
        await lockCandidate(client, identity, { state: 'publishing', metadata: prepared.metadata });
        await candidateFence(context, client, envelope, claim, checked.row.snapshot, signal);
        const snapshot = checked.row.snapshot;
        if (snapshot.resultRef !== null) throw new Error('Real recording merge cannot reuse a prepared result');
        const finished = context.state.completeProcessingJob(snapshot, await databaseNow(client), prepared.ref);
        signal?.throwIfAborted();
        await advanceCandidate(client, identity, 'publishing', 'published');
        await client.query('INSERT INTO public.poc_artifacts(job_id, ref, published, metadata) VALUES ($1, $2, true, $3)', [claim.id, prepared.ref, prepared.metadata]);
        await saveSnapshot(client, claim.id, finished);
        await saveAttemptState(client, finished);
        const result = await settle(context, client, envelope, 'succeeded');
        await checkpoint('before_commit', { ...info, status: result.status, ref: prepared.ref });
        signal?.throwIfAborted();
        // The queue was locked and exactly acknowledged above; its deadline still
        // bounds publication even if a checkpoint consumed the remaining lease.
        const queue = await lockQueue(client, envelope.id);
        const commitNow = await databaseNow(client);
        signal?.throwIfAborted();
        if (!liveLease(snapshot, commitNow)) throw new ExpiredPublication('Lease expired before publication commit');
        if (queue.retry_count !== envelope.retryCount || queue.data?.jobId !== claim.id || queueDeadline(queue) <= Date.parse(commitNow)) throw new LostQueueClaim('Queue claim expired before publication');
        return result;
      });
    }
    await checkpoint('provider', { ...info, reused: claim.resultRef !== null });
    signal?.throwIfAborted();

    return await processingTransaction(async (client) => {
      const checked = await guard(context, client, envelope, claim, now);
      signal?.throwIfAborted();
      if (checked.result) return checked.result;
      const snapshot = checked.row.snapshot;
      const ref = snapshot.resultRef ?? `poc://artifact/${encodeURIComponent(claim.id)}/${claim.attemptCount}`;
      if (snapshot.resultRef !== null) {
        const artifact = (await client.query('SELECT * FROM public.poc_artifacts WHERE job_id = $1', [claim.id])).rows[0];
        if (!artifact || artifact.published || artifact.ref !== ref) throw new Error('Prepared artifact is missing');
      }
      const review = checked.row.review;
      const finished = review
        ? context.state.enterProcessingJobReview(snapshot, now(), ref)
        : context.state.completeProcessingJob(snapshot, now(), ref);
      await client.query(`INSERT INTO public.poc_artifacts(job_id, ref, published) VALUES ($1, $2, $3)
        ON CONFLICT (job_id) DO UPDATE SET ref = EXCLUDED.ref, published = EXCLUDED.published`, [claim.id, ref, !review]);
      await saveSnapshot(client, claim.id, finished);
      await saveAttemptState(client, finished);
      const result = await settle(context, client, envelope, review ? 'review' : 'succeeded');
      await checkpoint('before_commit', { ...info, status: result.status, ref });
      // The hook may have held this transaction beyond the lease. Its writes still
      // roll back together; the committed running state is recovered separately.
      signal?.throwIfAborted();
      if (!liveLease(snapshot, now.logical ? now() : await databaseNow(client))) throw new ExpiredPublication('Lease expired before publication commit');
      return result;
    });
  } catch (error) {
    if (error instanceof LostQueueClaim) return resultFor(envelope, 'duplicate');
    if (error instanceof ExpiredPublication) {
      try {
        return await processingTransaction(async (client) => {
          const checked = await guard(context, client, envelope, claim, now);
          if (checked.result) return checked.result;
          throw error;
        });
      } catch (recoveryError) {
        if (recoveryError instanceof LostQueueClaim) return resultFor(envelope, 'duplicate');
        throw recoveryError;
      }
    }
    throw error;
  }
}

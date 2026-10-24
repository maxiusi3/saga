import assert from 'node:assert/strict';
import { execFileSync, fork } from 'node:child_process';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import ts from 'typescript';
import { openPoc, installPoc, enqueueJob, approveJob, cancelJob, heartbeatJob, reconcileUnknownJob } from './store.mjs';

import { supervisionHeartbeat, supervisedDuration, supervisedCrash, supervisedCancellation, supervisedHardCap, supervisedRestartCap, supervisedDisconnect, heartbeatFences, heartbeatQueueLock, heartbeatRedelivery, supervisedBlockedShutdown, abortedDispatchLock, supervisedStoppedRunner, abortedPublicationClock, supervisedSignalDispatchLock, supervisedRunnerShutdownFailure } from './supervision-scenarios.mjs';
import { runMergeScenarios, setupMergeConfig } from './merge-scenarios.mjs';
import { runMergeFailureScenarios } from './merge-failure-scenarios.mjs';
import { runOutputCandidateScenarios } from './output-candidate-scenarios.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const cliArgs = process.argv.slice(2);
const evidencePath = resolve(cliArgs.find(arg => !arg.startsWith('--')) ?? join(root, `docs/research/evidence/2026-10-16-t05-local-runs/results-${Date.now()}-${process.pid}.json`));
const children = new Set();
const ownedGroups = new Set();
const ownedSupervisorPids = new Set();
const ownedWorkerPids = new Set();
const ownedRunnerPids = new Set();
const ownedDecoderPids = new Set();
const forcedGroupKills = new Set();
const cleanupAbort = new AbortController();
const pendingOperations = new Set();
const childLifecycles = new WeakMap();
// Never inherit database selection or connection options from the developer's shell.
const childEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PG') && key !== 'DATABASE_URL'));
const report = {
  startedAt: new Date().toISOString(),
  scope: 'isolated local PostgreSQL + pg-boss + synthetic provider ledger; no production access',
  runtime: { node: process.version },
  sources: {},
  scenarios: [],
  assertions: 0,
  limitations: [
    'Provider calls are durable simulated ledger entries, not paid API requests or actual billing evidence.',
    'Cross-day approval advances an explicit logical clock; it is not a 24-hour wall-clock soak test.',
    'Experimental tables are not the production schema, RLS, Storage, outbox deployment, or a migration proposal.',
    'Local asynchronous synthetic tasks and process supervision only; no real audio, provider cancellation/billing, production hosting, real-device recording, backup restore, or load qualification.',
  ],
};
let scratch;
let context;
let startedCluster = false;
let clusterMayHaveStarted = false;
let postmasterPid;
let observedFixture;
let cleanupPromise;
let configFile;

async function publishOwnership({ decoderPid, fixture } = {}) {
  if (decoderPid !== undefined) ownedDecoderPids.add(decoderPid);
  if (fixture !== undefined) observedFixture = fixture;
  const snapshot = { version: 1, harnessPid: process.pid, scratch, clusterMayHaveStarted, clusterStopped: !startedCluster, postmasterPid,
    groupIds: [...ownedGroups], decoderPids: [...ownedDecoderPids], fixture: observedFixture };
  report.resourceOwnership = snapshot;
  if (!process.connected) return;
  // This is an early ownership handoff to the exact parent observer, independent
  // of eventual exit status or whether the normal evidence file can be written.
  await bounded(new Promise(resolve => process.send({ type: 'harness_ownership', snapshot }, () => resolve())), 1_000, 'Ownership IPC timed out').catch(() => {});
}

function command(bin, args) {
  return execFileSync(bin, args, { encoding: 'utf8', env: childEnv, timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function equal(actual, expected, label) {
  assert.deepEqual(actual, expected, label);
  report.assertions += 1;
}
function ok(actual, label) {
  assert.ok(actual, label);
  report.assertions += 1;
}
async function scenario(name, fn) {
  const started = Date.now();
  const before = report.assertions;
  const details = await fn();
  report.scenarios.push({ name, status: 'passed', assertions: report.assertions - before, elapsedMs: Date.now() - started, ...details });
  console.log(`PASS ${name}`);
}
async function rows(sql, values = []) { return (await context.pool.query(sql, values)).rows; }
async function job(id) { return (await rows('SELECT * FROM poc_jobs WHERE id = $1', [id]))[0]; }
async function calls(id) { return Number((await rows('SELECT count(*) AS n FROM poc_calls WHERE job_id = $1', [id]))[0].n); }
async function artifacts(id) { return rows('SELECT * FROM poc_artifacts WHERE job_id = $1', [id]); }
async function envelopes(id) { return context.boss.findJobs('saga-poc', { data: { jobId: id } }); }

function trackChild(child, { group = false, kind = 'worker' } = {}) {
  if (group) {
    const register = () => {
      if (!child.pid) return;
      ownedGroups.add(child.pid);
      (kind === 'supervisor' ? ownedSupervisorPids : kind === 'runner' ? ownedRunnerPids : ownedWorkerPids).add(child.pid);
      void publishOwnership();
    };
    register();
    child.once('spawn', register);
  }
  const lifecycle = { terminal: false, spawnError: null };
  children.add(child);
  lifecycle.done = new Promise(accept => {
    function finish() {
      lifecycle.terminal = true;
      children.delete(child);
      accept();
    }
    child.once('exit', (code, signal) => {
      lifecycle.exitInfo = { code, signal };
      // Node can omit close after the parent explicitly disconnects fork IPC.
      // exit confirms OS-process termination; descendant groups are checked separately.
      finish();
    });
    child.once('close', finish);
    child.once('error', error => {
      lifecycle.spawnError = error;
      // Failed creation has no OS process to kill and need not emit exit.
      if (!child.pid) finish();
    });
  });
  childLifecycles.set(child, lifecycle);
  return lifecycle;
}

function trackOperation(promise) {
  pendingOperations.add(promise);
  promise.then(() => pendingOperations.delete(promise), () => pendingOperations.delete(promise));
  return promise;
}

function signalOwnedGroup(group, signal) {
  if (!ownedGroups.has(group)) throw new Error('Refusing to signal an unowned process group');
  try {
    process.kill(-group, signal);
    if (signal === 'SIGKILL') forcedGroupKills.add(group);
  } catch (error) {
    // A just-exited macOS group can briefly return EPERM while being reaped.
    // Keep checking existence; a persistent group is a cleanup failure.
    if (!['ESRCH', 'EPERM'].includes(error.code)) throw error;
  }
}

async function bounded(promise, milliseconds, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label)), milliseconds);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

async function terminateChild(child) {
  const lifecycle = childLifecycles.get(child);
  if (lifecycle.terminal) return;
  try {
    child.kill('SIGTERM');
    await bounded(lifecycle.done, 4_000, 'Owned process graceful stop timed out').catch(() => {
      if (ownedGroups.has(child.pid)) signalOwnedGroup(child.pid, 'SIGKILL');
      else child.kill('SIGKILL');
    });
    await bounded(lifecycle.done, 2_000, `Child termination not confirmed within 2s (pid ${child.pid ?? 'unassigned'})`);
  } catch (error) {
    // Let cleanup proceed to the owned database, while retaining this child in
    // the set so evidence truthfully records that termination was not confirmed.
    if (child.connected) child.disconnect();
    child.stdout?.destroy();
    child.stderr?.destroy();
    child.unref();
    throw error;
  }
}

function worker(workerId, pauseStage, nowISO, options = {}) {
  const jobId = options.jobId;
  const workerConfigFile = options.configFile ?? configFile;
  const forkOptions = { ...options };
  delete forkOptions.jobId;
  delete forkOptions.configFile;
  const child = fork(join(here, 'worker.mjs'), [workerConfigFile, workerId, ...(nowISO || jobId ? [nowISO ?? ''] : []), ...(jobId ? [jobId] : [])], {
    env: childEnv, silent: true, ...forkOptions, detached: true,
  });
  trackChild(child, { group: true, kind: 'worker' });
  const events = new EventEmitter();
  const messages = [];
  let output = '';
  let closed;
  let spawnError;
  child.stdout.on('data', data => { output = (output + data).slice(-8000); });
  child.stderr.on('data', data => { output = (output + data).slice(-8000); });
  child.on('error', error => { spawnError = error; events.emit('change'); });
  child.on('message', message => {
    messages.push(message);
    if (message.type === 'checkpoint' && message.stage !== pauseStage && child.connected) child.send({ type: 'continue' });
    events.emit('change');
  });
  child.on('close', (code, signal) => {
    closed = { code, signal };
    events.emit('change');
  });
  function waitFor(find) {
    return new Promise((accept, reject) => {
      const timer = setTimeout(() => finish(new Error(`Worker ${workerId} timed out: ${output}`)), 20_000);
      function finish(error, value) {
        clearTimeout(timer);
        events.off('change', inspect);
        if (error) reject(error); else accept(value);
      }
      function inspect() {
        const found = find();
        if (found) return finish(null, found);
        if (spawnError) return finish(spawnError);
        if (closed) finish(new Error(`Worker ${workerId} closed ${JSON.stringify(closed)}: ${output}`));
      }
      events.on('change', inspect);
      inspect();
    });
  }
  return {
    child, messages,
    checkpoint: () => waitFor(() => messages.find(item => item.type === 'checkpoint' && item.stage === pauseStage)),
    resume: () => child.send({ type: 'continue' }),
    heartbeat: async (leaseMs = 5_000, nowISO = new Date().toISOString()) => {
      child.send({ type: 'heartbeat', leaseMs, nowISO });
      return waitFor(() => messages.find(item => item.type === 'heartbeat_result'));
    },
    kill: async () => {
      child.kill('SIGKILL');
      const state = await waitFor(() => closed);
      equal(state.signal, 'SIGKILL', 'actual subprocess killed');
    },
    result: async () => {
      const message = await waitFor(() => messages.find(item => item.type === 'result'));
      const state = await waitFor(() => closed);
      equal(state, { code: 0, signal: null }, 'worker closed connections and exited cleanly');
      return message.result;
    },
    failure: async () => {
      const message = await waitFor(() => messages.find(item => item.type === 'error'));
      const state = await waitFor(() => closed);
      equal(state, { code: 1, signal: null }, 'failed worker closes its connections');
      return message.error;
    },
  };
}
function supervisor(options = {}, forkOptions = {}) {
  const child = fork(join(here, 'supervisor.mjs'), [configFile, JSON.stringify(options)], {
    env: childEnv, silent: true, ...forkOptions, detached: true,
  });
  const lifecycle = trackChild(child, { group: true, kind: 'supervisor' });
  const messages = [];
  let output = '';
  let closed;
  child.stdout?.on('data', data => { output = (output + data).slice(-8000); });
  child.stderr?.on('data', data => { output = (output + data).slice(-8000); });
  child.on('message', message => {
    messages.push({ ...message, receivedAt: Date.now() });
    if (message.type === 'runner_spawn' && message.pid) ownedRunnerPids.add(message.pid);
  });
  child.on('exit', (code, signal) => { closed = { code, signal }; });
  async function wait(find, timeoutMs = 20_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const found = messages.find(find);
      if (found) return found;
      if (lifecycle.spawnError) throw lifecycle.spawnError;
      if (closed) throw new Error(`Supervisor closed ${JSON.stringify(closed)}: ${output}`);
      await delay(20);
    }
    throw new Error(`Supervisor observation timed out: ${output}`);
  }
  return {
    child, messages, wait,
    killRunner: () => child.send({ type: 'fault', signal: 'SIGKILL' }),
    closed: async () => {
      try { await bounded(lifecycle.done, 10_000, 'Supervisor did not close'); }
      catch (error) { throw new Error(`${error.message}: exit=${JSON.stringify(lifecycle.exitInfo)} exists=${exists(child.pid)} messages=${JSON.stringify(messages.slice(-8))} output=${output}`); }
      return closed;
    },
    stop: async () => {
      if (!lifecycle.terminal) child.kill('SIGTERM');
      await bounded(lifecycle.done, 5_000, 'Supervisor did not stop');
      equal(closed, { code: 0, signal: null }, 'supervisor and runner stop cleanly');
    },
  };
}
async function runWorker(id, nowISO, jobId) { return worker(id, undefined, nowISO, { jobId }).result(); }
async function expireAndSupervise(id) {
  const started = Date.now();
  // Expiry is PostgreSQL wall time, not the review scenario's logical clock.
  const deadline = started + 12_000;
  while (Date.now() < deadline) {
    await context.boss.supervise('saga-poc');
    const queueJob = (await context.boss.findJobs('saga-poc', { id }))[0];
    if (queueJob?.state === 'retry') return { elapsedMs: Date.now() - started };
    await delay(250);
  }
  throw new Error(`Queue envelope ${id} did not expire/retry within 12s`);
}

async function dispatchContentionRegression() {
  await enqueueJob(context, 'dispatch-contention');
  const blocked = worker('dispatch-contention-worker', 'before_dispatch');
  await blocked.checkpoint();
  const blocker = await context.pool.connect();
  let leaseExpiry;
  try {
    await blocker.query('BEGIN');
    const locked = (await blocker.query('SELECT * FROM poc_jobs WHERE id = $1 FOR UPDATE', ['dispatch-contention'])).rows[0];
    equal(locked.snapshot.state, 'running', 'running committed before dispatch guard');
    leaseExpiry = Date.parse(locked.snapshot.leaseExpiresAt);
    blocked.resume();
    let waiting = false;
    const deadline = Date.now() + 1_500;
    while (!waiting && Date.now() < deadline) {
      waiting = (await rows(`SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock'
        AND query LIKE 'SELECT * FROM public.poc_jobs WHERE id = % FOR UPDATE'`)).length > 0;
      if (!waiting) await delay(20);
    }
    ok(waiting, 'dispatch guard is waiting on the held business row');
    ok(Date.now() < leaseExpiry, 'guard began waiting before real lease expiry');
    await delay(Math.max(0, leaseExpiry - Date.now()) + 200);
    await blocker.query('COMMIT');
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
  }
  equal((await blocked.result()).status, 'unknown', 'expired running work recovers unknown after lock acquisition');
  equal(await calls('dispatch-contention'), 0, 'no simulated dispatch after expiry during row-lock wait');
  equal(await artifacts('dispatch-contention'), [], 'expired dispatch created no artifact');
  equal((await job('dispatch-contention')).snapshot.state, 'outcome_unknown', 'unknown recovery persisted');
  return { contention: 'business row locked across real lease expiry before dispatch', providerCalls: 0 };
}

async function heartbeatRegression() {
  await enqueueJob(context, 'heartbeat-success', { expireInSeconds: 30, heartbeatSeconds: 10 });
  const first = worker('heartbeat-owner', 'provider');
  await first.checkpoint();
  const before = (await job('heartbeat-success')).snapshot.leaseExpiresAt;
  const beat = await first.heartbeat(5_000);
  equal(beat.ok, true, 'running owner can heartbeat');
  ok(Date.parse(beat.snapshot.leaseExpiresAt) > Date.parse(before), 'heartbeat extends lease');
  await context.boss.supervise('saga-poc');
  equal((await job('heartbeat-success')).snapshot.state, 'running', 'supervisor preserves heartbeated attempt');
  first.resume();
  equal((await first.result()).status, 'succeeded', 'same attempt completes exactly once');
  equal(await calls('heartbeat-success'), 1, 'heartbeated task has one provider call');

  for (const [name, mutate, expected] of [
    ['stale owner', { workerId: 'other' }, /Stale worker/],
    ['stale attempt', { attempt: 999 }, /Stale worker/],
    ['expired lease', { expire: true }, /expired/],
  ]) {
    await enqueueJob(context, `heartbeat-${name.replaceAll(' ', '-')}`);
    const jobId = `heartbeat-${name.replaceAll(' ', '-')}`;
    const held = worker(`heartbeat-${name}`, 'provider');
    const { info } = await held.checkpoint();
    const snap = (await job(jobId)).snapshot;
    if (mutate.expire) {
      await context.pool.query(`UPDATE poc_jobs SET snapshot = jsonb_set(snapshot, '{leaseExpiresAt}', to_jsonb($2::text)) WHERE id = $1`, [jobId, new Date(Date.now() - 1_000).toISOString()]);
    }
    await assert.rejects(heartbeatJob(context, jobId, {
      ...info, workerId: mutate.workerId ?? snap.leaseOwner, attempt: mutate.attempt ?? snap.attemptCount,
      nowISO: mutate.nowISO ?? new Date().toISOString(), leaseMs: 1_000,
    }), expected, `${name} heartbeat rejected`);
    await held.kill();
    await expireAndSupervise((await envelopes(jobId))[0].id);
    equal((await runWorker(`heartbeat-${name}-cleanup`)).status, 'unknown', `${name} cleanup quarantines killed task`);
  }

  await enqueueJob(context, 'heartbeat-cancelled');
  const cancelled = worker('heartbeat-cancelled-worker', 'provider');
  const { info: cancelledInfo } = await cancelled.checkpoint();
  const cancelledSnap = (await job('heartbeat-cancelled')).snapshot;
  await cancelJob(context, 'heartbeat-cancelled', new Date().toISOString());
  await assert.rejects(heartbeatJob(context, 'heartbeat-cancelled', {
    ...cancelledInfo, workerId: cancelledSnap.leaseOwner, attempt: cancelledSnap.attemptCount,
    nowISO: new Date().toISOString(), leaseMs: 1_000,
  }), /cancelled|revoked/);
  await cancelled.kill();
  await expireAndSupervise((await envelopes('heartbeat-cancelled'))[0].id);
  equal((await runWorker('heartbeat-cancelled-cleanup')).status, 'cancelled', 'cancelled cleanup settles queue');
}

async function unknownReconciliationRegression() {
  await enqueueJob(context, 'unknown-reconcile');
  const doomed = worker('unknown-reconcile-worker', 'provider');
  await doomed.checkpoint();
  equal(await calls('unknown-reconcile'), 1, 'provider call is recorded once');
  await doomed.kill();
  await expireAndSupervise((await envelopes('unknown-reconcile'))[0].id);
  await context.pool.query(`UPDATE poc_jobs SET snapshot = jsonb_set(jsonb_set(jsonb_set(snapshot, '{state}', '"outcome_unknown"'), '{leaseOwner}', 'null'), '{leaseExpiresAt}', 'null'), revision = revision + 1 WHERE id = $1`, ['unknown-reconcile']);
  equal((await runWorker('unknown-reconcile-recovery')).status, 'unknown', 'recovery quarantines unknown outcome');
  const unknown = (await job('unknown-reconcile')).snapshot;
  equal(unknown.state, 'outcome_unknown', 'unknown state is durable before reconciliation');
  const kept = await reconcileUnknownJob(context, 'unknown-reconcile', { decision: 'keep_unknown', revision: Number((await job('unknown-reconcile')).revision) });
  equal(kept.state, 'outcome_unknown', 'keep_unknown leaves quarantine intact');
  await assert.rejects(reconcileUnknownJob(context, 'unknown-reconcile', { decision: 'controlled_retry', revision: Number((await job('unknown-reconcile')).revision) }), /approval/);
  const retryRevision = Number((await job('unknown-reconcile')).revision);
  const retried = await reconcileUnknownJob(context, 'unknown-reconcile', { decision: 'controlled_retry', revision: retryRevision, approvedBy: 'human', approvalRef: 'ticket-1' });
  equal(retried.state, 'retry_wait', 'approved controlled retry enters retry_wait');
  await assert.rejects(reconcileUnknownJob(context, 'unknown-reconcile', { decision: 'controlled_retry', revision: Number((await job('unknown-reconcile')).revision), approvedBy: 'human', approvalRef: 'ticket-2' }), /unknown|revision|authorization/);
  await assert.rejects(reconcileUnknownJob(context, 'unknown-reconcile', { decision: 'reuse_prepared', revision: Number((await job('unknown-reconcile')).revision) }), /artifact|outcome_unknown/);
}

async function unknownReuseRegression() {
  await enqueueJob(context, 'unknown-reuse');
  await context.pool.query(`UPDATE poc_jobs SET snapshot = jsonb_set(jsonb_set(snapshot, '{state}', '"outcome_unknown"'), '{resultRef}', '"poc://prepared/unknown-reuse"'), revision = revision + 1 WHERE id = $1`, ['unknown-reuse']);
  await context.pool.query(`INSERT INTO poc_attempts(job_id, attempt, worker_id, state) VALUES ('unknown-reuse', 1, 'seed', 'outcome_unknown')`);
  await context.pool.query(`INSERT INTO poc_artifacts(job_id, ref, published) VALUES ('unknown-reuse', 'poc://prepared/unknown-reuse', false)`);
  const beforeCalls = await calls('unknown-reuse');
  const revised = Number((await job('unknown-reuse')).revision);
  const reconciled = await reconcileUnknownJob(context, 'unknown-reuse', { decision: 'reuse_prepared', revision: revised });
  equal(reconciled.state, 'succeeded', 'matching prepared unknown result succeeds');
  equal((await artifacts('unknown-reuse')).map(row => row.published), [true], 'reuse publishes the prepared artifact atomically');
  equal(await calls('unknown-reuse'), beforeCalls, 'reuse does not call provider again');
}

async function cancelledUnknownReconciliationRegression() {
  await enqueueJob(context, 'unknown-revoked');
  await context.pool.query(`UPDATE poc_jobs SET snapshot = jsonb_set(snapshot, '{state}', '"outcome_unknown"'), revision = revision + 1 WHERE id = $1`, ['unknown-revoked']);
  await context.pool.query(`INSERT INTO poc_attempts(job_id, attempt, worker_id, state) VALUES ('unknown-revoked', 1, 'seed', 'outcome_unknown')`);
  await cancelJob(context, 'unknown-revoked', new Date().toISOString());
  for (const decision of ['keep_unknown', 'reuse_prepared', 'controlled_retry']) {
    const row = await job('unknown-revoked');
    await assert.rejects(reconcileUnknownJob(context, 'unknown-revoked', {
      decision, revision: Number(row.revision), approvedBy: 'human', approvalRef: 'ticket-revoked',
    }), /cancelled|revoked/);
    report.assertions += 1;
  }
}

async function controlledRetryCompletionRegression() {
  await enqueueJob(context, 'unknown-retry');
  const [initialEnvelope] = await context.boss.fetch('saga-poc', { includeMetadata: true });
  const completedSeed = await context.boss.complete('saga-poc', { id: initialEnvelope.id, retryCount: initialEnvelope.retryCount }, { status: 'seed' });
  equal(completedSeed.affected, 1, 'seed queue envelope is acknowledged');
  await context.pool.query(`UPDATE poc_jobs SET snapshot = jsonb_set(snapshot, '{state}', '"outcome_unknown"'), revision = revision + 1 WHERE id = $1`, ['unknown-retry']);
  await context.pool.query(`INSERT INTO poc_attempts(job_id, attempt, worker_id, state) VALUES ('unknown-retry', 0, 'seed', 'outcome_unknown')`);
  const before = await job('unknown-retry');
  const retried = await reconcileUnknownJob(context, 'unknown-retry', {
    decision: 'controlled_retry', revision: Number(before.revision), approvedBy: 'human', approvalRef: 'ticket-retry',
  });
  equal(retried.state, 'retry_wait', 'controlled retry enters retry_wait');
  equal(retried.attemptCount, before.snapshot.attemptCount, 'controlled retry does not increment attempt');
  equal((await job('unknown-retry')).allowed, true, 'controlled retry remains allowed');
  equal((await job('unknown-retry')).snapshot.state, 'retry_wait', 'controlled retry state is claimable');
  const pending = await envelopes('unknown-retry');
  for (const stale of pending.slice(0, -1)) {
    const claim = await context.boss.fetch('saga-poc', { includeMetadata: true });
    if (claim[0]) await context.boss.complete('saga-poc', { id: claim[0].id, retryCount: claim[0].retryCount }, { status: 'stale-seed' });
  }
  const retryResult = await runWorker('controlled-retry-worker', new Date().toISOString(), 'unknown-retry');
  const finalResult = retryResult.status === 'duplicate' ? await runWorker('controlled-retry-worker-2') : retryResult;
  equal(finalResult.status, 'succeeded', 'due retry completes through worker');
  const finished = await job('unknown-retry');
  equal(finished.snapshot.attemptCount, before.snapshot.attemptCount + 1, 'claim increments attempt exactly once');
  equal(await calls('unknown-retry'), 1, 'controlled retry makes one new provider call');
}

async function heartbeatContentionRegression() {
  for (let i = 0; i < 20; i += 1) {
    if ((await runWorker('heartbeat-contention-drain')).status === 'empty') break;
  }
  await enqueueJob(context, 'heartbeat-contention');
  const held = worker('heartbeat-contention-worker', 'provider');
  const { info } = await held.checkpoint();
  const blocker = await context.pool.connect();
  let heartbeat;
  try {
    await blocker.query('BEGIN');
    const locked = (await blocker.query('SELECT * FROM poc_jobs WHERE id = $1 FOR UPDATE', ['heartbeat-contention'])).rows[0];
    const snap = locked.snapshot;
    const leaseExpiry = Date.parse(snap.leaseExpiresAt);
    heartbeat = heartbeatJob(context, 'heartbeat-contention', {
      ...info, workerId: snap.leaseOwner, attempt: snap.attemptCount, leaseMs: 5_000,
    });
    let waiting = false;
    const waitDeadline = Date.now() + 1_500;
    while (!waiting && Date.now() < waitDeadline) {
      waiting = (await rows(`SELECT 1 FROM pg_stat_activity
        WHERE wait_event_type = 'Lock' AND query LIKE 'SELECT * FROM public.poc_jobs WHERE id = % FOR UPDATE'`)).length > 0;
      if (!waiting) await delay(10);
    }
    ok(waiting, 'heartbeat transaction is visibly waiting on the held row lock before blocker commit');
    await delay(Math.max(0, leaseExpiry - Date.now()) + 200);
    await blocker.query('COMMIT');
  } finally {
    await blocker.query('ROLLBACK').catch(() => {});
    blocker.release();
  }
  await assert.rejects(heartbeat, /expired/, 'heartbeat checks expiry after waiting for row lock');
  report.assertions += 1;
  held.resume();
  equal((await held.result()).status, 'unknown', 'expired contention job is quarantined');
}

async function failedForkCleanupRegression() {
  // This must be the last scenario: it exercises the same cleanup used by
  // finally and signals, on the harness's only owned database cluster.
  const owned = supervisor({ durationMs: 30_000 });
  await owned.wait(message => message.type === 'ready');
  const runnerPid = owned.messages.find(message => message.type === 'runner_spawn').pid;
  ok(exists(runnerPid), 'cleanup fixture has an actual owned descendant');
  let creationError;
  try {
    await worker('unspawnable-worker', undefined, undefined, { execPath: join(scratch, 'missing-node') }).result();
  } catch (error) {
    creationError = error;
  }
  equal(creationError?.code, 'ENOENT', 'worker creation fails with the injected unavailable executable');
  await assert.rejects(supervisor({}, { execPath: join(scratch, 'missing-node') }).wait(() => false), { code: 'ENOENT' });
  report.assertions += 1;
  const started = Date.now();
  await bounded(cleanup(), 15_000, 'Failed-worker creation cleanup did not complete within 15s');
  const cleanupElapsedMs = Date.now() - started;
  ok(cleanupElapsedMs < 15_000, 'failed-fork cleanup returns within its deadline');
  equal(children.size, 0, 'failed creation has no remaining child');
  ok(!exists(runnerPid), 'fork failure cleanup stops supervisor-owned runner');
  equal(report.cleanup.clusterStopped, true, 'failed fork still stops the existing owned cluster');
  equal(report.cleanup.tempDirectoryRemoved, true, 'failed fork still removes the owned temporary directory');
  equal(report.cleanup.errors, [], 'failure cleanup itself completed');
  ok(await access(scratch).then(() => false, () => true), 'owned scratch directory is absent');
  await cleanup();
  equal(report.cleanup, { ownedChildrenRemaining: 0, clusterStopped: true, tempDirectoryRemoved: true, errors: [] },
    'repeated cleanup is idempotent and preserves complete cleanup evidence');
  return {
    injection: 'worker fork execPath unavailable; expected ENOENT caught',
    ownership: 'one harness-owned cluster; no nested database owner',
    cleanupElapsedMs, cleanup: report.cleanup,
  };
}

function exists(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; if (error.code === 'EPERM') return true; throw error; }
}

async function cleanupGroups() {
  for (const group of ownedGroups) {
    // Every decoding Worker/runner and supervisor is a detached group leader.
    // The ownership handle survives the owner's exit and tracks orphan decoders.
    if (!exists(-group)) continue;
    signalOwnedGroup(group, 'SIGTERM');
    const deadline = Date.now() + 3_000;
    while (exists(-group) && Date.now() < deadline) await delay(25);
    if (exists(-group)) {
      signalOwnedGroup(group, 'SIGKILL');
      const killDeadline = Date.now() + 2_000;
      while (exists(-group) && Date.now() < killDeadline) await delay(25);
    }
  }
  const remainingGroups = [...ownedGroups].filter(group => exists(-group));
  const remainingRunnerPids = [...ownedRunnerPids].filter(exists);
  report.processOwnership = { supervisorPids: [...ownedSupervisorPids], workerPids: [...ownedWorkerPids], runnerPids: [...ownedRunnerPids],
    groupIds: [...ownedGroups], forcedGroupKills: [...forcedGroupKills], remainingGroups, remainingRunnerPids, directOperationsRemaining: pendingOperations.size };
  if (remainingGroups.length || remainingRunnerPids.length) throw new Error('Owned process descendants remain');
}

async function cleanup() {
  if (cleanupPromise) return cleanupPromise;
  cleanupPromise = (async () => {
    const errors = [];
    cleanupAbort.abort(new Error('Harness cleanup'));
    try { await bounded(Promise.allSettled([...pendingOperations]), 3_000, 'Direct merge operations did not stop within 3s'); }
    catch (error) { errors.push(error.message); }
    const terminated = await Promise.allSettled([...children].map(terminateChild));
    for (const result of terminated) {
      if (result.status === 'rejected') errors.push(`Could not stop owned child: ${result.reason.message}`);
    }
    try { await cleanupGroups(); } catch (error) { errors.push(error.message); }
    if (context) {
      try { await bounded(context.close(), 3_000, 'Database clients did not close within 3s'); }
      catch (error) { errors.push(error.message); }
    }
    if (scratch && startedCluster) {
      try {
        command('pg_ctl', ['-D', join(scratch, 'data'), '-m', 'immediate', '-w', '-t', '10', 'stop']);
        startedCluster = false;
      } catch (error) { errors.push(`Could not stop owned cluster: ${error.message}`); }
    }
    let removed = false;
    if (scratch && !startedCluster) {
      try {
        await rm(scratch, { recursive: true, force: true });
        removed = await access(scratch).then(() => false, () => true);
      } catch (error) { errors.push(`Could not remove owned scratch directory: ${error.message}`); }
    }
    report.cleanup = { ownedChildrenRemaining: children.size, clusterStopped: !startedCluster, tempDirectoryRemoved: removed, errors };
    await publishOwnership();
    if (errors.length || startedCluster || children.size) throw new Error(`Cleanup incomplete: ${JSON.stringify(report.cleanup)}`);
  })();
  return cleanupPromise;
}

// Signals and unexpected harness failures share the same bounded ownership
// cleanup. A failing test promise must never bypass the owned-cluster teardown.
let emergencyPromise;
function emergencyExit(code, { signal, error } = {}) {
  if (emergencyPromise) return emergencyPromise;
  emergencyPromise = (async () => {
    if (signal) report.signal = signal;
    report.status = error ? 'failed' : 'interrupted';
    if (error) report.error = error.stack ?? String(error);
    try { await cleanup(); }
    catch (cleanupError) { report.status = 'failed'; report.cleanupError = cleanupError.message; }
    report.finishedAt = new Date().toISOString();
    await mkdir(dirname(evidencePath), { recursive: true });
    await writeFile(evidencePath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`${report.status}: harness ${signal ?? 'unexpected failure'}; cleanup ${JSON.stringify(report.cleanup)}`);
    process.exit(code);
  })().catch(error => { console.error(error); process.exit(1); });
  return emergencyPromise;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => emergencyExit(signal === 'SIGINT' ? 130 : 143, { signal }));
process.once('unhandledRejection', error => emergencyExit(1, { error }));
process.once('uncaughtException', error => emergencyExit(1, { error }));
process.once('disconnect', () => emergencyExit(1, { error: new Error('Harness observer disconnected') }));

try {
  report.runtime.postgres = command('postgres', ['--version']);
  report.runtime.pgBoss = JSON.parse(await readFile(join(here, 'node_modules/pg-boss/package.json'), 'utf8')).version;
  report.runtime.pg = JSON.parse(await readFile(join(here, 'node_modules/pg/package.json'), 'utf8')).version;
  for (const file of ['package-lock.json', 'store.mjs', 'worker.mjs', 'verify.mjs', 'runner.mjs', 'supervisor.mjs', 'supervision-scenarios.mjs', 'README.md', 'local-recording-merge.mjs', 'merge-scenarios.mjs', 'merge-failure-scenarios.mjs', 'verify-merge-cleanup.mjs', 'output-candidate-scenarios.mjs', 'recording-output-candidates.mjs']) {
    report.sources[`experiments/t05-durable-worker/${file}`] = createHash('sha256').update(await readFile(join(here, file))).digest('hex');
  }
  const statePath = 'packages/web/src/lib/server/processing-jobs.ts';
  const source = await readFile(join(root, statePath), 'utf8');
  report.sources[statePath] = createHash('sha256').update(source).digest('hex');
  scratch = await mkdtemp('/tmp/saga-t05-');
  await publishOwnership();
  await mkdir(join(scratch, 'socket'), { mode: 0o700 });
  await writeFile(join(scratch, 'state.mjs'), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText);
  command('initdb', ['-D', join(scratch, 'data'), '-U', 'saga_poc', '-A', 'trust', '--no-locale', '-E', 'UTF8']);
  // Mark before startup so a timeout after daemon launch still enters cleanup.
  startedCluster = true;
  clusterMayHaveStarted = true;
  await publishOwnership();
  command('pg_ctl', ['-D', join(scratch, 'data'), '-l', join(scratch, 'postgres.log'), '-w', '-t', '20',
    '-o', `-k ${join(scratch, 'socket')} -p 5432 -c listen_addresses='' -c unix_socket_permissions=0700`, 'start']);
  postmasterPid = Number((await readFile(join(scratch, 'data/postmaster.pid'), 'utf8')).split('\n')[0]);
  await publishOwnership();
  const config = { host: join(scratch, 'socket'), port: 5432, user: 'saga_poc', database: 'postgres', stateModule: join(scratch, 'state.mjs') };
  if (cliArgs.includes('--only-merge') || cliArgs.includes('--only-merge-failures') || cliArgs.includes('--only-output-candidates')) config.recording = await setupMergeConfig({ scratch, root, report, command });
  configFile = join(scratch, 'config.json');
  await writeFile(configFile, JSON.stringify(config), { mode: 0o600 });
  context = await openPoc(config);
  await installPoc(context);

  const supervision = { context, supervisor, worker, equal, ok, job, calls, artifacts, envelopes, cancelJob, scratch, exists, cleanupGroups, report, rows, expireAndSupervise, runWorker };
  const newScenarios = async () => {
    await scenario('transaction heartbeat fences and rollback', () => heartbeatFences(supervision));
    await scenario('heartbeat queue lock wait samples both locks', () => heartbeatQueueLock(supervision));
    await scenario('stale heartbeat cannot refresh redelivered attempt', () => heartbeatRedelivery(supervision));
    await scenario('transaction heartbeat preserves actual queue claim', () => supervisionHeartbeat(supervision));
    await scenario('automatic 20s asynchronous synthetic task', () => supervisedDuration(supervision));
    for (const stage of ['leased', 'provider']) await scenario(`automatic recovery after ${stage} SIGKILL`, () => supervisedCrash(supervision, stage));
    await scenario('automatic heartbeat stops revoked synthetic work', () => supervisedCancellation(supervision));
    await scenario('queue hard cap bounds automatic heartbeats', () => supervisedHardCap(supervision));
    await scenario('three bounded restarts then nonzero exit', () => supervisedRestartCap(supervision));
    await scenario('runner creation failure is bounded and cleaned', () => supervisedRestartCap(supervision, true));
    await scenario('maintenance lock cannot hang supervisor shutdown', () => supervisedBlockedShutdown(supervision));
    await scenario('abort while dispatch guard awaits lock', () => abortedDispatchLock(supervision));
    await scenario('abort after final clock rolls publication back', () => abortedPublicationClock(supervision));
    await scenario('SIGTERM while dispatch guard awaits lock', () => supervisedSignalDispatchLock(supervision));
    await scenario('forced runner stop is nonzero', () => supervisedStoppedRunner(supervision));
    for (const kind of ['external-kill', 'exit1']) await scenario(`runner shutdown outcome ${kind}`, () => supervisedRunnerShutdownFailure(supervision, kind));
    await scenario('IPC disconnect stops owned runner', () => supervisedDisconnect(supervision));
    await scenario('killed supervisor cannot leak owned runner', () => supervisedDisconnect(supervision, true));
  };
  if (cliArgs.includes('--only-merge') || cliArgs.includes('--only-merge-failures') || cliArgs.includes('--only-output-candidates')) {
    await (cliArgs.includes('--only-output-candidates') ? runOutputCandidateScenarios : cliArgs.includes('--only-merge-failures') ? runMergeFailureScenarios : runMergeScenarios)({ context, config, configFile, childEnv, trackChild, trackOperation, publishOwnership, cleanupSignal: cleanupAbort.signal, bounded, equal, ok, scenario, report, root, here, scratch, command, worker, runWorker, supervisor, job, calls, artifacts, envelopes, rows, expireAndSupervise, exists,
      outputCase: cliArgs.find(arg => arg.startsWith('--output-case='))?.split('=')[1],
      failureCase: cliArgs.find(arg => arg.startsWith('--failure-case='))?.split('=')[1],
      cleanupFault: cliArgs.find(arg => arg.startsWith('--merge-cleanup-fault='))?.split('=')[1],
      cleanupOwner: cliArgs.find(arg => arg.startsWith('--merge-cleanup-owner='))?.split('=')[1] });
    report.status = 'passed';
  } else if (cliArgs.includes('--only-supervision-shutdown-outcome')) {
    for (const kind of ['external-kill', 'exit1']) await scenario(`runner shutdown outcome ${kind}`, () => supervisedRunnerShutdownFailure(supervision, kind));
    report.status = 'passed';
  } else if (cliArgs.includes('--only-supervision-fatal-cleanup')) {
    const owned = supervisor();
    await owned.wait(message => message.type === 'ready');
    report.fatalFixture = { supervisorPid: owned.child.pid, runnerPid: owned.messages.find(message => message.type === 'runner_spawn').pid };
    void Promise.reject(new Error('injected unhandled harness test failure'));
    await new Promise(() => {});
  } else if (cliArgs.includes('--only-supervision-signal-dispatch')) {
    await scenario('SIGTERM while dispatch guard awaits lock', () => supervisedSignalDispatchLock(supervision));
    report.status = 'passed';
  } else if (cliArgs.includes('--only-supervision-abort-publication')) {
    await scenario('abort after final clock rolls publication back', () => abortedPublicationClock(supervision));
    report.status = 'passed';
  } else if (cliArgs.includes('--only-supervision-abort-dispatch')) {
    await scenario('abort while dispatch guard awaits lock', () => abortedDispatchLock(supervision));
    report.status = 'passed';
  } else if (cliArgs.includes('--only-supervision-stopped-runner')) {
    await scenario('forced runner stop is nonzero', () => supervisedStoppedRunner(supervision));
    report.status = 'passed';
  } else if (cliArgs.includes('--only-supervision-blocked-shutdown')) {
    await scenario('maintenance lock cannot hang supervisor shutdown', () => supervisedBlockedShutdown(supervision));
    report.status = 'passed';
  } else if (cliArgs.includes('--only-supervision-disconnect')) {
    await scenario('IPC disconnect stops owned runner', () => supervisedDisconnect(supervision));
    report.status = 'passed';
  } else if (cliArgs.includes('--only-supervision-signal')) {
    await enqueueJob(context, 'supervision-signal', { expireInSeconds: 30, heartbeatSeconds: 10 });
    const owned = supervisor({ durationMs: 20_000 });
    await owned.wait(message => message.type === 'heartbeat');
    report.signalFixture = { supervisorPid: owned.child.pid, runnerPid: owned.messages.find(message => message.type === 'runner_spawn').pid, providerCalls: await calls('supervision-signal') };
    process.kill(process.pid, cliArgs.includes('--signal=SIGINT') ? 'SIGINT' : 'SIGTERM');
    await new Promise(() => {});
  } else if (cliArgs.includes('--only-supervision')) {
    await newScenarios();
    report.status = 'passed';
  } else if (cliArgs.includes('--only-supervision-duration') || cliArgs.includes('--only-supervision-soak')) {
    await scenario('automatic supervised duration', () => supervisedDuration({ context, supervisor, equal, ok, job, calls, artifacts, envelopes }, cliArgs.includes('--only-supervision-soak') ? 300_000 : 20_000));
    report.status = 'passed';
  } else if (cliArgs.includes('--only-supervision-heartbeat')) {
    await scenario('transaction heartbeat preserves actual queue claim', () => supervisionHeartbeat({ context, worker, job, envelopes, equal, ok, report }));
    report.status = 'passed';
  } else if (cliArgs.includes('--only-dispatch-contention')) {
    await scenario('row-lock wait cannot dispatch after lease expiry', dispatchContentionRegression);
    report.status = 'passed';
  } else if (cliArgs.includes('--only-fork-cleanup')) {
    await scenario('failed worker fork cleans the existing owned cluster', failedForkCleanupRegression);
    report.status = 'passed';
  } else {

  await scenario('heartbeat success and stale fencing', heartbeatRegression);
  await scenario('unknown result reconciliation is fail-closed', unknownReconciliationRegression);
  await scenario('unknown prepared artifact is reused without provider call', unknownReuseRegression);
  await scenario('cancelled unknown reconciliation is rejected', cancelledUnknownReconciliationRegression);
  await scenario('controlled retry claims once and completes', controlledRetryCompletionRegression);
  await scenario('heartbeat lock contention checks expiry after lock', heartbeatContentionRegression);

  await scenario('socket-only isolated database', async () => {
    equal((await rows('SHOW listen_addresses'))[0].listen_addresses, '', 'TCP disabled');
    equal((await rows('SELECT current_user AS name'))[0].name, 'saga_poc', 'dedicated local role');
    for (const host of ['localhost', '127.0.0.1', 'db.example.invalid']) {
      await assert.rejects(openPoc({ ...config, host }));
      report.assertions += 1;
    }
  });
  await scenario('atomic business and queue creation', async () => {
    const rolledBack = await enqueueJob(context, 'rollback', { rollback: true });
    ok(rolledBack, 'enqueue ran inside rolled-back transaction');
    equal(await job('rollback'), undefined, 'business row rolled back');
    equal(await envelopes('rollback'), [], 'queue row rolled back');
    const first = await enqueueJob(context, 'atomic');
    ok(first, 'committed queue ID');
    equal(await enqueueJob(context, 'atomic'), null, 'duplicate business creation returns no new queue ID');
    equal((await envelopes('atomic')).length, 1, 'only one committed envelope');
    equal((await runWorker('atomic-worker')).status, 'succeeded', 'committed job processes');
    equal((await job('atomic')).snapshot.state, 'succeeded', 'success durable');
    equal(await calls('atomic'), 1, 'one simulated call');
    equal((await artifacts('atomic')).map(a => a.published), [true], 'one published artifact');
    equal((await envelopes('atomic')).map(a => a.state), ['completed'], 'queue acknowledgment durable with success');
  });
  await scenario('concurrent duplicate envelopes', async () => {
    await enqueueJob(context, 'duplicate');
    const first = worker('duplicate-owner', 'leased');
    await first.checkpoint();
    await context.boss.send('saga-poc', { jobId: 'duplicate' });
    equal((await runWorker('duplicate-other')).status, 'duplicate', 'active lease refuses second worker');
    equal((await job('duplicate')).snapshot.leaseOwner, 'duplicate-owner', 'duplicate leaves owner intact');
    equal(await calls('duplicate'), 0, 'duplicate cannot dispatch');
    first.resume();
    equal((await first.result()).status, 'succeeded', 'original owner completes');
    await context.boss.send('saga-poc', { jobId: 'duplicate' });
    equal((await runWorker('duplicate-terminal')).status, 'duplicate', 'terminal message cannot dispatch');
    equal(await calls('duplicate'), 1, 'exactly one simulated provider call');
    equal((await artifacts('duplicate')).map(a => a.published), [true], 'one artifact');
    equal((await rows('SELECT count(*) AS n FROM poc_attempts WHERE job_id = $1', ['duplicate']))[0].n, '1', 'one business attempt');
  });
  for (const stage of ['leased', 'provider', 'before_commit']) {
    await scenario(`SIGKILL at ${stage}`, async () => {
      const id = `kill-${stage}`;
      const queueId = await enqueueJob(context, id);
      const doomed = worker(`doomed-${stage}`, stage);
      await doomed.checkpoint();
      const leasedEnvelope = (await envelopes(id))[0];
      ok(Date.parse((await job(id)).snapshot.leaseExpiresAt) <= new Date(leasedEnvelope.startedOn).getTime() + leasedEnvelope.expireInSeconds * 1000,
        'business lease does not outlive queue claim');
      if (stage === 'before_commit') {
        equal((await job(id)).snapshot.state, 'running', 'uncommitted success not visible to another connection');
        equal(await artifacts(id), [], 'uncommitted artifact invisible');
        equal((await envelopes(id))[0].state, 'active', 'uncommitted queue acknowledgment invisible');
      }
      await doomed.kill();
      equal((await job(id)).snapshot.state, stage === 'leased' ? 'leased' : 'running', 'last committed state survives death');
      equal(await artifacts(id), [], 'process death leaves no committed artifact');
      const expired = await expireAndSupervise(queueId);
      const expected = stage === 'leased' ? 'succeeded' : 'unknown';
      equal((await runWorker(`replacement-${stage}`)).status, expected, 'replacement follows dispatch-aware recovery');
      equal((await job(id)).snapshot.state, stage === 'leased' ? 'succeeded' : 'outcome_unknown', 'recovery state persisted');
      equal(await calls(id), 1, 'recovery never duplicates a prior provider dispatch');
      equal((await artifacts(id)).map(a => a.published), stage === 'leased' ? [true] : [], 'only safe result published');
      if (stage !== 'leased') {
        await context.boss.send('saga-poc', { jobId: id });
        equal((await runWorker(`repeat-${stage}`)).status, 'unknown', 'unknown result stays quarantined on extra delivery');
        equal(await calls(id), 1, 'unknown result not automatically charged twice');
      }
      return { expiryWaitMs: expired.elapsedMs, fault: 'SIGKILL', provider: 'synthetic ledger' };
    });
  }
  await scenario('stale live worker after replacement cannot publish', async () => {
    const queueId = await enqueueJob(context, 'stale-owner');
    const stale = worker('stale-owner-first', 'leased');
    await stale.checkpoint();
    await expireAndSupervise(queueId);
    equal((await runWorker('stale-owner-replacement')).status, 'succeeded', 'replacement completes expired pre-dispatch work');
    stale.resume();
    equal((await stale.result()).status, 'duplicate', 'stale live owner is fenced out');
    equal(await calls('stale-owner'), 1, 'stale owner cannot dispatch');
    equal((await artifacts('stale-owner')).map(a => a.published), [true], 'one replacement result');
    equal((await job('stale-owner')).snapshot.attemptCount, 2, 'retry budget records both leases');
  });
  await scenario('lease expiry inside uncommitted publication rolls back', async () => {
    await enqueueJob(context, 'expired-commit');
    const late = worker('expired-commit-worker', 'before_commit');
    await late.checkpoint();
    // Do not supervise while this transaction holds the queue row lock.
    await delay(5_200);
    late.resume();
    equal((await late.result()).status, 'unknown', 'expired publication rolls back and recovers unknown outcome');
    equal(await artifacts('expired-commit'), [], 'expired transaction left no artifact');
    equal((await job('expired-commit')).snapshot.state, 'outcome_unknown', 'unknown durable');
    equal((await envelopes('expired-commit')).map(a => a.state), ['completed'], 'recovery settles envelope only after rollback');
    await context.boss.send('saga-poc', { jobId: 'expired-commit' });
    equal((await runWorker('expired-commit-replacement')).status, 'unknown', 'additional delivery preserves unknown outcome');
    equal(await calls('expired-commit'), 1, 'expired publication never redispatches');
  });
  await scenario('queue attempt acknowledgment fencing', async () => {
    const id = await context.boss.send('saga-poc', { jobId: 'queue-fence-only' });
    const [old] = await context.boss.fetch('saga-poc', { includeMetadata: true });
    equal(old.id, id, 'old claim fetched');
    await expireAndSupervise(id);
    const [fresh] = await context.boss.fetch('saga-poc', { includeMetadata: true });
    equal(fresh.id, old.id, 'same envelope retried');
    ok(fresh.retryCount > old.retryCount, 'attempt fence advances');
    await context.boss.complete('saga-poc', { id: old.id, retryCount: old.retryCount });
    equal((await context.boss.findJobs('saga-poc', { id }))[0].state, 'active', 'stale attempt cannot acknowledge new claim');
    await context.boss.complete('saga-poc', { id: fresh.id, retryCount: fresh.retryCount });
    equal((await context.boss.findJobs('saga-poc', { id }))[0].state, 'completed', 'current attempt acknowledgment succeeds');
  });
  await scenario('cross-day review releases lease and reuses prepared result', async () => {
    const today = new Date().toISOString();
    const yesterday = new Date(Date.parse(today) - 86_400_000).toISOString();
    await enqueueJob(context, 'review', { review: true });
    equal((await runWorker('review-first', yesterday)).status, 'review', 'review worker exits');
    const before = (await job('review')).snapshot;
    equal(before.state, 'awaiting_review', 'review persisted');
    equal([before.leaseOwner, before.leaseExpiresAt], [null, null], 'no lease held during review');
    equal((await envelopes('review')).map(a => a.state), ['completed'], 'review settles queue claim');
    equal((await artifacts('review')).map(a => a.published), [false], 'prepared result not published');
    await approveJob(context, 'review', today);
    const approved = (await job('review')).snapshot;
    equal(approved.attemptCount, before.attemptCount, 'approval preserves attempt budget');
    equal(approved.resultRef, before.resultRef, 'approval preserves prepared reference');
    equal((await runWorker('review-next-day', today)).status, 'succeeded', 'approved work resumes');
    equal(await calls('review'), 1, 'prepared result reused without second simulated call');
    equal((await job('review')).snapshot.resultRef, before.resultRef, 'same reference published');
    equal((await artifacts('review')).map(a => a.published), [true], 'approved artifact published');
    return { clock: 'explicit logical clock', reviewAt: yesterday, approvalAt: today, simulatedGapMs: 86_400_000 };
  });
  await scenario('revocation before late result blocks publication', async () => {
    await enqueueJob(context, 'revoked');
    const late = worker('revoked-worker', 'provider');
    await late.checkpoint();
    equal(await calls('revoked'), 1, 'call dispatched before revocation');
    await cancelJob(context, 'revoked', new Date().toISOString());
    late.resume();
    equal((await late.result()).status, 'cancelled', 'late output rejected');
    equal((await job('revoked')).snapshot.state, 'cancelled', 'cancellation durable');
    equal((await job('revoked')).allowed, false, 'access revoked');
    equal(await artifacts('revoked'), [], 'no published late result');
    await context.boss.send('saga-poc', { jobId: 'revoked' });
    equal((await runWorker('revoked-repeat')).status, 'cancelled', 'redelivery remains cancelled');
    equal(await calls('revoked'), 1, 'redelivery cannot call provider');
  });
  await scenario('row-lock wait cannot dispatch after lease expiry', dispatchContentionRegression);
  equal((await runWorker('empty-worker')).status, 'empty', 'no unsettled work remains');
  equal(context.errors.map(error => error.message), [], 'no unhandled queue or pool errors');
  await newScenarios();
  await scenario('failed worker fork cleans the existing owned cluster', failedForkCleanupRegression);
  report.status = 'passed';
  }
} catch (error) {
  report.status = 'failed';
  report.error = error.stack ?? String(error);
  console.error(report.error);
  process.exitCode = 1;
} finally {
  try { await cleanup(); } catch (error) {
    report.status = 'failed';
    report.cleanupError = error.message;
    console.error(error.message);
    process.exitCode = 1;
  }
  report.finishedAt = new Date().toISOString();
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${report.status}: ${report.scenarios.length} scenarios, ${report.assertions} assertions; evidence ${evidencePath}`);
}

import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { enqueueJob, heartbeatJob } from './store.mjs';

// The seed envelope is settled through pg-boss so this regression can also run
// against the old enqueue API. The replacement has actual pg-boss heartbeat settings.
export async function supervisionHeartbeat(h) {
  const { context, worker, job, envelopes, equal, ok, report } = h;
  const id = 'supervision-heartbeat';
  await enqueueJob(context, id);
  const [seed] = await context.boss.fetch('saga-poc', { includeMetadata: true });
  await context.boss.complete('saga-poc', seed);
  const queueId = await context.boss.send('saga-poc', { jobId: id }, {
    expireInSeconds: 30, heartbeatSeconds: 10, retryLimit: 5, retryDelay: 0,
  });
  const held = worker('supervision-heartbeat-worker', 'provider');
  const { info } = await held.checkpoint();
  equal(info.queueId, queueId, 'regression holds the explicitly configured envelope');
  const started = Date.now();
  const samples = [];
  for (let i = 0; i < 12; i += 1) {
    await delay(1_000);
    const snapshot = await heartbeatJob(context, id, { ...info, leaseMs: 5_000 });
    await context.boss.supervise('saga-poc');
    const queue = (await envelopes(id)).find(row => row.id === queueId);
    samples.push({ elapsedMs: Date.now() - started, leaseExpiresAt: snapshot.leaseExpiresAt,
      queueState: queue.state, retryCount: queue.retryCount, heartbeatOn: queue.heartbeatOn });
  }
  report.supervisionHeartbeat = { samples, provider: 'synthetic ledger', clock: 'actual PostgreSQL and wall clock' };
  const current = (await envelopes(id)).find(row => row.id === queueId);
  ok(Date.parse((await job(id)).snapshot.leaseExpiresAt) > Date.now(), 'business lease remains live');
  equal(current.state, 'active', 'transactional heartbeat must retain the queue claim beyond its 10 second heartbeat window');
  equal(current.retryCount, info.retryCount, 'heartbeat retains exact queue attempt');
  held.resume();
  equal((await held.result()).status, 'succeeded', 'heartbeated attempt publishes once');
  return { elapsedMs: Date.now() - started, heartbeatSamples: samples.length };
}

export async function supervisedDuration(h, durationMs = 20_000) {
  const { context, supervisor, equal, ok, job, calls, artifacts, envelopes } = h;
  const id = `supervision-duration-${durationMs}`;
  const queueId = await enqueueJob(context, id, { expireInSeconds: Math.ceil(durationMs / 1_000) + 20, heartbeatSeconds: 10 });
  const owned = supervisor({ durationMs });
  const provider = await owned.wait(message => message.type === 'checkpoint' && message.stage === 'provider' && message.info.jobId === id);
  const completed = await owned.wait(message => message.type === 'result' && message.result.jobId === id, durationMs + 15_000);
  equal(completed.result.status, 'succeeded', 'automatic runner finishes synthetic asynchronous work');
  const elapsedMs = completed.receivedAt - provider.receivedAt;
  ok(elapsedMs >= durationMs, 'actual wall time reaches the requested duration');
  const beats = owned.messages.filter(message => message.type === 'heartbeat' && message.info.jobId === id);
  // The serial timer waits one second AFTER each DB operation; I/O time is not
  // free. Bound the observed cadence and maximum silence instead of demanding
  // an exact number of ticks from a fixed-rate setInterval that we do not use.
  ok(beats.length >= Math.floor(durationMs / 1_500), 'automatic heartbeats span multiple business leases');
  const heartbeatTimes = [provider.receivedAt, ...beats.map(beat => beat.receivedAt), completed.receivedAt];
  const maxHeartbeatGapMs = Math.max(...heartbeatTimes.slice(1).map((time, index) => time - heartbeatTimes[index]));
  ok(maxHeartbeatGapMs < 5_000, 'no observed heartbeat gap consumes an entire business lease');
  ok(beats.every(beat => beat.leaseLeadMs <= 5_000 && beat.leaseLeadMs > 0), 'lease credit stays within 5 seconds');
  equal((await job(id)).snapshot.attemptCount, 1, 'same business attempt survives');
  equal(await calls(id), 1, 'only one synthetic provider dispatch');
  equal((await artifacts(id)).map(row => row.published), [true], 'one published artifact');
  const queue = (await envelopes(id)).find(row => row.id === queueId);
  equal([queue.state, queue.retryCount], ['completed', 0], 'queue claim completes without redelivery');
  equal(owned.messages.filter(message => message.type === 'restart').length, 0, 'healthy worker was not restarted');
  await owned.stop();
  if (durationMs === 20_000) {
    for (const suffix of ['next-a', 'next-b']) await enqueueJob(context, `${id}-${suffix}`);
    const drain = supervisor({ durationMs: 0 });
    for (const suffix of ['next-a', 'next-b']) {
      const nextId = `${id}-${suffix}`;
      await drain.wait(message => message.type === 'result' && message.result.jobId === nextId);
      equal((await job(nextId)).snapshot.state, 'succeeded', 'continuous consumer processes another job');
      equal(await calls(nextId), 1, 'next job was executed, not filtered and acknowledged');
    }
    await drain.stop();
  }
  return { durationMs, elapsedMs, heartbeats: beats.length, maxHeartbeatGapMs, workerPid: provider.pid, queueId, synthetic: true };
}

export async function supervisedCrash(h, stage) {
  const { context, supervisor, equal, ok, job, calls, artifacts, envelopes } = h;
  const id = `supervision-kill-${stage}`;
  await enqueueJob(context, id, { expireInSeconds: 30, heartbeatSeconds: 10 });
  const owned = supervisor({ durationMs: stage === 'provider' ? 20_000 : 0, leasedDelayMs: 750, allowFaults: true });
  const crashed = await owned.wait(message => message.type === 'checkpoint' && message.stage === stage && message.info.jobId === id);
  owned.killRunner();
  const restart = await owned.wait(message => message.type === 'restart');
  equal(restart.backoffMs, 100, 'first unexpected death uses 100ms backoff');
  const result = await owned.wait(message => message.type === 'result' && message.result.jobId === id, 20_000);
  equal(result.result.status, stage === 'leased' ? 'succeeded' : 'unknown', 'recovery respects committed dispatch state');
  equal((await job(id)).snapshot.state, stage === 'leased' ? 'succeeded' : 'outcome_unknown', 'recovery is durable');
  equal(await calls(id), 1, 'no repeated synthetic dispatch');
  equal((await artifacts(id)).map(row => row.published), stage === 'leased' ? [true] : [], 'only safe result published');
  const queue = (await envelopes(id))[0];
  equal([queue.state, queue.retryCount], ['completed', 1], 'automatic pg-boss supervision redelivered the same envelope');
  ok(result.pid !== crashed.pid, 'replacement is a different OS process');
  await context.boss.send('saga-poc', { jobId: id });
  await owned.wait(message => message.type === 'result' && message.result.jobId === id && message.result.queueId !== queue.id);
  equal(await calls(id), 1, 'duplicate envelope cannot call the provider again');
  await owned.stop();
  return { fault: 'SIGKILL', stage, killedPid: crashed.pid, replacementPid: result.pid, recoveryMs: result.receivedAt - crashed.receivedAt };
}

export async function supervisedCancellation(h) {
  const { context, supervisor, equal, ok, job, calls, artifacts, cancelJob } = h;
  const id = 'supervision-cancel';
  await enqueueJob(context, id, { expireInSeconds: 30, heartbeatSeconds: 10 });
  const owned = supervisor({ durationMs: 20_000 });
  await owned.wait(message => message.type === 'heartbeat' && message.info.jobId === id);
  const cancelledAt = Date.now();
  await cancelJob(context, id, new Date().toISOString());
  const stopped = await owned.wait(message => message.type === 'heartbeat_failed' && message.info.jobId === id);
  ok(stopped.receivedAt - cancelledAt < 2_000, 'automatic heartbeat promptly notices revocation');
  const revision = (await job(id)).revision;
  await delay(1_200);
  equal((await job(id)).revision, revision, 'no in-flight or later heartbeat rewrites a cancelled row');
  await owned.wait(message => message.type === 'task_interrupted');
  await owned.wait(message => message.type === 'result' && message.result.jobId === id && message.result.status === 'cancelled');
  equal(await calls(id), 1, 'cancellation does not dispatch twice');
  equal(await artifacts(id), [], 'cancelled synthetic work never publishes');
  equal((await job(id)).snapshot.state, 'cancelled', 'revocation stays durable');
  await owned.stop();
  return { cancellationMs: stopped.receivedAt - cancelledAt };
}

export async function supervisedHardCap(h) {
  const { context, supervisor, equal, ok, job, calls, artifacts, envelopes } = h;
  const id = 'supervision-hard-cap';
  await enqueueJob(context, id, { expireInSeconds: 6, heartbeatSeconds: 10 });
  const owned = supervisor({ durationMs: 20_000 });
  const provider = await owned.wait(message => message.type === 'checkpoint' && message.stage === 'provider' && message.info.jobId === id);
  const interrupted = await owned.wait(message => message.type === 'heartbeat_failed' && message.info.jobId === id);
  ok(interrupted.receivedAt - provider.receivedAt >= 5_000, 'hard deadline uses actual elapsed time');
  ok(interrupted.receivedAt - provider.receivedAt < 8_000, 'heartbeats cannot extend the 6s hard cap');
  const beats = owned.messages.filter(message => message.type === 'heartbeat' && message.info.jobId === id);
  ok(beats.length >= 4, 'heartbeats succeeded before hard expiry');
  await owned.wait(message => message.type === 'result' && message.result.jobId === id);
  equal((await job(id)).snapshot.state, 'outcome_unknown', 'hard-cap interrupted dispatch is quarantined');
  equal(await calls(id), 1, 'hard cap does not cause another provider call');
  equal(await artifacts(id), [], 'hard-cap task cannot publish late');
  equal((await envelopes(id))[0].retryCount, 1, 'automatic supervision retried after hard deadline');
  await owned.stop();
  return { hardCapSeconds: 6, requestedTaskMs: 20_000, interruptionMs: interrupted.receivedAt - provider.receivedAt };
}

export async function supervisedRestartCap(h, forkFailure = false) {
  const { supervisor, equal, ok, scratch } = h;
  const owned = supervisor({ allowFaults: true, ...(forkFailure ? { runnerExecPath: `${scratch}/missing-node` } : {}) });
  if (!forkFailure) {
    const pids = new Set();
    for (let i = 0; i < 4; i += 1) {
      const ready = await owned.wait(message => message.type === 'ready' && !pids.has(message.pid));
      pids.add(ready.pid);
      owned.killRunner();
    }
    equal(pids.size, 4, 'initial process and exactly three replacement processes started');
  }
  const stopped = await owned.closed();
  equal(stopped, { code: 1, signal: null }, 'restart exhaustion exits nonzero');
  equal(owned.messages.filter(message => message.type === 'restart').map(message => message.backoffMs), [100, 200, 400], 'bounded restart backoff is serial');
  const spawns = owned.messages.filter(message => message.type === 'runner_spawn');
  equal(spawns.length, 4, 'no fifth process was spawned');
  const restarts = owned.messages.filter(message => message.type === 'restart');
  ok(restarts.every((message, index) => spawns[index + 1].receivedAt - message.receivedAt >= message.backoffMs - 25), 'observed respawns respect backoff');
  ok(owned.messages.some(message => message.type === 'supervisor_error' && /restart limit/.test(message.error)), 'failure is observable');
  return { fault: forkFailure ? 'runner ENOENT' : 'four runner SIGKILLs', backoffs: [100, 200, 400] };
}

export async function supervisedDisconnect(h, killSupervisor = false) {
  const { context, supervisor, equal, ok, exists, cleanupGroups, calls, artifacts } = h;
  const id = `supervision-parent-${killSupervisor ? 'killed' : 'disconnect'}`;
  await enqueueJob(context, id, { expireInSeconds: 30, heartbeatSeconds: 10 });
  const owned = supervisor({ durationMs: 20_000 });
  const provider = await owned.wait(message => message.type === 'checkpoint' && message.stage === 'provider' && message.info.jobId === id);
  if (killSupervisor) owned.child.kill('SIGKILL');
  else owned.child.disconnect();
  const stopped = await owned.closed();
  equal(stopped, killSupervisor ? { code: null, signal: 'SIGKILL' } : { code: 0, signal: null }, 'owned supervisor closes after parent loss');
  await cleanupGroups();
  ok(!exists(provider.pid), 'harness confirms the owned descendant is gone');
  equal(await calls(id), 1, 'parent loss does not trigger extra dispatch');
  equal(await artifacts(id), [], 'stopped runner cannot publish a late result');
  // Finish the abandoned envelope autonomously before starting the next scenario.
  const recovery = supervisor({ durationMs: 0 });
  await recovery.wait(message => message.type === 'result' && message.result.jobId === id);
  await recovery.stop();
  return { supervisorPid: owned.child.pid, runnerPid: provider.pid, fault: killSupervisor ? 'supervisor SIGKILL' : 'harness IPC disconnect' };
}

async function rejects(h, promise, pattern, label) {
  await assert.rejects(promise, pattern, label);
  h.report.assertions += 1;
}

export async function heartbeatFences(h) {
  const { context, worker, equal, ok, job, rows, cancelJob } = h;
  const id = 'supervision-fences';
  await enqueueJob(context, id, { expireInSeconds: 30, heartbeatSeconds: 10 });
  const held = worker('supervision-fences-owner', 'provider');
  const { info } = await held.checkpoint();
  const otherId = await context.boss.send('saga-poc', { jobId: id }, { expireInSeconds: 30, heartbeatSeconds: 10 });
  const [other] = await context.boss.fetch('saga-poc', { includeMetadata: true });
  equal(other.id, otherId, 'another actual active envelope carries the same business job ID');
  const original = await job(id);
  const beforeQueue = (await rows('SELECT heartbeat_on FROM pgboss.job WHERE id = $1', [info.queueId]))[0];
  for (const [options, pattern] of [
    [{ ...info, queueId: other.id, retryCount: other.retryCount }, /match business attempt/],
    [{ ...info, retryCount: info.retryCount + 1 }, /match business attempt/],
    [{ ...info, workerId: 'wrong-owner' }, /Stale worker/],
    [{ ...info, attempt: info.attempt + 1 }, /Stale worker/],
  ]) await rejects(h, heartbeatJob(context, id, options), pattern, 'wrong ownership cannot refresh either lease');
  equal((await job(id)).revision, original.revision, 'rejected heartbeat makes no business write');
  equal((await rows('SELECT heartbeat_on FROM pgboss.job WHERE id = $1', [info.queueId]))[0], beforeQueue, 'rejected heartbeat makes no queue write');
  const leadTimes = [];
  for (let i = 0; i < 20; i += 1) {
    const snapshot = await heartbeatJob(context, id, { ...info, nowISO: '2099-01-01T00:00:00.000Z' });
    const now = (await rows('SELECT clock_timestamp() AS now'))[0].now;
    leadTimes.push(Date.parse(snapshot.leaseExpiresAt) - now.getTime());
  }
  ok(leadTimes.every(value => value > 0 && value <= 5_000), 'rapid heartbeats and future input never accumulate future lease credit');
  // Force a failure AFTER public boss.touch: both queue and business writes must roll back.
  await context.pool.query(`CREATE FUNCTION public.reject_heartbeat_save() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.id = 'supervision-fences' THEN RAISE EXCEPTION 'injected business write failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER reject_heartbeat_save BEFORE UPDATE ON public.poc_jobs FOR EACH ROW EXECUTE FUNCTION public.reject_heartbeat_save()`);
  const saved = await job(id);
  const queueSaved = (await rows('SELECT heartbeat_on FROM pgboss.job WHERE id = $1', [info.queueId]))[0];
  try {
    await delay(50);
    await rejects(h, heartbeatJob(context, id, info), /injected business write failure/, 'business write failure rolls back transactional touch');
    equal((await job(id)).revision, saved.revision, 'failed transaction preserves revision');
    equal((await rows('SELECT heartbeat_on FROM pgboss.job WHERE id = $1', [info.queueId]))[0], queueSaved, 'failed transaction rolls back queue touch');
  } finally {
    await context.pool.query('DROP TRIGGER reject_heartbeat_save ON public.poc_jobs; DROP FUNCTION public.reject_heartbeat_save()');
  }
  // Explicit fault injection into queue metadata: the business lease is still live,
  // so this exercises the independently authoritative queue-heartbeat deadline.
  await context.pool.query("UPDATE pgboss.job SET heartbeat_on = clock_timestamp() - interval '11 seconds' WHERE id = $1", [info.queueId]);
  await rejects(h, heartbeatJob(context, id, info), /Queue claim has expired/, 'expired queue heartbeat cannot be resurrected before supervision');
  await cancelJob(context, id, new Date().toISOString());
  held.resume();
  equal((await held.result()).status, 'cancelled', 'faulted task settles only after cancellation');
  await context.boss.complete('saga-poc', other);
  return { burstHeartbeats: 20, maxLeaseLeadMs: Math.max(...leadTimes), injections: ['business-save trigger exception', 'queue heartbeat timestamp aged 11s via SQL'] };
}

export async function heartbeatQueueLock(h) {
  const { context, worker, equal, ok, rows, job } = h;
  const id = 'supervision-queue-lock';
  await enqueueJob(context, id);
  const held = worker('supervision-queue-lock-owner', 'provider');
  const { info } = await held.checkpoint();
  const expiry = Date.parse((await job(id)).snapshot.leaseExpiresAt);
  const blocker = await context.pool.connect();
  let rejected;
  try {
    await blocker.query('BEGIN');
    await blocker.query('SELECT * FROM pgboss.job WHERE id = $1 FOR UPDATE', [info.queueId]);
    rejected = rejects(h, heartbeatJob(context, id, info), /expired/, 'heartbeat samples time after queue lock wait');
    const waitUntil = Date.now() + 1_500;
    let waiting = false;
    while (Date.now() < waitUntil) {
      waiting = (await rows("SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE 'SELECT * FROM pgboss.job WHERE name = % FOR UPDATE'")).length > 0;
      if (waiting) break;
      await delay(20);
    }
    ok(waiting, 'heartbeat is waiting on the queue row after acquiring the business row');
    ok(Date.now() < expiry, 'queue-lock wait began before lease expiry');
    await delay(Math.max(0, expiry - Date.now()) + 150);
    await blocker.query('COMMIT');
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
  }
  await rejected;
  held.resume();
  equal((await held.result()).status, 'unknown', 'expired dispatched attempt cannot publish after lock wait');
  return { clock: 'actual PostgreSQL clock after both locks', queueLockHeldAcrossExpiry: true };
}

export async function heartbeatRedelivery(h) {
  const { context, worker, equal, job, rows, expireAndSupervise } = h;
  const id = 'supervision-stale-retry';
  const queueId = await enqueueJob(context, id);
  const stale = worker('supervision-old-worker', 'leased');
  const old = (await stale.checkpoint()).info;
  await expireAndSupervise(queueId);
  const fresh = worker('supervision-new-worker', 'provider');
  const current = (await fresh.checkpoint()).info;
  equal(current.queueId, old.queueId, 'redelivery retains queue ID');
  equal(current.retryCount, old.retryCount + 1, 'redelivery advances queue retry fence');
  equal(current.attempt, old.attempt + 1, 'replacement advances business attempt');
  const before = await job(id);
  const beforeQueue = (await rows('SELECT heartbeat_on FROM pgboss.job WHERE id = $1', [queueId]))[0];
  await rejects(h, heartbeatJob(context, id, old), /Stale worker/, 'old business attempt cannot heartbeat replacement');
  await rejects(h, heartbeatJob(context, id, { ...current, retryCount: old.retryCount }), /match business attempt/, 'old queue attempt cannot refresh current business owner');
  equal((await job(id)).revision, before.revision, 'stale redelivery heartbeat preserves current snapshot');
  equal((await rows('SELECT heartbeat_on FROM pgboss.job WHERE id = $1', [queueId]))[0], beforeQueue, 'stale redelivery heartbeat leaves queue heartbeat unchanged');
  stale.resume();
  equal((await stale.result()).status, 'duplicate', 'old worker cannot acknowledge new queue attempt');
  fresh.resume();
  equal((await fresh.result()).status, 'succeeded', 'current exact claim still completes');
  return { oldRetryCount: old.retryCount, newRetryCount: current.retryCount };
}

export async function supervisedBlockedShutdown(h) {
  const { context, supervisor, equal, ok, rows, exists, report } = h;
  const queueId = await context.boss.send('saga-poc', { jobId: 'supervision-shutdown-lock' }, { expireInSeconds: 1 });
  const [envelope] = await context.boss.fetch('saga-poc', { includeMetadata: true });
  equal(envelope.id, queueId, 'real queue claim will expire while its row is locked');
  const blocker = await context.pool.connect();
  let owned;
  let started;
  try {
    await blocker.query('BEGIN');
    await blocker.query('SELECT * FROM pgboss.job WHERE id = $1 FOR UPDATE', [queueId]);
    owned = supervisor();
    await owned.wait(message => message.type === 'ready');
    const deadline = Date.now() + 5_000;
    let waiting = false;
    let waitingBackends = [];
    while (Date.now() < deadline) {
      waitingBackends = await rows("SELECT pid, query FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE '%pgboss%'");
      waiting = waitingBackends.length > 0;
      if (waiting) break;
      await delay(20);
    }
    ok(waiting, 'automatic pg-boss maintenance is visibly blocked on the held expired row');
    started = Date.now();
    owned.child.kill('SIGTERM');
    await delay(3_500);
    report.blockedShutdown = { waitedForActualMaintenanceLock: waiting, elapsedMs: Date.now() - started, supervisorStillAlive: exists(owned.child.pid) };
    ok(!exists(owned.child.pid), 'supervisor shutdown is bounded while maintenance cannot finish');
    equal(await owned.closed(), { code: 1, signal: null }, 'forced database close preserves a nonzero exit');
    ok(owned.messages.some(message => message.type === 'cleanup_error' && /Database close/.test(message.error)), 'forced close is explicitly observable');
    const remainingBackends = await rows('SELECT pid FROM pg_stat_activity WHERE pid = ANY($1::int[])', [waitingBackends.map(row => row.pid)]);
    report.blockedShutdown.remainingMaintenanceBackends = remainingBackends;
    equal(remainingBackends, [], 'owned maintenance backend disappears while the independent row lock remains held');
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
    // On RED, releasing the lock lets the prior unbounded implementation finish.
    if (owned && exists(owned.child.pid)) { owned.child.kill('SIGTERM'); await owned.closed(); }
  }
  equal((await context.boss.complete('saga-poc', envelope)).affected, 1, 'cancelled maintenance left the original fixture claim available for settlement');
  return { shutdownMs: Date.now() - started, cause: 'automatic pg-boss maintenance waiting for expired queue row', forcedExitCode: 1 };
}

export async function abortedDispatchLock(h) {
  const { context, equal, ok, rows, calls, artifacts } = h;
  const id = 'supervision-abort-dispatch';
  await enqueueJob(context, id);
  const { processOne } = await import('./store.mjs');
  const blocker = await context.pool.connect();
  const stop = new AbortController();
  let checkpoint;
  const atDispatch = new Promise(resolve => { checkpoint = resolve; });
  const processing = processOne(context, {
    workerId: 'supervision-abort-dispatch-owner', signal: stop.signal,
    checkpoint: async stage => {
      if (stage === 'before_dispatch') {
        await blocker.query('BEGIN');
        await blocker.query('SELECT * FROM poc_jobs WHERE id = $1 FOR UPDATE', [id]);
        checkpoint();
      }
    },
  });
  // Attach the expected rejection immediately; it may finish after the lock releases.
  const outcome = processing.then(value => ({ value }), error => ({ error }));
  try {
    await Promise.race([atDispatch, outcome.then(result => { throw new Error(`Dispatch checkpoint was not reached: ${JSON.stringify(result)}`); })]);
    let waiting = false;
    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline) {
      waiting = (await rows("SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE 'SELECT * FROM public.poc_jobs WHERE id = % FOR UPDATE'")).length > 0;
      if (waiting) break;
      await delay(20);
    }
    ok(waiting, 'dispatch guard is blocked on a real business-row lock');
    stop.abort(new Error('injected stop during dispatch lock wait'));
    await blocker.query('COMMIT');
    const stopped = await outcome;
    ok(/injected stop/.test(stopped.error?.message), 'aborted processing is rejected');
    equal(await calls(id), 0, 'stop during the dispatch guard lock wait cannot create a provider call');
    equal(await artifacts(id), [], 'aborted dispatch cannot publish');
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
  }
  await context.boss.complete('saga-poc', (await context.boss.findJobs('saga-poc', { data: { jobId: id } }))[0]);
  return { abort: 'AbortController while real third business-row lock is blocked', providerCalls: 0 };
}

export async function supervisedStoppedRunner(h) {
  const { supervisor, equal, ok, exists } = h;
  const owned = supervisor();
  const ready = await owned.wait(message => message.type === 'ready');
  try {
    process.kill(ready.pid, 'SIGSTOP');
    owned.child.kill('SIGTERM');
    equal(await owned.closed(), { code: 1, signal: null }, 'forced runner SIGKILL cannot be reported as clean shutdown');
    ok(!exists(ready.pid), 'stopped runner is terminated within the shutdown deadline');
  } finally {
    if (exists(ready.pid)) process.kill(ready.pid, 'SIGKILL');
    if (exists(owned.child.pid)) await owned.stop();
  }
  return { fault: 'runner SIGSTOP then supervisor SIGTERM', forcedExitCode: 1 };
}

export async function abortedPublicationClock(h) {
  const { context, equal, job, artifacts } = h;
  const { processOne } = await import('./store.mjs');
  const id = 'supervision-abort-final-clock';
  await enqueueJob(context, id);
  const stop = new AbortController();
  let finalClock = false;
  let commitsAfterAbort = 0;
  // All SQL executes against the real harness database. This response-boundary
  // hook aborts only after the final real PostgreSQL clock query has returned,
  // while processOne is still awaiting it; it never fabricates rows or results.
  const observed = { ...context, pool: { connect: async () => {
    const client = await context.pool.connect();
    return {
      release: () => client.release(),
      query: async (sql, values) => {
        if (sql === 'COMMIT' && stop.signal.aborted) commitsAfterAbort += 1;
        const result = await client.query(sql, values);
        if (finalClock && sql === 'SELECT clock_timestamp() AS now') stop.abort(new Error('stop after final database clock'));
        return result;
      },
    };
  } } };
  const outcome = await processOne(observed, { workerId: 'supervision-final-clock-owner', signal: stop.signal,
    checkpoint: async stage => { if (stage === 'before_commit') finalClock = true; },
  }).catch(error => error);
  equal(commitsAfterAbort, 0, 'already-aborted publication never sends COMMIT');
  equal(outcome.message, 'stop after final database clock', 'final clock abort rejects processing');
  equal(await artifacts(id), [], 'publication SQL rolls back after final clock abort');
  equal((await job(id)).snapshot.state, 'running', 'last committed pre-publication state survives');
  await context.boss.complete('saga-poc', (await context.boss.findJobs('saga-poc', { data: { jobId: id } }))[0]);
  return { injection: 'abort after real final clock query response', fabricatedDatabaseResults: false };
}

export async function supervisedSignalDispatchLock(h) {
  const { context, supervisor, equal, ok, rows, calls, artifacts } = h;
  const id = 'supervision-signal-dispatch-lock';
  const queueId = await enqueueJob(context, id, { expireInSeconds: 30, heartbeatSeconds: 10 });
  const owned = supervisor({ durationMs: 20_000, beforeDispatchDelayMs: 500, allowFaults: true });
  const before = await owned.wait(message => message.type === 'checkpoint' && message.stage === 'before_dispatch');
  const blocker = await context.pool.connect();
  try {
    await blocker.query('BEGIN');
    await blocker.query('SELECT * FROM poc_jobs WHERE id = $1 FOR UPDATE', [id]);
    let waiting = false;
    const deadline = before.receivedAt + 900;
    while (Date.now() < deadline) {
      waiting = (await rows("SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE 'SELECT * FROM public.poc_jobs WHERE id = % FOR UPDATE'")).length > 0;
      if (waiting) break;
      await delay(10);
    }
    ok(waiting, 'actual runner dispatch guard blocks before the first 1s heartbeat');
    ok(!owned.messages.some(message => message.type === 'heartbeat'), 'wait cannot be a completed heartbeat');
    owned.child.kill('SIGTERM');
    await owned.wait(message => message.type === 'stopping' && message.pid === before.pid);
    await blocker.query('COMMIT');
    equal(await owned.closed(), { code: 0, signal: null }, 'SIGTERM cancels and joins the blocked runner cleanly');
    equal(await calls(id), 0, 'real supervisor SIGTERM during guard wait prevents synthetic dispatch');
    equal(await artifacts(id), [], 'real stop during dispatch lock wait cannot publish');
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
  }
  const queue = (await context.boss.findJobs('saga-poc', { id: queueId }))[0];
  await context.boss.complete('saga-poc', queue);
  return { signal: 'SIGTERM', blockedStage: 'before dispatch guard', providerCalls: 0 };
}

export async function supervisedRunnerShutdownFailure(h, kind) {
  const { supervisor, equal, ok, exists } = h;
  const owned = supervisor({ allowFaults: true, failOnStop: kind === 'exit1' });
  const ready = await owned.wait(message => message.type === 'ready');
  try {
    if (kind === 'external-kill') process.kill(ready.pid, 'SIGSTOP');
    owned.child.kill('SIGTERM');
    if (kind === 'external-kill') {
      // Kill before the supervisor's own 2s escalation; it must preserve this
      // actual failure outcome rather than treating early termination as clean.
      await delay(100);
      process.kill(ready.pid, 'SIGKILL');
    }
    equal(await owned.closed(), { code: 1, signal: null }, 'any failed runner outcome during shutdown stays nonzero');
    const outcome = owned.messages.find(message => message.type === 'cleanup_error' && message.outcome)?.outcome;
    equal(kind === 'exit1' ? outcome?.code : outcome?.signal, kind === 'exit1' ? 1 : 'SIGKILL', 'original runner shutdown failure is observable');
    ok(!exists(ready.pid), 'failed runner is gone');
  } finally {
    if (exists(ready.pid)) process.kill(ready.pid, 'SIGKILL');
    if (exists(owned.child.pid)) owned.child.kill('SIGTERM');
  }
  return { fault: kind === 'exit1' ? 'runner deliberately exits1 on SIGTERM' : 'external SIGKILL during shutdown before escalation' };
}

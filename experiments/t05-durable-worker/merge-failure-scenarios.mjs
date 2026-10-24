import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import fileSystem from 'node:fs/promises';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, unlink, symlink, chmod, link } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import * as store from './store.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
export async function runMergeFailureScenarios(h) {
  const { context, config, scratch, command, equal, ok, job, calls, artifacts, envelopes, report } = h;
  const scenario = (name, fn) => !h.failureCase || name.includes(h.failureCase) ? h.scenario(name, fn) : undefined;
  const rejects = async (promise, pattern) => { await assert.rejects(promise, pattern); report.assertions += 1; };
  const sourceRoot = join(config.recording.root, 'sources');
  const tempRoot = join(config.recording.root, 'temp');
  const outputRoot = join(config.recording.root, 'outputs');
  const audioPath = join(scratch, 'fixtures', 'failures.webm');
  command(config.recording.executable, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=0.4', '-c:a', 'libopus', audioPath]);
  const audio = await readFile(audioPath);
  async function fixture(id, bytes = audio, options = {}) {
    const task = context.recording.buildInput({ projectId: 'fictional-project', sessionId: id, assetId: `asset-${id}`,
      inputVersion: 1, processorVersion: 't04-local-v1', parameterVersion: 'original-audio-v1', mimeType: 'audio/webm',
      chunks: [{ index: 0, chunkId: `${id}-chunk`, bucket: 'audio-recordings', objectKey: `projects/fictional-project/sessions/${id}/0`, byteSize: bytes.length, sha256: hash(bytes) }] });
    const path = join(sourceRoot, context.recording.sourceName(task, task.chunks[0]));
    await writeFile(path, bytes, { mode: 0o600, flag: 'wx' });
    const queueId = await store.enqueueRecordingMerge(context, id, task, options);
    return { task, path, queueId, bytes };
  }
  const direct = (id, options = {}, ctx = context) => h.trackOperation(store.processOne(ctx, {
    workerId: `failure-${id}`, jobId: id, ...options,
    signal: options.signal ? AbortSignal.any([options.signal, h.cleanupSignal]) : h.cleanupSignal,
  }));
  const attempts = async id => (await context.pool.query('SELECT * FROM poc_attempts WHERE job_id = $1 ORDER BY attempt', [id])).rows;
  async function noPublication(id) {
    equal(await calls(id), 0, 'real merge has no simulated provider calls');
    equal(await artifacts(id), [], 'no committed output');
    await rejects(store.readPublishedRecording(context, id), /unavailable/);
    equal(await readdir(tempRoot), [], 'local merge scratch cleaned');
  }
  async function mutate(id, change) {
    const snapshot = (await job(id)).snapshot; change(snapshot);
    await context.pool.query('UPDATE poc_jobs SET snapshot = $2 WHERE id = $1', [id, snapshot]);
  }
  async function clear(id) {
    if (!['succeeded', 'failed', 'cancelled'].includes((await job(id)).snapshot.state)) await store.cancelJob(context, id);
    for (const envelope of await envelopes(id)) if (!['completed', 'cancelled', 'failed'].includes(envelope.state)) await context.boss.cancel('saga-poc', envelope.id);
  }
  const timeout = async (stage, _info, operationSignal) => { if (stage === 'merge_read') await delay(1000, undefined, { signal: operationSignal }); };
  async function timeoutContext() { return store.openPoc({ ...config, recording: { ...config.recording, ioTimeoutMs: 60 } }); }
  async function ready(id) {
    const wait = Date.parse((await job(id)).snapshot.notBefore) - Date.now();
    if (wait > 0) await delay(wait + 25);
  }

  await scenario('ambiguous decoder rejection remains unknown', async () => {
    const id = 'failure-ambiguous-decode';
    const f = await fixture(id, Buffer.from('invalid recording'.repeat(100)), { expireInSeconds: 5, heartbeatSeconds: 10 });
    await rejects(direct(id), /Recording audio decode failed or emitted error diagnostics/);
    equal((await job(id)).snapshot.state, 'running', 'generic decoder exit does not prove permanent bad input');
    equal((await attempts(id)).map(a => [a.state, a.failure]), [['running', null]]);
    equal((await envelopes(id)).map(e => e.state), ['active'], 'no failure acknowledgement or retry enqueue');
    await noPublication(id); equal(await readdir(outputRoot), []);
    await h.expireAndSupervise(f.queueId);
    equal((await direct(id)).status, 'unknown', 'original lease recovery quarantines ambiguous decoder outcome');
    equal([(await job(id)).snapshot.state, (await job(id)).snapshot.attemptCount], ['outcome_unknown', 1]);
    equal((await attempts(id)).map(a => [a.state, a.failure]), [['outcome_unknown', null]]);
    equal((await envelopes(id)).map(e => e.state), ['completed'], 'only original envelope was recovered');
    await context.boss.send('saga-poc', { jobId: id });
    equal((await direct(id)).status, 'unknown', 'redelivery cannot trigger a fresh decoder attempt');
    equal((await job(id)).snapshot.attemptCount, 1); await noPublication(id);
  });

  for (const [fault, code] of Object.entries({ missing: 'recording_source_missing', size: 'recording_source_size_mismatch', hash: 'recording_source_hash_mismatch',
    symlink: 'recording_source_not_private_file', fifo: 'recording_source_not_private_file', public: 'recording_source_not_private_file', hardlink: 'recording_source_not_private_file',
    duration: 'recording_decode_duration_exceeded' })) await scenario(`permanent ${fault}`, async () => {
    const id = `failure-${fault}`; const f = await fixture(id);
    if (fault === 'missing') await unlink(f.path);
    if (fault === 'size') await writeFile(f.path, Buffer.from('short'));
    if (fault === 'hash') await writeFile(f.path, Buffer.alloc(f.bytes.length));
    if (fault === 'symlink') { await unlink(f.path); await symlink(audioPath, f.path); }
    if (fault === 'fifo') { await unlink(f.path); command('mkfifo', [f.path]); }
    if (fault === 'public') await chmod(f.path, 0o644);
    if (fault === 'hardlink') await link(f.path, join(scratch, 'fixtures', 'hardlink'));
    const ctx = fault === 'duration' ? await store.openPoc({ ...config, recording: { ...config.recording, maxDurationMs: 50 } }) : context;
    try { equal((await direct(id, {}, ctx)).status, 'failed', 'known failure is handled without runner restart'); } finally { if (ctx !== context) await ctx.close(); }
    const snapshot = (await job(id)).snapshot;
    equal([snapshot.state, snapshot.errorCode, snapshot.leaseOwner, snapshot.leaseExpiresAt, snapshot.notBefore], ['failed', code, null, null, null]);
    equal((await envelopes(id)).map(e => e.state), ['completed']);
    equal((await attempts(id)).map(a => [a.state, a.failure]), [['failed', { code, disposition: 'permanent', phase: 'prepare' }]]);
    await noPublication(id); equal(await readdir(outputRoot), [], 'no private output produced by pre-prepare rejection');
  });

  await scenario('transient timeout repair and backoff across reopen', async () => {
    const id = 'failure-timeout-repair'; const f = await fixture(id, audio, { expireInSeconds: 19, heartbeatSeconds: 10 });
    const ctx = await timeoutContext();
    try { equal((await direct(id, { checkpoint: timeout }, ctx)).status, 'retry_wait'); } finally { await ctx.close(); }
    const snapshot = (await job(id)).snapshot;
    equal([snapshot.attemptCount, snapshot.maxAttempts, snapshot.errorCode], [1, 5, 'recording_source_read_timeout']);
    const pending = (await envelopes(id)).find(e => e.state === 'created');
    ok(pending, 'atomic retry envelope exists');
    equal([pending.expireInSeconds, pending.heartbeatSeconds], [19, 10], 'original runtime limits preserved');
    ok(new Date(pending.startAfter).getTime() >= Date.parse(snapshot.notBefore), 'queue startAfter honors durable notBefore');
    equal(pending.data, { jobId: id }, 'queue payload only carries ID');
    await context.boss.send('saga-poc', { jobId: id });
    const reopened = await store.openPoc(config);
    try { equal((await direct(id, {}, reopened)).status, 'retry_wait', 'premature duplicate settles safely'); } finally { await reopened.close(); }
    equal((await job(id)).snapshot.attemptCount, 1, 'duplicate never consumes attempt');
    equal((await attempts(id)).length, 1);
    await noPublication(id); await ready(id);
    equal((await direct(id)).status, 'succeeded');
    equal((await store.readPublishedRecording(context, id)).bytes, f.bytes);
    equal((await job(id)).snapshot.attemptCount, 2);
    equal((await attempts(id)).map(a => [a.state, a.failure?.code ?? null]), [['retry_wait', 'recording_source_read_timeout'], ['succeeded', null]], 'previous error retained');
    equal(await calls(id), 0);
  });

  await scenario('transient timeout exhausts original budget', async () => {
    const id = 'failure-timeout-budget'; await fixture(id); await mutate(id, s => { s.maxAttempts = 2; });
    const ctx = await timeoutContext();
    try {
      equal((await direct(id, { checkpoint: timeout }, ctx)).status, 'retry_wait'); await ready(id);
      equal((await direct(id, { checkpoint: timeout }, ctx)).status, 'failed');
    } finally { await ctx.close(); }
    const snapshot = (await job(id)).snapshot;
    equal([snapshot.attemptCount, snapshot.maxAttempts, snapshot.notBefore, snapshot.leaseOwner], [2, 2, null, null]);
    equal((await envelopes(id)).map(e => e.state).sort(), ['completed', 'completed']);
    equal((await attempts(id)).map(a => a.state), ['retry_wait', 'failed']); await noPublication(id);
  });

  for (const fault of ['generic', 'forged-code', 'stop', 'typed-stop']) await scenario(`conservative ${fault}`, async () => {
    const id = `failure-${fault}`; await fixture(id);
    const { RecordingProcessingError } = createRequire(import.meta.url)(join(config.recording.helpersDirectory, 'recording-processing-error.js'));
    const error = fault === 'typed-stop' ? new RecordingProcessingError('recording_source_read_timeout', 'Recording I/O timed out') : Object.assign(new Error('Recording I/O timed out'), { code: 'recording_source_read_timeout', disposition: 'transient' });
    const abort = new AbortController();
    await rejects(direct(id, { signal: abort.signal, checkpoint: async stage => {
      if (stage !== 'merge_read') return;
      if (fault === 'stop' || fault === 'typed-stop') abort.abort(error);
      throw fault === 'generic' ? new Error('unknown internal failure') : error;
    } }), /timed out|unknown internal/);
    equal((await job(id)).snapshot.state, 'running'); equal((await attempts(id))[0].failure, null);
    equal((await envelopes(id)).map(e => e.state), ['active']); await noPublication(id); await clear(id);
  });
  for (const fault of ['snapshot-write', 'attempt-write', 'enqueue', 'ack', 'final-abort', 'clock-abort']) await scenario(`atomic rollback ${fault}`, async () => {
    const id = `failure-rollback-${fault}`; await fixture(id);
    const ctx = await timeoutContext(); const abort = new AbortController();
    const originalConnect = ctx.pool.connect;
    let armed = false; let injected = false;
    ctx.pool.connect = function (...args) {
      if (args.some(value => typeof value === 'function')) return originalConnect.apply(this, args);
      return originalConnect.apply(this, args).then(client => ({
        query: async (sql, ...parameters) => {
          if (armed === 'final' && fault === 'clock-abort' && sql === 'SELECT clock_timestamp() AS now') {
            const result = await client.query(sql, ...parameters); injected = true; abort.abort(new Error('Injected atomic persistence failure')); return result;
          }
          const matches = fault === 'snapshot-write' ? sql.startsWith('UPDATE public.poc_jobs SET snapshot') : fault === 'attempt-write' ? sql.startsWith('UPDATE public.poc_attempts SET state = $3, failure')
            : fault === 'enqueue' ? /INSERT INTO pgboss.job/.test(sql) : fault === 'ack' ? /UPDATE pgboss.job/.test(sql) && /completed/.test(sql) : false;
          if (armed && matches) { injected = true; throw new Error('Injected atomic persistence failure'); }
          return client.query(sql, ...parameters);
        },
        release: () => client.release(),
      }));
    };
    try { await rejects(direct(id, { signal: abort.signal, checkpoint: async (stage, info, operationSignal) => {
      await timeout(stage, info, operationSignal);
      if (stage === 'merge_failure') armed = true;
      if (stage === 'before_failure_commit' && fault === 'clock-abort') armed = 'final';
      if (stage === 'before_failure_commit' && fault === 'final-abort') { injected = true; abort.abort(new Error('Injected atomic persistence failure')); }
    } }, ctx), /Injected atomic persistence failure/); } finally { ctx.pool.connect = originalConnect; await ctx.close(); }
    ok(injected, 'fault occurred in the requested transaction step');
    equal((await job(id)).snapshot.state, 'running', 'business failure and retry roll back');
    equal((await attempts(id))[0].failure, null, 'attempt audit rolls back');
    equal((await envelopes(id)).map(e => e.state), ['active'], 'old claim remains and no orphan retry exists');
    await noPublication(id); await clear(id);
  });

  for (const change of ['cancel', 'revoke', 'delete', 'input', 'queue-attempt', 'queue-deadline', 'attempt-binding', 'owner']) await scenario(`failure guard ${change}`, async () => {
    const id = `failure-guard-${change}`; await fixture(id); const ctx = await timeoutContext();
    try {
      const processing = direct(id, { checkpoint: async (stage, info, operationSignal) => {
        await timeout(stage, info, operationSignal);
        if (stage !== 'merge_failure') return;
        if (change === 'cancel') await store.cancelJob(context, id);
        if (change === 'revoke') await context.pool.query('UPDATE poc_jobs SET allowed = false WHERE id = $1', [id]);
        if (change === 'delete') await mutate(id, s => { s.deletionRequestedAt = new Date().toISOString(); });
        if (change === 'input') await mutate(id, s => { s.inputVersion += 1; });
        if (change === 'owner') await mutate(id, s => { s.leaseOwner = 'replacement-worker'; });
        if (change === 'queue-deadline') await context.pool.query("UPDATE pgboss.job SET started_on = clock_timestamp() - interval '1 minute' WHERE id = $1", [info.queueId]);
        if (change === 'queue-attempt') await context.pool.query('UPDATE pgboss.job SET retry_count = retry_count + 1 WHERE id = $1', [info.queueId]);
        if (change === 'attempt-binding') await context.pool.query("UPDATE poc_attempts SET input_digest = 'changed' WHERE job_id = $1", [id]);
      } }, ctx);
      if (change === 'input') await rejects(processing, /identity changed/);
      else equal((await processing).status, ['queue-attempt', 'queue-deadline', 'attempt-binding', 'owner'].includes(change) ? 'duplicate' : 'cancelled');
    } finally { await ctx.close(); }
    equal((await attempts(id))[0].failure, null, 'guard never persists or retries the rejected failure');
    equal((await envelopes(id)).length, 1, 'guard produces no retry message');
    if (change === 'input') await mutate(id, s => { s.inputVersion -= 1; });
    await noPublication(id); await clear(id);
  });

  for (const phase of ['job-lock', 'queue-lock', 'before-commit']) await scenario(`failure lease expires at ${phase}`, async () => {
    const id = `failure-expiry-${phase}`; await fixture(id); const ctx = await timeoutContext();
    let blocker; let unlock;
    try {
      equal((await direct(id, { checkpoint: async (stage, info, operationSignal) => {
        await timeout(stage, info, operationSignal);
        if (stage === 'merge_failure' && phase !== 'before-commit') {
          blocker = await context.pool.connect(); await blocker.query('BEGIN');
          await blocker.query(phase === 'job-lock' ? 'SELECT id FROM poc_jobs WHERE id = $1 FOR UPDATE' : 'SELECT id FROM pgboss.job WHERE id = $1 FOR UPDATE', [phase === 'job-lock' ? id : info.queueId]);
          unlock = h.trackOperation(delay(5100).then(() => blocker.query('COMMIT')));
        }
        if (stage === 'before_failure_commit' && phase === 'before-commit') await delay(5100);
      } }, ctx)).status, 'unknown', 'expired running lease remains quarantined');
    } finally { await unlock; blocker?.release(); await ctx.close(); }
    equal((await job(id)).snapshot.state, 'outcome_unknown');
    equal((await attempts(id))[0].failure, null); equal((await envelopes(id)).length, 1);
    await noPublication(id); await clear(id);
  });

  for (const code of ['EAGAIN', 'EINTR', 'EBUSY', 'ETIMEDOUT', 'EMFILE', 'EIO']) await scenario(`source OS ${code}`, async () => {
    const id = `failure-os-${code}`; const f = await fixture(id); const original = fileSystem.open;
    let injected = false;
    fileSystem.open = async (path, ...args) => {
      if (path === f.path) { injected = true; throw Object.assign(new Error('Injected OS source open failure'), { code }); }
      return original(path, ...args);
    }; syncBuiltinESMExports();
    try {
      const processing = direct(id);
      if (['EMFILE', 'EIO'].includes(code)) await rejects(processing, /Injected OS/);
      else equal((await processing).status, 'retry_wait');
    } finally { fileSystem.open = original; syncBuiltinESMExports(); }
    ok(injected, 'filesystem source operation fault was exercised');
    equal((await job(id)).snapshot.state, ['EMFILE', 'EIO'].includes(code) ? 'running' : 'retry_wait');
    await noPublication(id); await clear(id);
  });

  for (const phase of ['temporary-cleanup', 'source-close']) await scenario(`cleanup failure stays unknown ${phase}`, async () => {
    const id = `failure-cleanup-${phase}`; const f = await fixture(id); const ctx = await timeoutContext();
    const originalRm = fileSystem.rm; const originalOpen = fileSystem.open; let injected = false;
    fileSystem.rm = async (path, ...args) => {
      if (phase === 'temporary-cleanup' && String(path).startsWith(tempRoot + '/')) { injected = true; throw new Error('Injected cleanup failure'); }
      return originalRm(path, ...args);
    };
    fileSystem.open = async (path, ...args) => {
      const handle = await originalOpen(path, ...args);
      if (phase === 'source-close' && path === f.path) {
        const close = handle.close.bind(handle);
        handle.close = async () => { await close(); injected = true; throw new Error('Injected cleanup failure'); };
      }
      return handle;
    }; syncBuiltinESMExports();
    try { await rejects(direct(id, { checkpoint: timeout }, ctx), /cleanup failed|cleanup failure/); }
    finally { fileSystem.rm = originalRm; fileSystem.open = originalOpen; syncBuiltinESMExports(); await ctx.close(); }
    ok(injected); equal((await job(id)).snapshot.state, 'running'); equal((await attempts(id))[0].failure, null);
    equal((await envelopes(id)).map(e => e.state), ['active']);
    for (const entry of await readdir(tempRoot)) await originalRm(join(tempRoot, entry), { recursive: true, force: true });
    await noPublication(id); await clear(id);
  });

  await scenario('transient retry delay caps at five seconds', async () => {
    const id = 'failure-delay-cap'; await fixture(id); const ctx = await timeoutContext();
    try {
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        equal((await direct(id, { checkpoint: timeout }, ctx)).status, attempt === 5 ? 'failed' : 'retry_wait');
        const snapshot = (await job(id)).snapshot;
        equal([snapshot.attemptCount, snapshot.maxAttempts], [attempt, 5]);
        if (attempt < 5) {
          const remaining = Date.parse(snapshot.notBefore) - Date.now();
          const expected = Math.min(1000 * 2 ** (attempt - 1), 5000);
          ok(remaining > expected - 300 && remaining <= expected, 'persisted delay follows 1s, 2s, 4s, 5s cap');
          await ready(id);
        }
      }
    } finally { await ctx.close(); }
    equal((await attempts(id)).map(a => a.state), ['retry_wait', 'retry_wait', 'retry_wait', 'retry_wait', 'failed']);
    equal((await envelopes(id)).map(e => e.state), Array(5).fill('completed')); await noPublication(id);
  });

  await scenario('runner continues after known permanent failure', async () => {
    const failed = await fixture('failure-runner-bad'); await unlink(failed.path);
    await fixture('failure-runner-good');
    const child = fork(join(h.here, 'runner.mjs'), [h.configFile], { env: h.childEnv, silent: true, detached: true });
    const lifecycle = h.trackChild(child, { group: true, kind: 'runner' }); const results = []; let diagnostic = '';
    child.stdout.on('data', bytes => { diagnostic = (diagnostic + bytes).slice(-4000); });
    child.stderr.on('data', bytes => { diagnostic = (diagnostic + bytes).slice(-4000); });
    child.on('message', message => { if (message.type === 'result') results.push(message.result); });
    try {
      const end = Date.now() + 10000;
      while (results.length < 2 && Date.now() < end && !lifecycle.terminal) await delay(20);
      equal(results.map(r => [r.jobId, r.status]), [['failure-runner-bad', 'failed'], ['failure-runner-good', 'succeeded']], diagnostic);
    } finally {
      if (!lifecycle.terminal) child.kill('SIGTERM');
      await h.bounded(lifecycle.done, 5000, 'Failure runner did not stop');
    }
    equal(lifecycle.exitInfo, { code: 0, signal: null });
    await noPublication('failure-runner-bad'); equal(await calls('failure-runner-good'), 0);
  });
}

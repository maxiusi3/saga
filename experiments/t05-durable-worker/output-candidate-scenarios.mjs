import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, readdir, access, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import * as store from './store.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export async function runOutputCandidateScenarios(h) {
  const { context, config, scratch, command, equal, ok, job, artifacts, envelopes, report } = h;
  const scenario = (name, fn) => !h.outputCase || name.includes(h.outputCase) ? h.scenario(name, fn) : undefined;
  const rejects = async (promise, pattern = /candidate|identity|metadata|unavailable|input changed|abort|injected/i) => { await assert.rejects(promise, pattern); report.assertions += 1; };
  const sources = join(config.recording.root, 'sources');
  const outputs = join(config.recording.root, 'outputs');
  const audioPath = join(scratch, 'fixtures', 'candidates.webm');
  command(config.recording.executable, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=0.4', '-c:a', 'libopus', audioPath]);
  const bytes = await readFile(audioPath);
  const originals = new Map();
  const crashScratch = new Set();
  const candidates = async id => (await context.pool.query('SELECT * FROM poc_recording_outputs WHERE job_id = $1 ORDER BY attempt', [id])).rows;
  const candidate = async id => (await candidates(id)).at(-1);
  const outputPath = ref => join(outputs, context.recording.outputName(ref));
  async function fixture(id) {
    const task = context.recording.buildInput({ projectId: 'fictional-project', sessionId: id, assetId: `asset-${id}`,
      inputVersion: 1, processorVersion: 't04-local-v1', parameterVersion: 'original-audio-v1', mimeType: 'audio/webm',
      chunks: [{ index: 0, chunkId: `${id}-chunk`, bucket: 'audio-recordings', objectKey: `projects/fictional-project/sessions/${id}/0`, byteSize: bytes.length, sha256: hash(bytes) }] });
    const path = join(sources, context.recording.sourceName(task, task.chunks[0]));
    await writeFile(path, bytes, { mode: 0o600, flag: 'wx' }); originals.set(path, hash(bytes));
    const queueId = await store.enqueueRecordingMerge(context, id, task, { expireInSeconds: 19, heartbeatSeconds: 10 });
    return { task, path, queueId };
  }
  const direct = (id, options = {}, ctx = context) => h.trackOperation(store.processOne(ctx, { workerId: `candidate-${id}`, jobId: id, ...options,
    signal: options.signal ? AbortSignal.any([options.signal, h.cleanupSignal]) : h.cleanupSignal }));
  const args = c => ({ ref: c.ref, attempt: c.attempt, inputDigest: c.input_digest });
  const quarantine = async (id, options = {}, ctx = context) => h.trackOperation(store.quarantineRecordingOutput(ctx, id,
    { ...args(await candidate(id)), ...options, signal: options.signal ? AbortSignal.any([options.signal, h.cleanupSignal]) : h.cleanupSignal }));
  async function stopped(id) {
    if (!['succeeded','failed','cancelled'].includes((await job(id)).snapshot.state)) await store.cancelJob(context, id);
    for (const e of await envelopes(id)) if (e.state === 'active') await context.boss.complete('saga-poc', { id: e.id, retryCount: e.retryCount });
  }
  async function pause(id, stage = 'merge_prepared') {
    const child = h.worker(`candidate-child-${id}`, stage, undefined, { jobId: id });
    const { info } = await child.checkpoint(); return { ...child, info };
  }
  async function prepareOnly(id) {
    await fixture(id); const child = await pause(id); await child.kill(); return candidate(id);
  }
  async function noPublication(id) {
    equal(await artifacts(id), []); await rejects(store.readPublishedRecording(context, id), /unavailable/);
  }
  async function waitBlocked() {
    const until = Date.now() + 2000;
    while (Date.now() < until) {
      if ((await context.pool.query("SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE '%poc_%'")).rowCount) return;
      await delay(10);
    }
    throw new Error('Expected actual PostgreSQL lock wait');
  }
  async function withClientFault(action) {
    const original = context.pool.connect;
    context.pool.connect = function (...args) {
      if (args.some(value => typeof value === 'function')) return original.apply(this, args);
      return original.apply(this, args).then(client => ({
        query: (...a) => action(client.query.bind(client), ...a), release: () => client.release(),
      }));
    };
    return () => { context.pool.connect = original; };
  }

  await scenario('candidate committed before first output creation and read requires publication', async () => {
    const id = 'candidate-happy'; await fixture(id); let sawReservation = false;
    equal((await direct(id, { checkpoint: async (stage, info) => {
      if (stage !== 'merge_output_create') return;
      const table = (await context.pool.query("SELECT to_regclass('public.poc_recording_outputs') AS name")).rows[0].name;
      ok(table, 'durable output candidate table exists before output creation');
      const c = await candidate(id); equal([c.state, c.ref, c.worker_id, c.queue_id, c.queue_retry_count], ['reserved', info.ref, info.workerId, info.queueId, info.retryCount]);
      await rejects(access(outputPath(c.ref)), /ENOENT/); await noPublication(id); sawReservation = true;
    } })).status, 'succeeded');
    ok(sawReservation, 'file creation checkpoint observed committed reservation');
    const c = await candidate(id); const a = (await artifacts(id))[0]; const snapshot = (await job(id)).snapshot;
    equal([c.state, c.ref, c.metadata], ['published', snapshot.resultRef, a.metadata]);
    equal(c.input_digest, (await context.pool.query('SELECT input_digest FROM poc_attempts WHERE job_id = $1', [id])).rows[0].input_digest);
    ok(c.created_at && c.prepared_at && c.publishing_at && c.published_at && !c.quarantined_at);
    equal((await store.readPublishedRecording(context, id)).bytes, bytes);
    equal((await quarantine(id)).status, 'retained');
    await context.boss.send('saga-poc', { jobId: id }); equal((await direct(id)).status, 'duplicate'); equal((await candidates(id)).length, 1);
  });

  for (const fault of ['rollback', 'receipt-lost']) await scenario(`reservation COMMIT ${fault} never creates file`, async () => {
    const id = `reserve-${fault}`; await fixture(id); const before = await readdir(outputs); let armed = false;
    const restore = await withClientFault(async (query, sql, ...rest) => {
      if (sql === 'COMMIT' && armed) { armed = false; await query(fault === 'rollback' ? 'ROLLBACK' : 'COMMIT'); throw new Error('injected reserve COMMIT reply loss'); }
      return query(sql, ...rest);
    });
    try { await rejects(direct(id, { checkpoint: async stage => { if (stage === 'before_output_reservation_commit') armed = true; } }), /injected/); }
    finally { restore(); }
    equal(await readdir(outputs), before); equal((await candidates(id)).map(c => c.state), fault === 'rollback' ? [] : ['reserved']);
    await noPublication(id); await stopped(id);
  });

  for (const [stage, state, exists] of [['output_reserved', 'reserved', false], ['merge_output_create', 'reserved', false],
    ['merge_file_prepared', 'reserved', true], ['before_output_prepared_commit', 'reserved', true], ['merge_prepared', 'prepared', true],
    ['before_output_publishing_commit', 'prepared', true], ['output_publishing', 'publishing', true], ['before_commit', 'publishing', true]]) {
    await scenario(`SIGKILL ${stage} retains ${state} identity`, async () => {
      const id = `candidate-kill-${stage}`; await fixture(id); const child = await pause(id, stage); const c = await candidate(id);
      equal(c.state, state); await child.kill(); equal((await candidate(id)).state, state);
      for (const path of await readdir(join(config.recording.root, 'temp'))) crashScratch.add(path);
      if (exists) equal(hash(await readFile(outputPath(c.ref))), hash(bytes)); else await rejects(access(outputPath(c.ref)), /ENOENT/);
      await noPublication(id); await stopped(id);
      if (state !== 'prepared') equal((await quarantine(id)).status, 'retained');
    });
  }

  await scenario('unique attempt and reference reject replacement', async () => {
    const id = 'candidate-unique'; const c = await prepareOnly(id);
    const insert = (ref, attempt) => context.pool.query(`INSERT INTO poc_recording_outputs(ref,job_id,attempt,worker_id,queue_id,queue_retry_count,input_digest,state)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'reserved')`, [ref,id,attempt,c.worker_id,c.queue_id,c.queue_retry_count,c.input_digest]);
    await rejects(insert(`local-recording:${randomUUID()}`, c.attempt), /unique/);
    await rejects(insert(c.ref, c.attempt + 1), /unique|foreign key/);
    await rejects(context.recording.prepare((await job(id)).frozen_input, {}), /reference/);
    await rejects(context.recording.prepare((await job(id)).frozen_input, { ref: c.ref }), /EEXIST/);
    equal(hash(await readFile(outputPath(c.ref))), hash(bytes)); await stopped(id);
  });

  await scenario('known failure cleaned and bounded retry gets distinct candidate', async () => {
    const id = 'candidate-retry'; await fixture(id);
    const ctx = await store.openPoc({ ...config, recording: { ...config.recording, ioTimeoutMs: 60 } });
    try { equal((await direct(id, { checkpoint: async (stage, _, signal) => { if (stage === 'merge_read') await delay(1000, undefined, { signal }); } }, ctx)).status, 'retry_wait'); }
    finally { await ctx.close(); }
    const first = await candidate(id); equal(first.state, 'cleaned'); ok(first.cleaned_at); equal(first.metadata, null);
    const wait = Date.parse((await job(id)).snapshot.notBefore) - Date.now(); if (wait > 0) await delay(wait + 25);
    equal((await direct(id)).status, 'succeeded'); const cs = await candidates(id);
    equal(cs.map(c => c.state), ['cleaned', 'published']); ok(cs[0].ref !== cs[1].ref);
    equal(cs.map(c => c.attempt), [1,2]); equal(cs[0].input_digest, cs[1].input_digest);
  });

  for (const rollback of [false, true]) await scenario(`permanent failure candidate cleanup is atomic rollback=${rollback}`, async () => {
    const id = `candidate-permanent-${rollback}`; const f = await fixture(id); await unlink(f.path); let armed = false;
    const restore = await withClientFault(async (query, sql, ...rest) => {
      if (rollback && armed && String(sql).startsWith('UPDATE public.poc_attempts SET state = $3, failure')) throw new Error('injected audit failure');
      return query(sql, ...rest);
    });
    try {
      const operation = direct(id, { checkpoint: async stage => { if (stage === 'merge_failure') armed = true; } });
      if (rollback) await rejects(operation, /injected/); else equal((await operation).status, 'failed');
    } finally { restore(); await writeFile(f.path, bytes, { mode: 0o600, flag: 'wx' }); }
    const c = await candidate(id);
    equal([c.state, (await job(id)).snapshot.state], rollback ? ['reserved','running'] : ['cleaned','failed']);
    equal((await envelopes(id)).map(e => e.state), [rollback ? 'active' : 'completed']);
    equal((await context.pool.query('SELECT failure FROM poc_attempts WHERE job_id = $1', [id])).rows[0].failure?.code ?? null,
      rollback ? null : 'recording_source_missing');
    await rejects(access(outputPath(c.ref)), /ENOENT/); await stopped(id); equal((await quarantine(id)).status, 'retained');
  });

  await scenario('retry budget exhaustion preserves both cleaned candidate identities', async () => {
    const id = 'candidate-budget'; await fixture(id); const snapshot = (await job(id)).snapshot; snapshot.maxAttempts = 2;
    await context.pool.query('UPDATE poc_jobs SET snapshot = $2 WHERE id = $1', [id,snapshot]);
    const ctx = await store.openPoc({ ...config, recording: { ...config.recording, ioTimeoutMs: 60 } });
    try {
      for (const expected of ['retry_wait','failed']) {
        equal((await direct(id, { checkpoint: async (stage, _, signal) => { if (stage === 'merge_read') await delay(1000, undefined, { signal }); } }, ctx)).status, expected);
        if (expected === 'retry_wait') await delay(Math.max(0,Date.parse((await job(id)).snapshot.notBefore) - Date.now()) + 25);
      }
    } finally { await ctx.close(); }
    const cs = await candidates(id); equal(cs.map(c => [c.attempt,c.state]), [[1,'cleaned'],[2,'cleaned']]); ok(cs[0].ref !== cs[1].ref);
    equal((await envelopes(id)).map(e => e.state), ['completed','completed']); await noPublication(id);
  });

  for (const fault of ['metadata','worker']) await scenario(`prepared candidate ${fault} drift prevents publishing intent`, async () => {
    const id = `candidate-intent-drift-${fault}`; await fixture(id);
    await rejects(direct(id, { checkpoint: async stage => {
      if (stage !== 'merge_prepared') return;
      if (fault === 'metadata') await context.pool.query("UPDATE poc_recording_outputs SET metadata = jsonb_set(metadata, '{sha256}', to_jsonb($2::text)) WHERE job_id = $1", [id,'f'.repeat(64)]);
      else await context.pool.query("UPDATE poc_recording_outputs SET worker_id = 'forged' WHERE job_id = $1", [id]);
    } }));
    equal((await candidate(id)).state, 'prepared'); equal((await candidate(id)).publishing_at, null); await noPublication(id); await stopped(id);
  });

  await scenario('unknown prepare remains reserved and never quarantined', async () => {
    const id = 'candidate-unknown'; await fixture(id);
    await rejects(direct(id, { checkpoint: async stage => { if (stage === 'merge_read') throw new Error('injected unknown'); } }), /injected/);
    equal((await candidate(id)).state, 'reserved'); await stopped(id); equal((await quarantine(id)).status, 'retained');
  });

  for (const phase of ['intent', 'publication']) for (const committed of [false, true]) await scenario(`${phase} COMMIT receipt lost committed=${committed} retains uncertain output`, async () => {
    const id = `candidate-${phase}-${committed}`; await fixture(id); let armed = false;
    const restore = await withClientFault(async (query, sql, ...rest) => {
      if (sql === 'COMMIT' && armed) { armed = false; await query(committed ? 'COMMIT' : 'ROLLBACK'); throw new Error('injected publication reply lost'); }
      return query(sql, ...rest);
    });
    try { await rejects(direct(id, { checkpoint: async stage => { if (stage === (phase === 'intent' ? 'before_output_publishing_commit' : 'before_commit')) armed = true; } }), /injected/); }
    finally { restore(); }
    const c = await candidate(id); equal(c.state, phase === 'intent' ? committed ? 'publishing' : 'prepared' : committed ? 'published' : 'publishing');
    equal(hash(await readFile(outputPath(c.ref))), hash(bytes));
    if (c.state === 'published') equal((await store.readPublishedRecording(context, id)).bytes, bytes); else await noPublication(id);
    await stopped(id); equal((await quarantine(id)).status, c.state === 'prepared' ? 'quarantined' : 'retained');
  });

  await scenario('prepared cancellation quarantine survives context reopen without deleting or reusing file', async () => {
    const id = 'candidate-quarantine'; const c = await prepareOnly(id);
    equal((await quarantine(id)).status, 'retained'); await stopped(id);
    equal((await quarantine(id)).status, 'quarantined'); const first = await candidate(id); ok(first.quarantined_at);
    const reopened = await store.openPoc(config);
    try { equal((await quarantine(id, {}, reopened)).status, 'quarantined'); } finally { await reopened.close(); }
    equal((await candidate(id)).quarantined_at, first.quarantined_at);
    equal(hash(await readFile(outputPath(c.ref))), hash(bytes));
    await context.boss.send('saga-poc', { jobId: id }); equal((await direct(id)).status, 'cancelled'); equal((await candidates(id)).length, 1); await noPublication(id);
    const other = `${id}-other`; await store.enqueueJob(context, other);
    await context.pool.query('INSERT INTO poc_artifacts(job_id,ref,published) VALUES ($1,$2,false)', [other,c.ref]);
    equal((await quarantine(id)).status, 'retained', 'idempotent declaration rechecks every reference'); await stopped(other);
  });

  await scenario('unknown lease recovery then cancellation preserves prepared output', async () => {
    const id = 'candidate-unknown-cancel'; await prepareOnly(id);
    const snapshot = (await job(id)).snapshot; snapshot.leaseExpiresAt = new Date(Date.now() - 1).toISOString();
    await context.pool.query('UPDATE poc_jobs SET snapshot = $2 WHERE id = $1', [id,snapshot]);
    await context.boss.send('saga-poc', { jobId: id }); equal((await direct(id)).status, 'unknown');
    await stopped(id); equal((await job(id)).snapshot.errorCode, 'lease_expired_after_dispatch_unknown');
    equal((await quarantine(id)).status, 'retained'); equal((await candidate(id)).state, 'prepared');
  });

  for (const order of ['publication-first', 'quarantine-first']) await scenario(`pending publication versus quarantine ${order}`, async () => {
    const id = `candidate-race-${order}`; await fixture(id);
    const child = await pause(id, order === 'publication-first' ? 'before_commit' : 'before_publication');
    if (order === 'publication-first') {
      const pending = quarantine(id); await waitBlocked(); child.resume(); equal((await child.result()).status, 'succeeded'); equal((await pending).status, 'retained');
      equal((await candidate(id)).state, 'published');
    } else {
      await stopped(id);
      const blocker = await context.pool.connect(); await blocker.query('BEGIN'); await blocker.query('SELECT * FROM poc_recording_outputs WHERE job_id = $1 FOR UPDATE', [id]);
      const pending = quarantine(id); await waitBlocked(); child.resume();
      await blocker.query('ROLLBACK'); blocker.release();
      equal((await pending).status, 'quarantined'); equal((await child.result()).status, 'duplicate', 'cancelled queue was already acknowledged'); equal((await candidate(id)).state, 'quarantined'); await noPublication(id);
    }
  });

  for (const field of ['ref','attempt','inputDigest']) await scenario(`quarantine forged ${field} rejected`, async () => {
    const id = `candidate-forged-${field}`; await prepareOnly(id); await stopped(id);
    await rejects(quarantine(id, { [field]: field === 'attempt' ? 9 : field === 'ref' ? `local-recording:${randomUUID()}` : 'f'.repeat(64) }));
    equal((await candidate(id)).state, 'prepared');
  });

  for (const fault of ['worker','queue','digest','metadata','artifact','other-snapshot']) await scenario(`quarantine drift ${fault} rejects or retains`, async () => {
    const id = `candidate-drift-${fault}`; const c = await prepareOnly(id); await stopped(id);
    if (fault === 'worker') await context.pool.query("UPDATE poc_recording_outputs SET worker_id = 'forged' WHERE ref = $1", [c.ref]);
    if (fault === 'queue') await context.pool.query('UPDATE poc_recording_outputs SET queue_retry_count = queue_retry_count + 1 WHERE ref = $1', [c.ref]);
    if (fault === 'digest') await context.pool.query("UPDATE poc_attempts SET input_digest = 'forged' WHERE job_id = $1", [id]);
    if (fault === 'metadata') await context.pool.query("UPDATE poc_recording_outputs SET metadata = jsonb_set(metadata, '{bindingDigest}', '\"forged\"') WHERE ref = $1", [c.ref]);
    if (fault === 'artifact' || fault === 'other-snapshot') {
      const other = `${id}-other`; await store.enqueueJob(context, other);
      if (fault === 'artifact') await context.pool.query('INSERT INTO poc_artifacts(job_id,ref,published) VALUES ($1,$2,false)', [other,c.ref]);
      else await context.pool.query("UPDATE poc_jobs SET snapshot = jsonb_set(snapshot, '{resultRef}', to_jsonb($2::text)) WHERE id = $1", [other,c.ref]);
      equal((await quarantine(id)).status, 'retained'); await stopped(other);
    } else await rejects(quarantine(id));
    equal((await candidate(id)).state, 'prepared');
  });

  for (const fault of ['candidate','artifact','attempt']) await scenario(`published read ${fault} drift checked before and after I/O`, async () => {
    const id = `candidate-read-${fault}`; await fixture(id); equal((await direct(id)).status, 'succeeded'); const c = await candidate(id);
    const corrupt = () => fault === 'candidate' ? context.pool.query("UPDATE poc_recording_outputs SET worker_id = 'forged' WHERE ref = $1", [c.ref]) : fault === 'artifact'
      ? context.pool.query("UPDATE poc_artifacts SET metadata = jsonb_set(metadata, '{sha256}', to_jsonb($2::text)) WHERE job_id = $1", [id,'f'.repeat(64)])
      : context.pool.query("UPDATE poc_attempts SET input_digest = 'forged' WHERE job_id = $1", [id]);
    const restore = () => fault === 'candidate' ? context.pool.query('UPDATE poc_recording_outputs SET worker_id = $2 WHERE ref = $1', [c.ref,c.worker_id]) : fault === 'artifact'
      ? context.pool.query('UPDATE poc_artifacts SET metadata = $2 WHERE job_id = $1', [id,c.metadata])
      : context.pool.query('UPDATE poc_attempts SET input_digest = $2 WHERE job_id = $1', [id,c.input_digest]);
    await corrupt(); await rejects(store.readPublishedRecording(context,id)); await restore();
    const read = context.recording.readOutput; context.recording.readOutput = async (...a) => { const result = await read(...a); await corrupt(); return result; };
    try { await rejects(store.readPublishedRecording(context,id)); } finally { context.recording.readOutput = read; await restore(); }
  });

  for (const fault of ['abort','query','commit']) await scenario(`quarantine ${fault} rolls back declaration`, async () => {
    const id = `candidate-quarantine-${fault}`; await prepareOnly(id); await stopped(id);
    const abort = new AbortController(); let blocked; let restore = () => {};
    if (fault === 'abort') {
      blocked = await context.pool.connect(); await blocked.query('BEGIN'); await blocked.query('SELECT * FROM poc_recording_outputs WHERE job_id = $1 FOR UPDATE', [id]);
    } else restore = await withClientFault(async (query, sql, ...rest) => {
      if (fault === 'query' && String(sql).includes('poc_artifacts')) throw new Error('injected query failure');
      if (fault === 'commit' && sql === 'COMMIT') { await query('ROLLBACK'); throw new Error('injected commit failure'); }
      return query(sql, ...rest);
    });
    try {
      const pending = quarantine(id, { signal: abort.signal }); pending.catch(() => {});
      if (blocked) { await waitBlocked(); abort.abort(new Error('injected abort')); await blocked.query('ROLLBACK'); blocked.release(); }
      await rejects(pending, /injected/);
    } finally { restore(); }
    equal((await candidate(id)).state, 'prepared'); equal((await candidate(id)).quarantined_at, null);
  });

  for (const fault of ['abort','lease']) await scenario(`publication candidate lock wait rechecks ${fault}`, async () => {
    const id = `candidate-lock-${fault}`; await fixture(id); const abort = new AbortController(); let blocker; let pending;
    try {
      pending = direct(id, { signal: abort.signal, checkpoint: async stage => {
        if (stage !== 'before_publication') return;
        blocker = await context.pool.connect(); await blocker.query('BEGIN'); await blocker.query('SELECT * FROM poc_recording_outputs WHERE job_id = $1 FOR UPDATE', [id]);
      } }); pending.catch(() => {});
      await waitBlocked();
      if (fault === 'abort') abort.abort(new Error('injected abort')); else await delay(5200);
      await blocker.query('ROLLBACK'); blocker.release(); blocker = undefined;
      if (fault === 'abort') await rejects(pending, /injected/); else equal((await pending).status, 'unknown');
      equal((await candidate(id)).state, 'prepared'); await noPublication(id); await stopped(id);
    } finally { if (blocker) { await blocker.query('ROLLBACK'); blocker.release(); } }
  });

  await scenario('all original fictional blocks unchanged and only killed helper scratch remains', async () => {
    for (const [path, digest] of originals) equal(hash(await readFile(path)), digest, 'original source bytes unchanged');
    equal((await readdir(join(config.recording.root, 'temp'))).sort(), [...crashScratch].sort());
    report.outputCandidateCrashScratch = [...crashScratch];
    equal(context.errors.map(error => error.message), []);
  });
  if (h.outputCase && !report.scenarios.length) throw new Error('No output candidate scenario matched');
}

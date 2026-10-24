import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, unlink, symlink, rename } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import ts from 'typescript';
import * as store from './store.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const ffmpeg = process.env.SAGA_FFMPEG_PATH;

export async function setupMergeConfig({ scratch, root, report, command }) {
  if (typeof ffmpeg !== 'string' || !isAbsolute(ffmpeg)) throw new Error('Merge harness requires an explicit absolute SAGA_FFMPEG_PATH');
  for (const path of ['helpers', 'fixtures', 'recording', 'recording/sources', 'recording/outputs', 'recording/temp']) await mkdir(join(scratch, path), { mode: 0o700 });
  await writeFile(join(scratch, 'helpers/package.json'), '{"type":"commonjs"}', { mode: 0o600 });
  for (const name of ['processing-jobs', 'recording-merge', 'recording-merge-executor', 'recording-audio-decoder', 'recording-processing-error']) {
    const path = `packages/web/src/lib/server/${name}.ts`;
    const source = await readFile(join(root, path), 'utf8');
    report.sources[path] = hash(source);
    await writeFile(join(scratch, 'helpers', `${name}.js`), ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, { mode: 0o600 });
  }
  report.runtime.ffmpeg = command(ffmpeg, ['-version']).split('\n')[0];
  report.runtime.ffmpegSha256 = hash(await readFile(ffmpeg));
  report.scope = 'isolated PostgreSQL + pg-boss + real local fictional audio + existing T04 streaming merge and FFmpeg decoder';
  report.limitations = [
    'Private temporary PostgreSQL tables and an allowed flag simulate authorization; no production schema, RLS, Storage, outbox, migration or paid provider.',
    'No filesystem/database distributed transaction. Prepared outputs may remain private orphans after process death or unknown COMMIT; no automatic GC or manual reuse.',
    'Private directories, regular files, bounded streams and O_NOFOLLOW protect local paths; same-user hostile directory replacement races and non-preemptible kernel filesystem operations are outside this PoC.',
    'Generated sine audio is split into contiguous file chunks; this is not physical-device MediaRecorder or production media sandbox evidence.',
    'Checkpoint pauses are fault wrappers, not decoder CPU work. Real-time input throttling (-re) is explicitly labeled where used with real FFmpeg.',
    'The existing local nonfree FFmpeg 7.1 executable is used for tests only and is not copied or redistributed.',
  ];
  return { root: join(scratch, 'recording'), helpersDirectory: join(scratch, 'helpers'), executable: ffmpeg,
    maxInputBytes: 8 * 1024 * 1024, maxChunks: 1000, ioTimeoutMs: 15_000, decodeTimeoutMs: 15_000, maxDurationMs: 30_000 };
}

export async function runMergeScenarios(h) {
  const { context, config, scratch, command, equal, ok, scenario, job, calls, artifacts, envelopes, worker, runWorker, report } = h;
  const rejects = async (promise, pattern, label) => { await assert.rejects(promise, pattern, label); report.assertions += 1; };
  const sources = join(config.recording.root, 'sources');
  const outputs = join(config.recording.root, 'outputs');
  const temporary = join(config.recording.root, 'temp');
  const fixtureCache = new Map();
  async function audio(format, seconds = 0.4) {
    const key = `${format}-${seconds}`;
    if (!fixtureCache.has(key)) {
      const path = join(scratch, 'fixtures', `sine-${key}.${format}`);
      command(ffmpeg, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `sine=frequency=440:sample_rate=48000:duration=${seconds}`,
        '-c:a', format === 'mp4' ? 'aac' : 'libopus', ...(format === 'mp4' ? ['-movflags', '+faststart'] : []), path]);
      fixtureCache.set(key, await readFile(path));
    }
    return fixtureCache.get(key);
  }
  async function fixture(id, { format = 'webm', count = 3, seconds, bytes: supplied } = {}) {
    const bytes = supplied ?? await audio(format, seconds);
    const chunks = []; const parts = [];
    for (let index = 0; index < count; index += 1) {
      const part = bytes.subarray(Math.floor(index * bytes.length / count), Math.floor((index + 1) * bytes.length / count));
      parts.push(part);
      chunks.push({ index, chunkId: `${id}-chunk-${index}`, bucket: 'audio-recordings', objectKey: `projects/fictional-project/sessions/${id}/${index}`, byteSize: part.length, sha256: hash(part) });
    }
    const task = context.recording.buildInput({ projectId: 'fictional-project', sessionId: id, assetId: `asset-${id}`,
      inputVersion: 1, processorVersion: 't04-local-v1', parameterVersion: 'original-audio-v1', mimeType: `audio/${format}`, chunks: chunks.reverse() });
    for (const chunk of task.chunks) await writeFile(join(sources, context.recording.sourceName(task, chunk)), parts[chunk.index], { mode: 0o600, flag: 'wx' });
    return { task, bytes, parts };
  }
  const enqueue = (id, f, options) => store.enqueueRecordingMerge(context, id, f.task, options);
  const read = id => store.readPublishedRecording(context, id);
  const outputPath = ref => join(outputs, context.recording.outputName(ref));
  async function noPublication(id) {
    equal(await calls(id), 0, 'real merge never records a synthetic provider call');
    equal(await artifacts(id), [], 'no committed artifact reference');
    await rejects(read(id), /unavailable/, 'unpublished private file cannot be read by job ID');
  }
  async function settleFailed(id) {
    const row = await job(id);
    if (row && !['succeeded', 'failed', 'cancelled'].includes(row.snapshot.state)) await store.cancelJob(context, id);
    for (const entry of await envelopes(id)) {
      if (entry.state === 'active') await context.boss.complete('saga-poc', { id: entry.id, retryCount: entry.retryCount });
      if (row?.snapshot.state === 'retry_wait' && (entry.state === 'created' || entry.state === 'retry')) await context.boss.cancel('saga-poc', entry.id);
    }
  }
  async function mutateSnapshot(id, mutate) {
    const snapshot = (await job(id)).snapshot;
    mutate(snapshot);
    await context.pool.query('UPDATE poc_jobs SET snapshot = $2 WHERE id = $1', [id, snapshot]);
  }
  function direct(id, options = {}, ctx = context) {
    const signal = options.signal ? AbortSignal.any([options.signal, h.cleanupSignal]) : h.cleanupSignal;
    return h.trackOperation(store.processOne(ctx, { workerId: `direct-${id}`, jobId: id, ...options, signal }));
  }
  function runner(options = {}, useConfigFile = h.configFile) {
    const child = fork(join(h.here, 'runner.mjs'), [useConfigFile, JSON.stringify(options)], { env: h.childEnv, silent: true, detached: true });
    const lifecycle = h.trackChild(child, { group: true, kind: 'runner' }); const messages = []; let diagnostic = '';
    child.on('message', message => messages.push({ ...message, receivedAt: Date.now() }));
    child.stdout.on('data', bytes => { diagnostic = (diagnostic + bytes).slice(-4000); });
    child.stderr.on('data', bytes => { diagnostic = (diagnostic + bytes).slice(-4000); });
    return { child, messages,
      wait: async (predicate, timeoutMs = 20_000) => {
        const end = Date.now() + timeoutMs;
        while (Date.now() < end) {
          const found = messages.find(predicate); if (found) return found;
          if (lifecycle.terminal) throw new Error(`Runner exited early: ${diagnostic}`);
          await delay(10);
        }
        throw new Error(`Runner checkpoint timed out: ${diagnostic}`);
      },
      stop: async () => {
        if (!lifecycle.terminal) child.kill('SIGTERM');
        await h.bounded(lifecycle.done, 5000, 'Recording runner failed to stop');
        equal(lifecycle.exitInfo, { code: 0, signal: null }, 'recording runner stops cleanly');
      },
    };
  }

  async function realtimeDecoderFixture() {
    // exec preserves the decoder PID and group; no intermediate child survives.
    const marker = join(scratch, 'ffmpeg.pid'); const wrapper = join(scratch, 'ffmpeg-realtime');
    const quote = value => `'${value.replace(/'/g, "'\\''")}'`;
    const script = `#!/bin/sh\necho $$ > ${quote(marker)}\nexec ${quote(ffmpeg)} -re "$@"\n`;
    await writeFile(wrapper, script, { mode: 0o700 }); report.runtime.realtimeWrapperSha256 = hash(script);
    const configFile = join(scratch, 'slow-config.json');
    await writeFile(configFile, JSON.stringify({ ...config, recording: { ...config.recording, executable: wrapper } }), { mode: 0o600 });
    const decoderPid = async () => {
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        try {
          const pid = Number((await readFile(marker, 'utf8')).trim());
          if (h.exists(pid) && command('ps', ['-p', String(pid), '-o', 'comm=']) === ffmpeg) return pid;
        } catch { /* wait until the shell execs the actual FFmpeg executable */ }
        await delay(10);
      }
      throw new Error('Real FFmpeg process did not start');
    };
    return { configFile, marker, decoderPid };
  }

  if (h.cleanupFault) {
    if (!['fatal', 'SIGTERM', 'observer-timeout', 'observer-exit', 'observer-interrupt'].includes(h.cleanupFault) || !['runner', 'worker', 'direct'].includes(h.cleanupOwner)) throw new Error('Invalid merge cleanup fault');
    const id = 'merge-cleanup-fixture'; const f = await fixture(id, { seconds: 6.4 }); await enqueue(id, f);
    const slow = await realtimeDecoderFixture();
    let owned;
    if (h.cleanupOwner === 'direct') {
      const directContext = await store.openPoc(JSON.parse(await readFile(slow.configFile, 'utf8')));
      h.trackOperation(direct(id, {}, directContext).finally(() => directContext.close())).catch(() => {});
      owned = { child: process };
    } else owned = h.cleanupOwner === 'runner' ? runner({}, slow.configFile) : worker(id, undefined, undefined, { jobId: id, configFile: slow.configFile });
    const decoderPid = await slow.decoderPid();
    const decoderCommand = command('ps', ['-p', String(decoderPid), '-o', 'comm=']);
    await h.publishOwnership({ decoderPid });
    process.kill(decoderPid, 'SIGSTOP');
    // Cover both surviving stopped owners and owners that have already exited.
    if (h.cleanupOwner !== 'direct') {
      process.kill(owned.child.pid, h.cleanupFault === 'fatal' ? 'SIGKILL' : 'SIGSTOP');
      if (h.cleanupFault === 'fatal') {
        const deadline = Date.now() + 2000;
        while (h.exists(owned.child.pid) && Date.now() < deadline) await delay(10);
        ok(!h.exists(owned.child.pid), 'owner exited before harness cleanup starts');
      }
    }
    report.mergeCleanupFixture = { owner: h.cleanupOwner, fault: h.cleanupFault, ownerPid: owned.child.pid, decoderPid, decoderCommand,
      decoderGroup: Number(command('ps', ['-p', String(decoderPid), '-o', 'pgid='])), stoppedOwner: h.cleanupOwner !== 'direct' && h.cleanupFault !== 'fatal',
      ownerExitedBeforeCleanup: h.cleanupOwner !== 'direct' && h.cleanupFault === 'fatal', stoppedDecoder: true };
    await h.publishOwnership({ fixture: report.mergeCleanupFixture });
    if (h.cleanupFault === 'observer-exit') process.exit(17); // intentional skipped harness cleanup
    if (h.cleanupFault === 'observer-timeout' || h.cleanupFault === 'observer-interrupt') {
      process.kill(process.pid, 'SIGSTOP'); // observer must enforce its own timeout/interruption cleanup
      await new Promise(() => {});
    }
    if (h.cleanupFault === 'fatal') void Promise.reject(new Error('Injected merge harness fatal cleanup'));
    else process.kill(process.pid, h.cleanupFault);
    await new Promise(() => {});
  }

  await scenario('recording input and private adapter are explicit', async () => {
    equal(typeof store.enqueueRecordingMerge, 'function', 'real merge has a separate frozen-input enqueue entry');
    equal(typeof context.recording?.prepare, 'function', 'private local adapter is explicitly configured');
    await rejects(store.openPoc({ ...config, recording: { ...config.recording, root: '/tmp' } }), /explicit paths/);
    const missing = await store.openPoc({ ...config, recording: undefined });
    try { await rejects(store.enqueueRecordingMerge(missing, 'no-config', {}), /not configured/); } finally { await missing.close(); }
    const root = config.recording.root; await rename(root, `${root}-held`); await symlink(`${root}-held`, root);
    try { await rejects(store.openPoc(config), /not a symlink/); } finally { await unlink(root); await rename(`${root}-held`, root); }
  });

  for (const format of ['webm', 'mp4', 'ogg']) await scenario(`real ${format} merge and checked output readback`, async () => {
    const id = `happy-${format}`; const f = await fixture(id, { format, count: format === 'webm' ? 12 : 3 });
    ok(await enqueue(id, f), 'business input and queue committed');
    equal(await enqueue(id, f), null, 'identical job ID/input enqueue is idempotent');
    equal((await envelopes(id)).map(entry => entry.data), [{ jobId: id }], 'queue only carries the job ID');
    equal((await runWorker(`${id}-worker`, undefined, id)).status, 'succeeded', 'real child worker succeeds');
    const result = await read(id);
    equal(result.bytes, f.bytes, 'output bytes preserve numeric chunk ordering including index 10');
    equal(result.sha256, hash(f.bytes), 'disk readback hash matches source'); equal(result.byteSize, f.bytes.length, 'disk readback byte size matches');
    ok(result.durationMs >= 350 && result.durationMs <= 500, 'real FFmpeg decoded the expected sine duration');
    equal(await calls(id), 0, 'no synthetic provider calls for real media');
    equal((await artifacts(id)).map(a => a.published), [true], 'one published reference');
    equal((await envelopes(id)).map(a => a.state), ['completed'], 'publication and queue acknowledgment committed together');
    for (const chunk of f.task.chunks) equal(hash(await readFile(join(sources, context.recording.sourceName(f.task, chunk)))), chunk.sha256, 'source chunk remains unchanged');
    equal(await readdir(temporary), [], 'T04 temporary merge directories cleaned');
    await context.boss.send('saga-poc', { jobId: id });
    equal((await runWorker(`${id}-duplicate`, undefined, id)).status, 'duplicate', 'terminal redelivery cannot rerun merge');
    equal((await artifacts(id)).length, 1, 'redelivery does not publish another reference');
    return { format, chunkCount: f.task.chunks.length, bytes: f.bytes.length, durationMs: result.durationMs, sha256: result.sha256 };
  });

  await scenario('recording enqueue rollback and changed input rejection', async () => {
    const f = await fixture('enqueue-binding'); await enqueue('rolled-back-merge', f, { rollback: true });
    equal(await job('rolled-back-merge'), undefined, 'frozen input rolls back with business creation'); equal(await envelopes('rolled-back-merge'), [], 'queue creation rolls back too');
    await enqueue('enqueue-binding', f);
    await rejects(enqueue('same-input-other-id', f), /already bound to another job ID/);
    equal(await job('same-input-other-id'), undefined, 'canonical input cannot create a second business job');
    equal(await envelopes('same-input-other-id'), [], 'canonical input cannot create a second envelope under a new ID');
    for (const [field, value] of [['inputVersion', 2], ['sessionId', 'different'], ['mimeType', 'audio/ogg'], ['processorVersion', 'v2'], ['parameterVersion', 'v2'], ['assetId', 'asset-v2'], ['projectId', 'project-v2']]) {
      const changed = { ...f.task, [field]: value };
      if (field === 'sessionId' || field === 'projectId') changed.chunks = changed.chunks.map(chunk => ({ ...chunk, objectKey: `projects/${changed.projectId}/sessions/${changed.sessionId}/${chunk.index}` }));
      await rejects(store.enqueueRecordingMerge(context, 'enqueue-binding', context.recording.buildInput(changed)), /changed|different/);
    }
    await rejects(store.enqueueRecordingMerge(context, 'bad-manifest', { ...f.task, totalInputBytes: 1 }), /manifest/);
    await rejects(store.enqueueRecordingMerge(context, 'injected-path', { ...f.task, path: '/etc/passwd' }), /manifest/);
    await rejects(store.enqueueRecordingMerge(context, 'injected-chunk-path', { ...f.task, chunks: f.task.chunks.map(c => ({ ...c, path: '../../escape' })) }), /manifest/);
    await rejects(store.enqueueJob(context, 'enqueue-binding'), /already bound/);
    await rejects(store.enqueueRecordingMerge(context, 'review-merge', f.task, { review: true }), /synthetic review/);
    const tiny = await store.openPoc({ ...config, recording: { ...config.recording, maxInputBytes: 10 } });
    try { await rejects(store.enqueueRecordingMerge(tiny, 'oversize', f.task), /byte limit/); } finally { await tiny.close(); }
    const few = await store.openPoc({ ...config, recording: { ...config.recording, maxChunks: 1 } });
    try { await rejects(store.enqueueRecordingMerge(few, 'overchunks', f.task), /chunk limit/); } finally { await few.close(); }
    await settleFailed('enqueue-binding'); equal((await direct('enqueue-binding')).status, 'cancelled', 'cancelled pending entry settles');
  });

  await scenario('concurrent duplicate envelopes retain one real result', async () => {
    const id = 'concurrent-merge'; const f = await fixture(id); await enqueue(id, f);
    const first = worker(`${id}-first`, 'merge_prepared', undefined, { jobId: id }); await first.checkpoint();
    await context.boss.send('saga-poc', { jobId: id }); equal((await runWorker(`${id}-second`, undefined, id)).status, 'duplicate', 'live lease fences duplicate');
    await noPublication(id); first.resume(); equal((await first.result()).status, 'succeeded', 'owner publishes');
    equal((await read(id)).bytes, f.bytes, 'one original result remains readable'); equal(await calls(id), 0, 'duplicates do not enter simulated provider');
  });

  for (const fault of ['missing', 'hash', 'size', 'symlink', 'fifo', 'decode']) await scenario(`real source ${fault} fails closed`, async () => {
    const id = `source-${fault}`; const f = await fixture(id, fault === 'decode' ? { bytes: Buffer.from('invalid-but-hash-verified-recording'.repeat(20)) } : {});
    const path = join(sources, context.recording.sourceName(f.task, f.task.chunks[0]));
    if (fault === 'missing') await unlink(path);
    if (fault === 'hash') { const bytes = Buffer.from(f.parts[0]); bytes[0] ^= 1; await writeFile(path, bytes); }
    if (fault === 'size') await writeFile(path, Buffer.from('too short'));
    if (fault === 'symlink') { await unlink(path); await symlink(join(scratch, 'fixtures', 'sine-webm-0.4.webm'), path); }
    if (fault === 'fifo') { await unlink(path); command('mkfifo', ['-m', '600', path]); }
    await enqueue(id, f);
    if (fault === 'decode') {
      await rejects(direct(id), /Recording audio decode failed or emitted error diagnostics/);
      equal((await job(id)).snapshot.state, 'running', 'generic decoder rejection is an unclassified outcome');
    } else {
      equal((await direct(id)).status, 'failed', 'known source failure is durably terminal');
      equal((await job(id)).snapshot.state, 'failed');
    }
    await noPublication(id); equal(await readdir(temporary), [], 'failed read/decode cleans temporary merge files'); await settleFailed(id);
  });

  for (const field of ['id', 'projectId', 'sessionId', 'assetId', 'inputVersion', 'jobType', 'processorVersion', 'parameterVersion', 'modelConfigVersion', 'idempotencyKey']) {
    await scenario(`prepared result rejects changed ${field} identity`, async () => {
      const id = `binding-${field}`; const f = await fixture(id); await enqueue(id, f);
      const late = worker(`${id}-worker`, 'merge_prepared', undefined, { jobId: id }); await late.checkpoint();
      await mutateSnapshot(id, snapshot => { snapshot[field] = field === 'inputVersion' ? 2 : 'changed'; });
      const heartbeat = await late.heartbeat(); equal(heartbeat.ok, false, 'heartbeat rejects changed frozen identity');
      late.resume(); ok(/identity changed/.test(await late.failure()), 'late publication rejects identity mismatch');
      await noPublication(id); await settleFailed(id);
    });
  }

  for (const mutation of ['missing', 'corrupt', 'coherent']) await scenario(`prepared result rejects ${mutation} frozen manifest`, async () => {
    const id = `frozen-${mutation}`; const f = await fixture(id); await enqueue(id, f);
    const late = worker(`${id}-worker`, 'merge_prepared', undefined, { jobId: id }); await late.checkpoint();
    const row = await job(id);
    if (mutation === 'missing') row.frozen_input = null;
    else if (mutation === 'corrupt') row.frozen_input.task.chunks[0].sha256 = '0'.repeat(64);
    else {
      const task = context.recording.buildInput({ ...f.task, inputVersion: 2 });
      row.frozen_input = context.recording.freeze(id, task); row.snapshot.inputVersion = 2; row.snapshot.idempotencyKey = task.idempotencyKey;
    }
    await context.pool.query('UPDATE poc_jobs SET frozen_input = $2, snapshot = $3 WHERE id = $1', [id, row.frozen_input, row.snapshot]);
    late.resume(); ok(/frozen|manifest/.test(await late.failure()), 'claimed manifest cannot be replaced even with internally coherent data');
    await noPublication(id); await settleFailed(id);
  });

  await scenario('recording job cannot dispatch without its adapter or use synthetic review', async () => {
    const id = 'missing-adapter'; const f = await fixture(id); await enqueue(id, f);
    const missing = await store.openPoc({ ...config, recording: undefined });
    try { await rejects(direct(id, {}, missing), /not configured/); } finally { await missing.close(); }
    await noPublication(id); await settleFailed(id);
    const reviewed = await fixture('review-reject'); await enqueue('review-reject', reviewed);
    await context.pool.query('UPDATE poc_jobs SET review = true WHERE id = $1', ['review-reject']);
    await rejects(direct('review-reject'), /synthetic review/); await rejects(store.approveJob(context, 'review-reject'), /synthetic review/);
    for (const decision of ['reuse_prepared', 'controlled_retry', 'keep_unknown']) await rejects(store.reconcileUnknownJob(context, 'review-reject', { decision, revision: 0, approvedBy: 'fictional-reviewer', approvalRef: 'test-only' }), /synthetic review/);
    await noPublication('review-reject'); await settleFailed('review-reject');
  });

  for (const fault of ['cancel', 'deletion', 'revoke']) await scenario(`${fault} after prepare blocks publication`, async () => {
    const id = `late-${fault}`; const f = await fixture(id); await enqueue(id, f);
    const late = worker(`${id}-worker`, 'merge_prepared', undefined, { jobId: id }); const { info } = await late.checkpoint();
    ok((await readFile(outputPath(info.ref))).length > 0, 'fully prepared file exists privately');
    if (fault === 'cancel') await store.cancelJob(context, id);
    if (fault === 'deletion') await mutateSnapshot(id, snapshot => { snapshot.deletionRequestedAt = new Date().toISOString(); });
    if (fault === 'revoke') await context.pool.query('UPDATE poc_jobs SET allowed = false WHERE id = $1', [id]);
    late.resume(); equal((await late.result()).status, 'cancelled', 'late real output is not committed');
    await noPublication(id); equal(hash(await readFile(outputPath(info.ref))), hash(f.bytes), 'unreferenced private output is retained, never reused');
  });

  for (const fault of ['hash', 'missing', 'symlink']) await scenario(`prepared output ${fault} fails second readback`, async () => {
    const id = `prepared-${fault}`; const f = await fixture(id); await enqueue(id, f);
    const late = worker(`${id}-worker`, 'merge_prepared', undefined, { jobId: id }); const { info } = await late.checkpoint(); const path = outputPath(info.ref);
    if (fault === 'hash') { const changed = Buffer.from(f.bytes); changed[0] ^= 1; await writeFile(path, changed); }
    else { await unlink(path); if (fault === 'symlink') await symlink(join(sources, context.recording.sourceName(f.task, f.task.chunks[0])), path); }
    late.resume(); ok(/SHA256|ENOENT|ELOOP|symbolic/i.test(await late.failure()), 'second readback catches prepared output change');
    await noPublication(id); await settleFailed(id);
  });

  await scenario('published read rechecks permission deletion binding and disk', async () => {
    const id = 'published-checks'; const f = await fixture(id); await enqueue(id, f); equal((await direct(id)).status, 'succeeded'); const saved = await job(id);
    for (const change of ['allowed', 'cancelRequestedAt', 'deletionRequestedAt', 'inputVersion', 'frozen', 'artifact']) {
      if (change === 'allowed') await context.pool.query('UPDATE poc_jobs SET allowed = false WHERE id = $1', [id]);
      else if (change === 'frozen') await context.pool.query('UPDATE poc_jobs SET frozen_input = null WHERE id = $1', [id]);
      else if (change === 'artifact') await context.pool.query("UPDATE poc_artifacts SET metadata = jsonb_set(metadata, '{bindingDigest}', '\"mismatch\"') WHERE job_id = $1", [id]);
      else await mutateSnapshot(id, snapshot => { snapshot[change] = change === 'inputVersion' ? 2 : new Date().toISOString(); });
      await rejects(read(id), /unavailable|identity|missing|metadata/);
      await context.pool.query('UPDATE poc_jobs SET snapshot = $2, allowed = true, frozen_input = $3 WHERE id = $1', [id, saved.snapshot, saved.frozen_input]);
      if (change === 'artifact') await context.pool.query("UPDATE poc_artifacts SET metadata = jsonb_set(metadata, '{bindingDigest}', to_jsonb($2::text)) WHERE job_id = $1", [id, saved.frozen_input.digest]);
    }
    const artifact = (await artifacts(id))[0]; const path = outputPath(artifact.ref); const changed = Buffer.from(f.bytes); changed[0] ^= 1;
    await writeFile(path, changed); await rejects(read(id), /SHA256/); await unlink(path); await rejects(read(id), /ENOENT/);
    await symlink(join(sources, context.recording.sourceName(f.task, f.task.chunks[0])), path); await rejects(read(id), /ELOOP|symbolic/i);
    await unlink(path); await writeFile(path, f.bytes, { mode: 0o600 });
    const originalRead = context.recording.readOutput;
    context.recording.readOutput = async (...args) => { const bytes = await originalRead(...args); await context.pool.query('UPDATE poc_jobs SET allowed = false WHERE id = $1', [id]); return bytes; };
    try { await rejects(read(id), /unavailable/, 'revocation during actual disk read is rechecked afterward'); } finally { context.recording.readOutput = originalRead; }
  });

  for (const fault of ['lease', 'queue-attempt', 'queue-job', 'business-attempt']) await scenario(`${fault} loss after prepare fences publication`, async () => {
    const id = `lost-${fault}`; const f = await fixture(id); await enqueue(id, f);
    const late = worker(`${id}-worker`, 'merge_prepared', undefined, { jobId: id }); const { info } = await late.checkpoint();
    if (fault === 'lease') await mutateSnapshot(id, snapshot => { snapshot.leaseExpiresAt = new Date(Date.now() - 1).toISOString(); });
    if (fault === 'queue-attempt') await context.pool.query('UPDATE pgboss.job SET retry_count = retry_count + 1 WHERE id = $1', [info.queueId]);
    if (fault === 'queue-job') await context.pool.query('UPDATE pgboss.job SET data = $2 WHERE id = $1', [info.queueId, { jobId: 'different-job' }]);
    if (fault === 'business-attempt') await context.pool.query("UPDATE poc_attempts SET input_digest = 'changed' WHERE job_id = $1", [id]);
    late.resume(); equal((await late.result()).status, fault === 'lease' ? 'unknown' : 'duplicate', 'late result is fenced');
    await noPublication(id);
    if (fault !== 'lease') equal((await context.boss.findJobs('saga-poc', { id: info.queueId }))[0].state, 'active', 'lost claim is not acknowledged');
    if (fault === 'queue-job') await context.pool.query('UPDATE pgboss.job SET data = $2 WHERE id = $1', [info.queueId, { jobId: id }]);
    await settleFailed(id);
  });

  await scenario('lease expires during final real publication transaction', async () => {
    const id = 'expired-real-commit'; const f = await fixture(id); await enqueue(id, f);
    const late = worker(`${id}-worker`, 'before_commit', undefined, { jobId: id }); await late.checkpoint();
    await noPublication(id);
    await delay(5_200); late.resume();
    equal((await late.result()).status, 'unknown', 'expired final transaction rolls back and quarantines the result');
    await noPublication(id); equal((await job(id)).snapshot.state, 'outcome_unknown');
  });

  for (const stage of ['merge_prepared', 'before_commit']) await scenario(`process death at ${stage} retains only private orphan`, async () => {
    const id = `kill-${stage}`; const f = await fixture(id); const queueId = await enqueue(id, f, { expireInSeconds: 5, heartbeatSeconds: 10 });
    const doomed = worker(`${id}-worker`, stage, undefined, { jobId: id }); const { info } = await doomed.checkpoint();
    equal(hash(await readFile(outputPath(info.ref))), hash(f.bytes), 'durable private output exists before COMMIT');
    await noPublication(id); await doomed.kill(); await noPublication(id); await h.expireAndSupervise(queueId);
    equal((await runWorker(`${id}-replacement`, undefined, id)).status, 'unknown', 'running process death is conservatively quarantined'); equal((await job(id)).snapshot.state, 'outcome_unknown');
    await noPublication(id); equal(hash(await readFile(outputPath(info.ref))), hash(f.bytes), 'orphan retained without automatic reuse');
    await rejects(store.reconcileUnknownJob(context, id, { decision: 'reuse_prepared', revision: Number((await job(id)).revision) }), /synthetic review/);
    return { fault: 'actual child SIGKILL', stage };
  });

  await scenario('old pre-dispatch worker cannot overwrite replacement output', async () => {
    const id = 'old-real-worker'; const f = await fixture(id); const queueId = await enqueue(id, f, { expireInSeconds: 5, heartbeatSeconds: 10 });
    const old = worker(`${id}-old`, 'leased', undefined, { jobId: id }); await old.checkpoint(); await h.expireAndSupervise(queueId);
    equal((await runWorker(`${id}-replacement`, undefined, id)).status, 'succeeded'); const first = (await artifacts(id))[0].ref;
    old.resume(); equal((await old.result()).status, 'duplicate'); equal((await artifacts(id))[0].ref, first, 'stale owner cannot replace committed output');
    equal((await read(id)).bytes, f.bytes); equal(await calls(id), 0);
  });

  for (const committed of [false, true]) await scenario(`COMMIT response fault with database commit ${committed}`, async () => {
    const id = `commit-fault-${committed}`; const f = await fixture(id); await enqueue(id, f);
    const originalConnect = context.pool.connect; let armed = false; let preparedRef;
    context.pool.connect = function (...args) {
      if (args.some(value => typeof value === 'function')) return originalConnect.apply(this, args);
      return originalConnect.apply(this, args).then(client => ({ query: async (...queryArgs) => {
        if (armed && queryArgs[0] === 'COMMIT') { armed = false; if (committed) await client.query(...queryArgs); throw new Error('Injected unknown COMMIT response'); }
        return client.query(...queryArgs);
      }, release: () => client.release() }));
    };
    try { await rejects(direct(id, { checkpoint: async (stage, info) => { if (stage === 'merge_prepared') preparedRef = info.ref; if (stage === 'before_commit') armed = true; } }), /unknown COMMIT/); }
    finally { context.pool.connect = originalConnect; }
    equal(hash(await readFile(outputPath(preparedRef))), hash(f.bytes), 'uncertain COMMIT never deletes fully prepared file');
    if (committed) { equal((await read(id)).bytes, f.bytes, 'actual committed reference still reads despite lost acknowledgment'); equal((await envelopes(id)).map(e => e.state), ['completed']); }
    else { await noPublication(id); await settleFailed(id); }
    return { fault: 'client query wrapper throws instead of returning COMMIT response', actualDatabaseCommit: committed };
  });

  await scenario('abort immediately before real publication COMMIT rolls back', async () => {
    const id = 'real-aborted-commit'; const f = await fixture(id); await enqueue(id, f); const abort = new AbortController(); let ref;
    await rejects(direct(id, { signal: abort.signal, checkpoint: async (stage, info) => {
      if (stage === 'before_commit') { ref = info.ref; abort.abort(new Error('Injected final cancellation')); }
    } }), /final cancellation/);
    await noPublication(id); equal(hash(await readFile(outputPath(ref))), hash(f.bytes), 'complete private object remains unreferenced'); await settleFailed(id);
  });

  for (const fault of ['abort', 'timeout']) await scenario(`${fault} during local source iteration cooperates and cleans`, async () => {
    const id = `read-${fault}`; const f = await fixture(id); await enqueue(id, f);
    const task = new AbortController(); let sawRead = false;
    const ctx = fault === 'timeout' ? await store.openPoc({ ...config, recording: { ...config.recording, ioTimeoutMs: 100 } }) : context;
    try {
      const processing = direct(id, { signal: task.signal, checkpoint: async (stage, _info, operationSignal) => {
        if (stage !== 'merge_read') return; sawRead = true;
        if (fault === 'abort') task.abort(new Error('Injected read cancellation'));
        await delay(10_000, undefined, { signal: operationSignal });
      } }, ctx);
      if (fault === 'timeout') equal((await processing).status, 'retry_wait', 'owned source timeout persists bounded retry');
      else await rejects(processing, /abort|cancel|timed out/i);
    } finally { if (ctx !== context) await ctx.close(); }
    ok(sawRead, 'actual local stream yielded bytes before injected pause'); equal(await readdir(temporary), [], 'cancelled iteration closes and removes temporary merge');
    await noPublication(id); await settleFailed(id);
    return { fault: 'cancellable checkpoint pause while the actual file stream is open' };
  });

  await scenario('continuous runner heartbeats through a labeled read pause', async () => {
    const id = 'runner-read-heartbeat'; const f = await fixture(id); await enqueue(id, f);
    const owned = runner({ mergePauseStage: 'merge_read', mergePauseMs: 6_200 });
    const result = await owned.wait(message => message.type === 'result' && message.result.jobId === id); equal(result.result.status, 'succeeded');
    const heartbeats = owned.messages.filter(message => message.type === 'heartbeat' && message.info.jobId === id);
    ok(heartbeats.length >= 5, 'automatic heartbeat covers more than one original business lease');
    equal((await read(id)).bytes, f.bytes); equal(await calls(id), 0); await owned.stop();
    return { fault: '6200 ms cancellable read checkpoint pause, not claimed decoder CPU time', heartbeats: heartbeats.length };
  });

  for (const fault of ['stop', 'revoke', 'deletion']) await scenario(`runner ${fault} during read stops uncommitted work`, async () => {
    const id = `runner-read-${fault}`; const f = await fixture(id); await enqueue(id, f);
    const owned = runner({ mergePauseStage: 'merge_read', mergePauseMs: 10_000 }); await owned.wait(message => message.type === 'checkpoint' && message.stage === 'merge_read');
    if (fault === 'stop') await owned.stop();
    else {
      if (fault === 'revoke') await context.pool.query('UPDATE poc_jobs SET allowed = false WHERE id = $1', [id]);
      else await mutateSnapshot(id, snapshot => { snapshot.deletionRequestedAt = new Date().toISOString(); });
      await owned.wait(message => message.type === 'heartbeat_failed'); await owned.wait(message => message.type === 'task_interrupted'); await owned.stop();
    }
    equal(await readdir(temporary), [], 'runner interruption closes source and cleans merge temp'); await noPublication(id); await settleFailed(id);
    return { fault: '10000 ms cancellable read checkpoint pause' };
  });

  // This wrapper execs the same real local FFmpeg. -re throttles its input clock;
  // it does not simulate expensive decoder CPU work or spawn a surviving grandchild.
  const { marker, configFile: slowConfigFile, decoderPid } = await realtimeDecoderFixture();
  for (const stop of [false, true]) await scenario(`real FFmpeg input throttling with runner ${stop ? 'shutdown' : 'heartbeats'}`, async () => {
    const id = `runner-decode-${stop}`; const f = await fixture(id, { seconds: 6.4 }); await enqueue(id, f); await unlink(marker).catch(() => {});
    const owned = runner({}, slowConfigFile); await owned.wait(message => message.type === 'checkpoint' && message.stage === 'merge_decode');
    const pid = await decoderPid(); ok(h.exists(pid), 'actual FFmpeg subprocess is alive during decoding'); await owned.wait(message => message.type === 'heartbeat');
    if (stop) { await owned.stop(); ok(!h.exists(pid), 'AbortSignal shutdown killed and joined the actual FFmpeg subprocess'); await noPublication(id); await settleFailed(id); }
    else {
      const result = await owned.wait(message => message.type === 'result' && message.result.jobId === id); equal(result.result.status, 'succeeded');
      const heartbeats = owned.messages.filter(message => message.type === 'heartbeat'); ok(heartbeats.length >= 5, 'heartbeats remain active through actual throttled decoder process');
      equal((await read(id)).bytes, f.bytes); ok(!h.exists(pid), 'completed decoder child is reaped'); await owned.stop();
    }
    equal(await readdir(temporary), [], 'decoder work cleans its temporary merged file');
    return { fault: 'shell exec wrapper adds FFmpeg -re (real-time input throttling)', decoderPid: pid, shutdown: stop };
  });
  equal(context.errors.map(error => error.message), [], 'no unhandled queue or pool errors');
}

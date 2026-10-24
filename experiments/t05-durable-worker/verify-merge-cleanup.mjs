import assert from 'node:assert/strict';
import { execFile, fork } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';

// The observer owns each exact spawned harness and receives early ownership
// snapshots over that child's IPC channel. Cleanup never depends on a successful
// exit or a completed evidence file, and every process/command wait is bounded.
const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const output = resolve(args.find(arg => !arg.startsWith('--')) ?? join(here, `cleanup-check-${Date.now()}.json`));
const childEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PG') && key !== 'DATABASE_URL'));
const report = { startedAt: new Date().toISOString(), scenarios: [], sources: {}, status: 'passed' };
const exists = pid => { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; if (error.code === 'EPERM') return true; throw error; } };
const signal = (pid, value) => { try { process.kill(pid, value); } catch (error) { if (!['ESRCH', 'EPERM'].includes(error.code)) throw error; } };
const validPid = value => Number.isSafeInteger(value) && value > 1;
const privateScratch = value => typeof value === 'string' && /^\/tmp\/saga-t05-[A-Za-z0-9_-]+$/.test(value);
let active; let interruption; let fatalError;
for (const name of ['SIGINT', 'SIGTERM']) process.on(name, () => { interruption ??= name; });
process.once('disconnect', () => { interruption ??= 'SIGTERM'; });
process.once('unhandledRejection', error => { fatalError = error; interruption ??= 'failure'; });
process.once('uncaughtException', error => { fatalError = error; interruption ??= 'failure'; });

async function bounded(promise, milliseconds, label) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), milliseconds); })]); }
  finally { clearTimeout(timer); }
}
async function until(predicate, milliseconds) {
  const deadline = Date.now() + milliseconds;
  while (!predicate() && Date.now() < deadline) await delay(20);
  return predicate();
}
async function command(bin, values, timeout = 5_000) {
  try { return { code: 0, ...(await promisify(execFile)(bin, values, { env: childEnv, encoding: 'utf8', timeout, maxBuffer: 32 * 1024 })) }; }
  catch (error) { return { code: error.code, killed: error.killed, stdout: error.stdout ?? '', stderr: error.stderr ?? error.message }; }
}
async function writeReport() {
  await bounded(writeFile(output, JSON.stringify(report, null, 2) + '\n'), 5_000, 'Observer evidence write timed out');
}
function receiveOwnership(record, message) {
  if (message?.type !== 'harness_ownership') return;
  try {
    const snap = message.snapshot;
    if (snap?.version !== 1 || snap.harnessPid !== record.child.pid || !privateScratch(snap.scratch) ||
        !Array.isArray(snap.groupIds) || !Array.isArray(snap.decoderPids) ||
        ![...snap.groupIds, ...snap.decoderPids].every(validPid)) throw new Error('Invalid harness ownership snapshot');
    if (record.scratch && record.scratch !== snap.scratch) throw new Error('Harness ownership directory changed');
    if (snap.postmasterPid !== undefined && !validPid(snap.postmasterPid)) throw new Error('Invalid owned postmaster PID');
    record.scratch = snap.scratch;
    record.clusterMayHaveStarted ||= snap.clusterMayHaveStarted === true;
    record.clusterStoppedByHarness = snap.clusterStopped === true;
    if (snap.postmasterPid !== undefined) record.postmasterPid = snap.postmasterPid;
    for (const group of snap.groupIds) record.groups.add(group);
    for (const pid of snap.decoderPids) record.decoders.add(pid);
    if (snap.fixture) {
      const f = snap.fixture;
      if (f.owner !== record.spec.owner || !validPid(f.ownerPid) || !record.decoders.has(f.decoderPid)) throw new Error('Invalid owned decoder fixture');
      record.fixture = f;
      record.fixtureAt ??= Date.now();
      record.fixtureObservedAlive ??= exists(f.decoderPid);
    }
    record.snapshotCount += 1;
  } catch (error) { record.protocolError = error; }
}

async function discoverStoppedHarnessChildren(record) {
  // Freeze the still-live harness before fallback discovery. This closes the
  // fork-to-IPC window without trusting arbitrary system PIDs or sibling groups.
  if (!record.exit && exists(record.child.pid)) {
    signal(-record.child.pid, 'SIGSTOP');
    await delay(20); // queued IPC snapshots can still reach this observer
    const result = await command('ps', ['-axo', 'pid=,ppid=,pgid=']);
    if (result.code !== 0) throw new Error('Could not inspect stopped owned harness descendants');
    const rows = result.stdout.trim().split('\n').map(line => line.trim().split(/\s+/).map(Number));
    const descendants = new Set([record.child.pid]);
    for (let previous = -1; previous !== descendants.size;) {
      previous = descendants.size;
      for (const [pid, parent] of rows) if (descendants.has(parent)) descendants.add(pid);
    }
    for (const [pid, , group] of rows) if (descendants.has(pid) && validPid(group)) record.groups.add(group);
  }
}

async function cleanupOwned(record) {
  if (record.cleanupPromise) return record.cleanupPromise;
  record.cleanupPromise = (async () => {
    const started = Date.now(); const errors = []; const forcedGroups = [];
    // Cooperative cleanup gets a chance to abort/join FFmpeg and stop its cluster.
    if (!record.exit && record.child.pid) signal(record.child.pid, 'SIGTERM');
    if (!record.exit) await until(() => !!record.exit, 6_000);
    if (!record.exit) {
      try { await discoverStoppedHarnessChildren(record); } catch (error) { errors.push(error.message); }
    }
    const groups = () => new Set([...record.groups, ...(record.child.pid ? [record.child.pid] : [])]); // this fork was detached
    for (const group of groups()) if (exists(-group)) signal(-group, 'SIGTERM');
    await until(() => [...groups()].every(group => !exists(-group)), 1_000);
    // Keep consuming ownership messages until IPC closes. Even a late queued
    // snapshot must be included before residual accounting or scratch deletion.
    const deadline = Date.now() + 3_000;
    while (Date.now() < deadline) {
      for (const group of groups()) if (exists(-group) && !forcedGroups.includes(group)) { signal(-group, 'SIGKILL'); forcedGroups.push(group); }
      for (const pid of record.decoders) if (exists(pid)) signal(pid, 'SIGKILL');
      if (record.exit && !record.child.connected && [...groups()].every(group => !exists(-group)) && [...record.decoders].every(pid => !exists(pid))) break;
      await delay(20);
    }
    const ownershipComplete = !!record.exit && !record.child.connected;
    const remainingGroups = [...groups()].filter(group => exists(-group));
    const remainingDecoders = [...record.decoders].filter(exists);
    if (!record.exit) errors.push('Owned harness exit was not confirmed within the bounded stop');
    if (!ownershipComplete) errors.push('Owned harness IPC did not close; resource ownership may be incomplete');
    if (remainingGroups.length || remainingDecoders.length) errors.push('Owned harness descendants remain');

    let clusterStopped = false; let tempDirectoryRemoved = false; let usedFallbackPgStop = false;
    if (!record.scratch) errors.push('No early ownership snapshot; private-cluster cleanup cannot be proven');
    else {
      try {
        const stat = await bounded(lstat(record.scratch).catch(error => { if (error.code === 'ENOENT') return null; throw error; }), 3_000, 'Owned scratch check timed out');
        if (stat && (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0)) throw new Error('Refusing cleanup of nonprivate owned scratch');
        if (!stat) {
          clusterStopped = record.postmasterPid !== undefined ? !exists(record.postmasterPid) : !record.clusterMayHaveStarted || record.clusterStoppedByHarness;
          tempDirectoryRemoved = true;
          if (!clusterStopped) throw new Error('Scratch is missing but owned PostgreSQL shutdown is unconfirmed');
        } else {
          const data = join(record.scratch, 'data');
          if (!record.clusterMayHaveStarted) clusterStopped = true;
          else {
            const dataStat = await bounded(lstat(data), 3_000, 'Owned data-directory check timed out');
            if (!dataStat.isDirectory() || dataStat.isSymbolicLink()) throw new Error('Refusing non-directory owned PostgreSQL data path');
            let status = await command('pg_ctl', ['-D', data, 'status']);
            if (status.code === 0) {
              usedFallbackPgStop = true;
              const stopped = await command('pg_ctl', ['-D', data, '-m', 'immediate', '-w', '-t', '10', 'stop'], 12_000);
              if (stopped.code !== 0) throw new Error(`Owned PostgreSQL stop unconfirmed: ${stopped.stderr.trim()}`);
              status = await command('pg_ctl', ['-D', data, 'status']);
            }
            clusterStopped = status.code === 3 && (!record.postmasterPid || !exists(record.postmasterPid));
            if (!clusterStopped) throw new Error('Owned PostgreSQL still running or status unconfirmed');
          }
          // A live/unconfirmed cluster or descendant keeps its files for recovery.
          if (clusterStopped && ownershipComplete && !remainingGroups.length && !remainingDecoders.length && !errors.length && !record.protocolError) {
            await bounded(rm(record.scratch, { recursive: true, force: true }), 5_000, 'Owned scratch removal timed out');
            tempDirectoryRemoved = await bounded(lstat(record.scratch).then(() => false, error => { if (error.code === 'ENOENT') return true; throw error; }), 3_000, 'Owned scratch removal check timed out');
          }
        }
      } catch (error) { errors.push(error.message); }
    }
    if (!clusterStopped) errors.push('Owned private PostgreSQL shutdown not proven; retained existing data');
    const result = { elapsedMs: Date.now() - started, harnessExited: !!record.exit, ownershipComplete, remainingGroups, remainingDecoders,
      clusterStopped, tempDirectoryRemoved, usedFallbackPgStop, forcedGroups, errors };
    // Do not leave the observer itself hanging on a descendant's inherited I/O,
    // including when the direct owner exited but descendant termination failed.
    if (record.child.connected) record.child.disconnect();
    record.child.stdout?.destroy(); record.child.stderr?.destroy(); record.child.unref();
    return result;
  })();
  return record.cleanupPromise;
}

async function runCase(spec) {
  const evidence = output.replace(/\.json$/, '') + `-${spec.owner}-${spec.fault}.json`;
  const item = { ...spec, evidence, status: 'failed' }; report.scenarios.push(item);
  const child = fork(join(here, 'verify.mjs'), ['--only-merge', `--merge-cleanup-fault=${spec.fault}`, `--merge-cleanup-owner=${spec.owner}`, evidence], { env: childEnv, silent: true, detached: true });
  const record = { child, spec, groups: new Set(), decoders: new Set(), snapshotCount: 0, clusterMayHaveStarted: false };
  active = record; item.harnessPid = child.pid;
  let diagnostic = ''; let primaryError;
  child.stdout.on('data', bytes => { diagnostic = (diagnostic + bytes).slice(-4000); });
  child.stderr.on('data', bytes => { diagnostic = (diagnostic + bytes).slice(-4000); });
  child.once('exit', (code, signal) => { record.exit = { code, signal }; });
  child.once('error', error => { record.spawnError = error; if (!child.pid) record.exit = { code: null, signal: null }; });
  child.on('message', message => receiveOwnership(record, message));
  try {
    const deadline = Date.now() + 25_000; let timedOut = false; let injectedSignal = false;
    while (!record.exit && !record.spawnError && !record.protocolError && !interruption && Date.now() < deadline) {
      if (spec.fault === 'observer-timeout' && record.fixtureAt && Date.now() - record.fixtureAt >= 250) { timedOut = true; break; }
      if (spec.fault === 'observer-interrupt' && record.fixtureAt && Date.now() - record.fixtureAt >= 100 && !injectedSignal) { injectedSignal = true; process.kill(process.pid, 'SIGTERM'); }
      await delay(20);
    }
    item.exit = record.exit; item.fixture = record.fixture;
    item.ownership = { scratch: record.scratch, postmasterPid: record.postmasterPid, groupIds: [...record.groups], decoderPids: [...record.decoders], snapshotCount: record.snapshotCount };
    item.decoderAliveAtObservation = record.fixture ? exists(record.fixture.decoderPid) : undefined;
    item.clusterAliveAtObservation = record.postmasterPid ? exists(record.postmasterPid) : undefined;
    // Raw evidence is useful even after an unexpected exit; it is not ownership.
    try { item.raw = JSON.parse(await bounded(readFile(evidence, 'utf8'), 3_000, 'Raw harness evidence read timed out')); }
    catch (error) { item.rawEvidenceError = error.code ?? error.message; }
    if (record.spawnError) throw record.spawnError;
    if (record.protocolError) throw record.protocolError;
    assert.ok(record.fixture, 'early IPC must identify the actual decoder before the injected fault');
    if (spec.fault === 'observer-timeout') { assert.equal(timedOut, true); item.expectedFaultObserved = 'observer timeout'; }
    else if (spec.fault === 'observer-exit') { assert.deepEqual(record.exit, { code: 17, signal: null }); item.expectedFaultObserved = 'unexpected harness exit'; }
    else if (spec.fault === 'observer-interrupt') { assert.equal(interruption, 'SIGTERM'); item.expectedFaultObserved = 'actual observer SIGTERM'; }
    else {
      assert.ok(record.exit, 'fault harness must exit within 25 seconds');
      assert.deepEqual(record.exit, { code: spec.fault === 'fatal' ? 1 : 143, signal: null });
      assert.equal(item.decoderAliveAtObservation, false, 'real FFmpeg must be dead before successful harness cleanup is accepted');
      assert.deepEqual(item.raw?.cleanup, { ownedChildrenRemaining: 0, clusterStopped: true, tempDirectoryRemoved: true, errors: [] });
      assert.deepEqual(item.raw.processOwnership.remainingGroups, []);
      assert.equal(item.raw.processOwnership.directOperationsRemaining, 0);
      if (spec.owner !== 'direct') {
        assert.equal(record.fixture.decoderGroup, record.fixture.ownerPid);
        assert.ok(item.raw.processOwnership.groupIds.includes(record.fixture.ownerPid));
        if (spec.fault === 'SIGTERM') assert.ok(item.raw.processOwnership.forcedGroupKills.includes(record.fixture.ownerPid));
      }
    }
    if (spec.fault.startsWith('observer-')) {
      assert.equal(record.fixtureObservedAlive, true, 'injected observer failure starts during actual live decoding');
      assert.equal(item.clusterAliveAtObservation, true, 'the observer must recover an actually running private cluster');
    }
  } catch (error) { primaryError = error; item.error = error.stack ?? String(error); }
  finally {
    try { item.observerCleanup = await cleanupOwned(record); }
    catch (error) { item.observerCleanup = { errors: [error.stack ?? String(error)] }; }
    item.exitAfterCleanup = record.exit; item.diagnostic = diagnostic;
    if (record.fixture) item.decoderAliveAfterCleanup = exists(record.fixture.decoderPid);
    active = undefined;
  }
  try {
    assert.deepEqual(item.observerCleanup.errors, [], 'observer must prove cleanup even after its own failure');
    assert.equal(item.observerCleanup.harnessExited, true);
    assert.equal(item.observerCleanup.ownershipComplete, true);
    assert.deepEqual(item.observerCleanup.remainingGroups, []);
    assert.deepEqual(item.observerCleanup.remainingDecoders, []);
    assert.equal(item.observerCleanup.clusterStopped, true);
    assert.equal(item.observerCleanup.tempDirectoryRemoved, true);
    if (record.fixture) assert.equal(item.decoderAliveAfterCleanup, false);
    if (spec.fault.startsWith('observer-')) assert.equal(item.observerCleanup.usedFallbackPgStop, true, 'observer independently stops its exact owned cluster');
    if (primaryError) throw primaryError;
    item.status = 'passed'; console.log(`PASS decoder cleanup ${spec.owner} ${spec.fault}`);
  } catch (error) { item.error ??= error.stack ?? String(error); report.status = 'failed'; console.error(`FAIL decoder cleanup ${spec.owner} ${spec.fault}: ${error.message}`); }
  await writeReport();
}

try {
  await bounded(mkdir(dirname(output), { recursive: true }), 5_000, 'Observer evidence directory timed out');
  for (const name of ['verify.mjs', 'merge-scenarios.mjs', 'verify-merge-cleanup.mjs', 'worker.mjs', 'runner.mjs']) {
    report.sources[name] = createHash('sha256').update(await bounded(readFile(join(here, name)), 3_000, 'Observer source fingerprint timed out')).digest('hex');
  }
  const specs = args.includes('--observer-faults')
    ? [{ owner: 'runner', fault: 'observer-timeout' }, { owner: 'worker', fault: 'observer-exit' }]
    : args.includes('--observer-interrupt') ? [{ owner: 'direct', fault: 'observer-interrupt' }]
      : ['runner', 'worker', 'direct'].flatMap(owner => ['fatal', 'SIGTERM'].map(fault => ({ owner, fault })));
  for (const spec of specs) { if (interruption) break; await runCase(spec); }
} catch (error) { fatalError = error; report.status = 'failed'; report.error = error.stack ?? String(error); }
finally {
  if (active) { try { report.finalCleanup = await cleanupOwned(active); } catch (error) { report.cleanupError = error.message; } }
  report.finishedAt = new Date().toISOString();
  if (fatalError) { report.status = 'failed'; report.error = fatalError.stack ?? String(fatalError); }
  else if (interruption) { if (report.status !== 'failed') report.status = 'interrupted'; report.signal = interruption; }
  try { await writeReport(); } catch (error) { report.status = 'failed'; console.error(error.message); }
}
console.log(`${report.status}: ${report.scenarios.length} decoder cleanup scenarios; ${output}`);
process.exitCode = report.status === 'failed' ? 1 : interruption === 'SIGINT' ? 130 : interruption === 'SIGTERM' ? 143 : 0;

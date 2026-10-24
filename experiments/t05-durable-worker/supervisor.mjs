import { fork } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { openPoc } from './store.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const lifetime = new AbortController();
let context;
let current;
let consecutiveFailures = 0;
const childEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PG') && key !== 'DATABASE_URL'));
function observe(message) {
  return new Promise(resolve => {
    if (!process.connected) return resolve();
    process.send({ ...message, supervisorPid: process.pid }, () => resolve());
  });
}
const stopRunnerSignal = () => {
  if (!current || current.closed || current.stopRequested) return;
  current.stopRequested = true;
  current.child.kill('SIGTERM');
};
const stop = () => {
  lifetime.abort();
  stopRunnerSignal();
};
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, stop);
process.once('disconnect', stop);

async function waitForRunner(done) {
  let timer;
  try {
    return await Promise.race([done.then(() => true), new Promise(resolve => { timer = setTimeout(() => resolve(false), 2_000); })]);
  } finally { clearTimeout(timer); }
}

function preserveRunnerFailure(outcome) {
  if (outcome && (outcome.code !== 0 || outcome.signal !== null || outcome.error)) {
    process.exitCode = 1;
    observe({ type: 'cleanup_error', error: 'Owned runner failed during shutdown', outcome });
  }
}

async function stopRunner() {
  if (!current) return;
  if (current.closed) { preserveRunnerFailure(current.outcome); return; }
  stopRunnerSignal();
  if (await waitForRunner(current.done)) { preserveRunnerFailure(current.outcome); return; }
  current.child.kill('SIGKILL');
  process.exitCode = 1;
  observe({ type: 'cleanup_error', error: 'Owned runner required SIGKILL during shutdown' });
  if (!await waitForRunner(current.done)) throw new Error('Owned runner did not terminate');
}

try {
  const [configFile, rawOptions = '{}'] = process.argv.slice(2);
  if (!configFile || process.argv.length > 4) throw new Error('Usage: node supervisor.mjs CONFIG_FILE [OPTIONS_JSON]');
  const options = JSON.parse(rawOptions);
  context = await openPoc(JSON.parse(await readFile(configFile, 'utf8')), { supervise: true });
  const databaseError = error => { process.exitCode = 1; observe({ type: 'supervisor_error', error: error.message }); stop(); };
  context.boss.on('error', databaseError);
  context.pool.on('error', databaseError);
  if (context.errors.length) throw context.errors[0];
  observe({ type: 'supervisor_ready' });
  // IPC is observation/fault injection only. No heartbeat, continue, fetch or
  // manual supervise message is accepted; autonomous operation starts immediately.
  process.on('message', message => {
    if (options.allowFaults && message?.type === 'fault' && message.signal === 'SIGKILL') current?.child.kill('SIGKILL');
  });
  while (!lifetime.signal.aborted) {
    let child;
    let outcome;
    try {
      child = fork(join(here, 'runner.mjs'), [configFile, JSON.stringify({ durationMs: options.durationMs, leasedDelayMs: options.leasedDelayMs, beforeDispatchDelayMs: options.allowFaults ? options.beforeDispatchDelayMs : undefined, failOnStop: options.allowFaults && options.failOnStop })], {
        env: childEnv, silent: true,
        ...(options.allowFaults && options.runnerExecPath ? { execPath: options.runnerExecPath } : {}),
      });
      const owned = { child, closed: false };
      current = owned;
      owned.done = new Promise(resolve => {
        let spawnError;
        const finish = (code, signal) => {
          if (owned.closed) return;
          owned.closed = true;
          owned.outcome = { code, signal, error: spawnError?.message };
          resolve(owned.outcome);
        };
        child.once('error', error => { spawnError = error; if (!child.pid) finish(null, null); });
        child.once('close', finish);
      });
      child.stdout.on('data', data => process.stdout.write(data));
      child.stderr.on('data', data => process.stderr.write(data));
      child.on('message', message => {
        if (message.type === 'result' && ['succeeded', 'review'].includes(message.result.status)) consecutiveFailures = 0;
        observe(message);
      });
      observe({ type: 'runner_spawn', pid: child.pid ?? null });
      // A shutdown request must reach stopRunner even if a child is stuck in I/O.
      let onAbort;
      try {
        outcome = await Promise.race([
          owned.done,
          new Promise(resolve => {
            onAbort = () => resolve(null);
            if (lifetime.signal.aborted) return onAbort();
            lifetime.signal.addEventListener('abort', onAbort, { once: true });
          }),
        ]);
      } finally {
        lifetime.signal.removeEventListener('abort', onAbort);
      }
      if (lifetime.signal.aborted) break;
    } catch (error) {
      outcome = { code: null, signal: null, error: error.message };
    }
    observe({ type: 'runner_exit', ...outcome });
    consecutiveFailures += 1;
    if (consecutiveFailures > 3) throw new Error('Runner restart limit exhausted after 3 restarts');
    const backoffMs = 100 * 2 ** (consecutiveFailures - 1);
    observe({ type: 'restart', consecutiveFailures, backoffMs });
    await delay(backoffMs, undefined, { signal: lifetime.signal }).catch(error => {
      if (!lifetime.signal.aborted) throw error;
    });
    if (context.errors.length) throw context.errors[0];
  }
} catch (error) {
  process.exitCode = 1;
  observe({ type: 'supervisor_error', error: error.message });
  process.stderr.write(`${error.stack ?? error}\n`);
} finally {
  stop();
  let forceExit = false;
  try { await stopRunner(); }
  catch (error) { process.exitCode = 1; forceExit = true; observe({ type: 'cleanup_error', error: error.message }); }
  if (context) {
    const closing = context.close();
    const bounded = async (promise, label) => {
      let timer;
      try {
        return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), 1_000); })]);
      } finally { clearTimeout(timer); }
    };
    try {
      await bounded(closing, 'Database close exceeded 1s; cancelling owned maintenance queries');
    } catch (error) {
      process.exitCode = 1;
      observe({ type: 'cleanup_error', error: error.message });
      try {
        const cancelled = await bounded(context.cancelPendingQueries(), 'Owned query cancellation exceeded 1s');
        observe({ type: 'database_queries_cancelled', cancelled });
        await bounded(closing, 'Database close still blocked after cancellation');
      } catch (cancelError) {
        forceExit = true;
        observe({ type: 'cleanup_error', error: cancelError.message });
      }
    }
  }
  // pg-boss stop can await an in-flight maintenance query indefinitely. At this
  // bounded failure boundary the runner is already stopped (or an explicit
  // cleanup error was reported); process exit closes our remaining DB sockets.
  let flushDeadline;
  try {
    await Promise.race([
      observe({ type: 'supervisor_stopped', exitCode: process.exitCode ?? 0, forcedDatabaseClose: forceExit }),
      new Promise(resolve => { flushDeadline = setTimeout(resolve, 100); }),
    ]);
  } finally { clearTimeout(flushDeadline); }
  if (process.connected) process.disconnect();
  if (forceExit) process.exit(1);
}

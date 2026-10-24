import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { openPoc, processOne, heartbeatJob } from './store.mjs';

const lifetime = new AbortController();
let activeTask;
let context;
let failOnStop = false;
const stop = () => {
  if (lifetime.signal.aborted) return;
  if (failOnStop) process.exitCode = 1;
  observe({ type: 'stopping' });
  lifetime.abort(new Error('Runner stopping'));
  activeTask?.abort(new Error('Runner stopping'));
};
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, stop);
process.once('disconnect', stop);
function observe(message) {
  if (process.connected) process.send({ ...message, pid: process.pid }, () => {});
}

// Exactly one async loop owns heartbeats. Stopping cancels the timer and joins any
// database operation already in flight before processing can publish or exit.
function automaticHeartbeat(info, task) {
  const timer = new AbortController();
  const done = (async () => {
    try {
      while (!timer.signal.aborted) {
        await delay(1_000, undefined, { signal: timer.signal });
        if (timer.signal.aborted) break;
        const snapshot = await heartbeatJob(context, info.jobId, info);
        observe({ type: 'heartbeat', info, leaseExpiresAt: snapshot.leaseExpiresAt,
          leaseLeadMs: Date.parse(snapshot.leaseExpiresAt) - Date.now() });
      }
    } catch (error) {
      if (timer.signal.aborted && error.name === 'AbortError') return;
      task.abort(error);
      observe({ type: 'heartbeat_failed', info, error: error.message });
    }
  })();
  return async () => { timer.abort(); await done; };
}

try {
  const [configFile, rawOptions = '{}'] = process.argv.slice(2);
  if (!configFile || process.argv.length > 4) throw new Error('Usage: node runner.mjs CONFIG_FILE [OPTIONS_JSON]');
  const options = JSON.parse(rawOptions);
  failOnStop = options.failOnStop === true;
  const durationMs = options.durationMs ?? 0;
  const leasedDelayMs = options.leasedDelayMs ?? 0;
  const beforeDispatchDelayMs = options.beforeDispatchDelayMs ?? 0;
  const mergePauseMs = options.mergePauseMs ?? 0;
  if (![durationMs, leasedDelayMs, beforeDispatchDelayMs, mergePauseMs].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 360_000)) throw new Error('Invalid synthetic duration');
  if (mergePauseMs && !['merge_read', 'merge_decode', 'merge_prepared'].includes(options.mergePauseStage)) throw new Error('Invalid merge fault checkpoint');
  context = await openPoc(JSON.parse(await readFile(configFile, 'utf8')));
  observe({ type: 'ready' });
  while (!lifetime.signal.aborted) {
    const task = new AbortController();
    activeTask = task;
    let stopHeartbeat = async () => {};
    let mergePaused = false;
    try {
      // No target job ID: every fetched envelope follows the business state machine.
      const result = await processOne(context, {
        workerId: `runner-${process.pid}`, signal: task.signal,
        checkpoint: async (stage, info, operationSignal = task.signal) => {
          if (stage === 'leased') stopHeartbeat = automaticHeartbeat(info, task);
          observe({ type: 'checkpoint', stage, info });
          if (stage === 'leased' && leasedDelayMs) await delay(leasedDelayMs, undefined, { signal: task.signal });
          if (stage === 'before_dispatch' && beforeDispatchDelayMs) await delay(beforeDispatchDelayMs, undefined, { signal: task.signal });
          if (stage === 'provider') {
            try { await delay(durationMs, undefined, { signal: task.signal }); }
            finally { await stopHeartbeat(); }
          }
          // Explicit harness fault pause, not claimed to be actual decoder work.
          if (!mergePaused && mergePauseMs && stage === options.mergePauseStage) {
            mergePaused = true;
            await delay(mergePauseMs, undefined, { signal: operationSignal });
          }
          if (stage === 'before_publication') await stopHeartbeat();
          task.signal.throwIfAborted();
          operationSignal.throwIfAborted();
        },
      });
      if (result.status !== 'empty') observe({ type: 'result', result });
      if (context.errors.length) throw context.errors[0];
      if (result.status === 'empty') await delay(100, undefined, { signal: lifetime.signal });
    } catch (error) {
      if (!task.signal.aborted && !lifetime.signal.aborted) throw error;
      observe({ type: 'task_interrupted', error: task.signal.reason?.message ?? error.message });
    } finally {
      await stopHeartbeat();
      activeTask = undefined;
    }
  }
} catch (error) {
  process.exitCode = 1;
  observe({ type: 'error', error: error.message });
  process.stderr.write(`${error.stack ?? error}\n`);
} finally {
  stop();
  if (context) await context.close().catch(error => { process.exitCode = 1; process.stderr.write(`${error.message}\n`); });
  observe({ type: 'stopped', exitCode: process.exitCode ?? 0 });
  if (process.connected) process.disconnect();
}

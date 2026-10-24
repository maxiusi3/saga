import { readFile } from 'node:fs/promises';
import { openPoc, processOne, heartbeatJob } from './store.mjs';

const lifetime = new AbortController();
for (const name of ['SIGTERM', 'SIGINT', 'disconnect']) process.once(name, () => lifetime.abort(new Error('Worker stopping')));

function send(message) {
  return new Promise((resolve, reject) => {
    if (!process.connected || !process.send) return reject(new Error('Worker requires harness IPC'));
    process.send(message, (error) => error ? reject(error) : resolve());
  });
}

async function checkpoint(stage, info, signal = lifetime.signal) {
  signal.throwIfAborted();
  await new Promise((resolve, reject) => {
    const cleanup = () => {
      process.off('message', onMessage);
      process.off('disconnect', onDisconnect);
      signal.removeEventListener('abort', onAbort);
    };
    const onMessage = async (message) => {
      if (message?.type === 'heartbeat') {
        try {
          const snapshot = await heartbeatJob(context, info.jobId, {
            workerId: info.workerId, attempt: info.attempt, queueId: info.queueId, retryCount: info.retryCount,
            nowISO: message.nowISO, leaseMs: message.leaseMs,
          });
          await send({ type: 'heartbeat_result', ok: true, snapshot });
        } catch (error) {
          await send({ type: 'heartbeat_result', ok: false, error: error.message });
        }
        return;
      }
      if (message?.type === 'continue') {
        cleanup();
        resolve();
      }
    };
    const onDisconnect = () => {
      cleanup();
      reject(new Error('Harness disconnected at checkpoint'));
    };
    const onAbort = () => { cleanup(); reject(signal.reason); };
    process.on('message', onMessage);
    process.once('disconnect', onDisconnect);
    signal.addEventListener('abort', onAbort, { once: true });
    send({ type: 'checkpoint', stage, info }).catch((error) => { cleanup(); reject(error); });
  });
}

let context;
try {
  const [configFile, workerId, nowISO, jobId] = process.argv.slice(2);
  if (!configFile || !workerId || process.argv.length > 6) throw new Error('Usage: node worker.mjs CONFIG_FILE WORKER_ID [LOGICAL_NOW_ISO] [JOB_ID]');
  if (!process.send) throw new Error('Worker requires harness IPC');
  const config = JSON.parse(await readFile(configFile, 'utf8'));
  context = await openPoc(config);
  const result = await processOne(context, { workerId, checkpoint, nowISO: nowISO || undefined, jobId, signal: lifetime.signal });
  if (context.errors.length) throw context.errors[0];
  await context.close();
  await send({ type: 'result', result });
} catch (error) {
  process.exitCode = 1;
  if (context) await context.close().catch(() => {});
  const message = error instanceof Error ? error.message : String(error);
  if (process.connected) await send({ type: 'error', error: message }).catch(() => {});
  process.stderr.write(`${message}\n`);
} finally {
  if (process.connected) process.disconnect();
}

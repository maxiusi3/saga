# Recording worker command

The recording worker consumes sealed recording jobs and invokes the existing leased terminal worker, including verified FFmpeg merge and terminal publication. It is a separate Node process; running the web application does not start it. This change supplies a local command and verified synthetic execution. No worker has been deployed or enabled against a remote service, and G1 remains unpassed pending the required cloud/device matrix.

Run from the repository root with Node 22 (verified with 22.22.2), installed workspace dependencies **including the root TypeScript dev dependency**, and an explicitly provisioned FFmpeg executable. `npm ci --omit=dev` alone cannot run this command. The process compiles the reachable production TypeScript modules, resolves their source aliases, loads them from a private OS temporary directory and removes that directory after shutdown. This runtime compilation checks syntax/loading; it does not replace `npm run verify` or the TypeScript type check. The checkout and temporary filesystem must be readable/writable respectively.

Configure the environment explicitly. The command never reads a `.env` file.

| Variable | Required / default | Meaning |
| --- | --- | --- |
| `SUPABASE_URL` | Required, with `NEXT_PUBLIC_SUPABASE_URL` as fallback | HTTPS service origin; no credentials, path, query, fragment, whitespace or control characters. `SUPABASE_URL` takes precedence when both exist. |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | Service-role credential; no whitespace or control characters. Supply through the operator's secret manager. |
| `RECORDING_WORKER_ID` | Required | Unique active process identity; 1–128 ASCII letters, digits, `_` or `-`. |
| `RECORDING_FFMPEG_PATH` | Required | Absolute executable path; e.g. `/usr/local/bin/ffmpeg` on the verified local machine. |
| `RECORDING_WORKER_POLL_MS` | `2000` | Interval between iterations, including errors/work; integer `250`–`60000`. |
| `RECORDING_FFMPEG_TIMEOUT_MS` | `120000` | Per-decoder execution timeout; positive integer, maximum `2147483647`. |
| `RECORDING_MAX_DURATION_MS` | `7200000` | Maximum decoded duration; positive integer, maximum `86400000`. |

After supplying those environment variables, these commands are available:

```sh
# Offline: validate configuration, load compiler/SDK/production worker graph,
# and run only the local FFmpeg -version check. No database or network requests.
npm run worker:recordings -- --check

# One eligible row: process it or recover its expired lease, then exit.
# Run only when the operator intends to consume the configured queue.
npm run worker:recordings -- --once

# Continuous serial queue consumption until SIGINT or SIGTERM.
npm run worker:recordings
```

`--check` prints `recording_worker_ready` only when local prerequisites pass. It does not validate credentials, deployed SQL, storage access or remote availability. An operator must provision the worker runtime and verify the existing recording migrations and storage policies before enabling queue consumption. This command does not apply migrations or manage a service supervisor.

`--once` selects at most one eligible recording job. An empty queue exits successfully without a work log. A selected job may already have become ineligible; the atomic claim/recovery RPC decides. A successful permanent-failure finalization counts as completed processing. An unavailable/uncertain attempt or query failure exits with status 1. A recovered row is not immediately dispatched by the same iteration; a later scan may select `retry_wait` if the lease API authorized it.

Selection includes due `queued` / `retry_wait` rows and conservatively expired `leased` / `running` rows. Wall-clock timestamps in selection are hints, while server lease time is authoritative. A valid UUID cursor advances after each selected row, even when an old invalid job or claim race fails. At the end of the UUID scan the cursor resets. This permits later jobs to progress without mutating the invalid row; a fixed invalid job can be reconsidered on a later sweep. The cursor is process-local, not a durable claim.

Expired leases go through `recoverRecordingJob`. Only an undispatched lease may become `retry_wait`; dispatched work becomes `outcome_unknown`, subject to the existing cancellation/max-attempt rules. The host never resets states, retries a terminal write or infers that a lost response did not commit. Existing `outcome_unknown`, succeeded, failed and cancelled rows are not selected for processing. Operators must use status/ledger reconciliation for uncertain outcomes; resetting a row is not a recovery procedure.

SIGINT/SIGTERM aborts the caller signal, stops selection/polling and awaits the actual owned terminal work, including stream/FFmpeg cleanup. It does not force process exit, publish a fallback result or replay an uncertain operation. The selection read has a bounded 5-second scope; the existing worker retains its RPC, I/O and decoder bounds. Logs contain fixed status names only, with no credentials, object keys, filenames, recording content or job IDs. Continuous query failures are rate-limited by the configured poll interval.

## Host integration

`packages/web/src/lib/server/recording-worker-host.ts` exports:

```ts
runRecordingWorkerOnce({
  admin, storageUrl, serviceRoleKey, workerId, ffmpeg,
  fetch, signal,             // existing terminal-worker options, optional
  cursor,                   // previous result.nextCursor; optional initially
  selectionTimeoutMs,       // 1–60000; default 5000
})
```

The other existing terminal-worker options (`tempRoot`, `ioTimeoutMs`, lease/heartbeat/RPC timing) remain available. It returns a bounded `RecordingWorkerIteration`: `processed` with `outcome: succeeded|failed`, `recovered` with `recoveryState`, `unavailable`, `idle` or `stopped`; every result has `nextCursor` and `canClearLocalDrafts:false`. Only selected results contain `jobId`. Persist the returned cursor between iterations; `idle` resets it to null. Selection failures reject with the fixed `recording_worker_host_unavailable` error. The exported continuous `runRecordingWorker` also accepts `pollMs` and an optional `onIteration` callback, and maintains the cursor until aborted.

The production command and native browser harness use this same host and `finalizeLeasedRecordingJob`. Tests use injected synthetic transports; production HTTPS validation has no test-origin exception. Synthetic command tests include a network-denying preload and an unrelated current directory to verify offline readiness and absence of implicit environment loading. See `docs/research/evidence/2026-11-05-g1-recording-flow/task-2-*.log` and the controller's task report for the recorded checks. Browser/PG17/FFmpeg integration evidence is maintained separately by the parent task.

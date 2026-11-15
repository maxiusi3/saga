# Task 2 report

Status: DONE; source frozen for independent review. Full repository gate remains owned by the parent task.

Implemented the production `npm run worker:recordings` command and actual shared queue host. No stage, commit, push, deployment, remote migration, paid API or family data. Inherited changes were preserved; staged diff remains empty. G1 remains false.

## Changed files

- `package.json`: one root `worker:recordings` script.
- `scripts/recording-worker.cjs`: explicit configuration; isolated runtime compilation of the actual production dependency graph including aliases; FFmpeg readiness; `--check`, `--once`, continuous mode and signal lifecycle.
- `scripts/__tests__/recording-worker-cli.test.js`: configuration and isolated subprocess behavior using synthetic environment, fake FFmpeg and network-denying/controlled transports.
- `packages/web/src/lib/server/recording-worker-host.ts`: queue iteration and serial continuous polling.
- `packages/web/src/lib/server/__tests__/recording-worker-host.test.ts`: selection, fairness, recovery, uncertainty, timeout, configuration, snapshot and drain tests.
- `docs/recording-worker.md`: operator configuration/runtime/enablement and exact integration contract.

All other additions are task-2 evidence/report/freeze files under the authorized evidence/controller directories. No parent-owned experiment, summary or Task 1/3 source was edited.

## Exact shared host interface

`runRecordingWorkerOnce(options: Parameters<typeof finalizeLeasedRecordingJob>[1] & { cursor?: string|null; selectionTimeoutMs?: number }): Promise<RecordingWorkerIteration>` in `packages/web/src/lib/server/recording-worker-host.ts`.

Returns `processed` with `outcome: succeeded|failed`, `recovered` with `recoveryState: retry_wait|failed|outcome_unknown|cancelled`, `unavailable`, `idle`, or `stopped`. Every result has `nextCursor` and `canClearLocalDrafts:false`; selected results have `jobId`. Query failures reject with fixed `recording_worker_host_unavailable`. Invalid host controls reject with fixed `recording_worker_host_configuration`.

The exact SDK query uses `processing_jobs`, projection `id,state,not_before,lease_expires_at`, `job_type=eq.recording_merge`, due queued/retry_wait OR expired leased/running, UUID ascending, limit 1, optional `id=gt.<cursor>`, bounded abort signal, `retry(false)`. An empty page resets the cursor. Valid UUIDs advance even after rejected claims/bad old rows. The query is only a scheduling hint; actual claim/recovery RPCs retain concurrency/identity/clock authority.

`runRecordingWorker` accepts the same options plus `pollMs` (250–60000, default 2000) and `onIteration`, maintains the cursor, and waits after every iteration including failures. It never overlaps terminal pipelines. SIGINT/SIGTERM triggers the caller abort and awaits actual terminal cleanup. An uncertain terminal result returns unavailable without a second write. Expired running work is recovered through the actual lease API to outcome_unknown, never reset/replayed. Host results never authorize local cleanup.

## Verification and TDD evidence

All logs are unique task-2 files in `docs/research/evidence/2026-11-05-g1-recording-flow/`.

- `task-2-host-red.log`: 20 behavioral tests fail against explicit unimplemented host entry points.
- `task-2-host-green-initial.log`: those 20 pass.
- `task-2-cli-red.log`: 4 configuration/CLI tests fail against an unimplemented command.
- `task-2-cli-green-initial.log`: initial 4 pass.
- `task-2-cli-controls-red.log`: additional embedded-control-character rejection fails before the validation fix; actual CLI once/unknown/SIGTERM scenario already passes.
- `task-2-host-config-red.log`: continuous invalid cursor was being caught as a repeating selection failure; explicit configuration rejection test fails before the fix (21 others pass).
- `task-2-host-terminal-lease-green-final.log`: **3 suites, 110 tests pass** (22 new host tests plus actual terminal/lease regressions).
- `task-2-cli-green-final.log`: **6 node:test cases pass**, including subcases, actual SDK queue selection, uncertain claim once-only dispatch, SIGTERM idle cancellation, unavailable FFmpeg, and offline compiler/SDK/FFmpeg readiness from unrelated CWD without `.env` loading.
- `task-2-command-readiness-final.log`: actual root `npm run worker:recordings -- --check` exits 0 and prints `recording_worker_ready` using an isolated synthetic environment and the installed `/usr/local/bin/ffmpeg`. It performs no network calls.
- `task-2-typecheck-final.log`: web `tsc --noEmit` passes.
- `task-2-eslint-final.log`: canonical root ESLint on the four JS/TS implementation/test files exits 0 with no output.
- `task-2-diff-check-final.log`: `git diff --check` exits 0.

Parent-owned native integration results were inspected directly, all status passed with sourceDrift=[] during their runs:

- `integrated-server-1793901288218-2c80a6c8-47d2-4e19-9b07-93153dbb5c88/results.json`: 723 assertions; actual PG17 lease expiry recovery, retry_wait attempt2 FFmpeg processing, running-to-unknown/no replay, bad processor row cursor fairness, future not_before exclusion.
- `integrated-browser-1793901164542-2737e182-0378-4dc6-a99b-43ea164e3c86/results.json`: 297 assertions; actual host processed/succeeded, native PG/FFmpeg/playback/local cleanup.
- `interrupted-browser-1793901165275-4f534671-f03c-4924-a799-5a043b84d32c/results.json`: 336 assertions; interrupted/reopened browser save flow using actual host.

Those integration runs preceded the small final extraction of shared host-control validation (rejecting invalid continuous cursor before the poll loop). Query/signature/processing behavior did not change. Parent may refresh the native evidence against the final frozen hashes when performing its final gate; the existing runs are not claimed to hash-match the final source.

## Boundaries and remaining deployment work

No dependencies were added. Requires source checkout, Node 22 as locally verified, workspace dependencies including root TypeScript dev dependency, writable OS temporary directory and explicit FFmpeg. The runtime transpiler loads the current graph but does not type-check it; repository verification remains mandatory. `--check` deliberately does not validate remote credentials or deployed schema/storage. Operator provisioning, supervisor enablement and cloud/device validation remain outside this task, and no automatic production activation occurred.

Context7 consulted the official Supabase JS source documentation for compound .or filters, query pagination and retry behavior; installed SDK behavior is exercised in tests. Production HTTPS rules were retained with no test-origin bypass.

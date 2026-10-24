# Task 1 report — typed local merge failures and atomic retry

Status: DONE. Implementation, focused tests, final failure/merge validation and original T05 regression complete. Controller owns final project verification and final handoff documentation. No commit or push.

## Changes

- Added `recording-processing-error.ts`: fixed code → disposition mapping, immutable error instances, identity guard requiring actual construction (a copied code or forged prototype cannot classify an ordinary Error).
- T04 executor emits permanent size/hash errors and suppresses known identity when unfinished iterator cleanup fails. Decoder emits permanent decode-rejected/invalid-PCM/duration codes only after the child closes; unavailable runtime, external exit signal, watchdog timeout and diagnostic overflow remain conservative. Existing message text remains compatible.
- Local adapter classifies source open/stat/read failures only at filesystem operations. Missing and invalid files are permanent; only EAGAIN/EINTR/EBUSY/ETIMEDOUT are temporary. A timeout is temporary only when the adapter's own source deadline fired; parent cancellation always wins. Source handle/stream and output cleanup failures cannot silently trigger retry. Source OS tests explicitly inject errno at the filesystem boundary.
- `processOne` catches typed failures only around `prepare`. Post-return readback/guard/publication/COMMIT remain outside that catch. The new failure transaction uses the original job→queue guard, then rechecks abort and a fresh database clock after async writes and before COMMIT. It saves snapshot + current attempt audit, acknowledges the original envelope, and (only if retryable within budget) inserts a delayed ID-only envelope in that transaction.
- Retry reuses `retryProcessingJob`, original maxAttempts, expire/heartbeat constraints and 1/2/4/5 second capped delay. Early duplicates are acknowledged as retry_wait without consuming a business attempt. The attempt audit is only `{code, disposition, phase: 'prepare'}` and previous failed attempts remain intact.
- Added the separate `--only-merge-failures` harness and updated existing negative merge expectations and README.

## Files changed relative to Task 1 start

1. `packages/web/src/lib/server/recording-processing-error.ts` (new)
2. `packages/web/src/lib/server/recording-merge-executor.ts`
3. `packages/web/src/lib/server/recording-audio-decoder.ts`
4. `packages/web/src/lib/server/__tests__/recording-processing-error.test.ts` (new)
5. `packages/web/src/lib/server/__tests__/recording-merge-executor.test.ts`
6. `packages/web/src/lib/server/__tests__/recording-audio-decoder.test.ts`
7. `experiments/t05-durable-worker/local-recording-merge.mjs`
8. `experiments/t05-durable-worker/store.mjs`
9. `experiments/t05-durable-worker/verify.mjs`
10. `experiments/t05-durable-worker/merge-scenarios.mjs`
11. `experiments/t05-durable-worker/merge-failure-scenarios.mjs` (new)
12. `experiments/t05-durable-worker/README.md`

All incremental review compares `.superpowers/sdd/2026-10-16-upgrade-t05-merge-failures/before` with current files, never HEAD. Full increment is `task-1-increment.diff`; exact source hashes are `task-1-source-hashes.json`. Existing dirty work was preserved; `processing-jobs.ts`, dependencies, runner/supervisor, cleanup observer and its ownership logic are unchanged.

## Environment and commands

All commands run from `/Users/eat/Documents/eatpotato/saga传奇`. Runtime: Node 22.22.2, PostgreSQL 14.17, pg-boss 12.37.1, pg 8.16.3. Existing FFmpeg 7.1:

`/Users/eat/.codex/handoffs/videocut/2026-10-06-video-upgrade/evidence/runtime/ffmpeg-macos-x86_64-v7.1`

SHA256: `4a4a968b98859588e98500ae25973d80a5ca5eed0724222b9f76360dcb72a001`. The default Homebrew FFmpeg 8.0.1 was unusable because libvpx.11 was absent; no installation or runtime changes were made.

Evidence directory: `docs/research/evidence/2026-10-16-t05-merge-failures/`. Each harness JSON includes source fingerprints, exact runtime, per-scenario assertions and cleanup/ownership results. No historical evidence was overwritten.

### RED evidence

- `npm test --workspace=packages/web -- --runInBand src/lib/server/__tests__/recording-merge-executor.test.ts src/lib/server/__tests__/recording-audio-decoder.test.ts` → exit **1**, `unit-red.log`: 8 expected failures, 55 passing. Failures were missing structured size/hash/decode/duration identity and cleanup incorrectly preserving the prior failure.
- `SAGA_FFMPEG_PATH=<existing 7.1 above> node experiments/t05-durable-worker/verify.mjs --only-merge-failures docs/research/evidence/2026-10-16-t05-merge-failures/integration-red-missing-confirmed.json` → exit **1**. Real missing source raised raw ENOENT before durable failed state; expected failed result was absent. JSON/log have the same basename.
- Same command plus `--failure-case='timeout repair'`, output `integration-red-timeout-confirmed.json` → exit **1**. Adapter timeout raised ordinary `Recording I/O timed out` instead of durable retry_wait. Both confirmed integration RED reports show complete cleanup.

Two preliminary fixture errors are retained separately and are not RED behavior evidence: `integration-red-missing.log` (syntax, exit 1, no cluster started) and `integration-red-timeout.json/.log` (invalid heartbeat 7; pg-boss requires >=10, exit 1, cleanup complete).

### GREEN evidence

- `npm test --workspace=packages/web -- --runInBand --watchman=false src/lib/server/__tests__/recording-merge-executor.test.ts src/lib/server/__tests__/recording-audio-decoder.test.ts src/lib/server/__tests__/recording-processing-error.test.ts` → exit **0**, **3 suites / 67 tests**, `unit-green-compatible.log`. This is the final focused run after TS library compatibility fixes.
- `SAGA_FFMPEG_PATH=<existing 7.1 above> node experiments/t05-durable-worker/verify.mjs --only-merge-failures docs/research/evidence/2026-10-16-t05-merge-failures/failure-final.json` → exit **0**, **42 scenarios / 361 assertions**.
- `SAGA_FFMPEG_PATH=<existing 7.1 above> node experiments/t05-durable-worker/verify.mjs --only-merge docs/research/evidence/2026-10-16-t05-merge-failures/merge-regression-final.json` → exit **0**, **52 scenarios / 402 assertions**.
- `node experiments/t05-durable-worker/verify.mjs docs/research/evidence/2026-10-16-t05-merge-failures/t05-regression-final.json` → exit **0**, **39 scenarios / 307 assertions**, `t05-regression-final.json/.log`.

Controller independently ran project verification; worker did not run whole-project `npm run verify`. Controller reported final exit 0: Web 76 suites / 728 tests, types/lint and 175-page build, with next-env restored. Unchanged Shared 4 suites / 16 tests and infrastructure 7 assertions passed. See controller-owned `project-checks.json`.

### Retained intermediate runs

- `unit-green-initial.log`: exit 0, 63 tests. `unit-green-final.log`: exit 0, 67 tests, before project compatibility adjustment.
- `integration-green-initial.json/.log`: exit 1, 9 scenarios / 85 assertions; Date.parse(Date) in the assertion lost milliseconds. Corrected assertion to new Date(...).getTime().
- `integration-green-expanded.json/.log`: exit 1, 11 scenarios / 108 assertions; deliberate stream destruction produced expected premature-close completion and masked the original generic failure. Added a narrow destroyed-here exception; real close errors remain conservative and are explicitly tested.
- `integration-green-round2.json/.log`: exit 1, 15 scenarios / 140 assertions; SQL fault wrapper mistakenly changed pg.Pool callback connect behavior. Replaced it with the existing promise-only wrapper pattern. Harness emergency cleanup completed with no errors.
- `integration-green-round3.json/.log`: exit 0, 36 scenarios / 302 assertions.
- `merge-regression-initial.json/.log`: exit 1, 4 scenarios / 90 assertions; fixture cleanup cancelled unrelated pending entries. Restricted new pending retry cleanup to the fixture's retry_wait state.
- Controller initial project verification found configured TS library incompatibility with Object.hasOwn and Error cause options. Changed to hasOwnProperty.call and a plain cleanup Error; final focused/project verification pass. No tsconfig/dependency changes.

## Increment review and boundary checks

Reviewed the 12 changed files against the captured start snapshot. Classification catch ends before prepare readback/publication, failure transaction takes job→queue locks through guard, and both late abort and final database-time checks can roll back snapshot/attempt/retry/ack together. Unknown output COMMIT results retain fully prepared private files. No original source is removed by processing. Retry count/maxAttempts is never reset; duplicate delivery before notBefore does not enter claimProcessingJob.

Final coverage includes all permanent source types; real FFmpeg rejection and duration; repair after timeout and context reopen; original custom budget 2 and default budget 5; delay cap 5s; snapshot/attempt/enqueue/ack rollback; late abort at checkpoint and after database time read; cancellation, revocation, deletion, input/owner/attempt/queue fences; lease expiry waiting for each row lock and inside final transaction; structured stop reason; source OS known/unknown distinction; source-close/temp-cleanup failures; and a real runner processing a good job after a permanent failure. Full merge regression retains both COMMIT outcomes, prepared-process death, real decoding shutdown and post-prepare binding/readback faults.

The external cleanup observer's ownership/kill/recovery logic did not change and was not rerun. Newly affected local resource cleanup is exercised by focused unit tests, two injected local cleanup failures, and the complete merge decoder/runner shutdown suite. Final failure and full merge source hashes match current files. Both final reports confirm no owned children remaining, cluster stopped, temporary directory removed and no cleanup errors.

No production integration, migration, remote access, provider request, dependency change, new worktree, GC, commit or push. Known infrastructure limitations remain the existing local PoC scope, same-user hostile filesystem races and non-preemptible kernel filesystem calls; these are recorded in the harness limitations. No new unresolved implementation concern from incremental self-review.

Final source/cleanup audit: `task-1-final-verification.json` confirms all three final integration reports match current source hashes, exited 0 and have complete cleanup. Final focused unit log has 67/67 tests passing.

## Independent review fix R1 — conservative decoder exit classification

This section supersedes the initial report's statement that generic decoder rejection is a permanent input failure. The controller confirmed Important R1 and refined the plan's “独立审查裁定”: a successful spawn followed by a nonzero process exit or diagnostics does not prove bad input. Runtime loader failures and resource errors can take the same path. No diagnostic text matching was added.

The scoped fix changes only six files: `recording-audio-decoder.ts`, `recording-processing-error.ts`, `__tests__/recording-audio-decoder.test.ts`, `merge-failure-scenarios.mjs`, `merge-scenarios.mjs`, and experiment `README.md`. It removes the unsupported `recording_decode_rejected` identity; any external signal, nonzero exit or diagnostics now remains an ordinary Error. Decoder permanent classifications are limited to invalid/empty PCM after code 0 with no diagnostics and a measured duration bound exceeded. The close callback, cancellation priority, child termination and listener cleanup behavior remain intact. Transaction, lease/queue/input fences, retry, source handling and GC behavior did not change.

New regression scripts actually spawn the configured local Node executable, emit short synthetic diagnostics and exit with 127 (loader-like), 1 (resource-like), or 0 with otherwise valid PCM. These are deterministic process/event regressions, not claims that a real OS loader/resource failure naturally occurred. Each verifies successful spawn, no settlement at exit, settlement after close, dead PID and removed abort listener before checking unclassified identity. A real FFmpeg corrupt-input scenario verifies no artifact, audit code, retry envelope or premature acknowledgment; after real queue expiry, the original lease recovery records outcome_unknown without another business attempt, and extra delivery stays quarantined.

R1 RED was recorded before the decoder implementation changed:

```bash
npm test --workspace=packages/web -- --runInBand --watchman=false src/lib/server/__tests__/recording-audio-decoder.test.ts
```

Exit **1**, `fix1-unit-red.log`: **3 expected failures / 35 passing**. Each new process lifecycle assertion passed before `Error` vs `RecordingProcessingError` failed.

```bash
SAGA_FFMPEG_PATH=/Users/eat/.codex/handoffs/videocut/2026-10-06-video-upgrade/evidence/runtime/ffmpeg-macos-x86_64-v7.1 node experiments/t05-durable-worker/verify.mjs --only-merge-failures --failure-case='ambiguous decoder' docs/research/evidence/2026-10-16-t05-merge-failures/fix1-integration-red.json
```

Exit **1**, `fix1-integration-red.json/.log`: expected conservative rejection was missing because the old implementation returned a handled permanent failure. Cluster and temporary resources were fully cleaned.

R1 GREEN:

```bash
npm test --workspace=packages/web -- --runInBand --watchman=false src/lib/server/__tests__/recording-merge-executor.test.ts src/lib/server/__tests__/recording-audio-decoder.test.ts src/lib/server/__tests__/recording-processing-error.test.ts
SAGA_FFMPEG_PATH=/Users/eat/.codex/handoffs/videocut/2026-10-06-video-upgrade/evidence/runtime/ffmpeg-macos-x86_64-v7.1 node experiments/t05-durable-worker/verify.mjs --only-merge-failures docs/research/evidence/2026-10-16-t05-merge-failures/fix1-failure-final.json
SAGA_FFMPEG_PATH=/Users/eat/.codex/handoffs/videocut/2026-10-06-video-upgrade/evidence/runtime/ffmpeg-macos-x86_64-v7.1 node experiments/t05-durable-worker/verify.mjs --only-merge docs/research/evidence/2026-10-16-t05-merge-failures/fix1-merge-regression-final.json
```

Focused unit exit **0**, **3 suites / 69 tests** (`fix1-unit-green.log`). Failure harness exit **0**, **42 scenarios / 371 assertions** (`fix1-failure-final.json/.log`). Full merge exit **0**, **52 scenarios / 402 assertions** (`fix1-merge-regression-final.json/.log`). Previous final evidence remains untouched.

Original T05 was not rerun for this decoder-only fix, as directed. Its prior **39 scenarios / 307 assertions, exit 0** remain evidence for unchanged exercised sources: `store.mjs`, `worker.mjs`, `runner.mjs`, `supervisor.mjs`, `verify.mjs`, `supervision-scenarios.mjs`, and `processing-jobs.ts` all still match the embedded hashes in `t05-regression-final.json`. Only its incidental README/merge scenario source hashes changed; those paths are exercised in the new fix1 merge/failure runs. This is a bounded reuse claim, not a claim that every incidental original report fingerprint equals the latest tree.

Scoped self-review uses `before-review-fix`, with diff in `task-1-fix1-increment.diff`. The intentional tradeoff is that some malformed audio now requires later review rather than automatic permanent completion; this is documented in README and the controller-owned refinement. No additional implementation concern was found. No commit/push/config/dependency/remote change was made.

R1 final audit: `fix1-final-verification.json` confirms both affected integration suites match all current embedded source hashes and have complete cleanup (no owned processes/groups/direct operations, stopped clusters, removed temp roots). Exact six-file hashes are also in `task-1-fix1-source-hashes.json`. Controller reports fix1 project verify exit 0: Web 76 suites / 730 tests, types/lint, 175 pages, stable source hashes and restored next-env; see `fix1-project-checks.json`. Fix status: DONE, ready for bounded independent re-review.

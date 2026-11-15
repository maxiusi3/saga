# Task 1 report: supervised terminal recording worker

Status: implementation and focused verification complete; three owned source files are frozen for independent review and native verification. G1-01 remains partial. `g1MilestoneSatisfied:false`; `pushConditionSatisfied:false`.

## Owned changes

- `packages/web/src/lib/server/recording-terminal-worker.ts` (new): exports exactly `finalizeLeasedRecordingJob(jobId: string, options: Parameters<typeof withRecordingJobLease>[1]): Promise<RecordingJobFinalization>`.
- `packages/web/src/lib/server/recording-candidate-worker.ts` (refactored): adds `prepareRecordingJobCandidateOutcome` in the existing module, retaining all existing imports. Captures the consumer boundary before reservation and returns either prepared evidence or a settled failure with `consumerStarted`.
- `packages/web/src/lib/server/__tests__/recording-terminal-worker.test.ts` (new): 46 cases using the real lease supervisor, actual finalizer and actual candidate validator. The finalizer's real exports are made configurable for call-through spies; lease RPC helpers, artifact verification scope and candidate I/O are the controlled async boundaries.

The original untracked candidate-worker bytes are saved at `.superpowers/sdd/2026-11-05-upgrade-g1-terminal-worker/recording-candidate-worker.before.ts`. Their SHA-256 matches `baseline.json`: `a679b9502d1691df9879ec53ec05d198106846da803791f39aa29db9b7a52356`.

## Resulting behavior and self-review

Both entries snapshot the caller options and the nested FFmpeg configuration before the first await. The terminal entry retains the original admin object, worker identity, caller signal and effective supervisor RPC timeout. It awaits the full preparation scope, then allows only an actual WeakSet-branded permanent `RecordingProcessingError` raised before the artifact consumer began to continue as failure evidence through the supervisor. All other errors throw inside supervision and normalize to the fixed `recording_worker_unavailable` error.

The shared helper does not import processing-error classification, finalization or terminal modules. The old prepare-only entry converts a failed preparation outcome back to a thrown error, preserving its supervisor-normalized failure and its successful receipt shape. Both historical compiler graphs still execute.

Publication/failure occurs only after `withRecordingJobLease` resolves, so local cleanup, final input revalidation, in-flight heartbeat drain and the last lease check have completed. Finalization receives the exact prepared candidate, latest checked lease, original caller signal and `context.rpcTimeoutMs`. Its receipt is returned directly, without a lease attached; both receipt variants retain `canClearLocalDrafts:false`. The catch normalizes uncertain finalization outcomes without retry, fallback failure, direct table writes or deletion.

The tests assert publication absence while cleanup, heartbeat or check is pending; checked/renewed lease use; stopped timers/checks after finalization; all six permanent codes; transient, forged and generic errors; permanent errors after entering the consumer; unknown reservation/upload/prepare outcomes; post-consumption revalidation and cleanup failure; lease RPC/heartbeat failure; deadline and caller-cancellation boundaries; terminal response loss, malformed receipts, SQL rejection and timeout; caller option mutation; default effective timeout; and old prepare-only success/failure behavior. Existing worker tests additionally cover renewed leases during candidate upload and cleanup after upload lease failure.

Self-review found no unresolved production-code issue. Hash checks confirm that the supervisor, verifier, finalizer and the three lease/candidate/finalization migrations checked by this task remain byte-identical to the parent baseline (the exact migration list is in `task1-source-check.json`). No existing test file, migration, historical harness or historical evidence was edited. No staging, commit, push, deployment, remote migration, paid call or family data was used.

## Retained commands and results

All raw stdout/stderr and exact argv/exit statuses are retained under `docs/research/evidence/2026-11-05-g1-terminal-worker/task1-*`. JSON files are command manifests, including the complete inline candidate-compiler source where applicable.

| Evidence stem | Exact command / scope | Exit | Result |
| --- | --- | ---: | --- |
| `task1-red-missing-entry` | `npm test --workspace=packages/web -- --runInBand src/lib/server/__tests__/recording-terminal-worker.test.ts` | 1 | Missing-entry RED before production edits: import could not resolve the new terminal module. **Zero tests ran**; this proves the entry was absent, not behavioral correctness. |
| `task1-green-attempt-1` | New terminal + existing worker test files | 1 | 46 failed / 23 passed; new fixture attempted to spy on non-configurable Next-compiled exports. This was a test-fixture error, not a production regression. |
| `task1-green-attempt-2` | Same two test files | 1 | 12 failed / 57 passed; the configurable export copy lacked `__esModule`, so wildcard import spies observed a different wrapper. Test fixture fixed without changing production. |
| `task1-green-attempt-3` | `npm test --workspace=packages/web -- --runInBand src/lib/server/__tests__/recording-terminal-worker.test.ts src/lib/server/__tests__/recording-job-worker.test.ts src/lib/server/__tests__/recording-job-verifier.test.ts src/lib/server/__tests__/recording-job-finalization.test.ts src/lib/server/__tests__/recording-output-candidate.test.ts src/lib/server/__tests__/recording-candidate-storage.test.ts src/lib/server/__tests__/recording-job-lease.test.ts` | 0 | **7 suites, 303/303 tests passed**, including all 46 new terminal cases. |
| `task1-typecheck-1` | `npm run type-check` | 0 | Both workspaces passed. |
| `task1-typecheck-final` | `npm run type-check` | 0 | Repeated on the final frozen three-file contents; both workspaces passed. |
| `task1-verifier-compiler` | `node scripts/verify-recording-worker-compatibility.mjs` | 0 | Historical verifier graph executable; does not invoke the historical evidence writer. |
| `task1-candidate-compiler` | `node --input-type=module -e <exact source in JSON>` | 0 | Calls existing `compileCandidateModules`, verifies both old entry and new shared helper exports, and removes only its temporary compilation directory. Historical candidate graph executable; does not invoke the historical evidence writer. |
| `task1-diff-check` | `git diff --check`; then `git diff --no-index --check /dev/null <each owned source>` | 0; 1; 1; 1 | Normal tracked diff check passed. The no-index checks emitted no whitespace diagnostics; exit 1 records that each untracked file differs from `/dev/null`, not a whitespace finding. |
| `task1-eslint` | In `packages/web`: `npx eslint src/lib/server/recording-terminal-worker.ts src/lib/server/recording-candidate-worker.ts src/lib/server/__tests__/recording-terminal-worker.test.ts` | 2 | Optional direct invocation failed before file linting in workspace ESLint 10.3.0: `TypeError: scopeManager.addGlobals is not a function`. Retained as a tooling failure; no lint success claimed. Parent's canonical full-gate lint is authoritative. |

## Frozen source hashes

- Terminal worker: `12ca08db9c58411088565fc2fdcde76b852f9b5df75fd231c3c6bcc494f02037`
- Candidate worker: `61831dfc257c75a75c5e5736c26ade78c510483d367bd98f1094eee109fa5a7d`
- Terminal tests: `968d7c699857df367284534ba741ca7925fb38e41ea74e69803fab5c23dcdb43`

See `task1-source-check.json` for full paths, unchanged dependency hashes, candidate-before verification and the empty staged diff at task verification time.

## Boundaries and remaining parent work

These unit tests control the verifier's owned cleanup boundary; they do not establish real FFmpeg, disk cleanup, native PostgreSQL or HTTP behavior. Task 2/native evidence and independent spec/quality review are owned by the controller. The controller is running the full project gate; this task did not run `npm run verify`, shared or infra full suites. Full native qualification and milestone gates remain outstanding from this task's perspective. Source files are frozen; coordinate any requested edits with the controller while those runs are active.

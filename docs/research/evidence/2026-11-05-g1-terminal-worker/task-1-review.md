Spec compliance: **Approved for Task 1's three-file scope**, with native/SQL qualification retained as a controller-owned gate.

Task quality: **Approved**. No Critical or Important production-code findings.

## Scope and evidence identity

- Reviewed `.superpowers/sdd/2026-11-05-upgrade-g1-terminal-worker/task-1-review.patch` against the task brief and `docs/superpowers/specs/2026-11-05-g1-terminal-worker-design.md`. The package records unchanged HEAD `c0669e8058343f91deba8e468b03e4bf817b1ca5`; no Git commands or mutations were run in this review.
- Programmatically reconstructed all three new files from the patch and compared their complete bytes with the frozen working files. Reconstructed old candidate-worker bytes exactly match `recording-candidate-worker.before.ts`, SHA-256 `a679b9502d1691df9879ec53ec05d198106846da803791f39aa29db9b7a52356`. This reviews the inherited untracked worker against takeover bytes, not against an empty file.
- All three current hashes match `task-1-review-hashes.json` and both `sourcesBefore` and `sourcesAfter` in `docs/research/evidence/2026-11-05-g1-terminal-worker/full-gate-01.json`. The six preserved supervisor/verifier/finalizer/migration hashes match `task1-source-check.json`.
- Changed source was reviewed from the complete patch; no changed-file hunk was truncated. Unchanged code inspection was limited to the named integration risks below. No test suite was rerun.

## Specification checks and strengths

- **Exact entry and receipt contract:** `packages/web/src/lib/server/recording-terminal-worker.ts:7` exports the required signature; lines 24–27 return the strict finalizer receipt directly, with no lease attached. `recording-job-finalization.ts:48–56` enforces `canClearLocalDrafts:false` and freezes the receipt. Tests at `__tests__/recording-terminal-worker.test.ts:97–124` explicitly check the receipt, absent lease and stopped timers.
- **Shared preparation without dependency expansion:** `recording-candidate-worker.ts:1–5` retains the original imports; lines 8–29 separate prepared evidence from settled failure. Lines 33–38 convert failed preparation back into a thrown error for the old entry. The preparation sequence still reserves, uploads/readbacks and prepares once, in that order. Old-entry success/failure behavior is exercised at `__tests__/recording-terminal-worker.test.ts:301–312`.
- **Conservative permanent-failure boundary:** `recording-candidate-worker.ts:10–16` sets `consumerStarted` before reservation. `recording-terminal-worker.ts:14–19` permits only a branded permanent error before that boundary. The checked `recording-processing-error.ts:14–32` uses a private WeakSet and freezes constructed errors; prototype/field lookalikes cannot pass. Six permanent codes, transient/forged/generic errors and errors after consumption are exercised at `__tests__/recording-terminal-worker.test.ts:126–165`.
- **Finalization after supervision:** `recording-terminal-worker.ts:12–27` awaits the complete supervisor result before either terminal call. There is no retry, fallback failure, table mutation or deletion in the added orchestration; lines 28–29 normalize all exposed errors to `recording_worker_unavailable`.
- **Options and handoff:** `recording-terminal-worker.ts:11` and `recording-candidate-worker.ts:34` snapshot the options and nested FFmpeg configuration before yielding. The terminal entry carries `context.rpcTimeoutMs` and uses the original caller signal/admin at lines 18–27. Mutation and default-timeout behavior are exercised at `__tests__/recording-terminal-worker.test.ts:274–299`.
- **Tests exercise real orchestration:** `__tests__/recording-terminal-worker.test.ts:13–21` controls lease RPC, verifier and candidate I/O boundaries while retaining the actual supervisor, finalizer and candidate validator. The finalizer spies are call-through (`:92–93`). The central ordering test (`:97–124`) keeps cleanup, a heartbeat and the final check independently pending and asserts no publication until each settles. It verifies the latest checked lease and absence of later heartbeat/check calls.
- **Uncertain outcomes remain unavailable:** tests at `__tests__/recording-terminal-worker.test.ts:167–197` cover unknown candidate results and failed lease/heartbeat requests; `:214–272` covers caller cancellation, cleanup at expiry, expired handoff, lost terminal responses, malformed receipts, SQL rejection and bounded finalization. These verify no terminal fallback and one terminal request where dispatch had already occurred.

## Focused integration-risk checks

- **Risk: terminal mutation while cleanup/heartbeat/check remains active.** Checked unchanged `recording-job-worker.ts:70–92`: it awaits the consumer, stops new heartbeats, drains the in-flight heartbeat, requires a live lease, awaits the final lease check, then clears timers/aborts its scope/drains again in `finally`. Thus the await at `recording-terminal-worker.ts:12` does not complete while owned supervision remains active.
- **Risk: verifier returns before cleanup/revalidation or loses branded evidence.** Checked unchanged `recording-job-verifier.ts:95–149`: it awaits the merge scope, revalidates before/after artifact consumption and again after the scope returns; only actual processing errors retain their identity through its catch. The shared helper awaits this entire promise before recording an outcome. Actual merge/decoder cleanup behavior remains part of native qualification, not established by the verifier mock.
- **Risk: scope cancellation or stale lease corrupts the terminal handoff.** Checked unchanged `recording-job-finalization.ts:38–100`: it rejects an expired/non-running lease, validates prepared candidate identity, snapshots scalar evidence, propagates the supplied caller signal, bounds its timer by both RPC timeout and lease deadline, disables retries, validates the response and clears the timer/listeners. The terminal entry supplies the checked lease and original caller signal, not the supervisor signal that has just been aborted.

## Verification evidence reviewed

- **RED0:** `docs/research/evidence/2026-11-05-g1-terminal-worker/task1-red-missing-entry.log:5–22` is a module-resolution failure with **0 tests executed**. It proves the new entry did not yet exist; it does not prove any ordering assertion was observed failing. This is accurately disclosed at `task-1-report.md:31` and matches the brief's requested missing-entry RED. The two later failed attempts are test-fixture failures; their logs are retained and do not supply behavioral RED evidence.
- **Focused GREEN:** `task1-green-attempt-3.log:6–10` records 7 suites / 303 tests passing with no warning output. `task1-green-attempt-1.log:789–790` records 46 failed / 23 passed; `task1-green-attempt-2.log:221–222` records 12 failed / 57 passed. The report's counts match these retained intermediate failures.
- **Type checks and historical compiler graphs:** `task1-typecheck-final.log:2–11` and its JSON manifest record exit 0 for both workspaces. `task1-verifier-compiler.log:1` and `task1-candidate-compiler.log:1`, with their command manifests, record successful historical compiler checks. The candidate manifest checks both old and helper exports without invoking the historical evidence writer.
- **Whitespace:** `task1-diff-check.log:1–11` records tracked `git diff --check` exit 0 and three no-index exit-1 comparisons with no whitespace diagnostics. The exit-1 results are recorded as differences, not mislabeled as command exit 0.
- **Canonical gate:** `full-gate-01.json:728` records exit 0; `:1448` records `sourceDrift:[]` across 717 before/after hashes. Its raw and gzip logs match their SHA-256 manifest values, and decompression reproduces the raw log. `full-gate-01.log:18–35` confirms canonical workspace lint completed and Web's 151 suites / 2875 tests passed. The canonical gate includes the reviewed source hashes. No second run was needed for this review.

## Issues

### Critical

- None in the reviewed three-file implementation.

### Important

- None in the reviewed three-file implementation.

### Minor / evidence caveats

- **Direct ESLint invocation fails in tooling:** `docs/research/evidence/2026-11-05-g1-terminal-worker/task1-eslint.log:4–15` records ESLint 10.3.0 failing with `scopeManager.addGlobals is not a function` before file diagnostics. The implementer discloses this at `task-1-report.md:40`; canonical lint subsequently succeeds at `full-gate-01.log:18–29` on the exact reviewed hashes. This is a command/tooling discrepancy, not a remaining Task 1 lint failure. Use the repository's canonical lint command; retain the failed evidence.
- **Full-gate output is not pristine:** `full-gate-01.log:61–65` reports the unsupported Next `eslint` option and deprecated `images.domains`; `:73–80` reports optional environment configuration warnings, repeated later. These concern configuration outside the three-file patch, and the gate still exits 0. Do not describe the full build output as warning-free; handle configuration maintenance separately if desired.

## Cannot verify from this task's patch/evidence

- Native PostgreSQL atomic tuples, candidate-existence rejection including older attempts, real Storage/FFmpeg behavior, revocation races, terminal response loss after a real commit, and absence of surviving native resources require the separate native harness/evidence review. The controlled verifier at `__tests__/recording-terminal-worker.test.ts:72–86` cannot establish those properties. No native PASS is claimed here.
- Preservation of every inherited file and historical evidence artifact is a controller-wide audit; this review verifies the scoped patch, saved candidate bytes, selected dependency hashes and the canonical gate's hash stability. It does not infer a full historical-evidence audit from those checks.
- G1-01 completion and push authorization remain outside this task. The scoped patch performs no milestone transition; the binding design still requires `g1MilestoneSatisfied:false`, `pushConditionSatisfied:false`, and retained source/local drafts.

## Assessment

**Specification verdict: Approved for Task 1. Task quality: Approved.** The implementation makes the terminal decision outside the fully settled supervisor, preserves the old preparation entry, and keeps permanent classification conservative at the candidate-consumer boundary. The unit and canonical-gate evidence support this scoped decision; native qualification and overall G1 status remain independent gates.

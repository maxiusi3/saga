# T05 scoped re-review — round 2

Reviewed 2026-10-15. Scope: the sole new P2 in `re-review.md`, `fix-round-2.diff`, the appended implementation report, current README, and refreshed verification evidence. No historical code review was reopened.

## Verdicts

- **Nested-cluster cleanup finding — ADDRESSED.** The independent database-owning child harness has been removed, eliminating the ownership gap that could orphan its cluster when the outer harness was interrupted.
- **Spec compliance — PASS for the reviewed isolated PoC scope.** All review findings are addressed; no additional actionable spec issue was found in this deletion/refactor.
- **Code quality — PASS for the reviewed scope.** No new actionable findings in the round-2 diff. The original two P2 fixes accepted in round 1 remain intact.

## Basis

`verify.mjs` now has one `mkdtemp('/tmp/saga-t05-')` cluster creation site and one `fork` site, which runs `worker.mjs`. The recursive harness fork, nested ownership IPC, internal injection branch, and regression-local nested-cluster fallback were deleted. Workers do not start independent databases. The existing shared cleanup therefore owns the only cluster throughout the run.

The replacement regression at `verify.mjs:216–242` catches the expected unavailable-executable `ENOENT` from worker creation and invokes the same bounded, idempotent `cleanup()` used by finalization and signal handling. It asserts completion within the deadline, zero remaining children, successful cluster stop, directory removal, no cleanup errors, actual directory absence, and consistent repeated cleanup.

In the full flow, all database-dependent checks precede this final regression (`verify.mjs:460–463`). After it closes the pool and removes the directory, only report state/finalization remains; the final cleanup call reuses the completed cleanup promise. The standalone `--only-fork-cleanup` branch has the same safe ordering. README line 26 accurately describes this coverage and does not claim exhaustive signal-interruption testing. Removing the nested owner resolves the reported structural defect without needing another ownership registry.

## Evidence

The current `docs/research/evidence/2026-10-15-t05-worker/results.json` reports **13 scenarios / 125 assertions passed**. Its last scenario is `failed worker fork cleans the existing owned cluster`, with eight assertions, expected caught ENOENT, and cleanup completed in 199 ms. It and final cleanup record zero remaining owned children, stopped cluster, removed temporary directory, and no cleanup errors. The lock-contention scenario still records zero simulated provider calls.

Independently checked SHA-256 values for the store, worker, harness, lockfile, and production state helper against the refreshed evidence: all match. Store and worker hashes remain unchanged from accepted round 1. The implementation report records the full run's exit code 0; no test or database was rerun for this review.

Only this report was written. No implementation, existing evidence, dependencies, agents, commits, pushes, or deployments were changed. This review closes the PoC findings; it does not establish production rollout, G0/G1, real billing, Storage/RLS, or device acceptance.

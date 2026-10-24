# Task 2 fix round 1 — independent scoped re-review

2026-10-18. Reviewed only `task-2-fix1-diff.md`, the appended fix section in `task-2-report.md`, the two clarified spec paragraphs, and the fix evidence/preservation claims. The initial [review](./access-task-review.md) remains unchanged. No suite or PostgreSQL probe was rerun: the narrowly changed code and persisted RED/GREEN evidence resolve R1 without another execution. No source edits, remote actions, subagents, commits or push occurred; this report is the only file written by this re-review.

## Verdicts

- **Spec: PASS for Task 2 after fix round 1.** R1 is **ADDRESSED**. The historical-binding clarification is consistent with the controller's ruling and the observable behavior.
- **Code quality: PASS for the scoped fix.** No new breakage or actionable residual finding was found in the fix diff.
- **Residual findings: none.** Production/integration and G0/G1 limits from the initial review remain outside this local candidate's approval.

## R1 disposition — ADDRESSED

[candidate.sql:24](/Users/eat/Documents/eatpotato/saga传奇/experiments/pg17-access-guards/candidate.sql:24) now reads `project_id` and `user_id` together, retaining the initial user in `initial_user`. After the existing project→member locking sequence, [candidate.sql:40](/Users/eat/Documents/eatpotato/saga传奇/experiments/pg17-access-guards/candidate.sql:40) rejects a locked user differing from that initial user with `IS DISTINCT FROM`. The separate comparison with parameter 2 and all current eligibility checks remain. This closes the case where the member changes to the invoking replacement user during the wait while preserving the signature, return, lock order, ACL, and project-creation behavior.

The new regression at [concurrency.mjs:25](/Users/eat/Documents/eatpotato/saga传奇/experiments/pg17-access-guards/concurrency.mjs:25) connects as the replacement user, holds the same-project rebind uncommitted on a separate connection, and requires a real observed waiter/blocker before committing that change. The committed-changer snapshot is taken before the caller transaction is committed or rolled back, so an unexpected successful call's changes cannot contaminate the baseline. The test then checks both `42501` and the complete seven-table invariant. Committing an unexpected success is confined to the synthetic regression and makes its RED evidence show the actual forbidden activation.

The existing old-user rejection race and fully committed valid pre-lookup binding case remain passing. There is no early check that bypasses the required waited-on regression, and no new resource or business operation.

## Historical wording — ACCEPTED

Only [spec:17](/Users/eat/Documents/eatpotato/saga传奇/docs/superpowers/specs/2026-10-18-rpc-access-guards.md:17) and [spec:19](/Users/eat/Documents/eatpotato/saga传奇/docs/superpowers/specs/2026-10-18-rpc-access-guards.md:19) changed. They now define the first observed `(project_id,user_id)` tuple as the consistency baseline, require the locked tuple to match it, and still authorize from locked current state. Valid committed bindings before the first lookup are current facts. The text explicitly disclaims historical immutability and intermediate changes restored to the same tuple (ABA).

README and the compatibility-boundary report text use the same narrower guarantee. This resolves the original ambiguity without weakening the post-locator check or introducing a version field, token semantics, historical backfill, or a broader invitation design.

## Evidence checked

| Evidence | Verified result |
|---|---|
| [New regression RED](./access-run-2026-10-18T05-18-28.555Z-3d8248df-b464-414d-b657-97a22b621969.json) | Failed specifically at `new user cannot accept a binding changed after locator read`; old candidate SHA still `e169d6c62f43795a77d183d84edf9cdea23be2da6cab5d058e83d4d386ef9954`. Actual lock wait; returned `00000`; `project_roles` changed and activation occurred. This was not a pin-check failure. |
| [Fixed normal run](./access-run-2026-10-18T05-20-35.358Z-b6769df7-72cc-45ae-8f5b-f74c737b55d3.json) | All 117 scenarios / 1,834 assertions pass; 26 actual waits. R1 returns `42501`; all seven committed-changer/after-caller table fingerprints match; no activation. |
| [Fixed hostile run](./access-run-2026-10-18T05-21-02.095Z-0e46405f-d365-455f-9e82-08e6f6e76c69.json) | Same 117 / 1,834 / 26 result, including R1 rejection and zero writes. |
| [Lifecycle observer](./access-lifecycle-2026-10-18T05-21-01.893Z-46872d1a-77be-453e-94fb-4de292da7898.json) | Four passing cases with expected exits 0/143/1/1; every child has complete cleanup and `rescue.needed=false`. Child evidence hashes match. |

For both final full runs, every recorded race contains an ungranted lock with `wait_event_type='Lock'` and the recorded holder in `pg_blocking_pids`. The R1 evidence includes actual member-update transaction-ID waits, not elapsed-time assumptions.

## Integrity and scope

Applied the supplied unified hunks in memory to the controller's before-snapshot bytes and compared the results with current files: all nine listed diff entries match. Only the six declared source/spec files changed relative to that snapshot; runner/lifecycle sources and the original implementation manifest are byte-identical. The spec differs on lines 17 and 19 only.

Recomputed the seven final experiment hashes, all seven new evidence hashes, and the complete 12-source / 44-CommonJS-package / 743-runtime-file pin maps; all match. Final normal/hostile runs and all lifecycle children identify the same final input manifest and source/dependency maps, with end-of-run source stability recorded. The initial nine evidence files, initial review hash, original implementation manifest and original report prefix are preserved.

Reviewed final candidate SHA-256: `f37f6ce363fd63a9891fbe85c137033e8d3d5a4f2aeb72b6ebdd6748b5358057`.

Reviewed final input-manifest SHA-256: `cd04c3a208cb38a334d782c4ab8b89ec8efb22728d51113408d7b3c5a00665e7`.

Reviewed fix-verification SHA-256: `dd974deb30a473c8789b1b0879dfd09a12286d4bc2e478b9822274d0559cb923`.

This closes the initial review's sole actionable finding and its separate wording clarification. It does not revisit unrelated code or establish real authentication, production ACL/RLS, trusted payment/wallet provenance, full token invitation behavior, unknown-commit recovery, or a release milestone. Those previously stated boundaries are unchanged.

# SDD ledger — plan: docs/superpowers/plans/2026-11-04-upgrade-g1-recording-finalization.md

Baseline HEAD: c0669e8058343f91deba8e468b03e4bf817b1ca5. Same inherited branch/worktree retained by continuation authorization.

| Task/interface | Checked | Finding |
| --- | --- | --- |
| Task 1 itself | 8 RPC params, exact receipt, native matrix, immutable inputs | Agrees with spec |
| Task 2 itself | wrappers, no worker wiring, no retry, typed errors | Agrees with spec |
| Task 3 itself | source freeze, independent review, evidence versus G1 | Agrees with spec |
| Tasks 1/2 | signature/output, bucket constraint versus unions | Same spec is authoritative; implement sequentially |
| Tasks 1/3 | native receipts/source integrity | New evidence only |
| Tasks 2/3 | focused/full gate/old compiler graph | Final source hashes must match tested snapshot |

Ruling: User continuation authorizes the next local G1 slice — no additional design/worktree/commit permission gate — repository deployment restrictions retained.
Ruling: Restrict batch to terminal RPC and strict caller; old worker and client unchanged — avoids publishing inside post-consumer active-state checks — remaining integration explicitly documented.
Ruling: Table SHARE on deletion_requests before row/advisory locks — coordinates existing implicit DML locks — costs table-wide deletion contention and possible safe deadlock abort with reverse-order legacy writers.
Ruling: No terminal replay or automatic failure classification — explicit future reconciliation — ambiguous results remain retained and unavailable.
Ruling: task-brief script could not execute its non-executable sibling; generated equivalent scoped brief directly without modifying installed skills.

Task 1: in_progress

Design review: publication_design_review recommended private pointer promotion and table SHARE barrier. Confirmed worker cannot finalize inside active-state callbacks. Added current-media/export candidate session+project tombstone compatibility to Task 2. Physical target capture, backup and terminal status reader explicitly deferred.
Baseline tests: inherited-focused.json — 6 suites / 377 passed, exit 0, no source drift.
Task 1 RED: actual service-role missing RPC 42883; native cleanup complete. Implementer building mutation/race matrix.

Task 1: implementation complete, source frozen; independent task review in progress.
Task 1 native GREEN: sql-only-2026-11-04T16-14-22.203Z-0b981799-c094-4aab-ba08-ab5dbc0ef943 — 15 scenarios/492 assertions, 21 source and compressed snapshot hashes verified by parent, full cleanup; all2542 old evidence hashes unchanged.
Task 1 findings during implementation: test observer timezone; JSON fixture transport; real trigger-tampering RED fixed with full persisted tuple checks. All intermediate failed runs retained.

Task 1: complete — independent finalization_sql_review specification PASS and quality APPROVED, no actionable findings. Review preserved in evidence/task-1-review.md. No tests rerun by reviewer, source/receipts inspected.
Task 2: in_progress — finalization_app owns strict caller, candidate lineage and targeted access/export consumers plus new native HTTP modules. Task1 source frozen.

Task 2: complete — independent finalization_app_review specification PASS and quality APPROVED, zero actionable findings. 16 suites/677 tests and native SDK+HTTP/PG 8 scenarios/278 assertions/13 requests; 25 source/snapshot hashes checked, cleanup complete. Review copied into evidence/task-2-review.md.
Task 3: in_progress — full repository gate exit 0; Web150/2829, shared4/16, infra14, build184. No tested-source drift; verified build-only next-env addition restored to baseline bytes. Parent preservation recheck passes 2542 prior evidence +1471 historical inputs; HEAD/index unchanged.

Task 3: complete — finalization_final_review specification PASS, quality APPROVED, no critical/important/minor findings. Cross-task contracts, 20 frozen scope files, all688 full-gate sources and native SQL21/HTTP25 snapshots independently verified. No test rerun or implementation fixes required.
Final preservation: 2542 prior evidence +1471 historical protected inputs unchanged; source scope preserved; HEAD c0669e8058343f91deba8e468b03e4bf817b1ca5, index empty, next-env original bytes restored, old evidence and intermediate failures retained. Final docs/report/index updated. Final verification/source-lock/integrity receipts record this state.
Completion boundary: local finalization primitive + strict caller + candidate read compatibility only. G1 item01/milestone/push false; canClearLocalDrafts false; no worker/browser integration, remote migration/deployment, stage/commit/push, paid calls or family-data transmission. Working tree and this plan ledger retained because no commit backs the new work.

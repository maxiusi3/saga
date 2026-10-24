# Final independent batch review — invitation read compatibility and recovery UI

2026-10-19. Reviewed under the `requesting-code-review/code-reviewer.md` contract. Review scope is the supplied batch-start comparison, `.superpowers/sdd/2026-10-19-upgrade-invitation-read-ui/all-review-package-20261019T025336Z.md`, against the binding specification and implementation plan. The inherited runtime was used; the unavailable named model overrides are not claimed.

**Local-candidate verdict: PASS / Approved.** No new Critical or Important findings remain in this batch. Task 1's I1 is addressed, the fixed implementation is covered by the actual final project run, and Task 2 documents the evidence and remaining release boundaries accurately. Controller status and integrity closure remain to be completed after recording this verdict.

## Strengths

- Both token GET adapters delegate to the existing verified status path. The optional URL-token argument preserves the POST algorithm, exact-true gate, Bearer-only identity, same-client authentication, strict status parsing and bounded read. The pending-discovery handler is an independent unconditional 503 and never represents unavailability as an empty list (`packages/web/src/app/api/invitations/check-pending/route.ts:1`; `packages/web/src/lib/server/invitation-acceptance.ts:49`).
- The two page wrappers enforce the canonical token without additional decoding and share one recipient flow. The new flow uses the real existing helper/parser; it displays only filtered role/state and makes acceptance an explicit, synchronously guarded action (`packages/web/src/components/invitations/invitation-recipient.tsx:140`, `:170`). Invitation/project/role/user disagreement becomes unknown before navigation (`:182`).
- Unknown acceptance keeps the per-user write lock, including pending recovery reads and same-account credential refresh. The I1 fix synchronously advances identity generations on genuine departure/return, while both request completions and continuation actions check that generation (`packages/web/src/components/invitations/invitation-recipient.tsx:62`, `:77`, `:119`, `:138`, `:224`). The three new race checks exercise observable behavior, including departure/return and response resolution inside one React batch (`packages/web/src/components/invitations/__tests__/invitation-recipient.test.tsx:284`, `:304`, `:322`).
- Documentation distinguishes current results from failed and superseded captures, and local SDK/component evidence from real-provider validation. Auth logging/`auth_next`, unavailable discovery/preview/history flows, trusted entitlement source/event work, direct RPC/table permissions, audit debt and original G0/G1 requirements remain explicit (`docs/research/2026-10-19-invitation-read-ui.md:35`, `:39`, `:43`).

## Issues

### Critical (Must Fix)

- None found in the reviewed batch.

### Important (Should Fix)

- None outstanding in this batch. I1 is addressed by the fixed source and covering regression evidence; no additional blocking cross-task defect was identified.

### Minor (Nice to Have)

- **M1 — Existing build/environment diagnostics remain a separate cleanup item.** `docs/research/evidence/2026-10-19-invitation-read-ui/project-verify-20261019T023821Z.txt:61` contains obsolete Next configuration warnings, and `:74` records missing-server-configuration diagnostics. These are already acknowledged at `docs/research/2026-10-19-invitation-read-ui.md:39` and `docs/research/evidence/2026-10-19-invitation-read-ui/verification.json:104`. They do not invalidate the recorded command exit status, but that status cannot establish warning-free output or production configuration readiness. Keep M1 unresolved for dedicated cleanup; do not introduce real credentials to suppress the diagnostics. No new Minor implementation or documentation finding was identified.

## Checks and Evidence

- Read the batch comparison in passes, current changed handlers/page wrappers/component/tests, binding spec/plan, ledger rulings, actual Task 1 initial and fix reviews, Task 2 review, raw final test/build summaries and evidence indexes. Named integration risks justified the additional reads of unchanged HTTP helper/protocol: strict success filtering, unknown classification and agreement between the component and server contracts. No unchanged suites were rerun.
- The saved final focused output records **5 suites / 253 tests passed**: 18 new read-route SDK/loopback tests, 41 component tests using real helper/parser with mocked fetch/auth/router, and 194 rerun protocol/client/acceptance regressions. The initial I1 failure and fix RED/GREEN remain preserved; no failed capture was relabeled as passing.
- The fixed-source controller manifest and raw logs agree: **Web 82 suites / 1,019 tests, shared 4 suites / 16 tests, infra 7 tests, and 176 generated pages**, with verify/shared/infra each exit 0. This is run `20261019T023821Z`; the earlier 1,016-test run remains historical.
- Independently recomputed hashes and sizes with a read-only Python check: **63 summary reference occurrences, 42 package artifact references, 18 fixed source files and 751 current project inputs**, all matched. Current `next-env.d.ts` bytes match the saved starting bytes. Public environment templates were hashed; live environment files were not read.
- Independently compared all **1,647 baseline paths**: exactly the 12 authorized existing files differ, with no unexpected existing-path change or missing reported change. The current controller integrity capture additionally records no unexpected new files, private tracked paths or credential-pattern findings. Independently checked **404 local Markdown links across 15 batch documents**, with zero missing targets.
- Read-only Git inspection confirms HEAD `1caa21a72a23d6f5166ed127847ca931374b890a` and branch `codex/october-upgrade-p0`. This review performed no suite reruns, remote calls, Git mutations, subagent dispatches, or source/document edits; only this requested review report was written.

## Recommendations and Controller Closure

1. Preserve this actual review as the final batch report, index its path/hash in the publishable evidence summary, and record local-candidate PASS/Approved. Retain initial failures, superseded manifests and actual task reviews unchanged.
2. Complete the final status pass across the summary, research/evidence indexes, handoff, main plan, P0/P1 continuation notes and execution ledger. Include the still-pending text at `docs/superpowers/plans/2026-10-19-upgrade-invitation-read-ui.md:44`, `docs/HANDOFF-2026-10-13-upgrade.md:328`, `docs/research/evidence/2026-10-19-invitation-read-ui/verification.json:326`, and the ledger's initial header at `.superpowers/sdd/2026-10-19-upgrade-invitation-read-ui/progress.md:3`. These are the explicitly reserved controller closure work, rather than missing application implementation.
3. After report/status changes, regenerate final integrity and verify the new report references and links plus unchanged source/project inputs. Close the remaining plan checkboxes at `docs/superpowers/plans/2026-10-19-upgrade-invitation-read-ui.md:41` only after that check passes. Documentation-only closure does not justify rerunning the unchanged test suites.
4. Preserve M1 and all release blockers, keep the production switch closed, retain recovery data, and leave original **G0=false / G1=false**. The next implementation remains the documented signin/callback privacy cleanup, followed by trusted entitlement and permission work. No commit, push, merge, migration or deployment is authorized by this local review.

## Assessment

**Spec verdict: PASS for the local invitation read/UI batch.**

**Quality verdict: Approved as a local candidate, with controller closure pending.** The read adapters and recipient recovery flow agree with the fixed contracts, and current evidence is bound to the reviewed source. There are no new blocking findings; existing M1 and the documented release prerequisites remain open.

**Ready to merge? No.** Original G0/G1 gates remain unmet, and this task requires preserving the uncommitted continuation without commit/push/merge. This review establishes local batch quality only; it does not establish production or original milestone readiness.

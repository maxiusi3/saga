# Final independent batch review

**Overall: PASS — Approved for the isolated local candidate scope.** Critical 0 / Important 0 / Minor 0. No deferred or parked findings.

Reviewed against the binding invitation-transactions spec and implementation plan, using the supplied original-start-byte batch diff rather than the earlier uncommitted upgrades at HEAD. Diff SHA-256: `05cc33f3e27d72f2019a90ad7177ec39f15b9d68c345a1a89792b2b806ec7899`.

## Strengths

- The five RPCs share locked, current authorization and typed invitation/source/log/member validation. Request aliases preserve payload identity; acceptance does not charge again or recreate revoked membership; current-facilitator cleanup refunds the original payer/source once (`experiments/pg17-invitation-transactions/candidate.sql:90`, `:162`, `:218`, `:243`, `:265`). Private ownership, exact grants and qualified objects preserve the stated candidate boundary (`:9`, `:60`, `:286`).
- Real database assertions cover full-state rejection/rollback, unchanged original public definitions, both prior export overloads, and committed-response loss followed by read-only recovery (`experiments/pg17-invitation-transactions/scenarios.mjs:48`, `:635`, `:781`, `:818`, `:856`). Concurrency observes blockers directly; the auth/FK correction is supported by a saved actual deadlock and successful final regression, while identity mutation/deletion exclusion remains tested (`experiments/pg17-invitation-transactions/concurrency.mjs:26`, `:391`, `:486`).
- Strict result decoding retains safe rejection codes and treats malformed or uncertain responses as unknown (`experiments/pg17-invitation-transactions/protocol.mjs:15`). The summaries correctly distinguish these experimental interfaces from production JWT, payment provenance and formal UI/API integration (`docs/research/2026-10-18-invitation-transactions.md:19`, `:52`).

## Issues

- **Critical:** None.
- **Important:** None.
- **Minor:** None.

## Evidence and cross-task checks

- Inspected the batch package in passes, current implementation/test/harness sources, both actual independent task reports, immutable implementation manifest, raw final results and documentation changes. Task 1 and Task 2 are both actually PASS/Approved; their findings do not leave a cross-task defect unresolved.
- Direct raw-result inspection confirms normal and hostile runs each contain 158 passing scenarios, 2,288 assertions, 33 concurrency cases with observed blockers and 282 identical before/after state checks. Both source maps and input pins equal the immutable implementation manifest; both record unchanged sources at finish and successful dependency/runtime checks. The final TAP is 18/18 with no failures, cancellations or skips.
- The lifecycle observer passes all four cases with child exits **0/143/1/1**, complete cleanup and no rescue. Started servers are recorded absent; invalid startup has no server-started event/PID. Historical missing-module protocol RED remains a failure, old token overload RED is actual `42883`, and the pre-fix auth/FK run remains failed with `00000`/`40P01` outcomes. These are not relabelled as final business-suite successes.
- Preservation and reuse rely on the existing independently checked evidence, not a redundant rerun: `resume-integrity.json`, both task reviews and the latest `final-checks.json` checkpoint report 24 direct inputs + 44 dependency/package files + 743 PG files, unchanged Node/pins and all 27 original implementation artifacts; 1,551 baseline paths with only the five authorized old documents changed; 707 application inputs and three original logs preserved; no private-definition, credential or token leaks. The application results remain attributed to **2026-10-18 04:24:38.969365–04:26:48.304226 UTC** (12:24:38.969365–12:26:48.304226 Asia/Taipei): Web 77/766, shared 4/16, infra 7 and 175 pages. Audit remains 42 unresolved findings, not a new run.
- Handoff, integrated plan, index and P0/P1 additions agree on the next work: production identity/entitlement adapters, five legacy call sites, old-entrypoint restrictions, trustworthy historical compatibility, migrations/rollback, backup/provider/device evidence. Immutable historical manifests retain their original review-pending fields; current review status is recorded separately without cyclic hashes.

## Remaining controller gate and readiness

The controller must publish/reference this actual review, update aggregate status and the final checklist, then complete the specified final integrity check. That future bookkeeping is not established by this snapshot and is not a code finding. No unchanged behavioral suite or integrity script was rerun for this review; only this report was written.

**Local candidate: approved. Production/merge/release readiness: no.** G0/G1 remain unmet, G2–G4 remain unmet, and this local batch is not a new milestone. Synthetic identity/source facts do not establish real JWT/payment provenance; old public RPC/direct-table/entrypoint risks and production integration remain explicit. Preserve the current branch, all uncommitted work and ignored recovery content; this review authorizes no commit, push, merge, remote migration or deployment.

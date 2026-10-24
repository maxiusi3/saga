# PG17 RLS / Source Ledger Composition Implementation Plan

> Execute with superpowers:subagent-driven-development. Preserve the dirty branch and all prior evidence. Do not commit or push unless the original milestone and P0 conditions pass.

**Goal:** Run the old RLS/source-ledger matrices with reviewed PG17 dependencies and prove their integration with trusted invitation membership.
**Architecture:** New isolated orchestration, fixture manifest and precise test-compatibility adapters reuse the frozen implementations. The existing native PG17 Harness controls local connections and cleanup. No production adapter is enabled.
**Tech Stack:** PostgreSQL 17.4, Node 22, existing pg/TypeScript, actual saved metadata and reviewed public routine captures.
**Spec:** [Binding contract](../specs/2026-10-22-pg17-rls-source-composition.md).

**Closeout:** Implementation, assistance, documentation fix re-review and independent whole-batch review are PASS / Approved with zero open findings. Final checklist completion is subject to the [fresh integrity seal](../../research/evidence/2026-10-22-pg17-rls-source-composition/final-integrity-5d5d3a4a-93f7-4918-a7cd-e0065d14974d.json) passing and subsequent read-only rehash; [verification](../../research/evidence/2026-10-22-pg17-rls-source-composition/verification.json) records the actual review hashes. Original P0/G0–G4 and milestone remain false; retain the branch/workspace without commit, push or cleanup.

## Global Constraints

- Existing branch `codex/october-upgrade-p0`, HEAD `1caa21a72`; preserve all uncommitted work and prior experiment/evidence bytes.
- New experiment path `experiments/pg17-rls-source-composition/`; evidence `docs/research/evidence/2026-10-22-pg17-rls-source-composition/`. Use existing dependencies/runtime. No root migration, application change, provider or remote database call.
- Synthetic Auth/objects, omitted Storage trigger/enum semantics and fixture compatibility transformations must be explicit. No unsupported production or complete-Supabase claim.
- Actual low-privilege role sessions, bounded local I/O, redacted unique reports, old bypasses still denied, unknown commits explicitly reconciled.
- User defers real-device testing for this batch; record deferred, never passed. Produce a user action checklist with steps; no request to transmit credentials.
- Use apply_patch for source edits. No worker-spawned subagents; controller owns reviews. No commit/push/remote migration/deploy before original gates pass.

### Task 1: Native composition and behavioral evidence

**Files:** Create `experiments/pg17-rls-source-composition/{verify.mjs,fixture.mjs,compatibility.mjs,scenarios.mjs,verify-lifecycle.mjs,README.md}` and a fixture manifest/pins as needed. Read frozen RLS, ledger, PG17, entitlement and invitation-management modules; never modify them.
**Interfaces:** Consume `Harness`, `loadReviewed/replay`, old RLS `seed/characterize/verifyCandidate`, ledger `seed/run/createLedger`, actual TS projector and entitlement/invitation helpers. Produce standalone normal/RED/lifecycle commands and safe unique JSON reports; explicit manifest describes every selected dependency and difference.

- [x] Pin current source/dependency/runtime inputs and source inventories before starting; keep old raw evidence unchanged.
- [x] Establish fixture-compatibility RED by exercising old position INSERT, full-story updated_at trigger and actual Storage ON CONFLICT inference against the PG17/full-shape fixture. Record expected SQLSTATE or invariant failure independently of setup errors.
- [x] Materialize the frozen seven-table/public-function base, full stories and fourth reviewed public trigger, required Storage shapes/indexes and t02 synthetic additions. Verify actual catalog against selected snapshot and enumerate every omitted/shimmed Storage dependency.
- [x] Implement precise allowlisted old-test adaptations (explicit INSERT columns, updated_at-only normalization plus separate trigger proof, observed partial index conflict target). Run all old candidate and source-ledger behavior with real PG17 and bounded actual lock waits.
- [x] Compose RLS and trusted entitlement/invitation/management in one live fixture; run grant/accept/read/cross-family/revoke/read-refusal and ledger-bind-after-revoke scenarios, plus retained RPC/table bypass denial.
- [x] Run normal and hostile-environment matrices and four actual lifecycle observations. Retain failure/RED logs, final source hashes, counts, catalog/lock evidence and cleanup. Do not rerun unchanged previous matrices outside this new composition.
- [x] Write `.superpowers/sdd/2026-10-22-upgrade-pg17-rls-source-composition/task-1-report.md` with exact files, commands/results, assumptions and limitations. Return a concise summary for independent review.

### Task 2: Review, assistance checklist and handoff

**Files:** Create research record, evidence index/verification/milestone JSON, and `docs/research/2026-10-22-user-action-checklist.md`; update handoff, integrated plan, docs README, current P0/P1 status and this plan.
**Interfaces:** Consume Task 1 actual reports and independent verdict. Produce truthful current state, remaining local implementation order and user-only steps.

- [x] Independent Task 1 spec/quality review; fix supported findings and re-review scoped changes.
- [x] Validate unchanged application/runtime/dependency inputs against original project verification. Run necessary new experiment checks; if app inputs change, run `npm run verify`, shared and infra, preserving starting next-env bytes.
- [x] Write user checklist: read-only bucket/config/Storage dependency capture, migration history/backup recovery preparation, provider data/account conditions and Auth/deployment settings. Include exact steps, outputs, acceptance and current impact; defer devices as instructed.
- [x] Update current docs and status with new results and limits, original gates and conditional push assessment. Preserve older batch records as historical; no unchanged-matrix rerun.
- [x] Independent documentation and whole-batch review, then final hashes/links/input-integrity verification. Mark complete only after actual verdicts and results exist.

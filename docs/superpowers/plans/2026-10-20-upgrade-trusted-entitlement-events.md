# Trusted Entitlement Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Track the steps below.

**Current status (2026-10-21):** Implementation and validation complete. Independent Task 1 specification PASS and quality Approved; documentation PASS/Approved and final batch PASS. Local batch complete. Earlier service errors remain historical. Source stays frozen; retained test evidence is from 2026-10-20.
**Goal:** Replace fixture-only trusted seats with a durable, least-privilege local event ledger and prove its invitation/revocation boundary.

**Architecture:** Add an isolated SQL overlay over the reviewed PG17 invitation candidate. A dedicated writer admits immutable grant/revoke events. Existing invitation transactions consume the protected source; terminal revocation also disables exactly mapped members. A fresh-cluster runner checks behavior, ACLs, rollback, races and lifecycle without changing old experiments.

**Tech Stack:** PostgreSQL 17.4, Node.js ESM, existing pg Harness.

**Spec:** [Binding specification](../specs/2026-10-20-trusted-entitlement-events.md).

## Global Constraints

- Only this batch's experiment/docs/evidence may change. Old inputs and evidence remain unchanged.
- Preserve the current branch and uncommitted work. No remote calls, migrations, deployment, commits or pushes in this local batch; only original milestones authorize a push.
- A dedicated low-privilege database writer stands for preverified events; synthetic events do not prove real payment or provider verification.
- Use empty search_path, exact ACLs and real connections; never treat caller-supplied role GUCs as trusted writer authority.
- The binding spec defines terminal revoke, exact member mapping, lock ordering and permitted legacy balance mirror behavior.

### Task 1: Local ledger, ACL boundary and executable evidence

**Files:** Create `experiments/pg17-entitlement-events/{candidate.sql,fixture.sql,verify.mjs,scenarios.mjs,concurrency.mjs,verify-lifecycle.mjs,README.md}` and focused support files as needed; raw outputs under `docs/research/evidence/2026-10-20-trusted-entitlement-events/`.

**Interfaces:** Consume the existing Harness/replay and invitation SQL without editing them. Produce apply_event/lookup_event exactly as the binding spec defines, and a runner accepting `--red`, `--test-signal-ready`, `--test-fail-start`, `--test-client-failure`.

- [x] Read the binding spec and existing invitation fixture/candidate/scenarios; choose complete source/event constraints and document them. Capture source inputs before execution.
- [x] Write and run behavior RED before candidate SQL: a grant is expected to succeed through the new interface; the old schema returns 42883. Separately demonstrate a real old write/ACL bypass, retaining its state effect in private synthetic state and safe evidence.
- [x] Implement grant/revoke/event lookup, provenance tables, dedicated writer and precise ACL closure. Use immutable payload comparisons, SQL uniqueness and transactions. Test an actual grant twice: `apply_event('fixture','e1','s1','grant',owner,'storyteller_seat',2)` must produce one source, one credit and one event. Change quantity on the same key and assert refusal plus a complete unchanged state snapshot.
- [x] Add full grant/revoke/invitation matrix from the spec, including terminal out-of-order delivery, confirmed member deactivation and both export overload denials. Fault every owned write stage and check full rollback; explicitly BEGIN/apply/ROLLBACK and compare all related tables. Prove unsafe RPC and table/column writes fail for all ordinary roles and writer; real role cannot escalate by SET ROLE/GUC spoofing.
- [x] Run real concurrent duplicate/conflicting grants, distinct-source shared-wallet grants and revoke/send/accept/release in both orders. Observe blocking and test source-to-project discovery changes without missing a member. Assert successful operations' exact effects and rejected operations' zero extra writes.
- [x] Freeze inputs and run normal/hostile-environment/lifecycle checks. Keep failed attempts distinct from final evidence; report Node/PG versions, hashes, cleanup and limits. Write a concise experiment README and implementation report with paths/counts/exits.
- [x] Independent task spec/quality review; fix findings with covering RED/GREEN and scoped rereview. No commit in this task.

### Task 2: Project validation, handoff and milestone decision

**Files:** Modify `docs/HANDOFF-2026-10-13-upgrade.md`, `docs/2026-10-10-integrated-upgrade-plan.md`, `docs/README.md`, P0/P1 specs; create `docs/research/2026-10-20-trusted-entitlement-events.md` and evidence summaries.

**Interfaces:** Consume Task 1 frozen evidence and independent review. Preserve prior evidence timestamps and never convert a local candidate into production qualification.

- [x] Save application input identities and next-env bytes; run `npm run verify`, `npm test --workspace=packages/shared -- --runInBand`, and `npm run test:infra`. Retain raw logs/exits, restore next-env and compare inputs; do not rerun unchanged checks without a concrete reason.
- [x] Record exact results, ACL compatibility changes, trusted-input/real-provider boundary, remaining adapter and milestone requirements. Update handoff's first-next task to follow actual completed scope.
- [x] Verify changed-file scope, local links and evidence hashes. Independently review documentation and final batch; resolve actionable findings, then mark plan complete and update integrity status.
- [x] Check original G0/G1 criteria. Keep push false while missing criteria remain; open the updated handoff and report actual outcomes.

# Invitation Management Implementation Plan

> Execute with superpowers:subagent-driven-development. Preserve the dirty branch and previous evidence; no commit/push unless the original milestone and P0 conditions pass.

**Goal:** Complete the handoff's local verified-source selection and sender management/recovery flow.
**Spec:** [Binding contract](../specs/2026-10-21-invitation-management.md).

**Status (2026-10-22):** Tasks 1–2 and frozen validation completed on October 21; independent implementation spec/quality re-review approved. October 22 recovery only rechecked fingerprints, inventories, logs, Node and next-env; no application/SQL tests rerun. Documentation and whole-batch reviews are PASS / Approved with zero findings; the post-documentation integrity check passed. One independent reviewer performed both closeout review scopes, not two independent opinions. This local batch is complete; original P0/G0–G4 remain false. See [current verification](../../research/evidence/2026-10-21-invitation-management/verification.json).

## Global Constraints

- Work in existing `codex/october-upgrade-p0`, HEAD `1caa21a72`; preserve all previous uncommitted work. Do not deploy, migrate remotely, merge, or contact real providers.
- Do not modify old experiments, frozen evidence, dependencies or root migrations. Add an isolated SQL overlay. Keep previous GET/DELETE/cleanup closed.
- Tokens only in confirmed send/lookup memory; recovery storage contains only version/actor/project/request/role, no credentials or content. Unknown writes never auto-retry; release has no lookup precondition.
- Both management and transaction gates default off and must be exact true. Synthetic evidence is not production qualification.
- Use apply_patch for edits. Tests precede implementation. Preserve intermediate run results. Do not commit locally because push conditions have not passed. No worker-spawned subagents.

### Task 1: Restricted SQL read ports

- [x] Add `experiments/pg17-invitation-management/{candidate.sql,verify.mjs,README.md}`; tests may be a separate scenarios module.
- [x] Compose the unchanged entitlement runner's Harness/replay/prepare/seed/applyCandidate and writer helpers in a fresh synthetic PG17 cluster. Fingerprint all prior pinned inputs before/after; keep all prior raw evidence untouched.
- [x] Establish RED against missing ports then implement sources/management_list exactly per spec; real authenticated/anon/writer/service/metadata connections, foreign actor, confirmation, source revoke/deplete/wrong role, wallet-only, storyteller reservation, transfer/inactive release visibility, UUID pagination, damaged binding, duplicate apply/marker/ACL and read-only snapshots. Include hostile environment isolation and actual signal cleanup through the existing Harness.
- [x] Record safe unique JSON results in `docs/research/evidence/2026-10-21-invitation-management/`; no tokens/emails/credentials/private routine bodies in logs. Report source files, tests, limitations and issues in `.superpowers/sdd/2026-10-21-upgrade-invitation-management/task-1-report.md`.

### Task 2: HTTP ports and shared manager UI

- [x] Add management protocol/client/server and two POST routes with tests; mirror the reviewed sender transport while sharing its deadline. Strictly project-bind, sort, limit, deduplicate all returned rows; strip extras, reject bad states. Keep old sender and legacy endpoints compatible.
- [x] Add shared sender management component; dashboard invitations page and InvitationManager use it. Preserve truthful existing member display/actions, eliminate invented member emails. Implement verified source choice, full send, explicit lookup/link copy, current-project release, keyset history, minimal sessionStorage recovery and account/project race isolation per spec.
- [x] Establish RED using existing real UI behavior and test new protocol, real SDK/loopback routes, React form/pagination/send/unknown/remount/recovery/late response/duplicate click/account switch. Existing legacy refusal and cancellation tests should retain their meaningful contracts with updated management fixture routes.
- [x] Run targeted tests, typecheck and lint; record intermediate results and task report. No commits or subagents.

### Task 3: Review, validation and handoff

- [x] Independent code/spec review task 1 and task 2, fix actionable findings and re-review.
- [x] Run `npm run verify`, shared tests and infra, preserve safe logs/exit codes, verify source fingerprints and restore exact starting next-env. Executed October 21; October 22 is a read-only integrity check.
- [x] Update implementation record, handoff, main upgrade plan, docs README, P0/P1 and current verification JSON. Evaluate original milestone/P0 honestly; conditions remain false, so no push.
- [x] Independent documentation review; PASS / Approved, zero findings; report recorded.
- [x] Independent whole-batch final review PASS / Approved and post-documentation integrity check passed; no source changes or test reruns during closeout.

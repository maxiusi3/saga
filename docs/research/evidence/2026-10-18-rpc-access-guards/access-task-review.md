# Task 2 independent spec and code-quality review

Reviewed 2026-10-18 against HEAD `1caa21a72a23d6f5166ed127847ca931374b890a`, the frozen Task 2 brief/report/diff, and `docs/superpowers/specs/2026-10-18-rpc-access-guards.md`. The review covers the seven new experiment files and implementation-verification evidence, with focused reads of the reused Harness, replay, fixture and export candidate. No source edits, commits, push, remote calls or full-suite reruns were performed. One named, synthetic PostgreSQL probe was necessary to resolve the rebinding claim; its safe result is preserved below. This report is the only review artifact written.

## Spec verdict — CHANGES_REQUIRED

One P2 implementation finding prevents a clean spec pass: a user binding changed after the initial locator read can still be accepted by its new user. The test suite's current rebinding races exercise the old user's rejection, leaving the reported broader claim unproved and, in the focused probe, false.

The author's separate concern about a fully committed, valid binding before invocation is substantially correct. The original signature and selected schema contain no immutable original member/project/user binding or invitation version. A presently valid tuple cannot reveal whether it was inserted that way or validly rebound earlier. The literal “已…改绑的记录” in spec line 17 therefore needs the narrow clarification below; it should not induce a timestamp heuristic, historical backfill, new signature or unrequested schema. That clarification does not excuse the reproducible post-locator gap.

Other Task 2 requirements have matching code and evidence: original identity/resource REDs, exact signatures/default/returns, NULL-safe self checks, empty search path, caller ACL, independent local marker, current inviter checks, project→member locks, wallet locking, both resource roles, explicit unverified payment status, atomic writes, rollback/history preservation, and export composition. Task 3 invitation-audit and batch-level gates remain the controller's scope.

## Code-quality verdict — CHANGES_REQUIRED

There is one actionable correctness/test gap (R1 below), also responsible for the spec failure. I found no additional independent code-quality defect in the scoped SQL, lifecycle handling or reused contracts. The candidate is small and uses the correct transaction boundaries. Resource consumption is serialized on the existing wallet row, then both `amount=-1` consumption entries, project and creator member commit atomically. The old export candidate uses the same project→member ordering.

The runner preserves old sources, uses real low-privilege connections, records actual blockers, checks all seven tables on denial/failure, and keeps cleanup independent of fingerprint success. Cleanup retains an allocation when cluster stop is unconfirmed. Evidence count alone is not the basis for approval: the new probe demonstrates a scenario missing from the otherwise substantial suite.

## R1 — P2: preserve the initial user binding across the lock wait

Locations: [candidate.sql:23](/Users/eat/Documents/eatpotato/saga传奇/experiments/pg17-access-guards/candidate.sql:23), [candidate.sql:35](/Users/eat/Documents/eatpotato/saga传奇/experiments/pg17-access-guards/candidate.sql:35), [concurrency.mjs:48](/Users/eat/Documents/eatpotato/saga传奇/experiments/pg17-access-guards/concurrency.mjs:48). Binding requirements are [spec:17](/Users/eat/Documents/eatpotato/saga传奇/docs/superpowers/specs/2026-10-18-rpc-access-guards.md:17) (“拒绝…改绑的记录”) and [spec:19](/Users/eat/Documents/eatpotato/saga传奇/docs/superpowers/specs/2026-10-18-rpc-access-guards.md:19) (recheck after waiting).

The first lookup stores only `project_id`. After locking the project and waiting for the member lock, the function checks the member's current `user_id` against the caller, but never compares it with the user binding observed at the start. Start with a pending member for user A; transaction B changes only `user_id` to C without committing. Authenticated C invokes `(member_id, C)`, reads the original committed project's locator, locks that project, then waits on B's member update. When B commits, C is accepted and the row becomes active. The same-project tuple changed during the call, yet the claimed rejection does not occur.

The existing race loop always connects as `U.invitee`, so its `rebind_user` case only demonstrates that the old user is denied after replacement. The broader claim at [scenarios.mjs:133](/Users/eat/Documents/eatpotato/saga传奇/experiments/pg17-access-guards/scenarios.mjs:133) (“Concurrent rebinding after the locator read is separately denied”) is contradicted by the probe; README/report summaries must be made accurate after correction.

Smallest contract-preserving fix: read initial `user_id` alongside `project_id`; after project→member locking, require the locked `user_id` to equal both the initially observed user and the authenticated parameter, using NULL-safe comparisons. Continue all authorization checks against locked current rows; the first lookup remains a binding-consistency reference, not authorization. Preserve the existing project comparison, signature, return and lock order.

Add the new-user race above with an observed lock wait. Once the changer commits, expect `42501` and compare all seven tables against that committed-change snapshot to prove the accepting call made no writes. Retain the old-user race and the fully committed valid-rebinding case. Refresh frozen source pins and final evidence after the fix; do not relabel old evidence.

## Historical-binding clarification — separate from R1

The focused pre-invocation case at [scenarios.mjs:126](/Users/eat/Documents/eatpotato/saga传奇/experiments/pg17-access-guards/scenarios.mjs:126) legitimately observes success for a valid committed replacement tuple. It is not evidence that no historical rebinding occurred, nor is it inherently an identity-check bypass: the current row belongs to the authenticated caller and has a valid current inviter/project relationship.

Recommend clarifying spec line 17 along these lines:

> 首次按成员 ID 读取 `(project_id, user_id)` 作为本次绑定基准。按项目→成员持锁后，当前绑定必须与该基准一致，并满足本人、pending、合法角色、active 项目及当前邀请者条件；不一致则拒绝。首次读取前已提交且符合这些条件的绑定按当前事实判断。本签名和现有表不证明记录从未在历史上改绑。

This establishes an observable boundary at the first lookup. It intentionally does not promise detection of changes committed before that lookup, even if the database received the RPC earlier. Rejecting every historical binding replacement would need an additional trusted immutable fact and a separately authorized design; that is outside this compatibility task. Do not weaken the post-locator comparison in R1 to resolve this different concern.

## Evidence integrity and strengths

- Parsed all eight additions from `task-2-diff.md` and reconstructed their contents; every entry matches the current file. The seven final experiment hashes and all nine run-evidence hashes match `implementation-verification.json`.
- Recomputed all 12 direct source/support pins, 44 CommonJS/package pins and 743 installed PostgreSQL bin/lib/share pins: no mismatch. Both final normal/hostile reports match the same source/dependency maps and input-manifest digest. The six reused prior inputs still match their original RED report hashes.
- Final normal and hostile evidence each records 116 passed scenarios / 1,828 assertions and 25 real waits. Every recorded race has an ungranted lock, `wait_event_type='Lock'`, and its recorded holder in `pg_blocking_pids`. The focused finding is additional coverage, not a claim those existing tests failed.
- Original RED evidence records missing/forged callers activating membership and zero-voucher creation adding one project/role, with three expected failed assertions. Its source inventory excludes the new candidate. This supports the saved regression evidence; filesystem chronology beyond those records is not independently attested.
- Both export overloads are composed with the guarded accept path. Real CHECK failures cover wallet/project/member and both resource-log writes; explicit caller rollback and DDL failure/reapplication are separate. Complete table comparisons substantiate rollback and historical preservation within the synthetic fixture.
- Lifecycle observer evidence hashes match all four children. Hostile PG environment, real SIGTERM, actual startup failure and missing-role connection failure each report complete cleanup and `rescue.needed=false`; successful server starts also have independent absent-postmaster observations. The focused probe likewise left zero clients and removed its stopped cluster.
- The reused loader validates both public/private capture digests, all 13 reviewed definitions and the fixed schema selection. The focused probe reused these checks and PostgreSQL 17.4. It emitted no private body, package name, credential or raw database error context.

## Safe focused-probe evidence

Invocation: `node --input-type=module` with an inline review-only script importing `Harness`, `loadReviewed/replay`, and the new experiment's synthetic seed/constants. It replayed the pinned fixture, set only the new local marker, applied the frozen candidate, opened separate changer/caller transactions, performed the same-project user rebind above, observed `pg_locks`/`pg_blocking_pids`, committed the changer, and inspected the result. No experiment source or prior evidence was modified. Candidate SHA-256: `e169d6c62f43795a77d183d84edf9cdea23be2da6cab5d058e83d4d386ef9954`.

The command exited 0 because the diagnostic probe ran successfully; the observed `00000` is the contract failure, not an expected passing regression assertion.

```json
{
  "probe": "same_project_user_rebind_to_invoking_user_after_locator",
  "originalCommittedBinding": {
    "project_id": "21000000-0000-0000-0000-000000000001",
    "user_id": "11000000-0000-0000-0000-000000000002",
    "status": "pending"
  },
  "observedWait": {
    "waiterPid": 25974,
    "holderPid": 25973,
    "rows": [{
      "locktype": "transactionid",
      "mode": "ShareLock",
      "granted": false,
      "wait_event_type": "Lock",
      "blockers": [25973]
    }]
  },
  "callerOutcome": {
    "sqlstate": "00000",
    "rows": [{
      "project_id": "21000000-0000-0000-0000-000000000001",
      "user_id": "11000000-0000-0000-0000-000000000003",
      "role": "storyteller",
      "status": "active",
      "joined_at": "2026-10-18T05:11:49.024Z"
    }]
  },
  "finalBinding": {
    "project_id": "21000000-0000-0000-0000-000000000001",
    "user_id": "11000000-0000-0000-0000-000000000003",
    "status": "active"
  },
  "expectedIfAllPostLocatorRebindingDenied": "42501",
  "cleanup": {
    "clusterStopped": true,
    "tempDirectoryRemoved": true,
    "clientsRemaining": 0,
    "errors": []
  },
  "probeStatus": "passed"
}
```

## Cannot verify / controller follow-up

- Real JWT/verified-email identity, production role inheritance, table ACL/RLS, trusted wallet grants/payments, other RPCs, Storage and complete token/expiry/reservation behavior are explicitly outside this fixture. No production-readiness conclusion follows.
- Historical pre-lookup binding immutability cannot be proven from the current API/schema. R1 only requires retaining and comparing the first observed binding, not introducing that missing history.
- No network unknown-commit recovery or retry deduplication was exercised; README correctly discloses this. The OS kernel/libSystem remain disclosed ambient dependencies.
- I did not independently rerun the controller's application/shared/infra checks, validate the whole invitation audit, or decide G0/G1. No commit/push/merge/deployment authorization is implied.
- Because the repository already contains extensive uncommitted work, this review confirms the supplied task additions and recorded old-input hashes; it cannot reconstruct every pre-task filesystem change. All existing work was preserved.

One actionable P2 correctness finding affects both axes. A separate, narrow historical-binding wording clarification is required before claiming full spec compliance.

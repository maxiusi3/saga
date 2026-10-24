# Task 1 independent code quality review — 2026-10-21

**Verdict: Approved.** No actionable correctness, security, concurrency, error-handling, cleanup or maintainability issue was found in the frozen Task 1 implementation within its specified local boundary. This verdict covers Task 1 code quality only; documentation, the final batch and G0/G1 require their separate reviews.

## Scope and method

Independently read the binding specification, Task 1 plan/brief, repository guidance, all ten files under `experiments/pg17-entitlement-events/`, and the frozen review package. Traced the imported invitation SQL and helpers, PG17 Harness/replay, synthetic fixtures and both export candidate overloads where the new ledger depends on them. The existing independent spec verdict was available as context; it was not used as a substitute for this implementation review.

Reconstructed the nine added files in `task-1-review-package.diff` and compared them with current file bytes: all match. Independently recomputed the manifest's **25 source, 44 CommonJS/dependency and 743 runtime file hashes**, checked the complete runtime inventory, and checked the Node executable: zero mismatches. Parsed the authoritative raw RED, normal, hostile-environment and lifecycle reports and checked the lifecycle child hashes. No SQL/project matrix was rerun and no synthetic reproduction was necessary because review found no concrete unresolved concern. This reviewer wrote only this report; source files, pins, prior evidence and the existing dirty tree were preserved.

## Findings

**Actionable findings: none.** There is consequently no severity/file/line/trigger/impact item requiring repair.

| Area | Code quality assessment and evidence |
| --- | --- |
| Event identity and atomicity | `candidate.sql:18–44,72–88,105–140` uses typed payload comparisons, case-sensitive unique identities, a deferred first-event FK and one protected credit link. The existing-event branch returns before writes. First grant, tombstone, suppressed grant and distinct-event alias paths remain distinguishable; failures propagate through the caller transaction. SQL overflow and missing-payer errors cannot leave a credited wallet without its source/event/audit facts. |
| Trust and permissions | `candidate.sql:3–56,148–178` checks the writer's role attributes/memberships, restricts the two entry points, removes candidate-table access, closes table and explicit column ACLs, and revokes all seven legacy write signatures. The definer owns qualified objects under an empty search path; caller GUC text does not authorize event execution. The synthetic fixture deliberately grants permissive ACLs first, and `scenarios.mjs:557–716` exercises actual connections, spoofing and failed role escalation. Catalog evidence records only writer/owner execution on the two entries and owner-only execution on the validator. |
| Locking and discovery | `candidate.sql:78–112,127–133` serializes event/source identities before row locking, locks discovered projects in UUID order, then the wallet, source/bindings and mapped members. Imported invitation writes acquire the same project-before-wallet order. Wallet serialization plus the post-lock project reread prevents a newly committed binding from escaping revocation: a new project causes `40001` before writes, and a retry discovers it. Existing-project acceptance is covered by the project lock. The 20 retained schedules contain actual ungranted locks, `wait_event_type=Lock` and the expected holder in `pg_blocking_pids`; the discovery schedule records `40001` followed by a successful retry. |
| Revocation and access | `candidate.sql:124–137` verifies source/binding identity and the mapped member's current project/user/role before deactivation. Missing or inactive members are not reconstructed. A later mismatch aborts earlier updates in the same call. Imported `_load` checks revocation for send/accept/repeated accept while permitting reservation release; both export candidates lock project then member and reject newly requested exports after the mapped member becomes inactive. Separate ownership and independently funded membership remain valid as specified. |
| Refusal and fault evidence | The suite compares actual complete table contents in memory, publishing only row counts and hashes. Each final full run has 135 equal before/after checks: pre-install checks cover the 12 then-existing tables, later checks cover 14. Thirteen owned write-stage fault cases, grant/revoke caller rollback, installer failure/rollback and repeat installation exercise the principal partial-write risks. Concurrent snapshots are taken while the other operation remains uncommitted, avoiding a false zero-write conclusion from a concurrently committed state change. |
| Runner, cleanup and output | `verify.mjs:35–44,122–207` routes errors/signals into the finalization path; dependency/source verification failures are isolated so they cannot skip Harness cleanup. Imported Harness clients use a private Unix socket, bounded connection/query/lock waits and explicit cleanup tracking. `verify-lifecycle.mjs:56–75,86–177` independently checks process/directory cleanup and scopes any rescue to its temporary allocation. All four retained observer cases passed, matched their child hashes and needed no rescue. Public outputs contain safe classifications and state hashes; no generated invitation token matched any retained `entitlement-*.json`. |
| Maintainability | Business mutation authority is concentrated in one ledger entry with explicit grant/revoke branches. SQL comments explain the unusual discovery retry and mirror behavior. Scenario helpers reuse the reviewed invitation ports, separate semantic groups and keep private values out of error labels. No additional abstraction or refactor is needed to make this bounded experiment reviewable. |

Both final full runs record **95 passed scenarios, 3,211 assertions and 20 concurrent schedules**. The original RED predates candidate SQL and records missing-interface `42883` plus a real unauthorized wallet increment; final RED records both intended failed assertions. Lifecycle records expected exits **0 / 143 / 1 / 1**, stopped clusters, removed scratch directories, zero remaining clients and no cleanup errors.

## Intended boundaries

Positive wallet mirrors after revocation, release restoring that mirror without clearing revocation, a suppressed late grant creating no wallet, retained historical member mappings and explicit `40001` retry are specified behavior. The disabled legacy RPCs make the unchanged application unsuitable for enabling this candidate. These are not quality defects in this task.

Approval is for the fresh synthetic PostgreSQL 17.4 composition at the tested READ COMMITTED isolation. It does not establish real provider verification or credentials, complete production role inheritance/RLS, historical migration/backfill/rollback/backup, Worker/Storage/existing-URL revocation or device qualification. The reviewed raw runs occurred on 2026-10-20; this review rechecked their identities and implementation on 2026-10-21 rather than claiming a new execution. G0/G1 remain open, and this report authorizes no commit, push, migration or deployment.

## Reviewed identities

The complete manifest identifies all reviewed source/dependency/runtime bytes. Hashes below were independently recomputed for this review.

| Input | SHA-256 |
| --- | --- |
| [Binding specification](../../../superpowers/specs/2026-10-20-trusted-entitlement-events.md) | `136b3e6eb7b88bb9d0131ebbf5323054cd82fe59db5e85fe51da926ccd72c964` |
| `.superpowers/sdd/2026-10-20-upgrade-trusted-entitlement-events/task-1-review-package.diff` | `504bdce02be4e3ce4e58277f87173f7127c704e763a0fa8c0d6b252d2ef82dca` |
| [Complete input manifest](../../../../experiments/pg17-entitlement-events/input-pins.json) | `af0f5c27bbd091462a17224039efbc3b113de844e57f05d8716a1ec1f3a53dea` |
| [Candidate SQL](../../../../experiments/pg17-entitlement-events/candidate.sql) | `97045cd661e420d4b55f157a8667c0434ea11ea9a741bffcf2294583c5288300` |
| [Implementation report](task-1-report.md) | `0d46bf3eb90dd71c79b7c5244f6246613034325f604c3b0388c4e5739a05e0a6` |
| Node `/usr/local/Cellar/node@22/22.22.2/bin/node` | `0b8f2f0b030bb443caa2a6781bc2d2e7069e173143726a1627bf527b3ef3126b` |
| [Original pre-candidate RED](entitlement-red-2026-10-20T01-25-59.143Z-2676dc06-0d30-4fb8-ba48-7f9818dcabc2.json) | `6bd9841f65ba1a1146bc0ca313ca95bd990903fedfa0bcf1977c58335601e0b2` |
| [Final RED](entitlement-red-2026-10-20T01-49-27.230Z-6936367a-ef75-4d8d-a28b-c0a3b887c8fa.json) | `c84b5b3b861221832da92b8d566282885ae61c34bbb36101d8666d4196ebb126` |
| [Final normal PG17](entitlement-run-2026-10-20T01-49-29.584Z-84c14462-17c7-4663-8f34-dfd1ff831594.json) | `66b635eb6a4880d52e3b5a5c44dbff68251d8849df50ee570017f9fc3789cc4b` |
| [Final hostile environment](entitlement-run-2026-10-20T01-49-41.146Z-ad34f7f8-7fe7-46ee-b208-893dc59b3e2f.json) | `b50e4ec127319ddfd7ff60304234cbc9f81a60c903d089db0e654c7a43a8f2ff` |
| [Final lifecycle observer](entitlement-lifecycle-2026-10-20T01-49-40.980Z-05dcfebb-69b5-495d-b445-1d1358f52c17.json) | `ff9ac96afceccfbb6f7968c7c8f33dd55cb9286c6ebd1c14f77de6fd59a4076d` |
| [SIGTERM child](entitlement-run-2026-10-20T01-49-52.500Z-f6877cf1-0c95-4924-bc0d-276ac73cede1.json) | `904202d6e3007cf25aadb579f2804d38c537f96f85703ba9586d4f1c03869024` |
| [Startup failure child](entitlement-run-2026-10-20T01-49-54.399Z-a665abc0-e2ac-496f-95bc-7bae7d3d5f5b.json) | `03c240e43617f1af08c719f8bd5785382b3e657cf38be25ba2662216a9002ee8` |
| [Connection failure child](entitlement-run-2026-10-20T01-49-55.742Z-4611bd5b-ba1d-4040-9279-34c631832baf.json) | `9193da5e48fb1cd2474580e1d85bd04cc50592ffdc812297c23e9eb967c80b60` |

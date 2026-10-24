# Task 1 independent spec review — 2026-10-21

**Verdict: PASS.** No actionable missing, incorrect or out-of-scope implementation was found against the binding specification and Task 1. This is an independent specification review; it does not approve code quality, Task 2 documentation, the final batch or G0/G1. Controller review was not used as approval.

## Scope and method

Reviewed the actual ten files under `experiments/pg17-entitlement-events/`, the Task 1 brief/report, and `task-1-review-package.diff`; checked the imported invitation SQL/fixture/helpers and PG17 runtime/replay/export candidate where composition depends on them. The package's nine source/document files match current bytes; the tenth file is the separately checked pin manifest. Base HEAD remains `1caa21a72a23d6f5166ed127847ca931374b890a`.

Independently recomputed all 25 source, 44 CommonJS/dependency and 743 PG runtime hashes: zero mismatches. The actual 743-file runtime inventory and Node executable pin also match. Parsed the authoritative raw evidence below, including individual failed RED assertions, state fingerprints, role identities, catalog ACLs, lock observations and lifecycle child results. No broad SQL/project matrix was rerun: the frozen inputs match and review found no concrete concern warranting a rerun. Only this report was written by this reviewer.

| Requirement | Independently inspected implementation and retained evidence |
| --- | --- |
| Exact interfaces, bounded identifiers, immutable event/source payloads | `candidate.sql:18–44,58–88,142–149`; typed payload comparisons, C-collated unique keys and boundary/conflict scenarios. |
| Atomic first grant, preserved history, terminal revoke, persistent recovery | `candidate.sql:97–140`; both seat types, new zero wallet, NULL/overflow refusal, grant aliases, tombstones and commit/discard/close/new-connection lookup in `scenarios.mjs:223–428`. |
| Protected provenance, repeat installation and permission closure | `candidate.sql:3–56,148–178`; installer/orphan/DDL rollback scenarios, real five-role write/column/RPC attempts and spoof/SET ROLE denials. Seven legacy write signatures are disabled; both exports retain authenticated; recorded public definition hashes are unchanged. |
| Invitation/revocation/member composition | `candidate.sql:127–137` and imported invitation `_load`, send/accept/release; both roles, no extra reservation on retry, pending/repeated acceptance denial, exactly-once release, inactive/deleted/mismatched mappings, unrelated membership and both export overloads in `scenarios.mjs:733–900,1026–1075`. |
| Lock order and concurrent discovery | `candidate.sql:90–112,127–133`, imported invitation locks, and `concurrency.mjs:23–51,69–359`; sorted project locks precede wallet/source/binding/member. All 20 schedules record an ungranted lock with the actual holder in `pg_blocking_pids`; changed project discovery returns `40001`, adds no writes, and retry deactivates both mapped members. |
| Failure atomicity and safe local harness | Thirteen owned write-stage faults plus grant/revoke caller rollback; 135 equal before/after state checks per final full run. Three pre-install/DDL checks contain all 12 then-existing tables; the other 132 contain all 14 tables. Lifecycle observer verifies expected exits, cleanup and child hashes. No generated invitation token appears in retained `entitlement-*.json`. |

Both final full runs record **95 passed scenarios, 3,211 assertions and 20 concurrent schedules**. The original pre-candidate RED has no candidate SQL in its input inventory and records missing-interface `42883` plus the actual unauthorized wallet effect. The final RED records both intended failed assertions. Lifecycle has four passed cases with exits `0 / 143 / 1 / 1`; every child records stopped cluster, removed temporary directory, zero clients and no cleanup errors, with no observer rescue needed.

## Findings and intended limits

**Actionable findings: none.** Positive wallet mirrors after revoke, suppressed late grants without wallet creation, safe `40001` retry, retained historical mappings, and continued independent owner/export authority match explicit specification choices. Provider verification/credentials, production role inheritance/RLS, migration/backfill/rollback/backup, Worker/Storage/URL revocation and device qualification remain unverified as intended. This PASS permits the next independent quality review; it is not production qualification or authorization to push/deploy.

## Review identities

Hashes were recomputed on 2026-10-21; these identify the bytes reviewed even when progress documents later change.

| Input | SHA-256 |
| --- | --- |
| [Binding specification](../../../superpowers/specs/2026-10-20-trusted-entitlement-events.md) | `136b3e6eb7b88bb9d0131ebbf5323054cd82fe59db5e85fe51da926ccd72c964` |
| [Implementation plan](../../../superpowers/plans/2026-10-20-upgrade-trusted-entitlement-events.md) | `d120d7663bcc1420a477aa5d13df673e69bf804dc0da569d40e5c2cee18fcbd8` |
| `.superpowers/sdd/2026-10-20-upgrade-trusted-entitlement-events/task-1-brief.md` | `d6c17c6e667128e916d75a3c6bd354a40de450563e8b80fbf57fa4547b3f0253` |
| `task-1-review-package.diff` in that task directory | `504bdce02be4e3ce4e58277f87173f7127c704e763a0fa8c0d6b252d2ef82dca` |
| [Implementation report](task-1-report.md), identical to private task report | `0d46bf3eb90dd71c79b7c5244f6246613034325f604c3b0388c4e5739a05e0a6` |
| [Complete input manifest](../../../../experiments/pg17-entitlement-events/input-pins.json) | `af0f5c27bbd091462a17224039efbc3b113de844e57f05d8716a1ec1f3a53dea` |
| [Candidate SQL](../../../../experiments/pg17-entitlement-events/candidate.sql) | `97045cd661e420d4b55f157a8667c0434ea11ea9a741bffcf2294583c5288300` |
| Node `/usr/local/Cellar/node@22/22.22.2/bin/node` | `0b8f2f0b030bb443caa2a6781bc2d2e7069e173143726a1627bf527b3ef3126b` |

## Raw evidence checked

| Evidence | SHA-256 |
| --- | --- |
| [Original pre-candidate RED](entitlement-red-2026-10-20T01-25-59.143Z-2676dc06-0d30-4fb8-ba48-7f9818dcabc2.json) | `6bd9841f65ba1a1146bc0ca313ca95bd990903fedfa0bcf1977c58335601e0b2` |
| [Final RED](entitlement-red-2026-10-20T01-49-27.230Z-6936367a-ef75-4d8d-a28b-c0a3b887c8fa.json) | `c84b5b3b861221832da92b8d566282885ae61c34bbb36101d8666d4196ebb126` |
| [Final normal PG17](entitlement-run-2026-10-20T01-49-29.584Z-84c14462-17c7-4663-8f34-dfd1ff831594.json) | `66b635eb6a4880d52e3b5a5c44dbff68251d8849df50ee570017f9fc3789cc4b` |
| [Final lifecycle observer](entitlement-lifecycle-2026-10-20T01-49-40.980Z-05dcfebb-69b5-495d-b445-1d1358f52c17.json) | `ff9ac96afceccfbb6f7968c7c8f33dd55cb9286c6ebd1c14f77de6fd59a4076d` |
| [Final hostile environment](entitlement-run-2026-10-20T01-49-41.146Z-ad34f7f8-7fe7-46ee-b208-893dc59b3e2f.json) | `b50e4ec127319ddfd7ff60304234cbc9f81a60c903d089db0e654c7a43a8f2ff` |
| [SIGTERM child](entitlement-run-2026-10-20T01-49-52.500Z-f6877cf1-0c95-4924-bc0d-276ac73cede1.json) | `904202d6e3007cf25aadb579f2804d38c537f96f85703ba9586d4f1c03869024` |
| [Actual startup failure child](entitlement-run-2026-10-20T01-49-54.399Z-a665abc0-e2ac-496f-95bc-7bae7d3d5f5b.json) | `03c240e43617f1af08c719f8bd5785382b3e657cf38be25ba2662216a9002ee8` |
| [Connection failure child](entitlement-run-2026-10-20T01-49-55.742Z-4611bd5b-ba1d-4040-9279-34c631832baf.json) | `9193da5e48fb1cd2474580e1d85bd04cc50592ffdc812297c23e9eb967c80b60` |

# Task 1 implementation report

Status: DONE — implementation complete, pending controller-dispatched independent spec/quality reviews. No commit or push.

## Scope and files

New files only under `experiments/pg17-entitlement-events/`: `candidate.sql`, `fixture.sql`, `scenarios.mjs`, `concurrency.mjs`, `verify.mjs`, `verify-lifecycle.mjs`, `input-files.mjs`, `pin-inputs.mjs`, `input-pins.json`, `README.md`. New raw experiment outputs are uniquely named `entitlement-*.json` under `docs/research/evidence/2026-10-20-trusted-entitlement-events/`. This report is the only other file owned by this task. Controller-owned project checks and documentation were not edited.

Existing Harness, replay, reviewed SQL, invitation SQL/scenarios/fixtures, private captures and prior evidence were read/imported only. No application/dependency/root-migration changes; no remote calls, production identities/payments, commits, pushes, deployments or migrations.

## Implementation

- Dedicated actual `entitlement_writer` connection uses unchanged `h.client`, with role identity checked. Event/source typed payloads, SQL unique keys, deferred first-event provenance FK, unique grant transaction mapping, new zero wallets, atomic credit and terminal revocation are implemented under a NOLOGIN definer with empty search path. Event/query APIs exactly match the binding spec.
- Fresh normal setup has zero trusted sources; every business-test source comes through writer. The sole injected orphan is a deliberately rolled-back negative installer test proving refusal, never adoption. Reinstall with business rows is read-only.
- Duplicate event is read-only; distinct grant event for the same source adds one event with no credit. Different immutable payload fields refuse. Tombstones suppress later grants, even without a wallet. Current revoked state is returned by lookup of older grant events. Actual commit-response discard + connection close/new connection lookup is tested.
- Consumed-source revocation preserves history/mirror/invitations/bindings and deactivates only matching active mapped members. Missing/inactive members are not restored; mismatches fully roll back earlier member changes. Independent owner/separately funded membership remains valid. Both export overloads deny new requests whose sole membership was revoked.
- Project row locks precede wallet, source/bindings and member locks; projects sort by UUID. Initial source project discovery is checked again after wallet serialization. A new project requires safe `40001`, zero extra writes and a full retry; real concurrent test proves retry catches both members.
- Exact seven unsafe public write RPC signatures are denied while their bodies remain byte-identical. PUBLIC/writer EXECUTE is also removed from remaining public business RPCs, preserving explicit ordinary-role grants. Both export entries retain authenticated only. All sensitive public and candidate table/column privileges are closed. Explicit role/GUC spoofing and SET ROLE failures are exercised. PostgreSQL owner global default function privilege is used because per-schema REVOKE cannot override the global PUBLIC default.

## Validation commands and final results

```sh
node experiments/pg17-entitlement-events/verify.mjs --red
node experiments/pg17-entitlement-events/pin-inputs.mjs
node experiments/pg17-entitlement-events/verify.mjs
node experiments/pg17-entitlement-events/verify-lifecycle.mjs
```

- Final RED exits 1 by design, records two actual failed contract assertions: unauthorized old column write returns 00000 instead of 42501 and leaves +1 synthetic wallet effect; missing grant interface returns 42883 instead of 00000. State is retained only privately inside the short-lived cluster, represented by safe hashes in evidence.
- Final normal: 95 scenarios, 3,211 assertions, exit 0.
- Final hostile-environment rerun: 95 scenarios, 3,211 assertions, exit 0.
- Lifecycle observer: 4/4 passed with expected child exits 0 / 143 / 1 / 1. SIGTERM follows fixture-ready; startup failure is actual server failure; connection failure is SQLSTATE 28000. Observer independently confirms postmaster absent, directory removed, safe JSON stdout and empty stderr. No rescue required.
- 20 concurrency schedules record actual pg_locks, wait_event=Lock and blocking PIDs. They cover identical/conflicting events, same source/different event, different sources/shared existing and absent wallets, first rollback, grant/revoke ordering, revoke/send/accept/repeated accept/cancel/expiry in both orders, and changed project discovery.
- Thirteen injected write-stage faults cover new wallet insert, trusted source insert, ledger insert, wallet credit, credit audit insert, ledger credit-link update, event insert, revoked source update, member update, revoke event insert and all three tombstone writes. Grant and consumed-member revoke caller BEGIN/apply/ROLLBACK tests also compare all related tables.
- Complete snapshots span 14 related tables; only row counts and SHA-256 hashes are published. Actual source/event/wallet/member/log deltas are asserted. Every sensitive table operation and each column INSERT/UPDATE are attempted by all four ordinary roles and writer.
- Local Prettier was applied only to new MJS/Markdown files. Project `npm run verify`, shared and infra are controller-owned and were not repeated by this task.

## Authoritative final evidence

- `docs/research/evidence/2026-10-20-trusted-entitlement-events/entitlement-red-2026-10-20T01-49-27.230Z-6936367a-ef75-4d8d-a28b-c0a3b887c8fa.json`
  SHA-256 `c84b5b3b861221832da92b8d566282885ae61c34bbb36101d8666d4196ebb126`
- `docs/research/evidence/2026-10-20-trusted-entitlement-events/entitlement-run-2026-10-20T01-49-29.584Z-84c14462-17c7-4663-8f34-dfd1ff831594.json`
  SHA-256 `66b635eb6a4880d52e3b5a5c44dbff68251d8849df50ee570017f9fc3789cc4b`
- `docs/research/evidence/2026-10-20-trusted-entitlement-events/entitlement-lifecycle-2026-10-20T01-49-40.980Z-05dcfebb-69b5-495d-b445-1d1358f52c17.json`
  SHA-256 `ff9ac96afceccfbb6f7968c7c8f33dd55cb9286c6ebd1c14f77de6fd59a4076d`
- hostile_pg_environment: `docs/research/evidence/2026-10-20-trusted-entitlement-events/entitlement-run-2026-10-20T01-49-41.146Z-ad34f7f8-7fe7-46ee-b208-893dc59b3e2f.json`
  SHA-256 `b50e4ec127319ddfd7ff60304234cbc9f81a60c903d089db0e654c7a43a8f2ff`
- SIGTERM_after_fixture_ready: `docs/research/evidence/2026-10-20-trusted-entitlement-events/entitlement-run-2026-10-20T01-49-52.500Z-f6877cf1-0c95-4924-bc0d-276ac73cede1.json`
  SHA-256 `904202d6e3007cf25aadb579f2804d38c537f96f85703ba9586d4f1c03869024`
- invalid_actual_server_start: `docs/research/evidence/2026-10-20-trusted-entitlement-events/entitlement-run-2026-10-20T01-49-54.399Z-a665abc0-e2ac-496f-95bc-7bae7d3d5f5b.json`
  SHA-256 `03c240e43617f1af08c719f8bd5785382b3e657cf38be25ba2662216a9002ee8`
- failed_client_connect_cleanup: `docs/research/evidence/2026-10-20-trusted-entitlement-events/entitlement-run-2026-10-20T01-49-55.742Z-4611bd5b-ba1d-4040-9279-34c631832baf.json`
  SHA-256 `9193da5e48fb1cd2474580e1d85bd04cc50592ffdc812297c23e9eb967c80b60`

## RED history and intermediate runs

- Before candidate.sql existed: `entitlement-red-2026-10-20T01-25-59.143Z-2676dc06-0d30-4fb8-ba48-7f9818dcabc2.json` reproduced the actual old wallet bypass and missing-interface 42883; exit 1. Later final RED additionally records an explicit failed denial assertion for the bypass.
- `entitlement-run-2026-10-20T01-30-09.558Z-907579bf-90b9-4e00-bdad-8f02edb0fbf0.json`: new no-wallet tombstone regression failed; validation moved to actual credit branch, then passed.
- `entitlement-run-2026-10-20T01-36-02.887Z-269455fe-6d9b-4b89-b42f-d40085f27a56.json`: newly created private helper still inherited PUBLIC EXECUTE; owner global default fixed and covering behavior passes.
- `entitlement-run-2026-10-20T01-46-02.434Z-60ebcc2c-ba83-429c-865f-0811e513dca3.json`: strict writer exclusion from unrelated public RPC failed; PUBLIC/writer grants removed and covered by final GREEN.
- Earlier 35/70/90/94/95 scenario runs and prior lifecycle runs are intentionally retained as intermediate evidence; authoritative final reports above include final source closure. Expected lifecycle failed/interrupted child status is distinct from overall observer success.

## Runtime, pins and cleanup

- Node `v22.22.2`; pg driver `8.16.3`; `postgres (PostgreSQL) 17.4`.
- Runtime OS: `{"platform": "darwin", "arch": "x64", "release": "22.6.0"}`. Unix socket only; listen_addresses empty. Explicit plpgsql.variable_conflict=error.
- Frozen source files: 25; loaded CommonJS files/manifests: 44; installed runtime bin/lib/share files: 743.
- Input manifest SHA-256: `af0f5c27bbd091462a17224039efbc3b113de844e57f05d8716a1ec1f3a53dea`.
- Node executable SHA-256: `0b8f2f0b030bb443caa2a6781bc2d2e7069e173143726a1627bf527b3ef3126b`.
- Prior source/runtime hashes are checked against reviewed manifests. Final runner captures sources before replay, validates imported source hashes, and rechecks source files after execution. Node/PG binary pins plus runtime support and loaded dependency closure are verified. macOS libSystem shared cache/kernel are documented ambient dependencies.
- Every completed attempt reports cleanup `{"clusterStopped":true,"tempDirectoryRemoved":true,"clientsRemaining":0,"errors":[]}`. All final observer cases confirm the same and require no rescue.

## Self-review and limits

Reviewed the final SQL and scenarios against every binding-spec paragraph, including exact API signatures, identifier bounds/case behavior, dual uniqueness, no source adoption, unknown commits, mirror non-deduction, unrelated ownership, lock ordering/discovery recheck, role ACLs, column ACLs, DDL/business rollback, and public definition-byte preservation. The concrete corrections above retain real failing evidence and final covering behavior. The initial permissive wallet RLS fixture deliberately makes ACL closure observable; this is not a claim about the complete production RLS/role inheritance graph.

No known implementation blocker remains. Independent spec/quality reviews are still controller work and may produce follow-ups. This remains a synthetic READ COMMITTED local composition: true provider signatures/account/product mappings, production role/credential deployment, Storage/delivery authorization, historical migration/backfill/rollback/backup, vendor conditions and device evidence are unverified. Existing app flows depend on disabled legacy RPCs and cannot be enabled unchanged. Revocation does not reclaim mirror balances or revoke independent project ownership, already-submitted exports or existing URLs. G0/G1 remain open.

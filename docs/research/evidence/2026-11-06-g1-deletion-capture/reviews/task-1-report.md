# Task 1: atomic deletion capture and API

Status: implemented and frozen for independent review. No staging, commits, push, deployment, remote database access, paid calls, family data or physical Storage removal. G1 and push qualification remain false.

## Review package

- `task-1.patch`: exact diff against this plan workspace’s immediate `before/` bytes, not against HEAD.
- `task-1-hashes.json`: SHA256 of the nine changed source/documentation files.
- `task-1-integrity.json`: current HEAD, baseline preservation, empty staging, whitespace check and exact tested-source hash checks.

## Exact changed file list

- `supabase/migrations/20261106000002_media_deletion_capture.sql` — `1aabf50fc1427504b9826737ff774b733dce63a36101d4c4ce5db23927db175d`
- `packages/web/src/lib/server/media-deletion-capture.ts` — `6b5510ddf2f92f70035bdeeebf672380738a78e3fb1dc7d62629494b4dbe869a`
- `packages/web/src/app/api/media/delete-request/route.ts` — `7c1864d7f36e00333e96911a97c1a5cd4e74b97e0cfb503df2cd1cfe0dab72e3`
- `packages/web/src/lib/server/__tests__/media-deletion-capture.test.ts` — `600c0f83bf49ebfb8d0cc3e5d7680d4b8c4424ef2add24132dab83969deb1cb9`
- `packages/web/src/app/api/media/delete-request/__tests__/route.test.ts` — `8e018d36cd2efd7c03988f2b7e5382bbf4a96a6023b444455d6a6ca0a4094269`
- `experiments/pg17-deletion-capture/fixture.mjs` — `fd83eb5e509d6f6667db50652201106f846bae0ad3d593377cdd4eddf96185b6`
- `experiments/pg17-deletion-capture/verify.mjs` — `9e5dee4a8e6e2b54abfae8c1628bd78a351db767b14710ded13e400ec8f2beea`
- `experiments/pg17-deletion-capture/scenarios.mjs` — `bf117744fcf63161ce95f3946da0aee6a1c669e1ede4a29706721197f2ed2526`
- `experiments/pg17-deletion-capture/README.md` — `47cbc02ae85f3fe6bfaffecd185421b94e7b77085b459667959b1236b6fa74a0`

Only the existing route and its existing test differ among the takeover baseline files. All other baseline files still match; no baseline file is missing. New files are the strict service/test, SQL migration and new harness directory. Prior experiments and evidence were not modified.

## Behavior and review decisions

- One VOLATILE, service-only RPC under READ COMMITTED captures a tombstone and deduplicated target population atomically, transitions selected assets to deleting, and sets cancel_requested_at only for unfinished jobs without a preexisting cancellation request. It preserves lease fields, job states and all attempt/candidate evidence.
- The deletion-table EXCLUSIVE lock precedes authority/source population locks. It conflicts with actual publication/confirmation SHARE fences. All discovery and authorization occur after waits. Global source locks prevent insert/rebinding phantoms during capture; trigger-induced population/tuple changes are rejected after all writes.
- Explicit subject kind controls scope. Stories include their actual assets/sessions/chunks/candidates and a story metadata target. An asset request includes only the selected asset and bound recording chain, leaving same-story siblings untouched. Foreign relationships, unsafe addresses, and aliases in an unselected chain are rejected.
- Foundation grants authenticated users SELECT on the full deletion_requests table. Therefore the request stores only capture_version, subject_type, capture_target_count and capture_targets_sha256, never a new JSON path snapshot. The digest covers complete canonical JSONB target rows ordered by target_id: row ID, request ID, logical ID, kind, bucket/key, state, error and updated_at. First-write verification still compares the complete actual target rows against their expected full rows; replay checks exact count and full-row digest.
- Native authenticated reads use the actual foundation request-read RLS policy. A current member can read the request row without candidate paths, and cannot read deletion_targets. The target DDL is copied unchanged from the actual foundation; existing recording migrations are applied unchanged.
- Parent ruling: subject replay with a new generated request ID returns the original durable ID. SQL checks supplied-ID collision before subject replay, then rejects changed project/subject/kind/actor. The adapter pins project/subject/kind and validates the original ID as UUID; it intentionally does not require returned ID to equal a newly generated ID. Same-ID and different-ID subject replay preserve complete rows and timestamps.
- The route authenticates, rejects both/neither subject fields and non-UUID request IDs, checks project access, then calls exactly one bounded no-retry RPC through the strict adapter. All responses retain auth headers and no-store. Returned receipt is closed and never includes Storage paths or physicalDeletionComplete:true. Timeout, caller abort and lost network result never fall back to table mutations.

## Verification

| Check | Exact command | Result/evidence |
|---|---|---|
| task1-focused-final | `npm test --workspace=packages/web -- --runInBand src/lib/server/__tests__/media-deletion-capture.test.ts src/app/api/media/delete-request/__tests__/route.test.ts` | exit 0; `docs/research/evidence/2026-11-06-g1-deletion-capture/task1-focused-final.json`; archived full log `task1-focused-final.log.gz` |
| task1-root-eslint-attempt-1 | `npx eslint packages/web/src/lib/server/media-deletion-capture.ts packages/web/src/lib/server/__tests__/media-deletion-capture.test.ts packages/web/src/app/api/media/delete-request/route.ts packages/web/src/app/api/media/delete-request/__tests__/route.test.ts` | exit 0; `docs/research/evidence/2026-11-06-g1-deletion-capture/task1-root-eslint-attempt-1.json`; archived full log `task1-root-eslint-attempt-1.log.gz` |
| task1-typecheck-attempt-1 | `npm run type-check` | exit 0; `docs/research/evidence/2026-11-06-g1-deletion-capture/task1-typecheck-attempt-1.json`; archived full log `task1-typecheck-attempt-1.log.gz` |
| Native | `node experiments/pg17-deletion-capture/verify.mjs` | passed; 14 scenario groups, 647 assertions; `docs/research/evidence/2026-11-06-g1-deletion-capture/native-1793933441582-fe7a1fb8-a48d-4eeb-a951-44b927a4c52b/results.json` |
| Whitespace | `git diff --check` | exit 0 |

Focused Jest: 2 suites and 45 tests passed. Root ESLint and both workspace type checks passed. Their TypeScript files are unchanged from the recorded runs. Native source hashes still match the frozen implementation. No full repository gate was run; parent owns that gate.

Native results SHA256: `d2545095a2b8adbc7623dc533788183ba876d8d29f8f0aadc8b748bd30d21531`.
Patch SHA256: `ee67d6361c874be7bab95ffa0bf60190fdc560b7bcda7dd59d395058b0d425f2`.
Hash manifest SHA256: `064e6101c4b510ebd61ae29bb2521d113d7cf783e632e3e3b7f45c10f6cdb629`.

## Native matrix and full-row evidence

Assertion totals include complete comparisons of all previously created asset/job rows. They are not independent scenario counts or production qualifications. Every mutation/denial observation retains complete before/after row JSON and materialized synthetic bytes; no count-only oracle substitutes for those rows.

| Scenario group | Assertions |
|---|---:|
| actual published recording atomically captures candidate and original chunk | 4 |
| actual service accepts full native capture and exact same-ID or subject replay | 41 |
| three real sealed chunks plus a separate retained reserved candidate deduplicate published alias | 27 |
| pending candidate capture preserves live lease/attempt and requests cancellation without finalizing | 32 |
| story scope includes actual legacy assets; asset scope leaves a same-story sibling and other story untouched | 113 |
| manager authorization and malformed or legacy identity fail closed | 72 |
| unsafe paths, cross-project relationships and foreign physical aliases abort complete capture | 19 |
| missing or altered durable target rejects replay, and request IDs cannot cross subjects or actors | 10 |
| publication before deletion waits then captures committed candidate key without guessed old path | 7 |
| deletion before publication makes waiting actual finalizer fail without mutation | 71 |
| candidate reservation before capture waits for source writer and includes new reserved address | 7 |
| two concurrent submissions converge; concurrent request-ID collision cannot create second capture | 156 |
| current authority and subject ownership are read after actual lock waits | 24 |
| target/asset/cancellation failures, suppressed writes and later trigger tampering roll back all tuples | 36 |

`waits` contains 8 actual independent-backend lock waits with pg_stat_activity, pg_blocking_pids and pg_locks evidence. `observations` contains 54 complete before/after records. `requestVisibility` preserves the authenticated request row and target-read rejection. `publishedCapture` preserves one actual published story receipt, durable request and targets plus its full snapshots for Task 2.

The 12 rollback injections are: target insert exception, asset update exception, cancellation update exception, suppressed request, suppressed target, suppressed asset, suppressed cancellation, altered target, altered request timestamp, a later trigger restoring an asset, a later trigger modifying candidate evidence, and a later trigger inserting a source phantom. Each rejects and preserves every preexisting row and synthetic byte.

## Retained RED and intermediate runs

All failure directories and command log archives are retained. Selected implementation/harness versions immediately preceding fixes are copied alongside their failing reports.

| Artifact | Outcome | SHA256 |
|---|---|---|
| `docs/research/evidence/2026-11-06-g1-deletion-capture/native-1793932877163-d72656d4-9182-4d40-9adc-640021fa1547/results.json` | column t.id does not exist | `0a8a21024bd6a1280ac1eaa524a4fbe1528a7f4898b87450557fd59201b3dd7f` |
| `docs/research/evidence/2026-11-06-g1-deletion-capture/native-1793932923725-328d962d-b842-4f82-b33f-66ef7db15d19/results.json` | passed | `eea1d72a519f1453622b0d8656d990e7ac618b923fb2590f970ccff42be50804` |
| `docs/research/evidence/2026-11-06-g1-deletion-capture/native-1793933118627-8c679e6b-de00-4e2a-940d-774eb650f877/results.json` | durable full target snapshot | `e9a0fe1de4d9d12ea355169ec7b71c1cc64650985ce22b8a6886cc7ba6afb8a1` |
| `docs/research/evidence/2026-11-06-g1-deletion-capture/native-1793933158974-cee85054-4a80-4261-98a3-a27eb9f46597/results.json` | Recording attempt history conflict | `feb9c2ed5d539eaf023836aadc99891ec6bd879bd0c9a755f0d55258d47de71f` |
| `docs/research/evidence/2026-11-06-g1-deletion-capture/native-1793933254641-ee0c95a2-297b-4c7b-852e-67091c66f017/results.json` | publication after capture: rejected expected SQLSTATE | `0d58ad7481ec0db5aa9cb8ee55bfba11c9dcb814391fe1255542987dd9fdda8d` |
| `docs/research/evidence/2026-11-06-g1-deletion-capture/native-1793933308471-129d5a67-488a-4ff0-9abc-a09acfe1aa23/results.json` | later trigger alters asset: rejected expected SQLSTATE | `6afce5ef007b0be71e9eaa9ff7c71e9d70bfcebf1c2515f0371ddd3a594def5e` |
| `docs/research/evidence/2026-11-06-g1-deletion-capture/native-1793933395662-87a99f9e-3563-42d5-a8e1-006fda65599b/results.json` | member-visible request contains only digest/count, never candidate paths | `8001b12b7122287750657908bdf11180203b18268b3372560f28a1d6b5ec0b1b` |
| `docs/research/evidence/2026-11-06-g1-deletion-capture/native-1793933441582-fe7a1fb8-a48d-4eeb-a951-44b927a4c52b/results.json` | passed | `d2545095a2b8adbc7623dc533788183ba876d8d29f8f0aadc8b748bd30d21531` |
| `docs/research/evidence/2026-11-06-g1-deletion-capture/native-red-1793932714141-b4e6aff7-dbf4-4f61-8d5d-d9f8d2c01ad5/results.json` | function public.request_media_deletion(uuid, uuid, uuid, text, uuid) does not exist | `e81b6f327681064401178d5724e44c3b6ad6fec3b42c2c826b3aff8351d45cd3` |
| `docs/research/evidence/2026-11-06-g1-deletion-capture/task1-api-red-1.json` | exit 1 | `26c7332bdf635ebbf85255d0fde38df8a69d39bf6c8cb31bddc6828fb7bb345c` |
| `docs/research/evidence/2026-11-06-g1-deletion-capture/task1-service-red-1.json` | exit 1 | `c12ef2e4d9ca8941f0a0dd6cf6a22d52477816a270c45b75a323630ce0e81122` |
| `docs/research/evidence/2026-11-06-g1-deletion-capture/task1-focused-green-attempt-1.json` | exit 0 | `9ae692f676ff628d588c8b8eb63add97cc63d8e1709522351be338c2f0b423c1` |

RED interpretation: the old route made direct table calls and failed 9 API tests; the service import was absent; native missing RPC returned 42883. Intermediate runs identified the intent-table session_id primary key, fixture read-timezone normalization, the genuine no-retry-after-dispatch lease rule, exact revoked-publication SQLSTATE 42501, and schema-qualified trigger injection under the fixed RPC search path. The member-visible JSON snapshot produced an explicit failing native assertion before replacement with the full-row digest/count.

A reserved candidate requires an actually dispatched running attempt. Its expired lease recovers to outcome_unknown and cannot be reclaimed automatically. The failed attempted historical control is preserved; the legal positive fixture uses two independent actual sessions in one story, one published prepared candidate and one retained reserved candidate, with real sealed chunks. No old lease semantics or attempt rows were rewritten to fabricate history.

## Reuse and residual limits

`experiments/pg17-deletion-capture/fixture.mjs` exports setup/fresh/capture/snapshot/materialize and the compiled actual-service transport adapter. Task 2 can create a published fixture, run capture and consume its actual deletion_targets coordinates; the final report already contains such a complete result.

- Global table locks and full-table metadata snapshots intentionally favor local correctness. They serialize writers across projects and require O(total metadata) scan/memory work; throughput, large data volume and cloud latency remain unqualified. Legacy reverse lock order can safely deadlock/timeout. RPC lock_timeout is 3 seconds; the adapter bounds total wait, with no SDK retries.
- A caller abort or lost network response is not proof of SQL rollback. The request may have committed; explicit resubmission recovers its immutable capture.
- Native fixture uses synthetic auth/project/storage prerequisites and Unix-socket PostgreSQL 17.4, not a hosted PostgREST or Storage service. It tests the actual adapter through a pg transport shim and applies the actual relevant recording migrations. It does not qualify the full production migration chain.
- This capture does not grant physical GC/removal safety for late noncooperating Storage writes or all future cross-project references. There are no downloads, provider calls, physical removals, pg_restore/device/cloud recovery claims or backup-ledger qualification. G1 and push qualification remain false.
- Independent Task 1 review, Task 2 backup compatibility work, whole-change review and full repository gate remain parent responsibilities.

## Integrity

```json
{
  "head": "c0669e8058343f91deba8e468b03e4bf817b1ca5",
  "sourceHashesMatch": true,
  "changedPriorFiles": [
    "packages/web/src/app/api/media/delete-request/route.ts",
    "packages/web/src/app/api/media/delete-request/__tests__/route.test.ts"
  ],
  "missingPriorFiles": [],
  "stagedChanges": [],
  "diffCheckExit": 0,
  "nativeSourceHashesMatch": true
}
```

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

---

# Task 1 review fix round 1

Status: I1 and I2 implemented and frozen for scoped re-review. This section supersedes the earlier whole-database production snapshot description and initial hash qualification. The original report, patch, hashes, native evidence and reviewer diagnostic measurements are retained unchanged.

## Immediate-baseline review package

- `task-1-fix-1.patch` compares only against `task-1-fix-1-before/`, whose nine original source hashes still match its preserved manifest.
- `task-1-fix-1-hashes.json` freezes all 13 final Task 1 files. Four original files changed and four supporting native modules were added. The strict application service, route, both focused test files and original 14-scenario module are unchanged.
- `task-1-fix-1-integrity.json` records exact current hashes, matching native source hashes, unchanged HEAD, empty staging and takeover-baseline preservation. No Task 2 or full repository gate was run.

Changed/new files in this fix:

- `supabase/migrations/20261106000002_media_deletion_capture.sql` — SHA256 `8c4873a4cf980bb6912508d387ac2a6d509cf5c27894298a8277e7f7d0f52b32`
- `experiments/pg17-deletion-capture/fixture.mjs` — SHA256 `7ba4cd9f04ab2cc682644f358fc5d711cdf5ac01067b2c476a4fcac87b888f24`
- `experiments/pg17-deletion-capture/verify.mjs` — SHA256 `1e881236da93a77b663e80aca2892efa12c158517a761c828d035be3601ea4ac`
- `experiments/pg17-deletion-capture/README.md` — SHA256 `b8bcbfce6079c7a7b977c4f3124d8a7dab100191ae93f5212ac0a06a224c5bac`
- `experiments/pg17-deletion-capture/registration-check.mjs` — SHA256 `341aac6f00168dc2382ab3dc493b3b7a0f2fc1600773730c7137244c81fb5f57`
- `experiments/pg17-deletion-capture/fix-1-regressions.mjs` — SHA256 `32d9f064bf373a5e7207e8bd9d4b02085a6390575f08ea4f3bd82e89ff36c0ae`
- `experiments/pg17-deletion-capture/verify-fix-1.mjs` — SHA256 `533b4754a057aa1f749a9a0289713f9e09a72303679b4f97989171d8c1f25f1c`
- `experiments/pg17-deletion-capture/verify-snapshot-cost.mjs` — SHA256 `a244e2593fa149173da2e73d5f84dbfb9df5f333524435ef72100916ce76cebe`

## I1: legitimate seal-before-registration sources

The actual seal RPC persists session/chunk rows before separate asset/job registration. For a story-bound sealed session, the capture now accepts a well-formed intended asset UUID when that asset is absent. It records only the actual story and persisted chunk coordinates; it does not create or guess a media-asset row/address/job/target. Candidate and existing confirmed/job links remain constrained. If the intended asset exists, it must be in the selected project/story, have the session owner and original-audio kind, and must not be claimed by another recording session/confirmed chain.

The new native groups cover actual reserve → seal → capture, plus a story with both an actually published registered session and an unregistered sealed session. Full snapshots establish no invented asset/job, exact target coordinates and preserved chunk/session/candidate/attempt/file evidence. Negative controls cover an existing intended asset in another project, another story, another owner, and another recording session.

After the tombstone, the actual seal SQL rejects replay, the actual seal HTTP route returns 409 before asset/job registration access, and the actual finalizer rejects the missing job/asset. The route/dependencies are compiled from their unchanged actual sources. Synthetic auth/access and a PostgreSQL service-role transport replace only external infrastructure. The local test role remains NOBYPASSRLS; an explicit read policy models the hosted service role’s existing ability to read deletion tombstones. No production grants were expanded.

## I2: scoped complete tuples and population recheck

The RPC keeps its existing global lock order but replaces unfiltered JSON aggregates with queries restricted to the relevant project/actor, story IDs, asset/session/job/candidate IDs, selected chunks/attempts/intents, and the current request/targets. Full relevant tuples remain the before/after oracle in production. In particular, unrelated stories, content/transcripts and historical request/target populations are not serialized.

After all writes and triggers, independent queries rederive asset/job/session/candidate membership, including a formerly absent intended asset. They then recheck physical address aliases and compare complete scoped tuples. This preserves detection of suppressed writes, selected-row restoration/tampering and the demonstrated same-story source phantom. The original twelve rollback injection tests are unchanged and all pass. Full database and synthetic-byte snapshots remain in the native harness as an independent side-effect oracle.

Global population locks and some discovery/alias scans still impose cross-project contention; this fix does not qualify throughput or cloud behavior. Their duration no longer includes JSON serialization of unrelated story bodies. Client timeout/lost-result ambiguity, physical removal/GC, complete migration-chain rehearsal and G1/push limitations remain unchanged.

## Narrow 0/8/32 MiB cost evidence

The actual unmodified RPC was measured for one metadata-only target, varying only one unrelated story’s exact body size. A separate diagnostic copy replaces only `to_jsonb` with a transparent serializer/logger; it records serialized bytes and unrelated-body hits. The probe is supplemental evidence, not a claim that the production RPC was instrumented or a throughput benchmark. Both runners preserve derived probe SQL/hashes and gzip archives of full raw before/after database snapshots with raw/archive hashes.

| Unrelated body | Saved SQL actual elapsed | Saved SQL serialized bytes | Saved SQL unrelated-body calls | Repaired SQL actual elapsed | Repaired SQL serialized bytes | Repaired SQL unrelated-body calls |
|---:|---:|---:|---:|---:|---:|---:|
| 0 MiB | 24.08 ms | 24442 | 0 | 22.60 ms | 3726 | 0 |
| 8 MiB | 275.62 ms | 33597924 | 4 | 11.54 ms | 3726 | 0 |
| 32 MiB | 1016.62 ms | 134280296 | 4 | 10.34 ms | 3720 | 0 |

The 6-byte variation in repaired serialized work is timestamp text precision. Every actual receipt contains one target and physicalDeletionComplete:false. These are single local diagnostics; unrelated jobs may have shared local CPU during measurements, so elapsed times are not treated as an SLA. The direct invariant is zero unrelated-body serialization and roughly 3.7 KiB of scoped tuple payload at every size.

## Fix verification and retained evidence

| Command | Result | Raw result artifact / SHA256 |
|---|---|---|
| `node experiments/pg17-deletion-capture/verify-fix-1.mjs --before-fix-1` | failed; 1 groups / 27 assertions; legitimate sealed-before-registration story capture succeeds | `docs/research/evidence/2026-11-06-g1-deletion-capture/native-fix1-red-1793934408307-49608342-392c-4f02-bf36-8f2fa50622b9/results.json`; `e5918851eacfe61288920f5d869ff5391cd12a935edac9b527328d1333c0130d` |
| `node experiments/pg17-deletion-capture/verify-fix-1.mjs` | passed; 2 groups / 79 assertions | `docs/research/evidence/2026-11-06-g1-deletion-capture/native-fix1-1793934592700-47203a00-69ac-4817-b249-b6a8c60ffb9c/results.json`; `3ce71e225507bae927c63c07cb0ff014aee9726298f8ab651c733558b3561ebc` |
| `node experiments/pg17-deletion-capture/verify-snapshot-cost.mjs --before-fix-1` | failed; 1 groups / 60 assertions; serializer work stays scoped while unrelated content grows by 32 MiB | `docs/research/evidence/2026-11-06-g1-deletion-capture/snapshot-cost-red-1793934506616-ce65ea4f-ca1d-493c-9162-650f980fa453/results.json`; `eae610aee2d78d055f2903816ae2fbe07fa2748a0c27829e650c4fcb176145c4` |
| `node experiments/pg17-deletion-capture/verify-snapshot-cost.mjs --before-fix-1` | failed; 1 groups / 62 assertions; no unrelated story body serialized at any size | `docs/research/evidence/2026-11-06-g1-deletion-capture/snapshot-cost-red-1793934655909-9152134f-9065-4860-a17f-38c45ec61b5d/results.json`; `73adb9e4a11826fd55828148827e05d90024b5d61b513c94ca3339fb32c0e3dd` |
| `node experiments/pg17-deletion-capture/verify-snapshot-cost.mjs` | passed; 1 groups / 64 assertions | `docs/research/evidence/2026-11-06-g1-deletion-capture/snapshot-cost-1793934664953-d05261e9-a122-4da1-acbb-abb6c9a1edea/results.json`; `7d980a47d93b3fc15cf40284f1b886d9b4db2d0dd48f7a529d9404c545b624f2` |
| `node experiments/pg17-deletion-capture/verify.mjs` | passed; 14 groups / 647 assertions | `docs/research/evidence/2026-11-06-g1-deletion-capture/native-1793934676569-6c427702-3fd8-4736-8ead-6fcfc85b31f2/results.json`; `6b8579245426ca19e611a92f4110dc759d57229e88facc4732b7471e8de73fa4` |
| `node experiments/pg17-deletion-capture/verify.mjs` | passed; 16 groups / 699 assertions | `docs/research/evidence/2026-11-06-g1-deletion-capture/native-1793934773961-cfab3e45-06f7-4191-a5a7-436dae09ca50/results.json`; `c294c6003a8ed9dce80c5332a3ea85303b28291ec0f14aec865502b24485df44` |
| `npm test --workspace=packages/web -- --runInBand src/lib/server/__tests__/media-deletion-capture.test.ts src/app/api/media/delete-request/__tests__/route.test.ts` | exit 0; sourceDrift=[] | `docs/research/evidence/2026-11-06-g1-deletion-capture/task1-fix1-focused-final.json`; `58506d8af11cf06efbce1e9f3080b1bfa3b7f5be3425ae5e71b56b9246bfa666`; full log `task1-fix1-focused-final.log.gz` |
| `npx eslint packages/web/src/lib/server/media-deletion-capture.ts packages/web/src/lib/server/__tests__/media-deletion-capture.test.ts packages/web/src/app/api/media/delete-request/route.ts packages/web/src/app/api/media/delete-request/__tests__/route.test.ts` | exit 0; sourceDrift=[] | `docs/research/evidence/2026-11-06-g1-deletion-capture/task1-fix1-root-eslint-final.json`; `1128a4dcf4f7e95649cea2bd848ec93fcb9d7c68203d1a2b1c4318afa8ec81a3`; full log `task1-fix1-root-eslint-final.log.gz` |
| `python3 -c from pathlib import Path; import subprocess; files=sorted(Path("experiments/pg17-deletion-capture").glob("*.mjs")); [subprocess.run(["node","--check",str(p)],check=True) for p in files]; subprocess.run(["git","diff","--check"],check=True); print(str(len(files))+" native modules parse; git diff --check passed")` | exit 0; sourceDrift=[] | `docs/research/evidence/2026-11-06-g1-deletion-capture/task1-fix1-syntax-and-whitespace.json`; `e2f8aa2b9de123bc09c6a6a75fd5b18b14d3d0d7bb8ee80a68631d5c219c03ea`; full log `task1-fix1-syntax-and-whitespace.log.gz` |

The first cost RED used a 20-character marker comparison for a 21-character marker, so its unrelated-body counter underreported. Its serialized-byte growth assertion still failed correctly. That run and its pre-fix probe source are retained. The corrected saved-SQL RED verifies exact body byte sizes and records four unrelated-body serializations at 8 and 32 MiB before failing the intended assertion. Reviewer evidence was neither replaced nor modified.

Final default native run: **16 scenario groups, 699 assertions**, including all original 14 groups, their eight real lock waits and twelve negative trigger tests, plus both I1 groups. Per-assertion totals are not independent test-case counts. Focused Jest: **2 suites / 45 tests passed**. Root ESLint passed; all seven native modules parsed; git diff --check passed. TypeScript bytes are unchanged from the previously passing typecheck, so no redundant typecheck/full gate was run in this fix.

| Added scenario group | Final assertions |
|---|---:|
| I1 actual reserve then seal before registration captures chunks with no invented asset/job | 43 |
| I1 existing intended asset with another project/story/chain is rejected | 9 |

Final native SHA256: `c294c6003a8ed9dce80c5332a3ea85303b28291ec0f14aec865502b24485df44`.
Fix patch SHA256: `379ca6e5d0034696ffbae65db3932f53ce91dc58a9b12a2807aa54c13be66ad9`.
Fix hash-manifest SHA256: `15bf083797a2f4c7cfe09facda795d121a17261caa640674d6975ca63f1d78d5`.

## Fix integrity

```json
{
  "head": "c0669e8058343f91deba8e468b03e4bf817b1ca5",
  "immediateBaselineHashesMatch": true,
  "changedOrNewFixFiles": [
    "supabase/migrations/20261106000002_media_deletion_capture.sql",
    "experiments/pg17-deletion-capture/fixture.mjs",
    "experiments/pg17-deletion-capture/verify.mjs",
    "experiments/pg17-deletion-capture/README.md",
    "experiments/pg17-deletion-capture/registration-check.mjs",
    "experiments/pg17-deletion-capture/fix-1-regressions.mjs",
    "experiments/pg17-deletion-capture/verify-fix-1.mjs",
    "experiments/pg17-deletion-capture/verify-snapshot-cost.mjs"
  ],
  "unchangedOriginalTask1Files": [
    "packages/web/src/lib/server/media-deletion-capture.ts",
    "packages/web/src/app/api/media/delete-request/route.ts",
    "packages/web/src/lib/server/__tests__/media-deletion-capture.test.ts",
    "packages/web/src/app/api/media/delete-request/__tests__/route.test.ts",
    "experiments/pg17-deletion-capture/scenarios.mjs"
  ],
  "allFrozenSourceHashesMatch": true,
  "nativeSourceHashesMatch": true,
  "changedOriginalTakeoverFiles": [
    "packages/web/src/app/api/media/delete-request/route.ts",
    "packages/web/src/app/api/media/delete-request/__tests__/route.test.ts"
  ],
  "stagedFiles": [],
  "diffCheckExit": 0
}
```

All original takeover files except the already authorized old route/test still match their saved bytes. No original baseline file is missing; no prior experiment or evidence file was modified. Staging remains empty. The next action is the parent-owned scoped re-review; Task 2 and final gates remain outstanding.

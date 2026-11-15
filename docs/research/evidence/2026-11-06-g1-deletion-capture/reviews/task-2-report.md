# Task 2 — Candidate-aware Scheme B manifest and replay

Status: **DONE** for this task's scoped implementation and verification. Independent scoped review and the full repository gate belong to the parent. No commit, staging, push, deployment, remote migration, paid API or family content was used. G1/push qualification remains false.

## Scope and implementation

The production change is exactly three lines: add `'recording-candidates'` to `StorageObjectEntry.bucket` and both existing `ALLOWED_BUCKETS` sets. Public signatures, object manifest shape, replay matching, malformed/path/duplicate/hash/size checks and ledger behavior remain unchanged.

Tests extend the existing Jest and Node files. A separate native runner, `experiments/pg17-deletion-capture/verify-backup.mjs`, and its `BACKUP.md` usage notes exercise actual durable capture coordinates with both validators and the real CLI. No Task1 SQL, adapters, routes, test/harness files or README were changed.

Parent scope ruling added one mechanical gate-support line to `scripts/__tests__/deployment-config.test.js`: the exact filename `20261106000002_media_deletion_capture.sql` after `20261106000001_recording_story_save.sql`. This is an inventory assertion only; it does not establish full migration-chain execution.

Five existing source/test files were saved immediately under `task-2-before/`; all matched the corresponding batch `before/` bytes. `task-2-baseline.json` records the original four assigned files; the later authorized deployment test was also saved before editing. The frozen patch uses the required batch `before/`, not Git HEAD.

## TDD evidence

Every command below used `.superpowers/sdd/2026-11-06-upgrade-g1-deletion-capture/command.py`. Each label identifies matching `.json` and `.log.gz` evidence under `docs/research/evidence/2026-11-06-g1-deletion-capture/`. All recorded `sourceDrift` arrays are empty. Existing evidence was never rewritten.

| Label | Command | Result |
| --- | --- | --- |
| `task2-jest-red-1` | `npm test --workspace=packages/web -- --runInBand src/lib/server/__tests__/scheme-b-backup.test.ts` | Exit 1; 10 failed, 27 passed. Candidate manifest validation fails with `DISALLOWED_BUCKET_NAME`, including paths/size/hash cases blocked before their expected checks. |
| `task2-infra-red-1` | `node --test scripts/__tests__/verify-scheme-b-backup.test.js` | Exit 1; 3 failed, 7 passed. Mixed manifest, candidate validation and actual CLI file mode fail on the disallowed candidate bucket. |
| `task2-native-red-1` | `node experiments/pg17-deletion-capture/verify-backup.mjs` | Exit 1 after successful actual capture; both validators report `DISALLOWED_BUCKET_NAME`, actual file CLI exits 1 with the same error. 43 assertions reached; cluster cleanup succeeds. |
| `task2-deployment-list-red-1` | `node --test scripts/__tests__/deployment-config.test.js` | Exit 1; 1 failed, 6 passed. Actual migration list includes the new capture migration but expected list does not. |
| `task2-jest-green-1` | Same focused Jest command | Exit 0; **37/37** tests pass. |
| `task2-infra-green-1` | `node --test scripts/__tests__/verify-scheme-b-backup.test.js scripts/__tests__/deployment-config.test.js` | Exit 0; **17/17** tests pass: 10 backup checks including the existing parent test, plus 7 deployment checks. |
| `task2-native-green-1` | Same native runner | Exit 0; **82 assertions** pass. Three scenario groups account for 54 assertions; the remaining 28 cover runtime, fixture setup and compilation. |
| `task2-root-eslint-green-1` | Root `./node_modules/.bin/eslint --config eslint.config.cjs` on all six Task2 JS/TS source/test files | Exit 0; no warnings/errors. |
| `task2-diff-check-green-1` | `git diff --check --` the five modified existing source/test files | Exit 0. |

RED was observed before any production bucket change. The native runner itself was identical in RED and GREEN. No intermediate test repair was needed. Root ESLint was used, not package-local ESLint.

## Actual native capture to replay

Reproduce with:

```sh
node experiments/pg17-deletion-capture/verify-backup.mjs
```

Raw RED directory:

`docs/research/evidence/2026-11-06-g1-deletion-capture/native-backup-1793935620832-01c63300-6229-4178-bc88-f594ea72d9b1/`

Raw GREEN directory:

`docs/research/evidence/2026-11-06-g1-deletion-capture/native-backup-1793935677873-38321e13-9544-495d-86a7-10fc7947f578/`

The local runtime is the shared fingerprint-pinned PostgreSQL 17.4 harness with TCP disabled. A real `service_role` connection has `rolsuper=false` and `rolbypassrls=false`. Existing fixture exports perform actual story reserve, recording seal, candidate reserve/prepare, and finalization publication. Asset/job registration uses the existing fixture inserts. A second unrelated story has an actual reserved candidate and persisted chunk. A third legacy object is explicitly synthetic Storage metadata plus a local synthetic file.

The manifest is frozen before calling the actual Task1 deletion RPC. The published candidate manifest address is read from persisted candidate metadata and checked equal to the published asset address. The RPC's durable target is then required to match that address. Every captured storage target is converted directly to the existing `SchemeBTombstoneRecord` shape, without fabricating a candidate address or forcing logical IDs to match the manifest.

GREEN capture:

- Request ID: `c2f5e1aa-f449-464b-9233-71f4f7a8fcd4`.
- Subject story: `de6faf6a-a0f6-4222-859d-73e2e46eca52`.
- Manifest freeze: `2026-11-06T03:28:02.059Z`.
- Durable tombstone: `2026-11-06T03:28:02.073669+00:00`.
- Replay timestamp normalized for the existing contract: `2026-11-06T03:28:02.073Z`; raw microseconds remain in capture evidence.
- Four durable targets: story, asset, original chunk, published candidate. Two storage targets are passed to replay.
- Candidate target row ID: `788d67be-2075-414a-a37a-9ea54b8b83b8`.
- Actual bucket: `recording-candidates`.
- Actual object key: `jobs/5c3b2c5f-768b-4f5a-a97a-d0761ed279d8/attempts/1/c629cb74-a65e-494a-9a96-c3c4039a6b8f`.
- `physicalDeletionComplete: false`; target state remains `pending`.

The four-object manifest deliberately contains the selected published candidate plus an unrelated story's original chunk and reserved candidate, plus the independent legacy object. The deleted story's own original chunk is captured and replayed but absent from this particular four-object manifest subset. This explicit selection tests exact candidate exclusion while retaining every unrelated entry.

Input sizes are `24 + 24 + 24 + 42 = 114` bytes. TS and CJS both produce `purgedCount: 1`, the exact three complete surviving entries in input order, and `survivingTotalBytes: 90`. The CLI's full structured `file_verification` report equals the TypeScript and CJS results and exits 0 with empty stderr. The manifest/tombstone objects are unchanged in memory; full database and synthetic-file snapshots are unchanged during validation/replay.

Native raw artifacts include:

| File | SHA-256 |
| --- | --- |
| `synthetic-header.dump` | `0e3664bb142140e3c72b86ede363b15476199894797e65575c238e7e11dd4cc8` |
| `manifest.json` | `631df96d995465b9858651e9488e10594c7270a4e6734dfa2c32828540fb830e` |
| `capture.json` | `c26b299902e400ae60f85f92c49b5ec02f4c17d5d8f25aa0e78c38335a75b7c7` |
| `tombstones.json` | `c3cd8f42cce6ede5a7ca43b6cc2e5714510f4829f4be78a1492a26ec78d6b92a` |
| `compatibility.json` | `31df93b0bdea4112b5dd067962aa31741c9068e2ab42607169574179d4c4103e` |
| `after-replay.json` | `629c237e0d4257ae7a4a12fd10fca2cc6878cb6cefcb83d171892491720e2169` |
| `validation-parity.json` | `97d1e1da81f660e329e08cd6971cb7640c83ff88e04a4f2ca72d84b54a1d111e` |

`results.json` records the source hashes, artifact hashes, full durable capture, native runtime fingerprints, actual CLI stdout/stderr and the final cleanup: cluster stopped, temp directory removed, zero clients, no cleanup errors.

## Retained validation and ledger semantics

Fourteen native TS/CJS parity cases reject unknown buckets, traversal/absolute/backslash/control-character keys, empty IDs, malformed entries, invalid hashes, zero/fractional/unsafe sizes, duplicate candidate physical addresses under different IDs, byte-total overflow, and dump hash mismatch. Both implementations preserve all four entries for pre-freeze tombstones. Existing Jest tests continue covering inclusive freeze boundaries, malformed tombstone timestamps and ledger validation. `evaluateSchemeBBackupStatus(null)` remains unverified. No backup ledger was written.

The Node tests execute real CLI file mode for both a valid candidate manifest and an unsafe candidate path. The native runner additionally executes the real CLI on the actual captured coordinates and compares the full report with the actual compiled TS and loaded CJS modules. Compilation here is transpilation; the parent performs the repository semantic type-check and full gate.

## Frozen files and integrity

Frozen using `review-package.py task-2` against batch `before/` bytes:

| File | SHA-256 |
| --- | --- |
| `packages/web/src/lib/server/scheme-b-backup.ts` | `1c5edc5e4de767a2bbb587ed77cdb2f4a3dfa1b4bfcad6041eb23e17619ba01c` |
| `scripts/verify-scheme-b-backup.cjs` | `fb6f89202c1f0db4dbc19cfb73819518854b53417c4461e09d0b9db89bd79cbf` |
| `packages/web/src/lib/server/__tests__/scheme-b-backup.test.ts` | `d5864d1ad89dc8aeba352a61fa12f9ead61dc3d46830df5432fe2e728b2d5030` |
| `scripts/__tests__/verify-scheme-b-backup.test.js` | `cdb93a4d525da48eee825671c4d05b7bd8bb54502b45d0c1681dfe5c27dfb9ef` |
| `scripts/__tests__/deployment-config.test.js` | `b711c425b24f926a906afe31ee46c7e8eeec5e66b10d72899e6f331781318474` |
| `experiments/pg17-deletion-capture/verify-backup.mjs` | `bdd8fc7e185cc382678e8079191f1a7dc00fac8dc043307e32bc0df35f52cb86` |
| `experiments/pg17-deletion-capture/BACKUP.md` | `3e97cbba88b2075491e05c12eecb098dd78cc9fbdb81f3bf78880b71a96221ea` |

- `task-2.patch` SHA-256: `97bff4ff82ff6d7fb0bd151a22ce24dbba0540f358f3a0a8cb759aed9b61be2e`.
- `task-2-hashes.json` SHA-256: `bd9b4e112ffadb22e9aadff1d67fdec9eb2129cedc866687c2c546c8f3fecce3`.
- `task-2-integrity.json` records all command archive/raw hashes and rechecks the seven Task2 frozen files plus all thirteen Task1 `task-1-fix-1-hashes.json` files: **zero mismatches**.
- `git diff --cached --name-only` is empty. Work remains unstaged/uncommitted in the inherited feature checkout.

## Limits and concerns

No unresolved Task2 implementation concern was found in scoped verification. Independent review and final full-gate results are pending at parent level.

This is manifest and computed restore-set compatibility. The 55-byte dump is synthetic magic/header/payload, not a physical PostgreSQL backup and not a restorable archive. The fixture computes local synthetic object sizes/hashes; the backup validators do not download or verify Storage object bytes. Existing CLI `verified: true` only reflects its existing structural checks and is not a qualified ledger or restore result. These semantics were intentionally not expanded or relabeled in production.

The runner performs no Storage deletes, network Storage calls, pg_dump/pg_restore, remote migrations, or physical backup/restore qualification. Cleanup removes only the isolated local cluster and scratch. Reference-safe GC, late noncooperating writes, cloud/device behavior, full migration-chain execution, G1 completion and push readiness remain unqualified. Applying selected actual migrations in a synthetic prerequisite database does not change that boundary.

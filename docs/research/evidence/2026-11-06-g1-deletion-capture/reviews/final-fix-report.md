# Final I1 correction — seal/deletion capture fence

The final Important finding is corrected within the assigned seven-file scope. A forward `CREATE OR REPLACE FUNCTION public.seal_recording_manifest(jsonb)` now requires READ COMMITTED, sets a function-local three-second lock timeout, and acquires deletion_requests SHARE before advisory, authority and source-table locks or source reads. It retains that transaction lock through source insertion. VOLATILE is explicit; SECURITY DEFINER and `pg_catalog, pg_temp` remain fixed. Signature, manifest validation, identity checks, row writes, receipt and replay checks retain the historical body. Only the stated boundary and its comments change. EXECUTE is revoked from PUBLIC/anon/authenticated and granted to service_role.

`20261102000001_recording_seal_manifest.sql` remains byte-for-byte unchanged; no pg_proc patching or second callable seal entrypoint exists. The new migration is `20261106000003_recording_seal_deletion_fence.sql`, registered exactly once immediately after capture in the deployment inventory test. Fixture setup applies it by default, including backup. The default capture runner includes the five new regression groups. No scope expansion or parent progress/status document edit was needed.

Implementation is frozen in `final-fix-hashes.json` and `final-fix.patch`; parent has been notified and owns the full gate and scoped re-review. This report does not claim their acceptance.

## Actual RED / GREEN behavior

The RED runner was written and run before production changes. It uses the unchanged historical SQL, actual service-role connections and the reviewer's precise scheduling method: a separate EXCLUSIVE lock on recording_sessions queues the old seal's RowShare SELECT and capture's ShareRowExclusive population lock; releasing the gate lets capture overtake seal's INSERT, which then waits at RowExclusive. All three actual waits retain pg_stat_activity, pg_blocking_pids and pg_locks for waiter and blockers.

RED exits 1 at `no committed seal chunk may escape immutable deletion capture`, after 42 assertions. Its full before/transaction-local/after/replay rows demonstrate one story target, two later committed real chunks absent from targets, and an identical replay that cannot recover them. Both synthetic Storage metadata and local synthetic bytes remain unchanged. The RED report's fixture fingerprint matches the saved immediate baseline; only that fixture was subsequently changed to apply the forward migration. It is expected to differ from current fixture bytes. No production input changed during RED.

GREEN uses the same queued test and safety assertion. The seal holds SHARE while waiting at the original session SELECT; capture instead waits on deletion_requests EXCLUSIVE. Seal commits first, then capture persists story plus both exact committed chunk addresses, with no invented asset/job. Reverse ordering uses an actual successful capture transaction held before commit: seal waits at deletion_requests SHARE without advisory, authority or source-table locks, then returns 23505 against the fresh tombstone without any session/chunk writes. Capture replay and all complete rows remain identical.

Additional native tests establish REPEATABLE READ and SERIALIZABLE snapshots before capture commits, verify that the old snapshot still sees the earlier tombstone count, then require seal to reject with 22023 and preserve all rows/bytes. A real fence wait expires at approximately three seconds with 55P03, causes 25P02 in the enclosing transaction, rolls back without mutations and leaves no fence/source/advisory locks. The same connection then succeeds at valid seal and exact replay. Conflicting manifests and malformed identity still fail. Catalog settings and actual anon/authenticated/metadata_reader/service_role calls prove service-only EXECUTE, VOLATILE, security-definer and fixed search_path/timeout.

## Commands and measured results

All commands below run from the repository root through `.superpowers/sdd/2026-11-06-upgrade-g1-deletion-capture/command.py`. Each label is unique; compressed stdout/stderr, raw and archive hashes, exact argv, exit status and before/after source maps are retained. All nine command maps report zero in-command source drift.

- `final-fix-resume-red01`: native legacy fence regression, expected exit 1 / ASSERT_FAILED after 42 assertions, 3 real waits.
- `final-fix-resume-green01`: focused native GREEN, exit 0; 5 groups / 87 assertions, 4 real waits.
- `final-fix-resume-default01`: corrected default capture, exit 0; 21 groups / 759 assertions, 12 real waits (8 existing plus 4 new). Existing sealed-before-registration, asset/candidate targets and rollback coverage remain exercised.
- `final-fix-resume-backup01`: corrected default fixture + backup compatibility, exit 0; 3 groups / 82 assertions. Actual captured coordinates feed unchanged TS/CJS validators and actual CLI file mode. All seven artifact sizes/hashes independently rechecked.
- `final-fix-resume-focused01`: four existing Jest suites, exit 0; 125 tests pass (seal ledger, seal route, deletion adapter, deletion route).
- `final-fix-resume-infra01`: deployment-config inventory/infra file, exit 0; 7 tests pass.
- `final-fix-resume-eslint01`: diagnostic invocation error, exit 2. I selected the legacy `.eslintrc.js` while ESLint was in flat-config mode. This did not lint or change source and is not passing evidence.
- `final-fix-resume-eslint02`: corrected root `eslint.config.cjs`, exit 0 across all five owned JS/MJS files, no warnings/output.
- `final-fix-resume-syntax01`: `node --check` on all five owned JS/MJS files and `git diff --check`, exit 0.

All four native clusters stopped, all scratch directories were removed, zero clients remained, and cleanup errors are empty. The three successful native source maps match current bytes (24, 32 and 29 files respectively). Full report observations retain all relevant complete database rows and synthetic bytes, not only receipts. Native execution applies selected actual routines atop synthetic prerequisites; it does not qualify the full migration chain.

## Frozen sources and immediate diff

The patch was independently reconstructed from `final-fix-before/` and matches exactly. All 28 saved baseline copies still match `final-fix-baseline.json`. The patch contains only the seven owned changed/new files, excluding parent-owned status/spec changes.

- Historical seal migration SHA256: `73022a504372e430beb4711d1c27cfc39d370a0c3dbabeec39ab15c11f4f0662`.
- `final-fix.patch` SHA256: `a11309e56129319666f09fdc9f26cb1a87a257b34f702dee8306ec9e9d06394a`.
- `final-fix-hashes.json` SHA256: `6d163fc22afd3dfba2a4e3f7a1c92a33b4b7a0de821796223470073aa906d018`.
- `final-fix-integrity.json` SHA256: `030f05494f1e1156354f74b03ec5f5ebdc549ff01cc65158ad06ddee9d9efa03`.
- HEAD remains `c0669e8058343f91deba8e468b03e4bf817b1ca5`; cached diff is empty. No stage/commit/push/deployment occurred.

| Source | Immediate before SHA256 | Frozen current SHA256 |
| --- | --- | --- |
| `experiments/pg17-deletion-capture/README.md` | `b8bcbfce6079c7a7b977c4f3124d8a7dab100191ae93f5212ac0a06a224c5bac` | `5f3b18732631cc789fe3bf13b88dd32df7ff41029afc1627a4fc8d22d8cb59a3` |
| `experiments/pg17-deletion-capture/fixture.mjs` | `7ba4cd9f04ab2cc682644f358fc5d711cdf5ac01067b2c476a4fcac87b888f24` | `bb49328176ceaf6bce2a7b913b276bc664cde843cc734c67262549ed985a01ea` |
| `experiments/pg17-deletion-capture/seal-fence-regressions.mjs` | `new file` | `97d7f3c57b44f921ed62c5892899f3bee74b61bde12494df7ba9f77699623c49` |
| `experiments/pg17-deletion-capture/verify-seal-fence.mjs` | `new file` | `9992c74028a0234aadb5c16507f4ad8ed188d8bb1925b6ae712e494ce45fdba0` |
| `experiments/pg17-deletion-capture/verify.mjs` | `1e881236da93a77b663e80aca2892efa12c158517a761c828d035be3601ea4ac` | `745e604abf29a0dda0517ca3fd7bf276917ad3b51793c0e5f5de2f434286b2d9` |
| `scripts/__tests__/deployment-config.test.js` | `b711c425b24f926a906afe31ee46c7e8eeec5e66b10d72899e6f331781318474` | `39e7ce9f9c90ae89c7a8e066c13576ffe9c91aad070929dc417399aeff32d505` |
| `supabase/migrations/20261106000003_recording_seal_deletion_fence.sql` | `new file` | `cb1d15de2782ed2c0fde5c69b1ee2684b8a5a941e46623c6092a4003c1784628` |

## Native result fingerprints

- `docs/research/evidence/2026-11-06-g1-deletion-capture/native-seal-fence-red-1793973858990-d070f72a-9e34-4c84-8782-3017e245c38c/results.json`
  - SHA256 `a757aebaedc907df19ade1827825b399a882fd72317de75c6a7d9275431515b5`; failed, 1 groups, 42 assertions, 3 waits.
- `docs/research/evidence/2026-11-06-g1-deletion-capture/native-seal-fence-1793973965719-f972728d-d982-4289-8c72-21012283b37e/results.json`
  - SHA256 `23e134786ed8754dd93622a8d0643eb12650753a9a8e0a4b6f567a39b1f10803`; passed, 5 groups, 87 assertions, 4 waits.
- `docs/research/evidence/2026-11-06-g1-deletion-capture/native-1793974055239-4b654280-1389-4ffa-ad49-7a3c272b31dd/results.json`
  - SHA256 `8758ae4c131e9b63160581550bdcd9f8a8aa22590b15ac296f2feb27e39018d5`; passed, 21 groups, 759 assertions, 12 waits.
- `docs/research/evidence/2026-11-06-g1-deletion-capture/native-backup-1793974055241-c8a4eef0-be31-4cee-835f-b671127bb05d/results.json`
  - SHA256 `3823191e3afb9f45f9a9cbfd62e82b8756d43c30549b9fe874f747c8804190db`; passed, 3 groups, 82 assertions, 0 waits.

## Command/archive fingerprints and exact argv

- `docs/research/evidence/2026-11-06-g1-deletion-capture/final-fix-resume-backup01.json`; exit 0.
  - Exact argv: `["node", "experiments/pg17-deletion-capture/verify-backup.mjs"]`
  - Command record SHA256 `2d423797fe1dc53836640a3cd39135eb51799d731c1b491a1cb6f9bc8d9d162c`
  - `docs/research/evidence/2026-11-06-g1-deletion-capture/final-fix-resume-backup01.log.gz` SHA256 `2589c3fd999bebc289b28b487334195f796da418aa73069cef92324f0ba9e3dc`
  - Decompressed output SHA256 `7343826b2a49bea7e0a26d8c7556a88d1bcabffa976ab0a3c94a19c0f3a4dd1f`
- `docs/research/evidence/2026-11-06-g1-deletion-capture/final-fix-resume-default01.json`; exit 0.
  - Exact argv: `["node", "experiments/pg17-deletion-capture/verify.mjs"]`
  - Command record SHA256 `f82d7e3afc06f87f32af2cea34267a4aee377a92c90ae91b4417c26ff2f81b76`
  - `docs/research/evidence/2026-11-06-g1-deletion-capture/final-fix-resume-default01.log.gz` SHA256 `41915f55b1e7162c0da2a6825bfe3294412691d6c9fa56242484d68466bfdfe6`
  - Decompressed output SHA256 `bfa71126cd389ff0d12159446086db2c81f2639fd54655bd1afabc02a3366c92`
- `docs/research/evidence/2026-11-06-g1-deletion-capture/final-fix-resume-eslint01.json`; exit 2.
  - Exact argv: `["node", "node_modules/eslint/bin/eslint.js", "--no-ignore", "--config", ".eslintrc.js", "experiments/pg17-deletion-capture/fixture.mjs", "experiments/pg17-deletion-capture/verify.mjs", "experiments/pg17-deletion-capture/seal-fence-regressions.mjs", "experiments/pg17-deletion-capture/verify-seal-fence.mjs", "scripts/__tests__/deployment-config.test.js"]`
  - Command record SHA256 `726a161380d83cf5c90cd3c957bfaae7a004ec64939ed256f1345ff4febf2e99`
  - `docs/research/evidence/2026-11-06-g1-deletion-capture/final-fix-resume-eslint01.log.gz` SHA256 `18bc56b38a68720b27dd6a254ec78c0213de92f0a0ad74a279bc3d5d6ee784e7`
  - Decompressed output SHA256 `83d0fe60dafc36845c6c62eba0590d8df1947eeb0e727c6ccc9326c902de132c`
- `docs/research/evidence/2026-11-06-g1-deletion-capture/final-fix-resume-eslint02.json`; exit 0.
  - Exact argv: `["node", "node_modules/eslint/bin/eslint.js", "--config", "eslint.config.cjs", "experiments/pg17-deletion-capture/fixture.mjs", "experiments/pg17-deletion-capture/verify.mjs", "experiments/pg17-deletion-capture/seal-fence-regressions.mjs", "experiments/pg17-deletion-capture/verify-seal-fence.mjs", "scripts/__tests__/deployment-config.test.js"]`
  - Command record SHA256 `38081830154ccce7466c615f5f27aaa8d437b08ee5139677d5362023cc102578`
  - `docs/research/evidence/2026-11-06-g1-deletion-capture/final-fix-resume-eslint02.log.gz` SHA256 `9ceffb7310338057cfe71a4ae1e2c98d2c485d81cdef906532a801f457a38d64`
  - Decompressed output SHA256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- `docs/research/evidence/2026-11-06-g1-deletion-capture/final-fix-resume-focused01.json`; exit 0.
  - Exact argv: `["npm", "test", "--workspace=packages/web", "--", "--runInBand", "--runTestsByPath", "src/lib/server/__tests__/recording-manifest-ledger.test.ts", "src/app/api/recordings/sessions/[sessionId]/seal/__tests__/route.test.ts", "src/lib/server/__tests__/media-deletion-capture.test.ts", "src/app/api/media/delete-request/__tests__/route.test.ts"]`
  - Command record SHA256 `6c6a059805665b2254a303a1295c3e493a3758e2e3706a32431fd558c6ab7537`
  - `docs/research/evidence/2026-11-06-g1-deletion-capture/final-fix-resume-focused01.log.gz` SHA256 `61b6dfeb61dc4397b9bf8361b9eeb1d323b4a50f421db0f987909cfb1ed13f2e`
  - Decompressed output SHA256 `a6168430103a237568b9bdf3e71aba7462102524c9d91cb259e112a0977a194f`
- `docs/research/evidence/2026-11-06-g1-deletion-capture/final-fix-resume-green01.json`; exit 0.
  - Exact argv: `["node", "experiments/pg17-deletion-capture/verify-seal-fence.mjs"]`
  - Command record SHA256 `16adece41f1ee552b54eec6e1b2a94482f69d9e0dc8c2ac8053072b58a344680`
  - `docs/research/evidence/2026-11-06-g1-deletion-capture/final-fix-resume-green01.log.gz` SHA256 `bd52813107ece771ab6fa07094ddc7c3adbae971ab7d8dc699dab8387f96b113`
  - Decompressed output SHA256 `73051442901240a1edeffa11e0827ca4a9de56bf81fc8a722eae51220a3753a0`
- `docs/research/evidence/2026-11-06-g1-deletion-capture/final-fix-resume-infra01.json`; exit 0.
  - Exact argv: `["node", "--test", "scripts/__tests__/deployment-config.test.js"]`
  - Command record SHA256 `4e1d90d9c2d90899f67fbb9838e60119d9509b4aa0f5aff1b0a19aa60152bac6`
  - `docs/research/evidence/2026-11-06-g1-deletion-capture/final-fix-resume-infra01.log.gz` SHA256 `ef99ac8f3b5a3c6949e4079a188f257d33e72d9e1a21ff5c774e58c2cefc01c8`
  - Decompressed output SHA256 `a589b9a976a105bb16b40850f2b26cae687bb1578d405b1b1be188ebcfaa28e4`
- `docs/research/evidence/2026-11-06-g1-deletion-capture/final-fix-resume-red01.json`; exit 1.
  - Exact argv: `["node", "experiments/pg17-deletion-capture/verify-seal-fence.mjs", "--without-seal-fence"]`
  - Command record SHA256 `a72c7450617fc4f698b468988b59aeeef6614274c9e29a3b822330f05d51977b`
  - `docs/research/evidence/2026-11-06-g1-deletion-capture/final-fix-resume-red01.log.gz` SHA256 `eb2e97c7acd1c371eac0dcadde39dd6f6c8ed805b29e02a6e2e69195000eefc2`
  - Decompressed output SHA256 `b4c338c741ae5473f5e706097415a9ad09de7b22d3e4ade5c31d8da37d662e9f`
- `docs/research/evidence/2026-11-06-g1-deletion-capture/final-fix-resume-syntax01.json`; exit 0.
  - Exact argv: `["python3", "-c", "import subprocess; files=[\"experiments/pg17-deletion-capture/fixture.mjs\",\"experiments/pg17-deletion-capture/verify.mjs\",\"experiments/pg17-deletion-capture/seal-fence-regressions.mjs\",\"experiments/pg17-deletion-capture/verify-seal-fence.mjs\",\"scripts/__tests__/deployment-config.test.js\"]; [(subprocess.run([\"node\",\"--check\",p],check=True),print(\"syntax passed:\",p)) for p in files]; subprocess.run([\"git\",\"diff\",\"--check\"],check=True)"]`
  - Command record SHA256 `741483d97b760a4e1f9854f8790b91b50dc7e5c21c1032e28a4a209da3071110`
  - `docs/research/evidence/2026-11-06-g1-deletion-capture/final-fix-resume-syntax01.log.gz` SHA256 `ff966d8d5caa781b8768783cd69fed4e798b56546393423c2dc92a9082ea6c6d`
  - Decompressed output SHA256 `4230c090da9927346fb03f8acd6d7f751ca98580f0cc0f0b53d0cb73f2d2257e`

## Backup artifact fingerprints

- `docs/research/evidence/2026-11-06-g1-deletion-capture/native-backup-1793974055241-c8a4eef0-be31-4cee-835f-b671127bb05d/synthetic-header.dump`: 55 bytes; SHA256 `0e3664bb142140e3c72b86ede363b15476199894797e65575c238e7e11dd4cc8`.
- `docs/research/evidence/2026-11-06-g1-deletion-capture/native-backup-1793974055241-c8a4eef0-be31-4cee-835f-b671127bb05d/manifest.json`: 1440 bytes; SHA256 `9f6893c65c86d8cf43aee0dbee4cce2e0eb0b93c991fbc333d0b01307b5e4dca`.
- `docs/research/evidence/2026-11-06-g1-deletion-capture/native-backup-1793974055241-c8a4eef0-be31-4cee-835f-b671127bb05d/capture.json`: 56898 bytes; SHA256 `f13b8b0b9cd68e51454dcdc61e58c09ba09ebfac3966ddb8b06e64f7e08400d3`.
- `docs/research/evidence/2026-11-06-g1-deletion-capture/native-backup-1793974055241-c8a4eef0-be31-4cee-835f-b671127bb05d/tombstones.json`: 931 bytes; SHA256 `73fca58ae94c9dfdd3bd8571f04122263c56a00306c6f845c65d69b9f33b9c8f`.
- `docs/research/evidence/2026-11-06-g1-deletion-capture/native-backup-1793974055241-c8a4eef0-be31-4cee-835f-b671127bb05d/compatibility.json`: 4954 bytes; SHA256 `d3013911f6897e454d6a488ff4739743d9989fb40656ae1b4e6847da0ca3d615`.
- `docs/research/evidence/2026-11-06-g1-deletion-capture/native-backup-1793974055241-c8a4eef0-be31-4cee-835f-b671127bb05d/after-replay.json`: 22099 bytes; SHA256 `04e30dc7772d00adf361d335e159ab23685aa54a1e2de74eb7627b623400f70f`.
- `docs/research/evidence/2026-11-06-g1-deletion-capture/native-backup-1793974055241-c8a4eef0-be31-4cee-835f-b671127bb05d/validation-parity.json`: 2880 bytes; SHA256 `97d1e1da81f660e329e08cd6971cb7640c83ff88e04a4f2ca72d84b54a1d111e`.

## Remaining boundaries

No historical evidence was edited; the original overlap review and diagnostic attempts remain in place. All new logs/results use unique paths. Parent owns the broader inherited-work/evidence integrity verification, final full gate and scoped review. Physical Storage removal, reference-safe GC, reconciliation of late Storage writes, real pg_dump/pg_restore, backup-ledger qualification, full migration-chain execution, throughput/cloud/device and G1/push qualification remain open. The backup runner's 55-byte PGDMP header fixture is synthetic and not a restorable dump. No Storage deletion, paid call, remote migration, family content or release action was performed.

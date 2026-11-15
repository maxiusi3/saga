# Task 2 independent scoped review

Spec: **Approved**  
Quality: **Approved**

Reviewed on 2026-11-06 against `task-2-brief.md`, the binding `docs/superpowers/specs/2026-11-06-g1-deletion-capture-design.md` backup scope / acceptance 5, and repository `CLAUDE.md`. This verdict covers the seven frozen Task 2 files only. HEAD remains `c0669e8058343f91deba8e468b03e4bf817b1ca5`; the comparison is the batch takeover `before/`, not HEAD. The parent-authorized migration inventory line is included. Task 1's approved implementation is an input, not reopened here.

## Findings

- Spec findings: **none**. No missing scoped requirement, incorrect implementation, or unauthorized scope expansion found.
- Quality findings: **none**. No actionable P0–P3 defect or documented-standard violation found in this diff.

## Spec assessment

The production diff adds exactly `recording-candidates` to `StorageObjectEntry.bucket` and both existing validator allowlists. It changes no public signatures, manifest fields, replay rules, validation checks, or ledger semantics. The two existing test files cover the mixed four-object manifest, removal by physical bucket/key with different logical IDs, preservation of unrelated complete entries, and candidate-specific rejection cases. Actual CLI file mode has both a successful candidate case and an unsafe-path failure. The only deployment-test addition is `20261106000002_media_deletion_capture.sql`, immediately after the story-save migration; this is an inventory assertion.

The standalone runner consumes actual SQL capture rows. Limited extra reads resolved the concrete integration question of whether fixture addresses were genuinely persisted/published and capture invoked the real RPC: `fresh` performs reserve/seal/candidate reserve/prepare/finalization, and `capture` calls `public.request_media_deletion` on a real service-role connection. The recorded selected candidate remains `prepared` as candidate evidence, while its asset is `ready` and its job is `succeeded`; the published asset and candidate have identical bucket/key. The unrelated candidate is `reserved`. This evidence supports publication without inventing a candidate state named `published`.

## Independently checked evidence

- Parsed and applied all seven patch sections in memory to the batch `before/` bytes; every result exactly equals the current file. The five existing files' immediate `task-2-before/` copies equal batch `before/`. Recomputed all seven Task 2 hashes and all thirteen Task 1 fix hashes: **zero mismatches**. Patch SHA-256 is `97bff4ff82ff6d7fb0bd151a22ce24dbba0540f358f3a0a8cb759aed9b61be2e`; hash-file SHA-256 is `bd9b4e112ffadb22e9aadff1d67fdec9eb2129cedc866687c2c546c8f3fecce3`.
- Recomputed all nine command archive hashes and decompressed raw-output hashes. All match the recorded integrity values; all source-before/source-after maps are independently equal. RED-to-GREEN source differences are limited to the two production files and authorized deployment test. The native runner and added test cases are unchanged between RED and GREEN.
- Read raw RED/GREEN evidence: candidate rejection is `DISALLOWED_BUCKET_NAME` in TS, CJS and actual CLI before the allowlist change. GREEN focused Jest is **37/37**, Node infrastructure is **17/17** including the existing parent test, native compatibility is **82 assertions** (54 scenario assertions plus 28 runtime/setup/compilation assertions). Root ESLint and scoped diff check exit 0 with empty output. Broad suites were not rerun during this review.
- Recomputed every artifact hash in both native directories: RED **5/5**, GREEN **7/7**, and checked every artifact/source hash printed in the implementation report. All **28** GREEN native source hashes match current files. Native evidence records PostgreSQL **17.4**, pinned executables, Unix socket transport, and actual `service_role` with `rolsuper=false`, `rolbypassrls=false`. Both runs record stopped clusters, removed scratch directories, zero clients and no cleanup errors.

GREEN raw evidence directory:
`docs/research/evidence/2026-11-06-g1-deletion-capture/native-backup-1793935677873-38321e13-9544-495d-86a7-10fc7947f578/`

The durable request is `c2f5e1aa-f449-464b-9233-71f4f7a8fcd4` for story `de6faf6a-a0f6-4222-859d-73e2e46eca52`. Its four persisted targets are story, asset, original chunk and candidate; all remain `pending`. The candidate target `788d67be-2075-414a-a37a-9ea54b8b83b8` names:

`recording-candidates:jobs/5c3b2c5f-768b-4f5a-a97a-d0761ed279d8/attempts/1/c629cb74-a65e-494a-9a96-c3c4039a6b8f`

Checked both storage targets field-for-field against generated tombstones. Freeze `2026-11-06T03:28:02.059Z` precedes raw capture `2026-11-06T03:28:02.073669+00:00` and normalized replay timestamp `2026-11-06T03:28:02.073Z`. Independently filtered the actual manifest by those captured addresses: **purgedCount 1**, exactly entries **0, 2, 3** in their original order, **survivingTotalBytes 90**, from **114** input bytes. Full TS/CJS survivor objects and parsed CLI output agree; CLI exits 0 with empty stderr. The selected story's captured original chunk is explicitly absent from this four-object subset.

Checked the embedded synthetic bytes against every manifest size/hash, all fourteen raw negative parity results, capture-versus-after-replay snapshots, and unchanged Storage metadata/synthetic files. No in-scope mismatch remains.

## Cannot verify / qualification limits

This is manifest and computed survivor-set compatibility. The **55-byte synthetic PGDMP header/payload is not a restorable archive**. The fixture computes hashes of local synthetic files; validators do not download or verify Storage object bytes. Existing CLI `verified: true` does not qualify a backup ledger or actual restore. These boundaries are accurately stated in `BACKUP.md` and the report.

No pg_dump/pg_restore execution, physical deletion, reference-safe GC, cloud/device behavior, full migration-chain execution, or real backup restoration is established here. Applying selected migrations atop synthetic prerequisites does not change that. The whole repository gate and whole-change review remain the parent's separate acceptance responsibilities; this scoped verdict does not wait on or claim their result. **G1 milestone satisfaction and push readiness remain false.**

Only this review report was written; no source, index, branch, previous evidence, or frozen artifact was modified. The Git index was observed empty of staged changes.

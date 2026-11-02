# G1-01 Durable Manifest: Independent Specification Review

Verdict: **PASS**. No actionable specification discrepancies found.

Reviewer: `g1_manifest_spec_resume`, independent specification-only review.
Reviewed at: `2026-11-02T14:59:45Z`.
Baseline: `1ca1e06dd3ed81115ae29527892929194ba7e406`, branch `codex/october-upgrade-p0`.

## Scope And Findings

Read `CLAUDE.md`, `docs/superpowers/plans/2026-11-02-upgrade-g1-durable-manifest.md`, the batch research report, the complete supplied diff including untracked implementation files, and relevant existing runtime code. Checked requirements against actual code, not the report's conclusions.

- Canonical namespace: new uploads use owner/project/session/index without extensions; generic StorageService ownership and non-overwrite behavior remain unchanged. Existing logical merge validation and historical uploaded flags are preserved.
- Atomic ledger: strict canonical input, quotas, paths, storyteller/story/tombstone checks, transaction locks, complete session/chunk persistence, exact replay, conflict rejection, legacy refusal and immutable application DML grants match the plan. Existing authenticated reads remain intact; service reads and restricted RPC execution are explicit.
- HTTP gate: registration follows one bounded, abortable, non-retrying RPC and strict complete receipt validation. Missing/error/conflicting/malformed receipts fail closed. Scope is checked again before subsequent publication. Existing recoverable asset/job registration, feature flag, headers and cleanup denial remain intact.
- Compatibility: searched active packages/scripts and inspected registration, merge and deletion helpers. No existing direct recording-ledger DML caller is broken by the tightened grants. Existing session IDs originate from `crypto.randomUUID()`; strict database UUIDs fit the current capture path.
- Harness: inspected complete runner and unchanged isolation runtime, including real-role ACL tests, concurrent lock waits, rollback, legacy/corruption rejection, migration replay and cleanup. No scope expansion into Worker, readback or final confirmation.

## Evidence Actually Checked

No tests, build or type-check were rerun by this reviewer. Checked recorded commands/exits, decoded gzip logs, source hashes and PG source snapshots:

- `web-green-4.json`: exit 0; 8 suites / 165 tests; decoded bytes and SHA-256 match.
- Original PG index and all five indexed reports/logs/snapshots: missing-RPC `42883` RED remains exit 1; coherence failure remains failed; final normal/polluted runs each pass 15 scenarios / 645 assertions.
- `full-chain-resume.json`: exit 0; web 142 suites / 2295 tests, shared 4 / 16, infra 14, build 184 pages. Raw/gzip hashes match. The interrupted earlier full chain is not accepted evidence.
- `pg-resume-normal.json` and `pg-resume-polluted.json`: exit 0, each 15 / 645 on PostgreSQL 17.4. Verified referenced reports, all scenarios, source snapshots, environment scrubbing and cleanup; independently confirmed both temporary directories and server PIDs are absent.
- All 21 supplied current source hashes match. `next-env-check.json` documents the generated import exception; the current file matches the original hash. `git diff --check` passes.

## Limits

Only the manifest is atomic. Asset/job registration remains separate and recoverable. Receipt hash-format validation is not audio verification. Storage readback/hash/decode, Worker authorization/claim/publication, deletion RPCs, client final confirmation and safe cleanup remain future work. Local fixtures do not prove PostgREST or remote deployment. This PASS does not replace independent quality Approved, parent final evidence checks or the local checkpoint; G1-01 and the milestone remain incomplete.

## Reviewed Input Fingerprints

Supplied diff SHA-256: `5f13037edaf750b72ee0d7d258f648ae3ca142b0a0fdede6118d71e898b30b95`.
Supplied source-set JSON SHA-256: `86c6cc3a25bd60e9d3f23b7d3a4e48275a9076562ca85351024141753ed5a399`.

The following hashes were recomputed from current files. Context/config files in this set are fingerprinted dependencies, not separate implementation claims.

```json
{
  "packages/web/src/components/recording/__tests__/smart-recorder-session.test.tsx": "97cd7c770270d78991a88b8ae132632b52d4d6dadf1c4850e95f1159fc98c03c",
  "packages/web/src/lib/recording-chunk-location.ts": "eb7ab5be0b807ebae6fb45bd652bb8ce42e6e67289b581037fa1a30220b439b7",
  "packages/web/src/lib/local-recording-session.ts": "cc1874678a2763649bea033112ae8efa073b97c1c1286b7162c8b11d5876902a",
  "packages/web/src/lib/server/recording-manifest-ledger.ts": "9ab0ff04d1cac77e4e6230b5063d73ef4da7da3dc8c40535595aebf046c5a71d",
  "packages/web/src/app/api/recordings/sessions/[sessionId]/seal/route.ts": "fc9b2ab80d9b7c5e40028ca2b10858a8efe385e15678f213aafcc0f18270589e",
  "packages/web/src/lib/__tests__/recording-chunk-location.test.ts": "5d897f712d9721d5107982fbed27148546e83aca6a8ed02885f460869a619832",
  "packages/web/src/lib/__tests__/local-recording-session.test.ts": "f74cb758451f2dc6e9074880aa5aadb31df29686d7b20572e29282d639e5900c",
  "packages/web/src/lib/server/__tests__/recording-manifest-ledger.test.ts": "f1fabe9c3082f58f35655fbd12ef62e12936e9a5ac570e88f04df1bae93589c5",
  "packages/web/src/app/api/recordings/sessions/[sessionId]/seal/__tests__/route.test.ts": "3e526a44d36ac9e88b6dcbc7c652a9158b633581572ac59d91cfd4f625a72003",
  "packages/web/src/lib/server/recording-session-service.ts": "d91276b8d32df5a39f29c4d6587cb616f955d91386bc2f1e3608b823dc97d9e1",
  "packages/web/src/lib/server/recording-seal-registration.ts": "020afdf2200790cc637fa0c76bae7f219b3ca4098e014f53fe7a0a73c4c26542",
  "packages/web/src/lib/server/recording-merge.ts": "6f9fd03c0ebab3fe7f4ed8f84364b597d3f740f5122f4eebf1ed51b3e2f4b7c8",
  "packages/web/src/lib/server/media-asset-guard.ts": "386ca0af939b1398628680bb3b46b2f15c6b703034c043eb035ffc675f0836e0",
  "package.json": "0586ca2dfa01c7f8c2e4a2d42a3a56179cac53f9f74f5ec3336d2bf4ff913580",
  "package-lock.json": "e7107a320f21819660d34139162d5774caefc8d2381b52370cc19187345b969f",
  "packages/web/package.json": "7266c3b55d289c3262300940aa0eab80b47da071f5174302790b2607d851a9ea",
  "packages/web/next-env.d.ts": "7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651",
  "supabase/migrations/20261102000001_recording_seal_manifest.sql": "73022a504372e430beb4711d1c27cfc39d370a0c3dbabeec39ab15c11f4f0662",
  "experiments/pg17-recording-manifest/verify.mjs": "183080491b015df724e2ed4faf38dfc3e3ab0b2568084fcf96fab00dcb1c5190",
  "experiments/pg17-recording-manifest/README.md": "47cb476e1e2f759c0d2dc5fdbae3e597d2df8e5e259b7fb09f5c7861388392eb",
  "scripts/__tests__/deployment-config.test.js": "7bc593a54b8f74e25b056146d42b1c146fc94e25c5c5f56a1cce93e24e3377c4"
}
```

Additional checked PG dependencies:

```text
08783f906f994e9c7e8ebc4e745e687f77d08c476a40c176e0aa472d8d3c8ff1  supabase/migrations/20261024000001_p1_foundation_and_reconciliation.sql
326448f3651c389b702e207bc1598dfb8b38297f59f48d4d45b56fb64109d552  experiments/pg17-routines/runtime.mjs
55832ba949594fb7b0de5c512203f92d14b63c69dcd87e2cc3b8eab528ea2f67  experiments/pg17-routines/runtime-pins.json
```

Checked final evidence fingerprints (paths relative to this directory):

```text
3ed2f3124a0b2ec0bff48c3b102138523e86dc89979ee5666c4973322704cf80  web-green-4.json
b97fbbdac9f6690b6d5f248651ac66ee54e3df08f62c99c926824e9383d546fb  full-chain-resume.json
e81597bd3d378392a1514a7b1aaae5af044f31686a7b2abe10863956983289dc  pg-resume-normal.json
156270a970281be4603a9c4b9632eb52c5c9474df4a6c94fca0f1555b4fb374c  pg-resume-polluted.json
5198497c27440f16e3b81b9fc8308e98ec52a4fecd4e64b4113df1083ec48866  pg-verify-2026-11-02T14-52-47.329Z-513d36ca-7490-47ba-9acc-fd49ce5a600f.json
c47bf64445d88656726925736a6a15aa008b91d746efbe192af5317b26908ef3  pg-verify-2026-11-02T14-53-09.482Z-0980565b-5192-47b3-966d-0b517ecab309.json
b45ba036c5e367b26a3c167bc0843ee881be682fc5f6005650b8deb3f13ad78d  next-env-check.json
```

This review writes only this new receipt. No source edits, staging, commits, remote network, credentials, deployment or paid calls were performed.

# G1-01 Durable Manifest: Independent Quality Review

Verdict: **Approved**. No actionable correctness, regression, security or test-gap findings within the reviewed slice.

Reviewer: `g1_manifest_quality_resume`, independent quality review after the separate specification PASS; not the specification author or implementation author.
Reviewed at: `2026-11-02T15:17:05Z`.
Baseline: `1ca1e06dd3ed81115ae29527892929194ba7e406`, branch `codex/october-upgrade-p0`.

## Checked Scope

Read `CLAUDE.md`, the batch plan/report, separate specification receipt, complete supplied implementation diff including untracked files, and relevant existing callers and tests. Evaluated actual source behavior rather than treating the specification PASS as quality evidence.

- SQL identity and atomicity: exact schema/type/key validation; canonical UUID/path/hash binding; contiguous unique chunks; quota boundaries; current storyteller/story authorization; deletion checks; advisory session serialization; complete transactional insertion; strict no-write replay; rollback and legacy/corruption rejection. The manifest and its physical chunk rows agree, and neither the response nor persisted state fabricates ready/confirmation.
- SQL privilege boundary: qualified application objects, pinned security-definer search path, restricted function execution, removed application ledger DML and preserved authenticated reads. Checked the foundation schema/ACLs and searched active packages/scripts/migrations for ledger writers; no existing direct application writer is broken by the new grants. Trusted database-owner powers and future controlled Worker/deletion RPCs are distinct from application immutability.
- HTTP/RPC failure behavior: bounded abortable persistence, explicit retry disable, transport/SQL error handling, complete echoed-manifest and receipt validation, and refusal to register assets/jobs before a valid durable result. Reviewed the installed PostgREST retry implementation as well as unit doubles. Scope is checked again after persistence; previous recoverable asset/job registration, conservative cleanup, feature flag and response headers remain intact.
- Upload compatibility: actual SmartRecorder session IDs are generated with `crypto.randomUUID()`; new chunk names match the unchanged owner-prefixed StorageService upload behavior and logical merge identity. MIME handling and non-overwrite behavior remain intact. Existing uploaded flags and old objects are not reclassified or deleted; local persistence still precedes upload.
- Tests and harness: reviewed real-role ACL/RLS probes, malformed input/limit tests, concurrent backend lock waits, injected late-insert rollback, exact replay and corruption tests, migration replay, route gate/revalidation tests and actual StorageService path coverage. Reviewed the unchanged isolated PG runtime, source snapshots and cleanup checks. No concrete suspected defect required an additional reproduction.

## Evidence Actually Verified

No build, type-check, existing test suite or PG harness was rerun by this reviewer. Independently recomputed current source hashes, decoded archived logs, and checked recorded exits/results:

- All 21 supplied current source hashes match. Final web and SQL evidence uses these implementation bytes. The documented generated `next-env.d.ts` exception is limited to the build import; current bytes match its original hash. This reviewer did not restore or edit it.
- `web-green-4.json`: exit 0, type-check and 8 suites / 165 tests; raw bytes, SHA-256 and decoded gzip match.
- `full-chain-resume.json`: exit 0, Web 142 suites / 2295 tests, shared 4 / 16, infra 14 and build 184 pages. Raw/gzip bytes and hashes match. The earlier `full-chain.json` is zero bytes and is explicitly not accepted as a passing run.
- `pg-resume-normal.json` and `pg-resume-polluted.json`: exit 0; referenced reports each pass 15 scenarios / 645 assertions on PostgreSQL 17.4. All scenario statuses, report/source snapshot hashes and raw/gzip logs match. Polluted-environment keys are recorded as scrubbed. Cleanup records zero clients/no errors; both temporary directories and server PIDs are independently absent.
- `git diff --check` passes. Parent final historical-evidence/index/staging integrity work remains separate from this receipt.

## Residual Limits

Approval covers declared-input identity/durability only. It does not certify Storage object existence, hash/byte truth, decodability, Worker claim/publication, remote PostgREST behavior, a complete migration-chain rehearsal, cloud durability or client final confirmation/cleanup. Only the manifest transaction is atomic; asset/job registration remains a separate recoverable flow. Permission locks do not make future revocation/deletion globally atomic. These explicitly deferred boundaries do not become implemented capabilities through this review, and G1-01/the release milestone remain incomplete.

## Reviewed Input Fingerprints

Supplied diff SHA-256: `5f13037edaf750b72ee0d7d258f648ae3ca142b0a0fdede6118d71e898b30b95`.
Supplied source-set JSON SHA-256: `86c6cc3a25bd60e9d3f23b7d3a4e48275a9076562ca85351024141753ed5a399`.

The following hashes were recomputed from current files; unchanged context/config entries are dependencies, not additional implementation claims.

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

Checked evidence fingerprints (paths relative to this directory):

```text
3ed2f3124a0b2ec0bff48c3b102138523e86dc89979ee5666c4973322704cf80  web-green-4.json
b97fbbdac9f6690b6d5f248651ac66ee54e3df08f62c99c926824e9383d546fb  full-chain-resume.json
e81597bd3d378392a1514a7b1aaae5af044f31686a7b2abe10863956983289dc  pg-resume-normal.json
156270a970281be4603a9c4b9632eb52c5c9474df4a6c94fca0f1555b4fb374c  pg-resume-polluted.json
5198497c27440f16e3b81b9fc8308e98ec52a4fecd4e64b4113df1083ec48866  pg-verify-2026-11-02T14-52-47.329Z-513d36ca-7490-47ba-9acc-fd49ce5a600f.json
c47bf64445d88656726925736a6a15aa008b91d746efbe192af5317b26908ef3  pg-verify-2026-11-02T14-53-09.482Z-0980565b-5192-47b3-966d-0b517ecab309.json
b45ba036c5e367b26a3c167bc0843ee881be682fc5f6005650b8deb3f13ad78d  next-env-check.json
```

This review writes only this new receipt. No source/other document edits, staging, commits, remote calls, credentials, deployment or paid calls were performed.

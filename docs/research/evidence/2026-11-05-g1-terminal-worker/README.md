# G1 terminal worker evidence

Local slice complete. Implementation, focused tests, native integration, full
repository gate and all three independent specification/quality reviews passed.
G1 remains incomplete and every receipt denies local-draft cleanup.

## Primary execution records

- `verification.json`, `integrity.json`, `source-lock.json`: final completion,
  unchanged 2,744 prior evidence files, 3,800 compared takeover paths, exact
  intended inherited changes, unchanged HEAD/empty index, restored next-env,
  717 tested sources and final document/review locks.
- `task-{1,2}-report.md`, `task-{1,2}-review.md`, `final-review.md` and
  `implementation-ledger.md`: implementation history and independent approved
  reviews. Reviewers inspected source and evidence without rerunning passing
  suites. Task diffs and compressed takeover maps are retained alongside them.
- `task1-green-attempt-3.{json,log}`: actual argv/exit and 7 suites / 303 tests,
  including 46 new terminal-worker cases.
- `task1-typecheck-final.*`, `task1-verifier-compiler.*`,
  `task1-candidate-compiler.*`: type-check and both old compiler graphs exit 0.
- `task1-source-check.json`: frozen source and preserved dependency hashes.
- `full-gate-01.json`, `full-gate-01.log`, `full-gate-01.log.gz`: exit 0,
  type-check/lint, Web 151/2875, shared 4/16, infra 14/14, 184 built pages.
  All 717 source hashes remained stable; gzip/raw hashes are recorded.
- `native-2026-11-05T03-06-28.682Z-bcabfa65-b516-4ccb-a452-4ff91d9e66f9/results.json`:
  final native 8 scenarios / 11,391 assertions, 112 source files, 17 emitted
  CommonJS modules, complete tuple/request/resource observations and compressed
  source/audio/PostgreSQL log snapshots. Runtime, source and compiled drift are
  empty; native resources and the isolated cluster were cleaned up.

## Intermediate evidence retained

- `task1-red-missing-entry.*`: expected module-resolution failure before
  implementation, zero tests executed; this is not a behavioral RED claim.
- `task1-green-attempt-{1,2}.*`: test-fixture spy/export failures; later fixed.
- `task1-eslint.*`: optional direct workspace ESLint 10 invocation failed before
  linting (`scopeManager.addGlobals`). Canonical repository lint passed in the
  full gate; existing build configuration warnings remain recorded.
- Native `02-49-37` hash-failure narrow run passed. `02-52-09` full run failed
  because the revocation fixture fired too early. `02-57-07` corrected narrow
  revocation passed. `03-03-37` full run passed behavior checks but missed emitted
  module snapshots due to `/tmp` versus `/private/tmp`; the final `03-06-28` run
  includes the corrected capture. No earlier execution was overwritten.

This harness uses a loopback PostgREST-shaped adapter and synthetic disk-backed
Storage, actual Supabase JS/native fetch, PG17.4 and FFmpeg. It does not qualify
managed Supabase Storage/PostgREST, TLS/auth, full migration replay, device/long
recording audio or G1. Source objects/candidates remain; only owned local merge
artifacts and disposable fixture resources are removed. No stage/commit/push,
remote migration, deployment, paid API or real family data was used.

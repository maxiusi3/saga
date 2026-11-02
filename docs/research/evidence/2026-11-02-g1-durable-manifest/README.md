# G1-01 Durable Manifest Evidence

Baseline `1ca1e06dd`, branch `codex/october-upgrade-p0`. This batch pins declared input, not verified content, and does not complete G1-01 or G1.

`takeover-check.json` and `prior-evidence-hashes.json` protect 1471 historical inputs plus 140 files across the previous five G1 evidence directories. Previous reports/logs are not rewritten.

Every parent execution has a unique JSON record, raw `.log` and exact deterministic `raw/*.log.gz`. Raw `.log` files are ignored by Git; gzip preserves their bytes. PG executions additionally snapshot their runner/migration sources, pin PostgreSQL 17.4 and use disposable local Unix-socket clusters. They are not production, PostgREST, Storage or real-device tests.

## Execution Index

- `web-red`: exit 1; 8 behavioral failures / 54 passes, plus two not-yet-created module imports. Import failures are not behavioral RED for those suites.
- `web-green-1`: exit 1; 160 passes / 1 old filename assertion failure. Preserved; not GREEN.
- `web-green-2`: exit 0; 8 suites / 161 tests.
- `type-red`: exit 1; TypeScript lib incompatibility for `Object.hasOwn`, subsequently replaced without changing compiler configuration.
- `web-green-3`: exit 0; 8 suites / 164 tests.
- `web-green-4`: exit 0; type-check and 8 suites / 165 tests, source hashes revalidated at resume.
- Original PG runs: genuine missing-RPC RED (`42883`, exit 1); first GREEN 623 assertions; added coherence case failed at 593 assertions; final normal/polluted GREEN each 15 scenarios / 645 assertions. All reports, source snapshots, stdout archives and exits are in `pg-verification-index-2026-11-02T10-07-37.851Z.json`; intermediate failures are retained, not relabeled.
- `resume-check.json`: all 21 tested sources match, including a separately verified generated-only next-env import. The original `full-chain.json` is empty, has no recoverable process exit and is intentionally left untouched. Original log bytes are preserved in `raw/full-chain-interrupted.log.gz`; this interrupted execution is NOT accepted as PASS.
- `pg-resume-normal` / `pg-resume-polluted`: fresh local reruns, each exit 0 / 15 scenarios / 645 assertions with complete cleanup. Their logs point to unique timestamped PG reports and source snapshots. All ten synthetic PG/database environment variables were scrubbed in the polluted run.
- `full-chain-resume`: exit 0 / 296.536 seconds; Web 142 suites / 2295 tests, shared 4 suites / 16 tests, infra 14 tests, 184 build pages. Type-check/lint pass; existing configuration/provider warnings retained. `next-env-check.json` confirms exact restoration.
- Independent specification **PASS**, followed by separate quality **Approved**; no actionable findings. Both reviewers inspected actual sources/callers and recomputed source/log/snapshot hashes. Neither reran the suites/build/PG harness; parent fresh execution and independent evidence inspection are distinct.

## Final Integrity

- [Verification](verification.json) and [milestone decision](milestone-check.json) record the completed local slice and still-open G1-01/G1 gates.
- `source-hashes.json`, `log-hashes.json` and `protected-inputs-check.json` cover 21 tested source inputs, all retained execution logs/PG snapshots, 1471 historical inputs and 140 prior evidence files.
- `document-links-check.json`, `document-hashes.json` and `final-integrity.json` bind final documentation and the explicit staged payload. Generated receipts exclude their own hashes to avoid circular references; Git is the authority for the final commit identity and clean state.
- [Specification receipt](spec-review.md) and [quality receipt](quality-review.md) preserve independent review scope, limits and checked fingerprints. Prior batch reports, logs and the nine-gap register remain unchanged.

## Boundaries

Only manifest session/chunk creation is atomic. Asset/job registration remains a later recoverable operation. Direct ledger writes are restricted to the RPC, but existing rows and historical uploads are not rewritten or adopted. Canonical physical keys include the authenticated owner; logical merge keys keep the prior verifier contract.

No Storage bytes were read or decoded in this batch. Worker claim/readback/publication, frontend final confirmation and cleanup, actual cloud and physical-device acceptance remain open. No remote migration, deployment, push, paid service calls or family-media transfer. Audit is not rerun.

See [report](../../2026-11-02-g1-durable-manifest.md) and [plan](../../../superpowers/plans/2026-11-02-upgrade-g1-durable-manifest.md). `g1Item01Complete: false`, `g1MilestoneSatisfied: false`, `pushConditionSatisfied: false`.

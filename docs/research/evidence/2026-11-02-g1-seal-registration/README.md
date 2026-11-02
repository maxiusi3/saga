# G1-01 Reliable Seal Registration Evidence

Baseline `665484289e4dc15896073572fd730923f701c7b1`, branch `codex/october-upgrade-p0`. Local registration sub-slice only, not completed G1-01 or G1.

| Execution / archive | Exit | Actual result |
|---|---|---|
| `seal-red.json` / `raw/seal-red.log.gz` | 1 | Initial route test syntax error; not valid behavioral RED for that suite, preserved separately |
| `seal-red-behavior.json` / `raw/seal-red-behavior.log.gz` | 1 | Corrected test harness against original production: 2 suites, 44 failed / 13 passed / 57 tests |
| `seal-green.json` / `raw/seal-green.log.gz` | 0 | Same corrected test inputs: 4 suites / 97 tests passed |
| `full-chain.json` / `raw/full-chain.log.gz` | 0 | type-check/lint, Web 139/2251, shared 4/16, infra 14, Next build 184 pages; 354.978 seconds |

Every execution binds command, before/after sources, exit, timing and raw log byte count/SHA-256. Ignored raw `.log` files are retained locally; deterministic gzip archives preserve exact raw bytes in Git. No failed log is overwritten or relabeled as success.

## Review And Integrity

- `spec-review.md`: independent PASS; independent 4/97 rerun and baseline/RED/GREEN source verification.
- `quality-review.md`: independent Approved after specification PASS; separate 4/97 rerun and all four execution logs/source bindings verified. Full-chain results were inspected, not independently rerun. No outstanding findings.
- `takeover-check.json`, `prior-evidence-hashes.json`: clean takeover, 1471 historical inputs and four prior G1 directories (115 evidence files) protected.
- `protected-inputs-check.json`: all 1471 historical inputs and 115 previous evidence files rechecked, zero mismatches or missing inputs.
- `next-env-check.json`: exact known build-generated addition verified, then saved original bytes restored.
- Final seal records: `source-hashes.json`, `log-hashes.json`, `protected-inputs-check.json`, `verification.json`, `milestone-check.json`, `document-hashes.json`, `final-integrity.json`. Hash indexes exclude themselves; actual local checkpoint identity and clean state checked with Git after commit.

## Limits

HTTP fake uses exact filters and modeled asset/job uniqueness, not real PostgreSQL concurrency/Storage/Worker. Two writes are recoverable, not atomic; rejected requests may leave verifying rows without claiming successful registration. Check-before/check-after is not atomic revocation. No upsert or cleanup rollback.

Seal acknowledgement always keeps `canClearLocalDrafts: false`. Client manifests remain declarations, not server-verified objects. Trusted durable session/chunk input, upload namespace alignment, Worker host/claim/atomic publish, client confirmation/cleanup and actual device/cloud qualification remain open. Legacy random-ID rows are not silently adopted or changed.

See [report](../../2026-11-02-g1-seal-registration.md) for current G1-01 progress; the [prior gap register](../../2026-11-02-g1-gap-register.md) is retained as the previous baseline, not rewritten. No SQL/dependency change or PG/audit rerun; existing build warnings remain. No push/main merge, remote migration/repair, deployment, paid calls or family-media transfer. `g1Item01Complete: false`, `g1MilestoneSatisfied: false`, `pushConditionSatisfied: false`.

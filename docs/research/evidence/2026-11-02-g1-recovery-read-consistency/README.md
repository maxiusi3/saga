# G1 Recovery Read Consistency Evidence

Baseline: `8d4fc6dc540a74ad260ba9689db57b410e0eb059`. Branch: `codex/october-upgrade-p0`. Local optimistic consistency/error-classification slice only, not real-device G1 acceptance.

## Executions

| Receipt / archive | Exit | Actual result |
|---|---|---|
| `browser-red.json` / `raw/browser-red.log.gz` | 1 | 3 new behavioral failures, old 28 subcases pass; Node 28 pass / 4 fail including parent |
| `unit-red.json` / `raw/unit-red.log.gz` | 1 | 24 pass / 3 fail; post-hash change positive guard already passes |
| `browser-green.json` / `raw/browser-green.log.gz` | 0 | Chromium 147.0.7727.15, native IndexedDB, 31 subcases / Node 32 passed |
| `focused-jest.json` / `raw/focused-jest.log.gz` | 0 | 4 suites / 72 tests passed |
| `full-chain.json` / `raw/full-chain.log.gz` | 0 | type-check/lint, Web 139/2200, shared 4/16, infra 14, Next 16.4.1 build 184 pages |

All commands bind before/after source hashes, exit code, timing, original raw byte count and SHA-256. Ignored `.log` files remain locally; deterministic gzip archives contain the exact committed raw evidence. Browser tests are separate from Web/infra totals. RED is a real `damaged` versus `changed` assertion failure, not a harness failure; test hashes are identical in RED/GREEN.

## Review And Integrity

- `spec-review-initial.md`: independent FAIL, missing AI truthful-failure gap row; no production correction requested.
- `spec-review.md`: independent re-review PASS after G1-08 added; preserves initial review and independent browser/Jest results.
- `quality-review.md`: independent Approved after specification PASS, no outstanding findings; separate browser/Jest reruns and all five archived execution logs checked.
- `takeover-check.json`, `prior-evidence-hashes.json`: initial clean baseline, 1471 historical inputs and 85 prior local G1 evidence files protected.
- `next-env-check.json`: known build-generated addition verified exactly, then saved original bytes restored to SHA-256 `7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651`.
- Final seal: `source-hashes.json`, `gap-reference-hashes.json`, `log-hashes.json`, `document-hashes.json`, `protected-inputs-check.json`, `verification.json`, `milestone-check.json`, `final-integrity.json`. Self-referential receipts are excluded from their own input hashes; checkpoint identity and post-commit clean state are inspected with Git afterward.

## Limits And Next Entry

Native competing transactions use synthetic bytes in a single test page. No actual microphone/5/20/30-minute/device/version qualification, multi-tab product test, lock/call/process kill/physical quota, decoded long audio, deployed permissions or second-device offline export was executed. Rechecks are optimistic, not atomic snapshot or authorization guarantees.

The [gap register](../../2026-11-02-g1-gap-register.md) maps nine gaps to existing code/evidence and separates engineering, human inputs/authorization and hands-on device operations. The next local entry is client seal/Worker/confirmation-chain audit and minimal integration, not repeating the four IndexedDB slices. G1 fictional test speech does not require G3/G4 household recruitment.

`g1MilestoneSatisfied: false`, `pushConditionSatisfied: false`, no push. No SQL/dependency change, no PG rerun; audit not rerun. Existing Next/optional environment warnings remain. No main merge, remote migration/repair, deployment, paid service or real family-media transfer.

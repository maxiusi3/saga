# Worker Candidate Evidence

This directory is append-only execution evidence for the local candidate slice.
The design and plan are in `docs/superpowers/`; the report is
[2026-11-03-g1-worker-candidates.md](../../2026-11-03-g1-worker-candidates.md).
G1, client-cleanup and push conditions remain false.

## Command Receipts

Each command JSON records arguments, exit code, source hashes before/after,
compressed log location and both raw/compressed log hashes. Intermediate failed
runs are retained; concurrent harness edits are not silently relabelled as a
source-frozen final run.

- `rpc-red.json`: candidate RPC behavior RED, 27 failed / 20 passed.
- `rpc-green-storage-red.json`: RPC GREEN, Storage RED; 17 failed / 56 passed.
- `storage-green.json`: 2 suites / 73 passed.
- `scope-worker-red.json`: scoped consumer/worker RED, 8 failed / 46 passed.
- `application-green-1.json`: 6 suites / 374 passed; the separately invoked
  following type-check failed TS2366 and is not covered by this PASS receipt.
- `static-green.json`: corrected TypeScript control flow, type-check and lint pass.
- `timestamp-review-red.json`: an earlier prepared timestamp within one
  millisecond is incorrectly accepted (1 failed / 48 passed).
- `old-compiler-red.json`: original Worker compiler fails on a new eager import.
- `timestamp-and-split-green.json`: microsecond fix, original compiler probe,
  6 suites / 376 tests, type-check and lint pass.
- `native-upload-cleanup-red.json`: actual HTTP successful POST cannot reach GET
  because the unread acknowledgement is aborted before cancellation.
- `native-upload-cleanup-green.json`: corrected response cleanup order,
  4 suites / 130 tests pass including the native regression.
- `final-focused.json`: final six application suites / 377 tests pass.
- `full-chain-1.json`: original compiler compatibility probe, type-check, lint,
  Web 148/2672, shared 4/16, infra 14, 184-page build pass; no source drift.
- `next-env-check.json`: build-generated import checked and original bytes restored.

## Database / Native Runs

Unique `red-without-migration-*`, `sql-only-*` and full integration directories
contain their own results, source snapshots and resource-cleanup evidence. The
early SQL GREEN is not final: the independent reviewer found a subsequent
cross-job unique-index wait past lease expiry requiring a regression and fix.

Final SQL: `sql-only-2026-11-03T15-55-07.116Z-1afb59c0-b2e6-4405-87b8-fba18c58733a/results.json`,
15 scenarios / 426 assertions. Fixed cross-job unique-index regression and live
rollback/commit controls are included. The bug's RED remains in the 15:52 run.

Final native: `full-application-2026-11-03T16-05-05.641Z-ceb9582e-5e2b-48b5-9d6a-db757f7e8f3e/results.json`,
31 scenarios / 21,697 assertions; 15 SQL and 16 application cases including two
actual SIGKILLs. The first native RED at 15:57 is retained. Successful local
cleanup and no-publication counters are in the reports, along with the explicitly
parent-owned cleanup of killed attempts.

[Independent specification review](specification-review.md) is PASS, followed by
[independent quality review](quality-review.md) Approved. The spec reviewer reran targeted application tests and
the corrected PG expiry reproduction, and audited (did not rerun) the full native
matrix and its 31 source snapshots.

The quality reviewer independently reran all 31 native scenarios:
`full-application-2026-11-03T16-20-01.520Z-a67f6bf2-8b36-4ed2-807a-e858052a3cda/results.json`,
21,682 assertions, plus six Jest suites / 377 tests and the compiler compatibility
probe. Assertion totals vary with heartbeats; scenario coverage is unchanged.

SQL Storage tables are synthetic; their restrictive-policy tests are not an
actual deployed Supabase qualification. Native loopback HTTP, when present,
proves real request streaming/abort but not public TLS or managed Storage.
Suppressed receipts after committed SQL are not lost PostgreSQL wire COMMIT acks.

## Preservation

`prior-evidence.json` freezes 2,285 preexisting evidence files. These files and
all intermediate failures are retained unchanged. The final summary is
`verification.json` and the source/evidence freeze is `final-integrity.json`.
Neither local slice completion nor these receipts grants G1/push/cleanup approval.

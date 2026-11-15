# Recording finalization local evidence

Status: local slice complete. Implementation, repository gates, independent
specification/quality reviews and final integrity verification passed. G1
remains incomplete; push and local-draft cleanup conditions remain false.

- `baseline.json`: inherited Git/source inventory before edits.
- `prior-evidence.json`: all 2,542 preexisting evidence file hashes, including
  ignored artifacts. None is rewritten by this batch.
- `design-review.md`: independent read-only design recommendations; not final
  code review or runtime verification.
- `inherited-focused.json` and `.log.gz`: fresh baseline 6 suites / 377 tests,
  exit zero, no source drift.
- `red-without-migration-*/results.json`: expected real undefined-function RED.
- `sql-only-*/results.json`: every native PG run, including failures. Final
  passing Task 1 run is
  `sql-only-2026-11-04T16-14-22.203Z-0b981799-c094-4aab-ba08-ab5dbc0ef943`
  with 15 scenarios / 492 assertions. Each run includes compressed source
  snapshots, source hashes, PostgreSQL log and cleanup results.
- `task-1-review.md`: independent specification PASS and quality APPROVED.
- `task-2-review.md` and `final-review.md`: application and whole-slice independent
  specification PASS / quality APPROVED, no actionable findings. Reviewers
  inspected source/evidence without rerunning the already-passing suites.
- `task-1-report.md`, `task-2-report.md`, `implementation-ledger.md`: retained
  implementation history, intermediate failures, scope decisions and completion.
- `task2-focused-final-01.json` and `task2-input-storage-final-01.json`: final
  application regression checks, 16 suites / 677 tests together; exit zero.
- `task2-typecheck-final-01.json`, `task2-compat-final-01.json`:
  application types and unchanged Worker compiler graph checks.
- `http-application-*/results.json`: actual Supabase JS and local loopback HTTP
  against PostgreSQL. Final passing run is
  `http-application-2026-11-04T16-57-11.120Z-0b324a81-c131-4d93-ab8a-e46c007364fc`
  with 8 scenarios / 278 assertions / 13 requests and 25 source snapshots.
  Commit-loss and cancellation outcomes are retained as committed or rolled
  back according to observed database tuples; no automatic retry is performed.
- `full-gate.json` and `.log.gz`: repository type-check, lint, Web 150 suites /
  2,829 tests, shared 4 suites / 16 tests, infra 14 tests and 184-page production
  build; exit zero, no tested-source drift. Existing configuration warnings
  remain; no dependency audit was rerun.
- `verification.json`: final completion, validation and remaining-gate receipt.
- `integrity.json`: all 2,542 old evidence files and 1,471 historical inputs
  unchanged; no unexpected inherited changes, unchanged HEAD and empty index,
  restored original next-env bytes, owned whitespace/conflict checks and native
  cleanup verified. Includes earlier failed receipts as historical results.
- `source-lock.json`: 688 tested source hashes, 20 reviewed file hashes, final
  documentation and review hashes. The final SQL 21 and HTTP 25 source snapshots
  also match the current implementation.

To reproduce locally, run `node experiments/pg17-recording-finalization/verify.mjs`
for SQL or `node experiments/pg17-recording-finalization/verify-http.mjs` for the
SDK/HTTP boundary. Each creates a new UUID evidence directory. Keep earlier
successes, expected RED and intermediate failures intact.

Native tests use isolated PostgreSQL 17.4 and synthetic identity/Storage
prerequisites. They qualify the transaction boundary; they do not qualify cloud
Storage, actual PostgREST, audio decoding, a deployed worker, the complete
migration chain, device behavior, backups or physical deletion. No local-draft
cleanup is authorized, including after a successful publication receipt.

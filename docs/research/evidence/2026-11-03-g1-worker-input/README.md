# Worker Input Verification Evidence

Local read-only slice, based on `c0669e805`. Resumed from interrupted chat 30 on
2026-11-03 (Asia/Taipei). All earlier runs and failures are retained.

## Final evidence

- `scope-abort-green-final.json`: four Jest suites, 295 tests passed on final code.
- `final-integration.json`: command exit 0; raw stdout is in the referenced gzip.
- `run-2026-11-03T10-11-23-042Z-59878/input-results.json`: final native HTTP/FFmpeg
  run, 21 cases, 250 assertions, three formats. Includes source hashes and cleanup.
  Adjacent files retain the observed HTTP requests and FFmpeg commands/events.
- `final-full-chain.json`: final full gate receipt; only a complete JSON receipt
  with exit code 0 and matching source hashes is a passing gate.
- `spec-review.md` and `quality-review.md`: independent final review receipts.
- `prior-evidence-check.json`: all 216 evidence files from the preceding six G1
  batches match their pre-interruption hashes.

## Regression and interrupted evidence

- `scope-abort-red.json`: two failing behavioral tests reproduce database requests
  surviving the Storage scope timeout, followed by seven unwanted later queries.
- `scope-signals-red.json`: an extra scoped cancellation signal was ignored.
- `scope-abort-green.json` and `scope-abort-green-2.json`: intermediate failures
  caused by a virtual mock for a now-real module when combined with real-module
  tests. Retained as failures, not passing results. The final ordinary module mock
  passes the same four-suite run.
- `cleanup-red.json` / `cleanup-green.json`: original regression covering the
  asynchronous temporary-file cleanup boundary before returning evidence.
- `prior-log-recovery.json`: archive provenance and hashes for original ledger and
  verifier RED/GREEN logs and local PostgreSQL golden evidence recovered from `/tmp`.
  `prior-ledger-golden.sql` retains the query. It was not rerun during this resumption.
- `full-chain.json`, `resume-full-chain.json`, `focused-1.json`, `resume-focused.json`,
  `resume-integration.json` and earlier `run-*` directories are historical runs, not
  final-code gate evidence. `focused-1.json` records a test-source change during its run.

Command receipts contain before/after source hashes, exit codes, raw log SHA-256,
and compressed archive SHA-256. A filename containing `green` is not a PASS claim:
use the actual exit code and source snapshot. No archived evidence is overwritten.

## Reproduce locally

From the repository root:

```sh
npm test --workspace=packages/web -- --runInBand --runTestsByPath \
  src/lib/server/__tests__/recording-job-input.test.ts \
  src/lib/server/__tests__/recording-job-verifier.test.ts \
  src/lib/server/__tests__/recording-merge-executor.test.ts \
  src/lib/server/__tests__/recording-audio-decoder.test.ts
SAGA_FFMPEG_PATH=/usr/local/bin/ffmpeg node scripts/verify-recording-job-input.cjs
npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra
```

Supply the absolute path to an independently installed FFmpeg. The integration
script uses synthetic data and loopback HTTP only; it does not load environment
files, contact cloud services or use real credentials. Each run has a unique
directory. Preserve the pre-build `next-env.d.ts` bytes and restore only a verified
generated import, not unrelated changes.

## Not certified

No durable claim, lease, heartbeat, upload, publication, ready transition, draft
cleanup permission, migration, deployment or milestone completion is claimed.
The HTTP fixture is not real PostgREST/RLS/Storage/TLS acceptance. Optimistic
rechecks are not an atomic revocation barrier; client cancellation does not prove
termination of an already-running remote SQL query. Three-format decoding is not
recording-tail completeness, real-device testing or deployed FFmpeg isolation.
The 2000-chunk loader pagination test is not full-verifier scale qualification;
repeated full-ledger reads have quadratic data volume.

`g1Item01Complete`, `g1MilestoneSatisfied` and `pushConditionSatisfied` remain false.

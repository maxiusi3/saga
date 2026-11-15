# G1-01 recording status evidence

This directory belongs only to the 2026-11-05 read-only status slice. Existing
evidence directories are unchanged. The final local-slice decision is
`verification.json`; G1 and conditional push remain false.

## Final executions

| Evidence | Result |
| --- | --- |
| `task2-focused-green.log` | 5 suites / 564 tests, including 225 new cases |
| `task2-fixture-move-*` | Relocated helper; 225 tests pass, 153 suites discovered, typecheck passes |
| `task2-source-snapshots-02.json` | Seven final production/test files and exact archived copies |
| `task2-typecheck-final.log`, `task2-legacy-*.log` | Types and both historical compiler graphs pass |
| `full-gate-02.json` and its raw/gzip log | Verify + shared + infra exit0; Web153/3100, shared4/16, infra14,184 pages;724 source hashes stable |
| `next-env-restoration.json` | Only generated root-params import removed; original bytes restored |
| `native-sql-2026-11-05T09-26-15.086Z-dbd5ed7b-1d35-4c19-913c-da74fa582bbc/results.json` | SQL5/191;58 sources,64 source/runtime archives plus PG log; cleanup passes |
| `native-http-2026-11-05T09-33-17.998Z-3ae4565f-fc32-4849-93d1-ab65ad742d37/results.json` | SDK/nativeHTTP4/585;110 sources,123 archives including13 compiled modules plus PG log; cleanup passes |

The HTTP run executes actual atomic publication in PostgreSQL, loses its response,
then uses the actual production status reader with the installed SDK to obtain
one verified receipt. Reads preserve complete synthetic database tuples and
actual synthetic copy bytes. The final timeout is101.61ms for100ms with no caller
abort; explicit caller abort is16.24ms. Both cancel native fetch/peer without a
normal response. No retry, recovery, signing, deletion or cleanup permission.

## Preserved failures and review

- `task2-red2.log`: behavioral RED61 failed/162 passed; the earlier regex-selected
  run omitted the bracketed route and is not counted as route evidence.
- `task2-timestamp-red.log`: transaction timestamp compatibility and asset/job
  ordering failures, corrected before final focused GREEN.
- `full-gate-01.json`: all3100 tests pass, but a fixture in `__tests__` became an
  empty suite. Moved to existing `test-support`, then full gate02 passed.
- Missing-RPC actual service-role RED: SQLSTATE42883 at08:55.
- SQL08:59: wrong composite-column alias serialized an asset in attempts.
- SQL09:01: test-only UUID/text parameter mismatch. SQL09:04 and09:11 GREEN
  precede complete runtime archive capture and remain intermediate evidence.
- HTTP09:24:580 behavior assertions pass; explicit compiled-archive assertion
  fails because macOS resolves `/tmp` to `/private/tmp`. Canonicalization fixed.
- HTTP09:30: new true-timeout assertion fails because the fixture triggered
  caller abort; cleanup also observed a socket-close event race. Timeout was
  separated from caller abort; close now waits for actual tracked socket events.
- `task-1-initial-review.md` preserves both Important findings. Final Task1
  scoped re-review is `task-1-review.md`; application review is `task-2-review.md`.
  Its cross-task pending note is resolved by the final Task1 evidence/review.
- `final-review.md` records the whole-slice review. `implementation-ledger.md`
  preserves the controller's decisions and evidence transitions.

## Preservation and limits

`baseline.json.gz` protects4447 takeover paths; `prior-evidence.json.gz` protects
3393 previous evidence files. `integrity.json` verifies them, the final execution
snapshots and archives, unchanged HEAD/empty index, and the generated-file restore.
`source-lock.json` binds final tested/reviewed code and documents.

Local PostgreSQL is real; authorization prerequisites, HTTP/PostgREST shape and
candidate metadata/files are synthetic. This does not qualify managed Storage,
PostgREST/JWT/TLS, full migrations or real-device long recordings. Prior worker
evidence covers FFmpeg; this slice does not repeat its processing matrix. A
snapshot is a point-in-time observation, not a future access or cleanup grant.
Existing Next/optional configuration warnings remain. No stage, commit, push,
deployment, remote migration, paid call or family data was used.

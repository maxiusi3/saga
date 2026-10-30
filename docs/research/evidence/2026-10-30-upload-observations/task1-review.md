# Task 1 Independent Review

## Verdicts

- Specification: **PASS**. No missing or incorrectly implemented Task 1 requirement found in the assigned snapshot.
- Quality: **PASS**, reviewed after the specification gate passed. No actionable correctness, security, compatibility or harness-safety finding found.
- Blocking findings: **0**. These verdicts qualify the local SQL task only, not integration readiness or a new product milestone.

## Scope And Method

Reviewed the assigned brief, implementation report and frozen
`.superpowers/sdd/2026-10-30-upgrade-upload-observations/task-1-review.diff`
against base `d13d55ab0a2ab8bb493da404a55f475613c7a372`.

The frozen diff SHA-256 is
`c6be844becca1b1d9138887e8ed4473ac97ac51257033a00cd546434b55b16e5`.
Its three new-file contents exactly match the current SQL, runner and README.
The deployment-config change exactly matches the frozen diff and adds only
the new filename after the existing v2 migration.

Assigned source scope:

- `supabase/migrations/20261030000001_upload_observations.sql`
- `experiments/pg17-upload-observations/verify.mjs`
- `experiments/pg17-upload-observations/README.md`
- `scripts/__tests__/deployment-config.test.js`

Outside that diff, inspected only the named evidence and direct dependencies
needed to check cleanup/isolation and legacy snapshot composition:
`experiments/pg17-routines/runtime.mjs`, its pins, and the v1/v2 snapshot
output definitions. Compared these dependencies and the P1 fixture source
against the base; all five remain byte-identical.

No suites were rerun. This reviewer did not start PostgreSQL, touch source,
stage, commit, push or contact a remote. Independent checks were source/diff
comparison, SHA-256 verification, evidence consistency checks and read-only
post-exit PID/path checks. This report is the only file written by the reviewer.

## Specification Review

| Requirement | Review evidence | Result |
| --- | --- | --- |
| Minimal durable ledger and immutable terminals | SQL:3 has exactly UUID, binding hash, state and two DB timestamps. SQL:35 guard rejects deletion, ID/hash/start mutation, started no-ops and every terminal UPDATE; finite/state/order constraints remain independent. Runner:222 and :321 inspect schema and exercise the guards. | PASS |
| Writer ACL, RLS and binding enforcement | SQL:62 enables RLS and removes direct application DML; service_role gets SELECT only. SQL:75 and :102 are fixed-search-path SECURITY DEFINER writers. Both compare the stored hash; finish does so before its idempotent terminal branch. SQL:138 removes public/client EXECUTE. Runner:237 and :263 use real LOGIN roles, forged claims and an independent temporary SELECT-grant RLS check. | PASS |
| Idempotence, conflict rejection and real concurrency | Begin returns the existing state without reopening it. Finish locks before checking binding/state. Runner:346 exercises five two-backend races, and :176 observes an actual `pg_stat_activity` Lock wait before releasing the winning transaction. Wrong-binding same-terminal replay is covered. | PASS |
| Exact receipts and no identity leak | Writer JSON has exactly schemaVersion/attemptId/state. SQL never stores raw credentials, user/asset/family identifiers or paths. The aggregate projects only bounded state-derived counters and the coverage time, and composes the existing identity-free v2 shape. Runner:118 and :128 enforce exact allowlists and private sentinels. | PASS |
| v3 window/count semantics and invalid data | SQL:143 is no-argument STABLE SECURITY INVOKER. All functions share statement time. Valid finishes include the exact elapsed-hour boundary; evaluated is succeeded/failed/conflict, failures is failed only, cancellation is separate. Valid starts and invalid rows are counted globally. Null, nonfinite, future, reversed, bad-state and bad-hash rows cannot enter normal counters. Runner:382 and :403 include microsecond boundaries and 21 corrupt rows. | PASS |
| Coverage epoch and precision | SQL:31 preserves the singleton on replay. SQL:185 returns null/false for missing, null, nonfinite, future and BC epochs, preserves six-digit UTC fractions, and compares exact timestamps rather than rounded output. Runner:366, :397 and :426 cover replay, the one-microsecond boundary and malformed epochs. No rollout or actual-PUT inference is made. | PASS |
| Old v1/v2 behavior and read-only snapshot | The new migration does not redefine either old function. Runner:163 compares definitions/ACLs before and after migration replay; :128 compares v2 with the inherited v3 fields in the same SQL statement. Nonempty legacy processing/cost/deletion/export fixtures, hostile temp shadows, four timezones and read-only repeatable-read MVCC are covered. | PASS |
| Genuine RED, isolated PG evidence, cleanup and infra | Initial missing-RPC RED records SQLSTATE 42883 and exit 1. Final normal/contaminated reports retain pinned PG17.4, 14 scenarios / 631 assertions each, and complete cleanup. Infra records 7/7 with the one-line sorted-list update. All indexed sources and evidence hashes were independently checked. | PASS |

Locations in this table refer to the assigned SQL/runner files listed above;
they are audit anchors, not findings.

## Quality Review

No actionable findings.

The authorization boundary is database role privileges rather than caller
claims. The qualified table references and trusted fixed search paths resist
the tested temporary-table shadowing. Binding equality precedes both mutation
and same-outcome disclosure. Row locks and the separate transition trigger
make concurrent first-writer-wins behavior and terminal immutability explicit.
The v3 implementation leaves old APIs unchanged rather than widening them.

The runner imports the existing pinned harness without modification. That
harness scrubs all case-insensitive PG-prefixed variables and DATABASE_URL,
allocates a private local socket, disables TCP, bounds queries/lock waits and
closes tracked clients before stopping/removing its own cluster. The new
runner awaits cleanup and checks the recorded PID and exact allocated paths;
it does not assign the cleanup function's undefined return over the report.
Fixture corruption is confined to owner-only transactions that roll back.
No destructive command is aimed at a caller-selected database or directory.

## Evidence Verification

- All **9** `sourcesCurrent` SHA-256 values match current files.
- All **7** terminal-log hashes and **5** PG-report hashes match the index.
- Every embedded per-run source hash, scenario total, assertion total and status agrees with its index entry.
- Final normal and contaminated reports both show **14 scenarios / 631 assertions**, with distinct retained outputs and final SQL/runner hashes.
- The initial RED is specifically `expected_product_red_missing_rpc` / SQLSTATE `42883`. The later BC-epoch RED is correctly distinguished as an implementation regression, followed by the fixed final runs.
- For all **5** retained PG runs, independent current checks confirm the allocated socket directory and parent directory no longer exist and `os.kill(pid, 0)` reports the server PID absent. Each report records zero remaining clients and no cleanup errors.
- The contaminated report records all **13** injected PG*/DATABASE_URL keys scrubbed and a private Unix-socket connection, not the injected host/database.
- Captured infra evidence reports **7 passed / 0 failed**, exit 0. This reviewer inspected that evidence rather than rerunning it.

## Remaining Boundaries

- SQL proves opaque binding equality, not that HTTP derives the binding from the authorized loaded asset, authenticated user and secret report credential. That belongs to the HTTP integration review.
- These are local synthetic PG assertions, not a full migration-chain rehearsal, actual Supabase/PostgREST, browser or real-Storage proof.
- Global unsettled/invalid counts require historical scanning. Production latency, growth and retention are unmeasured, as already disclosed; the required semantics are not silently narrowed to improve benchmark results.
- Client reports remain untrusted diagnostics. A started row can precede any PUT; a failed report does not prove object absence; conflict is not new-object success.
- No alert delivery, provider conditions, deployed coverage, G0-G4 or original milestone completion is established. Parent integration gates remain separate.

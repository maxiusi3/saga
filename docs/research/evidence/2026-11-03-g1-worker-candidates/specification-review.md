# Independent Specification Review

Reviewer: `candidate_spec`, independently dispatched read-only after the
implementation. Final decision: **PASS**, no outstanding actionable findings.
This record summarizes the reviewer messages; the parent did not act as its own
specification reviewer.

## Findings And Re-review

1. Candidate timestamp validation accepted `preparedAt` 998 microseconds before
   `createdAt` because Date.parse truncated both to milliseconds. Independently
   reproduced. Parent preserved `timestamp-review-red.json`, switched to integer
   microsecond comparison, and added reversed/ordered regressions. Reviewer
   independently reran all 49 candidate receipt tests and approved the fix.
2. Cross-job reservations with one candidate UUID could wait on an uncommitted
   unique-index entry after the final prewrite lease check. Rollback of the first
   transaction let the second commit after lease expiry. Reviewer reproduced an
   actual PG17 transaction-ID wait. SQL regression RED is retained in
   `sql-only-2026-11-03T15-52-16.387Z-277419db-5110-4a80-8678-314705a44859`.
   A post-DML database-clock check now raises 23505 and rolls back late writes.
   Reviewer independently reran the real wait after the fix: 23505, zero candidate
   rows and complete cluster/client/temp cleanup. Live rollback-success and
   live duplicate-commit controls are also in the permanent SQL test.
3. Native integration independently found self-abort before acknowledgement-body
   cancellation preventing GET after a successful POST. Reviewer inspected the
   corrected nested cleanup ordering and independently ran the actual loopback
   HTTP regression as part of four affected suites, **130/130 passed**.

The candidate-worker module split was also reviewed: the old read-only API and
original compiler dependency graph remain usable. A separate native delayed
`fs.close` probe found no early FD-release issue: settlement occurred only after
the close callback, with `fstat` reporting EBADF.

## Evidence Checked

- Earlier independent expanded application run: **6 suites / 374 tests**.
- Final independent candidate suites: **4 suites / 130 tests**.
- Fixed SQL report: **15 scenarios / 426 assertions**, snapshot hashes verified.
- Final native report:
  `full-application-2026-11-03T16-05-05.641Z-ceb9582e-5e2b-48b5-9d6a-db757f7e8f3e/results.json`.
  **31 scenarios / 21,697 assertions** (15 SQL, 16 application including two
  SIGKILL cases); all 31 compressed/decoded snapshots, current source hashes and
  PostgreSQL log hashes verified. The reviewer audited this complete native run,
  rather than rerunning the entire matrix.
- Empty source drift; recorded readers, descriptors, HTTP/PG clients, children,
  cluster/socket/temp cleanup; zero ready, succeeded or confirmed state.
- `git diff --check` passes and index remains empty.

Full repository gates are checked separately by the parent. This approval does
not qualify actual PostgREST/cloud Storage/TLS, managed ownership, device/long
audio, deployment, new-bucket backup/deletion coverage or atomic publication.
G1, client cleanup and push conditions remain false.

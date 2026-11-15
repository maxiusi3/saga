# Task 2 implementation report

Status: complete for scoped native integration; ready for independent review.
Production and native harness sources are frozen at the final evidence run.
No staging, commit, push, remote migration, deployment, paid request or real
family data was used. No prior harness, evidence or production file was edited.

## Changes

- `experiments/pg17-recording-terminal-worker/verify.mjs`: executes the actual
  compiled `finalizeLeasedRecordingJob` with Supabase JS, native PG17, real
  FFmpeg, eight scenarios, complete tuple comparisons, byte retention checks,
  source/runtime locks, append-only execution evidence and scoped cleanup.
- `experiments/pg17-recording-terminal-worker/http.mjs`: loopback
  PostgREST-shaped adapter with parameterized SQL RPC dispatch, real streamed
  disk-backed source/candidate objects and controlled boundary faults.
- `experiments/pg17-recording-terminal-worker/observations.mjs`: observes actual
  decoder children, handles, upload streams, scoped directory removal and caller
  listeners. It does not replace production processing results.
- `experiments/pg17-recording-terminal-worker/README.md`: execution, case
  selection, evidence coverage and qualification limits.
- Native evidence is confined to new `native-<timestamp>-<uuid>/` directories in
  `docs/research/evidence/2026-11-05-g1-terminal-worker/`.

Reusable exports come from the prior PG runtime, seal/lease fixture, candidate
compiler, Supabase synthetic-origin client and finalization fixture. No old
`verify` module or evidence writer was imported or executed.

## Final authoritative execution

Command from repository root:

```bash
SAGA_FFMPEG_PATH=/usr/local/bin/ffmpeg node experiments/pg17-recording-terminal-worker/verify.mjs
```

Evidence:
`docs/research/evidence/2026-11-05-g1-terminal-worker/native-2026-11-05T03-06-28.682Z-bcabfa65-b516-4ccb-a452-4ff91d9e66f9/results.json`

Exit 0, **8/8 scenarios, 11,391 assertions**. Counts depend on observed heartbeat
requests and need not equal earlier runs. All three new modules also passed
`node --check`; scoped `git diff --check` exited 0. Parent owns the canonical
npm gate and independent review; this task did not rerun those broad gates.

| Scenario | Terminal calls | Job / asset / attempt / session | Candidate | Worker outcome |
| --- | ---: | --- | --- | --- |
| Success with slow streamed readback | 1 publish | succeeded / ready / succeeded / cloud_confirmed | prepared | Exact SQL receipt |
| Real source hash mismatch | 1 fail | failed / quarantined / fatal_error / failed | none | Exact permanent-failure receipt |
| Real FFmpeg decoded-duration limit | 1 fail | failed / quarantined / fatal_error / failed | none | Exact permanent-failure receipt |
| Corrupt readback after immutable upload | 0 | running / verifying / running / sealing | reserved | recording_worker_unavailable |
| SQL commit then HTTP response loss | 1 publish | succeeded / ready / succeeded / cloud_confirmed | prepared | recording_worker_unavailable once |
| SQL commit then malformed receipt | 1 publish | succeeded / ready / succeeded / cloud_confirmed | prepared | recording_worker_unavailable once |
| Caller cancellation inside settled local cleanup | 0 | running / verifying / running / sealing | prepared | recording_worker_unavailable |
| Role revoked at first post-cleanup input lease revalidation | 0 | running / verifying / running / sealing | prepared | recording_worker_unavailable |

Success ran for about 4.61 seconds with an initial 1-second lease and 31 actual
heartbeat RPCs. Native FFmpeg emitted 64,000 PCM bytes and exited 0. The decoded
duration case emitted 2,960 bytes against a configured 1 ms limit, was killed and
reaped by the actual decoder, and produced the real branded
`recording_decode_duration_exceeded` failure. The hash case transmitted modified
native HTTP bytes while preserving the stored original and rejected before any
decoder or candidate operation.

For every terminal case, the harness compares every asset/job/attempt/session
field and all candidate/chunk tuples against the precise intended terminal
delta, including PostgreSQL timestamp strings. Candidate pointers and all source
and candidate bytes are retained. Each terminal request follows local cleanup
and the last successful lease check; it is the last worker HTTP request. A
250 ms observation after worker settlement detects late heartbeat/check/retry
requests (configured heartbeat interval: 100 ms). No worker DELETE, PUT, PATCH,
direct table write, retry, recovery or fallback failure occurs. All terminal
receipts retain `canClearLocalDrafts:false` and have no attached running lease.

## Evidence integrity and cleanup

The final run includes **112 source files**, **17 executed compiled JavaScript
modules**, and **8 audio/candidate/log artifacts**, totalling **137 gzip
archives**. A separate read-only audit verified every archive's compressed hash,
decoded hash and byte length, and all 112 current source hashes against the final
run. Source, compiled-output and runtime drift arrays are empty.

Runtime: PostgreSQL 17.4; Node v22.22.2; pg 8.16.3; Supabase JS/PostgREST JS
2.105.3. FFmpeg is the already installed `/usr/local/bin/ffmpeg`, the same
runnable 2018 tessus build used in previous successful candidate evidence; no
runtime was downloaded. Its SHA256 is
`69bddbabda0d4fbedf98fb01b6f964ee1c8346987ef7f6e70055b95339a78b17`.
Postgres, pg_ctl, initdb, Node and FFmpeg hashes/paths are recorded.

All seven invoked decoder processes closed and their PIDs were absent at
cleanup. At terminal arrival there were zero decoder children, upload streams,
merged-file handles, outstanding removals or attempt-directory entries; only
the active finalizer owned a caller abort listener. After settlement no caller
abort listener remained. Native Storage readers closed, cancelled and released
their locks. All HTTP handlers and owned listeners settled, zero sockets remained
and the server stopped listening. No processing resource needed emergency rescue.
All PG clients closed; the cluster stopped; its PID, temporary directory and Unix
socket directory were absent. No cleanup errors were reported.

## Preserved execution history and harness corrections

1. `native-2026-11-05T02-49-37.183Z-c2b6002f-69d6-4f40-8852-59f368a006d6`:
   initial bad-source-hash narrow pass, 464 assertions.
2. `native-2026-11-05T02-52-09.504Z-c4ebf58e-e427-4035-bfe3-0fedb57d69cd`:
   **preserved failed full run**, 9,876 assertions; first seven cases passed.
   Revocation fault was incorrectly injected on the first input lease check,
   before a candidate existed. Trace: claim -> start -> check (42501), with no
   processing resources. The fixture's prepared-candidate expectation then
   failed. Cleanup and drift checks remained clean. No production defect was
   inferred or production code changed.
3. `native-2026-11-05T02-57-07.445Z-f0dbab3f-b1a9-424c-9f18-4abc98ccdf10`:
   corrected revocation narrow pass, 1,681 assertions. Injection is gated on an
   observed completed real merge-directory removal and therefore occurs at
   post-cleanup input revalidation before publication.
4. `native-2026-11-05T03-03-37.307Z-9c120fc0-25b0-4a7d-98dd-24957c1e0ae0`:
   intermediate full pass, 11,697 assertions. Self-review found source snapshot
   classification had omitted emitted JS because Node canonicalizes macOS
   `/tmp` into `/private/tmp`. This also affected the earlier three runs; their
   TypeScript, dependency source, runtime and behavior evidence remain intact,
   but they are not the final complete emitted-code evidence.
5. Final authoritative run above: canonicalized the scratch path, added explicit
   assertions for terminal/supervisor/shared-preparation emitted-code snapshots,
   and added compiled-output drift checking. Full matrix passed with complete
   snapshot coverage. Earlier evidence was neither rewritten nor removed.

## Limits and self-review

This proves one explicit synthetic attempt through actual compiled code, SDK,
native HTTP streams, PG17 transactions and FFmpeg. The adapter is **not real
PostgREST, managed Storage, TLS, device/long-audio, deployment or provider
qualification**. Foundation tables/helpers are exact extracted DDL, with minimal
synthetic auth/project/Storage prerequisites; this is not a full deployment
schema replay. Full seal, lease, candidate and finalization migrations are intact.

The lost response is an HTTP response failure after an acknowledged PostgreSQL
COMMIT, not loss of the PostgreSQL wire COMMIT acknowledgement. Native executable
bytes are fingerprinted rather than copied; dynamically linked OS libraries and
Node builtin implementations are not independently snapshotted. The caller
cancellation and role revocation checkpoints are explicit; forced worker death,
all possible revocation timings, resident scheduling and global OS resource
isolation are outside this harness. Cleanup claims concern resources owned by
this attempt and its disposable fixture.

No unresolved scoped behavior issue was found in self-review. Independent
specification/quality review remains for the controller. G1-01 remains partial;
`g1MilestoneSatisfied:false`, `pushConditionSatisfied:false`.

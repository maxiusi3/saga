# G1 Worker Lease Local Evidence

This batch uses `c0669e805` on `codex/october-upgrade-p0`. The previous input-only
implementation and its evidence remain intact. No staging, commit, push, remote
migration, deployment, paid API call, or real family recording is part of this run.

## Authoritative Runs

- [Frozen full project gate](full-chain-final.json): exit 0, Web 146 suites / 2588
  tests, shared 4/16, infra 14, type-check/lint and 184-page build all pass. No
  source drift. [Next-generated import check](next-env-check-final.json) confirms
  exact original bytes restored. Existing configuration warnings remain; audit
  was not rerun.
- [Application regression](application-green-1.json): four Jest suites, 293 tests.
  [Type/lint](types-lint-2.json) passes; the first type-check's `Object.hasOwn`
  target-library mismatch is retained in [its receipt](types-lint-1.json).
- [Final real PG/process/TypeScript/FFmpeg run](verify-2026-11-03T11-06-38.703Z-a71878d3-cef5-4c0a-b54f-4217514f6b13/results.json):
  17 scenarios, 1943 assertions, 23.508 seconds, all passed. It uses actual local
  PG17.4 and native FFmpeg, with 23 source snapshots unchanged during the run.
- [Independent SQL-only run](sql-only-2026-11-03T11-00-30.466Z-27e72ed3-7019-4fc3-9097-f0b26bd26a6a/results.json):
  13 scenarios, 329 assertions, passed. An earlier independent SQL-only run also
  passed; neither is claimed as cloud or full-migration-chain qualification.
- [Initial full project gate](full-chain-1.json): exit 0, Web 146/2588, shared 4/16,
  infra 14, 184-page build. Production source did not change, but
  `application.mjs` was intentionally strengthened during this run. Use the
  subsequent frozen final gate receipt for final source identity.

In the final combined success case, three source objects span the initial lease:
3.658 seconds, 18 serial heartbeats, one actual decoder, 64,000 PCM bytes. The
four application cases use 205 requests total. Real permission removal and an
already-committed heartbeat whose response times out both abort Storage reads;
uncertain claim does not dispatch or fetch. Explicit recovery gives unknown after
running expiry, retry_wait before dispatch. All jobs remain unconfirmed; no ready,
terminal success, output upload, or cleanup authorization exists.

The exact assertion count includes strict transport-router checks and can vary
with the number of heartbeats. Scenario names, state assertions, and source
identities are the acceptance criteria, not a fixed timing-dependent count.

## RED And Intermediate History

- [Initial client RED](client-red.json), [running-reader RED](reader-red.json),
  [supervisor RED](worker-red.json), and [attempt-budget RED](max-attempt-red.json)
  preserve expected failing behaviors before their fixes.
- `red-without-migration-*` retains two missing-RPC probes, including an actual
  five-argument service-role invocation failing with `42883`.
- The 10:51 run contains only 18 initial probe/setup checks, not the final suite.
  The 10:52 run reproduces the removed old dispatch default. The 10:53 and 10:54
  runs hit a harness cleanup `text = uuid` error and are failures, not product
  evidence. The 10:56 run reproduces cancellation after expiry being rejected
  because `updated_at` was wrongly treated as a TTL anchor.
- [First combined pass](verify-2026-11-03T11-03-58.222Z-29b0f0e8-9a7f-410d-b446-5c7519c28c6c/results.json)
  has 1895 assertions. Its heartbeat-timeout case cancels owned database I/O before
  Storage starts. The final run explicitly waits for a Storage read before
  delaying the committed heartbeat response, and asserts Storage cancellation.
- Each JSON command receipt records command, elapsed time, exit code, before/after
  source hashes, and gzipped raw-log hashes. Each PG run has exclusive timestamped
  snapshots and results; failures have not been overwritten or relabeled.

## Reviews And Integrity

- [Specification PASS](specification-review.md): independent 4/293 Jest and
  read-only source/evidence review.
- [Quality Approved](quality-review.md): subsequent independent 6/362 Jest and
  [17/1933 PG/native FFmpeg run](verify-2026-11-03T11-15-18.765Z-00b3e9e9-e2f3-4560-88b3-76438ee6359c/results.json),
  no blocking findings; all 23 source hashes and cleanup verified.
- [Verification summary](verification.json) and [final integrity](final-integrity.json)
  bind the completed checks, current files, historical evidence, and empty index.

## Boundary And Reproduction

See the [experiment README](../../../../experiments/pg17-recording-worker/README.md)
for commands and fixture substitutions. The strict injected Supabase fetch router
executes parameterized real PG queries; it is not live PostgREST/TLS/Storage or
production RLS evidence. Audio is a two-second synthetic WebM/Opus sine wave and
the external FFmpeg binary is not deployment-qualified or OS-sandboxed.

Successful input verification intentionally leaves a running job and stops
heartbeats before return. Later explicit recovery yields outcome_unknown unless
a future publication slice consumes the attempt. Existing broad deletion writes
may leave an unfinished attempt when they cancel a job; this slice fails closed.
Absent tombstones are not an atomic publication barrier. Large manifests,
long/device recordings, content-failure terminal writes, publication, client
confirmation/cleanup, and deployed scheduling remain outside this evidence.

`g1Item01Complete`, `g1MilestoneSatisfied`, and `pushConditionSatisfied` are false.
[Prior evidence manifest](prior-evidence.json) protects 272 existing files from
seven preceding batches; final integrity also verifies the older protected inputs.

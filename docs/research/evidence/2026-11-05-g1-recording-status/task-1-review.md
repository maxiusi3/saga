# Task 1 final review

Spec compliance: **Approved for Task 1**. The read-only snapshot authority and final native evidence satisfy the task brief. Both Important findings from `task-1-initial-review.md` are resolved.

Task quality: **Approved**. No remaining Critical, Important or Minor finding was identified in the reviewed task scope. Cross-task integration gates remain controller-owned and are listed below.

## Scope and strengths

- Reviewed the supplied initial takeover patch and the separate 92-line, three-file `task-1-fixes-review.patch`; did not replace the inherited dirty baseline with clean HEAD. Base HEAD supplied by the controller: `c0669e8058343f91deba8e468b03e4bf817b1ca5`.
- `supabase/migrations/20261105000001_recording_session_snapshot.sql:5`: exact four-argument STABLE SECURITY DEFINER function, trusted search path, UTC and READ COMMITTED requirement. Its authorized envelope query performs only SELECT operations, with no mutation helper or write/advisory lock.
- `supabase/migrations/20261105000001_recording_session_snapshot.sql:27`: current identity, storyteller authorization, optional story ownership, authorization-subject blockers and project/session/asset/story tombstones are checked together. Errors are non-disclosing.
- `supabase/migrations/20261105000001_recording_session_snapshot.sql:52`: bounded arrays expose corrupt/ambiguous related rows instead of hiding them. The internal snapshot has exactly 13 keys and whole-row JSON; session-count/jobs/attempts/candidates/chunks limits are 2/2/4/4/2001. Application certification remains a separate boundary.
- `supabase/migrations/20261105000001_recording_session_snapshot.sql:90`: PUBLIC/anon/authenticated execution is revoked, service_role is granted execute, and the native ACL comparison confirms no table ACL widening.
- `experiments/pg17-recording-status/database.mjs:94`: a real uncommitted atomic publish and independent READ ONLY reader demonstrate one statement's consistent old tuple, then a new statement's complete committed tuple; subsequent explicit reads reject committed revocation and tombstone.
- `experiments/pg17-recording-status/application.mjs:66`: actual installed Supabase JS/native fetch reads preserve full persisted tuples and real synthetic file bytes, with a request ledger excluding replay/fallback. Public receipts contain the exact 12 compact fields and retain `canClearLocalDrafts:false`.
- `scripts/__tests__/deployment-config.test.js:137`: the scoped change adds only the snapshot migration after its prerequisites.

## Resolved findings and delta assessment

1. **Compiled runtime evidence — resolved.** `experiments/pg17-recording-status/verify.mjs:68` canonicalizes the temporary root before comparing `require.cache` paths; `verify.mjs:91` rejects absent compiled archives or a missing production graph module. The final SQL result contains all 6 loaded compiled modules. Final HTTP contains all 13 production graph modules and 123 valid source/runtime archives. The archive-presence RED at `native-http-2026-11-05T09-24-29.413Z-76e583dd-bf63-466e-b99a-dd94f9725c7f/results.json:5` remains preserved.

2. **True timeout coverage — resolved.** `experiments/pg17-recording-status/http.mjs:52` invokes the caller-abort checkpoint only for abort mode. `application.mjs:96` requires timeout's caller signal to remain un-aborted, enforces the deadline lower bound, retains the bounded upper limit and requires native fetch abort/peer closure without a completed response. The retained assertion RED at `native-http-2026-11-05T09-30-05.226Z-b6ac5278-4084-4a1b-bc26-4cd349b758a2/results.json:5` rejects the former caller-cancellation path. Final telemetry proves the distinct timer and caller-abort paths.

3. **Socket close observation — delta approved.** `experiments/pg17-recording-status/http.mjs:94` registers close-event promises for tracked sockets before destroying connections, awaits server/handler completion and then awaits those actual socket close events at line 98. Listener registration and connection closure occur without an intervening asynchronous yield, avoiding a missed close event. The earlier RED retained a one-socket observation; the final run records zero sockets, zero pending handlers and no fixture errors.

## Independently verified final evidence

Evidence paths below are relative to `docs/research/evidence/2026-11-05-g1-recording-status/`.

| Evidence | Verified result |
| --- | --- |
| `red-without-migration-2026-11-05T08-55-35.906Z-e218e110-0a7c-44fc-acb0-178e6160168f/results.json:385` | Actual service-role missing RPC invocation returns SQLSTATE 42883; the preserved PG log confirms it. |
| `native-sql-2026-11-05T09-26-15.086Z-dbd5ed7b-1d35-4c19-913c-da74fa582bbc/results.json:5` | 5 scenarios / 191 assertions passed. All 41 complete tuple pairs are unchanged; same-statement snapshots are equal; the next statement sees succeeded/ready/cloud_confirmed with equal terminal timestamps. |
| `native-sql-2026-11-05T09-26-15.086Z-dbd5ed7b-1d35-4c19-913c-da74fa582bbc/results.json:60429` | 58 source snapshots plus 6 loaded compiled modules; all 64 compressed and decompressed hashes are valid, and every recorded source hash matches the current file. |
| `native-http-2026-11-05T09-33-17.998Z-3ae4565f-fc32-4849-93d1-ab65ad742d37/results.json:5` | 4 scenarios / 585 assertions passed. All 27 complete tuple pairs and retained-copy comparisons are equal; all saved synthetic copy files match their length/hash records. |
| `native-http-2026-11-05T09-33-17.998Z-3ae4565f-fc32-4849-93d1-ab65ad742d37/results.json:75495` | 100 ms timeout took 101.611129 ms with callerAborted=false. Caller abort took 16.244543 ms with callerAborted=true. Both have fetchAborted=true, peerClosed=true and responseFinished=false. |
| `native-http-2026-11-05T09-33-17.998Z-3ae4565f-fc32-4849-93d1-ab65ad742d37/results.json:75523` | 110 source snapshots plus all 13/13 production compiler graph modules; all 123 compressed/decompressed hashes are valid, with no current source mismatch. |
| `native-http-2026-11-05T09-33-17.998Z-3ae4565f-fc32-4849-93d1-ab65ad742d37/results.json:75515` | Exactly one explicit publication mutation and 26 read-only snapshot requests; no request for the already-aborted call. Zero sockets/pending handlers, no HTTP errors, all handlers finished and all native transports settled. |

- Both final compressed PG logs match their compressed/decompressed hashes. Their diagnostics contain only the expected unavailable/permission-denied errors from negative cases; no WARNING, FATAL or PANIC was found.
- Both final reports record zero clients/errors and removed cluster/socket/temp resources. Read-only filesystem and PID checks independently confirmed their scratch/socket paths are absent and server PIDs no longer exist.
- Both final reports have `sourcesChangedDuringRun:[]`. All G1 and push flags remain false; successful receipts do not grant cleanup or access URLs.
- No test suite, native harness or old evidence writer was rerun by this review. The final records were inspected directly; the earlier failures and initial review remain preserved.

## Exact final source hashes

All **8/8** task files match `task-1-final-review-hashes.json` byte for byte. The final SQL and HTTP source manifests also match all of their current source files, including the production dependencies owned by Task 2.

| File | Verified SHA-256 |
| --- | --- |
| `experiments/pg17-recording-status/README.md` | `0dff9c55c6361e8eb8f90b8ea210bbd9fa10447a4949808d3457ebd316bd69ea` |
| `experiments/pg17-recording-status/application.mjs` | `2e136a58ef7b61a9b4f584376d1a6b04d188f5b494cfd4740fa439ecac934166` |
| `experiments/pg17-recording-status/database.mjs` | `43ca60f84e5db9421dd8db3a2e0fdf63267b0259a625dca3d201b1bb2dd11bad` |
| `experiments/pg17-recording-status/fixture.mjs` | `08d04babdb7ffbdcfef4b365a8599e82d25ca40d6807a6a3bcea71e16adee6fb` |
| `experiments/pg17-recording-status/http.mjs` | `4dd9f926ccf9772a7c346be937a5bff4991b7844e8677c9d4a6443c39eb28463` |
| `experiments/pg17-recording-status/verify.mjs` | `f6221b7d1b2781c5aba5ce2a7855c2797f3f9084d08727e8be2e02d6455b0652` |
| `scripts/__tests__/deployment-config.test.js` | `035ea556299f752fef904f0bad88fcd6b0aab90550be542274883a227f192098` |
| `supabase/migrations/20261105000001_recording_session_snapshot.sql` | `7e303f64a6d7abd2893a1d4f537901d14849bbc35594073a4cb57817ea1f91af` |

## Named outside-diff checks and remaining cross-task evidence

- **Old-writer side effects:** checked imports/exports and evidence-writer references in the inherited worker/candidate/finalization fixtures and `pg17-routines/runtime.mjs`. They do not import an old verify/evidence-writer entrypoint; the new runner owns its destination.
- **Cached compiler mismatch:** inspected `experiments/pg17-recording-worker/fixture.mjs:10`. Its overlapping modules use the same frozen source, ES2022/CommonJS transpile settings and alias rewrite as `application.mjs:12`; there is no different compiler contract hidden by the shared CommonJS cache.
- **STABLE visibility semantics:** checked the [official PostgreSQL function-volatility documentation](https://www.postgresql.org/docs/current/xfunc-volatility.html). Its fixed calling-query snapshot semantics match the actual PG17 race evidence. No broader source crawl was needed.
- **Cannot certify from this task diff:** Task 2's exhaustive validator/route contract and route tests, historical compiler graph gates, final `npm run verify`, shared/infra tests and whole-slice review. The controller must link their final evidence, including resolution of the previously reported Task 2 test-fixture placement failure. This Task 1 approval does not claim those gates passed.
- **Qualification bounds:** loopback HTTP is a PostgREST-shaped substitute with synthetic prerequisites/content. Managed PostgREST/Storage, TLS, cloud/device qualification, real-media FFmpeg work from earlier slices and the full migration replay are not newly qualified here. Statement snapshots remain point-in-time observations; all G1/push conditions stay false.

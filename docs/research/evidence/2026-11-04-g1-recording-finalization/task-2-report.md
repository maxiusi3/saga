# Task 2 implementation report

Status: implementation and focused verification complete; source frozen for independent specification/quality review and parent full repository gate. No staging, commits, push, remote migration, deployment, paid calls or Worker integration performed. G1 and push conditions remain false.

## Delivered behavior

- New `packages/web/src/lib/server/recording-job-finalization.ts` exposes `publishRecordingJob(lease, candidate, options)` and `failRecordingJob(lease, error, options)` and discriminated, frozen terminal receipt types. Both exclusively invoke Task 1's exact 8-argument RPC, require a live running process-local lease, pin closed scalar identities, validate real UTC dates with PostgreSQL microsecond ordering and reject mismatched/malformed receipts. Inputs are copied before the asynchronous request to prevent caller mutation from repinning its response.
- Publish sends the exact prepared candidate output and null failure code. Fail accepts only existing WeakSet-branded `RecordingProcessingError` instances with permanent disposition and sends null candidate/output. No message-based classification or forged prototype acceptance.
- Calls are bounded by timeout and remaining monotonic lease deadline, use `abortSignal(...).retry(false)`, clean timers/listeners and return only `recording_finalization_unavailable` on uncertain/failing outcomes. They never retry, call a fallback failure/write, delete objects, or authorize local cleanup. `canClearLocalDrafts` stays false.
- New `recording-asset-lineage.ts` reuses the existing candidate receipt scalar validator to establish prepared candidate id/job/attempt path, UUID session, project/asset, timestamps and immutable bucket/key/hash/MIME/bytes/duration. Ordinary saga/audio-recordings assets cause no candidate DB reads. Valid ready/deleting/deleted candidate pointers are accepted for lineage; impossible verifying/quarantined pointers, missing rows, query failures and metadata/path mismatch fail closed with a fixed message.
- Asset access resolves candidate session before its initial deletion check/signing. Shared current-media guard revalidates lineage after signing and performs project/session/asset/story deletion lookup as its last await. Tests prove project/session deletion during signing prevents returning the signed URL.
- Export resolves all candidate pointers, including removed candidates, before classification. Candidate session deletion removes affected media and preserves the existing source-provenance blocking rule for story text. Project tombstones block even empty archives, and project/session subjects are included after download/compression/observation writes immediately before returning bytes. No limits, hash checks, legacy parser acceptance or generic signed URL behavior were expanded.
- Only bucket unions changed in `media-export.ts` and `deletion-service.ts`.
- Added independent native HTTP harness modules `experiments/pg17-recording-finalization/http.mjs` and `verify-http.mjs`. Task 1 SQL, fixture, database scenarios, verify script and README were not modified.

## TDD / focused evidence

All command receipts and compressed full logs below are new files under `docs/research/evidence/2026-11-04-g1-recording-finalization/`. Each command receipt includes full source hashes before/after and an empty `sourceDrift` list.

| Evidence label | Outcome |
| --- | --- |
| `task2-terminal-red-01` | Initial missing-module setup failure, retained; not counted as behavioral RED. |
| `task2-terminal-red-02` | Behavioral RED against explicit unavailable skeleton: 41 failed / 44 passed / 85 total. |
| `task2-terminal-green-01` | 85 terminal tests passed. |
| `task2-lineage-red-01` | Behavioral RED against unavailable skeleton: 5 failed / 44 passed / 49 total. |
| `task2-lineage-green-01` | 48 passed, one test fixture failure: literal `invalid` is a valid worker identifier; corrected malformed fixture to `invalid/value`, with original failed evidence preserved. |
| `task2-routes-red-01` | Existing route/guard code failed 20 new behavior assertions; 114 passed / 134 total. |
| `task2-lineage-routes-green-02` | 4 suites / 183 tests passed. |
| `task2-typecheck-01` | Found one non-const key-array TS indexing annotation; corrected before native GREEN. |
| `task2-focused-final-01` | 14 suites / 445 tests passed after source freeze: terminal, lineage, guard, access, export, candidate receipts, processing error brand, media export, deletion service, seal/session service, legacy media, lease, verifier, Worker. |
| `task2-input-storage-final-01` | 2 suites / 232 tests passed: historical input and candidate Storage, completing the existing six candidate/Worker suite coverage. |
| `task2-typecheck-final-01` | Web `tsc --noEmit` passed. |
| `task2-compat-final-01` | `node scripts/verify-recording-worker-compatibility.mjs` passed; old verifier compiler graph executable. |
| `task2-diff-final-01` | `git diff --check` passed. |

Total final focused coverage: 16 suites / 677 tests passed. Parent owns full `npm run verify`, shared tests, infra tests and independent specification/quality review after this report.

## Native HTTP / database evidence

Run `node experiments/pg17-recording-finalization/verify-http.mjs` for the GREEN matrix. `--without-migration` creates a separate expected RED run; neither path executes previous dated experiments/evidence.

- RED: `http-red-without-migration-2026-11-04T16-55-49.053Z-5df511d1-e297-4c20-a2eb-9006b46b12af/results.json`. Actual SDK POST reached PostgreSQL without the finalization migration and received SQLSTATE 42883; adapter success assertion failed as expected. Cleanup complete.
- GREEN: `http-application-2026-11-04T16-57-11.120Z-0b324a81-c131-4d93-ab8a-e46c007364fc/results.json`. 278 assertions, 8 scenarios, 13 actual SDK requests and 13 server requests, with exactly one per application invocation. Uses installed Supabase JS 2.105.3, native fetch, loopback HTTP and disposable PostgreSQL 17.4.
- Scenarios: publish; all six branded permanent failures; malformed receipt after commit; connection loss after commit; cancellation after mutations but before commit with complete rollback; cancellation after commit with persisted success; timeout before commit with complete rollback; real SQL rejection of permanent failure after candidate reservation.
- JSONB RPC results and JSONB state snapshots preserve microseconds; JS Date is not used to round persisted timestamps. Complete before/after job/asset/session/attempt/candidate/chunk tuples are captured. Candidate and chunk rows are asserted unchanged in every case.
- Every response-loss/malformed/cancelled committed outcome is surfaced as unavailable with SQL success left intact, never replaced by fail or followed by any extra fetch. All branches retain `canClearLocalDrafts:false` semantics.
- GREEN cleanup: HTTP listening false; zero sockets, pending handlers or errors; all handlers finished and fetches settled. PostgreSQL stopped; zero clients; temporary data/socket directory removed; server PID gone. Both RED and GREEN retain compressed sources and PostgreSQL log.
- All 25 GREEN source snapshots were rehashed after final tests and still match current files. `sourcesChangedDuringRun=[]`. Type annotation fix occurred before the GREEN run. The current Task 1 migration/fixture and inherited source snapshots match that run.

This is deliberately a **PostgREST-shaped substitution**, not real PostgREST or cloud qualification. The finalizer harness does not transfer or verify Storage bytes/audio and does not exercise the Worker, ASR, browser confirmation or a resident scheduler. Synthetic prerequisite schema qualification is inherited from Task 1.

## Residuals / review handoff

- Independent review/full repository gate remain pending with parent. No known implementation blocker remains at this report.
- Published access/export perform optimistic reads; there is no atomic privacy snapshot transaction and signed URL TTL is unchanged. Export still buffers and retains its existing bounded synchronous limits.
- Physical deletion's stale target capture and backup bucket allowlist remain documented unimplemented concerns. Candidate GC must retain objects referenced by assets despite candidate state remaining prepared.
- Status/read reconciliation, terminal replay, client acknowledgement/cleanup authority and Worker orchestration are explicitly absent. Old seal and generic URL parser remain strict and unchanged; their existing tests and Task 1 native seal replay checks cover continued rejection.
- Inherited dirty files and all old evidence remain preserved. This report is not a release or G1 completion receipt.

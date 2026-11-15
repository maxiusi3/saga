# Task 2 review — strict status reader and authenticated GET

## Spec compliance

- ✅ **Spec compliant for the Task 2 source scope.** The reader snapshots input/options, validates canonical arguments, sends exactly one bounded RPC with `abortSignal` and `retry(false)`, and converts transport/validation failures into the fixed error (`packages/web/src/lib/server/recording-session-status.ts:10–39`). The GET derives actor identity from authentication, rejects duplicate/unknown query keys, preserves status semantics and cookies, and applies no-store (`packages/web/src/app/api/recordings/sessions/[sessionId]/status/route.ts:13–33`).
- ✅ The internal envelope has exactly 13 keys, identities and row counts are checked, and receipts contain only the 12 specified fields with `canClearLocalDrafts:false` (`packages/web/src/lib/server/recording-status-validation.ts:15–41`, `:153–193`, `:225–237`). No mutation, signing, fallback, recovery, cleanup, or access-capability branch is added.
- ✅ Success and permanent failure require coherent asset/job/session/current-attempt tuples and microsecond terminal-time equality; success additionally binds the single prepared candidate, immutable metadata, output content and chronological retry history (`packages/web/src/lib/server/recording-status-validation.ts:44–108`, `:204–233`). Partial terminal tuples reject. Sealed-only, asset-only and explicit nonterminal/recovery states return unresolved without terminal content (`:111–150`, `:190–203`, `:235–237`).
- ✅ Every requested file has a corresponding scoped hunk: the reader, optional pure validator, GET, both test suites, shared fixture and parser/hash exports. The existing loader retains its original 13,735-byte prefix, followed only by the two pure exports (`packages/web/src/lib/server/recording-job-input.ts:255–261`; independently recalculated prefix SHA-256 matches `task2-legacy-input-preservation.json:2–6`).
- ⚠️ **Cross-task evidence remains pending the Task 1 final run/review.** SQL privilege/isolation/snapshot guarantees and the final native SDK/HTTP runtime archive, timeout and socket-cleanup evidence cannot be certified from this application diff. The latest native run inspected, `native-http-2026-11-05T09-30-05.226Z-b6ac5278-4084-4a1b-bc26-4cd349b758a2/results.json:35`, fails “timeout must occur without caller cancellation”; `:43211` records caller cancellation during that case and `:43228` records incomplete HTTP cleanup. The controller must retain these failures and identify a clean final native run using unchanged application hashes, including archived compiled runtime and successful cleanup. These are cross-task evidence requirements, not a demonstrated Task 2 reader defect. G1 and push conditions remain false.

## Strengths

- Request I/O is a small 41-line adapter; pure row reconciliation is separate and decomposed into time, attempt-history, candidate and nonterminal-state validators (`packages/web/src/lib/server/recording-session-status.ts:10`, `packages/web/src/lib/server/recording-status-validation.ts:44`, `:68`, `:93`, `:111`, `:153`).
- Existing manifest hashing, deterministic seal preparation and candidate validation are reused. Raw storage pointers and worker/candidate identities are never copied to the public receipt (`packages/web/src/lib/server/recording-status-validation.ts:1–3`, `:158–168`, `:186–189`, `:225–233`).
- Tests execute the actual reader and installed SDK through a transport fake; route tests replace only authentication/admin factories. They assert closed response schemas, cookie preservation, status codes, fixed diagnostics, one request, cancellation, timeout and no unrelated request path (`packages/web/src/lib/server/test-support/recording-status-fixture.ts:80–95`; `packages/web/src/lib/server/__tests__/recording-session-status.test.ts:9–55`, `:147–250`; `packages/web/src/app/api/recordings/sessions/[sessionId]/status/__tests__/route.test.ts:26–89`).
- The fixture-discovery correction is verified by the canonical full gate, rather than only explicit test-path execution: `full-gate-02.log:34–35` reports 153/153 suites and 3100/3100 web tests; `:387–388` reports 4/4 shared suites and 16/16 tests; `:483–486` reports all 14 infra tests passing. `full-gate-02.json:735` records exit 0 and `:1462` records no source drift. All seven Task 2 hashes match both source maps in that gate receipt.

## Issues

### Critical

- None found in the Task 2 diff.

### Important

- None found in the Task 2 diff. The native evidence requirement above remains a controller/Task 1 gate.

### Minor

- Verification output is not entirely pristine: `full-gate-02.log:61–65` contains unsupported/deprecated Next configuration warnings, and `:73–128` contains optional-environment warnings. The focused Task 2 GREEN logs are clean. This is outside Task 2's changed source; retain the warning disclosure in the whole-slice assessment rather than claiming a warning-free full gate.

## Named outside-diff risks checked

- **Manifest/seal contract drift:** checked the existing closed parser/canonical serializer in `packages/web/src/lib/server/recording-job-input.ts:55–88` and pure seal preparation in `packages/web/src/lib/server/recording-session-service.ts:72–143`. Canonical physical chunk locations, byte totals, deterministic asset/idempotency identity and immutable asset fields match the validator's expectations; supplying an explicit placeholder job ID avoids random generation before registration.
- **Candidate validation mismatch:** checked `packages/web/src/lib/server/recording-output-candidate.ts:20–51`. Its closed candidate receipt validates canonical object identity and bounded output metadata, and Task 2 adds the session/job/attempt/manifest bindings and timestamp range checks.
- **Nonterminal state/lease mismatch:** checked the lease routine's duration and state-writing branches in `supabase/migrations/20261103000001_recording_worker_leases.sql:62–64`, `:293–329`. Lease duration bounds, start/heartbeat timestamps, exact retry/outcome-unknown/max-attempt codes and recovery finish/not-before relationships agree with the new classifier. No lease routine is called by the new reader.
- **SDK silently retrying or ignoring the signal:** checked installed `node_modules/@supabase/postgrest-js/src/PostgrestBuilder.ts:251–253`, `:341–353` and `PostgrestTransformBuilder.ts:598–600`, together with current Supabase SDK documentation. `retry(false)` disables both network and status retry paths; `abortSignal` passes the controller signal. The local Promise race separately bounds a stalled transport.
- **Authentication failure or cookie loss:** checked `packages/web/src/lib/server/auth.ts:11–15`, `:35–81` and `packages/web/src/lib/server/media-access.ts:11–18`. Auth returns sanitized failure responses, preserves refresh cookies, and the response helper appends every Set-Cookie then forces no-store.
- **Historical compiler/prefix regression:** inspected `task2-legacy-verifier-command.json:1–7`, `task2-legacy-candidate-command.json:1–7` and their logs; both compiler commands report exit 0. Recalculated the original loader prefix hash without invoking Git. No old verifier/evidence writer was rerun.

## Review checks and assessment

- Reviewed the takeover-relative scoped patch, SHA-256 `bc088bbc744b7e8b49827a324b82f66acb1a7ace1d5cacbeb60cd3c2b83c241a`. The initial display truncated its middle, so only those omitted patch ranges were subsequently rendered; no changed production file was independently reread for a second diff review. Outside-diff reads were limited to the named risks above.
- Verified all seven current source hashes against `.superpowers/sdd/2026-11-05-upgrade-g1-recording-status/task-2-final-review-hashes.json`. Verified the preserved input-loader prefix hash `3698e02cdf2e883e7c5a4db513df803e86f39a7ccdd8eb5427f16044593dbdf8` and exact Task 2 source correspondence in the full-gate before/after maps.
- Inspected behavioral RED evidence (`task2-red2.log:1070–1074`, `task2-timestamp-red.log:41–45`), focused GREEN evidence (`task2-focused-green.log:6–10`, 5 suites/564 tests), the corrected fixture GREEN (`task2-fixture-move-focused.log:6–10`, 2 suites/225 tests), typecheck and historical compiler exit receipts. No suite was rerun by this reviewer, and no source, index or Git state was changed.
- **Task quality: Approved.** The application implementation meets the scoped contract and has meaningful exact-source test coverage. Final slice acceptance still requires the controller to resolve the explicitly named Task 1 native evidence conditions.

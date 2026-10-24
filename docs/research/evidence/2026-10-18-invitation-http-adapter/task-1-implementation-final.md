# Task 1 report — invitation HTTP identity and acceptance adapter

Status: complete for implementation and focused validation. Source frozen at 2026-10-18 21:33 Asia/Taipei. No commit or push. HEAD remains 1caa21a72a23d6f5166ed127847ca931374b890a; original branch remains codex/october-upgrade-p0.

## Result and scope

Both existing POST acceptance handlers now delegate to the same default-disabled adapter; the new POST status handler is read-only. Only exact INVITATION_TRANSACTIONS_ENABLED=true enables work. No environment/configuration file was written. Disabled calls return safe JSON 503 before config/client/network work. Enabled calls require explicit Bearer and a confirmed top-level provider identity; Cookie/service-key/legacy-RPC/direct-table/token-variant fallbacks are absent from these handlers.

The per-request Supabase JS 2.105.3 client verifies auth.getUser(bearer), then calls invitation_candidate.status({ p_token }) and at most one invitation_candidate.accept({ token }) with the same Authorization and anon key. A single ten-second deadline covers authentication, RPC headers and response bodies; caller abort shares that cancellation signal. RPC retries are explicitly disabled. Transport failures are converted to safe responses before auth-js can print raw fetch exceptions. Only complete, validated final acceptance rows can produce success. Pre-read accepted membership establishes consistency expectations and still requires the final already_accepted RPC result.

Shared parsers validate canonical tokens, UUIDs, roles, state, real calendar timestamps, exact identity/member correspondence, nullability, booleans and approved response fields. Status does not return its token. The client helper recognizes safe outcomes, rejects malformed 2xx, and never retries or queries status automatically. The Supabase facade obtains only the current session access token and calls the HTTP helper; ApiClient's existing data wrapper remains intact. Session promise rejection is also converted to a safe not_attempted error.

## Exact application/test files owned

Old files changed (no other old application source was edited):

- packages/web/src/app/api/invitations/accept/route.ts — replace handler with delegation.
- packages/web/src/app/api/invitations/[token]/accept/route.ts — replace handler with delegation; Next params passed once, body identity ignored.
- packages/web/src/lib/api-supabase.ts — required shared-client import and invitations.accept only.

New files:

- packages/web/src/lib/invitation-acceptance-protocol.ts
- packages/web/src/lib/invitation-acceptance-client.ts
- packages/web/src/lib/server/invitation-acceptance.ts
- packages/web/src/app/api/invitations/status/route.ts
- packages/web/src/lib/__tests__/invitation-acceptance-protocol.test.ts
- packages/web/src/lib/__tests__/invitation-acceptance-client.test.ts
- packages/web/src/lib/server/__tests__/invitation-acceptance.test.ts
- packages/web/src/lib/server/__tests__/invitation-fixture.ts — necessary adjacent synthetic provider fixture, explicitly within the allowed fixture split.

New evidence is limited to task-1-* files under docs/research/evidence/2026-10-18-invitation-http-adapter/. This report is .superpowers/sdd/2026-10-18-upgrade-invitation-http-adapter/task-1-report.md. Raw diagnostic logs remain under the same ignored .superpowers task directory with mode 0600. No five-document handoff edit, plan/spec edit, prior evidence edit, migration, dependency, pin, experiment/runtime, unrelated test, next-env, deployment, remote Auth, payment, mail or family-data action was performed by this subagent. Existing uncommitted material was preserved; the controller's initial baseline/integrity check is the final authority for whole-workspace comparison.

## RED/GREEN and intermediate failures

1. Genuine old-handler business RED was captured before replacing either source file. Both real old route functions returned 401 and invoked the external Cookie authentication boundary once while the flag was absent. Expected behavior was 503 and zero external calls. This used a narrow external Cookie Auth helper substitute; it is not claimed as SDK transport evidence. Both disabled tests passed after the shared gate was implemented.
2. Protocol test-first stubs produced 8 failed / 69 already fail-closed / 77 total, then 77 passed with strict parsers. These are parser contract REDs, not the old-handler business RED.
3. Selected enabled handler cases produced 20 failures against a disabled-only adapter. Actual SDK/loopback behavior subsequently passed, but the first complete run had 53 failing cleanup assertions because the fixture returned before socket close events arrived. The fixture was corrected to await every actual socket close, then all 85 handler cases passed.
4. Client/facade test-first cases produced 28 failures against helper stubs plus the old RPC facade, then 28 passed. Further tests found unsafe session-promise rejection and explicit HTTP 400 bad_jwt classification, which were implemented safely.
5. First combined 194-case run had 193 passes and one fixture-contract failure: modern Auth error.code is exposed by the real SDK only when X-Supabase-Api-Version is present. The synthetic provider now includes that real response header. This failure is preserved as pre-final evidence; it is not relabeled as successful or as old-handler business RED.
6. Final combined result is 194/194 passing, with 77 protocol, 29 client/facade and 88 handler cases. All failed raw outputs and classifications are retained in task-1-red-green-ledger.json. No failing output was discarded or reused as final evidence.

## Final commands and results

Executor for the following checks: Task 1 implementation subagent. All use source input digest 3546f70018324f5b9d54752180581a4dd55e92bd9f9ded2fe04736f39d498a59.

From repository root:

```sh
npm test --workspace=@saga/web -- --runInBand --detectOpenHandles --runTestsByPath src/lib/__tests__/invitation-acceptance-protocol.test.ts src/lib/__tests__/invitation-acceptance-client.test.ts src/lib/server/__tests__/invitation-acceptance.test.ts
npm run type-check --workspace=@saga/web
```

Jest: exit 0, 3 suites, 194 tests, no snapshots, no open-handle warning. TypeScript: exit 0. The exact lint command (cwd packages/web) is stored as command/args in task-1-focused-checks.json; it runs ../../node_modules/.bin/eslint over all 11 files listed above and exits 0 with empty output. A scoped git diff --check also exited 0.

The final combined run began 2026-10-18T13:32:45.679Z and ended 2026-10-18T13:33:01.700Z. All three final checks rehashed inputs and confirmed sourceUnchanged=true. Full npm run verify, shared and infra validation is owned by the controller and is running separately from this frozen input; this report does not claim those checks passed. No prior 707-test input, old PG17 run or old audit result is counted as this batch's validation.

## Coverage and self-review

- Gate tests cover absent and non-true values, invalid input and unavailable config while disabled, both old handlers and status, zero fetch calls.
- Real loopback requests assert auth-to-RPC order, exactly one Bearer identity despite a different Cookie, anon apikey, invitation_candidate Content-Profile, exact status/accept parameter names and no Cookie forwarding.
- Body/path tests reject malformed JSON, null/array/unknown keys, noncanonical and multiply encoded tokens; optional user_id is only an identity assertion. Path body identity is ignored.
- Provider tests reject absent/unconfirmed/metadata-only/malformed email identity and malformed IDs, safely classify service failure and explicit auth refusal, and never fall back.
- Protocol tests reject wrong/multiple/empty rows, token, ID, role, type and member mismatches, missing fields, invalid dates and accepted membership of another user. Extra fields are stripped. Accepted pre-reads cannot replace acceptance or fill missing final fields. Database expiry is not locally converted into permission or acceptance success.
- All specified SQLSTATE mappings are covered. Unknown errors, missing results, lost connection and lost accept responses remain non-2xx with no retry. An explicit later status request adds only auth/status reads, preserving one accept total.
- Real network aborts are exercised during auth, status and accept. A delayed-auth plus stalled-accept-body case proves one ten-second budget spans both stages. Test teardown verifies caller abort listeners removed and every fixture connection closed. Deadline timer cleanup and Jest open-handle detection are also checked.
- Client/facade tests use explicit external session/fetch boundaries, assert real exported helper/facade results and ApiClient wrapping, and reject malformed 2xx and absent sessions without legacy RPC recovery.
- Every realistic mutation reviewed (gate bypass, Cookie precedence, wrong schema/arguments, pre-read success, field supplementation, identity mismatch, retry, client trusting malformed success, skipped cleanup) has a behavior assertion. No source-text/mirrored-implementation tests were added.

## Evidence hashes

Canonical source digest: 3546f70018324f5b9d54752180581a4dd55e92bd9f9ded2fe04736f39d498a59

Per-file source hashes are in task-1-source-manifest.json. Final raw logs remain private; their safe published SHA-256 digests are:

- targeted-final: 5a4fefcb41fae2074fd3151309ae064398ef95d4ef4458ac8b37e8e8a734b41a
- type-check-final: 6330f467e47e06803ac361f32c5d25fc6ba471f4176b1f705931589622c5c59b
- lint-final: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

Evidence manifest digest: 899694a9381f30a466ef7386a3bac62d2009123c51ce2d50b17199288e2aff59

Public evidence files and hashes (manifest excludes itself):

- docs/research/evidence/2026-10-18-invitation-http-adapter/task-1-focused-checks.json: 65eaf1d0bc8fc067987009d2b1edb04df9952714106c8b63dd4fe1c841133188
- docs/research/evidence/2026-10-18-invitation-http-adapter/task-1-old-handler-red.json: abbab2d45960f1c2c04adb2b0e64ac002c1866dbaa16a96553ef2b137f070bc4
- docs/research/evidence/2026-10-18-invitation-http-adapter/task-1-red-green-ledger.json: 41896d108e8a4b6adc4a8a8da40de7512fa1e78989c31192ca4b28d4fca9638c
- docs/research/evidence/2026-10-18-invitation-http-adapter/task-1-source-manifest-pre-final.json: ca1cb3191c25d79a45c72625079b3bcbb293b51a1c92cecca9a247af0742f49e
- docs/research/evidence/2026-10-18-invitation-http-adapter/task-1-source-manifest.json: 4374d678e13edcf83e3ff8f33cd8ae2ba3d43b9ee8c80d0dbe761126e5330edc
- docs/research/evidence/2026-10-18-invitation-http-adapter/task-1-targeted-final.json: 3b7c6fbffb21755827794e06e75a32f9ba74ac9340ac2f0fbd1cb97d6137df04
- docs/research/evidence/2026-10-18-invitation-http-adapter/task-1-targeted-pre-final.json: 2c8f6396d94da30a0e96b094223d58ce55dcd899d1ff0d23922bc416573d277e

## Limits and handoff

This is actual SDK-to-HTTP local transport evidence using synthetic provider/REST responses, not production JWT validation, real Supabase/PostgREST schema exposure, PostgreSQL 17 transaction execution, RLS, trusted entitlement provisioning or a production security milestone. No remote database or account was contacted.

Default rollout stays disabled. Historical tokens and Cookie-only acceptance remain intentionally unsupported in these two handlers. Existing direct legacy RPC/table paths elsewhere, old GET/verify/check-pending behavior, sending/releasing invitations, production schema exposure/migration, trusted entitlement events, compatibility migration/rollback and formal UI recovery remain future gates. G0/G1 stay unachieved. Controller should finish full verification, independent specification/code review and authorized handoff documents before deciding the batch status.

## Fix 1 — Jest fixture discovery (2026-10-18 21:41 Asia/Taipei)

The controller's first full project verification found a real integration failure: 960 tests passed, but Jest discovered the helper packages/web/src/lib/server/__tests__/invitation-fixture.ts as a test suite and rejected the suite for containing no tests. The earlier focused GREEN is preserved as historical evidence and did not detect this suite-discovery failure. Controller evidence: project-checks-20261018T133506.json and verify-20261018T133357.log in the batch evidence directory.

This fix moves the helper to packages/web/src/lib/server/test-support/invitation-fixture.ts and changes only its imports in invitation-acceptance-protocol.test.ts, invitation-acceptance-client.test.ts and server/__tests__/invitation-acceptance.test.ts. That new support path supersedes the earlier fixture path in this report's file list. No fixture logic, assertions, production files, Jest configuration or dependency changed; no dummy test was added. A reverse-import comparison against the original source manifest verifies all seven production files and fixture contents unchanged, with exactly three import-string changes and the helper move.

Before the move, npm test --workspace=@saga/web -- --listTests --runInBand --json confirmed the old helper was discovered. After the move, the same discovery command confirms neither helper location is collected and all three intended test suites remain collected. This is meaningful discovery RED/GREEN; the full-suite failure itself was observed by the controller.

Fix 1 focused checks, all executed by the Task 1 implementation subagent from fixed input 690149536961419859643d1e5348866856edec38311e6a4844688d997481fa9e:

- The same three-suite targeted Jest command documented above, with --detectOpenHandles: exit 0, 194/194 tests passed, no open-handle warning.
- Jest --listTests --runInBand --json: exit 0, helper absent, all owned suites present.
- npm run type-check --workspace=@saga/web: exit 0.
- Scoped ESLint across the same 11 owned files with the relocated fixture path: exit 0, empty output.

Exact commands, cwd, timestamps, raw digests and sourceUnchanged=true checks are in task-1-fix-1-focused-checks.json. Raw logs remain ignored, mode 0600. All previously published Task 1 manifests and logs remain unchanged; the previous evidence manifest still verifies.

Fix 1 source digest: 690149536961419859643d1e5348866856edec38311e6a4844688d997481fa9e

Fix 1 evidence digest: c8b08358f80a75a45e8ec359e9f5e0e560fbba6b988dbf752b60c8eaf57edd68

- Raw targeted SHA-256: 1136947b9a6a09873436a7c60835450bd1c6c38378014aab133c48c1c0359dcc
- Raw discovery-green SHA-256: 45084e9c28d241f5db53ff8f927120837f2459d7ca22f6cbd4ed14a902e3825e
- Raw type-check SHA-256: 6330f467e47e06803ac361f32c5d25fc6ba471f4176b1f705931589622c5c59b
- Raw lint SHA-256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

- docs/research/evidence/2026-10-18-invitation-http-adapter/task-1-fix-1-discovery-red.json SHA-256: 09585d34cab18581bdf013709fb6f564af79ff4834f91f63cb44f6637169a215
- docs/research/evidence/2026-10-18-invitation-http-adapter/task-1-fix-1-source-manifest.json SHA-256: d7c7c87521a233a7dd839716e14c39f1b1cc11cddfb7b0b67cb081f02e9ed912
- docs/research/evidence/2026-10-18-invitation-http-adapter/task-1-fix-1-focused-checks.json SHA-256: e13a98f33a1d886fc2414ff32b8f4eb13a1264e37aad8b7a4f1aa4b824625825

Source is frozen again. Full project matrix rerun and independent review remain controller-owned; this fix report makes no new claim that the full matrix has passed. The disabled rollout boundary, historical-token/Cookie-only limitation and production/JWT/PostgREST/PG17 evidence limits remain unchanged.

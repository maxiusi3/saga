# Task 1 implementation report — invitation sender HTTP

2026-10-21. **DONE for Task 1 implementation; source frozen for independent specification and quality review.** This is transport/legacy-entry closure, not production eligibility or P0 completion. No commits, push, deployment, root migration, dependency change, actual Auth/database/mail/payment call, or changes to earlier experiments/evidence were performed.

## Result and boundaries

- Added strict sender protocol, HTTP client, shared sender deadline, server handlers, global POST release/lookup routes, and focused tests. Project POST now calls exactly one candidate send with explicit request/source IDs. Global release calls only release; it accepts no project/request ID and has no lookup precondition. Lookup calls only lookup and does not require the accepted recipient to equal the sender.
- New server operations are enabled only by exact `INVITATION_TRANSACTIONS_ENABLED=true`. The disabled gate precedes body/config/client work. Project GET/DELETE and cleanup GET/POST always return safe 503/not_attempted and perform no authentication, table, RPC or mail work.
- Inputs and final rows enforce canonical lowercase UUIDs, visible ASCII email before lowercasing, one nonempty email pair, Unicode-code-point message length, role/token/timestamp/state consistency and single-row cardinality. Only whitelisted confirmation fields are copied. Unknown or malformed write results cannot become success or a no-write claim.
- Each request creates an anon SDK client, verifies only the supplied Bearer against top-level confirmed provider identity, and carries the same Bearer to the candidate schema RPC. A single ten-second deadline includes body reads, honors caller abort, disables PostgREST retry, and cleans listeners/timers. Actual outgoing operation fetch is the attempted boundary. All production failures are fixed safe text; no token/email/Bearer/provider detail is logged.
- `supabaseApi.invitations.send` and `api.invitations.send` accept optional explicit options; old incomplete calls and list fail before session/RPC/table/HTTP work. Stable facade results retain `{ data }`. Release/lookup helpers and facades validate the original command; cancellation additionally checks the returned project ID against UI context. Browser helpers use current session Bearer, omit cookies, forbid redirects, bound fetch/body reads and never retry or persist invitation data.
- Actual page cancellation targets global POST release, confirms invitation/project/reason-specific state, updates only that visible row, and leaves unknown/malformed/mismatched results as failure. Both existing send forms explicitly remain unavailable because no trusted source selection UI exists. The existing collection GET remains unavailable, so fixture-provided UI rows only exercise cancellation wiring; this increment does not restore a complete sender management flow.
- Recipient acceptance transport/semantics are unchanged. Its existing `isTimestamp` function is exported without changing its implementation; sender lookup reuses the established status-field parser without an actor constraint. The earlier acceptance/read/recipient/auth tests pass.

## Scope and evidence

`task-1-scope.json` lists **8 modified + 12 created = 20 source/test files**. `task-1-source-sha256.json` fingerprints the frozen source used by final runs 18/19/20. The scoped patch is `.superpowers/sdd/2026-10-21-upgrade-invitation-sender-http/task-1-scoped.patch` (generated against exact before-Task-1 copies, not the dirty branch's older HEAD). The controller's baseline remains `.superpowers/sdd/2026-10-21-upgrade-invitation-sender-http/baseline.json`.

`protected-input-sha256.json` and `task-1-fingerprint-verification.json` report **129 protected earlier input/evidence files, 0 changed**, and **20 frozen task files, 0 changed since freeze**. No handoff, main documentation, plan/status summary, or unrelated production source was edited.

All original command output is retained byte-for-byte in ignored `.superpowers/sdd/2026-10-21-upgrade-invitation-sender-http/raw-logs/`. Public evidence copies preserve the output with only synthetic email/token/Bearer values redacted. `task-1-run-manifest.json` records each exact command/argv, cwd, exit, reported counts, original/public SHA-256, redaction counts and the relationship between each pair. The original RED output is not overwritten. The synthetic values originate from the fixed test-support fixtures, not a live service or production log leak. Final GREEN outputs 18/19/20 require no redaction.

## RED, fixes and final verification

| Run | Meaning | Exit / counts |
| --- | --- | --- |
| 01 | Genuine old-route denial RED before implementation: cookie/admin work occurred despite required closure | 1; 7 failed |
| 02 | Missing new modules during test scaffolding; not claimed as business RED | 1; 0 tests |
| 03 | Minimal closed-route scaffold made old denial tests green; missing protocol/transport behavior failed | 1; 10 failed, 7 passed, 58 skipped |
| 04 | Initial protocol/server/legacy GREEN | 0; 75 passed |
| 05 | Old facade and page unsafe-success RED; also contained one UI selector defect and missing new facade API | 1; 11 failed |
| 06 | Corrected selector reproduced component send's unsafe success | 1; 1 failed, 6 skipped |
| 07 | Client strict-confirmation/failure contract RED against minimal client scaffold | 1; 7 failed, 5 skipped |
| 08 | Two test fixture defects: reused consumed Response correctly produced unknown | 1; 2 failed, 17 passed |
| 09–10 | Intermediate typecheck and corrected client/UI fixture GREEN | 0; client/UI 19 passed |
| 11 | Non-ASCII Kelvin sign was accepted after premature lowercase conversion; fixed by validating ASCII first | 1; 1 failed, 37 passed |
| 12–13 | Intermediate invitation/auth regression and scoped lint GREEN | 0; 521 passed |
| 14 | Uppercase provider UUID was accepted; sender now requires canonical UUID, recipient semantics unchanged | 1; 3 failed, 28 skipped |
| 15 | Regression GREEN after canonical provider fix | 0; 521 passed |
| 16 | Next generated route types rejected optional Request parameter | 2; typecheck failed |
| 17 | Scoped lint GREEN | 0 |
| 18 | Required Request signature correction; frozen source web typecheck GREEN | 0 |
| 19 | Frozen source invitation + recipient + authentication regression GREEN | 0; 17 suites, 521 tests passed |
| 20 | Frozen source scoped ESLint GREEN | 0; all 20 scoped source/test files |

Final targeted command:

```sh
npm test --workspace=packages/web -- --runInBand invitation-sender invitation-acceptance invitation-read-routes invitation-recipient auth-return auth-callback auth-session auth-token-refresh cleanup-invitations
```

Final typecheck: `npm run type-check --workspace=packages/web`. Final ESLint argv/cwd are recorded in the run manifest. No full `npm run verify`, shared build/test, or infra gates were run by the implementer; those belong to the controller after independent reviews.

The loopback tests use the actual Supabase SDK and real application handlers against a local synthetic HTTP server, asserting exact Auth/REST headers, methods, schema profile, parameters, operation order/counts, both roles, successful terminal/replay states, SQLSTATE refusals, identity/input/result contamination, dropped responses, held headers/body, one deadline, and caller abort. Fixtures close servers/sockets/held responses; listener matching and no production logs are asserted. Lost send/release responses followed by explicit lookup add no writes. Pure/client/facade/React tests cover strict confirmation and actual cancellation URL/body/Bearer/context checks. These tests do **not** establish real PostgREST/JWT/PG17 end-to-end behavior; existing frozen SQL experiments remain the authority for database authorization, transaction, revocation and transfer behavior.

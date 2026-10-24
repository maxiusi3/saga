# Task 1 independent specification review

2026-10-21 (Asia/Taipei). **PASS — no actionable Task 1 specification deviations found.**

This verdict covers the frozen protocol, sender handlers, client/facade, legacy-entry closure and cancellation integration. It does not establish complete sender management, production readiness, P0/G0 completion, or permission to commit/push/deploy. No implementation was changed and no test suite or real service was run during this review.

## Reviewed inputs and integrity

The binding inputs were `.superpowers/sdd/2026-10-21-upgrade-invitation-sender-http/review-instructions.md`, its `task-1-brief.md`, and `docs/superpowers/specs/2026-10-21-invitation-sender-http.md`. The implementer report was treated as claims to verify.

The reviewed diff was exclusively `.superpowers/sdd/2026-10-21-upgrade-invitation-sender-http/task-1-scoped.patch`, SHA-256 `cede3b175c942144a415608d46a1b7e1a2ed390eec184ad4b2e104c919751761`. No cumulative HEAD diff was used. Independently applying its hunks in memory against `before-task-1` reproduced all 20 current source/test files with zero mismatches. The eight existing before-Task-1 copies match the corresponding pre-batch `baseline.json` hashes; the other 12 scoped files were absent from that baseline.

Independently recomputed checks:

| Input | SHA-256 / result |
| --- | --- |
| `task-1-source-sha256.json` | `b048e2fb7e96b13d5ad732ba086f1782f06bbb2bc22cf6c748cab28b4f0585f8`; all 20 source/test hashes match |
| `protected-input-sha256.json` | `3a9b348d01b88a5f72d5670780b9aab2090921b292b1cbee9c1108b48d6280ac`; all 129 earlier experiment/evidence hashes match |
| `experiments/pg17-invitation-transactions/candidate.sql` | `0f5af3964f537387675f662209d2ebd1dce9745d548ab6886bb275b7d560f305`; unchanged |
| `task-1-run-manifest.json` | `13018698f55522addfe84623b8815d73f2eac2a374e9f0391d85f6e6103bcd2a`; all 20 raw and all 20 public log hashes match |

The source manifest records the exact final test hashes as well as production hashes. Integrity checks were read-only; the only file written by this reviewer is this report.

## Contract assessment

| Requirement | Reviewed implementation and conclusion |
| --- | --- |
| Gate before input/config/auth; permanent closure of legacy paths | `packages/web/src/lib/server/invitation-sender.ts:19` checks exact `true` before deadline/body/config/client creation. Project route lines 2–7 closes GET/DELETE and gates POST before awaiting params; cleanup route lines 2–3 is unconditional unavailable. No cookie/admin/table/mail path remains in these handlers. |
| Strict inputs and legacy missing-ID behavior | `invitation-sender-protocol.ts:17–41` validates canonical lowercase UUIDs, own allowed keys, both roles, visible ASCII email before lowercase, 254-character maximum, outer ASCII whitespace only, nullable/empty message normalization and 2,000 code-point limit. `server/invitation-sender.ts:25–34` rejects malformed JSON and invalid input before auth; incomplete old send receives 503/not_attempted. The already-decoded project path is validated, never decoded again. |
| Exact candidate RPC and one verified Bearer | `server/invitation-sender.ts:35–68` uses an independent anon SDK client, `auth.getUser(bearer)`, canonical top-level provider UUID and established confirmed top-level email/timestamp validation; it does not use metadata identity or fallback cookies/service credentials. Its global Authorization and getUser argument carry the same Bearer. RPC names, `invitation_candidate` schema and send/release/lookup parameter keys match SQL lines 162–163, 243–244 and 276–277. No sender lookup or post-write read is inserted into send/release. |
| Deadline, caller abort and uncertainty boundary | `invitation-sender-deadline.ts:2–21` provides one 10-second timer and abort signal, races pending work, removes listeners and closes in every handler/client finally. Handler lines 27–28, 44–49 and 58–71 cover input body, Auth, operation headers and response bodies. The fetch wrapper checks abort before issuing fetch, and marks attempted at the actual outgoing operation fetch. `.retry(false)` is explicit. Post-dispatch timeout, disconnect, unrecognized SQLSTATE or malformed final row returns 503/unknown; pre-dispatch transport/config failures remain not_attempted. |
| Safe failures and response policy | Handler lines 6–17 maps 42501→403, 22023→400, 23502/23503/23505/23514→409 with rejected, and defaults unknown attempted results to 503. It emits only fixed failure text. HTTP responses set no-store/Vary Authorization; outgoing fetch omits cookies and rejects redirects. Raw transport exceptions are replaced with a safe synthetic response before auth-js can expose them. |
| Strict final confirmation and whitelist | `invitation-sender-protocol.ts:42–78` requires one result row, required UUID/token/timestamp/state fields, send project/role consistency, created→pending, release invitation/reason consistency, and lookup project/role/member consistency. Returned objects enumerate only confirmation fields; release drops token even when upstream supplies one. Missing fields are not filled from input/pre-reads. Lookup reuses `parseStatusResponse` without an actor constraint, so accepted `user_id` correctly represents the recipient. |
| Client and facade | `invitation-sender-client.ts:6–52` validates commands before I/O, current access-token shape and pre-abort, strictly decodes success/failure, treats malformed/network results as unknown, bounds response body reads, and performs no retry, implicit recovery, token rewriting or storage. `api-supabase.ts:343–377` routes complete commands through HTTP using the current session; old send/list fails before session/RPC/table/HTTP access. `api.ts:86–92,120–130` preserves stable `{ data }` wrappers and forwards complete generate/send options plus release/lookup. |
| Actual page/component behavior | Manage page lines 84–100 explicitly leaves old send unavailable and calls global release with invitation ID/reason, the current auth-store access token and expected project ID. Only the strict helper's confirmed result produces the cancellation toast and visible-row update; unknown/mismatch/malformed results preserve failure. Component lines 118–121 also makes incomplete send unavailable. The existing auth-store `getAccessToken` path at lines 146–178 rechecks current identity/session rather than returning an arbitrary stale browser user ID. |

### Global release and database authorization

The global endpoint is consistent with the actual SQL, not merely with fixture responses. `_load(...,'release')` checks the current project's `facilitator_id` against `auth.uid()` at SQL lines 124–125. The source/project conditions for other audiences are in the separate branch at lines 127–132: active project, original payer as project facilitator, sender identity, and verified/unrevoked source where applicable. Release still validates the underlying invitation/source/reservation binding and locks the relevant rows (lines 101–122); it does not bypass binding integrity.

Consequently, imposing sender lookup before release would incorrectly deny rightful cleanup after project transfer, source revocation or project inactivation. `release` itself calls the release audience at line 249, returns the invitation's authoritative bound project, enforces the requested terminal state and refunds the original payer/source transactionally. HTTP has no client-supplied project permission claim. The UI's expected-project comparison is a confirmation check, not database authorization. This is the required design.

SQL lookup uses `(auth.uid(), request_id)` at lines 281–284 and returns `b.accepted_user_id`, not the sender. The HTTP decoder does not equate that returned recipient with the sender. A rejected or unknown lookup does not create an inferred success or automatically repeat either write.

## Evidence assessment

The actual application route imports and actual Supabase SDK are used by `server/__tests__/invitation-sender.test.ts`; the shared loopback fixture only replaces upstream HTTP services. Tests at lines 69–86 assert exact Auth/RPC order, count, method, schema profile, Bearer, anon key, payload and absence of cookies. Subsequent tests exercise both roles and terminal/replay states, release without lookup, distinct accepted-recipient identity, known/unknown SQL errors, malformed final rows, lost send/release response followed by explicit lookup, abort before/during auth, held operation bodies, and a single deadline spanning delayed auth and send body. Fixture cleanup asserts zero open sockets/held responses; request listener removal and lack of production logs are asserted.

Pure protocol tests inspect normalization, cardinality, state consistency, unknown fields and whitelisting. Client/facade tests use real helper/parser logic around replaced external boundaries. `components/invitations/__tests__/invitation-sender-ui.test.tsx:32–48` renders the actual page and asserts release URL, body, Bearer, success and mismatch/unknown refusal; lines 49–67 render both real send forms and assert no write/no success. Its fixture-provided list rows establish cancellation wiring only: real collection GET remains closed, so this is not evidence of a usable sender history/list product.

Business RED is established independently by preserved run 01: the old project POST/GET/DELETE return 401 after one authentication boundary call, and old cleanup reaches the admin boundary rather than stopping at 503/zero I/O. The corresponding seven denial assertions fail. Run 05 separately shows the old facade returning success instead of an InvitationHttpError. Run 02 is a missing-module scaffold and is not business RED. Run 06 also contains a malformed legacy-render crash; it is not needed as the sole proof of unsafe legacy behavior. This does not invalidate the genuine run 01 RED.

Final saved runs, verified by file content and manifest hashes rather than rerun:

| Run | Exact command / scope | Exit and saved result | Raw and public SHA-256 |
| --- | --- | --- | --- |
| 18 | `npm run type-check --workspace=packages/web` | 0; `tsc --noEmit` | `6330f467e47e06803ac361f32c5d25fc6ba471f4176b1f705931589622c5c59b` |
| 19 | `npm test --workspace=packages/web -- --runInBand invitation-sender invitation-acceptance invitation-read-routes invitation-recipient auth-return auth-callback auth-session auth-token-refresh cleanup-invitations` | 0; 17 suites / 521 tests passed | `fd45011c745584494d560bbc8ab91e3308e3d28921d55ce92a9cf8fe9fd706e8` |
| 20 | Local `node_modules/.bin/eslint`, cwd `packages/web`, exact 20-file absolute argv in the run manifest | 0; empty output | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

Final files are `18-web-typecheck-green.log`, `19-frozen-targeted-green.log` and `20-frozen-scoped-lint.log` in this evidence directory, with corresponding originals in the ignored batch `raw-logs` directory. All three final public files equal their raw originals and require no redaction. Final logs contain no new warning/open-handle diagnostics. All 20 public logs were also scanned for standard invitation tokens, the fixed fixture Bearer and synthetic email addresses; no unredacted matches were found. Earlier raw/public differences are declared with separate hashes and redaction counts in the manifest.

## Limits and disposition

No actionable specification gap was found. No focused reproduction was necessary, and no broad rerun was performed. Unchanged code was inspected only for named integration risks: shared provider/status validation, the current UI token source, actual unavailable list behavior, loopback cleanup and SQL authorization/result signatures.

These HTTP fixtures are synthetic Auth/REST transport evidence, not real PostgREST/JWT/PG17 end-to-end evidence. Earlier SQL inputs/evidence remain fingerprint-preserved; their database behavior was not rerun or promoted into new HTTP E2E proof. Trusted source selection, sender history/list/refresh recovery, full real-service E2E and production qualification remain explicitly outside Task 1. Controller-level fresh verify/shared/infra checks, documentation and whole-batch reviews remain separate exit obligations. **PASS applies only to this frozen Task 1 scope.**

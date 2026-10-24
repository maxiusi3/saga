# Task 1 independent code quality review

2026-10-21 (Asia/Taipei). **Approved — no actionable correctness, security, regression or maintainability findings in the frozen Task 1 scope.**

This is an independent quality review of the sender protocol, HTTP handlers, client/facades, legacy-entry closure and cancellation integration. The preceding specification PASS was read as context, not used as proof of correctness. Approval does not establish sender management product completion, real-service E2E, production qualification, P0/G0 completion or authorization to commit/push/deploy.

## Scope and integrity

Read the batch review instructions, Task 1 brief, binding `docs/superpowers/specs/2026-10-21-invitation-sender-http.md`, implementation report and repository `CLAUDE.md`. The task's specific Bearer-only and gate-first contract takes precedence over the repository's generic route pattern. No repository `AGENTS.md`, `CONTRIBUTING` or `CODING_STANDARDS` file was found. The code-review skill's general standards/spec lenses were used within the controller's explicit constraints: no further agents and no cumulative HEAD diff.

Reviewed only `.superpowers/sdd/2026-10-21-upgrade-invitation-sender-http/task-1-scoped.patch`, SHA-256 `cede3b175c942144a415608d46a1b7e1a2ed390eec184ad4b2e104c919751761`. A read-only in-memory application of every hunk to the exact `before-task-1` copies reproduced all 20 current files; zero patch or before/baseline mismatches occurred. The final source/test manifest contains the exact hashes of all 20 reviewed files, including the six changed/new test files.

Independently recomputed evidence:

| Input | SHA-256 / integrity result |
| --- | --- |
| `task-1-source-sha256.json` | `b048e2fb7e96b13d5ad732ba086f1782f06bbb2bc22cf6c748cab28b4f0585f8`; 20/20 current source/test hashes match |
| `protected-input-sha256.json` | `3a9b348d01b88a5f72d5670780b9aab2090921b292b1cbee9c1108b48d6280ac`; 129/129 earlier inputs/evidence match |
| `experiments/pg17-invitation-transactions/candidate.sql` | `0f5af3964f537387675f662209d2ebd1dce9745d548ab6886bb275b7d560f305`; unchanged |
| `task-1-run-manifest.json` | `13018698f55522addfe84623b8815d73f2eac2a374e9f0391d85f6e6103bcd2a`; all 20 raw and 20 public log hashes match |
| Controller `project-verification-20261021T022537Z-f5820706-f190-44bf-9100-8aa7dfc5b528.json` | `d6eefcd4ef1468b2587dca790ea674ec888e0bb6fe51380234feee638efcd751`; passed; 785/785 current application inputs match; next-env restoration recorded |

Unchanged code was inspected only for concrete integration questions: shared timestamp/provider/status parsing, the page's current token source and unavailable collection loading, fixture resource cleanup, SQL signatures and release authorization. No implementation, git state, old evidence, dependency or general documentation was changed. This report is the only file written by this reviewer. No test suite, new fixture or real service was run.

## Quality assessment

No actionable finding requires a severity or remediation line reference. The following reviewed boundaries support the verdict:

| Boundary | Assessment and relevant source |
| --- | --- |
| Input and final-result trust | `packages/web/src/lib/invitation-sender-protocol.ts:17` onward keeps canonical UUID, ASCII email normalization, allowed keys, roles and code-point message limits in pure parsers. Lines 42–78 require exactly one final row, bind the expected project/role or invitation/reason, validate token/timestamp/state/member fields and return explicit whitelists. Missing output fields are not synthesized from request input. Extra upstream fields, including a release token, cannot escape into success responses. |
| Authentication and safe refusal | `packages/web/src/lib/server/invitation-sender.ts:19–38` rejects a disabled gate before parsing or config/client work and validates the body before auth. Lines 39–65 create an isolated anon SDK client, verify the supplied Bearer using `getUser`, require canonical top-level identity and confirmed email, and reuse that same Authorization for RPC. No cookie, metadata-identity or service-role fallback remains. Errors return fixed text and safe status/outcome fields. |
| Write uncertainty and cancellation | Server lines 44–50 observe the actual operation fetch, bind both headers and full body reads to the shared deadline, omit credentials and refuse redirects. Lines 68–76 disable retries, check abort after RPC, preserve unknown results after a dispatched operation and always close the deadline. `invitation-sender-deadline.ts:2–21` removes its timer and listeners; it does not create a new budget per network phase. No follow-up read is used to fabricate confirmation of an uncertain write. |
| Exact SQL contract and global release | Server lines 66–73 use `invitation_candidate.send/release/lookup` with the exact SQL parameter names. Release has no lookup precondition. SQL `_load` lines 124–132 authorize release through the current project's facilitator separately from sender lookup's active-project/original-payer/source restrictions. SQL lines 243–262 return the authoritative bound project and reason-specific final state. This preserves valid cleanup after source revocation, transfer or project inactivation. Lookup returns the accepted recipient's identity at lines 276–284; the shared status parser is deliberately called without a sender actor constraint. |
| Browser helper and stable facades | `invitation-sender-client.ts:6–52` validates inputs before fetch, decodes success/failure strictly, bounds response reads and has no retry, implicit recovery or persistent invitation cache. `api-supabase.ts:343–377` obtains a current session only after complete command validation; old send/list refuses before session/RPC/table/HTTP access. `api.ts:86–92,120–130` retains data wrappers and forwards complete options through the same helpers. |
| Actual page/component behavior | Manage page lines 84–100 leaves the incomplete form unavailable and invokes global release with the selected invitation and expected project. Only a matching final result triggers its success toast and row state update. Invalid/unknown responses remain failure. The current `auth-store.ts:146–178` token path rechecks identity/session. `invitation-manager.tsx:118–121` also keeps its incomplete send unavailable. Their collection GET remains intentionally closed; cancellation tests use fixture-provided rows and do not establish a usable sender history page. |
| Separation and maintainability | Pure protocol rules, bounded transport, server orchestration and facade/UI call sites have clear responsibilities. Sharing the established timestamp/status validation adds only an export to the recipient protocol; its semantics are unchanged. The three-operation handler's branch structure is small and keeps the authorization, retry and uncertainty rules together. No speculative abstraction or unrelated functional change warrants a maintainability finding. |

## Test and raw evidence assessment

The sender server tests import actual route handlers and use the real Supabase SDK against synthetic loopback HTTP. They assert exact method, URL, schema profile, Bearer, anon key, payload, order and count rather than merely checking an internal helper was called (`server/__tests__/invitation-sender.test.ts:69–86`). Other cases cover both roles and result states, release/replay without lookup, a different accepted recipient, known/unknown SQLSTATE, malformed/multiple rows, lost write responses, explicit lookup without another write, abort during auth and operation bodies, and one deadline spanning auth and send.

The server fixture tracks and closes held responses and sockets; the test teardown checks cleanup and matched request-signal listener removal. Console spies are checked for unexpected production output rather than silently discarded. Client/facade tests validate normalized payloads, current-session Bearer, stable wrappers, no-I/O legacy behavior and unknown/malformed responses. The React tests render the actual page/component and verify the cancellation URL/body/Bearer and refusal of project/invitation mismatches. These assertions exercise meaningful behavior, not vacuous stubs.

Read the preserved business RED in `raw-logs/01-legacy-red.log`: the old POST/GET/DELETE cases reached the external authentication boundary and returned 401; old cleanup reached its admin boundary and returned 500. The required 503/zero-I/O assertions failed in all seven cases. This is real old behavior, independent of the separately identified missing-module scaffolding failures. Run 01's raw/public SHA-256 is `2fdd37f35030e14e5fb3a82fc53583cdee12a9a855f5dca47d59c6cb4be7ab5e`.

Saved final runs were verified by raw file content and hash, not rerun:

| Run | Exact command / recorded scope | Result | Raw and public SHA-256 |
| --- | --- | --- | --- |
| 18 | `npm run type-check --workspace=packages/web` | Exit 0, `tsc --noEmit` | `6330f467e47e06803ac361f32c5d25fc6ba471f4176b1f705931589622c5c59b` |
| 19 | `npm test --workspace=packages/web -- --runInBand invitation-sender invitation-acceptance invitation-read-routes invitation-recipient auth-return auth-callback auth-session auth-token-refresh cleanup-invitations` | Exit 0, 17 suites / 521 tests | `fd45011c745584494d560bbc8ab91e3308e3d28921d55ce92a9cf8fe9fd706e8` |
| 20 | Local `node_modules/.bin/eslint`; exact 20-file absolute argv and `packages/web` cwd in the run manifest | Exit 0, empty output | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

The filenames are `18-web-typecheck-green.log`, `19-frozen-targeted-green.log`, and `20-frozen-scoped-lint.log`; originals are preserved under the ignored batch `raw-logs` directory and corresponding public copies are in this evidence directory. These final raw/public pairs are byte-identical. Scanning public `.log` files found no canonical invitation token, fixed synthetic Bearer or email pattern; prior failure-log redactions remain declared in the manifest.

The controller's fresh checks also have matching log hashes: verify exited 0 with 101 suites / 1,373 tests and build, shared exited 0 with 4 suites / 16 tests, and infra exited 0 with 7 tests. Their SHA-256 values are respectively `8634eda42de0836bb73a4a41dcfa62ef2a8b6da97e331328f9ffb6a887733c3b`, `0ed25951e303c70e3a5d4d4c9d3c16948315fc8de6e9b8f179d1cb09ed50a25b`, and `3069445a4b485c65df4c6eca529a48e717758d1bfccf654a0deeb2e0a3de6df7`. The final targeted logs contain no new warnings. The controller build repeats the known unchanged `images.domains` deprecation; `next.config.js` is outside this diff and its preserved input matches, so this is not a Task 1 regression.

## Disposition and limits

**Approved.** No concrete suspected behavior gap required a disposable reproduction, and no broad rerun was performed. The loopback tests establish synthetic Auth/REST transport behavior with the actual SDK and handlers; they do not establish real Auth/PostgREST/JWT/PG17 E2E. Earlier SQL evidence remains unchanged and was not rerun or relabeled. Trusted source selection, complete sender history/refresh recovery, real-service E2E and production qualification remain outside this batch. Documentation and whole-batch review remain separate obligations.

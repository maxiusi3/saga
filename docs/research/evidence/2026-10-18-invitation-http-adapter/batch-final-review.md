# Whole-current-batch independent review — invitation HTTP adapter

**Local-batch readiness: PASS. Specification alignment and code quality: Approved.** No Critical or Important findings. Deferred Minor M1 is confirmed and remains a small documentation correction; it does not undermine the implementation or recorded validation. Correct it in the final documentation fix wave before presenting the handoff as final. This verdict does not approve production rollout, a merge, or the original upgrade milestones.

## Review boundary

Reviewed the complete 21-file `batch-final-diff.md` against the 1,604-file saved session start and eight authorized old-file snapshots, together with `batch-final-snapshot.json`, the binding specification and plan, progress ledger, implementation/documentation reports, original Task 1 review, Fix 1 review, Task 2 review and referenced evidence. Earlier uncommitted upgrade batches are outside this authored diff. Reviewed final application input digest: `690149536961419859643d1e5348866856edec38311e6a4844688d997481fa9e`.

No test suite was repeated. The frozen execution evidence answered the behavior and integration questions. Only this report was written; no source, documentation, evidence, dependency, runtime, index, branch or HEAD changes, subagents, commits or remote operations were performed.

## Strengths

- Both old acceptance handlers delegate to the same adapter, and the new status handler takes its read-only branch. `packages/web/src/lib/server/invitation-acceptance.ts:51` requires the exact enabled value before input/configuration/client work. The replaced handlers retain no old Cookie, service-client, direct-table, legacy-RPC or token-variant write fallback. The compatibility break is explicit in the specification and handoff, and the production flag remains disabled.
- `packages/web/src/lib/server/invitation-acceptance.ts:78` constructs one request-scoped client with session persistence, automatic refresh and URL session detection disabled. Explicit `auth.getUser(bearer)` and both RPC calls use the same credential. Top-level provider identity and confirmed email are validated; metadata cannot supply identity, and body `user_id` is only an equality assertion. The path handler does not consume body identity or decode the framework-provided token again.
- `packages/web/src/lib/server/invitation-acceptance.ts:111` uses the actual `invitation_candidate` schema and distinct `status({ p_token })` / `accept({ token })` arguments. The parsers require one complete row, exact token/identity/project/role consistency, typed timestamps/booleans and coherent member nullability. A pre-read that is already accepted still requires a final `already_accepted` result with the same member and join timestamp. Missing final fields are never supplied from the pre-read.
- `packages/web/src/lib/server/invitation-acceptance.ts:23` applies one ten-second deadline and caller cancellation across input, authentication and RPC transport, including response-body reads. The transport checks cancellation before dispatch, tracks the accept attempt at dispatch, disables RPC retries and clears operation listeners/timers on every adapter exit. Known SQL rejections are safely classified; unconfirmed post-dispatch outcomes are non-2xx and unknown. The status branch cannot dispatch accept.
- `packages/web/src/lib/invitation-acceptance-client.ts:16` performs one HTTP request, validates complete confirmation, strips unapproved fields and converts transport or malformed-success failures to a safe recognizable error. There is no automatic accept retry or status recovery. `packages/web/src/lib/api-supabase.ts:359` changes only acceptance, plus its import, to use the current session credential; absent or rejected sessions cannot start HTTP acceptance. The existing facade data wrapper remains intact.
- The fixture uses real Supabase SDK requests against a synthetic local HTTP provider. Tests assert request order, credentials, anon key, schema profile, exact parameters and write count, plus response loss, explicit read-only recovery, caller abort during each stage, a deadline spanning delayed Auth and a stalled accept body, and socket/listener/timer cleanup. The fixture is outside Jest discovery after the scoped relocation fix. These are useful local transport assertions, with the production evidence limits accurately stated in the detailed record.

## Findings

### Critical

None.

### Important

None.

### Minor M1 — correct the attribution of the 194-test total

Locations: `docs/2026-10-10-integrated-upgrade-plan.md:46` and `docs/superpowers/specs/2026-10-13-upgrade-p0-gates.md:29`.

The two summary sentences label all 194 focused tests as actual SDK-to-loopback checks. The total is **77 protocol + 29 client/facade + 88 handler**. The protocol suite calls parsers directly (`packages/web/src/lib/__tests__/invitation-acceptance-protocol.test.ts:12`); the client suite substitutes session and fetch boundaries (`packages/web/src/lib/__tests__/invitation-acceptance-client.test.ts:7` and `:21`). Actual SDK-to-loopback coverage is supplied by the handler suite, which also contains no-network rejection cases. Neither all 194 cases nor every handler case is a network round trip.

This overstates the coverage category in two high-level summaries and could mislead a later handoff reader. The research table, verification JSON and implementation report already give the correct split, and both summaries explicitly deny production integration; therefore the finding remains **Minor and nonblocking for local code approval**. It is the same M1 reported by Task 2, not an additional finding.

Remedy: replace the two phrases with wording such as “定向三套共 194 项通过；handler 测试使用实际 SDK 对接合成 loopback”. Preserve the existing test counts and production limitations. Review the small documentation diff and refresh affected document references/hashes; this wording correction does not justify another application test run.

## Evidence and preservation checks

Read-only fingerprint verification during this review confirmed:

- All **21** authored files match the final snapshot. Exactly **eight** of the **1,604** saved-start files changed, all authorized; every saved old-file snapshot matches its baseline hash.
- All **715** application inputs match the successful current-batch project manifest. All **11** final Task 1 files are covered by that map, and their source-manifest digest recomputes to the value above. `next-env.d.ts` matches its saved starting bytes.
- All **11** path/hash references in current `verification.json` match. Both Task 1 evidence manifests recompute correctly and all **10** entries match. The published final implementation report is an exact copy of the appended Task 1 report; its original section and superseding Fix 1 appendix remain distinguishable.
- The successful public project logs match their hashes and record Web **80 suites / 960 tests**, shared **4 / 16**, infra **7**, and **176** generated pages. The canonical manifest records fresh current-batch execution with exit 0 for verify/shared/infra and binds the successful timestamped manifest. The referenced failed predecessor remains a failed execution despite 960 passing assertions; its empty-suite failure is preserved.
- The fixed focused manifest records **194/194**, discovery/type-check/scoped lint exit 0 and no open-handle warning. All **18** referenced private focused/intermediate logs have matching digests and mode 0600; all three private project-log digests are present. No raw private log contents were published by this review.
- All **838** prior experiment items match: 24 sources, 44 dependency/package files, 743 PG runtime files and 27 evidence files. This is preservation evidence only; the PG matrices were not rerun or counted as HTTP/Auth integration.
- Current `final-checks.json` is byte-identical to preserved `integrity-before-batch-review.json`. The controller reports 375 resolved local links, no whitespace/scope violations, no private-definition copies or credential/token/email matches, and unchanged branch/HEAD. Its disclosed exact-prose scanner exclusion is narrow and retains the original failed scan. These are pre-closure checks and must be refreshed after final report/status changes.

The existing missing service-key and obsolete Next configuration warnings remain documented. The unchanged dependency audit still has 42 unresolved findings; successful application checks do not resolve that audit.

## Focused checks outside the authored diff

Only concrete integration questions justified these narrow unchanged-code reads:

- **SQL compatibility:** `experiments/pg17-invitation-transactions/candidate.sql:65`, `:218` and `:265` confirm the ASCII email contract, distinct parameter names, complete acceptance fields, persisted accepted-member fields and status return shape. The adapter agrees with those contracts without changing the candidate.
- **SDK error handling and request behavior:** `node_modules/@supabase/auth-js/src/GoTrueClient.ts:2972` and `node_modules/@supabase/auth-js/src/lib/fetch.ts:77` / `:213` confirm explicit-token user lookup and the raw rejected-fetch logging boundary. The adapter catches transport failures before that logging path and safely classifies returned Auth errors; the real-SDK fixture assertions support the resulting request count and error behavior.
- **Facade wrapping:** `packages/web/src/lib/api.ts:122` still wraps the new acceptance result as `{ data: result }`, matching the client/facade test and handoff claim.
- **HTTP middleware boundary:** `packages/web/middleware.ts:48` excludes `/api` from its matcher, so it does not introduce an authentication request or locale redirect ahead of these default-disabled API handlers.

No unrelated legacy caller or production implementation was treated as newly verified.

## Recommendations and limits

Apply the M1 wording correction, preserve the original reviews, and complete the controller's mechanical closure: publish this actual verdict, replace pending Task 2/final-review status and checklist text, refresh affected references/hashes, and record final integrity. Correctly pending closure fields are bookkeeping work, not application defects or evidence of premature success.

Keep rollout disabled. Legacy opaque-token and Cookie-only callers need explicit compatibility work; send/release/provisioning, old read routes and direct RPC/table paths, trusted entitlement source/events, production schema/Auth/PostgREST/RLS, migration/rollback and formal recovery UI remain open as documented. The synthetic HTTP fixture plus preserved PG evidence does not establish a deployed end-to-end authorization path. G0/G1 remain unmet, and this local batch is not a new milestone.

**Assessment: PASS for the reviewed local batch, with one nonblocking Minor M1 to correct in the final documentation fix wave.** No source fix or additional application verification is indicated by this review. Production, milestone, commit/push/merge/migration and deployment approval remain outside this verdict.

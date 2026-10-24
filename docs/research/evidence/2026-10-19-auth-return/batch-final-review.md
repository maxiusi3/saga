# Auth-return batch — final independent resumed review

Reviewed 2026-10-19 in `/Users/eat/Documents/eatpotato/saga传奇` using the requesting-code-review `code-reviewer.md` rubric. Branch `codex/october-upgrade-p0`; HEAD `1caa21a72a23d6f5166ed127847ca931374b890a`.

**Spec compliance: PASS for this bounded local batch and its accepted rulings.**

**Quality: Approved for local batch closure.** No new Critical, Important, or Minor findings. This is not release or merge approval: RB1 remains OPEN, G0/G1 remain false, and no original milestone has been reached.

## Scope and review basis

Read the binding specification, implementation plan, recovery `progress.md`, Task 1 implementation/review and M1 correction evidence, Task 2 implementation/review, current research/continuation documents, verification summary, resume validation, and preserved project/focused/probe evidence. Reviewed the complete implementation, all three new test files, and loopback fixture, including surrounding locale/token contracts and the unchanged shared browser factory.

The comparison is the **batch-start** package `.superpowers/sdd/2026-10-19-upgrade-auth-return/all-review-package-20261019T112057Z.md`, SHA-256 `df9dc41662c398e286f2dac0fe3e5a1b7c1d9fed4a442cea6e665160c05dc56d`. The accumulated dirty HEAD diff was not used as the review base. Saved before bytes were checked directly and used to reconstruct the package.

The controller's two scope rulings are binding: no persistent lost-next fallback, and safe rejection of mixed error/session input even though it changes an inherited implicit return behavior. The latter requires an explicit open release blocker and first follow-up; it is not claimed repaired by this batch. Shared browser/store persistence, legacy auth entry points, and live provider qualification remain separate work.

## Strengths and integration assessment

- **One target contract is used consistently.** `packages/web/src/lib/auth-return.ts:11` validates once-decoded input against the small dashboard/canonical-invitation language, all eight configured locales, duplicate handling and the 2,048-character bound. Signin consumes it at `packages/web/src/app/[locale]/auth/signin/page.tsx:30`; the adapter consumes it at `packages/web/src/lib/server/auth-callback.ts:49`. Invalid input cannot become a provider redirect or response target. Existing invitation token semantics are reused without changing those sources.
- **Legacy state removal is isolated and failure-tolerant.** `packages/web/src/lib/auth-return.ts:26` catches storage getter as well as deletion errors. Signin calls it at `packages/web/src/app/[locale]/auth/signin/page.tsx:58`, and AuthProvider does so before existing initialization at `packages/web/src/components/auth/auth-provider.tsx:13`. There is no read, write, replacement cache, or session-key deletion in these changes.
- **Signin result ownership matches the specified lifecycle.** `packages/web/src/app/[locale]/auth/signin/page.tsx:47` checks mount/flow identity, render context and actual browser location. The effect at line 63 retains its pending attempt through its own URL cleanup and repeated effects. Parsing rejects ambiguous/error-bearing credentials; actual `setSession` supplies the user/session result, which must satisfy the shared predicate before replace navigation. Provider requests at lines 101–147 use the same target; Google disables SDK-owned navigation and verifies its authorize URL before navigating. Late results cannot navigate or update UI after the checked context changes.
- **The server adapter contains the authentication operation.** `packages/web/src/lib/server/auth-callback.ts:16` rejects invalid/ambiguous modes before constructing the SDK. Lines 65–81 expose only PKCE verifier values while retaining cookie names for stale-chunk deletion. Lines 84–107 permit only the selected endpoint's single POST, reject redirects/re-entry, cover fetch and body with the same deadline, and sanitize transport failures before the SDK can log their exception. The route is a narrow re-export of this implementation.
- **Response/cookie behavior is explicit.** `packages/web/src/lib/server/auth-callback.ts:10` returns HTTP 303 with no-store/no-referrer and independently applies SDK cookie options. Lines 108–111 require a complete future session and matching provider UUID before publishing new session cookies; failures retain only explicit deletions, handle serialization failure, and clean up deadline resources. No HTML/script redirect, credential replay, extra session lookup, service key, or raw callback error reflection was added.
- **Tests exercise the relevant layers without inflating their meaning.** The React suites mount actual components with replaced SDK/router/store boundaries. The callback suite imports the actual route and installed SSR/JS SDK, uses a delegating constructor spy, and checks real loopback request count/body, six OTP types, PKCE, expired-cookie isolation, chunking/deletion, output validation, transport/body failures, abort/deadline and teardown. Documentation explicitly distinguishes this from live provider/browser/JWT/PostgREST qualification.

The shared predicate separates bounded opaque URL credentials from returned session-token validation; the tests preserve the 8,000-character returned-token case. The callback transport defense is consistent with installed SSR defaults and auth-js behavior: inspected SSR PKCE/persistence/auto-initialize settings, PKCE exchange, session loading/refresh, and transport exception handling. The unchanged browser client still uses implicit defaults, consistent with RB1.

## Independent checks actually performed

These were fresh read-only checks during this review; test execution results below are inspected retained runs, not new reviewer executions.

| Check | Result |
|---|---|
| Recompute 1,696 baseline file hashes | No missing files; exactly the eight authorized existing paths changed, comprising three application files and five continuation documents; the other 1,688 remain byte-identical. |
| Validate saved before bytes | All eight changed existing paths match their baseline SHA-256. |
| Reconstruct package diffs in memory | All 17 diff sections reconstruct current after-content from before-content; zero mismatches. |
| Recompute package artifact identities | 38 of 39 match the package; the sole difference is the controller-declared mutable `final-integrity.json`, regenerated during review. It is byte-identical to immutable recovery `pre-final-review-integrity.json`; this is expected stage evidence, not a source change. |
| Recompute authoritative v2 source manifest | All nine implementation/test/fixture hashes match. |
| Recompute original project inputs | All 757 current hashes match `project-verification-20261019T033925Z.json`; recorded input changes are empty, and next-env remains restored. |
| Recompute current summary references | All 53 `path` + SHA-256 references in `verification.json` resolve and match. |
| Resolve documentation navigation | All 414 local links across the nine current Markdown plan/spec/research/continuation inputs have existing destinations. |
| Preserve compatibility probe | Published probe source is byte-identical to recovery source; the temporary application probe file is absent. Before bytes are baseline-authentic. |
| Whitespace/error check | `git diff --check` exits 0 with no output. No diff content from HEAD was used to set scope. |
| Branch and HEAD | Match the required existing branch and HEAD. |

Inspected authoritative raw output and corresponding recorded command exits:

- `final-v2-focused-and-invitation-regressions.txt:7`: eight suites / 430 passing tests, no skips, exit 0; 177 new tests plus 253 invitation regressions. The v2 type-check and nine-file lint logs each record exit 0.
- `project-verify-20261019T033925Z.txt:34`: 85 Web suites / 1,196 tests; line 256 records 176/176 generated pages. The project report records `npm run verify` exit 0.
- `project-shared-20261019T033925Z.txt:10`: four suites / 16 tests; its recorded command exits 0. `project-infra-20261019T033925Z.txt:49`: seven tests, seven pass, zero fail; its recorded command exits 0.
- `red-existing-behavior.txt:510` and `:573`: original callback URL/error reflection and missing response protections, followed by two failed suites / five failed tests and npm error code 1. The retained callback input has no code sentinel. M1 now accurately separates this executed evidence from code/token_hash logging seen in original source.
- `implicit-fragment-compatibility-probe.txt:8`: same synthetic mixed-error/fragment input produces old session/navigation 1/1 versus current 0/0 and cleared fragment; one probe passes, exit 0. Probe source compiles the preserved old component and replaces SDK/router boundaries, so its conclusion remains page-scoped.

The superseded 414-test freeze, harness failures, earlier RED/GREEN and prior-batch evidence are preserved and labelled. No broad tests were rerun: unchanged frozen sources and all 757 input identities support the retained successful run, and this review found no concrete new doubt requiring another execution.

## Findings

### Critical

None newly identified in this batch.

### Important

None newly identified against the binding, scope-qualified specification. The accepted RB1 below remains a release blocker and is not downgraded by this result.

### Minor

None newly identified. Task 1 M1 is corrected and independently verified, not an open finding. Existing build/configuration/audit concerns are carried forward separately below.

## Release status and required continuation

**RB1 — OPEN; release not ready.** At `packages/web/src/lib/auth-return.ts:53`, mixed error/session input fails closed; at `packages/web/src/lib/server/auth-callback.ts:59`, a fragment-only callback has no server-visible credential mode. The unchanged factory at `packages/web/src/lib/supabase.ts:52` retains implicit flow/localStorage behavior. The before/current probe demonstrates the specific compatibility change. `docs/research/2026-10-19-auth-return.md:42` and `:87` accurately make actual OAuth/OTP return routing plus browser/SSR session integration the first implementation follow-up. A local approval cannot substitute for that work or real provider qualification.

The removed lost-next fallback is also accurately disclosed: missing explicit next reaches dashboard instead of a previous invitation. Current headers and best-effort URL cleanup are not described as erasing upstream logs, historical URLs, or unchanged SDK behavior.

Inherited concerns remain independently visible: `docs/research/evidence/2026-10-19-auth-return/project-verify-20261019T033925Z.txt:61` and `:74` record unsupported/deprecated Next configuration and missing server configuration; research line 80 retains these limits and the historical 42-vulnerability audit (34 high, 8 moderate), which was not rerun or resolved. No new change to their underlying sources was found, so they are not new batch defects. Production permissions/adapters, migration/rollback, bucket/backup/provider-account and G1 device evidence remain incomplete under the original gates.

The Markdown PENDING statements and unchecked final plan items at this freeze are intentional controller-owned closure placeholders. The current machine summary already records the actual resumed Task 2 PASS/Approved result. After publishing this report, the controller should update only actual statuses, report references/hashes, next-step pointers and plan checkboxes, then repeat final integrity/link/reference checks. This review does not pre-certify future source/test mutations or grant new implementation scope.

**Ready for local batch closure: Yes, with the planned factual status publication and final controller integrity check. Ready to merge/push/release: No.** `milestone-check.json` correctly retains G0=false, G1=false, originalMilestoneReached=false and unchanged requirements. Preserve the branch, prior dirty work and recovery data; no commit, push, migration or deployment follows from this approval.

## Review identities and actions

- Binding specification SHA-256: `ddb030397f6ba513b6ead1ca11172d662d882fe8697b6e63b4c80a5916f917c6`.
- Authoritative v2 manifest SHA-256: `de95e42addbd8b7a49544851f7b3630d1cda42a3495b1cafc4a4ac576e399bc5`.
- Resume validation SHA-256: `e22164cd851acace588aee7ae78780e56e15a6071a250bc9a7f3e68c788f5c86`.
- Immutable pre-final integrity checkpoint SHA-256: `1b1f304536759200caa42fd4b3c337485218dab5202f0d73c955caa342e0aa67`.

Review actions were direct source/installed-SDK/diff/document/log inspection, in-memory diff reconstruction, local byte/hash/link checks and read-only Git identity/whitespace checks. No subagents, remote calls, source/test/document implementation edits, Git state changes, or test reruns were performed. The only authored file is this requested review report.

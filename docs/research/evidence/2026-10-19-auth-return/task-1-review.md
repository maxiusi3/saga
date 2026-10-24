# Task 1 independent spec and quality review

Reviewed 2026-10-19 in `/Users/eat/Documents/eatpotato/saga传奇` against the batch-start bytes, the binding auth-return specification (including both controller rulings), and the exact Task 1 brief. Branch: `codex/october-upgrade-p0`; HEAD: `1caa21a72a23d6f5166ed127847ca931374b890a`.

**Spec compliance: PASS.**

**Quality: Approved.** No open Critical, Important, or Minor task findings. One minor evidence-wording finding, M1, was corrected by the controller and independently verified before this report was finalized. Approval covers this scoped task; it does not clear the accepted compatibility release blocker, G0/G1, or authorize a commit/push/deployment.

## Review basis and scope preservation

- Read the binding spec, Task 1 brief, implementation report, and complete changed implementation/tests/fixture. Inspected original signin/callback/AuthProvider bytes directly rather than relying on the report or the accumulated HEAD diff.
- Independently recomputed the 1,696-file baseline: exactly the three approved existing application files changed; zero baseline files were missing and the other 1,693 were byte-identical at the audit. Each of the three saved before-file hashes matched its baseline entry.
- Reconstructed every one of the nine review-package diff sections against its before content; all resulting source lines matched the current files. Independently verified all nine authoritative v2 source hashes, then verified them again after the controller's M1 wording correction. No application, test, fixture, dependency, invitation, migration, or recorded raw-evidence edits were made by this reviewer.
- Inspected installed `@supabase/ssr` 0.10.2 and `@supabase/supabase-js` / `@supabase/auth-js` 2.105.3 source for server defaults, cookie application, INITIAL_SESSION loading, session response transformation, transport exception logging, and `skipBrowserRedirect` behavior. The loopback suite imports the actual route and SDK; its constructor spy delegates to the actual implementation and does not replace auth operations.

## Spec assessment

| Requirement | Assessment and source evidence |
| --- | --- |
| Small once-decoded target language | `packages/web/src/lib/auth-return.ts:11` reads exactly one `next`, rejects over 2,048 characters and forbidden bytes before matching exact dashboard/invitation forms, and derives all eight locales from existing config. Percent remnants, additional query fields, duplicate/nested targets, whitespace, slashes/dot-segment variants, fragments and injection forms fall back. Explicit valid locale prefixes are preserved. |
| Obsolete state is delete-only | Helper line 26 encloses both the storage getter and removal in the same best-effort catch. Signin line 56 and AuthProvider line 12 call it without reading a value or clearing other keys. Existing browser factory/store persistence is unchanged. |
| Safe explicit signin session return | Helper lines 38–63 require a complete future session, provider UUID matching `session.user.id`, nonempty token syntax, and unambiguous once-decoded credentials. The page delegates to `setSession`; it does not manufacture a user from JWT claims. Empty/error results use fixed text. |
| Async result ownership and StrictMode | Signin lines 47–99 check mounted status, flow identity, latest render context, and actual pathname/search/hash against the original or exact own-cleanup location. A reused promise prevents repeated page-owned session writes for the same context, including StrictMode and cleanup publication. Stale success/error/navigation is ignored. |
| Provider request formation | Signin lines 101–147 generate current-origin canonical-locale callback URLs from the validated target. Google explicitly disables SDK navigation, validates the configured authorize endpoint, provider and exact redirect URL, and navigates only while the captured flow is current. Installed SDK source confirms `skipBrowserRedirect` is honored. Errors use fixed messages. |
| Strict callback dispatch | Adapter lines 15–22 reject error presence, duplicated identity inputs, mixed modes, missing halves, invalid type and malformed/oversized credentials before client creation. Six email OTP types are supported. Only the public configuration is used. |
| Callback-local isolation and bounded real transport | Adapter lines 65–107 retain only PKCE verifier cookie values, keeping other names for stale-chunk deletion. The fetch wrapper permits at most one POST to the selected endpoint, disallows HTTP redirects/re-entry, and converts transport/body failures into a safe synthetic response before auth-js can log the original exception. One 10,000 ms deadline covers auth, fetch and body; caller abort and cleanup are wired through it. |
| Session/cookie/response outcome | Adapter lines 7–13 and 108–111 gate success on verified complete data, issue HTTP 303 with no HTML/script, preserve SDK cookie writes/options on success, and retain only explicit deletion writes on failure. Serialization/config exceptions safely redirect; all callback responses use no-store/no-referrer and a safe target. No extra session lookup or credential replay is introduced. |

The helper's broad opaque code/token_hash input predicate remains distinct from its output token predicate. The 4,096-character URL credential bound is not imposed on returned session tokens; the real SDK suite exercises an 8,000-character token and cookie chunking.

## Quality and evidence assessment

The split between the pure shared contract and the focused server adapter is appropriate for this batch. The component's flow bookkeeping serves concrete URL-cleanup, effect-replay and stale-result requirements. No unrelated generalization or existing-file scope expansion was found. The touched paths contain no raw console/error reflection or inline callback scripts.

The recorded checks were inspected, not blindly inferred from the implementation report:

- `red-existing-behavior.txt` records two failed suites / five failed tests and npm exit 1 against the original behavior. It demonstrates absent legacy-key cleanup, raw error/full callback URL disclosure, push navigation and missing response privacy properties. Original RED test sources remain present.
- The initial missing-helper/harness failures are explicitly separated from behavioral RED. The opaque-input/long-session failures and the 16 native-context/output-token RED/GREEN cases remain preserved.
- `final-v2-focused-and-invitation-regressions.txt` records eight suites / 430 tests passing, none skipped, exit 0: 177 focused new cases plus 253 prior invitation cases. `final-v2-typecheck.txt` and `final-v2-scoped-lint.txt` each record exit 0.
- Component tests mount actual signin/AuthProvider with SDK/router/store boundaries replaced. Their assertions cover calls, navigation, safe messages, cleanup, native URL changes without rerender, and effect reuse. These are component evidence, not live browser/provider qualification.
- The actual SDK loopback suite covers PKCE, all six OTP types, zero-call input rejection, future/complete output, returned token syntax, chunks/stale deletions/options, failed serialization, expired-cookie isolation, transport/body faults, HTTP redirect refusal, abort and 10-second deadline disposal. Teardown closes held responses and sockets before privacy assertions, restores environment/spies/timers in `finally`, and asserts zero remaining handles owned by the fixture. This avoids a privacy assertion bypassing cleanup.

No blanket rerun of the already-passed suites was performed by this reviewer. Review verification consisted of direct source/SDK inspection, baseline and manifest recomputation, diff reconstruction, raw-evidence inspection, and a small in-memory JavaScript regex edge check that revealed no defect. There were no temporary source probes, remote Auth requests, mail, paid calls, real-family data access, commits, pushes or deployments. Controller-owned full-project validation and final batch review remain separate acceptance steps.

## Findings

### Critical

None.

### Important

None within the updated binding task scope.

### Minor

**M1 — Evidence wording conflated executed RED with source inspection — addressed.**

- Location: `.superpowers/sdd/2026-10-19-upgrade-auth-return/task-1-report.md:29` and its published evidence copy, `docs/research/evidence/2026-10-19-auth-return/task-1-report.md:29`.
- Original impact: the phrase “logged complete callback URL/code/error sentinels” overstated what the initial five-test RED executed. The retained callback RED source sends `error` and `error_description`, with no `code`; the raw callback output has `code: null`. Old-source inspection does independently show code/token_hash logging.
- Concrete fix: distinguish observed full-URL/error disclosure from code/token_hash logging found by inspecting the original source; do not claim an executed code-sentinel disclosure probe.
- Resolution: controller made exactly that one-paragraph wording correction in both report copies. Reviewer compared the preserved original `.superpowers/sdd/2026-10-19-upgrade-auth-return/task-1-report-before-M1.md` with the current report, confirmed the copies are byte-identical, and rechecked all nine application/test/fixture hashes unchanged. No application rerun is warranted for this text-only correction.

## Accepted release blockers and limits

**RB1 — OPEN, accepted by binding spec line 31; not a new Task 1 defect.** The shared browser client still defaults to implicit flow and localStorage persistence. A fragment-only provider return reaching the server callback cannot be read there; the fixed error plus inherited fragment is now rejected by signin. The retained compatibility probe actually mounts before/current page implementations and records before `setSession=1/navigation=1`, current `0/0` with cleaned fragment. It mocks SDK/router boundaries, so it demonstrates the page compatibility change rather than a real browser/provider redirect chain. The current report states that limit accurately. Actual OAuth/OTP return paths and browser/SSR session consistency must be resolved/qualified before release. Do not relabel this review as end-to-end login success or expand this task into an unapproved global auth migration.

The intentionally removed lost-`next` fallback is also stated accurately: missing explicit next returns to dashboard instead of recovering an earlier invitation. Response headers and page cleanup do not erase upstream logs, browser history already written, or automatic behavior of the unchanged shared client. G0/G1 remain false; this local task is not an original upgrade milestone.

## Checked SHA-256 identities

All paths below are relative to the workspace root stated above.

| Frozen source | SHA-256 |
| --- | --- |
| `packages/web/src/app/[locale]/auth/signin/page.tsx` | `9f80568c5ac5a2ec34c5a807f6c73b64878ca804bdb8bcdba9e2ee124fa5e14b` |
| `packages/web/src/app/[locale]/auth/callback/route.ts` | `f838b99171a76d5fc8c9d6d6d326ae0b7938bafb9145e39aaf6d75983cba0232` |
| `packages/web/src/components/auth/auth-provider.tsx` | `7e6735667b3fd76990f4dc976e37f09cc8a09840920e9f17da698fdd6b6a0987` |
| `packages/web/src/lib/auth-return.ts` | `6339af4dac4ac49aafcf3e44ae3b0859870e7e00892f73bef04439de1a7e0d6c` |
| `packages/web/src/lib/server/auth-callback.ts` | `b6d0046c0d757c3a58e21be23aa57371ee901d23b27b084871acb8633fadc7b5` |
| `packages/web/src/lib/__tests__/auth-return.test.ts` | `6fd29b11f4a3259dd34f47d96d8f4a4d864340cf1d656a1755c4b4610a68700e` |
| `packages/web/src/lib/server/__tests__/auth-callback.test.ts` | `48760fbbec9c7ad8531e3bc77f27da06691f9710ecd21f029b810e834e955aa8` |
| `packages/web/src/lib/server/test-support/auth-callback-fixture.ts` | `8ae2608bc5bc39e4ba643fe810ab2fc4d96d25ae89d54123645a7f80bcf9840e` |
| `packages/web/src/components/auth/__tests__/auth-signin-return.test.tsx` | `af8b9bc68ede1793263f203b3f38e797200b4067f15f8465138ca06b4225cd0b` |

| Review/evidence input | SHA-256 |
| --- | --- |
| Binding spec `docs/superpowers/specs/2026-10-19-auth-return.md` | `ddb030397f6ba513b6ead1ca11172d662d882fe8697b6e63b4c80a5916f917c6` |
| Task 1 brief | `8a379433e350eb06e29bd94608a559f08ee456cb16bb103be97669761e14ea62` |
| `baseline.json` | `f324895e30aaec37bfba8970e7a204261fe52c60e82e369bb427651ac2c4b0a0` |
| `app-review-package-20261019T033849Z.md` | `c9dcf14c1a968e5ae18ce269e8bb2fa14ccb4496519a19f8a7f1c3d4fd1fe2bd` |
| `final-source-sha256-v2.txt` | `de95e42addbd8b7a49544851f7b3630d1cda42a3495b1cafc4a4ac576e399bc5` |
| `final-v2-focused-and-invitation-regressions.txt` | `c58c38f84222b175c57df25bb3a15fb9a45dbe9696192c8d65e1af9922192f13` |
| `final-v2-typecheck.txt` | `73239f05a6612b3c62c1a1f0c57dbb0bd2b1cba12fca2be9de3109b638e6b706` |
| `final-v2-scoped-lint.txt` | `71af0502abdb2f7f2ed653ea0d522ac2a021e4e4963af8bd78a3e603e0b17f8c` |
| `implicit-fragment-compatibility-probe.txt` | `2e20e9404558847211ea6489d58ae608e0c50b833c068c50863a1feadfb9ff6a` |
| Preserved pre-M1 Task 1 report | `040fb50a9600626d048a3b3de702d5bd09e6c7ff6d41e69744407ddd8516de88` |
| Corrected current Task 1 report (both copies) | `be232956ff434ca1f71a9520ece54eedbf5e9ac95052dfdf9acf774a7a55c48f` |

Task 1 is ready for the controller's evidence/handoff work and final independent batch review at the checked source identities. Full-project validation is controller-owned and is not re-certified by this task review. RB1 remains open regardless of those local results.

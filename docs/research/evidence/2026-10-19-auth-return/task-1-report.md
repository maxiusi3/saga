# Task 1 implementation report

**Status: DONE_WITH_CONCERNS — ready for controller-owned independent review.**

Task 1's scoped implementation and local checks are complete. A concrete implicit-flow compatibility change remains a **release blocker**; this is not a claim that Google/OTP works end to end. No full project verify, commit, push, migration, deployment, remote Auth, real-family access, mail, or paid provider was run.

## Scope and resulting behavior

Changed exactly the three preapproved existing application files: signin page, callback route, AuthProvider. Added the shared helper, focused server adapter, three focused test files, and a new synthetic loopback fixture. The 1,696-file baseline comparison found only those three existing files changed and zero missing files; the other 1,693 baseline files remain byte-identical. Old invitation sources, protocol, tests, fixtures, dependencies, experiments, root migrations, and older evidence were not edited.

- Shared once-decoded `next` contract covers all eight locales, dashboard ASCII segments, canonical invitation token routes, and the exact accept-invitation token query. Missing, duplicate, unsupported, injected, encoded-again, or oversized targets fall back to the canonical current-locale dashboard.
- Signin and AuthProvider delete only `auth_next`, best effort around both storage getter and removal. Neither reads/writes a fallback target or changes browser factory/store persistence.
- Signin parses explicit query/fragment session credentials once, rejects duplicate/ambiguous/malformed inputs, delegates authentication to `setSession`, requires a complete future-expiring session and matching UUID provider user, and uses `router.replace` for safe application navigation. No JWT is decoded into a user locally. Error messages are fixed; URLs are cleaned to canonical `next` with best-effort replaceState.
- In-memory attempt reuse prevents page-owned duplicate session writes under StrictMode and cleanup search-param publication. Mounted/flow/render-snapshot guards ignore late session/provider results on unmount, locale/target changes, and same-target credential/query changes.
- Google uses the installed SDK's `skipBrowserRedirect: true`; the page validates the returned configured-origin authorize endpoint, single google provider and exact safe callback URL before current-attempt navigation. This addresses SDK-owned redirects happening before an awaited response. Email keeps the existing OTP request entry and safe callback target.
- Callback parses strict mutually exclusive code or token_hash/type input before creating the actual SSR client. Code/token_hash are opaque nonempty strings, maximum 4,096, rejecting whitespace/control characters without second decoding. Six existing email token types are supported. Verified output session tokens are not incorrectly limited by the URL-input length bound.
- Actual `@supabase/ssr` 0.10.2 and `@supabase/supabase-js`/`auth-js` 2.105.3 receive only public URL/anon key and callback-local request cookies. The binding spec's controller-added `INITIAL_SESSION` isolation ruling is implemented: previous session-cookie **names** remain available for stale-chunk deletion, but their **values** are withheld; only exact PKCE verifier cookie/chunk values are supplied. An expired incoming session therefore cannot trigger implicit refresh or act as fallback credentials. The browser factory/store remain unchanged.
- Callback transport allows one actual POST to only the selected auth endpoint, refuses re-entry/other endpoints and HTTP redirects, shares one ten-second deadline over operation/fetch/body, observes caller abort, and cleans timer/listeners. Transport/body failures become a fixed synthetic HTTP error before reaching SDK logging paths. No retries, mode fallback, extra getSession/getUser, or raw logs.
- Standard HTTP 303 replaces HTML/script navigation. Success retains actual SDK cookie chunks and per-cookie options. Failed/incomplete results retain only explicit SDK deletion cookies; cookie read/serialization failures produce safe redirects. Every response carries `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.

## Evidence, failures retained, and exact commands

All raw output is in `docs/research/evidence/2026-10-19-auth-return/` as `.txt`. Each subsequent run records its command and exit in the file. The initial raw npm output records npm error code 1; its shell also displayed the captured file, so the surrounding shell exit was 0, not the test exit.

1. **Actual unchanged-source behavioral RED**: `red-existing-behavior.txt`. Command:

   `npm test --workspace=@saga/web -- --runInBand --runTestsByPath src/components/auth/__tests__/auth-signin-return.test.tsx src/lib/server/__tests__/auth-callback.test.ts`

   Jest/npm exit **1**, **2 failed suites / 5 failed tests**. Old code demonstrably omitted obsolete-key deletion, reflected raw signin error, used push, logged the full callback URL and raw error sentinels, reflected error_description, and returned 307 without privacy headers. Old-source inspection also found code/token_hash logging; this initial five-test RED did not execute a code-sentinel disclosure case. Original test bytes are retained as `red-existing-signin-test-source.txt` and `red-existing-callback-test-source.txt`; original application bytes remain in controller recovery `before/`.

2. `red-contract-tests.txt`: expanded helper/React tests, npm exit **1**. This includes the initially missing helper module and therefore is **not** described as wholly behavioral RED. `first-implementation-tests.txt`: **57 failed / 77 passed**, exit **1**, due to a test-only attempt to spy on the SDK's nonconfigurable export. That harness issue was fixed by observing the actual underlying exported constructor without replacing SDK/auth implementations. `callback-fixture-run-2.txt` then passed **57 callback tests**, exit **0**.

3. `red-opaque-and-long-session.txt`: **2 failed / 103 passed**, exit **1**. Actual covering failures exposed an unnecessarily narrow opaque callback-code alphabet and an output-session token limit conflated with the input URL limit. Both restrictions were corrected. `focused-tests-run-3.txt` subsequently passed **3 suites / 158 tests**, exit **0**; further callback body/redirect/PKCE-chunk cases were then added and checked.

4. Earlier complete combined run `focused-and-invitation-regressions-run-1.txt`: **8 suites / 411 tests passed**, exit **0**. `typecheck-run-1.txt` failed exit **2** for a callback-input union inference issue; adding an explicit union return type fixed it. `scoped-lint-run-1.txt` passed exit **0**. These intermediate artifacts remain intact.

5. **Earlier source-freeze attempt, superseded by v2 below**: `final-focused-and-invitation-regressions.txt`, exit **0**, **8 suites / 414 tests passed**. Exact command:

   `npm test --workspace=@saga/web -- --runInBand --runTestsByPath src/lib/__tests__/auth-return.test.ts src/components/auth/__tests__/auth-signin-return.test.tsx src/lib/server/__tests__/auth-callback.test.ts src/lib/server/__tests__/invitation-read-routes.test.ts src/lib/server/__tests__/invitation-acceptance.test.ts src/lib/__tests__/invitation-acceptance-client.test.ts src/lib/__tests__/invitation-acceptance-protocol.test.ts src/components/invitations/__tests__/invitation-recipient.test.tsx`

   This covers the new helper/actual component/actual SDK suites plus the previous invitation read routes, acceptance routes, client, protocol, and mounted recipient regressions. Loopback fixtures close held responses, sockets and servers in teardown even on privacy assertion failures.

6. **Earlier typecheck**: `final-typecheck.txt`, command `npm run type-check --workspace=@saga/web`, exit **0**.

7. **Earlier scoped lint**: `final-scoped-lint.txt`, run from `packages/web`, exit **0**, no warnings/errors. Exact command:

   `../../node_modules/.bin/eslint src/lib/auth-return.ts src/lib/server/auth-callback.ts src/app/[locale]/auth/callback/route.ts src/app/[locale]/auth/signin/page.tsx src/components/auth/auth-provider.tsx src/lib/__tests__/auth-return.test.ts src/lib/server/__tests__/auth-callback.test.ts src/lib/server/test-support/auth-callback-fixture.ts src/components/auth/__tests__/auth-signin-return.test.tsx`

   Commands were passed as process argument arrays, so bracket paths were not shell-expanded. Scoped `git diff --check` also returned exit **0**.

8. **Earlier source SHA-256**: `final-source-sha256.txt` contains all nine source/test/fixture paths and hashes plus actual SDK versions. This provisional freeze was reopened for the two concrete self-review fixes recorded below; the original manifest and outputs remain preserved.

## Final self-review fixes and revised source freeze

Controller-assisted final self-review identified two additional real defects before independent review: output session tokens could be whitespace/malformed after removal of the overly narrow length limit, and a native history/hash change could precede React publishing a new render snapshot. Both were reproduced before fixing:

- `red-native-context-and-session-tokens.txt`: **3 suites / 16 selected tests failed**, 161 filtered out, npm exit **1**.
- `green-native-context-and-session-tokens.txt`: the same **16 selected tests pass**, 161 filtered out, exit **0**.

Exact covering command:

`npm test --workspace=@saga/web -- --runInBand --runTestsByPath src/lib/__tests__/auth-return.test.ts src/components/auth/__tests__/auth-signin-return.test.tsx src/lib/server/__tests__/auth-callback.test.ts --testNamePattern 'malformed output session token|actual URL context change'`

The output-session token predicate now rejects whitespace, controls, percent/HTML and other malformed token syntax while supporting long tokens (8,000 characters exercised). Opaque callback **input code/token_hash** still use the broader contract of nonempty, bounded, no whitespace/control, once-decoded; their language was not narrowed again. Actual SDK callback tests verify malformed token responses do not publish session cookies.

Async completion now checks both the latest render snapshot and the **actual current pathname/search/hash**. Only the captured original location or that flow's exact own cleanup location qualifies. This preserves best-effort history failure behavior while rejecting native target, credential, fragment or locale/path changes even without rerender. Current Google navigation is checked the same way.

**Final revised frozen verification**, all exit **0**:

- `final-v2-focused-and-invitation-regressions.txt`: **8 suites / 430 tests passed**, none skipped. Exact command is the same eight-suite command in item 5 above (177 new focused cases plus 253 prior invitation cases).
- `final-v2-typecheck.txt`: `npm run type-check --workspace=@saga/web`, exit **0**.
- `final-v2-scoped-lint.txt`: exact nine-file eslint command in item 7 above, exit **0**, no warnings/errors.
- Scoped `git diff --check` repeated successfully, exit **0**.

**Authoritative final source manifest: `final-source-sha256-v2.txt`.** It supersedes the preserved provisional manifest. No implementation edits followed this revised verification. The final report retains status DONE_WITH_CONCERNS because of the concrete compatibility release blocker below.

## Concrete compatibility concern / release blocker

The shared `createClientSupabase` is still plain supabase-js with default implicit flow and browser localStorage persistence. A provider can return `#access_token`/`refresh_token` to callback; the server cannot read fragments and, with no code/token_hash, returns a fixed `error=auth_failed` signin redirect. In a redirect flow where the fragment is inherited, signin now intentionally rejects the error-plus-credentials input and clears it.

This is an observed **scoped compatibility change**, not merely an untested provider assumption. A recovery-only probe compiled the immutable original signin bytes without swapping current source, then mounted both versions with the same synthetic error-plus-fragment URL and replaced SDK/router boundaries:

- Before: `setSession` **1** call, navigation **1**.
- Current: `setSession` **0** calls, navigation **0**, fragment cleaned, fixed safe error shown.

Raw result: `implicit-fragment-compatibility-probe.txt`, **1 probe test passed**, exit **0**. Reproduction source is retained at `.superpowers/sdd/2026-10-19-upgrade-auth-return/compatibility-probe.test.tsx` and published evidence copy `implicit-fragment-compatibility-probe-source.txt`. The probe runner copied it temporarily to `packages/web/src/components/auth/__tests__/auth-return-compatibility-probe.test.tsx`, ran `npm test --workspace=@saga/web -- --runInBand --runTestsByPath src/components/auth/__tests__/auth-return-compatibility-probe.test.tsx`, and removed that temporary copy in `finally`.

This probe establishes page behavior for the inherited-fragment scenario; it does not claim a real browser/provider redirect integration run. Google/OTP entry controls and request formation are retained, and explicit **clean** signin session-return is tested. End-to-end provider compatibility, factory automatic URL handling, server/browser cookie/localStorage consistency, and real-provider qualification remain unresolved. The controller explicitly added this compatibility change/release blocker to the binding spec and will carry it into handoff. G0/G1 remain false. No change was made to shared browser auth architecture to hide this boundary.

Deleting `auth_next` also intentionally removes lost-next recovery: if a provider loses explicit next, signin falls back to dashboard instead of guessing a previous invitation.

## Self-review and controller handoff

Self-review checked the target language, decoded-input boundaries, all raw-log/error-reflection paths, failure cookie filtering, no extra SDK/network operations, expired request-cookie isolation, timer/listener disposal, StrictMode reuse, provider-owned redirect removal, and full render-context invalidation. Tests exercise actual SSR/JS transport and actual mounted signin/AuthProvider with only external boundaries replaced. No known unresolved implementation defect was found within the updated binding scope; the implicit-fragment compatibility release blocker above remains deliberately open.

Controller next: independent spec/quality review and required review fixes, then source freeze/full project verify/shared/infra, evidence indexing and handoff/plan updates. This local task pass is not a production milestone and does not authorize push/deployment.

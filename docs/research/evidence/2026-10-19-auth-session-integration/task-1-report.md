# Task 1 implementation report

Status: DONE_WITH_CONCERNS (implementation and focused verification complete; controller owns independent review/full-project validation and real provider/deployment qualification).

Scope is measured against this batch's before bytes, not the accumulated dirty HEAD diff. HEAD remains `1caa21a72a23d6f5166ed127847ca931374b890a` on `codex/october-upgrade-p0`. No commits, pushes, dependency edits, migrations, external Auth/mail requests or business-data operations were performed.

## Final scope and source freeze

`docs/research/evidence/2026-10-19-auth-session-integration/source-freeze.json` contains SHA-256 for every changed/new application or script path, plus separate existing/new lists. All 17 paths were checked against those hashes after final verification; browser inputs were independently checked against `browser-results.json.sourceHashes`. No application/source edits followed that check.

Seven existing paths changed:

- `packages/web/src/lib/supabase.ts`: installed SSR browser PKCE/cookie client, URL auto-detection disabled, per-browser singleton, exact legacy authentication storage deletion, complete failing auth stub, isolated nonpersistent server clients, no configuration logging.
- `packages/web/src/stores/auth-store.ts`: no persisted authenticated UI state; initial loading/unknown state, single listener before session resolution, coalesced initialization, provider `getUser(access_token)` confirmation, operation generations, deferred event verification outside SDK callbacks, serialized explicit SDK writes for signin/signout ordering, safe failures and current token validation.
- `packages/web/src/stores/__tests__/auth-store.test.ts`: preserved substantive success/error behavior; success fixtures now contain complete sessions and provider user confirmation. Errors assert safe fixed output instead of raw provider strings.
- `packages/web/src/lib/server/auth.ts`: public-key Bearer verification, strict explicit-Authorization mode, cookie `getAll`/`setAll` with full options and arbitrary chunks, provider identity, bounded transport with ten-second total deadline/caller abort, no provider-error logging or retrying transport failures.
- `packages/web/src/app/[locale]/auth/verify/page.tsx`: complete verified-session predicate, numeric input, explicit safe next, same next on resend, single active submit, lifecycle/context/location invalidation.
- `packages/web/src/app/[locale]/page.tsx`: no credential forwarding; misplaced auth input cleaned and fixed signin error. Controller ruling preserves exactly one bare query `type=invite`, with no fragment/other parameter, as original-link guidance using the existing accept-invitation page. It performs no authentication/discovery.
- `packages/web/middleware.ts`: removes obsolete hard-coded malformed-domain rewrite and delegates normal locale handling.

Ten new paths:

- `packages/web/src/lib/__tests__/supabase-session.test.ts`
- `packages/web/src/lib/__tests__/supabase-server-isolation.test.ts`
- `packages/web/src/stores/__tests__/auth-session-lifecycle.test.ts`
- `packages/web/src/lib/server/__tests__/auth-session-guard.test.ts`
- `packages/web/src/lib/server/__tests__/auth-locale-middleware.test.ts`
- `packages/web/src/components/auth/__tests__/auth-verify-session.test.tsx`
- `packages/web/src/components/auth/__tests__/home-auth-landing.test.tsx`
- `scripts/test-support/auth-session-fixture.cjs`
- `scripts/test-support/auth-session-ts-loader.cjs`
- `scripts/verify-auth-session-browser.cjs`

No changes to existing signin/auth-provider/auth-return/callback source were necessary. Existing invitation tests and business modules remain byte-identical to the batch baseline. Old evidence remains unchanged. This report and all new evidence are in this batch's designated locations.

## Installed SDK trace and design

Versions are recorded in `runtime-versions.json`: Node 22.22.2, `@supabase/ssr` 0.10.2, supabase-js/auth-js 2.105.3, Playwright 1.59.1, Next 16.4.1, TypeScript 5.9.3.

Read the installed `createBrowserClient.ts`, `createServerClient.ts`, auth-js `GoTrueClient.ts` and PKCE helpers. SSR browser factory enforces `flowType: pkce`, default base64url chunked cookie storage, and browser singleton; setting `auth.detectSessionInUrl: false` overrides its browser detection default. Its storage key matches existing callback's hostname-derived `sb-…-auth-token`, including `-code-verifier`. `getUser(jwt)` performs provider verification without re-entering the local session lock; store event validation is nevertheless deferred to a timer after callback return. Server SDK can refresh while resolving stored session, so guard transport permits at most one refresh POST plus one user GET and rejects unexpected/repeated dispatches.

The old localStorage SDK token, verifier and `auth-store` are removed only by exact project keys, best effort. They are never read/imported. Business/draft storage stays intact. Existing cookie sessions recover via SDK and provider validation; legacy localStorage-only users must sign in again.

AuthProvider and dashboard duplicate initialization calls now share a single initialized promise/listener. Initial state remains loading until validation; listeners invalidate earlier work. Signout invalidates UI immediately and serializes SDK cookie writes behind pending password/signup requests, preventing their late response from restoring a session after signout. Access-token validation also gets a generation, preventing an older verification from restoring identity after a newer missing-session observation.

## Actual RED and retained intermediate evidence

Every log below is retained under `docs/research/evidence/2026-10-19-auth-session-integration/`. RED test source snapshots are in `red-source/`.

- `red.log`: 3 suites failed, 12 failed / 1 passed. Actual old factory returned OAuth without PKCE challenge/cookie, retained old storage; old store trusted cached identity/rehydration and subscribed late; numeric OTP accepted empty session and navigated after context/unmount.
- `red-guard-home.log`: 2 suites failed, 6 failed / 2 passed. Public Bearer depended on service role, request cookies not consumed as required, and homepage retained/forwarded credentials.
- `green-attempt-1.log`: 1 failed / 28 passed. jsdom lacked `TextEncoder`; real SDK emitted its WebCrypto/plain challenge warning. Test-only Node TextEncoder/WebCrypto setup fixed environment realism; warning was not hidden. `green-core.log`: 29 passed.
- `expanded-attempt-1.log`: 3 suites / 26 tests passed, including real ten-second stalled-body deadline and synthetic-provider guard checks.
- `red-self-review.log`: 2 failed / 10 passed. Empty current session left UI authenticated; an SDK signin event could cause the action to resolve despite failed provider verification. `green-self-review.log`: 3 suites / 31 passed after fixes.
- `browser-attempt-1.log`, `browser-attempt-2.log`: first bridge attempts reached callback but standalone NextRequest normalized `127.0.0.1` to `localhost`; the browser network allowlist correctly blocked the changed-origin bundle. Both logs contain owned-resource cleanup. The test bridge now explicitly sets Next's `__NEXT_NO_MIDDLEWARE_URL_NORMALIZE` to retain its real loopback origin. This is a harness adaptation, not an application/deployment configuration change.
- `browser-attempt-3.log`: first complete 14-check browser success. `browser-before-token-race-fix.log` and corresponding JSON preserve later successful pre-final source verification.
- `focused-final-attempt-1.log`: 16 passed suites; one middleware test could not load framework ESM in Jest, plus the existing bare invite guidance assertion failed. Middleware unit now explicitly tests project delegation at a mocked next-intl boundary; it does not claim to retest next-intl itself.
- `focused-before-home-ruling.log`: 17 suites passed, only the existing bare invite guidance failed. Controller clarified the binding specification to preserve this exact unauthenticated guidance; existing invitation test was not edited.
- `red-home-guidance.log`: 1 failed / 8 passed for the explicit new bare-guidance boundary. New mixed/duplicate/error/credential variants remain fixed-error reauthentication.
- `red-token-race.log`: 1 failed / 12 passed; a late access-token verification returned an old token after a newer missing-session observation. `focused-before-token-race-fix.log` also preserved that actual failure (504 passed, 1 failed). Each access-token verification now increments the generation.
- `typecheck-attempt-1.log`: earlier successful typecheck.

## Final checks on frozen source

All final command processes were observed to exit 0.

1. Focused auth and existing invitation regressions: **18 suites, 505 tests passed**, zero snapshots; `focused-final.log`.

```sh
npm test --workspace=packages/web -- --runInBand auth-session auth-store auth-return auth-callback auth-signin-return auth-verify-session home-auth-landing supabase-session supabase-server-isolation auth-locale-middleware invitation
```

2. Browser/actual SDK/server integration: **14 checks passed**; `browser-final.log`, `browser-results.json`, `browser-session.png`, `browser-cleanup.json`.

```sh
NEXT_TELEMETRY_DISABLED=1 node scripts/verify-auth-session-browser.cjs
```

3. `npm run type-check --workspace=packages/web`: passed; `typecheck-final.log`.
4. Scoped ESLint with `ESLINT_USE_FLAT_CONFIG=true node_modules/.bin/eslint`, naming all 17 changed/new source files in `source-freeze.json`: passed; `lint-final.log` (empty successful output). The repository's flat config has permissive rules; this is not presented as a strong semantic quality gate.

No full `npm run verify`, shared or infra verification was run by this worker. Controller owns these after independent review.

## Browser proof and exact boundary

The harness bundles actual project browser factory and store with installed webpack/TypeScript. A synthetic HTML bridge shows actual store state and uses real Chromium navigation/cookies. Its local HTTP adapter invokes actual `handleAuthCallback` and `getAuthenticatedUser` with NextRequest. It is **not a full Next-rendered/deployed application test**. Actual React OTP/home/signin and invitation page behavior is covered separately by component regressions with explicit mocked auth/router boundaries.

The local synthetic Auth fixture validates the browser's S256 verifier against the challenge recorded during OAuth/mail initiation; it does not accept arbitrary exchanges unconditionally. It consumes each code once, issues synthetic sessions, validates synthetic access/refresh tokens, supports numeric OTP and token_hash, and rejects invalid tokens.

Final chain checks:

- Mixed error/token URL causes no automatic browser session/exchange.
- OAuth produces S256 and browser verifier cookie.
- Browser follows synthetic authorize → actual server callback 303 → explicit safe locale destination.
- New page/bundle reads callback cookies; actual store validates provider user and authenticates the same synthetic identity.
- Callback consumes verifier and performs exactly one PKCE exchange.
- Cookie guard and public Bearer guard agree; invalid explicit Bearer cannot borrow cookie identity.
- Browser signout removes shared session; next SSR request rejects.
- Mail initiation carries S256/verifier; email code and token_hash returns restore browser/SSR identity.
- Browser numeric OTP writes cookies recognized by store/SSR.
- Missing verifier and mixed callback fail without exchange.
- Page requests stay on the exact fixture loopback origin; service workers blocked, non-loopback requests denied, telemetry disabled. Final blocked request count is zero.

Expected browser diagnostics are retained: two resource 401 console messages for deliberately invalid Bearer and post-signout guard probes. There were no hidden/muted SDK warnings in the successful real browser run.

Cleanup verified: owned fixture `listening=false`, sockets `0`; owned browser disconnected; owned temporary bundle directory removed. No arbitrary processes or ports were killed. `next-env.d.ts` was unchanged, and matches saved before bytes with SHA-256 `7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651`. Harness can restore its own captured bytes on change. Final browser source hashes and all source-freeze hashes match current source.

## Self-review, rulings and concerns

- Binding callback protections remain unchanged: strict inputs, one selected exchange, verifier-only request session reading, safe next, cookie-preserving 303 and deadline.
- Public guard verifies actual provider response and never trusts cookie's user claim. Tests cover forged cookie identity, invalid explicit Bearer, refresh, deletion, chunks beyond five, safe transport failure, abort and ten-second body deadline.
- Store positive identity is provider-confirmed; listener is singleton for application lifetime rather than added per component mount. Unit tests cover concurrent initialize, older session/provider failure, new identity, signout, confirmation-email outcome, provider mismatch, and token races.
- Numeric OTP has complete session criteria, safe next, numeric-only input, duplicate submission guard, unmount/current-URL/current-query invalidation and safe resend callback. Existing strict signin behavior remains intact.
- Controller ruling: exact bare `?type=invite` carries no credential and only reaches original-link guidance. All other auth-shaped homepage inputs use cleanup/fixed signin error. Cost if this exception is later removed: one small homepage branch and matching boundary tests can be deleted; no invitation acceptance logic depends on it.
- Local RB1 browser/session/cookie cause is addressed and actual SDK plus synthetic browser/server chain passes. **Live Google authorization, SMTP, Supabase JWT signature/RLS/PostgREST, production domain/redirect settings, production deployment and real-device qualification remain unproven.** This local result must not close production authentication gates or G0/G1 requirements. Handoff can move to the next independent local source/event task without repeating this completed local integration batch.
- Independent task/spec/quality review is controller-owned and pending at handoff. No worker subagents were spawned. Source stays frozen pending controller findings.

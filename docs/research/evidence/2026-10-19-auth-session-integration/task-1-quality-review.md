# Task 1 independent code quality review

Reviewed 2026-10-19 on `codex/october-upgrade-p0`, HEAD `1caa21a72a23d6f5166ed127847ca931374b890a`. Scope is this batch's seven changed existing paths and eleven new paths, compared with recovery `baseline.json`/`before/` and `app-review-package-20261019T121337Z.md`, with current bytes checked against `fix1/source-freeze-fix1.json`. The binding specification, implementation/fix reports, both specification reviews, actual changed source/tests/scripts, installed SDK behavior, and relevant existing consumers were inspected independently. Earlier approvals were not treated as proof of quality.

Three blocking findings remain: one P1 and two P2. No P0 finding or additional cosmetic finding is reported.

## Strengths

- The cookie-backed PKCE facade preserves the existing public entry point, disables automatic URL credential handling, isolates server rendering, removes only exact legacy auth storage keys, and gives preview auth methods explicit failures. The browser error boundary preserves successful response data and non-Auth behavior while preventing raw recovery diagnostics from reaching SDK logs.
- Provider confirmation, deferred listener work, serialized explicit credential mutations, and generation checks substantially improve identity correctness. The fix1 positive concurrent-read test complements retained logout, identity-change, missing-session, mismatch and rejection tests.
- The request guard correctly distinguishes explicit Authorization from cookie fallback, uses public credentials, verifies provider identity, consumes arbitrary cookie chunks, and limits actual transport work to a ten-second deadline. Callback and strict signin protections remain unchanged.
- The synthetic Chromium bridge really uses the installed SDK and production facade/store/callback/guard. Its S256 verifier checking, single-use codes, cookie restoration, negative cases and cleanup are meaningful. The reports accurately distinguish this bridge from production Next, live Google/SMTP and JWT/RLS qualification.

## P1 — Same-session authentication events unmount active dashboard work

**Location:** `packages/web/src/stores/auth-store.ts:56–62`, especially unconditional `clear(!!session)` at line 59.

**Trigger:** An already provider-confirmed user returns to a visible browser tab, or a token refresh completes. Installed auth-js calls `_recoverAndRefresh()` on browser visibility recovery and emits `SIGNED_IN` even for the unchanged valid session (`node_modules/@supabase/auth-js/src/GoTrueClient.ts:4648`, `:5105`). The listener immediately publishes `user=null`, `isAuthenticated=false`, `isLoading=true`, then waits for deferred provider verification.

**Consequence:** `packages/web/src/app/[locale]/dashboard/layout.tsx:61–67` replaces its entire child subtree with a spinner. All dashboard component state is destroyed even though the user and session remain valid. For the main recording flow, `packages/web/src/components/recording/SmartRecorder.tsx:479–481` invokes cancellation on unmount; lines 439–457 stop the recorder/tracks and interrupt the local session. A normal tab return or background token renewal can therefore stop a recording and reset active page state. The recording recovery mechanism does not make this interruption appropriate.

**Independent reproduction:** The reviewer probe uses the actual installed SDK, production facade/store and actual `DashboardLayout`, with a synthetic stateful child and mocked display dependencies/Auth fetch. A browser `visibilitychange` event, with no identity/token change, changes child mounts/unmounts from `1/0` to `1/1`; successful provider confirmation then changes them to `2/1`. The same user is authenticated before and after. No synthetic auth listener was manually invoked. See `docs/research/evidence/2026-10-19-auth-session-integration/quality-event-refresh-probe.json` (`before`, `during`, `after`). Real audio was not recorded; the capture consequence follows the inspected existing cleanup code.

**Minimum fix:** Treat revalidation of the already confirmed same identity separately from initial loading, logout and identity replacement. Keep the mounted dashboard subtree stable during successful same-user recovery/refresh, while still clearing identity on provider rejection and immediately invalidating work when identity actually changes. Add a regression through the dashboard boundary proving same-session `SIGNED_IN` and `TOKEN_REFRESHED` do not unmount an active child; retain the rejection/signout/new-user protections.

## P2 — A successful SDK refresh makes the public token getter return null

**Location:** `packages/web/src/stores/auth-store.ts:143–146`, interacting with the listener's generation increment at line 58.

**Trigger:** `getAccessToken()` begins from an authenticated state and its `auth().getSession()` discovers a session that needs refresh. The installed SDK successfully refreshes and emits `TOKEN_REFRESHED` before `getSession()` resolves. That event increments `generation`, so line 146 returns `null` before the caller can receive or await verification of the newly issued current token.

**Consequence:** A valid authenticated request can omit its Authorization header solely because token renewal succeeded. The concrete purchase-page consumer constructs its waitlist request from this result (`packages/web/src/app/[locale]/dashboard/purchase/page.tsx:57–62`); the endpoint associates a user only from Bearer (`packages/web/src/app/api/waitlist/route.ts:29–45`). It can therefore create an anonymous signup for a signed-in user. Cookie fallback in other endpoints does not repair this public API failure. This remains after fix1's concurrent unchanged-token improvement and is distinct from subtree unmounting: preserving UI state alone does not fix the early return.

**Independent reproduction:** The actual facade/store/SDK probe places an expired synthetic session cookie after authenticated initialization, then calls the public token getter. Auth refresh and subsequent provider user confirmation both succeed. The result records `returnedToken: null`, `sdkSessionToken: "synthetic-refreshed-access"`, and final `authenticated: true` for the same user. See `quality-event-refresh-probe.json`, `tokenRefresh`.

**Minimum fix:** Safely await/reconcile the current same-identity refresh verification and return its confirmed current token. Keep a separate invalidation condition for logout, provider rejection, missing sessions and replacement identities; do not simply remove generation checks or return an unchecked refreshed token. Add an actual-SDK regression where `getSession()` emits `TOKEN_REFRESHED` during the getter, alongside the existing concurrent-read and negative lifecycle cases.

## P2 — Transient server refresh failures delete recoverable session cookies

**Location:** `packages/web/src/lib/server/auth.ts:44`, `:56`, `:60`, with unconditional cookie forwarding at `:67–69`.

**Trigger:** A cookie session needs refresh and the provider returns HTTP 503/429, or fetch rejects. The guard deliberately translates those transport failures into its synthetic HTTP 400 `auth_unavailable` response to avoid SDK retries. Auth-js treats that as a nonretryable auth error and removes the stored session. Its resulting `setAll` deletion is forwarded to the browser before the guard returns its intended 503.

**Consequence:** A temporary provider outage/rate limit/network error signs the user out by deleting the still-recoverable refresh credential. The browser cannot retry when the provider recovers. There was no invalid-token/revocation decision justifying deletion. Preserving a refresh cookie during an unavailable-service response does not authenticate the request; it only permits later recovery.

**Independent reproduction:** A second probe runs the actual production guard and installed SSR/Auth SDK with a complete expired synthetic cookie and fully mocked fetch. HTTP 503, HTTP 429 and thrown-fetch cases each return status 503 plus `Set-Cookie: sb-127-auth-token=; Max-Age=0; Path=/; SameSite=Lax`, after exactly one refresh POST. Reusing that original synthetic cookie with a recovered provider succeeds with status 200 and refreshed cookie, demonstrating the credential was not rejected. See `docs/research/evidence/2026-10-19-auth-session-integration/quality-guard-refresh-probe.json`.

**Minimum fix:** Distinguish transport unavailability from definitive credential rejection when committing SDK cookie mutations. Do not publish session deletions produced solely by the synthetic unavailable response. Preserve the bounded/no-retry transport, valid refresh-cookie writes, and deletion after an actual provider rejection. Add expired-cookie 503/429/transport-failure regressions asserting a safe 503 without destructive deletion, and retain the existing rejection/deletion and successful chunked-refresh tests.

## Evidence and validation scope

Independent hashing confirmed all 18 current source/script paths match the fix1 freeze; all seven before snapshots match the batch baseline; all seven browser-input hashes match current source. All 35 entries in the original evidence manifest and all 16 fix1 manifest entries match their bytes. Dependency manifests/lockfiles and the saved `next-env.d.ts` starting bytes remain unchanged.

The inspected final focused log records 19 suites / 515 tests passed. The browser evidence records 14 checks and owned-resource cleanup; typecheck and lint evidence are present. These runs were not repeated. Their tests do not cover dashboard child continuity during same-session events, refresh inside `getAccessToken()`, or cookie preservation on transient expired-session refresh failures. The passing evidence therefore does not refute the reproduced findings.

Only two small reviewer probes were run, both exiting 0 and using mocked fetch without network, remote services or real data:

- `node .superpowers/sdd/2026-10-19-upgrade-auth-session-integration/quality-event-refresh-probe.cjs`
- `node .superpowers/sdd/2026-10-19-upgrade-auth-session-integration/quality-guard-refresh-probe.cjs`

Probe source stays in recovery; output JSON/logs and `quality-review-probe-sha256.json` are in this batch's evidence directory. The event probe closes its React root/JSDOM and stops the owned SDK auto-refresh. No application/test/script source, old evidence, dependencies or migrations were edited; no child agents or broad test suites were run.

Full-project `verify`, shared and infra verification remain controller-owned. Live Google/SMTP, JWT signature/RLS/PostgREST, production Next/domain deployment and real-device qualification remain separate release requirements. Those existing limitations are not counted as findings here.

CHANGES_REQUIRED

# Task 1 specification re-review — fix round 1

Reviewed 2026-10-19 against the binding authentication-session specification, the original independent review, `task-1-fix1-report.md`, the actual four-path fix delta, `app-review-package-20261019T121337Z.md`, and the separate `fix1/source-freeze-fix1.json`. The original review and its failing probe outputs remain unchanged.

## Disposition

Both original P2 findings are resolved. No new specification-blocking finding was identified in the fixes or their interactions.

**Raw browser initialization errors:** `packages/web/src/lib/supabase.ts:38–66` now sanitizes requests only for the configured origin and Auth path. Provider error bodies and unknown diagnostic codes cannot become raw SDK error messages/codes. Known SDK session/error classification codes are retained. Thrown fetch, body-read and JSON failures are replaced with a fresh fixed error without the original cause. No application code suppresses or replaces console methods. The independent original browser probe now records the visible diagnostic `AuthApiError: Authentication unavailable` with `rawSentinelLogged: false`.

The boundary preserves HTTP status, so existing retry classification is retained; thrown transport failures remain retryable to the SDK. The actual-SDK tests verify successful recovery after a transient transport rejection, 503, malformed JSON and body-read failure, with two fetch attempts and restored session cookies. Successful Auth bodies/status/headers remain intact after parsing; 204/205 responses pass through. Requests outside the configured Auth path use the original fetch result/error. The non-Auth regression checks both provider failure details and thrown transport text; its `.retry(false)` is scoped to that test request and does not alter application behavior. The successful browser PKCE/cookie evidence still applies to this changed facade.

**Concurrent token reads:** `packages/web/src/stores/auth-store.ts:141–156` no longer invalidates one valid same-session read simply because another starts. Both retain the current identity generation. A missing/error session advances that generation before clearing state; a newly observed token/user also advances it before verification. Provider failure now advances the generation in `fail` (`line 39`), preventing an older positive result from restoring a rejected identity. Existing event/login/logout generation changes remain in place. The original concurrency probe now returns `["synthetic-access", "synthetic-access"]` for the same authenticated user.

The positive read test passes together with the retained newer-missing-session test and new provider-rejection race test. The existing initialization, logout/late-signin, provider mismatch, identity replacement, stale failure and signup-confirmation tests also pass. Source inspection confirms that logout and identity events still invalidate pending token reads through the same generation check; returning an access token still requires current session shape and provider confirmation.

## Independent verification

I reran the original reviewer probes without modifying their source, preserving new results separately:

- [Browser initialization probe result](spec-fix1-reviewer-browser-probe.json): exit 0; one mocked refresh request, safe diagnostic visible, no raw sentinel.
- [Concurrent token probe result](spec-fix1-reviewer-concurrency-probe.json): exit 0; both reads return the current verified synthetic token.
- [Focused re-review run](spec-fix1-focused-review.log.txt): exit 0; **2 suites / 23 tests passed**, no snapshots. Command: `npm test --workspace=packages/web -- --runInBand --runTestsByPath src/lib/__tests__/supabase-browser-errors.test.ts src/stores/__tests__/auth-session-lifecycle.test.ts`.

These reviewer runs use mocked Auth/fetch and synthetic cookies; they make no remote requests. The original raw/error probe results are still available beside the original review as historical RED evidence.

Independent hash checks confirmed:

- Exactly the reported four paths differ from the prior source freeze: facade, store, lifecycle test and new browser-error test. All **18** current source/script hashes match `docs/research/evidence/2026-10-19-auth-session-integration/fix1/source-freeze-fix1.json`.
- All **35** original evidence-manifest entries remain byte-identical; all **16** entries in `fix1/evidence-manifest-fix1.json` match. No fix result overwrites an original artifact.
- All seven source hashes in `fix1/browser-results.json` match current source. The browser script/fixture, callback, guard, OTP/home/middleware, original invitation regressions and original store tests are unchanged in this fix round.
- `packages/web/next-env.d.ts` matches its saved starting bytes.

The implementation's final [focused log](fix1/focused-final.log.txt) records **19 suites / 515 tests passed**. Its [browser results](fix1/browser-results.json) and [browser log](fix1/browser-final.log.txt) record **14 checks passed**, with the same production-facade/store/callback/guard synthetic bridge boundary. Cleanup reports the fixture stopped, zero sockets, owned browser closed and temporary bundle removed. Typecheck and scoped lint evidence are present under `fix1/`; their exit-0 observation is recorded in the implementation report. I inspected these artifacts and did not repeat the full 515-test or Chromium runs.

## Scope and validation boundaries

This re-review closes the two findings from `task-1-spec-review.md`; the remaining scope and compliance assessment there continues to apply. No application source, original evidence, dependency, migration, remote service or business data was changed by this reviewer. No child agents were used.

Controller-owned full-project `verify`, shared and infra verification remains pending. The passing local synthetic checks do not qualify live Google/SMTP, JWT signatures, RLS/PostgREST, a full Next deployment, production domains or real devices. These unchanged production boundaries do not block specification approval of this local Task 1 implementation.

Spec PASS

Public copy: relative evidence links relocated for this directory; original independent report remains unchanged in recovery.

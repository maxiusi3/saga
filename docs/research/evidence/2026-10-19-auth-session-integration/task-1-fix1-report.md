# Task 1 fix round 1 report

Status: DONE_WITH_CONCERNS — both confirmed P2 findings addressed and affected verification passed. Independent re-review and controller-owned full-project verification remain pending. No commits, push, deployment, remote Auth/mail, real data or full-project verify were performed.

Original `task-1-report.md`, original source freeze, original evidence manifest and every historical final/intermediate result remain unchanged. All new fix evidence is under `docs/research/evidence/2026-10-19-auth-session-integration/fix1/`.

## Exact fix scope

Four paths differ from the prior freeze:

1. `packages/web/src/lib/supabase.ts`: adds a browser fetch boundary only for the configured provider's `/auth/v1/` path. Auth failure bodies receive a fixed safe message. Only known error codes that affect SDK classification/session behavior are retained (`session_not_found`, `refresh_token_not_found`, `refresh_token_already_used`, `weak_password`); arbitrary diagnostic codes are discarded. HTTP status remains unchanged, preserving the SDK's retry classification. Thrown fetch/body/JSON errors become fresh fixed errors with no original message, stack or cause. SDK loggers are untouched and safe diagnostics remain visible. Successful Auth JSON retains its exact body, status and headers after safe reading/validation; 204/205 stay untouched. Non-Auth requests pass through normally, including failure details.
2. `packages/web/src/stores/auth-store.ts`: unchanged-session token reads use the current identity generation instead of incrementing it on every read. A missing/error session, provider rejection, different observed session, logout or identity event invalidates older work. Concurrent valid reads can both return the current verified token. Provider failure increments the generation so an older concurrent positive result cannot restore rejected identity.
3. `packages/web/src/stores/__tests__/auth-session-lifecycle.test.ts`: adds positive concurrent-read regression and provider-rejection race regression alongside the preserved missing-session, signout and identity-change cases.
4. New `packages/web/src/lib/__tests__/supabase-browser-errors.test.ts`: actual facade + installed SDK with synthetic JSDOM cookies and controlled fetch, exercising provider diagnostics, transport failure/retry, unknown error codes, success/session cookies, non-Auth pass-through, retryable server response, malformed JSON and body-read failures. Console spies do not replace the logger.

The browser script itself was not changed. Its existing evidence-directory argument directed the new run into `fix1/`.

## Actual RED and repair evidence

- `fix1/red.log`: 2 suites failed, 5 failed / 15 passed. It reproduced raw SDK logging and invalidated concurrent reads. One extra failure was a test timeout caused by ordinary PostgREST transport retries in the non-Auth control.
- The non-Auth control now explicitly uses the SDK's `.retry(false)` for that one test request. This is test-only and avoids waiting for unrelated retry behavior. Both source versions remain in `fix1/red-source/`.
- `fix1/red-confirmed.log`: **4 failed / 16 passed**, with only actual target failures: provider refresh sentinel logged, transport sentinel logged, raw error body/code exposed, and positive concurrent token result `[null, token]`.
- `fix1/green-attempt-1.log`: 4 suites / 31 tests passed after the minimal implementation. Additional transient-response/body regressions were then included in final validation.
- `fix1/reviewer-browser-probe.json`: the original independent probe now reports `rawSentinelLogged: false`, one synthetic refresh request, and the visible safe diagnostic `AuthApiError: Authentication unavailable`.
- `fix1/reviewer-concurrency-probe.json`: the original independent probe now reports `concurrentResults: ["synthetic-access", "synthetic-access"]`, with the same authenticated user.

The original reviewer probe sources/results in recovery were not modified. They were invoked again only to write new fix-specific output.

## Final validation

All listed final processes were observed to exit 0 on frozen source.

**19 suites / 515 tests passed**, zero snapshots — `fix1/focused-final.log`:

```sh
npm test --workspace=packages/web -- --runInBand auth-session auth-store auth-return auth-callback auth-signin-return auth-verify-session home-auth-landing supabase-session supabase-server-isolation supabase-browser-errors auth-locale-middleware invitation
```

This covers the new browser errors and positive token concurrency, the preserved negative token/missing-session/logout/identity/rejection races, existing signin/callback and invitation regressions, PKCE/cookie recovery, server guard, OTP and home boundaries.

**14 Chromium seam checks passed** — `fix1/browser-final.log`, `fix1/browser-results.json`, `fix1/browser-session.png`:

```sh
NEXT_TELEMETRY_DISABLED=1 node scripts/verify-auth-session-browser.cjs docs/research/evidence/2026-10-19-auth-session-integration/fix1
```

Actual browser factory/store and installed SDK still perform S256/verifier generation, real browser navigation through actual callback/guard behind the local bridge, cookie restoration, same provider-verified user, Bearer/cookie parity, email code and token_hash, numeric OTP, signout and negative callback/credential behavior. Two expected 401 resource console messages are retained for deliberate invalid-Bearer and post-signout requests. Page network remained exact-loopback-only; telemetry disabled and service workers blocked.

**Web typecheck passed** — `fix1/typecheck-final.log`:

```sh
npm run type-check --workspace=packages/web
```

**Scoped lint passed** — `fix1/lint-final.log` (empty successful output):

```sh
ESLINT_USE_FLAT_CONFIG=true node_modules/.bin/eslint packages/web/src/lib/supabase.ts packages/web/src/stores/auth-store.ts packages/web/src/lib/__tests__/supabase-browser-errors.test.ts packages/web/src/stores/__tests__/auth-session-lifecycle.test.ts
```

The existing permissive lint configuration is unchanged. No full project/shared/infra run was performed by this worker.

## Freeze, history and cleanup

`fix1/source-freeze-fix1.json` contains hashes for all 18 current batch source/script files and the exact four-path fix delta. `fix1/browser-results.json.sourceHashes` records actual browser input hashes. Both sets match current source. `fix1/evidence-manifest-fix1.json` fingerprints all fix artifacts, without changing the original root `evidence-sha256.json`.

All 35 entries in the original evidence manifest were rehashed and match their historical bytes. Old source-freeze values describe the historical source as intended; the new freeze is separate. No original report, old evidence, dependency, migration or invitation business source was changed.

`fix1/browser-cleanup.json` records fixture `listening=false`, sockets `0`, owned browser closed and owned temporary bundle directory removed. Only owned resources were touched. `next-env.d.ts` remains byte-identical to the saved baseline with SHA-256 `7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651`.

## Review disposition and boundaries

- P2 raw browser initialization diagnostics: ADDRESSED by safe Auth transport; verified using actual installed SDK and original reviewer probe. No global console suppression.
- P2 concurrent valid token reads: ADDRESSED by separating unchanged reads from identity invalidation; verified positive concurrency plus missing-session/provider rejection/logout/new-identity regressions and original reviewer probe.
- Source is frozen for the same independent reviewer to recheck.
- These remain local synthetic results, not live Google/SMTP, Supabase JWT signatures/RLS/PostgREST, full Next deployment, production domain configuration or real-device qualification. Those production gates remain open and are not defects newly introduced by this fix.

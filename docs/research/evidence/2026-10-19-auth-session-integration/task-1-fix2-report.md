# Task 1 fix round 2 report

Status: DONE_WITH_CONCERNS — all three confirmed quality findings addressed; affected verification passed. Independent re-review and controller-owned full-project verification remain pending. No commits, push, deployment, remote Auth/mail, real data, dependency/migration changes or full-project verify were performed.

Original and fix1 reports, freezes, evidence and manifests, plus the original quality review probes/results, remain unchanged. All new fix evidence is under `docs/research/evidence/2026-10-19-auth-session-integration/fix2/`.

## Findings and exact scope

Two production paths and three new test paths differ from the fix1 source freeze:

1. `packages/web/src/stores/auth-store.ts`: same-user SDK `SIGNED_IN`/`TOKEN_REFRESHED` revalidation preserves the already verified user and mounted dashboard while provider verification is pending. Identity change, missing session, rejection and logout still invalidate identity immediately. An identity generation separate from the verification generation prevents old work from surviving an A→B→A transition or signout followed by signin as the same user. `getAccessToken()` reconciles current event verification when its actual SDK `getSession()` triggers a successful refresh; concurrent callers wait for provider confirmation and receive the verified current token. Direct changed-token verification also publishes its promise as current event work. Verification remains deferred outside the SDK callback.
2. `packages/web/src/lib/server/auth.ts`: cookie mutations are ignored after transport failure or abort. The synthetic unavailable response used to bound SDK retry behavior can no longer forward SDK credential deletion. Genuine provider rejection still deletes cookies. Successful refresh cookies recorded before a subsequent user lookup outage remain publishable, preserving rotated refresh credentials. The ten-second deadline and at most one refresh plus one user request remain unchanged.
3. New `packages/web/src/components/auth/__tests__/auth-dashboard-continuity.test.ts`: actual browser facade/store, installed SDK and actual DashboardLayout in JSDOM. Real visibility events and expired-cookie SDK refresh preserve the same child node with one mount and zero unmounts. Concurrent token reads wait for provider verification. Provider rejection and new identity remove the prior authenticated dashboard. Only display dependencies and provider fetch are mocked; tests never manually invoke the auth listener. Owned React/JSDOM/SDK lifecycle resources are cleaned on failure as well as success.
4. New `packages/web/src/lib/server/__tests__/auth-session-transient.test.ts`: actual guard/SDK with a local validating fixture; refresh 503, 429, dropped socket and caller abort return safe failure without deleting recoverable cookies. Original cookies work after provider recovery. A successful refresh followed by user lookup 503 preserves the refreshed cookie and permits recovery.
5. New `packages/web/src/stores/__tests__/auth-token-refresh-races.test.ts`: proves A→B→A and signout followed by the same user's signin cannot revive an old token read.

DashboardLayout, SmartRecorder, invitation business/test source and the browser verification script were not edited in this round. The exact bare `?type=invite` guidance ruling remains preserved.

## Actual RED and repair evidence

- `fix2/red.log`: 2 suites, 5 failed / 4 passed; reproduced mounted-work loss, refresh token read failure and transient cookie deletion.
- `fix2/red-confirmed.log`: 3 suites, 5 failed / 6 passed. The token test was ordered to independently demonstrate a getter resolving before provider confirmation, while the visibility test independently demonstrates child unmount. Both test versions are retained in `fix2/red-source/`.
- `fix2/green-attempt-1.log`: 6 suites / 49 tests passed after the repair.

## Final validation

All final check processes were observed to exit 0, and source hashes were rechecked after completion.

**28 suites / 605 tests passed**, zero snapshots — `fix2/focused-final.log`:

```sh
npm test --workspace=packages/web -- --runInBand auth-session auth-store auth-return auth-callback auth-signin-return auth-verify-session home-auth-landing supabase-session supabase-server-isolation supabase-browser-errors auth-locale-middleware invitation auth-dashboard-continuity auth-token-refresh-races smart-recorder-session record-page-uses-smart-recorder recording-session recording-recovery storage-recording-user
```

This includes auth, existing invitation and the relevant recording regressions. The dashboard test verifies mounted child continuity; no real microphone or recording hardware was exercised.

**14 Chromium checks passed** — `fix2/browser-final.log`, `fix2/browser-results.json`, `fix2/browser-session.png`:

```sh
NEXT_TELEMETRY_DISABLED=1 node scripts/verify-auth-session-browser.cjs docs/research/evidence/2026-10-19-auth-session-integration/fix2
```

Actual browser factory/store/SDK, callback and guard retain PKCE/verifier generation, browser navigation, cookie restoration, provider-confirmed identity, cookie/Bearer parity, email code/token_hash, numeric OTP, signout and negative return/credential behavior. Network stayed loopback-only; telemetry disabled and service workers blocked. Two expected resource 401 console messages remain for deliberate invalid-Bearer/post-signout checks.

**Web typecheck passed** — `fix2/typecheck-final.log`:

```sh
npm run type-check --workspace=packages/web
```

**Scoped lint passed** — `fix2/lint-final.log` (empty successful output):

```sh
ESLINT_USE_FLAT_CONFIG=true node_modules/.bin/eslint packages/web/src/stores/auth-store.ts packages/web/src/lib/server/auth.ts packages/web/src/components/auth/__tests__/auth-dashboard-continuity.test.ts packages/web/src/lib/server/__tests__/auth-session-transient.test.ts packages/web/src/stores/__tests__/auth-token-refresh-races.test.ts
```

No controller-owned full project, shared or infra verification was performed by this worker.

## Reviewer probe replay

The original probe sources/results remain untouched. Copies changed only their output destinations:

- `.superpowers/sdd/2026-10-19-upgrade-auth-session-integration/quality-event-refresh-probe-fix2.cjs`
- `.superpowers/sdd/2026-10-19-upgrade-auth-session-integration/quality-guard-refresh-probe-fix2.cjs`

Copies of both sources are also retained in fix2 evidence; execute the recovery-location copies because their relative repository root assumes that location.

`fix2/quality-event-refresh-probe.json` records authenticated same-user state before/during/after, loading false, child present, mounts 1 and unmounts 0. The getter and SDK session both return `synthetic-refreshed-access`.

`fix2/quality-guard-refresh-probe.json` records status 503 with no cookie mutations for provider 503, 429 and fetch rejection, each using exactly one refresh request. Recovery succeeds with status 200 and updated cookies using refresh POST plus user GET. Probe logs remain visible with ordinary dashboard boolean diagnostics and safe SDK errors; logging is not suppressed.

## Freeze, history and cleanup

`fix2/source-freeze-fix2.json` contains all 21 current batch source/script hashes and the exact five-path fix2 delta. All 21 match current source; all seven `fix2/browser-results.json.sourceHashes` also match current source. Source is frozen for the same quality reviewer to recheck.

History was rehashed after final checks: all 35 original evidence entries, all 16 fix1 evidence entries and all six original quality-probe source/output entries match their historical manifests. `fix2/evidence-manifest-fix2.json` fingerprints all new fix2 artifacts except itself. No historical manifest was updated.

`fix2/browser-cleanup.json` records listener closed, zero sockets, owned browser closed and owned temporary directory removed. Only owned resources were cleaned. `packages/web/next-env.d.ts` is byte-identical to recovery `next-env.before`, SHA-256 `7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651`.

## Disposition and remaining concerns

- P1 same-user SDK events unmounting active dashboard work: ADDRESSED with actual DashboardLayout/SDK lifecycle evidence.
- P2 successful SDK refresh returning null from the token getter: ADDRESSED with provider-confirmed concurrent refresh and identity-invalidating race evidence.
- P2 transient guard refresh failure deleting recoverable credentials: ADDRESSED with failure/recovery and rotated-cookie evidence.
- Independent quality re-review and controller full-project verification remain pending.
- Results are local and synthetic. Live Google/SMTP, deployed Next/domain configuration, real Supabase JWT signatures/RLS/PostgREST, real recording and device behavior remain outside this qualification.

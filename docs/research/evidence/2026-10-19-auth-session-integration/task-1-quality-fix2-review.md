# Task 1 independent quality re-review — fix round 2

Reviewed 2026-10-19 against the original three findings in `task-1-quality-review.md`, the binding specification including clarified clauses 2/3, `task-1-fix2-report.md`, `app-review-package-20261019T123417Z.md`, and actual frozen source. The fix delta is exactly two production files (store and guard) plus three new test files. DashboardLayout, SmartRecorder, callback/signin protections and earlier tests are unchanged.

## Decision

All three original findings are resolved. No new blocking quality or specification issue was found in the fixes and affected interactions. The original review and its failing evidence remain unchanged.

## Findings disposition

### P1 — Same-session events unmounting active dashboard work: resolved

`packages/web/src/stores/auth-store.ts:58–68` now retains an already authenticated, provider-confirmed identity while the same user's event is revalidated. It does not publish the incoming session's user before verification. Initial/unknown identities, different users and missing sessions still clear immediately; provider rejection clears through `fail` after the response. Verification remains deferred outside the SDK callback.

The independently repeated original probe uses actual facade/store/installed SDK and actual DashboardLayout with a synthetic child. Real browser visibility recovery now keeps `isAuthenticated=true`, `isLoading=false`, the same child present, one mount and zero unmounts before, during and after provider confirmation. New continuity tests additionally assert the same child DOM node survives SDK refresh. The former structural cause of SmartRecorder's unmount cleanup is removed without modifying the recorder or dashboard.

### P2 — Successful SDK refresh returning null from the getter: resolved

`packages/web/src/stores/auth-store.ts:146–179` distinguishes the verification generation from `identityGeneration`. A same-identity refresh during `getSession()` waits for current event verification; direct changed-token validation also publishes its promise as current work. The getter returns the provider-confirmed current token rather than interpreting the refresh event as logout.

The original actual-SDK probe now returns `synthetic-refreshed-access`, equal to the SDK's current session token. The new concurrent refresh test holds provider confirmation pending and proves both token calls remain unsettled until verification finishes; both then receive that current token while the dashboard stays mounted.

The independent identity counter advances on every clear (`:36–39`), so matching user IDs alone cannot revive old work. The new A→B→A and signout→same-user tests both pass and require the pre-transition read to return null. Retained tests also pass for missing current sessions, newer missing-session observations, provider rejection races, provider mismatch, older initialization/signin results and new identities. A known user's UI continuity therefore does not grant unverified new identity or undo a true identity-loss boundary.

### P2 — Transient refresh errors deleting recoverable cookies: resolved

`packages/web/src/lib/server/auth.ts:67–71` rejects SDK cookie mutations after `transportFailed` or caller/deadline abort. A synthetic unavailable response can no longer commit SDK session deletion. Genuine provider rejection does not set that transport flag, so its deletion remains forwarded. Valid cookie writes from a successful refresh are already retained before a later user lookup outage; the fix does not discard those rotated credentials.

The independent original guard probe now records safe 503 responses with no Set-Cookie mutations for provider 503, 429 and fetch rejection, each after one refresh request. The original cookie succeeds after provider recovery. The new actual-SDK/loopback tests also confirm dropped-socket and caller-abort preservation, and successful refresh followed by user-lookup 503 preserves a cookie that works on recovery. Retained tests verify actual rejection deletion, more-than-five cookie chunks and stale-chunk removal, invalid explicit Bearer refusal, fixed safe failures, and the real ten-second stalled-body deadline. No additional retry or authentication bypass was introduced.

## Independent validation and evidence

I reran the original two reviewer probes with source copies changed only to write separate reviewer output destinations. Their application/SDK logic is unchanged. New results are preserved at:

- `docs/research/evidence/2026-10-19-auth-session-integration/quality-fix2-reviewer-event-probe.json` and its `.log.txt`.
- `docs/research/evidence/2026-10-19-auth-session-integration/quality-fix2-reviewer-guard-probe.json` and its `.log.txt`.

Probe sources are `quality-fix2-reviewer-event-probe.cjs` and `quality-fix2-reviewer-guard-probe.cjs` in this recovery directory. They use mocked fetch and no network or real audio.

An independent focused rerun exited 0: **5 suites / 41 tests passed**, zero snapshots. Its command and result are preserved in `docs/research/evidence/2026-10-19-auth-session-integration/quality-fix2-reviewer-focused.log.txt`:

```sh
npm test --workspace=packages/web -- --runInBand --runTestsByPath src/components/auth/__tests__/auth-dashboard-continuity.test.ts src/stores/__tests__/auth-token-refresh-races.test.ts src/stores/__tests__/auth-session-lifecycle.test.ts src/lib/server/__tests__/auth-session-transient.test.ts src/lib/server/__tests__/auth-session-guard.test.ts
```

The loopback fixture tests verify owned listener/socket cleanup. The dashboard tests and reviewer probe close React/JSDOM and stop SDK auto-refresh. No remote service, real identity, microphone, dependency, migration, application source or historical evidence was changed. No child agents were used.

Independent hashes confirm:

- All **21** current source/script hashes match `fix2/source-freeze-fix2.json`, with exactly the reported five-path delta from fix1.
- All seven browser-input hashes match current source; all seven before snapshots match the batch baseline; `next-env.d.ts` matches its starting bytes.
- All **35** original evidence entries, **16** fix1 entries, **21** fix2 manifest entries and **six** original quality-probe entries remain intact.

The implementer's final log was inspected and records **28 suites / 605 tests passed**. The new Chromium evidence records **14 checks passed** and cleanup. Those broader runs, lint and typecheck were inspected rather than repeated. The focused independent run above covers the changed behavior and its principal negative boundaries.

## Scope limits

This decision closes the three local code-quality findings and finds no conflict with the clarified specification. Full-project `verify`, shared and infra validation remain controller-owned. Local synthetic evidence does not qualify live Google/SMTP, deployed Next/domain settings, JWT signatures/RLS/PostgREST or real-device/recording behavior; those separate release requirements remain open.

Quality Approved

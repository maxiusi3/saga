# Invitation management independent review

Date: 2026-10-21. Scope: current working-tree implementation against `docs/superpowers/specs/2026-10-21-invitation-management.md` and its implementation plan. Read-only review; only this report is written by the reviewer. Existing unrelated work is preserved. Parent owns full verification and final documentation.

## Final re-review verdict

- Spec compliance: approved for the reviewed local implementation. All identified deviations are fixed; no open Critical, Important, or Minor findings.
- Code quality: approved. Critical: 0; Important: 0; Minor: 0.
- Independent post-fix targeted run: all 5 suites and all 54 tests pass, exit 0, 14.787 seconds. The three prior regression failures are green, with no React warnings in the fresh output.
- This approval covers the implementation reviewed below. Full repository verification and remaining evidence/documentation updates are still the parent's responsibility. It does not qualify production, real provider/Auth/PostgREST, migrations, or devices.

## Verdict at initial review snapshot (superseded)

- Spec compliance: changes required. One Important recovery-flow defect and one Minor role-context defect remain.
- Code quality: changes required for the same two defects. Critical: 0; Important: 1; Minor: 1.
- The PostgreSQL candidate, strict management HTTP boundary, and source/history projection have no additional supported findings in this review. This is not production or real provider/Auth/PostgREST/migration/device qualification.

## Initial findings (both resolved)

### Important: a request that never dispatches can leave a permanently blocking recovery ticket

Location: `packages/web/src/components/invitations/invitation-management.tsx:111-115`, with cleanup at lines 57 and 127.

`send()` persists the recovery ticket before awaiting `getAccessToken()`. If the component is unmounted or its project/account context changes while token acquisition is pending, its controller is aborted. The post-token current-context guard returns without clearing that ticket; cleanup also does not remove a definitely undispatched ticket. The same happens indefinitely when token acquisition never resolves. On returning to the original actor/project, the ticket blocks new sends. Since the request was never issued, lookup cannot confirm it, and the intended rejected/unknown-lookup policy retains the ticket rather than unblocking the user.

Reproduced by the targeted UI tests `project switch while awaiting token prevents dispatch and cannot expose an old link` and `departing before token resolves clears its undispatched recovery immediately` at `packages/web/src/components/invitations/__tests__/invitation-sender-ui.test.tsx:171-194`. Both fail on the reviewed snapshot; the sender write count remains zero while the recovery record survives.

Required fix: obtain a current token before saving the ticket (still save successfully before invoking the sender HTTP call), or track definitely undispatched recovery records and compare-delete them on every departure/early return, including while the token promise is unresolved. Preserve every actually dispatched unknown request. Verify both return-to-context and never-resolving-token regressions, as well as existing unknown-after-dispatch retention.

### Minor: role changes retain the previously confirmed token/link

Location: `packages/web/src/components/invitations/invitation-management.tsx:164`, with link rendering at line 172.

Changing the form role clears the source list and selected source but not `link`. After a storyteller send succeeds, changing the form to facilitator still displays and permits copying the previous storyteller invitation link. The spec explicitly requires clearing old-context in-memory tokens on role changes. Account/project keyed remounts do not cover this role-only transition.

Reproduced by `changing role clears the prior confirmed invitation link` at `packages/web/src/components/invitations/__tests__/invitation-sender-ui.test.tsx:196-200`; it fails because the old link input remains present.

Required fix: clear the confirmed link on role changes and retain this regression test. No resend or automatic lookup should be introduced.

## Addressed during review

- The management status parser previously coerced values with `String(row.status)`, accepting an array such as `["pending"]`. The parent replaced this with an explicit string type check and added a rejection regression. Current inspection/probe confirms the malformed value is rejected; this is not an open finding.
- Parent implemented synchronous auth-store departure generation tracking for the A -> signed-out -> A batched transition and guarded retired requests. The targeted same-batch sender regression passes in the review run. Read effects also check their own aborted controller, preventing a StrictMode-retired read from updating a live session.
- SQL worker tightened confirmed-email parsing and the `expires_at > created_at` history invariant. Reviewed current candidate contains both checks.

## Validation and coverage

Reviewer ran the following targeted suites from `packages/web`, using `--runInBand --no-cache --watchman=false --runTestsByPath`:

- `src/lib/__tests__/invitation-management-client.test.ts`
- `src/lib/__tests__/invitation-recovery.test.ts`
- `src/lib/server/__tests__/invitation-management.test.ts`
- `src/components/invitations/__tests__/invitation-management-ui.test.tsx`
- `src/components/invitations/__tests__/invitation-sender-ui.test.tsx`

Result: 4 suites passed, 1 failed; 51 tests passed and 3 failed, 54 total. All three failures reproduce the two findings above. The run also emitted React `act(...)` warnings from source-loading failure updates in the failing sender suite; no separate production defect is asserted from those warnings.

Inspected SQL candidate/scenarios/runner/lifecycle, protocol/client/server/routes, recovery storage helper, shared UI and both entry points, and related sender/auth integration. SQL worker evidence was inspected rather than rerun by this reviewer: final candidate report `docs/research/evidence/2026-10-21-invitation-management/sql-run-2026-10-21T14-47-16.084Z-8e804a59-f438-4c16-b9c8-3559d2bc64af.json` reports 16 scenarios and 2448 assertions passing; final lifecycle report `sql-lifecycle-2026-10-21T14-49-45.910Z-877999de-cb4b-4603-9b9e-9af16843648d.json` reports all four lifecycle cases passing. See `task-1-report.md` for exact hashes and limitations. No full `npm run verify` was run by this reviewer.

## Final re-review

The parent fixed both findings without changing the recovery contract. `send()` now registers an abort listener before saving. It tracks whether this invocation successfully saved its own ticket and whether dispatch began. A departure synchronously compare-deletes that ticket only while definitely undispatched, even when token acquisition never settles; `finally` repeats the guarded cleanup and removes the listener. A failed save cannot clear another invocation's ticket. An actually dispatched unknown request remains stored, including account/project departure. The role change handler clears both the old link and notice.

Independently re-read the final shared UI, protocol/client/server/routes, SQL candidate and corruption/ACL/read-only scenarios. Additional checks found no supported SQL or HTTP issues: the ports remain default closed before body or I/O, use provider-verified Bearer with a per-request anon SDK and the same Authorization, share one bounded deadline, and disable retries/cookie/service fallback. Strict row parsers enforce shape values, context, UUID order/uniqueness and limits while constructing minimal output projections. SQL sources require durable matching grant authority; history permits inactive/transferred/revoked cleanup while checking complete binding/invitation/audit consistency before pagination. Both actual UI entry points use the shared component and retain explicit recovery/release behavior.

The reviewer reran the same five suites after these fixes: **5 suites passed, 54 tests passed, exit 0**. This includes the two pre-dispatch interruption cases, role-link clearing, post-dispatch unknown retention/remount, account/project and same-batch departure isolation, pagination, strict protocol validation, real SDK/loopback HTTP refusal/abort behavior, and the real shared ten-second deadline. No implementation files or tests were edited by the reviewer.

The reviewer also parsed the final SQL evidence directly and independently confirmed `status: passed`, 16 scenarios, 2448 assertions, all four lifecycle cases passing, and clean cluster/temp/client cleanup. The candidate evidence SHA256 is `177a479669d23fcaaed154308769ce25346eea9b7b9f6622cc0ec20da596a883`; lifecycle evidence SHA256 is `b858c6cea49dcab8421c65ec9a8e6e7662947c33fb3315f3b519c7bb36b6751b`, matching the worker report. SQL was not rerun by this reviewer. Full verification, shared/infra checks, and any remaining evidence/documentation updates remain with the parent.

After the parent applied Prettier and froze implementation, the reviewer re-read the formatted manager, recovery helper, protocol and HTTP server. Approval is unchanged. Frozen fingerprints: shared manager `b40069c7eb66e059b486777fc3f006da12297a8f4fcb2c2a48f16b41e8b7fa60`; management protocol `860703225c783505a3ed24005500d56f00d3cbcaf90ba4ed33da6d5c8028c00c`; management server `606cc5237b9b5a61644201453a5583bb1036e925d3c22bdffa40341c20a339ee`; SQL candidate `e2063af8a44dbbf045ec1c47aae210a7a070629c17c0702093e391b7150c8c9a`. Parent's post-format targeted/full checks and batch documentation review are tracked separately.

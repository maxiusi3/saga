# Task 1 implementation report

Status: **DONE_WITH_CONCERNS — application sources frozen for controller verification and independent reviews.**

The seven preexisting files in scope were changed in place, preserving the controller baseline and other dirty work. No commits, pushes, remote/provider calls, dependency changes, root migrations, switches, old experiments/evidence, handoff, or auth-page edits were made. Full `npm run verify`, shared/infra suites, spec review and quality review belong to the controller and are not claimed here.

## Changed files

Modified:

- `packages/web/src/lib/server/invitation-acceptance.ts`
- `packages/web/src/app/api/invitations/[token]/route.ts`
- `packages/web/src/app/api/invitations/verify/route.ts`
- `packages/web/src/app/api/invitations/check-pending/route.ts`
- `packages/web/src/app/[locale]/invite/[token]/page.tsx`
- `packages/web/src/app/[locale]/accept-invitation/page.tsx`
- `packages/web/src/app/[locale]/page.tsx` (invite callback branch only)

Created:

- `packages/web/src/components/invitations/invitation-recipient.tsx`
- `packages/web/src/lib/server/__tests__/invitation-read-routes.test.ts`
- `packages/web/src/components/invitations/__tests__/invitation-recipient.test.tsx`

The existing protocol, HTTP client, three previous regression suites and SDK loopback fixture remain byte-identical. `task-1-source-sha256.json` records 18 sources (10 changed/new plus 8 unchanged contract, fixture, regression and auth sources), with full SHA-256 and byte sizes. A baseline comparison before controller full verification found exactly the seven modified existing application files listed above.

## Behavior

Both legacy token GET routes now delegate to the existing status adapter, which accepts an optional URL token. The adapter's acceptance algorithm, exact feature gate, same-client `getUser` verification, anon key, schema/parameter selection, safe failures, strict response parsing, ten-second combined deadline, no retry, cancellation and cleanup remain intact. Path tokens consume Next's single decode; verify requires exactly one URLSearchParams token and never decodes or trims again. GET results use the existing safe status shape with `no-store` and `Vary: Authorization`. The pending discovery route is a standalone unconditional 503 `not_attempted`; it does not construct any client or claim an empty invitation list.

Both recipient URLs now render the shared component. Invalid/missing tokens give original-link guidance without invitation data requests. The session subscription is solely a browser Bearer source; no invitation qualification is inferred from local email, `type`, cookies, metadata or registration results. Signed-out recipients receive one existing signin/account-creation link whose `next` is the canonical local locale invitation URL. No signup page exists; the existing signin route supports OTP/OAuth and is used for both purposes, as confirmed by the controller.

The component reads through the existing HTTP helper and shows only safe role/state. Only pending plus database `is_expired=false` exposes acceptance. An explicit click synchronously locks the request; complete acceptance fields must agree with the displayed invitation/project/role and current session user before navigation. Unknown results retain the page and lock writes; explicit status can show an `Enter project` action only for confirmed accepted current user. A pending re-read never unlocks an unknown write. Locks also survive same-user credential refresh and account departure/return during an unresolved write. Returning to that account requires an explicit read. Tokens/accounts use distinct mounted flows; immediate current-identity checks plus cleanup suppress stale navigation or UI updates. No polling, automatic acceptance/retry, recipient logging, credential persistence, direct table access, unsafe error rendering or preview-data rendering was added.

Home's invite callback immediately routes to `/{locale}/accept-invitation`, whose missing-token UI asks for the original invitation. Its unrelated magiclink branch is unchanged.

## Actual TDD evidence and commands

All commands below ran at `/Users/eat/Documents/eatpotato/saga传奇`. Raw stdout/stderr is under `docs/research/evidence/2026-10-19-invitation-read-ui/`. Early captures originally used `.log`; they were renamed byte-for-byte to `.txt` because the repository ignores `.log`.

1. Before changing production sources:

   `npm test --workspace=packages/web -- --runInBand --runTestsByPath src/lib/server/__tests__/invitation-read-routes.test.ts -t 'disabled|pending discovery'`

   Exit 1; 3 failed / 15 skipped. Disabled legacy path GET returned 200; verify returned 500; pending discovery returned 200. Legacy verification/pending also logged. Actual handlers and actual Supabase SDK used only the synthetic loopback. Evidence: `red-read-routes.txt`. The encompassing inspection shell returned 0 because it printed the capture after npm; npm's exit-1 result is explicit in the raw output.

2. After minimal route implementation:

   `npm test --workspace=packages/web -- --runInBand --runTestsByPath src/lib/server/__tests__/invitation-read-routes.test.ts`

   Exit 0; 18 passed. Evidence: `green-read-routes.txt`.

3. Preliminary UI fixture run before changing pages:

   `npm test --workspace=packages/web -- --runInBand --runTestsByPath src/components/invitations/__tests__/invitation-recipient.test.tsx -t 'signed-out|home invite|missing/duplicate'`

   Exit 1; 7 failed / 29 skipped. Evidence: `red-recipient-ui.txt`. The first fixture also supplied the safe HTTP shape to the old rich-preview GET path, exposing an old `inviter_name.split` crash. I refined the default mock to provide the old path's minimal preview fields, then ran the full behavior suite below. This preliminary run alone is not the claimed TDD proof.

4. Full UI behavior RED before replacing either page or creating the shared component:

   `npm test --workspace=packages/web -- --runInBand --runTestsByPath src/components/invitations/__tests__/invitation-recipient.test.tsx`

   Exit 1; 36 failed. Evidence: `red-recipient-behaviors.txt`. Both original page modules were present and mounted; no missing-module failure was used. The suite exercises the new safe HTTP contract through mocked fetch and actual helper/parser code.

5. After shared UI implementation, the same command exited 0 with 36 passed. Evidence: `green-recipient-ui-initial.txt`.

6. Self-review added an account-return regression:

   `npm test --workspace=packages/web -- --runInBand --runTestsByPath src/components/invitations/__tests__/invitation-recipient.test.tsx -t 'returning to an account|unmount before initial'`

   Exit 1; 1 failed / 1 passed / 36 skipped. Returning to the same account after an unresolved acceptance sent a second automatic status request (expected 1, got 2). Evidence: `red-account-return-count.txt`. An earlier array assertion printed synthetic fixture request headers; its unedited diagnostic was preserved at `.superpowers/sdd/2026-10-19-upgrade-invitation-read-ui/red-account-return-initial.txt`. I repeated the unchanged production behavior with a count-only assertion to keep the publishable RED free of even synthetic Bearer values. Then changed the initial effect to defer uncertain-account recovery to the explicit button.

7. Final focused regression, on frozen sources:

   `npm test --workspace=packages/web -- --runInBand --runTestsByPath src/lib/server/__tests__/invitation-read-routes.test.ts src/lib/server/__tests__/invitation-acceptance.test.ts src/lib/__tests__/invitation-acceptance-client.test.ts src/lib/__tests__/invitation-acceptance-protocol.test.ts src/components/invitations/__tests__/invitation-recipient.test.tsx`

   **Exit 0; 5 suites / 250 tests passed, 0 failed.** New coverage is 18 route and 38 recipient tests. Evidence: `focused-tests.txt` (27.065 seconds).

8. Final type check:

   `npm run type-check --workspace=packages/web`

   **Exit 0.** Evidence: `type-check.txt`. Earlier pre-self-review pass preserved in `type-check-initial.txt`.

9. Final relevant lint:

   `node_modules/.bin/eslint packages/web/src/lib/server/invitation-acceptance.ts packages/web/src/lib/server/__tests__/invitation-read-routes.test.ts 'packages/web/src/app/api/invitations/[token]/route.ts' packages/web/src/app/api/invitations/verify/route.ts packages/web/src/app/api/invitations/check-pending/route.ts 'packages/web/src/app/[locale]/invite/[token]/page.tsx' 'packages/web/src/app/[locale]/accept-invitation/page.tsx' 'packages/web/src/app/[locale]/page.tsx' packages/web/src/components/invitations/invitation-recipient.tsx packages/web/src/components/invitations/__tests__/invitation-recipient.test.tsx`

   **Exit 0; no output.** Evidence: `lint.txt` (empty raw stdout/stderr is intentional). Earlier pass preserved in `lint-initial.txt`. Repository ESLint rules are minimal, so lint does not replace behavior verification or review.

10. `git diff --check` exited 0. The per-batch source hash manifest and evidence-pattern scan were generated by Python standard-library SHA-256/JSON and regular-expression checks. `task-1-evidence-scan.json` reports zero JWT/secret-key/synthetic-Bearer findings in Task 1's publishable raw text captures; no environment-file secret values were read for the scan.

## Self-review

- Actual SDK tests establish exactly auth then one status RPC, caller Bearer/anon key/schema and `p_token`, no cookie fallback/accept/table expiry update, safe debug responses, malformed/duplicate/residual-encoded tokens, authentication/refusal/strict TABLE failures, abort and shared deadline. Each route test verifies listener detachment and fixture closure with zero sockets/held responses. The old acceptance suite still passes unchanged.
- React tests mount both real page wrappers and the shared component, using actual HTTP helper and protocol parser with fetch at the boundary. They cover signin canonical next, missing/invalid tokens, `type` independence, database expiry, accepted/declined state, unavailable/rejected/unconfirmed-email guidance, unknown recovery, synchronous clicks, all acceptance identity disagreements, safe data display, current-user continuation, stale token/account/unmount responses, late session loads, account refresh/return locks, subscription cleanup and home invite routing.
- A real self-review defect (automatic read on uncertain account return) was corrected only after a covering RED, and included in the final 250-pass regression.
- No schema/RPC/seat-ledger details or untrusted provider fields are shown in recipient UI. The shared minimal copy is currently English; all locale paths and auth returns remain canonical and local.
- No independent review was performed by this implementer; source freeze was sent to the controller for the required spec then quality reviews and full project checks.

## Concrete remaining concerns / boundaries

1. The unchanged signin page logs its full URL and `next`, and persists `auth_next` in localStorage. The unchanged callback route logs callback/auth information and raw provider errors. These existing auth paths can expose/persist invitation links or auth details. Controller explicitly confirmed they are outside this batch's no-auth-edits scope and must remain visible as release blockers. This batch does **not** claim end-to-end auth privacy or absence of existing token persistence.
2. A trusted minimal preview contract is still absent: no project/inviter names, invitation email, question or message preview is displayed. Pending discovery is intentionally unavailable. Sending/canceling/mail, historical opaque tokens, trusted entitlements/source events, actual DB permissions and migration rollout remain separate work.
3. SDK loopback plus browser-component mocks prove local application behavior only. They do not qualify real Supabase JWT/PostgREST/RLS, trusted entitlements or production transport. G0/G1 remain unproven; production switches stay unchanged/off. Full project verification and milestone determination remain with the controller.

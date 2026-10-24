# Task 1 independent spec-compliance and code-quality review

## Spec Compliance

- ❌ Issues found: batched account departure/return does not invalidate an old acceptance request. `packages/web/src/components/invitations/invitation-recipient.tsx:61`, `:110`, `:128` and `:171` permit the stale response to navigate at `:175`, contrary to the identity-change requirement in `docs/superpowers/specs/2026-10-19-invitation-read-ui.md:28`.
- ✅ All requested application files have the corresponding scoped changes: both page wrappers validate and pass canonical tokens; the home invite branch removes discovery; the three legacy read routes are replaced; the existing status adapter accepts a URL token; and the shared component plus two focused suites are present. Evidence: `packages/web/src/app/[locale]/accept-invitation/page.tsx:9`, `packages/web/src/app/[locale]/invite/[token]/page.tsx:7`, `packages/web/src/app/[locale]/page.tsx:69`, `packages/web/src/app/api/invitations/[token]/route.ts:8`, `packages/web/src/app/api/invitations/verify/route.ts:4`, `packages/web/src/app/api/invitations/check-pending/route.ts:1`, `packages/web/src/lib/server/invitation-acceptance.ts:136`.
- ⚠️ Outside this task-scoped diff: preservation of every older dirty file, production switches, real provider/RLS qualification, and end-to-end signin/callback privacy cannot be independently established from the application diff. The controller reports baseline integrity and unchanged verification inputs; the binding spec explicitly retains auth privacy as a release blocker and excludes G0/G1 qualification (`docs/superpowers/specs/2026-10-19-invitation-read-ui.md:13`, `:21`, `:37`).

## Strengths

- The GET aliases are thin and reuse the existing exact feature gate, one SDK client, verified Bearer, single status RPC, strict row parser and combined deadline. Pending discovery returns an explicit safe 503 without configuration/client access. Evidence: `packages/web/src/lib/server/invitation-acceptance.ts:51`, `:78`, `:99`, `:112`, `:117`; `packages/web/src/app/api/invitations/check-pending/route.ts:1`.
- The UI removes untrusted preview fields and local email/clock eligibility guesses, uses canonical local signin returns, synchronously locks acceptance, checks every required acceptance identity field, and keeps unknown writes locked after explicit pending status reads. Evidence: `packages/web/src/components/invitations/invitation-recipient.tsx:21`, `:37`, `:62`, `:161`, `:166`, `:172`, `:178`, `:193`, `:205`.
- The route tests exercise actual handlers and SDK transport with loopback fixtures, including captured auth/RPC sequencing, abort-listener removal and a shared ten-second deadline. UI tests exercise the real HTTP helper/parser and real page wrappers. Evidence: `packages/web/src/lib/server/__tests__/invitation-read-routes.test.ts:35`, `:101`, `:174`; `packages/web/src/components/invitations/__tests__/invitation-recipient.test.tsx:80`, `:93`, `:162`, `:257`.

## Issues

### Critical (Must Fix)

- None found in the reviewed batch.

### Important (Should Fix)

- **I1 — Invalidate requests by identity generation, not only current user ID.** `packages/web/src/components/invitations/invitation-recipient.tsx:61` only compares the current user ID; auth callbacks at `:69`–`:74` overwrite that identity without retaining its generation. The child is keyed only by user ID at `:110`, and request completion relies on that comparison plus a mounted flag at `:128`. If `SIGNED_OUT` followed by `SIGNED_IN` for the same user occurs in one React batch, React retains the existing child. Once the old acceptance resolves, `:171` accepts it as current and `:175` navigates. This violates the explicit stale-account-result constraint even though the separate-commit account-return test at `packages/web/src/components/invitations/__tests__/invitation-recipient.test.tsx:257` passes. Increment an identity generation synchronously on genuine user-ID transitions, including departure to null; capture/check that generation for request completion and actions. A same-user credential refresh must retain its existing generation and unknown lock. Add a regression that emits departure and return inside one `act` before resolving the old request, and cover stale status results as well.

### Minor (Nice to Have)

- **M1 — Existing full-verification output is not pristine.** `docs/research/evidence/2026-10-19-invitation-read-ui/project-verify-20261019T022711Z.txt:61`–`:65` contains obsolete Next configuration warnings; `:73`–`:107` contains repeated missing-server-configuration diagnostics and stack traces. These are pre-existing, outside the reviewed application diff, and the command exits 0. Preserve them as a separate cleanup item; do not describe this run as warning-free or introduce real credentials to silence it.

## Checks and Evidence

- Reviewed the supplied per-batch diff against the brief and binding spec; no git commands, broad codebase crawl, source edits, or suite reruns were performed.
- Named risk: the URL-token extension could change POST/read authentication, deadline or mutation behavior. The server diff starts mid-function, so I read the complete `packages/web/src/lib/server/invitation-acceptance.ts` once to recover the omitted function context, including `:49`–`:130`.
- Named risk: the new component depends on strict success validation and failure classification from unchanged helpers. One focused check inspected `packages/web/src/lib/invitation-acceptance-client.ts:16`–`:47` and `packages/web/src/lib/invitation-acceptance-protocol.ts:77`–`:128`; unknown network/malformed results and filtered safe fields match the component contract.
- Focused lifecycle reproduction: executed an in-memory React/Testing Library harness using the exact component reconstructed from the review diff, the actual unchanged HTTP helper/parser, synthetic session/status data, and mocked fetch/router/auth boundaries. After starting acceptance, called `SIGNED_OUT(null)` and `SIGNED_IN(same user)` in one `act`, then resolved the old acceptance. Command exit 0; observed `{"scenario":"batched sign-out/sign-in before old acceptance resolves","acceptCalls":1,"oldRequestNavigations":1}`. No files were written for this reproduction.
- Existing focused evidence is readable and clean: `docs/research/evidence/2026-10-19-invitation-read-ui/focused-tests.txt:6` records 5 suites / 250 tests passing; `type-check.txt:2` records the type-check command; `lint.txt` is intentionally empty. Actual legacy-route business RED is present at `red-read-routes.txt:6`, rather than a missing-module failure.
- Controller full verification records verify/shared/infra exit 0, 751 unchanged application/configuration inputs and restored next-env bytes in `docs/research/evidence/2026-10-19-invitation-read-ui/project-verification-20261019T022711Z.json`. Its web output records 82 suites / 1,016 tests at `project-verify-20261019T022711Z.txt:34` and 176 generated pages at `:256`. These passing runs do not cover I1.

## Assessment

**Task quality: Needs fixes.** The read adapters and ordinary recovery flow are narrowly implemented and well covered, but the reproduced stale-account navigation violates a binding safety requirement. Fix I1 and obtain focused regression evidence plus scoped re-review before approval.

**Report path:** `.superpowers/sdd/2026-10-19-upgrade-invitation-read-ui/task-1-review.md`.

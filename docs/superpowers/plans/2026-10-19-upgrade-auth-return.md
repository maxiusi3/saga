# Auth return privacy and lifecycle implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Complete task reviews and final independent batch review; preserve preexisting dirty work and recovery data.

**Goal:** Remove unsafe signin/callback logging and persistent return fallback, and make authentication return targets and outcomes safe and explicit.

**Architecture:** A shared pure helper owns the small supported return-target language and safe errors. Signin uses explicit validated next and deletes obsolete auth_next; AuthProvider also removes that obsolete key. A bounded server callback adapter uses the real SSR SDK and sends cookie-preserving 303 responses.

**Tech Stack:** Existing Next.js/React/TypeScript, Supabase SSR/JS SDK, Jest and loopback fixtures; no dependency changes.

**Spec:** [binding specification](../specs/2026-10-19-auth-return.md).

## Global Constraints

- Existing branch `codex/october-upgrade-p0`, HEAD `1caa21a72`; preserve all previous dirty work. No commit/push unless an original milestone passes. No remote calls, real family data, mail, paid services, migration or deployment.
- `next` is once-decoded, maximum 2048, limited to supported dashboard/canonical invitation targets and all eight existing locales. Missing/duplicate/invalid values fall back to the current locale dashboard; never guess or restore an old target.
- Delete obsolete `auth_next` best-effort without reading it; never write it or another fallback cache; do not clear session keys. No raw URL/credential/error logs or reflection in touched paths.
- Callback supports one code or one token_hash/type pair, maximum 4096 for credentials; exactly one SDK auth operation, public URL/anon key only, ten-second deadline/caller abort, no retry/fallback. Verified complete session/user required; success303 preserves cookies; errors are fixed safe signin redirects.
- No HTML/script-based callback navigation. Every callback response is no-store/no-referrer. Current browser-client/auth-store persistence, other legacy auth entry points and real-provider integration remain separately unverified.
- Old invitation sources/protocol/tests, experiments/runtime/evidence, dependencies, root migrations and production switches remain unchanged. Tests use synthetic data, preserve raw RED and source hashes. Full project verification follows final source freeze; local pass is not G0/G1.

## Task 1: Shared return contract and signin/callback implementation

**Files:** modify `packages/web/src/app/[locale]/auth/signin/page.tsx`, `app/[locale]/auth/callback/route.ts`, `components/auth/auth-provider.tsx`; create `lib/auth-return.ts`, optional focused `lib/server/auth-callback.ts`, and tests under `lib/__tests__/auth-return.test.ts`, `lib/server/__tests__/auth-callback.test.ts`, `components/auth/__tests__/auth-signin-return.test.tsx` (helper fixture outside __tests__). Any additional existing-file edit needs controller context first; save before bytes.

**Interfaces:** helper validates all return targets and canonicalizes locale; browser routes use existing SDK methods but never legacy stored next; callback keeps auth cookies while replacing script responses with standard HTTP redirects. Existing invitation-recipient supplies a supported target.

- [x] Read existing files and spec; trace raw logs, error reflection, stored-target lifecycle and cookie flow; save actual old-behavior RED using synthetic fixtures before changes.
- [x] Implement helper, best-effort legacy-key cleanup, safe signin messages/targets and late-result guards while preserving login methods.
- [x] Implement bounded strict callback with actual SSR client, cookie-aware303, fixed errors and no logs/HTML fallback.
- [x] Run focused helper/component/real SDK callback tests and previous invitation regressions, type-check and scoped lint; record counts, commands, raw .txt evidence and final source hashes; self-review.
- [x] Independent spec/quality review; resolve important findings with actual covering RED/GREEN and scoped re-review. No commits.

## Task 2: Full verification and continuation documents

**Files:** new `docs/research/2026-10-19-auth-return.md`, evidence `docs/research/evidence/2026-10-19-auth-return/README.md` and `verification.json`; update handoff, integrated plan, docs index, P0 gate spec and P1 contract notes. Preserve older evidence statements as dated history.

**Interfaces:** consume Task1 frozen source and actual reviews; controller supplies full-project logs and integrity snapshot. Distinguish page/mock, actual SDK/loopback and real-provider production facts.

- [x] Controller runs new `npm run verify`, shared tests and infra; records all exits, input fingerprints, warnings and next-env restoration. Source changes trigger appropriate rerun.
- [x] Record supported next paths, no auth_next fallback/cleanup limits, safe callback behavior and the remaining shared-session/legacy-auth/production boundaries. Record the actual before/after mixed-error implicit-fragment compatibility probe as a release blocker. Set next work first to actual OAuth/OTP return routing and browser/SSR session integration, then trusted source/event and send/release/ACL.
- [x] Independent document review and final batch review; reference actual reports, check links/hashes and baseline preservation, correct all blocking findings.
- [x] Update current status, handoff and plan checkboxes after real verification; assess original G0/G1. Keep branch and recovery data when unmet; only push GitHub if an original milestone actually passes.

# Auth session integration implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Resume this plan's recovery ledger, complete task reviews and final independent batch review. Preserve dirty work and recovery data.

**Goal:** Make newly initiated OAuth/OTP returns share a verified browser/SSR cookie session, addressing the local root cause of RB1.

**Architecture:** Existing client facade uses installed SSR PKCE cookie client with automatic URL detection disabled. Store validates current identity without persisted UI authentication. Existing bounded callback consumes browser verifier and writes cookies; request auth guard validates the same session with public credentials. Legacy landing/OTP paths use safe return and explicit outcomes.

**Tech Stack:** Existing Next.js, React, Zustand, Supabase SSR/JS, Jest and Chromium/Playwright; no dependency changes.

**Spec:** [binding specification](../specs/2026-10-19-auth-session-integration.md).

## Global constraints

- Continue `codex/october-upgrade-p0` at `1caa21a72`; review against this batch's before bytes. No commits/push without an original milestone; no remote Auth/mail/payments/family data, migrations or deployment.
- Preserve all previous work, previous evidence, dependencies, root migrations and production switches. Only exact legacy auth storage keys may be removed; never migrate cached credentials or clear business/draft data.
- Browser PKCE cookie client uses `detectSessionInUrl: false`; existing callback remains sole automatic code exchanger. Existing safe-next/parser/callback protections stay in place.
- Public provider identity verification, cookie/Bearer consistency, late-result invalidation and finite transport are required. Synthetic local browser/SDK proof never substitutes for live provider/deployment qualification.
- Before behavior changes record actual focused RED. Preserve intermediate failure logs. Source changes after freeze require affected revalidation; full project verification is controller-owned.

## Task 1: Integrate and test authentication session flow

**Files:** modify `packages/web/src/lib/supabase.ts`, `src/stores/auth-store.ts` and its existing test, `src/lib/server/auth.ts`, `src/app/[locale]/auth/verify/page.tsx`, `src/app/[locale]/page.tsx`, `packages/web/middleware.ts`; bounded related adjustments allowed in existing `auth/signin`, `auth-provider`, `auth-return`, `server/auth-callback` only if needed and justified. Add focused tests next to their code and test-support fixtures outside `__tests__`; a local browser verification script belongs under `scripts/`. Controller has saved before bytes for all allowed existing files. Ask controller before touching another existing path, do not edit old evidence or business modules.

**Interfaces:** keep `createClientSupabase()`, store actions and `getAuthenticatedUser(request): Promise<AuthResult>`. Consume existing `authReturnTarget`, `authLocale`, `hasVerifiedSession`, strict `parseSessionReturn` and callback route. New helper units may encapsulate lifecycle or bounded verification, not unrelated abstractions.

- [x] Trace installed SDK cookie/storage/PKCE behavior and current listeners; create behavioral failing tests before modifications. Save actual RED outputs and test source in current evidence.
- [x] Switch client facade to cookie PKCE; exclude implicit URL auto-handling and old storage rehydration. Configuration nucleus:
  ```ts
  createBrowserClient(url, anonKey, { auth: { detectSessionInUrl: false } })
  ```
  Prove browser `signInWithOAuth({provider:'google', options:{redirectTo,skipBrowserRedirect:true}})` returns an authorize URL with S256 challenge and writes verifier cookie, while supplying a mixed error/token URL causes no SDK `setSession`/exchange.
- [x] Implement single-listener, provider-validated store with operation generations; cover subscription before session resolution, concurrent initialize, duplicate mounts, identity change, signout and late failures. Existing signin success fixtures must represent complete provider-confirmed sessions; preserve substantive error/success checks.
- [x] Integrate public Bearer and cookie auth guard with `getAll`/`setAll`, safe failures and a ten-second bounded request. Test provider rejects forged cookie identity, explicit invalid Bearer cannot use valid-cookie fallback, cookie refresh/deletion/chunks propagate, and errors/aborts do not log raw sentinel.
- [x] Fix numeric OTP verified-result/next/lifecycle behavior and remove homepage credential forwarding plus obsolete middleware domain rewrite. Preserve ordinary homepage navigation, locales and explicit strict signin return.
- [x] Run actual SDK/loopback integration plus one real Chromium navigation/cookie flow from initiation through server callback and restored browser/SSR identity. Use synthetic environment and deny non-loopback browser network. Save counts, source fingerprints, raw logs and cleanup outcomes. Run focused auth and existing invitation regressions, typecheck/scoped lint; record self-review and concerns.
- [x] Independent spec/quality review with actual evidence; resolve new blocking findings and preserve RED/GREEN before controller full-project validation. No commits.

## Task 2: Freeze verification and update continuation documents

**Files:** new `docs/research/2026-10-19-auth-session-integration.md`, `docs/research/evidence/2026-10-19-auth-session-integration/` summary/index/reports; update handoff, integrated plan, docs index, P0 and P1 notes. Recovery `.superpowers/sdd/2026-10-19-upgrade-auth-session-integration/` owns baselines/scripts/briefs and is preserved.

**Interfaces:** Task1 frozen source plus actual task review, focused/browser evidence and controller full-project output; preserve earlier auth-return records as dated history.

- [x] Controller runs `npm run verify`, `npm test --workspace=packages/shared -- --runInBand`, `npm run test:infra`, captures exits/logs/hashes and input fingerprints; restores next-env and confirms no unexpected mutation.
- [x] Record chosen migration semantics (old localStorage users must log in again), actual local PKCE/OTP/cookie/Bearer results, browser fixture limits, remaining provider/deployment/legacy boundaries and updated RB1 status. Do not claim live-provider approval.
- [x] Update the five continuation documents, research and evidence index/summary using only observed results. Assess original G0/G1 and keep production switches closed absent evidence.
- [x] Independent documentation and final batch reviews; close actual plan/ledger status only after link/hash/baseline integrity. Keep branch and recovery; push only if an original milestone actually passes.

本批状态：本地实现、两轮问题修复、独立规格/质量/文档/整批审查及控制器最终验证均完成，见[最终汇总](../../research/evidence/2026-10-19-auth-session-integration/verification.json)。原G0/G1仍false，本批未提交、推送、迁移或部署；下一独立本地任务按handoff推进。

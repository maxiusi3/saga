# Invitation read compatibility and recovery UI implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Replace unsafe legacy invitation reads and connect both acceptance pages to the verified status/accept contract with explicit unknown-result recovery.

**Architecture:** Existing server acceptance adapter owns authentication, deadline and protocol validation. Thin GET aliases use its read-only mode; a shared React component owns recipient state and explicit actions. Pending discovery is paused until a trusted list contract exists.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase JS, Jest/Testing Library and existing loopback fixture.

**Spec:** [binding specification](../specs/2026-10-19-invitation-read-ui.md).

## Global Constraints

- Preserve current `codex/october-upgrade-p0` / `1caa21a72` and preexisting uncommitted work. No commits/push unless an original milestone actually passes; no remote/migration/deploy/mail calls.
- Only exact `INVITATION_TRANSACTIONS_ENABLED=true` enables token reads; check-pending always fails closed with 503. No service-role, cookie identity fallback, table read/write, multi-token lookup or GET mutation.
- Bearer authentication, canonical token, same SDK client, one read-only status RPC, original deadline and strict protocol apply. No token/email/credential/raw error logs or reflected debug data.
- No automatic acceptance/retry/polling. Unknown acceptance locks writes in the current page; explicit status can show a project continuation only for confirmed accepted current user. Stale token/account/unmounted results cannot mutate UI or navigate.
- Existing experiments/runtime/evidence, dependencies, root migrations and production switches remain unchanged. New tests use synthetic data and loopback only. Actual full verification is required for application changes; local pass is not G0/G1.

## Task 1: Legacy read adapters and recipient UI

**Files:** modify `packages/web/src/lib/server/invitation-acceptance.ts`, three `app/api/invitations/{[token],verify,check-pending}/route.ts`, both recipient pages and the invite-only branch of `app/[locale]/page.tsx`; create `components/invitations/invitation-recipient.tsx` and focused route/component tests (outside helper files in `__tests__`). Existing protocol/client can be reused; changes there only if demonstrably required, recorded in report. Read existing routes/pages/tests before editing.

**Interfaces:** GET aliases produce existing status shape. Shared recipient consumes existing HTTP helper and session auth; pages supply once-parsed canonical token and locale. Home invite branch routes to tokenless original-link guidance. Do not modify unrelated magiclink handling.

- [x] Read binding spec and exact call sites; write focused behavior tests and preserve actual pre-change RED in this batch evidence directory.
- [x] Implement minimal read aliases and disabled pending discovery; retain original POST behavior and deadline.
- [x] Implement shared recipient flow and both page wrappers, removing old direct reads, registration guessing, debug logs and pending auto-discovery. Keep locale return links and unknown result recovery.
- [x] Run focused route/client/protocol/component tests, type-check and relevant lint; preserve commands, counts, raw logs and source SHA-256 manifest. Check cleanup, stale responses and no credentials in evidence.
- [x] Self-review, write report, then independent spec/quality review; fix all blocking findings with covering tests and scoped re-review. Do not commit.

## Task 2: Project validation, documentation and handoff

**Files:** new `docs/research/2026-10-19-invitation-read-ui.md` and `docs/research/evidence/2026-10-19-invitation-read-ui/{README.md,verification.json}`; update handoff, main plan, docs index and P0/P1 specs with precise current evidence and next steps. Controller supplies final full-project verification and independent review reports.

**Interfaces:** consume Task 1 frozen implementation/report and actual project logs; reference previous immutable PG17/HTTP evidence as historical. Never relabel old tests as new executions.

- [x] Controller runs `npm run verify`, shared tests and `npm run test:infra`, capturing logs/exit statuses and input hashes, restoring next-env original bytes. Source changes require appropriate rerun; no repeated unchanged suites without reason.
- [x] Document supported route/UI behavior, deliberately unavailable pending/preview/history flows, actual evidence, remaining production gates and next trusted source/event/send/permission work.
- [x] Check links, hashes, no unexpected baseline changes, no private/credential exposure; independent document review and final batch review, then correct current status only after actual approval.
- [x] Update handoff and all plan checkboxes; preserve work/recovery data. Assess original G0/G1 with actual evidence and push GitHub only if achieved.

Task 2 progress: fixed-code run `20261019T023821Z` passed (Web 82/1019, shared 4/16, infra 7, 176 pages; 751 unchanged inputs and restored next-env). Documentation and current handoff are written. Independent document review, final integrity and batch review remain pending; final status/checkbox updates belong to the controller after actual approval. G0/G1 remain false; no push.

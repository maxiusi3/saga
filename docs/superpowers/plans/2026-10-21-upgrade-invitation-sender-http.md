# Invitation Sender HTTP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Track the steps below.

**Goal:** Replace legacy invitation sender/refund bypasses with gated, strictly confirmed HTTP send/release and explicit sender lookup.
**Architecture:** Consume the existing SQL unchanged through an authenticated per-request Supabase client. Keep writes single-attempt and recovery explicit. Shut legacy table/RPC/cleanup paths; distinguish this transport increment from future source selection and full sender UI.
**Tech Stack:** Next.js route handlers, TypeScript, Supabase JS, Jest/React Testing Library, synthetic loopback HTTP.
**Spec:** [Binding contract](../specs/2026-10-21-invitation-sender-http.md).

## Global constraints

- Existing checkout `codex/october-upgrade-p0`, preserve uncommitted work. No dependency/experiment/root-migration edits or real service calls. No commit/push unless the original P0/milestone condition is evidenced; no deployment or remote mutation.
- Work from `.superpowers/sdd/2026-10-21-upgrade-invitation-sender-http/` baseline and saved next-env. Current user authorizes continued implementation of the documented next batch; no repeated implementation-choice approval needed.
- Global release is intentional: sender lookup cannot be a precondition for cleanup of revoked/transferred sources. No hypothetical RPC or invented source selection.

### Task 1: Protocol, handlers, client/facade and cancellation integration

**Create:** `packages/web/src/lib/invitation-sender-protocol.ts`, `invitation-sender-client.ts`, `server/invitation-sender.ts`, matching `__tests__` files; `app/api/invitations/release/route.ts`, `lookup/route.ts`; focused test support as needed.
**Modify:** project invitation collection route; admin cleanup route; `lib/api-supabase.ts`, `lib/api.ts`; sender management page/component only for strict response handling and cancellation; existing acceptance protocol exports or transport extraction only if semantics remain unchanged and covered by prior regression tests.
**Tests:** real SDK transport, pure protocol/client/facade tests, focused React cancellation/success handling. Raw outputs under `docs/research/evidence/2026-10-21-invitation-sender-http/`.

- [x] Read actual SQL signatures/returned fields, existing acceptance transport/protocol/client and real UI call sites. Freeze protected old experiment/evidence inputs.
- [x] Before implementation, reproduce at least one real unsafe legacy behavior with a failing denial assertion and retain raw RED. Example assertion on an existing route:

```ts
delete process.env.INVITATION_TRANSACTIONS_ENABLED
const response = await oldPost(request, { params: Promise.resolve({ id: project }) })
expect(response.status).toBe(503)
expect(externalBoundary).not.toHaveBeenCalled()
```

- [x] Add strict typed parsers and request validation matching the binding tables; test malformed/missing/multiple/inconsistent rows before implementing parsers. Return only whitelisted fields. Reuse established timestamp/identity validation without changing recipient semantics.
- [x] Implement each handler with gate→input→verified Bearer→one operation→strict final result. Use exact schema/parameter names and `.retry(false)`. Observe actual mutation fetch for unknown/not_attempted; bound headers/body; cleanup every exit. Release calls only release, lookup calls only lookup. Legacy GET/DELETE/cleanup are unconditional zero-I/O 503.
- [x] Add real SDK loopback tests for exact Auth/REST headers and payloads, both role and result states, bad identity/Cookie fallback, all refusals, dropped/held responses and abort. Assert request sequences, e.g. send `[auth,send]`, release `[auth,release]`, lookup `[auth,lookup]`; explicit recovery never adds send/release. All fixtures close sockets/server/timers.
- [x] Implement strict sender client helpers and current-session facade calls; old incomplete send/list cannot perform I/O. Stable API retains data wrappers. Manage-page cancel targets `/api/invitations/release` and only confirms matching invitation/project final results; malformed/unknown responses preserve failure. Sender source selection remains explicitly unavailable, not simulated.
- [x] Run targeted tests including existing accept/read/auth regressions, retain raw logs and source hashes. Prepare implementation report and scoped diff. Independent spec review then quality review; fix actual findings with RED/GREEN and scoped rereview.

Targeted runner pattern (use actual files created):

```sh
npm test --workspace=packages/web -- --runInBand invitation-sender invitation-acceptance invitation-read-routes invitation-recipient
```

### Task 2: Project validation and reviewed handoff

**Modify:** handoff, integrated plan, docs index, P0/P1 specs. **Create:** research record and evidence summary/integrity/milestone files for this batch.

- [x] Freeze final application inputs and next-env bytes; run and retain exact logs/exits:

```sh
npm run verify
npm test --workspace=packages/shared -- --runInBand
npm run test:infra
```

- [x] Restore next-env to saved bytes. Verify allowed changed paths, unchanged old experiments/evidence/dependencies, links, source/log hashes, and `git diff --check`. Record build/audit limits separately; no unchanged prior SQL matrix reruns.
- [x] Update all entry documents with actual implementation/results/review states and next source-selection/full sender UI/production qualifications. State global release semantics and lookup limitations without claiming email delivery or new production authorization.
- [x] Independent documentation and final batch review; apply only evidenced status/checkbox updates after actual approval and fresh integrity checks.
- [x] Check original P0/G0 and subsequent quality gates. Push only if the user's existing milestone/P0 completion condition is actually met; otherwise preserve the current branch/work and report exact missing evidence.

本批本地收尾完成：Task 1规格PASS／质量Approved，Task 2文档PASS／Approved，整批最终PASS；实际结果与边界见[验证汇总](../../research/evidence/2026-10-21-invitation-sender-http/verification.json)。原P0/G0–G4未达成，条件推送未触发，未提交/推送/迁移/部署。

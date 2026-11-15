# G1 online media deletion implementation plan

> **For agentic workers:** Use superpowers:executing-plans to execute this plan in the inherited checkout. User approval to continue and waive manual gates is already recorded; do not pause for plan approval.

**Goal:** Delete captured media safely and reconcile late objects with durable evidence.

**Architecture:** Immutable capture feeds permanent reference/write fences. A separate recurring execution ledger owns per-object observations and dispatch/result events; Storage absence is time-qualified and repeatedly checked.

**Tech Stack:** PostgreSQL 17, TypeScript, Supabase Storage HTTP, Node, Jest, installed Google Chrome.

**Spec:** `docs/superpowers/specs/2026-11-09-g1-deletion-execution-design.md`.

## Global constraints

Preserve existing dirty files/evidence. Local synthetic data only. No remote migration/deployment, paid calls or raw content logging. Keep capture/replay unchanged. Manual gates are user-waived/deferred, not test passes.

## Task 1: Durable SQL execution and permanent fences

Files: `supabase/migrations/20261109000001_media_deletion_execution.sql`, `experiments/pg17-deletion-execution/{fixture,verify}.mjs`.

Interface: `media_deletion_execute(p_request_id uuid,p_run_id uuid,p_action text,p_payload jsonb) returns jsonb`; actions begin, discover, inventory, observe, dispatch, result, finish. Plans return explicit object and prefix arrays; no caller-supplied arbitrary deletion scope.

- [x] Write native tests for begin and observe-before-dispatch, with immutable capture snapshots, stale ownership, aliases and role-denied calls.
- [x] Run `node experiments/pg17-deletion-execution/verify.mjs --without-migration`; retain the missing-capability failure.
- [x] Implement SQL tables, capture binding, scope discovery, population locks, write guards, bounded leases and durable events.
- [x] Run the native tests and full migration chain; repair actual failures.

## Task 2: Actual Storage worker and runnable host

Files: `packages/web/src/lib/server/media-deletion-{execution,storage,worker}.ts`, adjacent tests, `scripts/media-deletion-worker.cjs`, package command.

Interfaces: `runMediaDeletion(requestId, options)` performs one bounded run; `runMediaDeletionWorkerOnce(options)` selects one due request fairly. options contain admin, storageUrl, serviceRoleKey, optional signal/fetch and bounded timeout. Result states are observed_absent/reconcile/blocked_reference.

- [x] Write failing tests: present -> dispatch -> delete -> absence, lost response -> unknown and later observation, malformed paths/receipts -> zero destructive calls, hung transport -> bounded return.
- [x] Implement strict RPC and HTTP boundaries, complete numeric-prefix pagination, durable results, periodic reconciliation, and explicit CLI startup.
- [x] Run tests and compile actual modules into native PG + local HTTP object I/O tests; retain unrelated bytes.

## Task 3: Chrome acceptance, review and closeout

Files: experiment acceptance runner, new evidence/report, worker operations guide, current gap register/handoff/docs index, human checklist.

- [x] Use installed Chrome and actual API route for a synthetic deletion; verify worker results and access denial from the browser. Test late object arrival after successful absence and subsequent cleanup.
- [x] Review the whole change for reference races, unsafe retries and unqualified completion claims; resolve findings.
- [x] Run `npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra`; retain logs and source hashes.
- [x] Update G1 status using actual evidence and separate user-waived manual checklist. Inspect `git diff --check` and index state before reporting.

The completed scope is online media deletion. API-visible absence is time-qualified; provider-only orphans, whole-story text erasure and the legacy product deletion button are not silently marked complete. Manual acceptance gates are waived by the user, with the follow-up list in the report.

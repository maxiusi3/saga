# G1 Recording Status Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development, with
> independent task specification/quality review and final whole-slice review.

**Goal:** Explicitly reconcile persisted recording outcomes through a strict
read-only snapshot and authorized GET, without replaying a mutation.

**Architecture:** Service-only STABLE snapshot RPC → strict server validator →
compact authenticated status response. Existing worker/finalizer remain intact.

**Tech Stack:** TypeScript/Jest, Next.js, Supabase JS, PostgreSQL 17.4.

**Spec:** `docs/superpowers/specs/2026-11-05-g1-recording-status-design.md`.

## Global Constraints

- No stage, commit, push, remote migration, deployment, paid API or family data.
- Preserve every inherited change/evidence; old evidence writers are not rerun.
- All receipts retain `canClearLocalDrafts:false`; G1 and push conditions false.
- Read only: no claim/start/heartbeat/recover/finalize/seal/Storage/delete fallback.
- No browser confirmation, story save, local cleanup, physical deletion/GC or backup scope.

## Task 1: Consistent snapshot RPC and native reconciliation evidence

Files: new `supabase/migrations/20261105000001_recording_session_snapshot.sql`,
new `experiments/pg17-recording-status/` and new evidence in
`docs/research/evidence/2026-11-05-g1-recording-status/`; only add the migration
after its prerequisites in `scripts/__tests__/deployment-config.test.js`.

Interface: exact four arguments and 13-key envelope from the spec. HTTP/native
integration consumes Task2's readRecordingSessionStatus(input,options). No old
harness edits. Task2 authors in parallel, execution waits for its freeze.

- [x] Run actual service-role missing-function invocation and preserve RED.
- [x] Implement STABLE SELECT-only SECURITY DEFINER RPC with current authorization,
  deletion guards, bounded row sets, READ COMMITTED requirement and service-only ACL.
- [x] Native tests in READ ONLY transaction assert unchanged full tuple state;
  concurrent atomic publication is seen consistently before or after, and a
  subsequent explicit read sees commit/revocation/tombstone. Cover ACL and identity
  failures, stale isolation and corrupt/ambiguous records.
- [x] Compile the actual reader/validator dependencies, execute through actual
  Supabase JS and native loopback HTTP to PG. Real publish with lost response →
  status succeeds with no new mutation; failure/unresolved/read errors/abort/timeout
  remain bounded and copies unchanged. Retain source/runtime snapshots and cleanup.
- [x] Record actual commands/results and self-review in task-1-report.md; keep
  all failed executions. Obtain independent task review before closing.

## Task 2: Strict reader and authenticated GET

Files: new `packages/web/src/lib/server/recording-session-status.ts` plus test;
new status `route.ts` and colocated tests; expose pure parser/hash helpers in
existing `recording-job-input.ts` with no new imports or old behavior change.
May split pure snapshot validation into new `recording-status-validation.ts` if
needed; keep request I/O and pure validation clearly separated, not giant functions.

Interfaces: exact input/options/compact receipt in spec, RPC envelope contract
shared with Task1. Read proof is not cleanup authorization or access capability.

- [x] Write failing behavior tests before implementation. Cover terminal tuple
  mismatches, strict UTC/microseconds/identity/content, no stale/corrupt success,
  candidate/attempt history, unresolved/partial registration and schema pollution.
- [x] Implement pure validation using existing manifest/identity/candidate logic,
  one bounded no-retry read RPC, frozen inputs/output and fixed error messages.
- [x] Implement GET auth/flag/query validation, actor derivation, no-store/cookie
  preservation, exact response status and zero mutation/signing branches. Tests
  include caller cancellation and malformed/lost response plus single request.
- [x] Run focused tests, typecheck and historical verifier/candidate compilers.
  Preserve RED/GREEN logs and provide task-2-report.md for independent review.

## Task 3: Full gate and handoff

- [x] Run npm run verify, shared tests and infra tests on frozen sources; record
  source hashes, actual exit status/logs, restore only generated next-env bytes.
- [x] Obtain final independent review; fix actual findings and rerun affected checks.
- [x] Verify all old evidence/inherited files, HEAD/index and git diff --check.
- [x] Update current handoff/index/report and final verification/integrity receipts
  with exact completed scope and outstanding client/GC/backup/cloud/device gates.

# G1 Recording Worker Lease Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Preserve prior dirty work; do not commit or push.

**Goal:** Move recording claim/lease/heartbeat from the PoC to dedicated formal-schema RPCs and connect the existing read-only verifier.

**Architecture:** The database owns state, time and attempt fences. The server adapter strictly validates RPC receipts; the verifier holds a running fence while timers renew or cancel it. No output publication is introduced.

**Tech Stack:** PostgreSQL, PL/pgSQL, TypeScript, Supabase JS, Node, Jest, native FFmpeg.

**Approved design:** `docs/superpowers/specs/2026-11-03-g1-worker-lease-design.md`.

## Task 1: Formal database lease operations

Files: create `supabase/migrations/20261103000001_recording_worker_leases.sql`;
update `scripts/__tests__/deployment-config.test.js` migration list.

- [x] Implement the exact five-action RPC and receipt in the design, after the new PG harness demonstrates absence of the RPC (RED).
- [x] Preserve session/chunk write restrictions and existing registration/deletion callers; enforce service-role-only execution, fixed search path, attempt uniqueness and database-time fencing.
- [x] Run isolated PostgreSQL normal/adversarial scenarios, fix failures, obtain independent review.

## Task 2: RPC client, running reader and supervised verification

Files: create `packages/web/src/lib/server/recording-job-lease.ts` and its test;
create `recording-job-worker.ts` and its test; modify `recording-job-input.ts`,
`recording-job-verifier.ts` and associated tests. All paths are under the same server directory.

- [x] Write/run RED protocol tests for job/worker/attempt/identity/time/receipt mismatches, timeout/abort and unknown mutation outcomes.
- [x] Implement the RPC client with no automatic retries or error-body leaks.
- [x] Write/run RED running-reader tests: valid fence, heartbeat-only drift accepted, other drift/expired or wrong fence rejected, original queued mode unchanged.
- [x] Implement optional fenced reads and immutable pin projection; pass the lease through the existing verifier.
- [x] Write/run RED supervised-worker tests for ordered claim/start/verify, serial heartbeat, lost lease/timeout/caller abort, conservative deadline and timer cleanup.
- [x] Implement the supervised verifier without ready/cleanup/terminal-success writes; run all recording regression tests.

## Task 3: Real local SQL/process/audio verification

Files: create `experiments/pg17-recording-worker/verify.mjs` and README; optionally
add tightly scoped helpers inside that directory. Reuse the read-only PG17 runtime,
never edit or rerun historical harnesses that overwrite earlier evidence.

- [x] Produce RED with the new RPC absent; use formal foundation and seal migrations in an isolated synthetic cluster.
- [x] Test concurrent processes, rollback, stale fences, live heartbeat, real expiry and SIGKILL after leased/running; require the documented persisted recovery state and no automatic unknown retry.
- [x] Test permission/tombstone failures and real lock waits spanning a deadline.
- [x] Exercise the new TS client/running verifier with real PostgreSQL and native FFmpeg over synthetic source bytes; report any substituted transport boundary explicitly.
- [x] Record source/log hashes and verify cluster/child/socket/temp cleanup. Keep unique run directories, including failed runs.

## Task 4: Review, full gate and handoff

- [x] Independent specification then quality review; fix every blocking finding through a regression test.
- [x] Run `npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra` and check complete exit status.
- [x] Verify new text whitespace, prior evidence hashes and final source hashes; restore only known build-generated next-env bytes.
- [x] Update the new report, `docs/HANDOFF-2026-10-13-upgrade.md` and `docs/README.md`; clearly retain G1=false and all deployment/real-device gaps.

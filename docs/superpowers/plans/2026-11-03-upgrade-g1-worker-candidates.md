# G1 Recording Worker Candidates Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans. Preserve dirty work; do not stage, commit or push.

**Goal:** Persist a verified private candidate without publishing ready or granting local cleanup.

**Architecture:** One immutable candidate per attempt; dedicated guarded RPCs reserve and prepare. The lease supervisor encloses merge, stream upload and complete readback. Unknown outcomes retain all remote data.

**Tech Stack:** PostgreSQL 17, TypeScript, Supabase RPC/Storage HTTP, Node streams, Jest, native FFmpeg.

**Design:** `docs/superpowers/specs/2026-11-03-g1-worker-candidates-design.md`.

## Task 1: Candidate SQL and Database Verification

Files: new migration `supabase/migrations/20261103000002_recording_output_candidates.sql`,
new `experiments/pg17-recording-candidates/` harness, migration list in
`scripts/__tests__/deployment-config.test.js`.

- [x] Add a real PG probe asserting the exact candidate RPC exists; run without the new migration to preserve missing-feature RED.
- [x] Implement the schema, private bucket restrictions and two-action RPC exactly as specified, calling the existing lease check within the transaction.
- [x] Exercise real concurrent actors, immutable metadata, stale/expired fences, commit-response loss, rollback, permission/cancel/deletion and restrictive storage policies against broad permissive policies.
- [x] Run `node experiments/pg17-recording-candidates/verify.mjs --sql-only`; require no ready/succeeded/confirmed rows and complete cluster/process cleanup.

## Task 2: Candidate Adapter and Supervised Scoped Merge

Files: new `recording-output-candidate.ts`, `recording-candidate-storage.ts`, `recording-candidate-worker.ts` and
corresponding tests under `packages/web/src/lib/server/`; modify
`recording-job-verifier.ts`, `recording-job-worker.ts` and their tests.

- [x] Write/run failing strict receipt and bounded/cancelled RPC tests; implement reserve/prepare with `.abortSignal(signal).retry(false)` and exact identity comparison.
- [x] Write/run failing real-stream upload/readback tests; implement immutable POST, complete hash/length verification and owned resource cleanup.
- [x] Write/run failing scoped-consumer and candidate-worker tests; add the callback and shared supervisor while keeping old read-only results unchanged.
- [x] Run targeted suites with `npm test --workspace=packages/web -- --runInBand --runTestsByPath src/lib/server/__tests__/recording-output-candidate.test.ts src/lib/server/__tests__/recording-candidate-storage.test.ts src/lib/server/__tests__/recording-job-verifier.test.ts src/lib/server/__tests__/recording-job-worker.test.ts`.

## Task 3: Native Integration and Independent Reviews

Files: application integration helpers in `experiments/pg17-recording-candidates/`,
new evidence under `docs/research/evidence/2026-11-03-g1-worker-candidates/`.

- [x] Run the new worker through actual PG RPC mutations, native loopback HTTP and FFmpeg; use only synthetic audio and temporary isolated clusters.
- [x] Cover upload response loss, prepare response loss, process kill, no-overwrite duplicate, corrupt/truncated/stalled response, revocation/cancel during I/O, heartbeats and zero leaked streams/processes/temp directories.
- [x] Obtain independent specification review, fix blockers, then independent quality review and final focused verification.

## Task 4: Full Gate and Handoff

- [x] Run `npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra`; preserve exit code, counts and compressed logs.
- [x] Verify source hashes stayed fixed, all old evidence unchanged, no staged files, `git diff --check`; restore only the verified build-generated next-env import.
- [x] Update candidate report, evidence index, `docs/HANDOFF-2026-10-13-upgrade.md`, `docs/README.md`. Keep G1=false and distinguish all cloud/device/backup/performance gaps.

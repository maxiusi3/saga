# G1 Terminal Worker Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to execute
> each task, followed by independent specification and quality review.

**Goal:** Connect a complete supervised recording attempt to the strict atomic
publication/permanent-failure boundary.

**Architecture:** Share candidate preparation between the old prepare-only
worker and a new terminal entry. Carry only prepared evidence or a branded
pre-consumer permanent error through the existing lease supervisor. Finalize
after it returns and has drained all owned work.

**Tech Stack:** TypeScript, Jest, Supabase JS, native PostgreSQL 17.4, HTTP, FFmpeg.

**Spec:** `docs/superpowers/specs/2026-11-05-g1-terminal-worker-design.md`.

## Global Constraints

- Preserve inherited uncommitted work and all previous evidence.
- No staging, commit, push, remote migration, deployment, paid calls or real family data.
- All success and failure receipts retain `canClearLocalDrafts:false`.
- No browser status/reconciliation, client confirmation/cleanup, idempotent story save, physical deletion/GC or backup changes in this slice.
- G1-01 remains partial, `g1MilestoneSatisfied:false` and `pushConditionSatisfied:false`.
- No retry, fallback failure, direct table mutation or deletion after an uncertain result.

## Task 1: Supervised terminal entry and ordering tests

**Files:** Add `packages/web/src/lib/server/recording-terminal-worker.ts` and
`__tests__/recording-terminal-worker.test.ts`. Refactor only the preparation
sequence in `recording-candidate-worker.ts` to share it without importing new
terminal dependencies into the old worker. The existing lease supervisor,
verifier, finalizer, SQL and their contracts remain intact.

**Interface:** Export
`finalizeLeasedRecordingJob(jobId: string, options: Parameters<typeof withRecordingJobLease>[1]): Promise<RecordingJobFinalization>`.
The candidate helper can produce a discriminated preparation outcome consumed
by both entries. A failed preparation throws as before from the old entry;
the new entry carries only branded pre-consumer permanent errors to finalization.

- [x] Write behavior tests first; record missing-entry RED under the new evidence directory. The central assertion is that publication remains absent while cleanup or a heartbeat is pending, and occurs after the final check with the latest lease.
- [x] Implement shared preparation and terminal orchestration. Use a discriminated outcome, snapshot options including nested FFmpeg configuration, and call `publishRecordingJob` or `failRecordingJob` only after `withRecordingJobLease` resolves. Normalize every exposed error to `recording_worker_unavailable`.
- [x] Cover all six permanent codes, transient/forged/generic errors, failure after entering the candidate callback, candidate unknown responses, cleanup/revalidation failure, heartbeat/check failure, deadline and cancellation boundaries, finalizer response loss without fallback, caller mutation, and old prepare-only behavior.
- [x] Run new and affected Jest suites plus `npm run type-check` and both historical compiler graphs. Keep exact commands/exit codes/logs in a task report and retain intermediate failures.
- [x] Self-review; report file list and concerns to the controller for independent review. Do not commit.

## Task 2: Native full-attempt integration

**Files:** New `experiments/pg17-recording-terminal-worker/` modules/README and
new evidence under `docs/research/evidence/2026-11-05-g1-terminal-worker/`.
Do not edit prior harnesses or evidence. Reuse their exported fixtures/runtime.

**Interface:** Compile and call Task 1's `finalizeLeasedRecordingJob` with an
actual Supabase JS admin and a fetch wrapper mapping only the synthetic origin
to loopback. Use the existing native PG fixture and intact migrations. New
runner `node experiments/pg17-recording-terminal-worker/verify.mjs` accepts the
existing `SAGA_FFMPEG_PATH` convention.

- [x] Build a new loopback fixture with real streamed Storage bytes and parameterized PG RPC dispatch. Record each request, outcome, candidate and full terminal tuples. Snapshot all executed source files and runtime binaries.
- [x] Verify successful publication after FFmpeg and local cleanup, heartbeats covering slow preparation, real bad-byte/hash or invalid-audio permanent failure without candidates, post-candidate failure without terminal mutation, commit followed by malformed/lost response, and cancellation/revocation before publication. Assert one terminal request and no later heartbeat/check; assert retained bytes and no retry/fallback/deletion.
- [x] Run the new harness, fix harness-only defects, preserve each failed execution. Record source drift and cleanup of HTTP handlers/sockets, decoder processes/files, PG clients/cluster/socket directories; report limits plainly.
- [x] Self-review and send the controller a report for independent specification/quality review. Do not commit.

## Task 3: Whole-slice validation and handoff

- [x] Freeze source hashes and run `npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra` with logged exit status. Restore only build-generated next-env bytes.
- [x] Obtain independent final review of the scoped patch, tests and native evidence; fix material findings and rerun affected checks.
- [x] Check old evidence and inherited files against the start snapshot, unchanged HEAD and empty index, source consistency and `git diff --check`.
- [x] Write the research report/evidence README/final receipt; update the current handoff and docs index with completed Worker scope and explicit remaining G1 gates.

# Final independent review: G1 terminal worker slice

Date: 2026-11-05. **Specification: Approved. Quality: Approved. Ready to finish
this local slice: Yes.** No Critical, Important or actionable Minor finding.
This is a local implementation/evidence verdict, not merge, push, deployment or
G1 acceptance authority. The controller still owns the planned final receipt,
documentation status updates and final preservation check after those writes.

## Scope and review identity

- Reviewed the binding design, implementation plan, progress ledger, both task
  reports/reviews and the exact seven-file `final-review.patch`. The candidate
  worker is compared with its takeover bytes, not treated as wholly new code.
- Reconstructed all seven complete files from that patch and compared their
  bytes with current files and `final-review-hashes.json`. All match. The old
  candidate worker reconstructs to the saved 22-line file and baseline SHA256
  `a679b9502d1691df9879ec53ec05d198106846da803791f39aa29db9b7a52356`.
- Read the complete changed implementation, tests and native harness. Focused
  dependency reads checked the supervisor, verifier, strict finalizer, processing
  error brand, native SDK client/compiler, SQL failure fence and fixture cleanup.
  This does not re-review the whole inherited dirty branch.
- Checked the current handoff top, docs index, new research report and new
  evidence README. Their pending final-review status is intentional. Task 2
  review is now approved and those pending fields should be closed with this
  verdict by the controller, as already planned.
- No test suite or native scenario was rerun. Review checks were read-only
  reconstruction, hashes/decompression, retained-log/trace inspection, current
  resource-path checks and Git inspection. Only this report was written.

## Strengths and specification alignment

- **The terminal boundary is outside settled supervision.**
  `packages/web/src/lib/server/recording-terminal-worker.ts:7-29` implements the
  exact entry signature and awaits `withRecordingJobLease` before either
  terminal operation. The existing supervisor at `recording-job-worker.ts:70-92`
  waits for owned work, stops and drains heartbeats, checks the live lease, then
  clears timers/listeners and aborts its finished scope. The terminal entry uses
  the returned checked lease and original caller signal, so the supervisor's
  final scope abort cannot cancel a valid handoff or cause a post-terminal check.
- **Preparation remains reusable without widening the old compiler graph.**
  `recording-candidate-worker.ts:1-39` keeps its imports, sequence and old success
  shape. The helper settles the entire verified-artifact scope before exposing
  an outcome; the old entry rethrows a failed outcome inside supervision as
  before. It does not import the finalizer or terminal entry. Caller options and
  nested FFmpeg options are snapshotted before the first await.
- **Permanent failure is conservative and independently fenced.**
  `recording-candidate-worker.ts:10-27` marks the consumer boundary before any
  reservation attempt. `recording-terminal-worker.ts:14-19` carries only an
  actual WeakSet-branded permanent processing error before that boundary; all
  other errors reject inside supervision. The unchanged SQL at
  `supabase/migrations/20261104000001_recording_job_finalization.sql:79-85`
  rejects failure if any candidate exists for the job, including older attempts.
  No new registration, retry, fallback failure, direct table write or deletion
  is introduced on an uncertain outcome.
- **The handoff preserves strict receipt and timing contracts.**
  `recording-terminal-worker.ts:18-27` carries the effective supervisor RPC
  timeout and passes the exact prepared candidate to the existing finalizer.
  That finalizer snapshots closed scalar evidence, checks identity and the
  conservative deadline, disables retry and validates the returned terminal
  tuple. Both receipt variants retain `canClearLocalDrafts:false`; no running
  lease is attached. All exposed orchestration errors become the fixed
  `recording_worker_unavailable` message.
- **Behavioral coverage crosses the task boundary.** The 46 new Jest cases use
  the real supervisor and finalizer with controlled lease/I/O boundaries. They
  exercise pending cleanup/heartbeat/check, latest-lease handoff, six permanent
  codes, forged/transient/post-consumer errors, deadline/cancellation, lost or
  malformed final responses, option mutation and old-entry behavior. The native
  harness then calls the actual compiled entry with actual Supabase JS, native
  fetch streams, PostgreSQL transactions and FFmpeg, covering the real byte,
  cleanup and terminal-tuple behavior that the controlled unit boundaries cannot
  establish.

## Evidence verified independently

- `docs/research/evidence/2026-11-05-g1-terminal-worker/full-gate-01.json` records
  exit 0 and no drift across 717 before/after source hashes. Both raw/gzip log
  hashes match the manifest, and decompression reproduces the raw log. The three
  reviewed production/test hashes match both gate snapshots. The retained log
  confirms canonical type-check/lint, Web **151 suites / 2,875 tests**, shared
  **4 / 16**, infra **14**, and **184** built pages. Task 1 retains the focused
  **7 / 303** and two successful historical compiler checks.
- Authoritative native evidence is
  `native-2026-11-05T03-06-28.682Z-bcabfa65-b516-4ccb-a452-4ff91d9e66f9/results.json`
  under the same evidence directory: **8/8 scenarios, 11,391 assertions**.
  Independently checked all **137 gzip archives** for compressed hash, decoded
  hash and byte length, all **112 current source hashes**, and all **17 compiled
  module hashes** against their retained snapshots. Source, compiled and runtime
  drift arrays are empty; the five current executable fingerprints also match.
- Raw native chronology supports the order, not merely the final status. In the
  renewed-success case, 31 heartbeats extend the initial one-second lease; the
  last check finishes at 8403.109448 ms and publish arrives at 8403.660077 ms.
  For every terminal case, all observed decoder/file/removal resources and every
  preceding heartbeat have settled before the terminal request, which is the
  final worker HTTP request. The exact success/failure tuple deltas and retained
  source/candidate byte hashes are recorded and asserted by the runner.
- Both real permanent failures reserve no candidate. Corrupt candidate readback,
  cleanup cancellation and post-cleanup revocation make zero terminal calls.
  HTTP response loss and malformed receipts occur after actual committed publish
  transactions and produce one fixed unavailable result without fallback. The
  committed response-loss request has `responseLost:true` in the raw record.
- Native cleanup records zero remaining processing resources, caller listeners,
  HTTP handlers/sockets and PG clients, with restored observers and no emergency
  rescue. Cluster/PID/temp/socket cleanup passed; the recorded scratch and socket
  directories are currently absent. All five native execution records remain,
  including the early-revocation failure and the earlier runs without emitted
  JavaScript snapshots; only the final 17-module run is authoritative here.
- At review time, all **2,744 prior evidence hashes** in `prior-evidence.json`
  match. Across the **3,800** takeover paths in `baseline.json`, none is missing;
  only the intended candidate-worker reuse and the current handoff/docs-index
  edits differ. `git diff --check` passes, the staged diff is empty, and HEAD
  remains `c0669e8058343f91deba8e468b03e4bf817b1ca5`. Inherited uncommitted work
  remains present; this is not a clean-working-tree claim.

## Issues

### Critical (Must Fix)

None found in the scoped implementation or authoritative retained evidence.

### Important (Should Fix)

None found. No source correction or additional test execution is required by
this review.

### Minor (Nice to Have)

No actionable new minor finding. The already-recorded direct workspace ESLint
tooling failure is not a canonical-lint failure, and the successful full build
still contains inherited configuration warnings. Preserve those records and
do not describe the output as warning-free.

## Recommendations and qualification limits

- Close the planned Task 2/final-review pending fields in the plan, progress,
  research/evidence summary, handoff and docs index, then create the final
  receipt and repeat the planned preservation/diff check. These are expected
  controller completion steps, not additional product decisions or source fixes.
- Retain the explicit qualification on the plan's runtime-snapshot wording:
  executable paths/versions/hashes identify binaries, but executable bytes are
  not archived. OS-linked libraries and Node builtins are outside independent
  source capture. Do not represent this as a fully reproducible binary archive.
- The retained initial RED is a missing-module failure with zero tests executed;
  the next two failures concern the spy/export fixture. They establish the
  implementation history, not an observed failing ordering assertion. Current
  behavioral correctness is supported by the passing controlled tests and native
  traces, as the task report already distinguishes.
- Native HTTP is a PostgREST-shaped local adapter with synthetic Storage and
  fixture prerequisites. The no-late-request observation is 250 ms, supported by
  the inspected supervisor stop/drain logic, not an unbounded runtime proof.
  Managed PostgREST/Storage, TLS/auth, full deployment migration replay, long
  device audio, forced worker death and other cancellation/revocation timings
  remain outside this evidence. The lost response is after acknowledged SQL
  COMMIT, not PostgreSQL wire COMMIT-acknowledgement loss.
- Keep terminal read/reconciliation, client confirmation, idempotent story save,
  local draft cleanup, deletion-target capture/GC, candidate backups and the
  remaining cloud/device gates as subsequent work. G1-01 stays partial;
  `g1MilestoneSatisfied:false`, `pushConditionSatisfied:false` and
  `canClearLocalDrafts:false` remain binding.

## Assessment

**Specification: Approved. Quality: Approved. Local-slice completion readiness:
Yes. Ready to merge: not assessed or authorized.**

The seven-file slice correctly joins settled supervised preparation to the
existing atomic terminal adapter, preserving uncertainty and old-entry
contracts. The frozen unit/full-gate and native evidence support finishing this
local slice with the stated limits and the controller's already-planned final
documentation/integrity steps; they do not close the broader G1 gates.

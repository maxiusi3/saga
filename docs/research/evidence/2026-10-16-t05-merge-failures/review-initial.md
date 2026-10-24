# Task 1 independent initial review

## Spec verdict: changes requested

Task 1 implements the intended prepare-only failure settlement, bounded retries and transactional fencing, but does **not** meet the explicit requirement that unavailable FFmpeg and unclassified resource failures stay conservative. One Important finding blocks acceptance. No Critical or Minor findings identified in this bounded review.

Reviewed the supplied `review-package.md` once as the changed-code view, relative to the captured start-of-batch snapshot. All 12 companion source hashes match the current files. I did not inspect the historical HEAD diff or change source, index or branch. Additional source reads were limited to the transaction/guard/retry helpers and runner heartbeat boundary needed to assess the new branch.

## Concrete strengths

- `RecordingProcessingError` combines immutable fixed code/disposition with construction identity in a WeakSet; copied fields and a forged prototype cannot classify an ordinary Error. The store checks the external stop signal before accepting that identity.
- The new catch surrounds only `prepare`. The later prepared-output checkpoint, disk readback, guard, publication and COMMIT remain outside it. Iterator/source-handle/temp/output cleanup failures suppress known-error processing, so a known failure cannot silently authorize retry after failed cleanup.
- Failure persistence reuses the job-then-queue guard, current business attempt/owner/input digest checks, cancellation/revocation/deletion checks and database clock. Snapshot, current attempt audit, delayed ID-only retry envelope and acknowledgement use the same database transaction. Late abort and deadline checks can roll them all back.
- Retry uses the existing state helper and persisted `maxAttempts`, preserves attempt count and queue runtime limits, applies the 1/2/4/5-second cap, and acknowledges early duplicates before calling the claim helper. The attempt audit contains only `{code, disposition, phase}`. The recording path still bypasses the synthetic provider ledger.

## Findings

### Important R1 — generic decoder exits are incorrectly treated as permanent input failures

**Location:** `packages/web/src/lib/server/recording-audio-decoder.ts:78` (with durable effect in `experiments/t05-durable-worker/store.mjs:543` and the permanent-failure branch immediately below `:558`).

The close handler creates `recording_decode_rejected` whenever `code !== 0 || diagnosticBytes > 0`, unless a spawn error, external signal or earlier watchdog failure was already recorded. A successfully spawned process can subsequently fail to load a runtime dependency and exit 127, or FFmpeg can encounter a resource error and exit 1 with short stderr. Neither condition proves the input audio is permanently invalid. Both reach this branch, gain permanent typed identity, and cause the store to mark the job/attempt failed and acknowledge the envelope. Repairing the runtime then cannot resume that job through the intended queue path.

**Explicit spec conflict for controller judgment:** Task 1 brief line 39 requires “FFmpeg不可用、内部未知异常及未明确判定的资源问题保持保守异常” while also requesting permanent classification for decoder rejection. A generic FFmpeg exit code or the presence of diagnostics cannot establish that distinction. The conservative requirement must not be silently weakened to satisfy the malformed-audio case.

**Narrow verification:** Completed an in-memory probe of the current TypeScript decoder with injected child-process events. A close event with exit 127 plus a short loader diagnostic, and one with exit 1 plus a short resource diagnostic, both returned a genuine `RecordingProcessingError`, code `recording_decode_rejected`, disposition `permanent`. The probe exited **1** because its conservative-classification expectation failed. This was a synthetic event-level check, not reproduction of a naturally occurring OS resource fault. It completed before the later review interruption; it spawned no child process, wrote no temporary file and left no owned process to clean up.

The existing “unavailable” unit case at `packages/web/src/lib/server/__tests__/recording-audio-decoder.test.ts:175` uses a missing executable, which exercises spawn failure but misses failure after successful spawn. Healthy FFmpeg 7.1 integration runs do not establish this distinction either.

**Required direction:** Keep unproven nonzero exits/diagnostics unclassified. Emit permanent decoder rejection only from evidence that reliably distinguishes an input failure from runtime/resource failure; do not introduce diagnostic-message matching. If the present FFmpeg interface cannot provide that evidence, document the narrow plan refinement and adjust the malformed-input expectations under controller judgment. Add regressions for unavailable runtime after successful spawn and ambiguous resource failure, retaining cancellation and process-close guarantees.

## Evidence assessment and limits

I independently recomputed the source hashes embedded in the three final integration reports: no mismatches. Their scenario records all pass: failure **42/361**, merge **52/402**, original T05 **39/307**. Each records no remaining owned groups/runners/direct operations, a stopped cluster, removed temporary directory and no cleanup errors. The focused log reports **3 suites/67 tests**. Project logs and `project-checks.json` agree on **76 suites/728 tests**, types/lint, **175 pages**, shared **4/16** and infra **7**. These passing checks remain valid evidence for the covered cases; they do not cover R1.

The retained RED evidence is consistent with missing behavior: ordinary ENOENT and source timeout escaped instead of producing durable states, and the focused RED log records the missing typed identity/cleanup behavior. Preliminary fixture failures are separately identified and were not counted as behavior RED.

The increment stays within the specified helper/experiment/test/README footprint. No production-route, dependency or general state-machine edits appear in that increment. I cannot independently certify from this bounded review all historical worktree preservation, the actual pre-build saving/restoration of `next-env.d.ts`, or unchanged external cleanup-observer behavior; the controller's separate audit/evidence owns those assertions. G0/G1, production authorization/Storage/schema, real-device behavior and external runtime provisioning are not verified by this batch. No broader suite was rerun for this review.

## Final quality verdict

**Request changes for Important R1.** The transaction and cleanup boundaries are otherwise carefully implemented and supported by substantial focused evidence. Re-review the decoder classification correction and the resulting evidence/documentation changes before marking Task 1 complete.

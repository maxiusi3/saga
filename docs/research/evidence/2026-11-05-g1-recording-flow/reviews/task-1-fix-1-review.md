# Task 1 fix 1 review

## Spec Compliance

- ✅ Spec compliant for the requested I1/M1 correction. Both findings from `task-1-review.md` are addressed; no new regression was identified in the four-file fix diff.
- ✅ I1: SQL now derives the actor/project/session UUIDv8 and canonical processing key from validated ordered chunks, and requires both stored keys and the asset identity to match before the existing story/intent updates (`supabase/migrations/20261106000001_recording_story_save.sql:170`, `:208`, `:215`, `:224`). This rejects equal-but-noncanonical keys as well as either key being corrupted independently.
- ✅ M1: metadata validation requires a primitive string before enum membership; both single-element array forms have regression coverage (`packages/web/src/lib/recording-save-contract.ts:30`; `packages/web/src/lib/__tests__/recording-save-contract.test.ts:20`).
- ⚠️ Approval is limited to the reviewed Task 1 correction. Combined repository, browser cleanup and device/cloud G1 validation remain controller/downstream responsibilities, as in the prior review.

## Strengths

- The immutable-identity checks run before story/intent DML, while the independent application snapshot validator remains unchanged. This fixes the committed-ready/API-rejection split without weakening cleanup validation (`supabase/migrations/20261106000001_recording_story_save.sql:224`; unchanged `packages/web/src/lib/server/recording-story-save.ts:44`).
- The native regression compares complete before/after story and intent rows through the actual application confirmation service, rather than accepting an error response alone as proof of rollback (`experiments/pg17-recording-flow/verify.mjs:102`). It covers the original keys plus coherent asset rebinding and malformed rehashed manifest/path cases.
- The saved pre-fix migration drives the same corrected regression fixture, and produces the original defect for all six cases. Original source snapshots and failed evidence were retained (`experiments/pg17-recording-flow/verify.mjs:9`, `:15`; appended fix section in `task-1-report.md`).

## Issues

### Critical (Must Fix)

- None.

### Important (Should Fix)

- None remaining within the I1/M1 correction scope.

### Minor (Nice to Have)

- None introduced by this correction.

## Checks and Evidence

- Read `task-1-fix-1.patch` once and the appended fix report. Verified all 17 current source hashes against `task-1-fix-1-hashes.json`; verified all 17 preserved snapshots against the original `task-1-review-hashes.json`. Exactly the four declared files differ between manifests. The native final result's recorded source hashes also match the current files.
- Named regression risk — canonical identity compatibility: compared the new derivation with existing `recording_job_lease` validation/derivation (`supabase/migrations/20261103000001_recording_worker_leases.sql:133`, `:174`, `:182`) and the application's UUID derivation and strict manifest parser (`packages/web/src/lib/server/recording-session-service.ts:62`; `packages/web/src/lib/server/recording-job-input.ts:55`). The new UUID bit masks, tuple order, chunk digest, fixed job versions, paths, MIME restriction and input quota align with the existing recording contract. The mandatory nonnull story binding is appropriate for this reserved-story confirmation path. No lock-order, authorization, cleanup-receipt or application-validator changes occur in this fix.
- Read the final native log and full `native-1793897371784-10f01fb5-7af7-4500-9d09-6a961e7438ba/results.json`: **130 assertions passed**. Each of the six recorded corruptions returns application status **409**, no receipt, and exactly equal full story/intent JSON rows before and after; story stays `processing`, audio URL and confirmation time stay null. Cleanup reports cluster stopped, temporary directory removed, zero clients and zero errors.
- Read the saved-baseline native log and full `native-1793897369215-97ade854-0527-4ebd-b656-4545de3746df/results.json`: the preserved original migration hash is the original reviewed hash. All six mutations return application **503** with changed rows, story `ready`, and confirmed intent. The expected RED assertion fails on unchanged-row verification. Cleanup is complete.
- Read `task-1-fix-1-contract-red.log`: both array-mode regressions fail before the primitive-string fix (2 failed / 10 passed). Read `task-1-fix-1-focused-final.log`: **7 suites / 169 tests passed**, without warning/error noise.
- Read the final type-check, ESLint and diff-check evidence named by the report; they are clean. No suites, native harnesses or other validation commands were rerun during this scoped re-review.
- Only this review report was written. No production files, index, HEAD, preserved evidence, remote service or paid service was modified or invoked.

## Assessment

**Spec compliance: Approved.**

**Task quality: Approved.**

The prior reproducible immutable-identity failure is now rejected before writes, with meaningful native before/after evidence through the actual application service. The metadata type assertion is also corrected and covered by the two previously failing inputs.

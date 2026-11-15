# G1-01 Worker terminal orchestration

Date: 2026-11-05 (Asia/Taipei). This continues the next step recorded in chat
“33” and the current handoff: connect the existing candidate and finalization
primitives after local cleanup, input revalidation and heartbeat drain.

## Scope and contract

Add `finalizeLeasedRecordingJob(jobId, options)` in
`packages/web/src/lib/server/recording-terminal-worker.ts`. Options are the
existing `withRecordingJobLease` options. The result is the existing strict
`RecordingJobFinalization` receipt, without a running lease attached. This is
one explicitly invoked attempt, not a resident scheduler or a browser route.

The successful path is claim → start → verified input/FFmpeg → reserve →
immutable upload and full readback → prepare → input revalidation → local
artifact cleanup → final input revalidation → stop/drain heartbeat → lease
check → leave supervision → publish. There must be no active-lease check or
heartbeat after terminal mutation. Use the last checked lease, the exact
prepared candidate, original caller cancellation and the same effective RPC
timeout as supervision. The finalizer already bounds time by the conservative
lease deadline. An expired handoff rejects rather than extending a lease or
retrying implicitly.

Reuse the preparation sequence for the existing prepare-only entry. A small
shared preparation outcome helper may live in `recording-candidate-worker.ts`;
it must not import the finalizer or terminal worker, so both historical
verifier and candidate compiler graphs remain executable. Do not change the
old prepare-only entry's returned shape or its failure behavior.

## Permanent failure and uncertain outcomes

Only an actual WeakSet-branded `RecordingProcessingError` with permanent
disposition, raised before the verified-artifact consumer begins, may be
carried as a failure outcome through the supervisor. By that time verifier,
iterator/file/FFmpeg cleanup has settled. The artifact-consumer boundary is
conservative: any error from reservation, upload, prepare, post-consumption
revalidation or later cleanup is unavailable, even if it resembles a permanent
error. No candidate registration may be attempted on the permanent failure
path. The supervisor must still drain heartbeats and successfully check the
lease before `failRecordingJob` runs. The SQL transaction additionally refuses
failure if any candidate exists for the job, including an older attempt.

Claim/start/check errors, heartbeat failure, timeout, revocation, deletion,
cancellation, transient/forged errors and ambiguous processing results never
cause terminal failure. A lost/bad/cancelled finalization response may already
have committed. Return only a fixed `recording_worker_unavailable` error, with
no provider message, retry, fallback failure, direct table write or deletion.
Snapshot caller options used across the attempt so later caller mutation cannot
change the admin, identity, cancellation or final RPC timeout. All success and
failure receipts retain `canClearLocalDrafts:false`.

## Verification

Use behavioral RED/GREEN tests with the real supervisor and controlled async
dependency boundaries to prove ordering, heartbeat drain/renewal/failure,
caller cancellation during cleanup/check/finalization, latest lease use,
permanent versus transient/forged/post-consumer errors, and unchanged old
prepare-only behavior. Do not merely mock the top-level supervisor to return
the desired sequence.

Add a new native integration harness under
`experiments/pg17-recording-terminal-worker/`. It reuses the existing pinned
PG17 runtime and foundation fixtures without running old evidence writers.
Compile actual production modules, use actual Supabase JS/native loopback HTTP,
synthetic Storage bytes and native FFmpeg, and apply the full seal/lease/
candidate/finalization migrations. Prove published asset/job/attempt/session
tuples and retained source/candidate bytes, a real bad-input permanent failure,
post-candidate failure with no terminal write, finalization response loss after
commit, cancellation/revocation, and zero heartbeats/active checks after
finalization. Verify no active decoder, merged file, HTTP listener/handler,
database client, cluster or socket directory survives a completed run. Preserve
failed runs and snapshot source hashes in the new evidence directory only.

Run historical verifier and candidate compiler checks, focused tests,
`npm run verify`, shared tests, infra tests and `git diff --check`. Independent
specification and quality review must assess implementation and native evidence.

## Boundaries

Preserve inherited uncommitted work and all previous evidence. No staging,
commit, push, remote migration, deployment, paid calls or real family data.
No browser status/reconciliation, client confirmation/cleanup, idempotent story
save, physical deletion/GC or backup changes in this slice. Native HTTP is a
PostgREST-shaped local adapter, not real PostgREST/managed Storage/TLS/device
qualification. Source copies remain; local scoped merge artifacts are cleaned.
G1-01 remains partial, `g1MilestoneSatisfied:false` and
`pushConditionSatisfied:false` until the remaining original gates pass.

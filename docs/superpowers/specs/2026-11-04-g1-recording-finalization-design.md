# G1 Recording Atomic Finalization

The owner asked to continue G1 from chat `32`. This local slice implements the
next persistence boundary on the inherited candidate/lease work. It does not
enable a deployed worker or change the browser save flow.

## Decision and boundary

Promote an already prepared private candidate by changing the asset's pointer
in PostgreSQL. Do not copy audio into the old original path: that adds another
uncertain Storage write and can expose bytes under older bucket policies. Keep
the candidate row and object unchanged. Extend the asset bucket constraint and
server export/deletion bucket types to admit `recording-candidates`.

Add service-only `finalize_recording_job(p_job_id uuid, p_action text,
p_worker_id text, p_attempt integer, p_manifest_sha256 text,
p_candidate_id uuid, p_output jsonb, p_failure_code text) RETURNS jsonb`.
Only `publish` and `fail` are accepted. Arguments for the other branch must be
null. Publish requires the exact candidate output fields byteSize, sha256,
mimeType, durationMs and a candidate already in prepared state. It must never
turn a reserved candidate into prepared evidence.

Use the existing lease validator to pin full manifest, current storyteller and
story ownership, session/chunks, asset/job/attempt identity and live running
lease. Lock the candidate after the job. Validate the prepared record using the
existing candidate RPC's exact prepare replay after checking its state under
lock. Re-sample database time before and after final writes; an expired lease
rolls the entire transaction back. There are no Storage calls in the transaction.

Publish atomically writes:

- asset: ready, private candidate bucket/key, verified byte count/hash/MIME/
  duration, verified_at/content_verified_at/updated_at set to one database time;
- job: succeeded, result_ref=asset ID, null lease_owner/lease_expires_at/
  not_before/error_code, updated_at at that time;
- current attempt: succeeded, finished_at at that time, null error_code;
- session: cloud_confirmed, confirmed_asset_id and merge_job_id bound to those
  rows, confirmed_at at that time.

Fail is limited to the existing permanent local processing codes:
recording_source_missing, recording_source_not_private_file,
recording_source_size_mismatch, recording_source_hash_mismatch,
recording_decode_invalid_pcm, recording_decode_duration_exceeded.
No candidate may exist for this job, even from another attempt. These failures
are known only before candidate reservation. Fail writes job failed / attempt
fatal_error / asset quarantined / session failed together, using the same
finished time and fixed error code. It clears the lease, leaves result_ref null,
and does not set successful verification or session-confirmation fields.
Generic exceptions, transient failures, cancellation, uncertain network/commit
outcomes and post-reservation failures cannot be converted into this branch.

## Deletion and revocation serialization

Require READ COMMITTED isolation. Before any advisory/row locks, take
`LOCK TABLE public.deletion_requests IN SHARE MODE`. PostgreSQL's implicit ROW
EXCLUSIVE lock for INSERT/UPDATE/DELETE conflicts with this lock, including
inserts of previously absent tombstones by existing writers. Subsequent volatile
PL/pgSQL statements see committed changes after waits. Existing lease row locks
hold project, user, storyteller-role and story ownership stable until commit.
Use a bounded lock_timeout. A waiting/expired/revoked/cancelled transaction fails
without partial finalization.

This intentionally serializes deletion writes across projects during a short
finalization transaction. It is a correctness-first local boundary, not a claim
of high-contention performance qualification. A legacy transaction that acquires
project/asset rows before writing a tombstone can deadlock with this order; a
database abort is safe and must never be represented as success or automatically
retried after an ambiguous response. Test normal race orders and a reverse-order
case. Future project-scoped deletion transactions may replace the table barrier
only when all writers participate.

## Receipt and application adapter

Return a closed flat schema: schemaVersion=1, jobId, projectId, assetId, sessionId,
manifestSha256, workerId (the completing worker), attempt, state
(succeeded/failed), assetState (ready/quarantined), sessionState
(cloud_confirmed/failed), candidateId, bucket, objectKey, byteSize, sha256,
mimeType, durationMs, errorCode, finishedAt, canClearLocalDrafts=false.
Publish content matches the supplied prepared candidate exactly and errorCode is
null. Fail content fields are all null, errorCode matches the supplied permanent
code. UTC timestamps must be real dates and preserve microsecond ordering.

Expose publishRecordingJob(lease, candidate, options) and
failRecordingJob(lease, error, options) from recording-job-finalization.ts.
The fail client accepts only branded RecordingProcessingError instances with
permanent disposition. Both clients validate inputs before I/O, require a live
running lease and exact identity, propagate cancellation, use a bounded timeout
and `.abortSignal(signal).retry(false)`, and reject every malformed or mismatched
receipt with recording_finalization_unavailable. Failures never expose provider
bodies, keys, paths or arbitrary diagnostic text. No automatic retry, fallback
direct writes, object deletion, or local-draft cleanup is permitted.

Terminal replays fail the existing live-lease fence. This slice does not add a
status/reconciliation API. A lost response can have committed; all objects and
local copies must be retained pending explicit future read reconciliation.

## Compatibility and exclusions

The old input verifier, lease supervisor and prepare-only worker retain their
behavior and compiler graph. The new finalizer is not called inside their
consumer callbacks: both verifier and supervisor perform active-state checks
after consumption. Future wiring must finish local cleanup/revalidation, drain
heartbeats, then finalize without another active-lease check.

Existing seal replay compares canonical bucket/key and therefore refuses a
promoted pointer; seal SQL also rejects terminal sessions. Preserve those
conflicts and test that they never insert a second recording. Future
status/confirmation must validate the full published tuple before acknowledgement.

Support already-published pointers in authorized asset access and archival
export using a shared server-only lineage reader. For recording-candidates,
look up the immutable candidate by bucket/object_key; require one prepared row,
the expected asset/project and exact bucket/key/content metadata, and a valid
session identity. Missing, malformed or mismatched lineage fails closed. Add the
project and candidate session IDs to initial/final tombstone checks. Keep legacy
generic URL parsing unchanged; jobs/... is not an uploader-prefixed media URL.
These remain optimistic read checks; existing signed URL TTL is unchanged.

Physical deletion remains unimplemented: the older delete route can capture a
canonical target before a concurrent publication switches the pointer. Future
deletion must atomically capture authoritative targets after establishing its
tombstone. Candidate GC must exclude referenced asset objects even though the
candidate state stays prepared. Scheme-B backup's bucket allowlist still needs
explicit candidate coverage before deployment qualification.
This slice deliberately does not claim seal replay, client cleanup, unified
deletion execution/GC, backup coverage, a resident scheduler, cloud qualification,
or G1 completion. No stage, commit, push, remote migration, deployment, paid API
or real family data transmission.

## Acceptance

Native isolated PG17 tests must first fail on the missing RPC, then cover success,
failure, reserved/foreign/malformed candidates, stale worker/attempt/hash,
permission/ownership/tombstone/cancel rejection, atomic rollback for each DML,
duplicate publish, lease expiry while waiting and during writes, deletion races
in both orders, revoke race, reverse-lock abort, restrictive bucket policy and
least-privilege function grants. Snapshot complete affected tuples and retain
logs/source hashes/cleanup evidence in a new directory only.

Adapter tests must exercise strict receipts, permanent error branding,
time/cancellation/transport loss and single-request/no-fallback behavior. Use a
real Supabase JS client against a loopback HTTP PostgREST-shaped PG adapter for
the finalizer boundary, including commit followed by response loss. This is not
real PostgREST, cloud Storage or a full audio-worker integration run.

Run the old-worker compatibility check, focused tests, npm run verify, shared
tests, infra tests and git diff --check. Obtain independent specification and
quality review. Preserve inherited files except the explicit compatibility
types/constraint additions and documentation. G1 and push conditions stay false.

# G1 Recording Worker Candidate Persistence

Approved scope: chat `31` proposed this slice and the owner answered "可以";
the continuation explicitly authorizes implementation. Preserve the current
dirty checkout. No staging, commit, push, deployment, remote migration or paid API.

## Boundary

Persist a verified merged recording as a private candidate, not a published
asset. The existing job remains running, asset verifying, session sealing and
`canClearLocalDrafts` false. No terminal success, garbage collection, candidate
deletion, automatic retry, client route or resident scheduler is added.

The candidate is registered before Storage upload, after local full-stream
decode. The artifact stays inside the existing merge callback. Its complete
remote byte count and SHA-256 must match before the candidate becomes prepared.
Lost responses may have committed: retain reserved/prepared records and objects,
stop the attempt, and never retry, overwrite, reuse or delete automatically.

## Database Contract

New migration `20261103000002_recording_output_candidates.sql` adds a private
`recording_output_candidates` table with id UUID, job_id, attempt_no, worker_id,
project_id, asset_id, session_id, manifest_sha256, bucket, object_key, byte_size,
sha256, mime_type, duration_ms, state (reserved/prepared), created_at, prepared_at.
Unique `(job_id, attempt_no)` and `(bucket, object_key)`. Preserve rows on parent
deletion (no cascading candidate deletion). No client grants/policies; service
role has SELECT only, with mutations limited to the security-definer RPC.

`recording_output_candidate(p_job_id uuid, p_action text, p_worker_id text,
p_attempt integer, p_manifest_sha256 text, p_candidate_id uuid, p_output jsonb)`
supports only `reserve` and `prepare`. The output object has exact keys
`byteSize`, `sha256`, `mimeType`, `durationMs`. All identity and metadata are
immutable and supplied identically for both actions. Bytes are a positive integer
matching the sealed total (at most 104857600); MIME matches the sealed input;
duration is a positive integer at most 86400000; hash is lowercase SHA-256.

Both operations call the existing `recording_job_lease(..., 'check', ...)` inside
the same transaction, requiring running state and matching manifest digest.
This reuses the full pinned-input/access/attempt guards and lock order. Lock job
before candidate, then recheck database time after candidate locking and before
mutation. Reserve refuses any duplicate id/attempt, including exact replay.
Recheck the database clock after DML too: unique-index waits on an uncommitted
candidate ID from a different job can occur after the prewrite check. An expired
post-DML check raises, rolling back the entire reservation/preparation.
Prepare checks every persisted field; exact prepared replay returns unchanged
metadata/timestamp only while the fence remains valid. Lease loss, tombstone,
cancel, stale worker/attempt or mismatched data fails closed without partial writes.
No changes to existing broad job/asset grants or lease/seal behavior.

Receipt has exactly: schemaVersion=1, candidateId, jobId, projectId, assetId,
sessionId, manifestSha256, workerId, attempt, state, bucket, objectKey, byteSize,
sha256, mimeType, durationMs, createdAt, preparedAt, canClearLocalDrafts=false.
Timestamps are finite UTC; preparedAt is null iff reserved, otherwise >= createdAt.

## Private Storage

Dedicated `recording-candidates` bucket, public=false, 100 MiB limit. Refuse a
preexisting incompatible bucket configuration rather than silently changing it.
No client policies are added; restrictive policies on storage.objects (and bucket
metadata) exclude this bucket for anon/authenticated even if older permissive
policies are broad. Service role retains its existing storage authority.
The only object path is `jobs/<job UUID>/attempts/<attempt>/<candidate UUID>`;
all pieces come from validated lease identity and a fresh server randomUUID.
No user-supplied URL, path, filename or original-asset destination is accepted.
This new bucket must be included in future deployment/backup qualification;
this batch does not claim that qualification or modify historical backup manifests.

Upload uses authenticated POST, binary stream, `x-upsert:false`, no redirects,
no retries and a bounded AbortSignal. Accept only a successful upload status,
then GET the exact object with no cache. Enforce HTTP 200, no redirect/encoding,
optional exact Content-Length, bounded stream bytes and complete hash. Drain or
cancel every response and close the local upload stream on all exits; errors
expose a fixed code, not credentials, private paths, provider bodies or diagnostics.

## Application Structure

Keep `verifyRecordingJobInput` read-only and source-compatible. Add a scoped
`withVerifiedRecordingJobInput` consumer to reuse its trusted reader and decoder,
with revalidation before/after the consumer and after local cleanup.
Extract a common lease supervision function within `recording-job-worker.ts`;
the existing verify entry remains unchanged, including its old harness compiler
dependency graph. A new `recording-candidate-worker.ts` entry
`prepareLeasedRecordingJobCandidate(jobId, options)` owns the lease, invokes the
scoped verifier, registers/uploads/verifies/prepares, drains heartbeat, performs
the final fence check and returns `{status:'candidate_prepared', jobId, candidate,
canClearLocalDrafts:false, lease}`. No local artifact path escapes.

The candidate RPC client validates exact receipts against the requested lease,
id and output, disables RPC retries, bounds requests and propagates cancellation.
Supervision provides a fresh lease getter during long upload/readback rather than
using an initial monotonic deadline after successful renewals. All network work
is cancellation-bound; uncooperative injected transports cannot prove remote
termination and late bodies are cancelled defensively.

## Acceptance

- RED then GREEN RPC/receipt, transport, scope and worker behavior tests.
- Real isolated PostgreSQL reserve/prepare, ACL/RLS, duplicate races, rollback,
  stale fence, permission/delete/cancel, waits past expiry, and process exit.
- Real native HTTP + synthetic audio + FFmpeg integration for success, lost
  responses, conflicting upload, corrupted/oversized/truncated/stalled readback,
  cancellation and heartbeat; report substituted PostgREST boundaries honestly.
- Independent specification review followed by quality review. All blockers
  require regression tests and re-review.
- Complete npm verify, shared, infra; source/log hashes, resource cleanup,
  prior evidence preservation, diff check and updated handoff.

Absent tombstones remain a non-atomic publication barrier. Storage and SQL are
not one transaction; candidate preparation is not publication. Real cloud TLS,
Storage behavior, long/device audio, deployment isolation, backup coverage and
large-manifest cost remain unqualified. G1 and push conditions remain false.

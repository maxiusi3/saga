# G1-01 Read-only recording terminal reconciliation

Date: 2026-11-05 (Asia/Taipei). Continues the handoff's next step after the
terminal worker. A lost publication response must be resolved by reading
persisted state, without replaying seal, checking an ended lease, publishing,
recovering a job or deleting any copy.

## Snapshot authority

Add service-only `read_recording_session_snapshot(p_actor_id uuid,
p_project_id uuid, p_session_id uuid, p_manifest_sha256 text) RETURNS jsonb`.
The function is STABLE, SECURITY DEFINER, fixed search_path pg_catalog/pg_temp
and UTC, requires READ COMMITTED, and performs only SELECT operations. No
advisory/row/table write locks or mutating helpers. It must run successfully
inside an explicit READ ONLY transaction. PostgreSQL STABLE uses the calling
statement's snapshot across its SELECTs; prefer one envelope-building query.

The actor is provided only by a verified server auth result. Require existing
auth user/project/session, session user/project and expected hash match, current
active storyteller role, current optional story ownership, and no deletion
tombstone for project/session/asset/story. Reject optional deletion blockers on
authorization subjects when present. Unavailable, wrong owner/project/hash,
revoked/deleted subjects have one non-disclosing error. Revoke PUBLIC/anon/
authenticated execution; service_role alone can execute. Do not widen table ACLs.

Return this closed internal envelope:
`schemaVersion:1, actorId, projectId, sessionId, manifestSha256, observedAt,
matchingSessionCount, session, asset, jobs, attempts, candidates, chunks`.
`session`/`asset` are whole row objects (asset may be null); all other row
collections are arrays. observedAt is statement_timestamp in UTC with preserved
microseconds. matchingSessionCount counts at most two sessions binding the same
sealed asset. It must equal one before status is trusted. Select all jobs for the
sealed asset (max two), attempts for those jobs (max four), candidates related to
those jobs or the sealed asset/session (max four), and session chunks ordered by
index (max 2001). These limits expose oversize/ambiguity to the validator rather
than silently certifying a truncated legitimate set. Do not filter corrupt
foreign identity rows away merely to make the set appear valid. Raw rows never
leave the server-side adapter.

## Strict application reconciliation

Add `readRecordingSessionStatus(input, options)` in
`packages/web/src/lib/server/recording-session-status.ts`.
Input: `{ actorId:string, projectId:string, sessionId:string, manifestSha256:string }`.
Options: `{admin: ReturnType<typeof getSupabaseAdmin>, signal?:AbortSignal,
timeoutMs?:number}`. Snapshot scalar input/options before awaiting, validate
canonical lower-case UUID/hash, use one RPC, abortSignal, retry(false), bounded
default 5000 ms (1..60000), and fixed `recording_status_unavailable` errors.
Reject malformed/missing/extra envelope keys and every mismatched identity.

Reuse the existing closed manifest parser and PostgreSQL canonical manifest hash
logic from `recording-job-input.ts` by exposing small pure exports in that same
file. Preserve its imports and existing behavior/compiler graph. Validate exact
manifest/session/chunk identity, physical locations, canonical hash, byte count,
immutable session times and deterministic asset/idempotency identity via the
existing prepareRecordingSessionSeal helper. Reject optional blockers on rows.
UTC timestamps must be real dates and preserve microsecond equality/order.

Return only a compact closed receipt:
`schemaVersion:1, projectId, sessionId, assetId, jobId, manifestSha256, observedAt,
state, content, errorCode, finishedAt, canClearLocalDrafts:false`.
state is `succeeded`, `failed` or `unresolved`. jobId may be null only before job
registration. content is null unless succeeded, then exactly
`{byteSize, sha256, mimeType, durationMs}`. No bucket/object key, candidate ID,
worker ID, raw rows, URL, provider diagnostics or secrets are exposed.

Success requires the full published tuple: exactly one matching immutable job,
asset ready pointing to the exact prepared candidate, session cloud_confirmed,
job succeeded/result_ref bound, null lease/not_before/cancel/error fields, exact
current succeeded attempt and contiguous valid previous undispatched retryable
attempts, no extra candidate, and equal terminal timestamps across asset/job/
attempt/session. Candidate identity/metadata and real timestamp ordering must
match the asset, manifest, current attempt and observedAt. Asset kind, owner,
story, version, idempotency key and immutable metadata remain bound. Use the
existing candidate validator. Successful content sizes/MIME match the manifest.

Failure means the exact new permanent finalization tuple only: job failed,
asset quarantined on its canonical original pointer, session failed, current
attempt fatal_error, matching one of the six existing permanent error codes,
equal finish timestamps and no candidate in any attempt. All successful content/
confirmation fields remain null. Validate previous attempts as for success.

Unresolved is explicitly not a failure or permission to retry. It covers a valid
sealed session before asset/job registration and nonterminal/recovery states,
including an expired running lease or outcome_unknown. Require sealed input and
immutable asset/job identity to be intact, session still sealing, canonical
verifying asset with no successful content/confirmation, and no apparent success
or permanent-terminal fragment. Error/content/finishedAt are null. Do not infer
permanent failure from a generic failed job or auto-recover expiry. Malformed or
partially terminal records reject rather than becoming success or unresolved.

## HTTP boundary

Add GET `/api/recordings/sessions/[sessionId]/status` with exactly projectId and
manifestSha256 query parameters (each once). Authenticate using the existing
getAuthenticatedUser; derive actorId only from it; feature flag
MEDIA_ASSETS_ENABLED must be exactly true. Reject invalid/duplicate/unknown query
parameters, validate UUID session/project and lower-case SHA-256. Call the new
reader with request.signal. Return 200 for verified succeeded/failed receipts,
202 for unresolved, 400 for invalid arguments, existing auth errors, 404 when
disabled, and a fixed 503 unavailable body for reader/config failures. Preserve
all auth Set-Cookie headers and Cache-Control:no-store on every path. No GET
side effects, seal fallback, Storage signing or processing calls.

## Evidence and bounds

Native isolated PG17 must show actual missing-RPC RED, restrictive ACL, READ ONLY
execution, unchanged complete tuples across reads, and snapshot consistency
across a concurrent atomic publish. A later explicit read must see a committed
publish, revoke or tombstone; reject stale isolation. Include wrong actor/project/
hash and corrupted/ambiguous states. Use actual installed Supabase JS/native
HTTP with the new reader to reconcile a real committed publish whose response
was lost, without new mutations; verify success/failure/unresolved, bad receipt,
abort/timeout and non-disclosing errors. Preserve logs, source snapshots and
cleanup under the new evidence directory only. Route tests cover auth, cookies,
flags, input pollution, response schema/status and zero side-effect branches.

Run focused regressions, historical compiler graphs, npm run verify, shared and
infra tests; independently review both tasks and the final slice. Native HTTP
remains a PostgREST-shaped substitute, not cloud/managed Storage/real-device
qualification. A statement snapshot is a point-in-time observation; subsequent
revocation/deletion is possible. It grants no access URL or cleanup capability.

No stage, commit, push, remote migration, deployment, paid API or family data.
Preserve every inherited change/evidence. Browser confirmation/idempotent story
save, safe local cleanup, physical deletion/GC, candidate backup and cloud/device
G1 qualification remain later slices. G1 and push conditions stay false.

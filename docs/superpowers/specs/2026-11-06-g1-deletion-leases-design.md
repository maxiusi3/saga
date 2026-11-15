# G1 durable deletion execution leases

## Accepted direction and current boundary

The user asked to read `/docs` and continue G1 after the deletion-capture batch passed. The current handoff and gap register name a durable deletion executor, reference safety and late-write reconciliation as the next dependency. This slice implements the executor's persisted ownership/recovery boundary. The existing `executeDeletionRequestTargets` only mutates an in-memory request and is not connected to the immutable SQL capture. Reusing it directly would both lose attempts on process exit and mutate target rows covered by the capture digest.

Use a separate private execution job and attempt ledger. Keep `deletion_requests` and `deletion_targets` byte-for-byte unchanged by all lease operations, so the already accepted capture/replay contract remains valid. A lease is permission to coordinate future work only: every receipt has `canDeleteStorage:false` and `physicalDeletionComplete:false`. No Storage deletion, metadata purge, GC eligibility or successful deletion state is introduced in this slice.

This is an architectural prerequisite within the user's continued local G1 authorization. It does not expand the operation to remote data. Reference checks, writer fencing, deletion results and actual cleanup must later compose with this ledger before any destructive worker is enabled.

## SQL contract

Add `20261106000004_media_deletion_leases.sql`. New tables `media_deletion_jobs` and `media_deletion_attempts` retain ownership and all attempts, separate from capture. Jobs are keyed by `request_id`; retain project and capture digest/count bindings. Attempts are keyed by `(request_id, attempt_no)` and retain worker, claim/start/heartbeat/expiry/finish times and state. Neither table is accessible to anon/authenticated. Service-role reads may be granted, but writes happen only through the service-only SECURITY DEFINER RPC with fixed `pg_catalog, pg_temp` search path, UTC, explicit VOLATILE and three-second lock timeout. Add table constraints for valid state/lease/time combinations; no unrestricted client write policies.

`public.media_deletion_job_lease(p_request_id uuid, p_action text, p_worker_id text, p_attempt integer, p_lease_ms integer) RETURNS jsonb` supports exactly `claim`, `start`, `heartbeat`, `check`, `recover`.

All calls require READ COMMITTED. First acquire deletion_requests SHARE, then deletion_targets SHARE, then a request-specific transaction advisory lock and job/attempt row locks. This shares capture's fence order, protects the absent-job case, and ensures post-wait source observations are fresh. Parallel claims for one request cannot create two owners. Clock decisions use `clock_timestamp()` after waits; no client timestamp is authoritative.

Every call validates the complete current version-1 capture: one unambiguous request for the project/subject; canonical UUID identities and subject kind; requested state, attempt=0, finite matching requested/tombstone times, null execution fields; target count and canonical full-row SHA256 exactly match. Validate targets' closed metadata/storage shape, pending state, null error, unique logical IDs and physical coordinates. Only saga/audio-recordings/recording-candidates buckets and existing capture-safe relative object paths are accepted. A changed/legacy/incomplete capture or changed job binding is a conflict. Do not reauthorize the original requester against current membership: the previously authorized persistent tombstone is the work order, and a removed requester does not undo it.

State transitions:

| Action | Arguments and precondition | Persistent result |
| --- | --- | --- |
| claim | worker `[A-Za-z0-9_-]{1,128}`, attempt null, lease 1000–120000 integer ms; job absent or retry_wait | Atomically create/update job to leased and append exactly one leased attempt; attempts start at 1, maximum 3. Existing live/expired leased/running jobs require explicit recovery, even for the same worker. |
| start | correct worker/attempt, lease_ms null, live leased | Both job/attempt become running, started_at set once; same live running attempt can replay start without changing timestamps. |
| heartbeat | correct worker/attempt, live running, lease 1000–120000 ms | Update both expiries and heartbeat timestamp from database time. No renewal after expiry. |
| check | correct worker/attempt, live leased/running, lease_ms null | Validate and return current state; no writes. |
| recover | worker/attempt/lease_ms all null | Only expired ownership can change. Expired leased attempt becomes expired; job becomes retry_wait, or failed after the third undispatched attempt. Expired running becomes outcome_unknown in both job and attempt; never automatically reclaim or retry. Repeated recover of retry_wait/failed/outcome_unknown is read-only and stable except serverNow. |

Recover before expiry is a conflict. No action can reclaim outcome_unknown/failed. An old worker or prior attempt cannot start/renew/check after recovery or reassignment. Expiry is strictly `lease_expires_at > serverNow`; equality is expired. Heartbeats must not shorten an existing expiry; the resulting TTL must be positive and at most 120000 ms. If required writes are suppressed or changed by a trigger, abort rather than returning a receipt. Compare the complete scoped job/attempt rows (including prior history) and the unmodified capture before/after, not only RETURNING values. Reject malformed/tampered history instead of laundering it into a new valid attempt.

Closed receipt keys:

```ts
type MediaDeletionLeaseReceipt = {
  schemaVersion: 1
  requestId: string; projectId: string; subjectId: string
  subjectType: 'media_asset' | 'story'
  captureTargetsSha256: string; targetCount: number
  state: 'leased' | 'running' | 'retry_wait' | 'failed' | 'outcome_unknown'
  attempt: number; workerId: string | null; leaseExpiresAt: string | null
  serverNow: string; canDeleteStorage: false; physicalDeletionComplete: false
}
```

Active states have worker and future expiry; recovered states have both null. `attempt` is 1–3. No object paths, user content, access URL or deletion completion is returned. Expected SQLSTATE: 22023 malformed/non-RC input, 23505 unavailable/conflicting state/capture, 42501 unprivileged invocation; wait failures remain generic infrastructure errors to application callers.

## Application boundary

New `packages/web/src/lib/server/media-deletion-lease.ts` exposes `claimMediaDeletionJob(requestId, workerId, leaseMs, options)`, `startMediaDeletionJob(lease, options)`, `heartbeatMediaDeletionJob(lease, leaseMs, options)`, `checkMediaDeletionJobLease(lease, options)`, `recoverMediaDeletionJob(requestId, options)`. `options` supplies the existing admin type, optional AbortSignal and 1–60000 ms timeout (default 5000).

Claim/start/heartbeat/check return an immutable active receipt plus a process-local monotonic `deadline`. Recover returns an immutable inactive receipt. Strictly validate exact keys, UUIDs, digest, count, state/owner/attempt/time shape and false capability flags. Pin all request/capture/project/subject/worker/attempt fields across an active operation and clone input before awaiting. Use exact UTC microsecond comparisons; Date.parse's millisecond truncation must not accept an inverted submillisecond interval. The local deadline conservatively starts before transport/lock waiting and must still be live on return. Do not rely on wall-clock synchronization or serializable/transferrable local deadlines.

Claim returns leased and its TTL cannot exceed the requested duration. Start and heartbeat return running. Check may observe leased → running for the same identity after a lost start response, but cannot accept running → leased. Heartbeat must not shorten the server's existing expiry, so its positive TTL may exceed a newly requested shorter duration while still staying within 120000 ms. Active calls reject an already expired local deadline before transport.

Use exactly one bounded `.rpc(...).abortSignal(...).retry(false)` call per operation. Caller abort, local deadline, ignored SDK cancellation, transport loss, SQL errors or malformed responses fail with a generic error, with no table-write fallback and no automatic retry. A timeout/lost response does not mean SQL rolled back. A lost claim can expire undispatched and be recovered; a lost start may mean running, and expiry must become outcome_unknown. Capture remains replayable throughout.

## Acceptance and limits

Native PG17 uses actual current capture/seal SQL and this migration on isolated synthetic prerequisites. Cover absent/legacy/tampered capture, same-request concurrent claims, different requests, wait-then-tamper/revocation, old worker/attempt rejection, all five actions, undispatched recovery through exhaustion, running unknown recovery, restart/new-connection and lost-result behavior, two non-RC modes, real lock timeout, actual role ACL/RLS, suppressed/tampered job/attempt writes and unchanged capture/other data/bytes. Preserve complete rows and actual wait evidence, not only success flags.

Application tests cover exact action arguments, strict receipts, microseconds, mutated inputs, monotonic deadline, hanging transport, cancellation, response loss, and generic errors. A separate native runner compiles the actual adapter, calls real SQL through the explicit local pg transport substitution, and retains capture replay plus whole-row comparisons. That substitution is not live PostgREST qualification.

Final acceptance requires task reviews, one whole-change review, `npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra`, source fingerprints and preservation of previous accepted source/evidence. Migration inventory tests prove file order only. The full G1 remains 0/9; physical deletion, reference-safe GC, late Storage writes, real backup/restore, full migration chain, hosted and actual device qualification stay open.

## Global constraints

- Continue in the inherited `codex/october-upgrade-p0` checkout at `c0669e805`; preserve unrelated dirty work and all prior evidence.
- No stage, commit, push, deployment, remote migration, paid calls, real family data, Storage deletion or metadata purge.
- Local isolated synthetic PG clusters/files and their cleanup are authorized. New evidence uses unique paths under `docs/research/evidence/2026-11-06-g1-deletion-leases/`.
- Do not edit historical migrations or the accepted capture API/SQL; execution is a separate ledger. Root ESLint is canonical; no helper-only Jest suites.

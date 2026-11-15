# G1 Recording Worker Lease Boundary

Approved in chat on 2026-11-03: implement durable claim/attempt, database-clock
lease fencing and heartbeats, connect the existing input verifier, and test real
PostgreSQL/process failures. This is not output publication or a deployed worker.

## Database contract

Add `public.recording_job_lease(p_job_id uuid, p_action text, p_worker_id text,
p_attempt integer, p_lease_ms integer) RETURNS jsonb`, SECURITY DEFINER with a
fixed trusted search path; EXECUTE only for service_role. No remote migration.

- `claim`: queued/retry_wait, due, valid immutable recording input, active owner,
  no tombstones/cancellation, remaining attempt budget. Atomically increment the
  attempt, insert a leased attempt with null dispatched_at, and persist the lease.
  A duplicate claim (including the same owner) fails while an attempt is active.
- `start`: only the live leased owner/attempt; atomically mark running and record
  dispatch time before the verifier can perform I/O. Do not replay a start.
- `heartbeat`: only a live running owner/attempt; renew using database time read
  after all potentially blocking locks. Owner is ASCII `[A-Za-z0-9_-]{1,128}`;
  lease duration is an integer from 1000 to 120000 ms.
- `check`: read/lock and validate the live owner/attempt, current permissions,
  immutable binding and deletion state, without renewing or changing rows.
- `recover`: explicit supervisor operation; an expired leased attempt becomes
  retry_wait (or failed when exhausted), expired running becomes outcome_unknown.
  A revoked/deleted/cancel-requested active job becomes cancelled. No auto-retry of
  outcome_unknown. Atomically finish the corresponding attempt; never touch ready.

Claim takes worker and duration, with null attempt. Start/check take worker and
attempt, null duration. Heartbeat takes all three. Recover takes all three null.
Reject missing/unknown/irrelevant arguments. State/identity conflicts reject with
no partial write. Existing seal/session/chunk ACLs remain restricted; no grants
restoring their direct writes. Existing job insert/deletion callers remain intact.

Receipt has exactly these fields:

```ts
type LeaseReceipt = {
  schemaVersion: 1
  jobId: string; projectId: string; assetId: string; sessionId: string
  manifestSha256: string
  state: 'leased' | 'running' | 'retry_wait' | 'failed' | 'outcome_unknown' | 'cancelled'
  attempt: number
  workerId: string | null; leaseExpiresAt: string | null; serverNow: string
  canClearLocalDrafts: false
}
```

Reuse the formal processing_jobs/processing_attempts tables. Add leased to the
attempt state constraint and allow null dispatched_at until start; existing rows
are preserved. Recompute/validate recording job identity, fixed manifest, chunk
ledger and asset state. Existing permission rows are locked in a consistent order.
Deletion tombstones are checked, but absent-row checks are not an atomic barrier
against all deletion writers. Future publication must solve that separately.

## Application contract

- A server-only RPC client validates every receipt, pins returned identities and
  owner/attempt, bounds transport waits, propagates aborts, disables retries and
  never forwards provider error bodies or credentials. A timeout after a mutation
  is an unknown commit; do not dispatch or automatically retry the operation.
- Existing queued read-only verification remains available. Optional running lease
  verification checks the RPC before/after reading the ledger, requires running
  state and the exact fence, and pins every prior input field except the mutable
  job lease_expires_at/updated_at. Normal heartbeat must not look like input drift.
- `verifyLeasedRecordingJobInput` claims, starts, then invokes the real verifier
  with a shared abort signal. It renews serially (no overlapping heartbeats) and
  aborts owned I/O on heartbeat error, cancellation or a conservative local lease
  deadline derived from database TTL and monotonic request start time. Check again
  before returning, stop timers and drain the heartbeat. No hidden background work.
- A successful result is still only input_verified/canClearLocalDrafts:false.
  This slice has no candidate upload/terminal success API: its job remains running
  until a later publication slice consumes it, or explicit expiry recovery moves
  it to outcome_unknown. It is not wired to a public endpoint or resident scheduler.

## Verification and non-goals

TDD for strict protocol validation, running reader, normal heartbeat, timeout and
loss-of-fence cancellation. Real isolated PostgreSQL checks transaction rollback,
concurrent claims, old owners/attempts, lock waits beyond expiry, permissions and
tombstones, null-vs-real dispatch time, expiry recovery and unknown-result refusal.
Use independent child processes and SIGKILL to distinguish crash recovery from
pure state simulation. Combine the application verifier with real local SQL and
native FFmpeg when exercising a claimed recording; synthetic Storage/HTTP remains
a fixture, not real cloud qualification.

Preserve all earlier code/evidence and record new evidence separately. Run the
full project gate and independent specification/quality reviews. No push, main
merge, remote migration, deployment, paid provider call, real family data, ready
publication or client cleanup. G1-01/G1 and push conditions remain false.

# Local G1 Worker Lease Verification

Run from the repository root. No environment files, remote databases, paid
providers, or family recordings are used.

```sh
# Expected nonzero exit: execute the actual missing five-argument RPC.
node experiments/pg17-recording-worker/verify.mjs --without-migration

# Real PostgreSQL/process checks only.
node experiments/pg17-recording-worker/verify.mjs --sql-only

# Also exercise the actual TypeScript worker/RPC/input verifier and native audio decode.
SAGA_FFMPEG_PATH=/usr/local/bin/ffmpeg node experiments/pg17-recording-worker/verify.mjs
```

The read-only `../pg17-routines/runtime.mjs` starts the pinned PostgreSQL 17.4
binary on a private Unix socket with TCP disabled. It scrubs database environment
variables, uses a unique temporary cluster, and connects the worker as a real
non-superuser, non-BYPASSRLS `service_role`. Synthetic prerequisite auth/project/
story tables are followed by exact foundation DDL for the six relevant tables,
the complete seal migration, and the complete new lease migration. This is not
a full migration-chain rehearsal. No earlier harness is invoked or edited.

`fixture.mjs` compiles `prepareRecordingSessionSeal` and uses its actual asset
UUID, task identity, asset fields, and job fields. The real seal RPC persists the
immutable manifest and chunk ledger. SQL tests use independent connections and
child Node processes, not an in-memory imitation of lease transactions.

The scenarios cover exact receipts/arguments and ACLs; preexisting attempt/default
compatibility; rollback on transaction abort and injected attempt-write failure;
concurrent claims; old owner/attempt rejection; actual lock waits beyond expiry,
including a late attempt-row lock; real wall-clock expiry; SIGKILL after explicit
committed leased/running checkpoints; all three undispatched retries; immutable
input and history drift; permission/deletion/cancellation changes; unknown-result
retry refusal; and zero ready/success/cloud-confirmation writes.

The full run uses actual compiled production TypeScript and Supabase JS. A small,
strict injected `fetch` router translates PostgREST-shaped query/RPC requests to
parameterized real PostgreSQL calls. Storage responses are synthetic in-process
audio bytes with bounded, abortable latency. Native FFmpeg generates a two-second
WebM/Opus sine wave, and the actual application decoder runs the native binary.
Delayed source reads span the initial lease so renewal is necessary. Additional
cases revoke real SQL permission during I/O and delay committed RPC responses to
verify unknown-commit handling, no retry, no dispatch after uncertain claim, and
owned-I/O cancellation. No future heartbeat may restart after the worker returns.

This transport substitution is **not** live HTTP/TLS, PostgREST authentication,
RLS policy composition, or cloud Storage qualification. The database is real;
the network/Storage protocol boundary is a fixture. The external FFmpeg binary
is not a deployment-qualified or OS-sandboxed worker runtime. One synthetic format
does not prove real-device MediaRecorder continuity or complete recording tails.

Every run writes an immutable, timestamp-and-UUID directory under
`docs/research/evidence/2026-11-03-g1-worker-lease/`, including failed runs. JSON
results contain real assertions, state receipts, process checkpoints/signals,
lock/expiry timings, application requests, PCM counts, source hashes, and cleanup
results. Gzipped source snapshots and the PostgreSQL log are written with
exclusive creation. Source hashes are rechecked after the run. Cleanup checks
that the cluster PID, private socket, temporary directory, worker/decoder children,
database clients, and application-owned transport work are gone.

Successful input verification still leaves a `running` job, with
`input_verified` and `canClearLocalDrafts: false`; no publish/ready/terminal-success
operation exists in this slice. Later expiry recovery makes a dispatched job
`outcome_unknown`, not an automatic retry. G1-01/G1, deployment, and push conditions
remain unsatisfied.

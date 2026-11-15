# Recording candidate native persistence probe

Run from repository root:

```sh
node experiments/pg17-recording-candidates/verify.mjs --without-migration
node experiments/pg17-recording-candidates/verify.mjs --sql-only
SAGA_FFMPEG_PATH=/absolute/path/to/ffmpeg node experiments/pg17-recording-candidates/verify.mjs
```

The first command intentionally fails on the missing exact candidate RPC, using
an actual service-role PostgreSQL invocation. Each execution writes a new UUID
run directory under `docs/research/evidence/2026-11-03-g1-worker-candidates/`.
Old harnesses and old evidence are never executed or rewritten.

The default additionally compiles the production candidate worker and dependencies
into the isolated scratch directory, uses actual Supabase JS, native loopback
HTTP and FFmpeg, and exercises complete candidate persistence. All source helpers,
production TypeScript, selected migrations, native binary hashes and PostgreSQL
logs are registered in the evidence snapshot. Source drift fails the run. The
compiler performs transpilation, not TypeScript type checking; the repository's
separate type-check gate is still required.

Uses the pinned native PostgreSQL 17.4 runtime over a private Unix socket, exact
selected foundation DDL, full seal/lease/candidate migrations, and synthetic
identity prerequisites. Minimal `storage.buckets` and `storage.objects` fixtures
have RLS and intentionally broad client policies. They test PostgreSQL policy
composition, not real Supabase Storage API behavior, managed-schema ownership,
cloud TLS, deployment, backup coverage, or publication safety. Service-role SQL
sessions deliberately have no BYPASSRLS; Storage authority comes from fixture
policies, not a claim that live Storage runs this way.

Source snapshots and PostgreSQL logs are compressed and hashed in each run.
Cleanup stops the isolated cluster and removes its sockets and scratch tree.
Candidate persistence is not publication; G1 and push conditions remain false.

Application coverage includes streamed immutable POST, complete GET readback,
heartbeat renewal past the initial lease, reserve/upload/prepare response loss,
existing-object conflict, short/long/corrupt/stalled/redirected/encoded readback,
caller cancellation, database cancellation, permission revocation, and real
application SIGKILL after upload and prepare commits. It checks retained
reserved/prepared records and objects, no retry or later prepare, no publication,
closed HTTP connections, PG clients, upload streams, merged-file descriptors,
decoder processes and scoped temporary files. A killed process cannot clean up
gracefully: the test observes retained local files, then explicitly removes only
that child attempt's isolated directory. Explicit lease recovery yields
`outcome_unknown`, never an automatic restart.

The HTTP server is a synthetic local Storage implementation, with real streamed
bytes stored on disk and synthetic PostgreSQL object metadata. The strict
PostgREST-shaped adapter executes parameterized SQL as real `service_role`; it
is not actual PostgREST. Injected fetch rewrites only `https://storage.invalid`
to the native `http://127.0.0.1:<port>` fixture, preserving headers, body streams,
redirect policy and AbortSignal. This does not qualify cloud TLS, managed Storage
behavior, real-device/long audio, deployment isolation, backup coverage or
publication safety. Response-loss cases suppress server responses after real
commit; they do not drop a PostgreSQL wire COMMIT acknowledgement.

Coverage includes incompatible bucket/RLS migration refusal, immutable receipt
and metadata checks, direct ACL/RLS denials, private bucket/object policy
composition (including cross-bucket UPDATE), reserved/prepared transaction
rollback, injected write failures, simultaneous duplicate/prepare races, real
expiry across job/candidate row locks, permission/tombstone/cancel guards, native
child-process SIGKILL before/after commit, and parent deletion survival. The
process-loss test deliberately suppresses the application's result after a real
PG commit; it does not drop a PostgreSQL wire COMMIT acknowledgement. No candidate
operation grants publication or local draft deletion.

# Native recording terminal worker attempt

Run from the repository root with an existing local FFmpeg executable:

```bash
SAGA_FFMPEG_PATH=/usr/local/bin/ffmpeg node experiments/pg17-recording-terminal-worker/verify.mjs
```

Optional positional case names run only those cases, for example
`verify.mjs bad-source-hash post-candidate-error`. Every execution gets a fresh
`native-<timestamp>-<uuid>/` directory under
`docs/research/evidence/2026-11-05-g1-terminal-worker/`; failed runs are retained.

The runner imports the pinned PostgreSQL 17.4 runtime, sealed UUID fixture,
candidate compiler and actual Supabase JS synthetic-origin client from previous
harness modules. It never runs previous `verify` files or evidence writers.
It compiles the production terminal worker and applies intact seal, lease,
candidate and finalization SQL migrations. The existing fixture extracts exact
foundation tables/helpers and supplies synthetic auth/project/Storage schemas.

The HTTP adapter allows explicit parameterized RPC mutations and bounded table
reads. Source and candidate bytes are written to disposable files and transferred
with native fetch streams. Actual FFmpeg decodes a synthetic two-second WebM/Opus
sine wave. Native resource observers track decoder PIDs, file handles, upload
streams, scoped directory removals and caller cancellation listeners without
substituting the processing results.

Cases cover publication through renewed heartbeats; real source hash mismatch;
real decoded-duration permanent failure; corrupt readback after candidate upload;
commit followed by response loss or malformed receipt; caller cancellation during
settled local cleanup; and role revocation at the first input lease revalidation
after local cleanup. Each case
records complete tuples, request arguments/receipts, actual retained byte hashes,
and cleanup. Terminal cases compare every tuple field against its exact intended
delta and require cleanup plus heartbeat drain before the terminal request, with
no later lease check, heartbeat, retry, fallback failure or deletion.

Evidence contains compressed source copies (including loaded CommonJS runtime
dependencies and the static ESM helper closure), actual compiled modules, audio
and candidate bytes, PostgreSQL logs, executable hashes, drift checks and cleanup
results. Executables are fingerprinted rather than copied. OS-linked libraries
and Node builtin implementations are outside source snapshot coverage.

This is a PostgREST-shaped local adapter, **not** managed PostgREST/Storage, TLS,
device audio, large manifests, forced worker death, deployment, backup or browser
reconciliation qualification. Uncertain results retain objects and candidates;
the harness only removes its own disposable fixture after capturing evidence.
All receipts retain `canClearLocalDrafts:false`. G1-01 remains partial,
`g1MilestoneSatisfied:false`, `pushConditionSatisfied:false`.

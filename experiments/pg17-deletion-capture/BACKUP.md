# Candidate-aware Scheme B compatibility

Run from the repository root:

```sh
node experiments/pg17-deletion-capture/verify-backup.mjs
```

Each run creates a unique `native-backup-*` evidence directory under
`docs/research/evidence/2026-11-06-g1-deletion-capture/`, including failed runs.
The existing Task1 harness files remain unchanged. This runner uses their local
PG17 setup, actual recording reserve/seal/candidate reserve/prepare/publication
routines, and actual deletion-capture RPC with a real unprivileged service-role
connection. Asset/job registration follows the existing fixture's inserts.

The four-object manifest contains the selected story's published candidate,
another story's original chunk and reserved candidate, and a synthetic legacy
object. Recording addresses come from persisted rows. A real post-freeze capture
produces both the selected candidate target and its original-chunk target. All
captured storage targets become existing `SchemeBTombstoneRecord` values; the
selected story's original chunk is intentionally absent from this four-object
subset. Replay must exclude exactly the selected candidate and preserve the
other three complete entries. Logical manifest IDs differ from target IDs, so
the assertion requires the durable bucket/key match. The raw microsecond UTC
request timestamp remains in capture evidence; the adapter normalizes it to
milliseconds for the existing Scheme B timestamp contract.

The runner compiles the actual TypeScript validator, loads the actual CJS
validator, and executes the actual CLI with `--dump`, `--manifest`, and
`--tombstones`. Full manifest and survivor results must agree. Fourteen malformed,
unknown-bucket, path, size, hash, duplicate, and overflow cases retain the same
rejections in both validators. Historical pre-freeze tombstones preserve every
object. Database rows and local synthetic bytes remain unchanged during replay.

Evidence includes `capture.json` (durable request/targets and complete before/
after synthetic database/file snapshots), `manifest.json`, `tombstones.json`,
`synthetic-header.dump`, `compatibility.json` (raw CLI stdout/stderr and both
validator results), `after-replay.json`, `validation-parity.json`, and
`results.json` with source/artifact hashes and cluster cleanup status.

The dump is a **synthetic PGDMP header and payload**, not a restorable archive.
Object bytes are **local synthetic files**. The fixture computes their byte sizes
and hashes, but the backup validators only inspect manifest fields and the dump
header/hash; they do not download or verify Storage object bytes. The CLI's
existing `verified: true` means its existing structural checks passed. This run
does not create or qualify a backup ledger, execute `pg_restore`, perform any
Storage removal, qualify physical deletion/reference-safe GC, or qualify the full
migration chain, cloud/device behavior, G1, or push readiness. The isolated local
cluster and scratch files are removed after each run.

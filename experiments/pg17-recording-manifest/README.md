# Durable recording manifest: isolated PostgreSQL 17 verification

Run from the repository root:

```sh
node experiments/pg17-recording-manifest/verify.mjs --without-migration
node experiments/pg17-recording-manifest/verify.mjs
PGHOST=127.0.0.1 PGPORT=1 PGDATABASE=synthetic_do_not_use \
PGUSER=synthetic PGPASSWORD=synthetic PGSSLMODE=require \
PGOPTIONS='-c search_path=synthetic_do_not_use' \
PGSERVICE=synthetic_do_not_use PGSERVICEFILE=/tmp/synthetic-no-pg-service \
DATABASE_URL=postgresql://synthetic:synthetic@127.0.0.1:1/synthetic_do_not_use \
node experiments/pg17-recording-manifest/verify.mjs
```

The first command must fail with missing-RPC SQLSTATE `42883` and exit 1.
It was run before creating the migration. Normal and polluted-environment
runs must exit 0. Any unexpected failure or unconfirmed cleanup fails the
run rather than being treated as the expected RED.

## Isolation And Evidence

- Imports `../pg17-routines/runtime.mjs` unchanged, retaining its pinned
  PostgreSQL 17.4 executable hashes and existing `pg` dependency. No new
  package or PostgreSQL extension is required.
- Scrubs all `PG*` variables and `DATABASE_URL`, uses a fresh private Unix
  socket under `/tmp`, explicitly disables TCP, and uses fixed synthetic
  connection parameters. It never reads project credentials or `.env`.
- Extracts exact foundation `CREATE TABLE` blocks for `media_assets`,
  `deletion_requests`, `processing_jobs`, `recording_sessions`, and
  `recording_chunks`. Prerequisite users/projects/roles/members/stories and
  `auth.uid()` are synthetic. The two foundation project-member helpers
  and existing authenticated session-read policy are extracted unchanged.
- This is not a full migration-chain rehearsal. Unrelated foundation DDL,
  indexes, policies, routines, and other migrations are excluded. The new
  migration itself is applied completely and replayed without modification.
- Uses actual LOGIN connections for service_role, anon, authenticated and
  metadata_reader, all NOSUPERUSER/NOBYPASSRLS. Tests therefore exercise the
  service-role SELECT policies as well as ACLs rather than relying on RLS
  bypass. Forged scalar and JSON JWT role claims cannot grant execution.
- Every invocation writes a unique `pg-*.json` report under
  `docs/research/evidence/2026-11-02-g1-durable-manifest/`. It includes source
  and binary hashes, SQLSTATE classifications, assertion counts, role
  identities and cleanup checks. Exact runner and applied migration bytes
  are preserved in uniquely named `raw/pg-*.gz` snapshots with compressed
  and decoded SHA-256. Raw database exception text is not emitted.
- Capture stdout/stderr and the real process exit in a fresh `raw/pg-*.log`
  and gzip it without replacing earlier failed-run evidence. The parent
  batch evidence index records all retained reports, logs and hashes.
- Cleanup closes clients, stops the cluster, removes its private directory,
  and independently checks socket/directory/PID disappearance. These checks
  run after success and failure and affect the process exit code.

## Ledger Contract

`seal_recording_manifest(p_manifest jsonb)` is the sole application writer
for both recording ledgers. It is SECURITY DEFINER, pins `search_path` to
`pg_catalog, pg_temp`, qualifies all application tables, and grants EXECUTE
only to service_role (besides the owner). PUBLIC/anon/authenticated cannot
call it. All application roles, including service_role, lack direct
INSERT/UPDATE/DELETE/TRUNCATE rights. The existing authenticated session
read policy is preserved; service_role has SELECT with explicit policies.
These guarantees do not restrict the trusted database owner's DDL powers.

Input is exactly:

```text
{schemaVersion: 1, projectId, sessionId, userId, storyId, assetId, mimeType,
 chunks: [{index, chunkId, bucket, objectKey, storageObjectKey, byteSize, sha256}]}
```

Identity UUIDs are canonical lowercase; only storyId may be null. MIME
uses the seal route's existing allowlist. There are 1-2000 contiguous,
ordered, uniquely identified chunks, at most 100 MiB declared input, and
each SHA-256 is lowercase. Logical paths are exactly
`projects/<project>/sessions/<session>/<index>`, physical paths prepend
`<user>/`, and the bucket is exactly `audio-recordings`. Extra/missing
keys, wrong JSON types, nulls, unsafe names and path substitutions reject.

The complete canonical input is pinned in nullable `seal_input`. Existing
rows are not backfilled. `recording_chunks.object_key` stores the physical
Storage key, and new nullable `seal_chunk_id` pins the declared chunk ID.
SHA-256 is computed inside PostgreSQL over the UTF-8 `jsonb::text` bytes
using the built-in `sha256(bytea)` function. JSON object key order is not
identity; chunk array order is. This hash is a database canonical-input
digest, not a hash of real audio and not a JS `JSON.stringify` digest.

The exact receipt is:

```text
{schemaVersion: 1, sessionId, state: 'sealing', manifestSha256,
 manifest: <the complete canonical input>, canClearLocalDrafts: false}
```

Replay is allowed only when that same input, its digest, session identity,
declared counts, finite ordered timestamps, unconfirmed sealing state,
and every persisted chunk remain coherent. It writes no fields. Changed
input, legacy `seal_input = NULL`, changed state and corrupt/missing chunk
rows reject without adoption or automatic repair. The service cannot
advance state; future Worker/deletion flows require dedicated authorized
RPCs rather than restoring direct service-role DML grants.

## Behavioral Coverage And Limits

The harness exercises malformed types/keys/paths/limits, exact replay,
changed asset/story/MIME/chunk identity/hash/size, active storyteller and
story ownership, cross-project/owner rebind attempts, session/story/asset
tombstones, legacy rows, corruption, privilege denial, authenticated RLS,
hostile temp shadows, migration replay and rollback after an injected
second-chunk error. Owner-only corruption and synthetic trigger fixtures
are defensive tests, not application write paths.

Two separate real-backend races observe database lock waiting, not merely
parallel JavaScript calls: identical inputs converge to one receipt, and
different input has one winner. A third race proves an existing role row
cannot be revoked midway through this RPC; after commit, revocation is
effective and replay fails. The transaction also locks its project,
owner and optional story rows. This is not atomic revocation/deletion
across all current or future writers: a new tombstone can race this RPC,
and later Worker actions must reauthorize and check deletion state.

No declared object is uploaded, downloaded, read back or decoded. No real
audio, browser, HTTP, PostgREST, provider, cloud durability/availability,
asset/job registration, ready-state publication, safe local-draft cleanup,
deployment or remote migration is proven. Only the manifest transaction is
atomic; the subsequent existing asset/job registration remains a separate
recoverable two-write operation. This local candidate does not complete
G1-01 or any original G0-G4 release gate.

# Browser upload reports: isolated PostgreSQL 17 verification

Run from the repository root:

```sh
node experiments/pg17-upload-observations/verify.mjs
node experiments/pg17-upload-observations/verify.mjs --without-migration
PGHOST=127.0.0.1 PGPORT=1 PGDATABASE=synthetic_do_not_use \
PGUSER=synthetic PGPASSWORD=synthetic PGSSLMODE=require \
PGOPTIONS='-c search_path=synthetic_do_not_use' \
PGSERVICE=synthetic_do_not_use PGSERVICEFILE=/tmp/synthetic-no-pg-service \
DATABASE_URL=postgresql://synthetic:synthetic@127.0.0.1:1/synthetic_do_not_use \
node experiments/pg17-upload-observations/verify.mjs
```

Normal and contaminated runs must pass. `--without-migration` skips only the
new upload migration, so it must fail with SQLSTATE `42883` for the missing v3
RPC. That genuine RED was captured before writing the new migration. The
runner writes a uniquely named `pg-*.json` under
`docs/research/evidence/2026-10-30-upload-observations/` after cleanup. Save
terminal output in a new `sql-*.log` for each invocation, including the exit
code; never overwrite failed-run evidence. `sql-verification.json` indexes
the retained logs/reports, hashes, source revisions and independent cleanup
checks. A separate BC-epoch regression RED is intentionally retained.

## Isolation and evidence limits

- Imports the existing `../pg17-routines/runtime.mjs` read-only, preserving
  its exact PostgreSQL 17.4 executable pins and existing `pg` dependency.
  It scrubs every `PG*` variable and `DATABASE_URL`, uses a fresh private
  `/tmp` Unix socket, and disables TCP listening. No dependencies change.
- Creates synthetic `auth.users(id)`, `public.projects(id)` and
  `public.stories(id)`, then extracts the exact four `CREATE TABLE` blocks
  for P1 `media_assets`, `deletion_requests`, `processing_jobs` and
  `processing_attempts`. It applies the complete, unchanged v1 operational
  and v2 export-observation migrations before the new migration.
- This is not a complete migration-chain rehearsal: other P1 DDL, indexes,
  policies and routines and subsequent migrations are excluded. P1 fixture
  access is SELECT-only for service_role with RLS and no member policies.
- Uses real LOGIN roles, not `SET ROLE`: service_role is a non-superuser
  with BYPASSRLS; anon/authenticated/metadata_reader have neither. Forged
  scalar and JSON JWT role claims cannot grant access. A separate scenario
  temporarily grants client SELECT to prove RLS independently hides rows,
  then revokes it before continuing.
- Corruption fixtures use owner-only transactions that remove constraints
  and disable the transition trigger, then roll back. They test defensive
  reads, not a supported write path. Normal writers and concurrent races
  retain constraints, triggers and real role ACLs.
- Source and executable hashes, assertion labels, synthetic role identities
  and cleanup metadata are retained. Neither source rows nor raw database
  exception messages are emitted. Private-text/identity/path sentinels seed
  the four P1 tables, and aggregate output has exact field allowlists.
- Calls `await h.cleanup()` without assigning its undefined return value.
  Independently checks socket, cluster parent directory and PID removal;
  any failed cleanup check fails the run. The evidence index separately
  rechecks every retained run's paths and PID after process exit.

No remote database, Storage, provider, PostgREST, HTTP, browser, production
latency, deployment, build, commit or push is exercised by this experiment.
`project_hub_audio_put_reports` is the declared scope of the new ledger, not
proof that a real browser ran or Storage accepted an object. The full
application phase and original G0-G4 acceptance remain outside this proof.

## Ledger and RPC contract

`browser_upload_attempts` contains exactly `id`, `binding_hash`, `state`,
`started_at` and `finished_at`. The server supplies a random UUID and a
lowercase 64-character SHA-256 binding. SQL validates the hash format but
cannot establish how the HTTP server derived it; the HTTP layer must bind
the secret credential to the loaded asset and authenticated user. No raw
token, user/household/asset identifier, storage path or error text is stored.

- `begin_browser_upload_attempt(uuid,text)` inserts a DB-timed `started`.
  Same ID/hash replays return the actual state; a different hash rejects.
  A terminal replay does not reopen the attempt.
- `finish_browser_upload_attempt(uuid,text,text)` locks the row, verifies
  the binding before any replay, then accepts only `client_succeeded`,
  `client_failed`, `client_conflict` or `client_cancelled`. The same outcome
  is idempotent. Missing starts, malformed parameters, wrong bindings and
  different terminal outcomes reject.
- Receipts are exactly `{schemaVersion: 1, attemptId, state}`. No client
  timestamp argument is accepted. Both writers are SECURITY DEFINER with a
  fixed `pg_catalog, public, pg_temp` search path and qualified tables.
- PUBLIC/anon/authenticated cannot execute the RPCs. Application roles,
  including service_role, cannot directly insert/update/delete/truncate.
  service_role has only SELECT on the tables and EXECUTE on the RPCs.
- Constraints enforce finite, ordered times and states. A transition
  trigger rejects deletion, ID/binding/start mutation, started-to-started
  UPDATE and every terminal UPDATE, including no-ops. Ordinary owner DDL
  powers can still disable triggers or truncate: this is not protection
  against a malicious database owner.
- Five real two-backend races prove lock waiting for same-binding begins,
  conflicting-binding begins, same finishes, conflicting finishes, and a
  wrong-binding same-outcome finish. Claims of concurrency do not rely on
  merely calling promises together.

An accepted client report is untrusted diagnostics, not Storage reception,
asset hash/decoding, successful save, current authorization or G0-G4 proof.
In particular, started includes begin-to-PUT crashes; a failed response does
not imply the object does not exist; conflict is not fresh-object success.

## Read-only v3 aggregate

`read_operational_snapshot_v3()` is no-argument SQL STABLE SECURITY INVOKER
with the same fixed search path. It composes the unchanged v2 result in one
statement, sets `schemaVersion` to 3, and adds exactly:

```text
uploads.scope = project_hub_audio_put_reports
uploads.windowMinutes = 60
uploads.coverageStartedAt = UTC ISO microsecond timestamp, or null
uploads.windowComplete = boolean
uploads.evaluatedAttemptsCount = nonnegative integer
uploads.reportedFailuresCount = nonnegative integer
uploads.reportedCancellationsCount = nonnegative integer
uploads.unsettledAttemptsCount = nonnegative integer
uploads.invalidAttemptsCount = nonnegative integer
```

Valid finished rows count when `finished_at >= statement_timestamp() -
interval '60 minutes'`, including the exact microsecond boundary. Evaluated
is succeeded/failed/conflict, failures is only failed, and cancellation is
separate. A stale start can have a recent finish. All valid started rows are
unsettled globally, including starts older than the window. Invalid
state/hash, null/nonfinite/future or reversed times count globally as
invalid and are excluded from every normal counter.

The singleton epoch is created once and preserved on migration replay.
Missing/null/nonfinite/future or BC-era epochs return null/false rather than
inventing valid coverage. BC is rejected because the wire timestamp has no
era suffix. `windowComplete` only means 60 elapsed minutes of ledger age;
it does not demonstrate rollout coverage or actual PUTs. Invalid or missing
data must not support healthy status, and fresh coverage stays incomplete.

Tests preserve v1/v2 definitions and ACLs byte-for-byte, compare their
nonempty aggregates to v3 within the same statement, check exact elapsed
hour boundaries under four session timezones and hostile temp shadows,
exercise read-only repeatable-read MVCC across another backend's commit,
and distinguish statement time from transaction start. No historical,
other-client, recording-chunk or site-wide coverage is claimed.

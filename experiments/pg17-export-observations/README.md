# Export observations: isolated PG17 verification

Run from the repository root:

```sh
node experiments/pg17-export-observations/verify.mjs
node experiments/pg17-export-observations/verify.mjs --without-migration
PGHOST=127.0.0.1 PGPORT=1 PGDATABASE=synthetic_do_not_use \
PGUSER=synthetic PGPASSWORD=synthetic PGSSLMODE=require \
PGOPTIONS='-c search_path=synthetic_do_not_use' \
PGSERVICE=synthetic_do_not_use PGSERVICEFILE=/tmp/synthetic-no-pg-service \
DATABASE_URL=postgresql://synthetic:synthetic@127.0.0.1:1/synthetic_do_not_use \
node experiments/pg17-export-observations/verify.mjs
```

Normal and polluted runs must pass. `--without-migration` applies the frozen
v1 migration but skips only the new export migration, so it must fail with
SQLSTATE `42883` for the missing v2 RPC. Every invocation saves a unique safe
`pg-*.json` report under `docs/research/evidence/2026-10-29-export-observations/`
after cleanup. Redirect terminal output to a distinct log before running; do
not replace earlier RED or runner-failure evidence with later GREEN output.
`pg-verification.json` indexes the retained reports and original terminal logs,
their SHA-256 hashes, and source revisions. The initial expected missing-RPC
RED and missing-migration infra RED were captured before implementing SQL.

## Isolation and limits

- Uses the frozen `../pg17-routines/runtime.mjs` and its existing PostgreSQL
  17.4 binary fingerprints without editing either. Every `PG*` environment
  variable and `DATABASE_URL` is scrubbed before local commands or connections.
  A fresh `/tmp` cluster uses a private Unix socket and disables TCP listening.
- Creates only synthetic prerequisite `auth.users(id)`, `public.projects(id)`
  and `public.stories(id)` tables. Executes the exact four `CREATE TABLE`
  blocks for `media_assets`, `deletion_requests`, `processing_jobs` and
  `processing_attempts` from the frozen P1 migration, then the entire unmodified
  `20261029000001_operational_snapshot.sql` before the new migration.
- This is not a full migration-chain rehearsal. Other P1 tables, routines,
  indexes and member policies and subsequent migrations are not applied.
  Synthetic P1 table grants are deliberately SELECT-only for service_role,
  with RLS enabled and no member policies; existing P1 experiments remain the
  independent evidence for those omitted boundaries.
- Real login roles (not merely role claims) exercise ACLs. `service_role` has
  BYPASSRLS but is not a superuser; anon/authenticated/metadata_reader have
  neither. Both scalar and JSON JWT claims are forged to `service_role` to
  prove claims cannot grant access. SQL definer writers use owner privileges,
  while service_role's own table privileges are SELECT only.
- Seeds synthetic private-text/path/identity sentinels in all four P1 tables
  and checks exact output allowlists against them. Reports contain only safe
  assertion labels, hashes, role identities, runtime and cleanup metadata,
  never source rows or raw database error messages.
- Owner-only, rolled-back transactions relax constraints and disable the
  transition trigger solely to inject corrupt historical rows. These scenarios
  verify defensive reading, not a supported write path. Normal write and
  concurrency scenarios retain all constraints, triggers and real role ACLs.
- Calls `await h.cleanup()` without assigning its undefined return value.
  Separately confirms no remaining clients, PID, socket or cluster parent
  directory. A cleanup failure fails the run.

## Write contract

`archive_assembly_attempts` stores only `id`, `state`, `started_at` and
`finished_at`. The route generates a random server UUID; SQL accepts that UUID
and one finite terminal-state choice, never client time, household/user IDs,
paths, private text, error details or ZIP content. Tables have RLS and all
PUBLIC/anon/authenticated/service_role privileges revoked before granting
service_role SELECT. Definer writers have a fixed trusted
`pg_catalog, public, pg_temp` search path and schema-qualified tables; only
service_role receives EXECUTE among application roles.

- `begin_archive_assembly_attempt(uuid)` inserts a database-timed `started`
  event. Replays return the actual state, including an existing terminal;
  they do not rewrite the start time or reopen an event.
- `finish_archive_assembly_attempt(uuid,text)` locks the actual row. A first
  terminal transition records database statement time. Repeating that same
  terminal returns the existing state/time; a conflicting terminal, missing
  start, null ID/outcome or illegal state is rejected. Concurrent real backends
  are held in transactions until the contender demonstrably waits on a
  database lock, covering starts, same finishes and conflicting finishes.
- Every successful receipt is exactly
  `{schemaVersion: 1, attemptId: string, state: string}`. Constraints and a
  transition trigger reject deletion, changing the ID/start time, remaining
  started via UPDATE, and any terminal UPDATE, even an apparent no-op. Table
  owners retain ordinary DDL powers; this does not claim protection against a
  malicious database owner disabling triggers or truncating the table.

Terminal choices are `verified`, `integrity_failed`, `failed`, `cancelled` and
`limit_exceeded`. Only actual byte/checksum mismatches are integrity failures.
`verified` means server-side media checks and archive compression finished;
it does not prove final authorization, HTTP delivery, browser checksum
validation or coverage of another export channel.

## Aggregate contract

`read_operational_snapshot_v2()` is a no-argument SQL STABLE SECURITY INVOKER
function. One SQL statement composes the unmodified v1 result, overwrites
`schemaVersion` with 2 and adds exactly:

```text
exports.scope = synchronous_archive_assembly
exports.windowMinutes = 60
exports.coverageStartedAt = UTC ISO timestamp (null when invalid/absent)
exports.windowComplete = boolean
exports.integrityFailuresCount = nonnegative integer
exports.unsettledAttemptsCount = nonnegative integer
exports.invalidAttemptsCount = nonnegative integer
```

`observedAt` and the export comparison clock both use database
`statement_timestamp()`. The timestamp is not transaction start or a caller
argument. The v1 definition, shape and ACL remain byte-identical, and its
nonempty processing/cost/deletion counts remain compatible.

- Valid `integrity_failed` events count when `finished_at >= observedAt -
  interval '60 minutes'`, including the exact boundary. Starting long ago does
  not exclude a recent finish. Other terminal states never count as damage.
- Every valid `started` event counts as unsettled globally, including stale
  starts outside the hour. Invalid rows never enter normal counters.
- Unknown/null states, missing/nonfinite/future starts or terminal times,
  terminal times before their starts, and finished started rows count as
  invalid globally, even when their times fall outside the window. Consumers
  must mark the export group unavailable when invalid > 0.
- A singleton `archive_observation_coverage` records its first migration
  statement time. Reapplying the migration restores grants without resetting
  this epoch. Coverage is complete only at or after 60 elapsed minutes.
  A missing, null, nonfinite or future epoch emits null/false, which the strict
  loader must reject rather than treating as a valid empty snapshot.
- Fresh coverage and unsettled events remain explicitly incomplete. Known
  integrity failures remain a useful lower bound even during incomplete
  coverage. No historical/other-channel coverage is implied.

The tests include exact microsecond boundaries, several session timezones,
hostile search paths/temp shadows, read-only and repeatable-read transactions,
concurrent commits and unchanged ledger contents after aggregation. They do
not establish production latency on an unbounded ledger or simulate wall-clock
adjustments, PostgREST, remote providers or browser response delivery.

No remote database/provider request, build, deployment, commit or push is
performed by this experiment. Upload-event observations, actual alert delivery
and ownership, provider qualification and original G0-G4 acceptance remain
outside this proof.

# Operational snapshot: isolated PG17 verification

Run from the repository root:

```sh
node experiments/pg17-operational-snapshot/verify.mjs
node experiments/pg17-operational-snapshot/verify.mjs --without-migration
```

The first command must pass. The second deliberately skips the new migration
and must fail because the RPC does not exist (SQLSTATE `42883`). Both save safe
JSON under `docs/research/evidence/2026-10-29-operational-snapshot/pg-*.json` and
clean up before exiting. Reports contain hashes, assertion labels, role names,
local runtime/cleanup metadata and no business rows or raw database errors.

## Scope and isolation

- Imports the frozen `../pg17-routines/runtime.mjs` without editing it. That
  harness verifies its existing PostgreSQL 17.4 binary pins, scrubs every `PG*`
  environment variable plus `DATABASE_URL`, and starts a fresh `/tmp` cluster
  using a private Unix socket with TCP disabled. No remote database is contacted.
- Creates synthetic prerequisite tables with only `auth.users(id)`,
  `public.projects(id)` and `public.stories(id)`. Executes the exact four
  `CREATE TABLE` blocks for `media_assets`, `processing_jobs`,
  `processing_attempts`, and `deletion_requests` from the frozen P1 migration.
  It does not recreate these P1 columns in a second hand-written schema.
- Enables RLS for those four tables, with no member read policies. The local
  `service_role` really has `BYPASSRLS`, is not a superuser, and has only table
  `SELECT`; anon/authenticated/metadata_reader really lack `BYPASSRLS` and
  cannot execute even after forging `request.jwt.claim.role=service_role`.
  This narrows P1's service-role table grants for the read-only test; it is
  not a complete P1 migration-chain, project-member RLS or PostgREST rehearsal.
- Injects only synthetic identifiers, paths and private-text sentinels. Strict
  key allowlists verify that none appears in the RPC output.
- P1 `numeric(12,6)` accepts `NaN` but rejects infinities. The test first proves
  that rejection. A transaction then temporarily removes the numeric typmod
  to exercise defensive handling of infinities and rolls it back. Similarly,
  a separate rolled-back transaction relaxes specific constraints to test
  unknown states and missing dates under legacy schema drift. Normal scenarios
  retain the original P1 definitions.
- `await h.cleanup()` is never assigned back to `report.cleanup`; the harness
  writes that result itself. The runner also checks socket removal and PID
  disappearance, and fails if cleanup cannot be confirmed.

## SQL contract and metric decisions

`public.read_operational_snapshot()` accepts no arguments and returns exactly
one JSONB value with `schemaVersion`, `observedAt`, `processing`, `costs`, and
`deletions`. It is SQL `STABLE`, `SECURITY INVOKER`, with a fixed search path
`pg_catalog, public, pg_temp` and schema-qualified source tables. PUBLIC,
anon and authenticated have no execute permission; only the service-role
grant and the unavoidable database-owner privilege remain. Reapplying the
migration repairs these ACLs without writing ledger data.

One SQL statement aggregates all groups using the same statement snapshot.
`observedAt` is the database `statement_timestamp()` rendered as UTC ISO text,
not transaction start, client time or local DateStyle. The read-only transaction,
repeatable-read/concurrent-write, temp-shadowing and timezone scenarios verify
these boundaries. This does not prove production response time on a large ledger.

### Processing

- Every job must have a known P1 state, finite creation/update times, creation
  no later than the observation, and update between creation and observation.
  A job violating these checks increments `invalidJobCount` once.
- Queued/retry-wait jobs enter backlog only once `not_before` is due (or null).
  Age is the floor of elapsed seconds since the later of creation and eligibility.
  Finite future schedules are legitimate, not backlog or invalid data.
  Nonfinite eligibility is invalid for these states.
- Leased/running jobs stall when their owner is null/blank, expiry is absent,
  or expiry is at/past the observation. A nonfinite expiry or an expiry before
  creation is invalid. Future finite leases are legitimate. Missing leases
  are operational failures rather than malformed-time evidence.
- `outcome_unknown` is stalled. `awaiting_review` and terminal jobs do not
  enter backlog or stalled counts. Their basic creation/update integrity is
  still checked. Invalid jobs are excluded from measured aggregates; consumers
  must suppress healthy conclusions for the processing group when invalid > 0.

### Costs

- Includes every persisted processing attempt, across the lifetime of each
  project, joined through `job_id`; this is a ledger observation, not provider
  reconciliation or a guarantee that all real billable requests were recorded.
- Terminal success/retryable-error/fatal-error/cancelled attempts use settlement
  only. Active running/unknown-outcome attempts use max(reserve, settlement),
  never reserve plus settlement. Active reserve is required; active settlement
  may be absent pending provider reconciliation. Terminal settlement is required.
- A required amount that is null, negative, NaN or infinite marks that attempt
  unknown once. An invalid non-null active settlement also marks unknown.
  Optional terminal reserves are ignored. Valid participating amounts remain a
  known lower bound even if another required amount is invalid. An unknown state
  marks unknown and preserves only a valid settlement, not an assumed reserve.
- Sums known amounts by project, then `ceil(total_usd * 100)`, then returns the
  maximum across projects without any project identifiers. This preserves
  sub-cent costs without per-attempt rounding inflation. Consumers must not
  call costs complete when `unknownAttemptCostsCount > 0`. Extremely large
  values are not clamped; the TypeScript safe-integer gate rejects them.

### Deletions

Requested/processing/failed requests are overdue only after strictly more than
168 elapsed hours. Exactly seven days is not yet overdue. Using hours rather
than a seven-calendar-day interval avoids session-timezone DST drift. Completed
requests are excluded. Unknown open states, missing/nonfinite requested time,
or future requested time increment `invalidRequestCount` and must suppress
healthy conclusions for that group. Other timestamps do not define this SLA.

## Remaining qualification

An empty ledger yields real zero aggregates only for this narrow database
scope. It does not prove the workers, uploads, exports, providers, billing,
notification delivery, operational ownership, devices, families, or G0-G4
readiness. No full project build, commit, push, deployment, remote migration,
real provider request, or remote data capture is performed by this runner.

PostgreSQL references:

- [STABLE functions and statement snapshots](https://www.postgresql.org/docs/17/xfunc-volatility.html)
- [Statement timestamp and date/time arithmetic](https://www.postgresql.org/docs/17/functions-datetime.html)
- [Function security and search path](https://www.postgresql.org/docs/17/sql-createfunction.html)
- [Numeric NaN and infinity limits](https://www.postgresql.org/docs/17/datatype-numeric.html)

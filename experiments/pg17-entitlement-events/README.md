# Trusted entitlement events — local PG17 composition

This candidate composes the reviewed invitation implementation with a protected entitlement ledger in a fresh, synthetic PostgreSQL 17.4 cluster. It does not validate a payment provider, run a migration, or enable the application. Existing application code and prior SQL/evidence remain untouched.

Run from the repository root:

```sh
node experiments/pg17-entitlement-events/verify.mjs --red
node experiments/pg17-entitlement-events/pin-inputs.mjs
node experiments/pg17-entitlement-events/verify.mjs
node experiments/pg17-entitlement-events/verify-lifecycle.mjs
```

`--red` intentionally exits 1: the old column ACL actually permits an unauthorized wallet increment, and the required event grant subsequently fails with `42883`. Its report preserves safe before/after fingerprints of the real private synthetic state. Normal verification exits 0. `pin-inputs.mjs` is an explicit freeze operation; the runner never updates pins. Final verification compares all inputs at entry and exit. Raw reports have unique timestamps/UUIDs; failed/intermediate runs remain distinct. Tokens, private routine bodies, package names and credentials never enter reports.

The runner also accepts `--test-signal-ready`, `--test-fail-start` and `--test-client-failure`. The lifecycle observer checks hostile PG/DATABASE_URL environment scrubbing, real SIGTERM after fixture readiness, actual invalid server startup and a missing-role connection failure; it independently checks process absence and scratch-directory removal. It never contacts a remote server. The old Harness/replay modules are imported unchanged and checked against the prior invitation manifest; the full installed runtime bin/lib/share inventory, Node executable and loaded CommonJS closure are byte pinned. macOS libSystem/kernel remain ambient dependencies.

## Interfaces and input rules

Only the real `entitlement_writer` database role may execute:

```sql
entitlement_candidate.apply_event(
  provider text, event_id text, source_key text, kind text,
  payer_id uuid, resource_type text, quantity integer
) RETURNS TABLE(source_id uuid, outcome text, revoked boolean)

entitlement_candidate.lookup_event(provider text, event_id text)
  RETURNS TABLE(source_id uuid, outcome text, revoked boolean)
```

The role is LOGIN, NOINHERIT, NOSUPERUSER, NOCREATEROLE, NOCREATEDB and NOBYPASSRLS. It has no memberships, is not granted to an ordinary role, and has no direct writes to business or candidate tables. JWT/GUC role strings cannot grant event authority. All new functions have empty `search_path`, qualified references, a NOLOGIN owner, explicit ACLs and no default PUBLIC function execution privilege. The database name and independent `saga.entitlement_events=only_synthetic_local` marker are both mandatory.

Identifiers accept ASCII `[A-Za-z0-9_.:-]`: provider length 1–64 bytes; event ID and source key length 1–128 bytes. They are case sensitive and use `C` collation. NULL, empty, whitespace, other punctuation, Unicode and overlength inputs fail with `22023`. Kind is exactly `grant` or `revoke`; resource is exactly `facilitator_seat` or `storyteller_seat`; payer is a non-NULL existing synthetic user; quantity is an integer from 1 through 2,147,483,647. A missing payer fails the real FK (`23503`); balance overflow fails `22003`.

`events` stores the complete typed immutable request, source association, durable outcome and timestamp under `(provider,event_id)` uniqueness. `sources` fixes payer/resource/quantity under `(provider,source_key)` uniqueness and references the protected invitation source, first event and unique credit transaction. The deferred first-event FK closes source creation and event registration in one transaction. Ordinary callers cannot insert/update/delete either side. These are API immutability guarantees and relational constraints under the isolated owner boundary, not protection against a malicious database owner.

First grant creates a source, ledger row, one `purchase` audit transaction and one event; it increments only the selected existing balance. A new wallet begins at zero for every other resource and has no payment reference. Legacy wallet gift initialization is never used. Historical balances, payment reference, project payment status and existing logs remain unchanged. NULL wallet balances and arithmetic overflow refuse the first grant with complete rollback.

Same event/payload returns the original outcome and current source revocation state with no writes; changed kind, payer, resource, quantity or source fails `22023`. A distinct grant event for the same source records `already_granted` without another credit. Source payload changes fail `22023`. Revocation is terminal: first revoke returns `revoked`, later distinct revokes `already_revoked`; late grants return `grant_suppressed`, including a tombstone whose payer has no wallet. No reactivation endpoint exists. `lookup_event` returns zero rows when absent and current `revoked` when present. Recovery is tested by committing, discarding the apply response, closing the connection, and querying from a new writer connection.

## Invitation composition and locking

Fresh setup creates no trusted sources. All business-test sources are created through the writer. A deliberately injected orphan exists only inside the negative installation rollback test; installation refuses it instead of adopting it. The SQL is an empty-environment composition and cannot migrate old fixture-manager sources or bindings. Reinstallation preserves committed business rows.

Grant supplies the existing invitation send/accept/release/status/lookup ports. Source remaining and revocation are required in addition to the wallet mirror. Duplicate requests and pending-target aliases do not reserve twice. Revocation blocks new sends, pending acceptance and repeated acceptance. Cancellation/expiry releases an existing reservation exactly once, restoring its original source and mirror without clearing revocation.

Consumed-source revocation locks and deactivates only the durable mapped member whose current project/user/role matches. It preserves bindings, invitations, members, logs and exports. Missing/inactive members are not recreated; mismatches refuse with full rollback, including earlier member updates. Independent project ownership or separately funded members retain their authority. The two export candidates deny newly requested exports for members whose only authority was the revoked mapping. Existing export requests, URLs and Storage access still require the future delivery/Worker authorization work.

Event and source advisory gates serialize their identities before any row locks. Relevant projects are discovered, locked in UUID order, then the wallet, source/bindings and members are locked. The wallet serializes invitation writes. After locking it, the candidate rereads project coverage: a newly committed binding to a previously undiscovered project causes `40001` with zero writes. The trusted caller must retry the whole transaction. A tested retry finds and deactivates both members. The test suite observes actual `pg_locks` and `pg_blocking_pids`; sleeps only poll those observations, never establish ordering evidence. This is tested at PostgreSQL's default READ COMMITTED isolation.

The wallet remains a compatibility total. Revocation does not guess how much consumed/reserved credit to subtract; a revoked source can therefore coexist with a positive mirror. Applications must consume only through a valid source. The candidate is not ready to enable in the existing application.

## ACL closure and compatibility

Installation removes table and explicit column privileges on sensitive public tables (`projects`, `project_roles`, `project_members`, `user_resource_wallets`, `seat_transactions`, `invitations`) and all candidate tables from PUBLIC, anon, authenticated, service_role, metadata_reader and entitlement_writer. Column INSERT/UPDATE/REFERENCES/SELECT ACLs are removed separately because revoking table privileges does not revoke column grants. The synthetic fixture first grants permissive ACLs, including a real wallet RLS policy, so the tests exercise ACL closure rather than merely relying on RLS.

These exact legacy public RPC signatures lose EXECUTE for those roles, while their definition bytes remain unchanged:

- `accept_project_invitation(uuid,uuid)`
- `cleanup_expired_invitations()`
- `create_project_with_role(text,text,uuid,text)`
- `initialize_user_wallet(uuid)`
- `process_package_purchase(uuid,text,integer,integer,text)`
- `process_package_purchase(text,text,uuid)`
- `send_project_invitation(uuid,uuid,text,uuid,text)`

`request_data_export(uuid,uuid,boolean,boolean)` and `request_data_export(uuid,uuid,jsonb)` retain only authenticated as their caller entry. Invitation candidate entries retain authenticated; entitlement entries retain only writer. The synthetic database owner remains privileged. PUBLIC and writer EXECUTE grants are also removed from all public business routines; unrelated read/notification/checkout routines retain their existing explicit ordinary-role grants. Their definitions are unchanged. The fixture owner's global future-function default removes PUBLIC EXECUTE, because PostgreSQL per-schema REVOKE cannot override the built-in global default.

Direct table/column writes and all seven unsafe RPCs are attempted through every actual ordinary role and writer connection. Tests also attempt SET ROLE to owner/admin/writer and GUC spoofing. The suite does not reproduce every production role inheritance or RLS policy and does not claim provider verification from synthetic input.

## Evidence and limits

Coverage includes both seat types; event/source conflicts; repeated events; out-of-order tombstones; new wallets; unknown-commit recovery; NULL/overflow; identifier boundaries; all owned write-stage faults and caller rollback; installation marker/database gates, DDL rollback and repeat installation; invitation/member/export behavior; 20 concurrent schedules; and four lifecycle checks. All refusal/fault assertions compare complete related table snapshots in memory and record only per-table row counts/SHA-256 hashes publicly.

The source and event tables have no production migration or backfill. Real provider signature/account/product mapping, secret deployment, Storage revocation, migrations/history/rollback/backup, vendor conditions and devices remain outside this experiment. G0/G1 remain open. No commit, push, deployment, remote mutation or production payment evidence is produced here.

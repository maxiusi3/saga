# Local PostgreSQL 17 routine rehearsal

This experiment replays the 12 exact, privately captured RPC definitions and the separately audited `public.update_updated_at_column()` trigger in an isolated upstream PostgreSQL 17.4 cluster. It records the captured routines' actual behavior, then replaces only the two export overloads with the local candidate. All rows and caller identities are synthetic. It makes no remote connection, RPC, payment, email, Storage or worker call, and applies no root migration.

From the repository root:

```sh
node experiments/pg17-routines/verify.mjs
node experiments/pg17-routines/verify-lifecycle.mjs
node experiments/pg17-routines/verify.mjs --red
```

The normal run must pass. The lifecycle observer runs the full suite under hostile PostgreSQL environment variables, sends a real SIGTERM after fixture readiness, attempts an invalid server startup, and opens a connection as a nonexistent local role. Those last three child processes must fail or terminate as expected while their cleanup checks pass. `--red` deliberately omits the candidate and fails the durable-export assertion against the captured four-argument routine. A failed setup is not a valid export RED.

Each invocation exclusively creates a uniquely named JSON report under [the PG17 evidence directory](../../docs/research/evidence/2026-10-17-pg17-routines/). Existing reports are preserved. The [implementation report](../../docs/research/evidence/2026-10-17-pg17-routines/pg17-implementation.md) and [verification manifest](../../docs/research/evidence/2026-10-17-pg17-routines/pg17-implementation-verification.json) identify the final runs, hashes, observed SQLSTATE values and limits.

## Pinned inputs and local runtime

The runtime is the already built PostgreSQL 17.4 installation under `.superpowers/sdd/2026-10-17-upgrade-pg17-routines/runtime/install/bin`. [Build provenance](../../docs/research/evidence/2026-10-17-pg17-routines/runtime-build.json) records the official source archive and build. `runtime-pins.json` fixes `postgres`, `pg_ctl` and `initdb` executable hashes; the runner checks them before startup and verifies both the reported server version and `plpgsql.variable_conflict=error`. It does not use or install a system service. The existing `pg` driver under `experiments/t05-durable-worker/node_modules` is read without changing that experiment or installing dependencies.

`replay.mjs` pins both public capture reports, their private file hashes and the 06:13 metadata snapshot SHA-256. It checks private file type, single link, 0600 mode and nonsymlink 0700 containing directory, verifies every exact identity and definition digest, and checks the reconstructed catalog. The 12-RPC [semantic review](../../docs/research/evidence/2026-10-17-routine-audit/semantic-review.md), [callsite review](../../docs/research/evidence/2026-10-17-routine-audit/callsite-review.md) and [trigger review](../../docs/research/evidence/2026-10-17-pg17-routines/trigger-semantic-review.md) establish the reviewed dependencies. A digest match is an integrity check, not an independent safety audit of arbitrary SQL. Only the fixed, previously reviewed definitions and selected metadata are executed. Private package inputs are derived in memory and bound as parameters; they are never printed.

The harness removes all `PG*` variables and `DATABASE_URL` before loading `pg` or spawning PostgreSQL. Every connection specifies a private Unix socket, database, actual role, port, inert nonempty password, `ssl:false` and bounded timeouts. TCP listening is disabled. The cluster and socket have private temporary paths. Clients are closed before stopping the server; the cluster directory is removed only after stop or definite absence is confirmed. An uncertain stop preserves the directory and fails the report. The observer independently verifies child exit, postmaster absence, directory removal, no remaining clients, empty stderr and safe JSON stdout.

## Fixture coverage and deliberate differences

`fixture.sql` and `schema-manifest.json` materialize seven complete relevant public table shapes: `projects`, `project_roles`, `project_members`, `user_resource_wallets`, `seat_transactions`, `notifications`, and `export_requests`. The runner checks all 70 columns, 34 constraints, 34 indexes and the three exact BEFORE UPDATE ROW trigger bindings on `projects`, `project_roles` and `user_resource_wallets`. It also executes those triggers and checks their transaction-time result.

Two captured CHECK expressions deparse differently on the local runtime: `notifications_type_check` and `project_members_role_check` cast each array element to text instead of casting the entire array. Both expected and actual expressions remain in the report. Only these two named expressions receive that explicit comparison normalization. Real inserts test every captured allowed value, an invalid value, the separate NOT NULL rejection, and CHECK behavior for NULL with NOT NULL temporarily removed inside a rolled-back transaction.

The manifest lists all deliberate differences. `auth.users` has only a synthetic UUID key; `auth.uid()` reads a local claim GUC and does not verify JWTs. `extensions.uuid_generate_v4()` is a disclosed SQL shim to `pg_catalog.gen_random_uuid()`, not the captured extension runtime. Objects belong to a nonlogin, non-superuser `fixture_owner`. RLS is enabled and not forced, while production policies are omitted and caller table grants are revoked. This is stricter than the captured direct-table boundary. Four separate login roles have no inheritance, superuser or BYPASSRLS privileges. This does not reproduce Supabase/PostgREST authentication, deployed role inheritance, service bypass, extension hooks, rules, other schemas or external consumers.

`setup-fixture.cjs` is a maintainer-only generator, not a normal run prerequisite. It accepts only the fixed snapshot, reviewed table selection, approved identifiers/types/defaults and constrained metadata statements. It writes the public fixture, manifest and runtime pins; regenerated output requires review before replay.

## Export candidate contract

The candidate preserves both exact signatures, parameter names, absence of defaults and result shapes:

| Identity | Result | Persisted options |
| --- | --- | --- |
| `request_data_export(p_user_id uuid, p_project_id uuid, p_include_audio boolean, p_include_photos boolean)` | One TABLE row: `export_id uuid`, `status text`, `created_at timestamptz` | Both supplied booleans under `includeAudio` and `includePhotos` |
| `request_data_export(project_id uuid, user_id uuid, export_options jsonb)` | Scalar UUID | Exactly `includeAudio`, `includePhotos`, `includeTranscripts`, `includeInteractions` |

Both require a non-NULL `auth.uid()` equal to the requested user, and either `projects.facilitator_id` for that project or an active `project_roles` row on the same project. Neither `owner_id` nor `project_members` grants access. Only the actual `authenticated` role receives EXECUTE; PUBLIC, anon, metadata_reader and service_role are explicitly revoked for both identities. Fake role claims do not restore EXECUTE, and there is no service fallback. The SECURITY DEFINER owner remains private, the search path is empty, and all referenced tables and helpers are qualified.

The four-argument overload rejects NULL booleans. The JSON overload requires an object, accepts only the four listed boolean keys, rejects unknown keys and JSON/SQL NULL, and defaults each omitted key to true. Identity, project, status and request IDs cannot be supplied as options. These are intentional compatibility changes from the captured routines' ignored flags or unchecked JSON. The four-argument interface does not acquire transcript/interaction parameters. The application TABLE-result consumption issue described in the callsite review remains outside this experiment.

Both insert one `export_requests` row with `status='pending'`, the real project/user IDs, bounded options and the table-created timestamp. The four-argument return uses that same ID/timestamp and `status='queued'`. This means registration within the caller's transaction; durability requires commit. There is no worker, generated download, delivery guarantee or idempotency key. A caller rollback removes the request. A response lost after commit can lead to duplicate requests on retry.

The candidate locks the project row first and then the active membership row when needed, holding locks through the transaction. Both overloads are tested with membership UPDATE, membership DELETE and facilitator UPDATE, in both request-first and revocation-first orders. Actual `pg_locks` waits and blocker relationships must be observed. The first ordering preserves a committed, previously authorized registration; the second rechecks the committed revocation and denies insertion. The coarse project lock serializes exports on the same project and can limit throughput. This does not cancel an already committed request or authorize a later worker's access to data.

The candidate is applied atomically. Tests cover the local marker guard, whole-DDL rollback after an injected SQL failure, repeated application without changing historical rows, real insert-constraint failure and caller rollback. It has no destructive down migration. The database name and session marker are accident guards, not an authorization boundary.

## What the tests establish

All 12 captured identities run with valid synthetic arguments, no claim, a different caller, invalid arguments and anon without a claim; two further privately selected purchase branches are exercised. Reports distinguish client SQLSTATE from sanitized result shape and postconditions. The 60 main baseline calls also run inside explicit rollback and compare all seven tables. Failed purchase branches are checked for no partial resource or transaction writes. Raw database messages, query text, error CONTEXT, private bodies and private return strings are excluded.

The candidate suite checks active members and facilitators; NULL/missing/spoofed identities; foreign, pending, inactive and actually deleted membership; active `project_members`-only membership; `owner_id`-only users; all denied roles including fake claims; options; exact ACL/signature/owner properties; denied direct table access and role escalation; temp-schema shadowing; triggers; atomicity and concurrent revocation. The deleted-member scenario first inserts and verifies an active role, deletes exactly that row, then checks refusal. The alternative membership scenario verifies an active `project_members` row and no authoritative `project_roles` row before calling either overload.

This candidate closes only its own entry contract. Captured, unpatched routines can still accept invitations or create projects/resources without binding the real caller. Those paths must be fixed as part of a wider permission review before deployment; valid membership cannot be trusted merely because this export function checks it. Direct authenticated database credentials, administrator mutation of roles/schema, production JWT verification, payment integrity, invitation migration and the worker/Storage/download boundary remain outside the rehearsal. It is not a deployment artifact or a G0/G1 milestone.

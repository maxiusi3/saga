# T02 source ledger rehearsal

Run `node experiments/t02-source-ledger/verify.cjs` from any directory.
`--label=normal` names the evidence run; `--signal-after-setup --label=signal`
interrupts a seeded, stable fixture with SIGTERM and should exit 143.

The runner uses existing Node/TypeScript/pg/PostgreSQL installations and the
pinned October 17 metadata snapshot. It creates a temporary database through a
private Unix socket with TCP disabled. Both pg.Client and subprocesses ignore
ambient PostgreSQL connection settings: clients explicitly disable SSL and set
an inert nonempty password, while subprocesses remove PG* and DATABASE_URL.
Connection, statement, lock, transaction-idle, barrier and overall timeouts are
finite. Every run records runtime/source/snapshot hashes, assertion names, actual
PostgreSQL blocking chains and cleanup results in
`docs/research/evidence/2026-10-17-t02-source-ledger/`.

## Scope and records

Only fictional stories, actors and assets enter this database. Source columns
include the captured `images jsonb[]`, `photo_urls text[]`, required identities
and title. Two families use the captured role/status values; experimental
tombstones and asset tables are explicitly synthetic additions. No body,
metadata or interactions are queried. `schema.sql` belongs only in this
experiment, never in root migrations or a production database.

`source_observations` records project, table, row, field and positional source
path. The real TypeScript projector produces all references, including abnormal
array slots and conflicting aliases. `mapped` remains a locator candidate.
`source_reviews` stores append-only review conclusions separately.
`source_bindings` stores one immutable binding per observation, independently of
the source and review. The synthetic asset/evidence tables do not imply that any
real object has been checked.

Observations, reviews, verification evidence and bindings reject UPDATE, DELETE
and TRUNCATE. Observation uniqueness covers project + table + row + field + path
+ algorithm + digest. A different source version appends an observation with a
`conflicts_with` link; returning to a previous version returns its existing ID.
The old payload, review and binding remain intact. Foreign keys enforce the
binding's project and verification/asset/version identity; a unique constraint
prevents a second binding for the same observation.

Clearing a previously observed scalar/array, shortening an array or removing an
image property still appends a version for each historical path absent from the
current projector output. These records use the current complete field snapshot,
`locator_status='unresolved'`, `reason='source reference removed'`, JSON null raw
value and no bucket/key. They link to prior conflicting observations and cannot
bind or inherit a binding. Repeated collection reuses their durable IDs; restoring
an earlier source version reuses its original mapped ID without deleting the
removal history. Never-observed absent fields do not invent source paths. The
original projector remains unchanged and creates no locator for an absent value.

## Digest and trusted adapter

`saga-pg-jsonb-media-v1` hashes the UTF-8 bytes of a deterministic PostgreSQL
`jsonb_build_object(...)::text` envelope containing the algorithm tag,
`pg_typeof(field)::text`, `to_jsonb(field)` and `field::text`. It covers the full
selected field. The canonical jsonb representation removes JavaScript object
key-order dependence; the PostgreSQL text representation additionally preserves
SQL NULL versus JSON null elements and PostgreSQL array bounds. Array order,
other array slots and the actual database type all contribute to the digest.
Cross-major PostgreSQL representation stability is not asserted; PG17 requires
its own validation before adopting this algorithm in a migration.

`createLedger({planLegacyStoryMedia})` accepts the trusted, actual projector and
exposes `observeStory(client,{storyId,actorId})`,
`bind(client,{observationId,verificationId,actorId})` and
`reconcileBinding(client,{observationId,verificationId,actorId})`.
Each operation requires a dedicated idle owner connection. Do not overlap calls
on one connection or embed them in a caller transaction. The actor is supplied
by this trusted fixture harness; this is not a public API authentication boundary.
Input keys are strict. SQL field identifiers come only from a fixed allowlist;
request data cannot specify a table, source path, locator, raw payload or digest.

Binding consumes an explicit immutable `synthetic_fixture_only` verification
record and compares project/story, kind, bucket/key, asset version, object
version, byte size and SHA-256 against the locked asset. It also verifies current
source field/type/digest/projection. This does **not** verify real Storage bytes,
ownership, RLS, auth tokens, story action roles or purpose consent.

## Transaction and fault contract

The lock order is project -> story -> current membership -> asset -> observation.
All are row locks held through COMMIT. The coarse project lock serializes newly
observed source identities and same-project binding requests; scalability is
not a goal of this experiment. Every transaction explicitly uses READ COMMITTED.
After blocking it reads current project/story/membership/asset values, so a
source edit, project move, revocation or tombstone cannot slip between checking
and inserting. Being an old uploader grants no privilege; a current active
member or the project's current facilitator is required by this fixture policy.
The ordinary anonymous/authenticated roles, including inherited PUBLIC grants,
have no direct access to the ledger schema, tables, sequences or functions.
The owner can still change schema/disable triggers: the adapter remains trusted.

Concurrent tests wait for actual `pg_stat_activity`/`pg_blocking_pids` evidence,
including indirect blocker chains; arbitrary elapsed time is not proof of a
race. A barrier immediately before COMMIT verifies project, story, membership
and asset mutations remain blocked until the binding commits.

A genuine division-by-zero after INSERT verifies ordinary rollback. A real
`pg_terminate_backend` verifies connection-loss rollback and captures the failed
ROLLBACK attempt. The unknown-COMMIT case lets PostgreSQL actually COMMIT, then
the test transport wrapper throws before returning that acknowledgement to the
adapter. It is an explicit lost-acknowledgement injection, not a network proxy
test. The adapter reports `commit_outcome_unknown` without rollback or deletion;
a fresh connection reconciles durable observation/verification IDs, even after
later source or asset versions change. Reconciliation of a committed historical
binding does not reauthorize new use of its asset.

The runner preserves exact RED source snapshots and reports, including genuine
missing-observation, missing-binding, truncate and cleared-source-history failures. Intermediate failed
runs remain history. Only the final normal/host-environment reports attest the
final source hashes. The stable-fixture SIGTERM report attests cleanup, not all
behavioral assertions.

PostgreSQL 14 fixture results do not replace PG17, complete production
RLS/triggers, Storage HTTP, real object inventory, backup/restore/rollback or G1
device acceptance. No credentials, remote connections, real objects,
dependencies, commits, pushes, migrations or deployment are part of this runner.

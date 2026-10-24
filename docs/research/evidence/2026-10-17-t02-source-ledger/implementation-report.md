# Task 2 implementation report

Completed 2026-10-17 (Asia/Taipei). Scope: the local synthetic source ledger and
atomic binding task only. Controller owns independent review, project-wide
verification, documentation/handoff and milestone assessment. Implementation
files are frozen for review; no commits, pushes, remote access, credentials,
dependencies, root migrations or changes to pre-existing runners/projectors.

## Files

- `experiments/t02-source-ledger/schema.sql`: selected actual source column
  types/nullability, fictional projects/members, source observations, reviews,
  simulated assets/verification evidence and immutable bindings. Database
  uniqueness/FKs enforce source/version identity, one binding per observation,
  project isolation and verification/asset/version identity. UPDATE/DELETE and
  TRUNCATE of history are rejected. Ordinary fixture roles have no direct ledger
  access.
- `experiments/t02-source-ledger/ledger.cjs`: trusted local adapter using the
  actual projector; strict request keys, allowlisted SQL field identifiers,
  canonical PostgreSQL full-field digests, append-only observations/conflicts,
  exact binding checks, current authorization/tombstones and durable unknown
  COMMIT reconciliation.
- `experiments/t02-source-ledger/scenarios.cjs`: real PostgreSQL contract,
  concurrency and fault scenarios. Explicit barriers and actual blocking chains
  establish race ordering.
- `experiments/t02-source-ledger/verify.cjs`: isolated Unix-socket cluster,
  filtered subprocess environment and explicit client settings, bounded
  lifecycle, pinned metadata/source fingerprints and JSON evidence reports.
- `experiments/t02-source-ledger/README.md`: APIs, digest and transaction
  contract, reproduction and limitations.

## Design decisions

The digest tag is `saga-pg-jsonb-media-v1`. SHA-256 covers the UTF-8 PostgreSQL
canonical jsonb envelope of algorithm tag, actual `pg_typeof`, `to_jsonb` full
field and PostgreSQL field text. The last component preserves SQL NULL versus
JSON null elements and array lower bounds otherwise lost by JSON projection.
Canonical PostgreSQL jsonb removes JS key insertion order. All array positions
and sibling slot changes contribute; locator strings are never source identity.

Source identity is project/table/row/field/path + algorithm/version digest.
Repeated source versions return the original ID. New versions append and point
to an earlier conflicting observation; original payload/review/binding remain
unchanged. Reverting to a previously seen version returns that original ID.

Lock order is project -> story -> current membership -> asset -> observation.
The project lock serializes identities not yet represented by observation rows.
Transactions explicitly use READ COMMITTED, recheck current values after waits
and retain all check-protecting locks until COMMIT. The coarse lock is acceptable
for this rehearsal; it is not a production throughput recommendation.

Bindings consume explicit immutable `synthetic_fixture_only` evidence. Current
asset project/story/kind/bucket/key/version/object-version/size/hash must match
the evidence and current source, with no tombstone. Old uploader identity does
not bypass current active membership; a current project facilitator is allowed
by this fixture policy. No claim is made about real object verification or the
full production action/consent matrix.

Unknown COMMIT is represented as an unknown outcome, without ROLLBACK or deletion.
The scenario truly commits PostgreSQL data then injects acknowledgement loss in
the transport wrapper. Reconciliation on another connection reads the durable
observation + verification identity, including after later source/asset changes.
It does not make a historical binding usable after revocation/deletion.

## RED and intermediate evidence

Evidence directory: `docs/research/evidence/2026-10-17-t02-source-ledger/`.
Every `red-*` label saved exact implementation/test source snapshots as `.txt`
alongside its JSON report. Reports are retained rather than overwritten.

| Report | Actual result / meaning |
|---|---|
| `red-observe-1792216074546-56140.json` | Setup assertion caught mistaken title type before a cluster was created. Not a behavioral TDD RED. |
| `red-observation-behavior-1792216090284-56157.json` | Genuine RED: real DB source required nine positional observations; scaffold returned zero. Full cleanup passed. |
| `green-observation-1792216202491-56295.json` | Observation/idempotency implementation passed nine assertions; historical stage only. |
| `red-binding-behavior-1792216267515-56417.json` | Genuine RED: explicit real fixture asset/evidence did not produce a durable binding. |
| `red-binding-contract-1792216437786-56776.json` | Same binding RED with the complete contract/race/fault scenarios written before implementation. |
| `green-contract-1792216482193-56911.json` | Intermediate failure after 113 checks: evidence observer expected a direct blocker, but PG queues a second waiter behind the first. No claim of passed concurrency for this run. |
| `green-contract-chain-1792216534312-57036.json` | Recursive actual blocker-chain observation fixed the harness; 154 checks passed. |
| `red-append-only-truncate-1792216647908-57198.json` | Genuine RED: TRUNCATE succeeded despite row mutation triggers. Added statement-level TRUNCATE rejection. |
| `green-append-only-1792216726814-57334.json` | 174 checks passed; historical stage only. |
| `red-fixture-fidelity-1792216819446-57490.json` | Full selected-column introspection caught nullable actual role status; corrected status nullability and captured mastered-audio varchar type before final runs. |

Critical TDD used `/Users/eat/.agents/skills/superpowers/test-driven-development/SKILL.md`.
Observation/binding behaviors and missing TRUNCATE protection were observed
failing before their corresponding implementation. The entire harness uses real
PostgreSQL. Only explicit transport boundaries are wrapped to inject faults or
pause COMMIT, with all SQL statements still executed by PostgreSQL.

## Final verification

Runtime: Node 22.22.2, PostgreSQL 14.17 (Homebrew), pg 8.16.3, TypeScript 5.9.3.
Pinned saved metadata SHA-256:
`bb808a1ce050947d21963ca91ec49c3adfa0ab80fe24f24f653f8c18bc6e6a4f`.

| Final report | Exit / assertions | Concurrency / cleanup |
|---|---|---|
| `normal-final-1792216844015-57651.json` | 0 / 190 passed | 18 actual lock records; cluster stopped, temp removed, zero clients, no cleanup errors |
| `host-env-final-1792216862629-57771.json` | 0 / 190 passed | 18 actual lock records; same complete cleanup |
| `signal-final-1792216862630-57772.json` | 143 / stable fixture reached after 21 checks | SIGTERM intentionally interrupted; same complete cleanup; not a behavioral pass |

Final normal and host-environment runs each persisted 63 observations, 1 review,
6 bindings and 32 simulated assets before the disposable cluster was removed.
They share identical final hashes for all five experiment files and both actual
projector modules. The original baseline source row remained unchanged after
collection/binding; intentional source mutation scenarios restored its exact
representation before that final assertion.

Meaningful coverage includes all selected source-column types/nullability,
positional anomalies, exact same-basename locators, duplicate/concurrent
observations, same-project/different-story identities, cross-family identities,
full-field sibling/order/SQL-null/bounds/type version changes, retained old
review/binding, request-field rejection, database uniqueness and immutable
history, ordinary-role denial, missing verification, scope/kind/key/bucket/state/
version/object-version/size/hash rejection, ambiguous/unresolved source denial,
facilitator access and revocation, inactive/null member status, changed source/
project/asset while blocked, project/source/asset tombstones, concurrent same and
conflicting assets, four locks retained through COMMIT, actual SQL rollback,
real backend termination with failed ROLLBACK and durable unknown-COMMIT recovery.

Commands run from repository root:

```sh
node --check experiments/t02-source-ledger/ledger.cjs
node --check experiments/t02-source-ledger/scenarios.cjs
node --check experiments/t02-source-ledger/verify.cjs
node experiments/t02-source-ledger/verify.cjs --label=normal-final
env PGHOST=synthetic-unreachable.invalid PGPORT=1 PGUSER=synthetic-host-user PGDATABASE=synthetic-host-db PGPASSWORD=synthetic-host-password PGSSLMODE=require PGSSLCERT=/synthetic/no-cert PGSSLKEY=/synthetic/no-key PGSSLROOTCERT=/synthetic/no-ca PGPASSFILE=/synthetic/no-pgpass PGOPTIONS='-c statement_timeout=1' DATABASE_URL=postgresql://synthetic:synthetic@synthetic-unreachable.invalid:1/blocked node experiments/t02-source-ledger/verify.cjs --label=host-env-final
node experiments/t02-source-ledger/verify.cjs --signal-after-setup --label=signal-final
```

The synthetic host variables are invented test inputs. No host credential files
were read. Normal and host-env runs explicitly check each created client uses
`ssl:false` and the inert nonempty password, and that server TCP is disabled.
Syntax checks passed; all final scripts also parsed and executed successfully.

## Remaining boundary

No implementation blocker remains in Task 2. Independent specification/quality
review and controller-wide checks remain pending. The harness requires a
dedicated idle owner connection and trusted actor identity; it is not exposed as
a public production adapter. The owner can change schema/disable triggers, and
the coarse project serialization has not been performance tested. Digest
representation must be verified against PG17. Production RLS/triggers, actual
Storage inventory/hash/bytes/ownership, formal action/consent/deletion adapter,
backup/restore/rollback, shadow reads and G1 device matrices remain outside this
local rehearsal. No original upgrade-plan milestone is claimed.

## Fix 1 — R1/P2 cleared and removed source history

2026-10-17 (Asia/Taipei). The independent initial review requested changes for
one actual gap: the old collection loop only visited current projector results,
so cleared scalar/array fields and removed array/property paths had no durable
successor version. The preceding 190-check reports remain historical evidence;
they do not establish that this missing case worked. The controller's saved
`task-2-fix1-before/` package was not changed.

Used the receiving-code-review and existing TDD instructions. Added the focused
real PostgreSQL regressions first, then ran
`node experiments/t02-source-ledger/verify.cjs --label=fix1-red-r1`.
`fix1-red-r1-1792217681643-58863.json` exited 1 after 77 successful checks with
the expected assertion: a scalar cleared to SQL NULL had no durable removed
successor (`false !== true`). Full cluster/client/directory cleanup passed.
The runner saved the exact five RED source snapshots with the `fix1-red-r1-`
prefix; this required only allowing `fix1-red-` labels in the snapshot condition.

The scoped correction reads the previously observed field/path identities for
the locked project/story. A path absent from the current actual projector output
is added to the adapter's collection list with JSON null raw value, no locator,
`locator_status='unresolved'` and `reason='source reference removed'`. It uses the
current complete typed field snapshot/digest and the existing conflict/unique
insertion path. That preserves links to the old observation while making
repeated removal collection idempotent. Existing binding checks reject these
non-mapped records. No schema change or new field-version table was necessary;
the old projector and resolver remain byte-identical. Never-observed empty
fields still invent no paths. Historical paths stay observable even while absent,
and restoring a previous field version reuses its existing mapped observation.

Seven focused cases add 100 assertions: scalar to NULL; text[] to empty and
NULL; jsonb[] to empty and NULL; removal of an array position; removal of an
image's thumbnail property. Each checks a persisted explicit removal, exact
whole-field value/type, changed digest and prior-observation link, repeated
collection without extra rows, unchanged original observation/review/binding,
denied binding for both the removed and stale original version, no inherited
binding and restoration of the old mapped identity. The two partial-removal
cases also check that surviving paths remain independently mapped.

`fix1-green-r1-1792217712792-58969.json` passed all 290 assertions before the
README explanation was added. Final evidence below includes that README change
and replaces the earlier final reports as the current implementation evidence:

| Final report | Observed exit / assertions | Lock evidence / cleanup |
|---|---|---|
| `fix1-normal-final-1792217755916-59095.json` | 0 / 290 passed, including 100 R1 checks | 18 actual lock records; stopped cluster, removed directory, zero clients, no cleanup errors |
| `fix1-host-env-final-1792217781277-59229.json` | 0 / 290 passed, including 100 R1 checks | 18 actual lock records; same full cleanup |
| `fix1-signal-final-1792217781277-59230.json` | 143 / stable fixture reached after 21 checks | Intentional SIGTERM; same full cleanup; not a behavioral pass |

The final commands are the earlier documented normal, synthetic host-environment
and signal commands with labels `fix1-normal-final`, `fix1-host-env-final` and
`fix1-signal-final`, respectively. All synthetic environment values are exactly
the same as the earlier documented command. Both completed runs retained 82
observations, 8 reviews, 13 bindings and 39 synthetic assets before cleanup.
The runtime and pinned metadata hash are unchanged.

Recomputed and asserted all seven final source hashes against each of the three
reports and current files; all matched, including README. Current hashes:

| File | SHA-256 |
|---|---|
| `schema.sql` (unchanged) | `1ee41a18d58a45b07ffef264534f8dca94d02757a0381883606b49b2c67323a4` |
| `ledger.cjs` | `a9d5ea5b52252897a4952bd2e48e24ab33f814490e42db74b3c040de11d7a63e` |
| `scenarios.cjs` | `0558af3fd7421b0808f2dc1e49c2e51ddf1923ee94e9a15d48d76e5fe1eb6518` |
| `verify.cjs` | `2812de7790a5fad62bfac32e1ef85ff2121b4b0200a5b02af547a57e7d113749` |
| `README.md` | `20850528dbdfb08d85d1d6029761324d1005b15e638b6a940454721ff25740d2` |
| actual resolver (unchanged) | `896631ce8e2e32ad2968663d3d97e9701bd3df41367041ab838b6a2acd1af30c` |
| actual projector (unchanged) | `1fe15dd0e88a62a04b75eab107658ea777c58598639816a6f62646627243158e` |

Implementation is frozen again for the controller's independent incremental
review. R1 is implemented and tested, but independent closure remains pending;
this report is not a self-review verdict. No project-wide tests, additional
agents, credentials, remote operations, dependencies, commit or push were used.

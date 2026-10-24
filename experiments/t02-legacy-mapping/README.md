# T02 legacy media compatibility rehearsal

Run `node experiments/t02-legacy-mapping/verify.cjs` from any directory.
`--signal-after-setup` interrupts the synthetic fixture and should exit 143.

Uses the existing Node22/PostgreSQL14/TypeScript/pg installations, a private Unix
socket and a temporary cluster. Reads only the pinned saved metadata snapshot and
local source. No credentials, remote connections, real rows, object reads or new
dependencies. The selected column types, nullability, CHECKs and unique indexes
come from that snapshot; unrelated columns, RLS, triggers and functions are not
restored. This is a data compatibility check, not an authorization or PG17 test.

The real TypeScript resolver/projector reads synthetic PostgreSQL `jsonb[]` and
`text[]` values and a separately labeled historical `jsonb` array. It preserves
source field/index/property observations and the original DB row, rejects schema
incompatibility, and keeps originals, thumbnails and derived audio separate.
`mapped` is an exact locator only: no asset ID, ready state, existence, hash or
ownership is inferred. A field-level bucket mapping is supplied explicitly for
the synthetic fixture; it is not evidence about production legacy rows.

Outputs are date-stamped JSON reports with PID, runtime/source/snapshot hashes and
cleanup results in docs/research/evidence/2026-10-17-t02-compatibility. Source values
are synthetic; a future real inventory must keep raw old signed URLs restricted
and exclude them from public logs. No migration or backfill is applied here.

Signal handling records cancellation and lets the active initialization step
finish before a single cleanup path runs, so a late temporary-directory allocation
can still be removed. Database statements and child commands have finite bounds.
Only the stable-fixture SIGTERM path is exercised by this runner's signal mode.
The pg client explicitly fixes SSL off and a nonempty inert password; inherited
PGSSLMODE/PGPASSWORD cannot change the fixture connection. A focused check can run
with `PGSSLMODE=require PGPASSWORD=synthetic-ignored` to verify that isolation.

# Storage / story RLS rehearsal

Local-only continuation of the October upgrade plan. Uses the saved 2026-10-17
remote metadata snapshot and synthetic families; never connects to Supabase or
reads credentials. Nothing in this directory is a deployable migration.

The reduced fixture preserves the columns/types and policy dependencies needed
for this experiment, but is not a complete remote restore. The runner installs
the saved predicates verbatim and executes queries as `anon` / `authenticated`,
with no superuser or BYPASSRLS privileges. JWT claim GUCs are supplied by the test
controller to stand in for the authentication gateway; that gateway is not tested.

The candidate derives permission from the current authenticated user and current
project membership, using narrow SECURITY DEFINER boolean helpers to avoid
recursive projects/project_roles RLS. Fixed empty search_path, qualified objects,
no dynamic SQL, no caller-supplied actor and restricted EXECUTE/creation privileges
are required. Restrictive gates constrain all permissive policies, including an
unexpected broad policy, so adding a stricter permissive policy is never the fix.

Storage reads use the canonical private/project/story path scope. Inserts require
the current user's prefix as well as live scope permission. Managed objects cannot
be renamed, overwritten or directly deleted: UPDATE/DELETE and upsert are denied
until formal immutable-asset/deletion adapters can coordinate those operations.
This intentionally blocks legacy direct `.remove()` and requires application
compatibility work before any production proposal. Unrelated buckets retain their
own policies. Unknown legacy keys remain unresolved rather than guessed.

Story reads require current membership; inserting/editing one's own story requires
an active storyteller role, and project/creator identity cannot change on update.
Direct deletion stays closed pending deletion orchestration. These row boundaries
do not implement consent, tombstones, versioned assets or provider deletion.

Run `node experiments/rls-rehearsal/verify.mjs`. Uses existing `initdb`/`pg_ctl`
and the T05 experiment's installed pg package. Creates its own Unix-socket-only
temporary cluster and cleans it up on success, assertion failure and signals.
The candidate requires the named rehearsal database, disabled TCP and an explicit
local marker before applying. Do not copy it into root migrations or apply remotely.

PostgreSQL 14 locally and the captured remote PostgreSQL 17 differ. Bucket config,
Storage HTTP behavior, complete remote functions/triggers, real-device recording,
backup/recovery and production authorization remain separate acceptance work.

The full captured policy dependency graph produces PostgreSQL 42P17 in this
fixture. Separate diagnostic observations disable dependency-table RLS to expose
individual broad-policy behavior; they are explicitly not end-to-end production
attack results. The candidate regression suite re-enables all fixture RLS.

Revocation is checked at the next READ COMMITTED statement. An already acquired
REPEATABLE READ snapshot retains its previous view until the transaction ends;
RLS cannot retract in-flight responses, downloaded files or signed links. The
formal service must enforce appropriate transaction lifetimes and access fences.

The fixture retains actual nullable Storage name/bucket and both owner/owner_id
forms, but does not reproduce the Storage HTTP service, remote triggers or asset
versions. Paths, not client owner metadata, supply scope; owner fields cannot
name a different actor on insert. Image interaction paths use the story ID, as
in the existing media-reference contract.

The review follow-up aligns SQL edge whitespace with the full ECMAScript trim
set while preserving ordinary interior Unicode. Shutdown now requests cancellation,
settles bounded initialization/query work and uses one final cleanup path. Run
`node experiments/rls-rehearsal/verify-shutdown.mjs` for six real local regressions:
SIGTERM/SIGINT/deadline before a real directory allocation returns to the caller,
SIGTERM after fixture setup, and exceptions after allocation/setup. The allocation
pause is an explicit IPC scheduling hook; no simulated filesystem replaces mkdtemp.
The controller separately observes child exit/directory removal and rescues only
its own child's recorded allocation if a regression fails. Rescue is never counted
as successful child cleanup. Earlier reports retain their original source hashes.
The in-process pg client also pins SSL off and an inert local password, so ambient
PGSSLMODE/PGPASSWORD or a user pgpass file cannot change this Unix-socket fixture.

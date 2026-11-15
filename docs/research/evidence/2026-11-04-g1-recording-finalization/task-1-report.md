# Task 1 report: native atomic recording finalization

Status: implemented and native verification passed. Task 1 implementation is
frozen for parent independent specification/quality review. No commit is needed.

## Files owned

- `supabase/migrations/20261104000001_recording_job_finalization.sql`
- `experiments/pg17-recording-finalization/{verify,fixture,database}.mjs`
- `experiments/pg17-recording-finalization/README.md`
- New UUID evidence directories under
  `docs/research/evidence/2026-11-04-g1-recording-finalization/`
- This task report.

No preexisting source, old experiment, or old evidence file was edited by this
task. No staging, commit, push, remote migration, deployment, paid API, worker
wiring, object deletion, or local-draft deletion was performed.

## Implemented contract

Exact eight-argument `finalize_recording_job` signature and closed flat receipt
match the supplied specification. The function is service-only, SECURITY DEFINER,
VOLATILE, fixed to `pg_catalog, pg_temp`, UTC, and `lock_timeout=3s`.

READ COMMITTED is required. The first lock is deletion_requests SHARE, before
calling the existing lease validator. The validator supplies the full pinned
manifest, active storyteller/story ownership, chunk/session/asset/job/attempt
identity, and live lease fence. Publish locks the candidate after the job, checks
prepared state, then invokes the existing exact prepare replay. Reserved rows
cannot become prepared through finalization. Fail admits only the six specified
permanent codes and rejects candidate evidence for this job on any attempt.

All four updates have unique-key predicates and FOUND checks, proving exactly
one affected row each. Complete expected before/after tuples are checked inside
the transaction after all DML; even a trigger silently suppressing or changing a
write cannot produce an incorrect success receipt. Publication also rechecks that
the candidate tuple stayed unchanged. The lease clock is sampled before writes
and again after all writes and tuple checks; expiry raises and rolls back the
entire transaction. No Storage calls or Storage metadata claims are introduced.

The asset bucket constraint adds only recording-candidates. Failure leaves the
original input pointer/metadata and successful verification fields intact/null,
sets fixed verification_error, clears job lease/result, and sets no session
confirmation fields. All receipts contain canClearLocalDrafts=false. Terminal
RPC replays and exact post-terminal seal replays fail without new rows.

## Verification and retained evidence

1. `node experiments/pg17-recording-finalization/verify.mjs --without-migration`
   produced expected SQLSTATE 42883 before implementation: 16 assertions,
   failed status and clean cleanup. Evidence:
   `red-without-migration-2026-11-04T16-05-53.358Z-40205405-370d-488b-bdf0-b8c2c7b76c2e/results.json`.
2. Intermediate failed runs are preserved truthfully:
   - `sql-only-2026-11-04T16-09-35.712Z-735bb65a-b9e3-4f97-a0d4-adbeca0cff51`: observer timestamp timezone +08 versus UTC receipt; fixture observer normalized to UTC without losing microseconds.
   - `sql-only-2026-11-04T16-11-23.813Z-a5ea7b93-667d-446e-8685-8c64e1812fb1`: test transport encoded a JSON string/array as a PostgreSQL parameter differently; fixture now explicitly serializes JSON before calling the RPC.
   - `sql-only-2026-11-04T16-13-00.119Z-8ef7b353-2c0b-4d92-a89a-30f9bdf74e79`: added trigger-tampering RED proved affected-row checks alone insufficient; full persisted tuple validation fixed it.
3. `node experiments/pg17-recording-finalization/verify.mjs` passed on
   2026-11-04 16:14:22–16:14:43 UTC: **15 scenarios / 492 assertions**.
   Final evidence:
   `sql-only-2026-11-04T16-14-22.203Z-0b981799-c094-4aab-ba08-ab5dbc0ef943/results.json`.
   Includes 166 complete tuple snapshots, 10 validated receipts, 20 observed
   native lock waits, 21 source snapshots/hashes and compressed PostgreSQL log.
   Three-second timeout measured 3004.45 ms. Sources changed during run: none.
   Cluster stopped, temporary directory/socket removed, server PID gone, zero
   remaining clients, no cleanup errors.
4. `node scripts/verify-recording-worker-compatibility.mjs` exited 0:
   Historical verifier compiler dependency graph remains executable.
5. `git diff --check` passed for tracked workspace differences. New files were
   separately checked for conflict markers/trailing whitespace by this task;
   all five source files passed. No files were staged.

Native scenarios cover exact successful four-row publication; all six permanent
failures; every invalid branch/output shape and stale worker/attempt/hash;
reserved/foreign/malformed candidate identity and time; candidate evidence on
another attempt; manifest/chunk/asset/job/attempt drift; cancellation, current
role/status/removal and story ownership; tombstones for asset/session/project/
story; raising, suppressed, and tampered writes on each of four tables for both
actions; caller rollback; expiry in each of four DMLs for both actions; expiry
while waiting at deletion table/job/candidate/asset row upgrade; deletion first
with fresh post-wait snapshots; finalizer first blocking the deletion writer;
revocation in both orders; reverse project-before-tombstone deadlock abort 40P01;
duplicate concurrent publish; isolation rejection; bounded wait despite caller
lock_timeout=0; caller timezone/timeout restoration; least-privilege ACL and
restrictive Storage policy preservation; post-terminal seal replay rejection.

## Self-review and remaining boundaries

Specification review found no unresolved ambiguity in Task 1. Routine choices:
three-second lock timeout; retain canonical asset metadata on fail while exposing
null content fields in the failure receipt; keep session confirmation bindings
null on failure. Unique-key predicates plus FOUND enforce exactly one update;
full tuple checks additionally defend against trigger suppression/tampering.
The extra tuple checks do not duplicate manifest/candidate validation: those still
use the original RPCs, preserving a single validation authority.

Quality review found and resolved the observer-timezone, JSON transport fixture,
and trigger-tampering issues above. Parent independently confirmed all 21 source/
gzip hashes, final 15/492 receipt, and preservation of prior evidence before this
report. Independent parent specification/quality review remains the next gate.

The runtime is isolated native PG17.4 on a Unix socket with synthetic identity
prerequisites and synthetic Storage tables/grants/policies. Foundation table DDL
is extracted unchanged; seal, lease, candidate, and finalization migrations are
applied intact. This is not full migration replay, real PostgREST/Storage, cloud
ownership qualification, or a full audio-worker integration run. App transport
loss verification and application/repository-wide gates belong to parent tasks.

The deletion table barrier intentionally serializes deletion writers globally
for the transaction lifetime. Legacy reverse lock orders can abort safely;
neither deadlock/timeout nor uncertain response is a success or automatic-retry
authorization. Status reconciliation, source/candidate/local cleanup, unified
deletion execution, backup qualification and resident worker wiring remain
outside this slice. G1 completion and push conditions remain false.

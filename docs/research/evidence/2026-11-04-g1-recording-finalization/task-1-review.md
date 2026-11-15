# Task 1 independent specification and code-quality review

Reviewed on 2026-11-05. Specification verdict: **PASS**. Code-quality verdict:
**APPROVED**. No actionable findings in the Task 1 change set.

## Review boundary

- Base/current HEAD supplied by the parent:
  `c0669e8058343f91deba8e468b03e4bf817b1ca5`.
- Reviewed `task-1-brief.md`, `task-1-review.patch`, the implementer's
  `task-1-report.md`, and
  `docs/superpowers/specs/2026-11-04-g1-recording-finalization-design.md`.
- Reviewed the complete new migration and all four new experiment files. Read
  the inherited lease/candidate RPCs, foundation constraints, seal behavior and
  existing deletion writer only to establish their named contract/lock effects.
  Inherited untracked work is not attributed to Task 1.
- No application finalizer adapter, access/export lineage changes, worker/browser
  wiring, status reconciliation, retry, Storage deletion, GC or backup
  qualification is assessed by this approval.

## Specification verdict: PASS

1. **RPC and branch contract.** The eight SQL arguments and flat receipt match
   the specification. The function admits only `publish` and `fail`, rejects
   cross-branch arguments, admits only the six permanent failure codes, and
   always returns `canClearLocalDrafts:false`. Publish metadata is validated by
   the existing candidate RPC's closed output schema and exact replay. Failure
   receipts contain null candidate/content fields.
2. **Live authority and prepared evidence.** Migration lines 58–85 first reuse
   the complete lease validator, then lock the candidate after the job. The
   explicit prepared-state check occurs before invoking candidate prepare, so
   reserved evidence cannot be upgraded through this RPC. The failure query
   checks every candidate for the job, across attempts; cooperating reservation
   must acquire the already-held job lock, and service callers have no direct
   candidate-write privilege. Stale worker, attempt, manifest, ownership,
   cancellation and tombstones therefore reject without terminal writes.
3. **Atomic terminal tuple.** Migration lines 87–157 use one database timestamp
   for the required fields, update the four uniquely identified rows, check
   affected rows and then compare the complete persisted tuples. Publication
   changes the canonical asset pointer and exact verified metadata while leaving
   the prepared candidate intact. Failure preserves input metadata and null
   verification/confirmation fields, records the fixed code, clears the lease
   and leaves `result_ref` null. Suppressed or tampered writes cannot yield a
   successful receipt for a mismatched terminal tuple.
4. **Clock and deletion fences.** Lines 49–56 require READ COMMITTED and acquire
   the deletion table SHARE lock before lease advisory/row locks. It conflicts
   with ordinary tombstone inserts, updates and deletes, including an absent
   tombstone becoming present. Volatile subsequent queries obtain fresh
   snapshots after the wait. Time is sampled before writes and again after all
   DML and tuple checks (lines 92–95 and 159–163); expiry raises and rolls the
   whole call back. The local three-second lock timeout is bounded and restored
   on return/failure. Existing permission/ownership row locks hold until commit.
5. **Privileges and scope.** The function is SECURITY DEFINER, explicitly
   VOLATILE, fixes `pg_catalog, pg_temp` and UTC, and grants execution only to the
   owner and service role in the tested ACL. The asset constraint adds only
   `recording-candidates`; restrictive candidate bucket policies and previous
   RPC semantics are preserved. No Storage operation or cleanup authority is
   added. Terminal lease/seal replay remains rejected.

## Code-quality verdict: APPROVED

The implementation keeps validation authority in the established lease and
candidate routines and uses a small orchestration transaction for terminal
state. The second tuple check is justified by the retained trigger-tampering RED
case; it catches partial/suppressed semantic writes that `FOUND` alone cannot
detect. There is no handler that catches and converts transaction errors into a
success response.

The test matrix uses actual independent PostgreSQL connections and observes
`pg_stat_activity`/`pg_locks` to establish blocking, rather than inferring races
from a delay alone. Complete tuple comparisons cover both actions, all four DML
failure points, trigger suppression/tampering, explicit caller rollback,
post-DML expiry, and rejection paths. Exact receipt comparisons detect missing
or additional fields. PostgreSQL timestamp comparisons preserve microseconds.

The existing deletion route inserts its tombstone before its later asset/job
updates, so the new barrier participates in that writer's actual INSERT lock.
The documented earlier target-capture limitation remains outside physical
deletion qualification. Reverse lock order can abort, as explicitly allowed by
the design and exercised by the native deadlock case; it is not a hidden success
or retry path. No conflicting update trigger on these four target tables was
found in the repository migrations.

No code-quality revision is required for this task.

## Evidence and limits

Read the retained final native report:
`docs/research/evidence/2026-11-04-g1-recording-finalization/sql-only-2026-11-04T16-14-22.203Z-0b981799-c094-4aab-ba08-ab5dbc0ef943/results.json`.
It records **15 passed scenarios / 492 assertions**, 166 complete tuple
snapshots, 10 receipts, 20 observed lock waits and 21 source snapshots. Cleanup
records cluster stopped, temporary and socket directories removed, server PID
gone, zero remaining clients and no errors. No source changed during the run.
The parent independently verified all 21 source/snapshot hashes; this review
examined the experiment implementation and retained results rather than
repeating that whole integrity sweep.

The retained report and Task 1 report also identify the expected missing-RPC
RED and intermediate failed runs honestly. The latter records the successful
old-worker compiler compatibility check. No suite or runtime experiment was
rerun by this reviewer: no concrete unresolved behavior required a narrow
reproduction, and the parent explicitly limited this review to existing native
evidence. Repository-wide and application adapter gates belong to subsequent
parent work.

PostgreSQL documentation was consulted through Context7 to confirm the
[SHARE/ROW EXCLUSIVE barrier](https://www.postgresql.org/docs/current/sql-lock.html)
and [VOLATILE per-query snapshots](https://www.postgresql.org/docs/current/xfunc-volatility.html).
Actual version-specific behavior here is supported by the retained native
PG17.4 run. Synthetic identity/Storage prerequisites and partial foundation DDL
do not establish full migration replay, real PostgREST/Storage, production
ownership, deployment readiness or G1 completion.

Only this review report was written. No source edits, staging, commits, pushes,
remote migrations, deployment or cleanup/deletion work was performed.

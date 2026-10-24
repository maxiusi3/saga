# Fix round 1 — incremental independent re-review

Original P2: **ADDRESSED.** Incremental verdict: **CHANGES REQUESTED — one new P2 in the standalone cleanup observer.** No source edits, subagents, remote actions, or reruns of passed tests were used for this review.

Scope: `fix-1.diff`, the finalized correction appendix in `task-2-report.md`, the first review, the complete changed harness/observer code, and the accepted `cleanup-verified.json`, `worker-verified.json`, `regression-fixed.json` / `regression-fixed-run.json`. This verdict is for the fix-round-1 snapshot; subsequent round-2 work requires its own review.

## Original finding: ADDRESSED

- `verify.mjs:74–106,159–168` and `merge-scenarios.mjs:92–94` register detached worker/runner/supervisor groups independently from the direct-child lifecycle. The group handle survives its Node owner's exit.
- `verify.mjs:138–156,524–542` first requests cooperative SIGTERM, then bounds forced group termination and checks retained groups even after the owner exits. EPERM is treated as present/unknown and cannot produce a false zero-residual success.
- `merge-scenarios.mjs:88–90` and `verify.mjs:109–112,545–556` also bind in-harness `processOne` work to shared cleanup cancellation and join tracked operations before database/scratch teardown. This closes the analogous direct-operation decoder gap.
- The final six cleanup cases observe actual FFmpeg after shell `exec`, check real decoder/owner/group disappearance outside the child harness, and record zero pending direct operations. Worker/runner SIGTERM cases require the forced group kill. Fatal cases retain registration after the owner is already dead and require the whole group to disappear.

The observer assertion correction is justified. POSIX can deliver SIGHUP/SIGCONT to an orphaned stopped group, so a fatal case whose whole group has already disappeared does not need an explicit SIGKILL record. Retained ownership plus actual PID/group disappearance is the relevant condition. The still-stopped-owner SIGTERM cases continue to prove the forced cleanup path.

## New actionable finding

### [P2] Preserve resource ownership before the observer times out or rejects a harness exit

**Location:** `experiments/t05-durable-worker/verify-merge-cleanup.mjs:35–42` and `:62–69`.

The observer learns the decoder/worker ownership only after the harness has exited with exactly the expected code. If the 25-second deadline expires at line 38, or the harness exits unexpectedly at line 40, control reaches `finally` with `fixture` still undefined. Consequently the decoder, owner, and separate worker/runner group rescue branches are skipped. On timeout, line 68 immediately SIGKILLs the harness process group instead of requesting its cooperative cleanup. The new worker/runner groups are detached from that group; the PostgreSQL daemon also relies on the harness's explicit shutdown. They can remain alive while the observer moves on to another scenario. Even an existing raw fixture report is not read in the unexpected-exit branch. Line 69 then awaits `done` without any bound if termination is not confirmed.

This is a static, concrete failure path introduced by the new observer. The six accepted cases all exit normally with their injected expected 1/143 status and therefore do not cover it. The fix should preserve the first finding's ownership guarantees when the observer itself encounters a timeout or unexpected child exit; directly forcing the harness into its documented SIGKILL limitation is not sufficient cleanup.

**Requested correction:** Capture trusted per-run resource ownership while the harness is alive, before fault injection or before any exit-status assertion, and retain it independently of final evidence. On timeout/interruption first request cooperative stop and wait for a bounded outcome; if that fails or the harness has already exited, clean/check only the exact registered descendant groups, decoder, and owned cluster/scratch through bounded fallback. Bound the final child wait and report unresolved resources explicitly. Add targeted external-observer timeout and unexpected-harness-exit cases during actual decoding, proving both owned-resource disappearance and finite observer completion. Do not rely on stale evidence files or broad process-name searches for rescue.

## Incremental specification and quality assessment

The original lifecycle requirement is now satisfied for normal harness cleanup, fatal injection and SIGTERM. No new merge/publication, frozen-input, queue/lease fencing, or permission-readback problem was found; the adapter/store/Worker/runner implementation and T04 helpers are unchanged by this correction.

The only incremental specification/quality issue is the observer's own failure cleanup above. It can orphan resources precisely when its test detects an abnormal harness lifecycle. The rest of the correction remains focused: ownership is explicit, force-kill fallback is bounded and checked, direct operations cooperate with abort, and successful runs retain the prior behavior.

## Evidence and provenance

- `cleanup-verified.json`: **6/6 passed**, all observer source hashes match. All six raw fixture source hashes also match; every actual decoder PID is gone after harness exit, no observer rescue was needed, residual groups are empty, and tracked direct operations are zero. Child exit 1/143 is the intended injected fault outcome, not observer failure.
- `worker-verified.json`: **52 scenarios / 396 assertions, passed**, all recorded hashes match; zero residual children/groups/operations, cluster stopped, scratch removed, and no cleanup errors.
- `regression-fixed.json` / `regression-fixed-run.json`: **39 scenarios / 307 assertions, exit 0**, clean teardown. The sole fingerprint difference is `verify-merge-cleanup.mjs`, whose fatal-case assertion was corrected after this regression started. The default regression hashes but does not import or execute that standalone observer. All code actually executed by the original regression matches, and the final observer is independently covered by the later six-case run. This is acceptable provenance when disclosed; it is not an exact-all-files hash match.

The passed evidence establishes the implemented group and direct-operation fix. It does not establish timeout/unexpected-exit rescue by the external observer. Original P2 **ADDRESSED**; new fix-specific P2 **OPEN**. Re-review the next scoped correction before declaring the batch clean.

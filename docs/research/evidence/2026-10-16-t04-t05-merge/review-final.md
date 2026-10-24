# Fix round 2 — final incremental independent review

Observer P2: **ADDRESSED.** Final incremental verdict: **PASS — no new actionable specification or code-quality findings.** The earlier decoder-descendant P2 remains addressed. Both findings from this batch's reviews are closed.

Reviewed `fix-2.diff`, `task-2-round2-report.md`, the preceding `batch-rereview.md`, all changed observer/harness/fixture code and README text, and the final evidence listed below. Reconstructed the diff from `review-2-before/` and confirmed it exactly matches the supplied fix diff and current files. No source edits, subagents, remote actions, or repeated test runs were performed.

## Observer P2: ADDRESSED

The former failure path no longer depends on an expected exit code or a completed raw evidence file:

- The harness sends ownership through its exact parent IPC channel before database startup, before a cluster may have started, after its postmaster is known, and when groups/decoder/fixture identities become available. The observer validates the child PID, private scratch-path form, stable directory identity and process IDs, and retains the union of owned groups and decoders.
- `verify-merge-cleanup.mjs:45–68,164–220` captures this ownership while the harness is alive. Raw evidence is attempted before exit assertions and remains diagnostic only. Timeout, unexpected exit, assertion failure and interruption all converge on the same idempotent cleanup.
- `verify-merge-cleanup.mjs:71–116` requests cooperative TERM, bounds the wait, and inspects descendants of the stopped owned harness when fallback is necessary. Retained group handles survive an already-exited owner. Group/decoder fallback keeps consuming ownership messages until harness exit and IPC closure, then checks actual residual groups/PIDs. No unbounded `await done` remains.
- `verify-merge-cleanup.mjs:118–158` verifies the exact private scratch/data path, uses bounded `pg_ctl status/stop/status`, and checks the known postmaster PID. It removes scratch only after cluster shutdown, complete ownership and absence of descendants are established. Unknown/live resources or protocol errors retain data and fail cleanup. IPC/stdio handles are released on failed termination so they cannot indefinitely hold the observer open.
- Signal, disconnect and unexpected-error handling preserve cleanup and the final report. Per-run cleanup is idempotent; process polling, command execution and evidence/file operations have explicit deadlines. The existing limits on uninterruptible kernel calls and a SIGKILL of the top-level observer remain appropriately outside the claim.

The correction stays within the requested lifecycle scope. It does not alter the durable store, local recording adapter, Worker/runner implementation, supervisor, T04 helpers, dependencies or production behavior.

## Final evidence checked

All source fingerprints in the following final reports match current files. The six embedded/raw ordinary cleanup reports also match current source. The final original regression now has no fingerprint exception.

| Evidence | Result and relevant observation |
| --- | --- |
| `worker-round2-verified.json` | **52 scenarios / 396 assertions, passed**; zero owned children, cluster stopped, scratch removed, no cleanup errors. |
| `cleanup-round2-verified.json` | **6/6 passed** for Worker/runner/direct × fatal/SIGTERM; real decoder absent after harness cleanup, owned groups absent, direct operations joined, independent observer cleanup clean. |
| `observer-round2-verified.json` | **2/2 passed** for the observer timeout and unexpected harness exit; both begin with actual live FFmpeg and PostgreSQL, have no raw harness report, and use early ownership plus independent fallback PostgreSQL stop. |
| `observer-round2-verified-interrupt.json` | Actual observer **SIGTERM** scenario passed; run records interrupted status/SIGTERM and the expected 143 exit is recorded in the implementation report. The stopped direct decoder/harness and live private cluster are cleaned through fallback. |
| `regression-final.json` / `regression-final-run.json` | **39 scenarios / 307 assertions, exit 0**; all source hashes match, zero children, cluster stopped, scratch removed, no cleanup errors. |

The three new observer fault cases explicitly record closed ownership IPC, empty residual groups/decoders, `clusterStopped: true`, `tempDirectoryRemoved: true`, `usedFallbackPgStop: true`, and no cleanup errors. Their cleanup times are 7,333 ms (timeout), 1,267 ms (unexpected exit) and 7,332 ms (observer SIGTERM). These are actual process/database observations, not a successful child harness's self-reported cleanup.

The timeout fixture deliberately shortens the observer deadline after ownership is received; the stopped harness forces the same bounded fallback used by an ordinary observer timeout. The unexpected-exit fixture leaves code 17 and no raw evidence. Actual FFmpeg is confirmed after shell `exec`; `-re` and process stops are clearly identified as lifecycle fault controls, not CPU-load or device-recording evidence.

## Final scope

Incremental specification findings: **0**. Incremental code-quality findings: **0**. Original decoder ownership P2: **ADDRESSED**. Observer timeout/unexpected-exit ownership P2: **ADDRESSED**.

This clears the local batch review. It does not change the documented G0/G1, production authorization/Storage, runtime qualification, real-device, migration, deployment or release-milestone boundaries.

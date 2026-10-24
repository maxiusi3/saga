# Independent T04/T05 batch review

Verdict: **CHANGES REQUESTED — one P2 lifecycle/cleanup finding.** No source edits, commits, remote actions, or subagents were used. The successful merge/publication path has no other actionable finding from this review.

Reviewed the exact `before/` baseline and `batch-review.diff`, Task 2/3 briefs, Task 1/2 reports and Task 1 review, `CLAUDE.md`, the T04/T05 sections of the P1 contracts, all changed implementation modules/tests, the unchanged supervisor ownership/cleanup paths, and the final evidence and research narrative.

## Actionable finding

### [P2] Own decoder descendants when the merge harness terminates a worker or runner

**Location:** `experiments/t05-durable-worker/merge-scenarios.mjs:89–91`; corresponding force-kill path at `experiments/t05-durable-worker/verify.mjs:104–113` and descendant accounting at `verify.mjs:492–509`.

The new merge harness forks a runner as an ordinary direct child and only calls `trackChild`. The existing single-shot worker also now starts a real FFmpeg child. Neither is registered as an owned process group. On a harness assertion failure, timeout, SIGINT/SIGTERM or unexpected exception, `terminateChild` sends these ungrouped Node processes SIGKILL immediately. Their AbortController handlers cannot run, so they cannot kill/join their FFmpeg children. `cleanupGroups` only checks the separately registered supervisor groups and supervisor-reported runner PIDs; `children.size` becomes zero when the Node owner exits. A decoder that remains alive can therefore be omitted from successful cleanup evidence while scratch/database teardown proceeds.

This is a new consequence of introducing real decoder descendants into the previously direct-child fixtures. Normal `owned.stop()` covers cooperative runner shutdown, but does not exercise the harness's exceptional teardown path.

A targeted local lifecycle probe used the current TypeScript decoder compiled to CommonJS, the same real FFmpeg 7.1 executable and `-re` wrapper, and generated sine audio. After observing the actual FFmpeg executable (not merely the shell wrapper), the probe sent it SIGSTOP and force-killed its Node owner, matching the ungrouped teardown choice. The Node owner exited `-9`; FFmpeg PID `44655` remained present with PPID `1` and state `T`. The reviewer then killed that owned decoder and removed all probe files. The stopped-process injection makes the missing ownership explicit instead of relying on FFmpeg eventually noticing a closed pipe. This was a narrow lifecycle probe, not a rerun or replacement of the passed harness evidence.

**Requested fix:** Give every worker/runner that can spawn a decoder an independently tracked process group or equivalent descendant ownership. Attempt cooperative shutdown, then enforce and verify bounded group/descendant termination even when the Node owner has already exited. Add a targeted fault regression during actual decoding that forces harness cleanup, confirms the decoder PID/group is gone, and prevents a zero-residual cleanup report while it remains alive.

## Spec assessment

The finding above leaves Task 3's owned-process cleanup boundary incomplete. Otherwise the reviewed implementation meets the authorized local PoC scope:

- Frozen canonical input binds job/project/session/asset/version/processor/parameter identities, and the database unique index rejects the same canonical input under another job ID. Queue creation is atomic with business creation and contains only the job ID.
- Claim, dispatch, heartbeat and final publication validate frozen identity and the exact business attempt/queue ID/retry count. The final locked clock check fences late lease expiry; real merges cannot enter synthetic provider, approval or reconciliation paths.
- Read/copy/decode happens outside transactions, with private regular-file validation, internal filenames, quotas and abort/deadline cooperation. Output is exclusive and unique, file/directory synced, and read back before guarded atomic reference/state/queue publication.
- Fully prepared files are retained after uncertain COMMIT or process death. The checked read entry requires the committed reference, checks current permission/cancel/deletion/input both before and after I/O, and verifies disk size/hash. Private orphan files are not published or automatically reused.
- Optional helper cancellation is backward compatible; decoder rejection waits for child close. Continuous runner heartbeats cover actual I/O/decode and are stopped/joined before publication.

## Quality and evidence assessment

Apart from the descendant ownership finding, no actionable code-quality issue was found. Existing repository conventions and synthetic behavior are retained; the local adapter is separate from durable state transitions, and comments accurately describe cross-filesystem/database limits.

Evidence inspected without rerunning passed suites:

- `worker-final.json`: **52 scenarios / 396 assertions, passed**; all recorded source fingerprints match the reviewed source.
- `regression.json` and `regression-run.json`: **39 scenarios / 307 assertions, exit 0**; all source fingerprints match. The run includes existing supervision/forced-shutdown cases, but not exceptional harness teardown while a newly introduced decoder descendant is alive.
- Both recorded runs report zero owned direct children, cluster stopped, scratch removed and no cleanup errors. These observations are valid for those successful runs; they do not establish the missing failure-path descendant guarantee.
- `project-verify.json` / `project-checks.json`: exit 0, **75 suites / 716 tests**, type/lint/build with **175 pages**, `next-env.d.ts` restored; shared **4 suites / 16 tests**, infra **7 tests**. The optional helper changes also have prior independent review and focused 55/55 evidence.

The narrative correctly distinguishes generated contiguous file slices from physical-device MediaRecorder evidence, read checkpoints from decoder CPU work, actual FFmpeg input throttling from load qualification, and client COMMIT wrappers from a network partition. Local permission flags do not claim RLS. G0/G1, production adapters, remote migrations/deployment and release/push milestones remain explicitly unfulfilled.

Spec findings: **1 cleanup gap**. Quality findings: **the same P2 ownership defect**, no additional findings. Re-review the correction and its focused evidence before clearing this batch.

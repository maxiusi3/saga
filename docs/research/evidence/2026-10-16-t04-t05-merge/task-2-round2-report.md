# Round-2 observer lifecycle correction

Status: corrected and locally verified. Current-source results are **52 merge scenarios / 396 assertions**, **6 existing decoder-cleanup scenarios**, **2 observer-failure cleanup scenarios**, and **1 actual observer SIGTERM scenario**. All assertions passed; the SIGTERM command preserves the expected exit code 143. Independent scoped re-review and the original T05 regression remain controller-owned.

## Finding and scope

The reviewer accepted the round-1 detached Worker/runner groups and direct-operation abort/join, but found a separate defect in the new outer observer. Its timeout or unexpected-exit assertion ran before raw evidence was read, so `fixture` could remain undefined. The old `finally` could then kill only the harness's process group, miss separately detached Worker/runner groups and PostgreSQL, and await the harness's `done` promise without a deadline.

This correction changes only:

- `experiments/t05-durable-worker/verify.mjs`
- `experiments/t05-durable-worker/merge-scenarios.mjs`
- `experiments/t05-durable-worker/verify-merge-cleanup.mjs`

Application helpers, local adapter, durable store, Worker/runner implementation, supervisor and dependencies are unchanged. README updates were made by the controller. No commits, remote calls or production resources were involved. Every prior evidence file was preserved.

## Ownership and bounded cleanup

The child harness now sends early `harness_ownership` snapshots through its exact parent IPC channel. A snapshot identifies the harness PID, the newly allocated private scratch directory, whether cluster startup may have begun, current confirmed cluster-stop state, postmaster PID when known, detached group IDs, and actual decoder PID/fixture when known. Scratch ownership is sent before database startup; the “may have started” state is sent before `pg_ctl start`. Group and decoder ownership is reported as soon as known. The final raw evidence remains useful but is no longer the ownership source for failure cleanup.

The observer validates that snapshots belong to the child it forked, use one exact `/tmp/saga-t05-*` path, and contain valid process IDs. It retains a union of groups/decoders across snapshots. A timeout, unexpected exit, interruption or assertion failure enters one idempotent cleanup operation:

1. Send the owned harness SIGTERM and wait at most six seconds for cooperative cleanup.
2. If still alive, stop its group and inspect only its descendant tree to close the fork-to-IPC registration window. Retain the known detached groups even if the harness already exited.
3. Send TERM to the owned groups, allow one bounded grace interval, then KILL remaining owned groups/recorded decoders. Continue consuming late ownership messages until the harness IPC channel closes. Require confirmed harness exit, closed ownership IPC and no remaining groups/decoders.
4. Validate the exact private owned scratch/data directories. Use bounded `pg_ctl status` and, when necessary, `pg_ctl -D <owned scratch>/data -m immediate -w -t 10 stop`. Verify stopped status and the known postmaster PID's absence. No connection-string or environment database fallback exists.
5. Remove scratch only after cluster shutdown and process ownership are proven. Unknown/live cluster status, protocol errors or incomplete process cleanup retain the existing data and fail the report. Release child IPC/stdio handles even when termination is unconfirmed so the observer does not hang on them.

Process exit waits, group waits, IPC waits, commands and observer evidence/file operations have explicit bounds. There is no unbounded `await done`. Raw evidence is attempted even for an unexpected exit; missing raw evidence is recorded, while retained IPC ownership drives cleanup. Cleanup results and initial fault observations are written to the observer report even when the scenario fails.

The harness also treats observer disconnect as a cleanup request. As with all user-space teardown, a SIGKILL of the top-level observer itself cannot execute its handlers; this remains outside the automatic cleanup promise. Same-user hostile filesystem replacement and uninterruptible kernel filesystem operations remain the local PoC limitations already documented.

## Focused fault fixtures

All new faults begin after the existing compiled T04 helper has spawned the real FFmpeg 7.1 executable and `ps` confirms its command. Generated 6.4-second sine WebM plus the existing shell `exec ... -re` wrapper provides actual live decoding. Decoder and relevant owner are stopped before injecting observer failures; pauses and input throttling are labeled, not described as decoder CPU work.

- **Observer timeout:** a stopped runner, decoder and harness force the observer's own deadline and fallback path. The raw harness evidence file does not exist. Early IPC identifies the detached runner group and running postmaster; observer cleanup kills owned groups and independently stops PostgreSQL.
- **Unexpected harness exit:** the harness exits with code 17 before its normal cleanup/evidence path while its stopped Worker/decoder and private cluster are owned. The observer still reads its early ownership snapshot, cleans the detached group and independently stops PostgreSQL.
- **Actual observer SIGTERM:** the observer receives SIGTERM while the harness directly owns a stopped decoder and is itself stopped. It performs bounded fallback cleanup of its exact harness group and private cluster, writes a passed scenario with interrupted run status, and exits 143.

The original six Worker/runner/direct × fatal/SIGTERM cleanup cases were rerun unchanged in meaning, and the complete 52-scenario merge suite was rerun against the final source fingerprints.

## Evidence and commands

All evidence is in `docs/research/evidence/2026-10-16-t04-t05-merge/`.

| Current-source evidence | Result |
| --- | --- |
| `observer-round2-verified.json` | 2/2 passed, exit 0: timeout and unexpected-exit fallback cleanup. |
| `observer-round2-verified-interrupt.json` | Scenario passed; run interrupted with expected exit 143 after actual SIGTERM. |
| `cleanup-round2-verified.json` plus six raw child reports | 6/6 passed, exit 0. |
| `worker-round2-verified.json` | 52 scenarios / 396 assertions passed, exit 0. |

Earlier green trials are also retained: `observer-faults-first.json`, `observer-interrupt-first.json`, `cleanup-round2-first.json` and their available raw child reports. The intentionally killed/stopped observer-fault child harnesses cannot write their raw report; the observer records `rawEvidenceError: ENOENT`, the early IPC ownership, and independent cleanup proof instead.

```sh
SAGA_FFMPEG_PATH=/Users/eat/.codex/handoffs/videocut/2026-10-06-video-upgrade/evidence/runtime/ffmpeg-macos-x86_64-v7.1 node experiments/t05-durable-worker/verify-merge-cleanup.mjs --observer-faults docs/research/evidence/2026-10-16-t04-t05-merge/observer-round2-verified.json
SAGA_FFMPEG_PATH=/Users/eat/.codex/handoffs/videocut/2026-10-06-video-upgrade/evidence/runtime/ffmpeg-macos-x86_64-v7.1 node experiments/t05-durable-worker/verify-merge-cleanup.mjs --observer-interrupt docs/research/evidence/2026-10-16-t04-t05-merge/observer-round2-verified-interrupt.json
SAGA_FFMPEG_PATH=/Users/eat/.codex/handoffs/videocut/2026-10-06-video-upgrade/evidence/runtime/ffmpeg-macos-x86_64-v7.1 node experiments/t05-durable-worker/verify-merge-cleanup.mjs docs/research/evidence/2026-10-16-t04-t05-merge/cleanup-round2-verified.json
SAGA_FFMPEG_PATH=/Users/eat/.codex/handoffs/videocut/2026-10-06-video-upgrade/evidence/runtime/ffmpeg-macos-x86_64-v7.1 node experiments/t05-durable-worker/verify.mjs --only-merge docs/research/evidence/2026-10-16-t04-t05-merge/worker-round2-verified.json
```

For another run use new filenames; these paths are historical evidence now. `node --check` also passed for all three correction modules.

Verified fault resource outcomes:

| Fault | Decoder PID | Postmaster PID | Fallback cleanup time | Final result |
| --- | --- | --- | --- | --- |
| Runner observer timeout | 50817 | 50746 | 7333 ms | IPC closed; groups/decoder absent; independent `pg_ctl stop` used; scratch removed. |
| Worker unexpected harness exit | 51353 | 51320 | 1267 ms | IPC closed; groups/decoder absent; independent `pg_ctl stop` used; scratch removed. |
| Direct decoder observer SIGTERM | 50809 | 50759 | 7332 ms | IPC closed; harness group/decoder absent; independent `pg_ctl stop` used; scratch removed; observer exit 143. |

All three report the private cluster actually alive before fallback, `usedFallbackPgStop: true`, `ownershipComplete: true`, empty residual groups/decoders, stopped cluster, removed scratch, and zero cleanup errors. No normal raw harness “clean” result is needed for these assertions.

The final full merge run was 2026-10-16 05:19:39.220–05:20:40.125 UTC and recorded zero owned children, cluster stopped, scratch removed and no cleanup errors. The current-source cleanup observer runs began at 05:19:38 UTC and completed by 05:20:11.756 UTC.

Selected final SHA256 fingerprints from `worker-round2-verified.json`:

- README: `537d552f68ebce901d30bdd859f96cd675c57d154ba6034bed312bc81acd84fa`
- verify: `8d89c9601f001ce63798f9a6a0d78b03e591233236e5927b8940ac7206f6225b`
- merge scenarios: `e555de35fb4b262b86f1b219563e2ef9124d8c15a00f6a658527308863217509`
- cleanup observer: `c1e7b997ea4ecd0ecb8bb6cd453662417b52a03265e0db5eb9880cc6e0cebca5`

The local recording adapter, store, Worker/runner and application helper hashes remain unchanged from the previous implementation. No unresolved round-2 test failures remain. Controller owns final original T05 regression and scoped independent review before clearing the batch.

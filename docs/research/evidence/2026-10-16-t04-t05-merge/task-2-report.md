# Task 2 + coupled Task 3 implementation report

Status: implementation complete; round-1 descendant ownership and round-2 observer lifecycle findings corrected. Latest local real-file harness **52 scenarios / 396 assertions**, **6/6 original decoder-cleanup scenarios**, **2/2 observer-failure scenarios**, and **1 actual observer SIGTERM scenario** all pass (the signal command intentionally exits 143). Current evidence/fingerprints and the round-2 correction are in `task-2-round2-report.md`; earlier sections/evidence below remain historical. Independent re-review and original T05 regression belong to the controller. No application helpers, dependencies, README, main documentation, commits, remote services or production resources were modified by this worker.

## Files changed

- `experiments/t05-durable-worker/store.mjs`: explicit recording-adapter configuration, frozen enqueue, canonical idempotency uniqueness, claim/input binding, guarded publication, checked published read, and explicit rejection of synthetic review/reconciliation for real merges.
- `experiments/t05-durable-worker/local-recording-merge.mjs` (new): private local source reader, existing T04 helper/FFmpeg execution, unique output copy/sync/readback, bounded checked output read.
- `experiments/t05-durable-worker/runner.mjs`: automatic heartbeat remains active through real read/decode/copy/readback, stops and joins at `before_publication`; abort reaches adapter/decoder. Explicit test-only `mergePauseStage`/`mergePauseMs` checkpoints preserve synthetic duration behavior.
- `experiments/t05-durable-worker/worker.mjs`: signal/disconnect AbortController and cancellation-aware checkpoints; empty logical-clock argument is normalized for targeted real-file jobs.
- `experiments/t05-durable-worker/verify.mjs`: `--only-merge`, merge-only explicit configuration/compilation, new fingerprints, worker failure observations, proper empty clock positional argument, and timestamp/PID default output path so later default runs cannot overwrite historical batch evidence.
- `experiments/t05-durable-worker/merge-scenarios.mjs` (new): generated sine WebM/MP4/Ogg fixtures, real filesystem/PostgreSQL/FFmpeg/child-worker/continuous-runner coverage.

## Interfaces and invariants

`openPoc(config)` accepts optional `config.recording` with `root`, `helpersDirectory`, `executable`, `maxInputBytes`, `maxChunks`, `ioTimeoutMs`, `decodeTimeoutMs`, and `maxDurationMs`. Root/helper paths must exactly match the private `/tmp/saga-t05-*/recording` and `/tmp/saga-t05-*/helpers` directories. The adapter checks owned private directories and an explicit executable regular local file. Merge mode requires absolute `SAGA_FFMPEG_PATH`; the binary is not copied. Four actual TS modules are transpiled to a private CommonJS subdirectory and required by ESM, preserving existing extensionless helper imports without copying algorithm logic.

`enqueueRecordingMerge(context, id, task, options)` takes the complete `buildRecordingMergeTaskInput` result. It rebuilds and deeply compares the canonical input (including MIME, chunks, totals and idempotency key), rejects extra input/chunk fields, and freezes `{ jobId, task, digest }`. The digest includes the full task plus job ID. A separate partial unique index on the canonical task idempotency key prevents a second job ID from scheduling the same merge. Repeating the identical ID/task returns null; a different input for that ID or a second ID for the same input rejects with no new business/queue row. Queue data is exactly `{ jobId }`.

PoC-only schema additions are `poc_jobs.frozen_input`, `poc_attempts.input_digest`, `poc_artifacts.metadata`, and the partial canonical-idempotency index. These are isolated harness tables, not production migrations. A real job snapshot binds ID/project/session/asset/inputVersion/jobType/processorVersion/parameterVersion/modelConfigVersion (`none`)/idempotencyKey. Every recording claim/dispatch/final guard validates input against its stored and captured digest. Heartbeats validate the persisted attempt digest; final guards also validate attempt owner/queue ID/retry count/digest. A recording input missing configuration or binding cannot fall through to the synthetic provider ledger.

Source filenames are internal hashes of the versioned canonical task and full chunk identity. Task strings never form filesystem paths. Reads use `O_NOFOLLOW | O_NONBLOCK`, require an owned private single-link regular file, check exact declared size, and stream at 64 KiB with byte/timeout/AbortSignal bounds. FIFOs and symlinks fail closed. T04 rechecks each actual chunk hash and byte count and decodes using the existing FFmpeg helper. Reading, merging, decoding, copying, syncing and disk verification occur outside database transactions.

Output references have `local-recording:<UUID>` shape and derive a flat private filename. The adapter creates each output with `O_CREAT | O_EXCL | O_NOFOLLOW`, mode 0600, syncs the file and directory, then rereads size/hash. The store performs another readback after the injectable preparation checkpoint. The runner stops and joins heartbeat at `before_publication`; only then does a new transaction validate permission/cancel/deletion/frozen input/lease/attempt/queue claim and atomically insert the published reference + complete business/attempt state + acknowledge the exact queue attempt. The final locked wall-clock/lease/queue deadline check and AbortSignal check occur before COMMIT.

`readPublishedRecording(context, jobId, { signal? })` is the intended caller read entry. It requires an allowed, noncancelled, nondeleted succeeded job with a published matching reference, validates current input identity and metadata, rereads bounded disk bytes/hash, then repeats current authorization/reference/input checks after I/O. It returns bounded bytes and verified metadata. No output is served by a public path or exposed just because a private file exists.

Fully prepared outputs are retained after handoff to the store even when a later guard fails, the process dies, or COMMIT's outcome is unknown. A successfully committed reference therefore cannot be broken by erroneous cleanup after a lost COMMIT reply. Unreferenced prepared files stay private; no GC or result reuse is implemented. `approveJob` and every `reconcileUnknownJob` decision explicitly reject real recording jobs. Real running lease loss retains the existing conservative `outcome_unknown` behavior. Real merges create zero synthetic provider calls.

## Verification and evidence

All evidence paths are under `docs/research/evidence/2026-10-16-t04-t05-merge/` and were created separately, without overwriting old batch evidence.

| Run | Result | Purpose |
| --- | --- | --- |
| `worker-red.json` | exit 1, missing `enqueueRecordingMerge` assertion | Initial test-first API red against the unimplemented integration; isolated cluster cleanup succeeded. |
| `worker-intermediate-1.json` | exit 0, 12 scenarios / 127 assertions | First real end-to-end formats/ordering/duplicate/path/source/limit/decode green. |
| `worker-intermediate-2.json` | exit 1 after 36 scenarios / 281 assertions | Additional cases passed; crash fixture used unsupported pg-boss `heartbeatSeconds: 3`. Corrected fixture to required minimum 10, retaining a 5-second hard expiry. |
| `worker-intermediate-3.json` | exit 0, 50 scenarios / 381 assertions | Full crash/unknown-commit/abort/runner/decode coverage. |
| `worker-final.json` | **exit 0, 52 scenarios / 396 assertions** | Added persisted business-attempt binding mutation and lease expiry during final real publication transaction. Current module/helper/README hashes captured. |

Final command (run from repository root):

```sh
SAGA_FFMPEG_PATH=/Users/eat/.codex/handoffs/videocut/2026-10-06-video-upgrade/evidence/runtime/ffmpeg-macos-x86_64-v7.1 node experiments/t05-durable-worker/verify.mjs --only-merge docs/research/evidence/2026-10-16-t04-t05-merge/worker-final.json
```

For future runs use a **new explicit evidence filename**, or omit the path to get a timestamp/PID filename. Intermediate evidence predating the environment-variable change recorded the same binary through the earlier explicit test constant; final evidence uses the env-based entry.

`node --check` passed for all six changed/new experiment modules. Full application gates were reported complete by the controller (75 suites/716 tests + 175 pages, shared 4 suites/16 tests, infra 7 tests) and were not rerun or claimed as this worker's work. No project builds or `next-env.d.ts` edits were performed here.

Coverage in the final 52 scenarios includes:

- Real WebM (12 chunks, numeric ordering), MP4 and Ogg merge/decode, unchanged source hashes, output bytes/hash/size/duration, one reference and completed queue envelope.
- Enqueue rollback, identical duplicate, canonical input under another ID, changed task identity, malformed manifest/totals, injected task/chunk paths, byte/chunk quotas, absent adapter and symlinked private root.
- Real missing/bad-hash/wrong-size/symlink/FIFO/invalid-audio sources; cleanup and no output publication.
- Concurrent duplicate envelopes and terminal redelivery with no extra work or synthetic provider call.
- Changes to each of ten snapshot identity fields after prepare, including job ID, plus missing/corrupt/coherently replaced frozen input; heartbeat and final-publication rejection.
- Explicit real-merge rejection by review, approval and all three reconciliation choices.
- Cancel, deletion and permission revoke after prepare; private orphan stays unreadable through the published entry.
- Prepared output same-size corruption, missing file and symlink before final readback. Published read denies permission/cancel/deletion/input/metadata mutations, file corruption/missing/symlink, and revocation injected after actual disk read but before the final authorization recheck.
- Lease, queue retry count, queue job identity and persisted business-attempt digest loss after prepare; old queue claims remain unacknowledged. Actual 5.2-second pause inside final publication causes transaction rollback and quarantine.
- Actual child SIGKILL at `merge_prepared` and `before_commit`, followed by real PostgreSQL expiry/supervision and unknown-result recovery; no referenced or automatically reused orphan. Old paused pre-dispatch Worker cannot overwrite a replacement result.
- COMMIT response wrappers cover both actual database commit and no commit; the committed case remains readable, the rollback case has no reference, and neither deletes the prepared file.
- Abort immediately before final COMMIT; actual source stream iteration cancellation and I/O timeout with cleanup.
- Continuous runner heartbeats through a explicitly labeled 6.2-second reader checkpoint pause; runner SIGTERM/revoke/deletion interrupts an open source stream and cleans temporary merged files.
- Real FFmpeg executed through a shell `exec` wrapper adding `-re` for input-clock throttling on 6.4-second generated audio. Automatic heartbeats continue across the real decoder process; runner shutdown kills and joins that process, verified using the actual child PID. This is throttled decoding, not a claim of costly decoder CPU work.

Final run: 2026-10-16 04:24:40.498–04:25:39.884 UTC. Node v22.22.2; PostgreSQL 14.17; pg-boss 12.37.1; pg 8.16.3; FFmpeg 7.1. Final cleanup recorded zero remaining owned children, cluster stopped, scratch removed, and no cleanup errors.

Selected final SHA256 fingerprints (all are also in `worker-final.json`):

- README: `4f77ef29cda6cfebd2ecef7384de031feb2a481d4cd897bd671e9dcfc2ad77e4`
- store: `ccd2b47f5f834517e461f5d429872065e0874a3fd67d8730c68d478f80ea859b`
- local adapter: `a6bf18704d0472eaff1ebb72f42a32be46a34ad2b0093aeab9ea97cf94d7d358`
- merge scenarios: `4c6d5832040ffb02a7a2ad9209ff3e1e31f0f4fd2cf9884a7ceb3d2e55872af6`
- FFmpeg executable: `4a4a968b98859588e98500ae25973d80a5ca5eed0724222b9f76360dcb72a001`

## Limits and remaining work

This is a local PoC authorization flag, not actual RLS or a production Storage/signed-URL boundary. Current same-user private-directory ownership is trusted; hostile same-user directory replacement races and kernel filesystem operations that cannot be preempted remain outside scope. Regular-file streams cooperate with abort and deadlines; this does not claim interruption of arbitrary uncooperative injected promises.

The output filesystem and PostgreSQL are not one atomic system. Tests intentionally retain and inspect private orphan files before harness teardown. Production GC, retention, reconciliation/manual reuse, retry classification and media-worker sandboxing remain unimplemented. In particular, known local source/decode errors conservatively leave running state for existing lease recovery into `outcome_unknown`; no new automatic retry/reuse policy was invented.

COMMIT uncertainty evidence uses client-query fault wrappers around real PostgreSQL transactions, not a network partition. Read-pause duration evidence is a checkpoint wrapper; long decoder-lifetime evidence is actual FFmpeg with input throttling. Generated chunk slices are not physical-browser MediaRecorder or device acquisition evidence. Existing G0/G1 production/operational/device gates remain separate; this batch does not establish a release milestone.

Controller still owns final independent review, full original T05 regressions, main documentation and milestone evaluation. No unresolved integration test failures remain at handoff.

## Round-1 P2 correction: decoder descendant ownership

Independent review (`batch-review.md`) identified one real cleanup defect in the new harness integration: direct Worker/runner children could start FFmpeg without an owned process group. Exceptional harness cleanup immediately killed the Node owner, so an active/stopped FFmpeg descendant could remain while the old direct-child/cluster cleanup report appeared successful. Normal runner-stop evidence did not cover this failure path.

The confirmed RED observer is `cleanup-red-confirmed.json` with four raw child reports bearing the same prefix. All four Worker/runner × fatal/SIGTERM combinations observed a real FFmpeg PID alive after the old harness exited and reported cleanup complete. The observer then killed only the recorded owned orphan; all four `decoderAliveAfterRescue` values are false. The stopped decoders were PIDs 45318, 45429, 45539 and 45651. Earlier `cleanup-red-*` raw records are also retained: that initial observer attempt recorded three reproductions before a transient macOS `kill(-group, 0)` EPERM during rescue accounting. Those owned PIDs were checked gone; the complete confirmed RED is the authoritative reproduction.

Changes for the correction are confined to three harness modules:

- `verify.mjs` now launches every direct Worker and supervisor detached and registers its process-group identity immediately (including at `spawn`). Groups remain registered after the owner exit event removes the Node process from the direct-child set. All direct children first receive SIGTERM; after four seconds the harness can SIGKILL their entire owned group. A separate retained-group pass also checks/removes descendants after an owner has already exited, with bounded TERM/KILL waits. An EPERM existence check means “still present/unknown,” never “gone”; groups still present after bounded cleanup fail the report. Evidence separately records supervisor/worker/runner IDs, owned group IDs, forced group kills and residual groups.
- `merge-scenarios.mjs` now launches direct runners detached and registers their groups. Calls to `processOne` executed inside the harness itself also receive a shared cleanup AbortSignal and are registered as pending operations. Harness cleanup aborts and joins these operations before closing database clients or deleting scratch, so the harness's own decoder is also stopped and reaped. No application helper changes were needed.
- New `verify-merge-cleanup.mjs` is an external observer with no database of its own. It starts a child harness for each exceptional case, waits for the expected fatal/signal exit, reads the recorded real decoder PID and checks it and its owner/group are gone. It verifies complete cluster/scratch cleanup and zero tracked direct operations. RED rescue targets only explicitly owned recorded processes/groups after recording the observed failure. The observer accepts either an output prefix or a `.json` report path, matching the README command. The observer's source hash is now included in normal and raw cleanup-fixture harness evidence.

The cleanup fixture uses the existing compiled T04 decoder, real generated 6.4-second sine audio, and shell `exec` of the same FFmpeg binary with `-re`. It confirms `ps` reports the actual FFmpeg executable before fault injection. This is actual decoder lifetime evidence with input-clock throttling, not simulated decoder CPU time.

Latest focused cleanup coverage is six combinations:

- Worker and runner + fatal: stop the actual decoder and kill the Node owner before triggering the harness fatal path. The retained owned-group ID is verified even though its owner already exited; decoder PID and group must be gone afterward. POSIX may terminate/resume an orphaned stopped process group as its owner exits, so these cases do not falsely require an explicit harness SIGKILL if the whole group is already gone.
- Worker and runner + SIGTERM: stop both the actual decoder and Node owner, then signal the harness. The stopped owner cannot cooperate; evidence must contain the forced whole-group SIGKILL and no remaining PID/group.
- Direct in-harness `processOne` + fatal/SIGTERM: stop its actual FFmpeg child, trigger exceptional harness cleanup, and require the shared AbortSignal + pending-operation join to reap that decoder before harness exit. No worker group is invented for this case.

Correction evidence (all previous files preserved):

| Evidence | Outcome |
| --- | --- |
| `cleanup-red-confirmed.json` + four raw fixture files | Expected RED, exit 1: all four old-harness cases exposed a live stopped decoder; observer rescue confirmed all gone afterward. |
| `cleanup-green-initial.json` + four raw fixture files | GREEN, 4/4, exit 0 after group ownership fix. |
| `cleanup-final.json` + six raw fixture files | Intermediate observer assertion failure in two fatal-owner-already-dead cases: all PIDs/groups were already gone, but the observer incorrectly required explicit SIGKILL despite POSIX orphan-group behavior. Corrected only that assertion. Four other cases passed. |
| `worker-fixed.json` | GREEN, 52 scenarios / 396 assertions after implementation fix. |
| **`cleanup-verified.json`** + six raw fixture files | **GREEN, 6/6, exit 0.** Every decoder PID dead after harness exit; no observer rescue needed. Signal cases record forced group kills; direct operations all joined. |
| **`worker-verified.json`** | **GREEN, 52 scenarios / 396 assertions, exit 0.** Current README, fixture, observer and implementation hashes included. Zero owned children, cluster stopped, scratch removed, no cleanup errors. |

Final correction commands (repository root):

```sh
SAGA_FFMPEG_PATH=/Users/eat/.codex/handoffs/videocut/2026-10-06-video-upgrade/evidence/runtime/ffmpeg-macos-x86_64-v7.1 node experiments/t05-durable-worker/verify-merge-cleanup.mjs docs/research/evidence/2026-10-16-t04-t05-merge/cleanup-verified.json
SAGA_FFMPEG_PATH=/Users/eat/.codex/handoffs/videocut/2026-10-06-video-upgrade/evidence/runtime/ffmpeg-macos-x86_64-v7.1 node experiments/t05-durable-worker/verify.mjs --only-merge docs/research/evidence/2026-10-16-t04-t05-merge/worker-verified.json
```

Both commands exited 0. `node --check` passed for the three correction modules. The updated full merge run was 2026-10-16 04:50:03.493–04:51:02.699 UTC; the six-case cleanup observer was 04:50:01.734–04:50:31.600 UTC. Expected child harness fatal/SIGTERM exits are 1/143 respectively; they are the injected outcomes, while the external observer's success is exit 0.

Current selected SHA256 fingerprints from `worker-verified.json`:

- README: `d75c6809f4ff9a82051249890b10f06de4be359efd6726d41dd333d992da6ab0`
- verify: `3249592b1ebc709574d752ffa76fdd2c76650b48f0bd68208a10306d8ebc195a`
- merge scenarios: `04e0aafb11a64775accb136297ae45a19e0e7ce8e789d6893b775913a0f4dce0`
- cleanup observer: `cd693e98027a15b76736bfd0fc8e0bfd875503d9f712e2fefa6dfcda139576fe`
- Store, local adapter, Worker/runner implementation modules and T04 helper hashes are unchanged by this correction.

The correction still cannot run teardown if the top-level owning harness itself receives SIGKILL; that limitation remains explicit. Controller owns the post-fix original T05 full regression and independent focused re-review. No unresolved correction test failures remain at this handoff.

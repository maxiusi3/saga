# Task 1 report — cancellable T04 execution

Status: implementation complete and ready for the controller's independent review. No commit, push, reset, clean, dependency change, production route change, or subagent was used.

## Changed files

Only these four requested source/test files were edited:

- `packages/web/src/lib/server/recording-merge-executor.ts`
- `packages/web/src/lib/server/recording-audio-decoder.ts`
- `packages/web/src/lib/server/__tests__/recording-merge-executor.test.ts`
- `packages/web/src/lib/server/__tests__/recording-audio-decoder.test.ts`

All were already untracked at handoff. Their previous content was retained and extended. Additional writes are this report and the new Task 1 evidence logs in the batch workspace. No build was run; `next-env.d.ts` was not edited. Type checking used `--incremental false` to avoid updating incremental build state.

## Implementation

The backward-compatible interface is unchanged from the shared proposal:

```ts
dependencies.signal?: AbortSignal
readChunk(chunk, signal?: AbortSignal)
decodeAudio(filePath, mimeType, signal?: AbortSignal)
```

`withVerifiedRecordingMerge` captures one signal and forwards that exact object to every reader and decoder call. It checks cancellation before work, after temporary directory/output acquisition, before and after iterator reads, after writes, before and after decoding, and before/after artifact consumption. Native abort reasons are preserved, including the default `AbortError`.

When `readChunk` resolves after cancellation, the executor first acquires the returned source's iterator so cleanup owns it. An abort then follows the existing failure path: call iterator `return()` once, close the output handle in `finally`, and remove the temporary merge directory in the outer `finally`. Cleanup errors from iterator return still cannot replace the original read/write/abort failure.

The FFmpeg decoder now accepts a third optional signal. Pre-cancellation rejects before spawn. During decoding its abort listener sends `SIGKILL` to the child it spawned. Cancellation rejects only when that child emits `close`, so valid PCM received before cancellation is never accepted as success. The same rule covers abort between process `exit` and `close`. On every close outcome the timer is cleared and only this decoder's abort listener is removed. An additional state check after listener installation covers cancellation around spawn/listener registration.

## Test-first evidence

All paths below are relative to `.superpowers/sdd/2026-10-16-upgrade-t04-t05-merge/`. Historical evidence was not overwritten.

| Evidence | Result |
| --- | --- |
| `task-1-red.log` | Initial run: 12 new failures, 41 passes, 53 total. Besides expected missing cancellation behavior, this exposed a Jest AbortSignal deep-comparison renderer error and an overly short success-case process timeout. Both test issues were corrected before implementation. It also contains a Watchman recrawl warning. |
| `task-1-red-confirmed.log` | Confirmed red against unchanged helpers: 13 expected new failures, 41 original passes, 54 total. Added an exit-before-close cancellation case; used identity booleans for signal comparison, 10-second normal startup allowance, and `--watchman=false`. |
| `task-1-green.log` | First implementation: 54/54 passed. |
| `task-1-consume-red.log` | Follow-up test caught success after the consumer returned while aborted: 1 expected failure, 26 passes, 27 executor cases. |
| `task-1-final-green.log` | After the post-consume check: 55/55 passed across both suites (41 original + 14 new). |
| `task-1-typecheck.log` | Web TypeScript check passed, exit 0. |
| `task-1-lint.log` | ESLint on all four files passed, exit 0; empty log means no findings. |

Commands were run from the repository root, with stdout/stderr redirected to the corresponding fresh log and the command exit status preserved:

```sh
# Initial red only; later focused commands add --watchman=false.
npm test --workspace=packages/web -- --runInBand src/lib/server/__tests__/recording-merge-executor.test.ts src/lib/server/__tests__/recording-audio-decoder.test.ts

# Confirmed red, initial green, final green.
npm test --workspace=packages/web -- --runInBand --watchman=false src/lib/server/__tests__/recording-merge-executor.test.ts src/lib/server/__tests__/recording-audio-decoder.test.ts

# Post-consumption boundary red.
npm test --workspace=packages/web -- --runInBand --watchman=false src/lib/server/__tests__/recording-merge-executor.test.ts

npm run type-check --workspace=packages/web -- --incremental false

./node_modules/.bin/eslint packages/web/src/lib/server/recording-merge-executor.ts packages/web/src/lib/server/recording-audio-decoder.ts packages/web/src/lib/server/__tests__/recording-merge-executor.test.ts packages/web/src/lib/server/__tests__/recording-audio-decoder.test.ts
```

The new tests prove pre-abort avoids reading/spawning, exact signal propagation, cancellation during source acquisition and frame reads, actual source/output file handle closure, temporary-directory cleanup, cancellation while an injected decoder Promise is pending, cancellation immediately before consumption and during consumption, actual decoder child death before rejection, abort after process exit, and signal listener removal after success, invalid PCM, spawn unavailability, timeout, and cancellation. Existing callers that omit signal remain covered by all 41 original tests.

## Limits and integration concerns

- Reader `readChunk`, iterator `next`/`return`, and injected decoder/consumer Promises still need cooperative cancellation and/or adapter-owned I/O timeouts. No Promise race claims to terminate arbitrary injected work. A pending decoder test explicitly settles its uncooperative Promise after abort and verifies consumption never starts.
- The consumer is arbitrary external code. The post-consume check rejects a late cancellation but cannot undo effects already performed by that consumer. Lease/queue/permission/input-version fencing and publication remain the controller's T05 integration responsibility.
- Decoder tests use real operating-system child processes backed by local Node test executables, preserving spawn, streaming, kill and close behavior. They are not an actual FFmpeg media-decoding integration proof; the T04/T05 real-file integration must supply that evidence.
- Cancellation terminates the decoder child only; this is not an OS sandbox or a guarantee about arbitrary descendants created by an injected executable.
- Independent review and full integration verification remain controller-owned. This task does not claim G0/G1 or production release completion.

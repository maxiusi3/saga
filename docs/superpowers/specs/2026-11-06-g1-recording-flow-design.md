# G1 recording workflow: an operable save and recovery path

The user approved continuing the recording workflow after the terminal status slice. Deliver an operable path from recording/reopening a local draft to a single playable story, with explicit status and safe local cleanup. G1 remains unpassed until the device/cloud matrix is actually executed.

## Decisions and boundaries

- Reuse the existing capture, indexed chunks, manifest, leased worker, terminal publication and status validator. Do not modify immutable sealed identity to attach a story later.
- Before sealing, reserve one story for the recording session through a service-only atomic RPC. A new `recording_story_intents` ledger binds session, actor, project, story and immutable save metadata. Replays return the same story; conflicting metadata or ownership fail closed. Reserved stories use the existing `processing` status; only a verified terminal recording becomes `ready`.
- The browser persists the save metadata before its first request. An authenticated GET save lookup recovers reservation and manifest identity after any lost response. In particular, a lost seal reply is reconciled through this lookup, never by inventing a new recording/session/story.
- Manifest registration returns its validated manifest hash. Existing seal/status/worker receipts continue to say `canClearLocalDrafts:false`.
- Final confirmation is a separate authenticated operation. It atomically checks active storyteller/ownership, deletion blockers and consistent published asset/job/attempt/candidate/session, writes the story's stable playback reference and duration, and returns an identity-bound receipt. The service validates the complete database snapshot with the existing status validator before granting cleanup. A lost response retains local audio and an explicit retry reconciles the same story.
- Playback uses a stable same-origin media-asset endpoint and the current access/deletion/lineage guard. No Storage key or signed URL is stored as a durable story identity.
- A long-running Node worker command consumes eligible recording jobs using the existing lease/terminal worker. It requires explicit configuration and is not started against remote services in this work. Unknown dispatched outcomes remain unknown; no automatic retry of uncertain terminal writes. Queue selection does not replace the atomic lease claim. Shutdown aborts/drains owned work, and logs omit tokens, source keys and family content.
- Browser saving shows checking local audio, uploading verified chunks, processing, confirming story, saved, and recoverable failure. Offline/reopen retains draft and save intent. Duplicate clicks/tabs use the same server identity. Account/project changes cancel stale work. Recovery offers continue-saving as well as preview/download.
- Cleanup is an explicit user action after a valid confirmation receipt. It checks session/project/user/manifest/asset/story and unchanged local chunk identity in one IndexedDB transaction. A failed local write or delete keeps the draft discoverable and retryable. Status alone never deletes chunks.
- Existing text fallback remains available. Audio recorded through the new local session always uses this pipeline. Do not fall back to an untracked whole-Blob story after any flow error.

## Interfaces

`/api/recordings/sessions/[sessionId]/save`:

- GET `?projectId=<uuid>` returns a bounded save lookup, including the reserved story/immutable metadata and sealed manifest hash if present. No reservation is a normal empty result. Current authorization and deletion checks are mandatory even for replay.
- POST `{action:'reserve', projectId, metadata}` reserves the story. Metadata: title, content, transcript, happenedAt (ISO timestamp), recordingMode (`chat|deep_dive`), isPublic (boolean). Validate types and bounded text (title 500, content/transcript 200000). Audio duration comes from verified media, not the browser.
- POST `{action:'confirm', projectId, manifestSha256}` completes the same story after successful status reconciliation. Receipt pins schemaVersion, projectId, sessionId, storyId, assetId, manifestSha256, playbackUrl and `canClearLocalDrafts:true`; include only bounded public fields. Strict client and server validation required.

Exact final response TypeScript types are declared in a shared browser-safe `recording-save-contract.ts`. No Node imports in that file. Task 1 documents final keys for downstream tasks.

## Verification

Use synthetic audio only. Cover one story on duplicate/lost replies; missing/mutated/wrong-user chunks; pending and failed worker states; corrupt receipt; account change during await; reload/recover then resume; successful playback; no cleanup from status; cleanup rollback. Native SQL checks atomic reservation/confirmation and permission rejection. Actual browser evidence must use production components and IndexedDB; distinguish mocked HTTP from real database/FFmpeg coverage. Full repository gate and independent reviews are required. Preserve prior evidence byte-for-byte. No commit, push, deploy, remote migration, paid provider or family data.

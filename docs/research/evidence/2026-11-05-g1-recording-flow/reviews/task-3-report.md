# Task 3 report

Status: DONE — source frozen for controller integration and independent review.

Implemented the local-capture recording save path in the production record page: capture session ID -> verified recovery -> durable immutable save intent -> reserve -> verified chunk upload/readback -> seal/lookup reconciliation -> bounded status polling -> confirmed story -> explicit local cleanup. Existing text fallback remains available and audio never falls back to whole-Blob story creation. G1 remains false. No stage, commit, push, remote migration, deployment, paid provider, family data, or child agents.

## Files

New production:
- `packages/web/src/lib/recording-save-flow.ts`
- `packages/web/src/lib/recording-save-validation.ts`
- `packages/web/src/lib/recording-session-lock.ts`

Extended production:
- `packages/web/src/lib/recorder-db.ts`
- `packages/web/src/lib/local-recording-session.ts`
- `packages/web/src/lib/recording-recovery.ts`
- `packages/web/src/lib/storage.ts` (optional capture scope callback before upload after authoritative auth await)
- `packages/web/src/components/recording/SmartRecorder.tsx`
- `packages/web/src/components/recording/ReviewStage.tsx`
- `packages/web/src/components/recording/RecordingRecoveryPanel.tsx`
- `packages/web/src/app/[locale]/dashboard/projects/[id]/record/page.tsx`
- `packages/web/public/locales/{en,zh-CN,zh-TW,es,fr,ja,ko,pt}/recording.json`

Tests/support:
- `packages/web/src/lib/__tests__/recording-save-flow.test.ts`
- `packages/web/src/lib/test-support/recording-save-fixture.ts`
- Updated `packages/web/src/lib/__tests__/{local-recording-session,recording-recovery,storage-recording-user}.test.ts`
- Updated `packages/web/src/components/recording/__tests__/record-page-uses-smart-recorder.test.tsx`
- Reproducible native test source: `.superpowers/sdd/2026-11-05-upgrade-g1-recording-flow/verify-task-3-db.cjs`
- Locale generation source: `.superpowers/sdd/2026-11-05-upgrade-g1-recording-flow/task-3-locales.py`

Task 1 sources and root-owned `experiments/recording-flow-browser/*` were not edited. Prior edits and evidence preserved.

## Final browser interfaces

```ts
type RecordingSaveProgress = 'checking' | 'uploading' | 'processing' | 'confirming' | 'saved'
type RecordingSaveResult = { state: 'pending' } | { state: 'saved'; receipt: RecordingSaveReceipt }
type RecordingSaveOptions = {
  identity: { actorId: string; projectId: string; sessionId: string }
  metadata?: RecordingSaveMetadata
  signal?: AbortSignal
  isCurrent: () => boolean
  onProgress?: (progress: RecordingSaveProgress) => void
  onIntent?: (metadata: RecordingSaveMetadata) => void
}
saveLocalRecording(options: RecordingSaveOptions): Promise<RecordingSaveResult>
clearSavedLocalRecording(options: RecordingSaveOptions, receipt: RecordingSaveReceipt): Promise<void>
```

An omitted `metadata` resumes an existing local intent. Metadata is required only before the first durable intent. `onIntent` runs after the local write commits. Errors reject; the UI retains preview/download and offers Continue saving. One initial status read plus at most three additional reads, one second apart, advances an available worker automatically. If all are unresolved, return pending. An unavailable/malformed response fails closed instead of authorizing a replay.

`clearSavedLocalRecording` acquires the same lock, performs a fresh authorized lookup/status/confirmation of the same story, validates the supplied receipt against that new confirmation, then invokes the transactional local cleanup. It does not reuse stale authorization merely because a receipt was persisted previously.

Recorder DB additions:
- `RecorderSaveIntent`: `{ metadata, chunkIdentity, remote: RecordingSaveLookup['intent'], confirmation: RecordingSaveReceipt|null }`, stored as optional `session.saveIntent` (no schema migration needed; stores unchanged).
- `prepareSave(identity,metadata,isCurrent)` atomically verifies local bytes and scope, freezes identity and metadata, and transitions an abandoned `recording` session to interrupted while caller holds the exclusive session lock.
- `readSave(identity,isCurrent)`, `recordSaveLookup(identity,lookup,isCurrent)`, `recordSaveConfirmation(identity,receipt,isCurrent)` recheck scope and the frozen chunk/session identity.
- `clearConfirmedSave(identity,receipt,isCurrent)` verifies the persisted and supplied confirmation identities, hashes local bytes and removes chunks/session in one transaction. Any error aborts the whole transaction.
- Ordinary session/chunk mutation and generic cleanup reject frozen sessions; session creation uses add rather than replacing an existing session.

`SmartRecorder` completion now includes `sessionId`. `RecordingRecoveryPanel` accepts optional `onContinue(recording)` using exported `RecoveredRecording`; the production page supplies it and shows a Continue saving action per draft. Recovered saved intents are validated before form display, restore submitted metadata, and disable edits. Unknown duration uses a native local audio preview and remains saveable. Current actor/project changes key/unmount the scoped page; return/reset/unmount abort active saves and suppress stale UI updates.

## Safety and recovery behavior

- Session Web Lock name is `saga-recording:<sessionId>`; capture holds it until final MediaRecorder data is persisted and onstop interruption finishes. Save/recovery/cleanup share the name. Unsupported Web Locks permit local capture/preview/download but cloud save and cleanup fail closed with visible guidance; no timestamp heuristic guesses whether another tab is still recording.
- Every chunk is hashed from IndexedDB before mutations. Frozen identity includes session/project/actor/mime/start/index and ordered id/session/index/byte/hash/persistedAt/timestamp. Stored uploaded flags never substitute for remote byte verification.
- Upload uses actual Supabase Storage `upload(physicalOwnerPath,blob,{upsert:false,contentType,headers:{Authorization}})`. Installed SDK `FileOptions.headers` is supported; downloaded objects use `download(path,{}, {signal,cache:'no-store'})`. Full download size and SHA-256 must match. Upload success, duplicate and uncertain outcomes all go through readback.
- The installed upload API has no AbortSignal parameter. The caller is bounded to 15 seconds; a dispatched immutable upload may complete later. Its actor token, owner namespace and bytes are pinned. A scope change prevents subsequent reads, local confirmation and remote mutations. Capture's existing storage helper now rechecks its capture/project scope after its own getUser await.
- Lost reserve response resumes with GET lookup. Lost seal response resumes with GET lookup/hash plus status. Only an authorized coherent unresolved status with `jobId:null` permits same-manifest registration retry. Existing jobs are polled; failures or unavailable status never trigger resealing. Lost confirm reply replays the same confirmation, with no second story.
- Shared strict save-contract validators pin actor/project/session/story/asset/hash/playback path. Additional browser status validation checks closed public shape, state/content coherence, output bounds, timestamps and false cleanup flag. Seal identity envelope is checked, then lookup/status are authoritative. Status and seal never authorize deletion.
- Save result is displayed only after valid confirmation is durably recorded. Cleanup is a separate user action. A failed local confirmation or deletion retains the session in recovery listings.
- WebCrypto is asynchronous. Native tests caught TransactionInactiveError in the first transaction-keepalive approach. The corrected implementation waits on pending IDB requests while hashing completes, so the write continuation executes in an active IDB callback. No network await is inside the transaction. Hash waiting is bounded and checks scope.

## Verification

Meaningful RED evidence retained under `docs/research/evidence/2026-11-05-g1-recording-flow/`:
- `task-3-red-flow.log`: new production flow absent.
- `task-3-red-ui.log`: actual record-page tests fail on missing durable/recovery/confirmed UI behavior.
- `task-3-red-polling.log`: unresolved -> succeeded case returns pending without automatic status checks.
- `task-3-red-recovery-metadata.log`: malformed saved-intent metadata incorrectly reaches recovery form before guard added.
- `task-3-db-native-initial.log`: real Chromium TransactionInactiveError before transaction correction.
- Intermediate failing runs retained. Native runner's second run failed only because its two pages used isolated browser contexts for a cross-tab lock assertion; corrected to two pages in one context.

Final focused command:

```sh
npm test --workspace=packages/web -- --runInBand --runTestsByPath src/lib/__tests__/recording-save-flow.test.ts src/components/recording/__tests__/record-page-uses-smart-recorder.test.tsx src/components/recording/__tests__/recording-recovery-panel.test.tsx src/components/recording/__tests__/smart-recorder-session.test.tsx src/lib/__tests__/recording-recovery.test.ts src/lib/__tests__/local-recording-session.test.ts src/lib/__tests__/storage-recording-user.test.ts
```

**7 suites / 117 tests passed**, `task-3-focused-frozen.log`. Covers interrupted/reopened save, lost reserve/seal/confirm, partially registered seal, immutable metadata, wrong scoped lookup/receipt, unknown/failed/pending/succeeded states, bounded automatic polling, duplicate clicks, abort of noncooperative transport, actor change during auth/upload, local integrity rejection, bad remote bytes, explicit cleanup UI and recovery with unknown duration. Jest flow tests replace HTTP/Storage/DB boundaries; native DB evidence below exercises actual persistence semantics. Existing capture and recovery tests also pass.

```sh
node .superpowers/sdd/2026-11-05-upgrade-g1-recording-flow/verify-task-3-db.cjs
```

**11 native scenario checks passed**, `task-3-db-native-final.log` and timestamped `task-3-db-native-*.json`. Uses production recorderDB plus actual Chromium IndexedDB, Blob, WebCrypto and same-context Web Locks. Scenarios include intent persistence/discoverability, immutable metadata, blocked mutation/generic cleanup, wrong actor/project, changed bytes despite unchanged hash metadata, confirmation write rollback, deletion rollback after chunk removal, scope cancellation during hashing, eight forged receipt fields, successful atomic cleanup and active cross-tab lock refusal/release. Synthetic bytes only; temporary bundle/server/browser cleaned up. The first test's label mentions close/reopen but that particular assertion re-reads persistence in the same page; actual reload/capture is controller-owned integration evidence.

`npm run type-check --workspace=packages/web`: passed (`task-3-typecheck-frozen.log`).

ESLint on all changed task TS/TSX production/test files: passed (`task-3-eslint-frozen.log`).

`git diff --check`: passed (`task-3-diff-check.log`). Staged diff empty.

Full repository `npm run verify`, production-page integrated browser/native SQL/FFmpeg run, and independent review are controller-owned after source freeze. Controller browser run found a fixture-only alias gap (`./supabase` bypassed the fixture's `@/lib/supabase` alias); controller is correcting its module replacement. No production workaround was added.

## Limits

This task's own native test is IndexedDB/WebCrypto/locks evidence, not a managed Supabase deployment, actual microphone/device matrix, long recording, mobile suspension, quota exhaustion across browsers, or cloud G1 qualification. Controller's real page integration supplies production UI+MediaRecorder+native SQL+FFmpeg coverage separately.

English, Simplified Chinese and Traditional Chinese messages are translated. Other existing locale files contain English fallback messages for this new flow (pre-existing locale coverage was uneven). A later UI translation pass may replace them without changing behavior.

The keepalive validation deliberately favors byte integrity over throughput and rechecks bytes before remote mutation; long-capture/device performance remains unqualified. Web Locks are required for cloud save/cleanup. Uploaded immutable objects may finish after an upload timeout; local data remains retained and no uncertain outcome grants cleanup. AI draft generation remains independent and its runtime/provider behavior is not proved by these tests. G1 remains false.

## Review fix 1 — I1, I2 and M1

Status: DONE; production source frozen for re-review. This appendix supersedes the original performance caveat, saved-button behavior and overstated native confirmation-write evidence. Earlier reports/logs remain intact. Controller preserved the reviewed source in `task-3-fix-1-before/`; new freeze manifest is `task-3-fix-1-source-hashes.json`.

### I1: bounded byte work while retaining final integrity checks

`saveTransaction` now distinguishes full-byte, metadata-only and selected-chunk verification. Intermediate reads use readonly transactions. `recorderDB.readSaveState(identity,isCurrent,chunkIndex?)` validates frozen session/chunk metadata and all remote receipt bindings, optionally hashing only the selected chunk. `recordSaveLookup` performs a brief metadata transaction. `readSave` remains a full-byte readonly check.

The flow uses selected-chunk verification immediately before each upload and metadata checks after readback and at ordinary API boundaries. It still performs full-byte verification at initial freeze/resume, immediately before seal, immediately before the confirm request, when persisting confirmation, and inside atomic cleanup. Raw same-size/same-metadata replacement of an earlier chunk after its upload is therefore rejected before seal; later replacements are rejected before remote confirmation or before its receipt is durably accepted. Scope checks remain throughout, including while waiting for WebCrypto. The initial freeze and confirmation/cleanup write transactions still protect all bytes atomically; the per-chunk path no longer repeatedly hashes the entire recording.

The fresh save path performs **6N SHA-256 operations**: five local byte passes in total (initial freeze, selected chunks totaling one pass, pre-seal, pre-confirm, persisted confirmation) and one full remote-readback pass. Metadata comparisons still inspect bounded ordered descriptors; no byte hashing is hidden in those checks. Captures in other sessions no longer wait behind two full-recording write transactions for every uploaded chunk.

Native regression now runs **the actual production save flow plus actual recorderDB** in Chromium, replacing only authenticated HTTP/Storage transports with synthetic boundary data. It counts real `crypto.subtle.digest` calls after fixture construction. Before the correction, four chunks required **76** hashes and failed the bound of 24 (`task-3-fix-1-native-red.log`). After correction, 4/8/16 chunks require **24/48/96** hashes. Three additional native cases alter an earlier chunk's raw IndexedDB Blob without changing its length or metadata: after the last upload, during status before confirmation, and immediately after a successful confirm reply. All reject with `recording_local_damaged`, retain all four local chunks and persist no confirmation. The first sends no seal request; the second sends no confirm request. Existing atomic cleanup tamper/cancellation/rollback tests remain passing.

### I2: short, truthful saved action and narrow layouts

`ReviewStage` uses the new short `saveFlow.savedAction` label (“Saved”, “已保存”, “已儲存”; English fallback in other existing locales). The separate page status remains the authority for whether local data is retained or cleared. The disabled action therefore makes no stale retention claim after cleanup. Action rows stack below the small breakpoint; visibility text and controls also stack, and switch controls do not shrink into the explanatory text.

The production-page regression now requires the short disabled Saved button before and after explicit cleanup, requires the cleared status, and rejects the old “Your local copy is still available” text afterward. This failed before the correction (`task-3-fix-1-ui-red.log`). Controller's fresh 375px browser screenshots and geometry checks show no horizontal overflow or visibility overlap.

### M1: actual confirmation-write failure

The native fault now fires **only** when `sessions.put` contains `saveIntent.confirmation`. It records the remote identity presented to that write and counts exactly one attempted confirmation put. After failure, it requires byte-for-byte equal serialized persisted remote identity, `confirmation:null`, the original chunk still present, and the draft still listed in recovery. Thus lookup persistence succeeds first and only confirmation persistence rolls back. The earlier native scenario was actually a lookup-write failure, as the review correctly identified; it must not be cited as native confirmation-write coverage.

### Final fix-1 verification

- Same seven-suite focused Jest command above: **117 tests passed**, `task-3-fix-1-focused-first.log`. Existing behavior coverage remains green; the saved/cleared UI case has stricter assertions.
- `node .superpowers/sdd/2026-11-05-upgrade-g1-recording-flow/verify-task-3-db.cjs`: **15 native scenario checks passed**, `task-3-fix-1-native-final.log` and timestamped `task-3-fix-1-db-native-*.json`. Includes actual flow hash scaling, three late-tamper timing cases, corrected exact confirmation-put rollback, all earlier DB invariants, and same-context cross-tab locks. Native regression source is `verify-task-3-db.cjs` plus `task-3-native-flow-fixture.js`; both retained for evidence archival. HTTP/Storage are isolated synthetic boundaries here; SQL/FFmpeg integration is separate controller evidence.
- `npm run type-check --workspace=packages/web`: passed, `task-3-fix-1-typecheck-first.log`.
- ESLint on the five changed task TS/TSX files: passed, `task-3-fix-1-eslint.log`.
- `git diff --check`: passed, `task-3-fix-1-diff-check.log`; staged diff empty.
- Controller-reported actual browser integration with these frozen product bytes: **256 assertions**, `integrated-browser-1793900355314-496ead1c-fdf2-433c-8336-111217a84772/results.json`; capture, recovery, actual native SQL/FFmpeg save, playback, cleanup rollback/success and mobile layout. `sourceDrift=[]`.
- Controller-reported interrupted/fault browser integration: **293 assertions**, `interrupted-browser-1793900355430-56062ebb-9cc6-425e-9820-e80720370b90/results.json`; capture interruption, offline/account changes, lost reserve/seal/confirm responses with reload, duplicate-safe save, playback and cleanup. `sourceDrift=[]`.

No other task's production code or controller-owned browser harness was edited. No stage, commit, push, remote service or paid provider work. Full repository gate and independent re-review remain controller-owned. G1 remains false.

# Task 1 report

Status: DONE

Implemented idempotent story reservation, authenticated lookup/confirmation, validated seal-hash propagation and stable guarded playback. All Task 1 production source is frozen for independent review. No browser/worker-host work was included. No stage, commit, push, deployment, remote migration, paid service or family data was used. G1 remains false.

## Files changed in this task

New:
- `packages/web/src/lib/recording-save-contract.ts`
- `packages/web/src/lib/__tests__/recording-save-contract.test.ts`
- `packages/web/src/lib/server/recording-story-save.ts`
- `packages/web/src/lib/server/__tests__/recording-story-save.test.ts`
- `packages/web/src/app/api/recordings/sessions/[sessionId]/save/route.ts`
- `packages/web/src/app/api/recordings/sessions/[sessionId]/save/__tests__/route.test.ts`
- `packages/web/src/app/api/media/assets/[assetId]/play/route.ts`
- `packages/web/src/app/api/media/assets/[assetId]/play/__tests__/route.test.ts`
- `supabase/migrations/20261106000001_recording_story_save.sql`
- `experiments/pg17-recording-flow/fixture.mjs`
- `experiments/pg17-recording-flow/verify.mjs`
- `experiments/pg17-recording-flow/README.md`

Extended:
- `packages/web/src/lib/server/recording-manifest-ledger.ts` and its existing test: return the accepted hash.
- `packages/web/src/app/api/recordings/sessions/[sessionId]/seal/route.ts` and its existing test: add `manifestSha256` to the existing response; other seal behavior/cleanup flags preserved.
- `scripts/__tests__/deployment-config.test.js`: append the new migration to the required migration list; inherited changes retained.

Evidence is only under `docs/research/evidence/2026-11-05-g1-recording-flow/`. Existing evidence/historical harness inputs were preserved. Current staged diff remains empty.

## Exact public contracts

Browser-safe types and validators are in `recording-save-contract.ts`:

```ts
type RecordingSaveMetadata = Readonly<{
  title: string; content: string; transcript: string; happenedAt: string;
  recordingMode: 'chat' | 'deep_dive'; isPublic: boolean;
}>
type RecordingSaveIdentity = Readonly<{ actorId: string; projectId: string; sessionId: string }>
type RecordingSaveLookup = Readonly<RecordingSaveIdentity & {
  schemaVersion: 1;
  intent: Readonly<{
    storyId: string; metadata: RecordingSaveMetadata;
    manifestSha256: string | null; assetId: string | null; confirmed: boolean;
  }> | null;
  canClearLocalDrafts: false;
}>
type RecordingSaveConfirmationIdentity = Readonly<RecordingSaveIdentity & {
  storyId: string; assetId: string; manifestSha256: string;
}>
type RecordingSaveReceipt = Readonly<RecordingSaveConfirmationIdentity & {
  schemaVersion: 1; playbackUrl: string; canClearLocalDrafts: true;
}>
```

Exports:
- `isRecordingSaveUuid(value): value is string`
- `validateRecordingSaveIdentity(value): asserts value is RecordingSaveIdentity`
- `validateRecordingSaveMetadata(value): asserts value is RecordingSaveMetadata`
- `validateRecordingSaveLookup(value, identity): RecordingSaveLookup`
- `validateRecordingSaveReceipt(value, identity: RecordingSaveConfirmationIdentity): RecordingSaveReceipt`

All UUIDs lowercase canonical shape; SHA-256 lowercase hex. Metadata title max 500 UTF-16 code units; content/transcript max 200000; strings may be empty, cannot contain NUL. `happenedAt` is canonical UTC with milliseconds (`new Date().toISOString()`, e.g. `2026-11-06T00:00:00.000Z`), with a valid round-trip calendar. Metadata and response envelopes reject unknown/missing keys. Returned public values and nested intent metadata are frozen.

`GET /api/recordings/sessions/<sessionId>/save?projectId=<uuid>`: exactly one projectId query key; returns 200 RecordingSaveLookup. `intent:null` means no reservation. A sealed reservation returns the validated `manifestSha256` and `assetId`, including after a lost seal response. Even `intent.confirmed:true` lookup has `canClearLocalDrafts:false`.

`POST /api/recordings/sessions/<sessionId>/save`: no query parameters. Exactly one of:
- `{action:'reserve',projectId,metadata}` -> 200 RecordingSaveLookup with nonnull intent.
- `{action:'confirm',projectId,manifestSha256}` -> 200 RecordingSaveReceipt.

Confirmation `playbackUrl` is exactly `/api/media/assets/<assetId>/play`. It includes actorId for browser receipt/cleanup pinning. The client must compare all identity fields, not only storyId or the cleanup flag. The only true cleanup receipt is the confirmation response. Seal/status/lookup still grant no cleanup.

Errors use `{error:string}` without SQL/storage details. Invalid inputs 400; missing authentication 401; disabled feature 404; SQL authorization failure 403; conflicting metadata, absent/pending/corrupt SQL terminal chain 409; malformed returned snapshot or transport failure 503. Project guard status is preserved for unavailable/denied project access. Auth response cookies and no-store headers are forwarded.

`GET /api/media/assets/<assetId>/play`: canonical UUID; uses the existing asset access route for authentication, current project access, lineage and deletion checks before/after signing. Returns a no-store 307 to the transient HTTP(S) signed URL, including local Supabase HTTP URLs; refreshed cookies are retained. Existing guarded failures remain failures. The durable story stores only the same-origin playback path.

`persistRecordingManifest(admin,sealed,signal?)` now returns `Promise<string>`. Seal response adds that validated `manifestSha256` alongside its existing fields.

Server APIs:
- `lookupRecordingStorySave(identity,{admin,signal?,timeoutMs?})`
- `reserveRecordingStorySave(identity,metadata,{admin,signal?,timeoutMs?})`
- `confirmRecordingStorySave({...identity,manifestSha256},{admin,signal?,timeoutMs?})`
- `RecordingStorySaveError.status` maps safe API failures.

RPC default deadline 5000ms, supported override 1..60000ms, cancellation signal propagated; a separate interruption promise also bounds a transport that ignores abort. `.retry(false)` prevents implicit retries. An uncertain write stays uncertain until an explicit GET/replay/confirm.

## SQL invariants

`recording_story_save(uuid,uuid,uuid,text,jsonb,text)` is a VOLATILE SECURITY DEFINER function with trusted search_path, UTC and 3s lock_timeout, callable only by service_role. `recording_story_intents` has session PK and unique story binding, RLS+FORCE RLS, and no direct client or service-role table grant. The routine owner accesses it; clients cannot make themselves privileged through JWT claims.

Lock order starts with deletion_requests SHARE table lock, then the same session advisory lock used by seal, project, actor, role, story, session/chunks, asset, job, attempts, candidate. Current actor/project/story ownership and deletion subjects are re-read after waiting; non-READ COMMITTED calls fail. Absent intents serialize before story insert. Existing sealed identity cannot be modified to attach a story later.

The exact bootstrap story CREATE TABLE is used in native tests. Reservation inserts both user_id/storyteller_id, supplied bounded metadata and status processing. No duration or audio URL comes from the browser. SQL confirm cross-checks current published asset/job/attempt/candidate/session identities, content metadata, matching publication times, sealed hash, chunks and prior attempts. It atomically marks the reserved story ready and writes the stable path plus verified duration rounded up from milliseconds to integer seconds into audio_duration and duration. Replays validate the current chain and never rewrite title/content/transcript/other edits. Suppressed/tampered story writes are checked before returning.

RPC returns exactly `{lookup,snapshot}`; the snapshot is the existing raw bounded status envelope when sealed. The actual application `validateRecordingSessionSnapshot` must accept it and report succeeded before the service constructs a cleanup receipt. The snapshot timestamp is sampled after the read because a lock wait can cross publication.

## Tests and evidence

RED:
- `task-1-red-tests.log`: missing new modules plus meaningful manifest hash-return failure (1 failed/19 passed existing manifest tests).
- `task-1-red-routes.log`: new routes absent.
- `node experiments/pg17-recording-flow/verify.mjs --without-migration` -> expected 42883 at actual service-role call; `task-1-native-red.log`.
- Added corrupt-chunk native case failed before per-chunk SQL validation; `task-1-native-red-corrupt-chunk.log`.
- Added local HTTP signed playback case failed 503 before URL protocol support; `task-1-play-local-red.log`.
- Intermediate SQL CASE parse error/type narrowing diagnostics and all failed native runs retained rather than overwritten.

Final focused command:

```sh
npm test --workspace=packages/web -- --runInBand --runTestsByPath src/lib/__tests__/recording-save-contract.test.ts src/lib/server/__tests__/recording-story-save.test.ts src/lib/server/__tests__/recording-manifest-ledger.test.ts 'src/app/api/recordings/sessions/[sessionId]/save/__tests__/route.test.ts' 'src/app/api/media/assets/[assetId]/play/__tests__/route.test.ts' 'src/app/api/recordings/sessions/[sessionId]/seal/__tests__/route.test.ts' 'src/app/api/media/assets/[assetId]/access/__tests__/route.test.ts'
```

Result: 7 suites /167 tests passed (`task-1-focused-frozen.log`). Includes authorization, closed receipt shape, wrong actor/story/hash, false-cleanup refusal, nonterminal/corrupt snapshots, explicit reserve/lookup replay, timeout/abort, API cookie/no-store behavior, seal hash propagation, existing access deletion/lineage races, stable playback and local HTTP signing.

`node experiments/pg17-recording-flow/verify.mjs`: 94 assertions passed (`task-1-native-final.log`, full results in `native-1793896158803-edab0979-29f1-4415-8a65-57b4b8be2aed/results.json`). Isolated native PG17.4, exact bootstrap story schema, actual SQL and actual application strict snapshot validator. Tests single-story replay, immutable metadata conflict, ledger privilege denial, lost seal lookup, pending refusal, valid confirmation, preserved user edits, corrupt job/attempt/candidate/asset/session/chunk refusal, deletion subjects, revocation and ownership. Concurrent reserve and confirmation waits are synchronized by observing real backend lock waits before committing the competing transaction. Late tombstone/role/ownership commits reject confirmation. Cleanup: cluster stopped, temp directory removed, 0 clients, 0 errors.

`npm run type-check --workspace=packages/web`: passed (`task-1-typecheck-frozen.log`).

`npx eslint packages/web/src/lib/recording-save-contract.ts packages/web/src/lib/server/recording-story-save.ts packages/web/src/lib/server/recording-manifest-ledger.ts 'packages/web/src/app/api/recordings/sessions/[sessionId]/save/route.ts' 'packages/web/src/app/api/recordings/sessions/[sessionId]/seal/route.ts' 'packages/web/src/app/api/media/assets/[assetId]/play/route.ts'`: passed (`task-1-eslint-frozen.log`).

`node --test scripts/__tests__/deployment-config.test.js`: 7/7 passed (`task-1-infrastructure-final.log`).

`git diff --check`: passed; `git diff --cached --name-only`: empty. Full repository verify is owned by controller after combined source freezes, per controller instruction.

## Downstream reuse and limits

`experiments/pg17-recording-flow/fixture.mjs` exports setup(h,source,migrate=true), fresh(h,service,prepare,publish=true), save(client,sessionId,action='lookup',metadata=null,hash=null,actor=USER,project=PROJECT), compileFlow(h,source), USER/OTHER/PROJECT/METADATA/FLOW/RPC. Setup uses exact bootstrap stories DDL, existing root migrations and a new isolated cluster. Historical runtime binaries are only read/executed through the authorized existing Harness.

No Task 1 blocker remains. Native candidate audio metadata is synthetic; the native checks are not FFmpeg/media qualification, managed Supabase/PostgREST/Storage, actual device/cloud G1, or browser local-cleanup evidence. Task 4 should integrate the real browser path. SQL access is checked at confirmation/lookup transaction time; a later revocation is handled by playback access guards and browser account/project cancellation. Unknown network outcomes never authorize deletion. Existing access signing is still a short-lived capability, with its previously documented post-check revocation window.

## Review fix 1 — I1 and M1

Status: DONE. I1 and M1 fixed; Task 1 source frozen again for review. This appendix supersedes the initial no-blocker assessment above. Initial reports, review, evidence and failed runs remain intact.

Before editing, copied all 17 reviewed source files into `.superpowers/sdd/2026-11-05-upgrade-g1-recording-flow/fix-1-before/` preserving their relative paths. Every copy/current file matched `task-1-review-hashes.json`. Also preserved the initial report, review and hash manifest in that directory. Rechecking the backup after the fix still matched every original hash.

Only four of the 17 reviewed files changed in this correction:
- `supabase/migrations/20261106000001_recording_story_save.sql`
- `packages/web/src/lib/recording-save-contract.ts`
- `packages/web/src/lib/__tests__/recording-save-contract.test.ts`
- `experiments/pg17-recording-flow/verify.mjs`

I1: before any story or intent update, SQL now reconstructs the canonical actor/project/session-derived UUIDv8 and canonical processing idempotency key, including the ordered chunk tuple digest, using the same calculation as `recording_job_lease` and `prepareRecordingSessionSeal`. Both asset and job stored keys must equal that derived value; two equal but wrong stored keys are rejected. The existing independent application snapshot validator remains unchanged.

The same-transition immutable comparison audit covered all fields reconstructed by the status validator: asset id/project/story/creator/kind/mime/bytes/version/idempotency plus original_filename/parent_asset_id; job project/asset/creator/input_version/type/processor/model/parameter/idempotency/max_attempts/cancellation; session and chunk bindings. The existing SQL already compared the remaining row identity fields. Additional gaps were the unverified canonical asset UUID and the fact that a rehashed but noncanonical manifest/chunk object could pass SQL while its raw snapshot failed application parsing. The new pre-write block therefore also validates the closed root/chunk schemas, exact JSON scalar types, contiguous indexes, unique chunk IDs, private physical and logical paths, MIME/hash syntax and bounded input bytes before deriving identity. Native tests cover the newly identified gaps. Mutable playback location continues to be compared against the published candidate.

M1: `recordingMode` now requires a primitive string before enum membership. The contract regression rejects both `['chat']` and `['deep_dive']`. Public response keys and valid-input contracts did not change.

Native regression drives the real `confirmRecordingStorySave` against native SQL through the existing adapter for six mutations: job key, asset key, two equal noncanonical keys, coherently rebound asset UUID with updated job result/candidate/manifest, rehashed extra manifest field, and coherently changed physical chunk key. It records full before/after story and intent rows, checks no receipt, expects SQL conflict 409 at the actual service, and requires complete rows unchanged with status processing/audio_url NULL/confirmed_at NULL.

RED evidence:
- `task-1-fix-1-contract-red.log`: the two single-element array cases failed to throw (2 failed, 10 passed) before the primitive check.
- `node experiments/pg17-recording-flow/verify.mjs --before-fix-1`: uses only the saved pre-fix migration from this workspace while running the current regressions. `task-1-fix-1-native-red-final.log` / its timestamped results reproduce all six cases as application 503 after story ready/audio present/intent confirmed. The failure asserts the committed rows differ from their pre-confirm state, rather than accepting application error as sufficient.
- Initial regression-fixture attempts hit a unique storage-location constraint in the coherent UUID setup; those failed runs were retained. The corrected setup updates every relevant reference including job result_ref, and both saved-baseline and final runs use that same setup. No production source was reverted to run RED.

Final validation:
- `node experiments/pg17-recording-flow/verify.mjs`: **130 assertions passed**; `task-1-fix-1-native-final.log`; full native results at `native-1793897371784-10f01fb5-7af7-4500-9d09-6a961e7438ba/results.json`. All six actual application calls return 409 with no receipt and byte-for-byte equal JSON database story/intent rows. Cluster stopped, temp directory removed, zero clients/errors.
- Same 7-suite focused Jest command documented above: **169 tests passed**; `task-1-fix-1-focused-final.log`.
- `npm run type-check --workspace=packages/web`: passed; `task-1-fix-1-typecheck-final.log`.
- `npx eslint packages/web/src/lib/recording-save-contract.ts packages/web/src/lib/__tests__/recording-save-contract.test.ts`: passed; `task-1-fix-1-eslint-final.log`.
- `git diff --check`: passed; `task-1-fix-1-diff-check.log`.

No stage, commit, subagents, remote or paid service work. Full combined repository gate and downstream browser/device validation remain controller-owned; G1 remains false.

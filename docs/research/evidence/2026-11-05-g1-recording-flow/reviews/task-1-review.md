# Task 1 review

## Spec Compliance

- ❌ Issues found: confirmation can commit a reserved story as `ready` and its intent as confirmed for a corrupt immutable job identity. The application subsequently rejects that same snapshot. This violates the requirement that corrupt terminal publication must leave the reserved story unconfirmed/processing. See Important I1 at `supabase/migrations/20261106000001_recording_story_save.sql:156` and `:218`.
- ✅ The remainder of the task scope is implemented: session-scoped atomic reservation and metadata replay, service-only ledger, lookup without cleanup authority, seal-hash propagation, separately validated confirmation receipt, and stable guarded playback. References below.
- ⚠️ This is a Task 1 review. Browser receipt pinning, explicit local cleanup, full combined-source verification, real device/cloud G1 and deployed Supabase behavior remain controller/downstream responsibilities; they are not established by the Task 1 diff. The task report correctly leaves G1 false.

## Strengths

- Reservation serializes on the existing session advisory lock before creating the story, enforces actor/project ownership, inserts the actual bootstrap story columns, and rejects changed metadata rather than creating another story (`supabase/migrations/20261106000001_recording_story_save.sql:81`, `:94`, `:130`, `:139`).
- The ledger has RLS and FORCE RLS and revokes direct client/service-role table access; only the definer RPC is granted to service_role (`supabase/migrations/20261106000001_recording_story_save.sql:12`, `:14`, `:245`).
- The service bounds an abort-ignoring RPC with a separate interruption promise, disables implicit retry, maps SQL failures to safe public errors, and requires the existing strict snapshot validator to succeed before returning cleanup authority (`packages/web/src/lib/server/recording-story-save.ts:20`, `:30`, `:44`, `:49`). Thus I1 does **not** currently grant a false cleanup receipt.
- Playback reuses the existing access handler and preserves refreshed cookies; the durable story URL remains same-origin (`packages/web/src/app/api/media/assets/[assetId]/play/route.ts:2`, `:10`, `:17`).
- Hash propagation extends the accepted manifest receipt without changing existing seal cleanup semantics (`packages/web/src/lib/server/recording-manifest-ledger.ts:58`; `packages/web/src/app/api/recordings/sessions/[sessionId]/seal/route.ts:95`, `:106`).
- Native checks use the actual bootstrap story CREATE TABLE and verify synchronized backend lock waits, not timing-only assumptions (`experiments/pg17-recording-flow/fixture.mjs:17`; `experiments/pg17-recording-flow/verify.mjs:14`, `:106`).

## Issues

### Critical (Must Fix)

- None identified.

### Important (Should Fix)

**I1 — Validate immutable publication identity before committing the story-ready transition.**

- Location: `supabase/migrations/20261106000001_recording_story_save.sql:156` (terminal checks), `:218` (story transition), `:221` (intent confirmation); `packages/web/src/lib/server/recording-story-save.ts:44` (validation after RPC commit).
- The SQL predicate does not validate the asset/job `idempotency_key` against the sealed recording identity. The existing application validator does: it reconstructs the sealed bundle and compares the immutable asset and job fields (`packages/web/src/lib/server/recording-status-validation.ts:167`, `:197`, `:204`). As a result, SQL can commit `ready`/`confirmed_at`, then the API returns 503 because its strict validator rejects the returned snapshot. The application failure cannot roll back the already completed RPC.
- Reproduced with one focused native PG17 probe: create a valid reserved/sealed/published recording using the production fixture, set only `processing_jobs.idempotency_key = 'tampered-key'`, and call the real `confirmRecordingStorySave`. Observed `{apiStatus:503, rpcConfirmed:true, story:{status:'ready',has_audio:true}, intent:{confirmed:true}}`. The probe used the actual migration, native SQL and actual application service/validator. No passing suite was rerun.
- Impact: a publication the API itself considers corrupt is nevertheless exposed as a ready story, and future save lookups/confirmations fail validation while the story and intent claim completion. The existing corruption tests at `experiments/pg17-recording-flow/verify.mjs:81` do not mutate immutable idempotency fields, so they miss this split.
- Fix: validate both asset and job immutable idempotency identities against the sealed recording before the SQL updates, using the established canonical identity calculation. Audit the other immutable identity comparisons at this same transition for equivalent gaps. Add a focused native regression that corrupts the job key (and asset key), calls the actual application confirmation, and verifies rejection leaves `stories.status = 'processing'`, `audio_url IS NULL`, and `recording_story_intents.confirmed_at IS NULL`. Keep the independent application validator and no-cleanup-on-error behavior.

### Minor (Nice to Have)

**M1 — The shared metadata validator coerces a non-string recording mode.**

- Location: `packages/web/src/lib/recording-save-contract.ts:30`.
- `String(row.recordingMode)` accepts `recordingMode: ['chat']` and `['deep_dive']`, although the exported assertion promises a primitive `'chat' | 'deep_dive'`. The same validator is used by the public lookup validator, so its asserted type and shallowly frozen result are not as strict as advertised. The SQL routine independently checks the JSON type, which prevents this input from being persisted; this is a contract-validation defect rather than an authorization bypass.
- Fix: require `typeof row.recordingMode === 'string'` before checking enum membership, and add a small contract regression for the single-element array form.

## Checks and evidence

- Read the supplied brief, implementer report, frozen patch and hash manifest. The initial combined patch output was truncated by the tool; the omitted patch sections were subsequently read in bounded ranges. Changed production files were not separately opened. All 17 current file SHA-256 values matched `task-1-review-hashes.json`.
- Named cross-task risk — lock ordering and snapshot authority: checked the existing terminal publisher's deletion-table-first lock (`supabase/migrations/20261104000001_recording_job_finalization.sql:56`), the reused lease routine's advisory/project/actor/role/story/session/chunks/asset/job/attempt order (`supabase/migrations/20261103000001_recording_worker_leases.sql:83`), and the read-only STABLE snapshot routine (`supabase/migrations/20261105000001_recording_session_snapshot.sql:9`, `:26`). The Task 1 save order is compatible with cooperating publication operations; the refreshed observation timestamp follows the snapshot read (`supabase/migrations/20261106000001_recording_story_save.sql:234`). No new lock inversion was found.
- Named cross-task risk — actual story schema/trigger interference: checked the bootstrap stories columns and trigger declarations plus root migration story-trigger matches. The explicit status/audio fields exist and no installed story timestamp trigger was found that would defeat the SQL's exact write verification. This does not establish behavior of unrecorded remote schema drift.
- Named cross-task risk — playback guard reuse: checked `packages/web/src/app/api/media/assets/[assetId]/access/route.ts:27`, `:56`, `:70`; the wrapper invokes the existing authentication, deletion/lineage and post-signing current-asset checks.
- Named cross-task risk — SQL transition versus strict snapshot validation: inspected `packages/web/src/lib/server/recording-status-validation.ts:153` through its terminal validation and ran only the new I1 corruption probe described above. This produced the Important finding.
- Existing focused Jest evidence: `docs/research/evidence/2026-11-05-g1-recording-flow/task-1-focused-frozen.log` records 7 suites / 167 tests passed; no warning/error noise is present.
- Existing native evidence: `docs/research/evidence/2026-11-05-g1-recording-flow/task-1-native-final.log` and `native-1793896158803-edab0979-29f1-4415-8a65-57b4b8be2aed/results.json` record 94 assertions passed, including real concurrent reserve and late tombstone/role/story-ownership waits, with complete cleanup.
- Existing type-check, ESLint and infrastructure evidence was read from the exact frozen/final files named in the implementer report; type-check and ESLint are clean, infrastructure reports 7/7. These commands were not rerun. Full repository verification remains controller-owned.
- Focused probe command: `node --input-type=module` with imports of `Harness`, `setup`, `fresh`, `compileModules`, `compileFlow`, and `save` from the existing local harness modules. After native setup and `fresh(...)`, the sole corruption was `UPDATE processing_jobs SET idempotency_key='tampered-key' WHERE id=$1`; the real application `confirmRecordingStorySave` called the actual RPC through the native adapter. Output was the I1 tuple above. PG17 cleanup reported `clusterStopped:true`, `tempDirectoryRemoved:true`, `clientsRemaining:0`, `errors:[]`.
- Only this requested review report was written in the checkout. No production files, index, HEAD, branch state, historical evidence, remote services or paid services were changed.

## Assessment

**Spec compliance: Issues found.**

**Task quality: Needs fixes.**

The reservation, replay, access and cleanup-receipt boundaries are carefully implemented, but confirmation currently has a reproducible split between committed story state and the authoritative strict snapshot result. Fix I1 before accepting Task 1; M1 is a small contract correction.

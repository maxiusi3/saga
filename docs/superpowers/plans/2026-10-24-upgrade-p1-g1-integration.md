# P1 Reliable Data Foundation & G1 Gate Implementation Plan

> **For agentic workers:** Execute P1 (`T02 → T05 → T03 → T04`) in order and verify against the G1 quality gate criteria in `docs/2026-10-10-integrated-upgrade-plan.md` §7.1 and `docs/superpowers/specs/2026-10-13-upgrade-p1-contracts.md`.

**Goal:** Connect the P1 local domain contracts (`media-assets`, `processing-jobs`, `consent-deletion`, `recording-session`/`recording-merge`) into a unified SQL migration, server adapters, API routes, offline export catalog, and PG17 + Jest G1 verification suite.

**Architecture:** Next.js App Router API routes (feature-gated behind `MEDIA_ASSETS_ENABLED === 'true'`) backed by Supabase Postgres/Storage and durable job state transitions, verified with Jest unit/integration tests and isolated PostgreSQL 17.4 end-to-end G1 fault & cross-family isolation scenarios.

---

## Task 1: P1 Foundation & Reconciliation SQL Migration

Files:
- Create `supabase/migrations/20261024000001_p1_foundation_and_reconciliation.sql`

Steps:
- [x] Write idempotent forward reconciliation for the 7 unregistered root migrations (revoke blanket `authenticated` DML on `agent_runs`, `story_artifacts`, `public_archive_entries`, `user_resource_wallets`, `waitlist`; drop permissive `"Users can insert/update own wallet"` policies; add missing `user_settings` and `notification_settings` columns; fix `storage.objects` `saga` policies to use `storage.foldername(objects.name)`; revoke `anon`/`authenticated` `SELECT` on `waitlist_stats`).
- [x] Declare P1 tables (`public.media_assets`, `public.legacy_media_references`, `public.processing_jobs`, `public.processing_attempts`, `public.consent_records`, `public.deletion_requests`, `public.deletion_targets`, `public.recording_sessions`, `public.recording_chunks`) with RLS enabled, strict `CHECK` constraints, project-scoped uniqueness, and narrow `SECURITY DEFINER` + `RESTRICTIVE` policies.

## Task 2: T02 Unified Media Assets & Self-Contained Offline HTML Export

Files:
- Modify `packages/web/src/lib/server/media-export.ts`
- Modify `packages/web/src/app/api/projects/[id]/export/route.ts`
- Modify `packages/web/src/lib/server/__tests__/media-export.test.ts`

Steps:
- [x] Add `buildOfflineExportHtml` in `packages/web/src/lib/server/media-export.ts` that generates a standalone `index.html` with safely escaped embedded JSON/HTML (`<`, `>`, `&`, `'`, `"`), zero external scripts/fonts, and no `file://` cross-file `fetch` dependency.
- [x] Update `addVerifiedMediaAssetsToZip` and `/api/projects/[id]/export` to include `index.html` and reject any export containing tombstoned/deleting or unverified assets.
- [x] Add tests in `packages/web/src/lib/server/__tests__/media-export.test.ts` covering offline HTML generation, XSS escaping, tombstoned asset rejection, and SHA-256 verification.

## Task 3: T03 Consent, Deletion Tombstones & Immediate Access Revocation

Files:
- Create `packages/web/src/lib/server/deletion-service.ts`
- Create `packages/web/src/app/api/media/delete-request/route.ts`
- Modify `packages/web/src/app/api/media/assets/[assetId]/access/route.ts`
- Create `packages/web/src/lib/server/__tests__/deletion-service.test.ts`

Steps:
- [x] Implement `requestAssetOrStoryDeletion` and `executeDeletionRequestTargets` in `packages/web/src/lib/server/deletion-service.ts`, wiring `createDeletionRequest`, `beginDeletionRequest`, `completeDeletionRequest`, `recordDeletionFailure`, and `reapplyDeletionTombstone` to database + Storage operations and cancelling any active `processing_jobs`.
- [x] Expose `POST /api/media/delete-request` (behind `MEDIA_ASSETS_ENABLED === 'true'`) to authenticate the caller, check `requireProjectAccess` and `isActionAllowed('delete_story', ...)`, write the deletion tombstone, and transition targeted `media_assets` to `deleting`.
- [x] Update `/api/media/assets/[assetId]/access` to check for active deletion tombstones (`deletion_requests` with non-null `tombstone_at`) and deny access (`409`) immediately.
- [x] Add unit/integration tests in `packages/web/src/lib/server/__tests__/deletion-service.test.ts`.

## Task 4: T04 & T05 Recording Session Seal, Durable Merge Job & G1 Verification

Files:
- Create `packages/web/src/lib/server/recording-session-service.ts`
- Create `packages/web/src/app/api/recordings/sessions/[sessionId]/seal/route.ts`
- Create `packages/web/src/lib/server/__tests__/recording-session-service.test.ts`
- Create `experiments/pg17-p1-g1-verification/verify.mjs`
- Create `experiments/pg17-p1-g1-verification/README.md`
- Create `docs/research/2026-10-24-p1-g1-verification.md`

Steps:
- [x] Implement `sealRecordingSessionAndEnqueueMerge` and `runRecordingMergeWorkerAttempt` in `packages/web/src/lib/server/recording-session-service.ts`, connecting `buildRecordingMergeTaskInput`, `claimProcessingJob`, `withVerifiedRecordingMerge`, Storage upload, and atomic `ready`/`succeeded` state transitions while respecting cancellation and deletion tombstones.
- [x] Expose `POST /api/recordings/sessions/[sessionId]/seal` (behind `MEDIA_ASSETS_ENABLED === 'true'`).
- [x] Add unit/integration tests in `packages/web/src/lib/server/__tests__/recording-session-service.test.ts`.
- [x] Implement and run `experiments/pg17-p1-g1-verification/verify.mjs` on PostgreSQL 17.4 to verify `20261024000001_p1_foundation_and_reconciliation.sql`, 5/20/30-minute session manifests, fault injection (network drop, reload, duplicate seal, corrupted chunk, quota exceeded), cross-family ASR/playback/export/deletion denial, and tombstone replay after `pg_dump`/`pg_restore`.
- [x] Run full `npm run verify`, `npm test --workspace=packages/shared -- --runInBand`, and `npm run test:infra`, update handoff/milestone records, commit, and push if G1 criteria are met.

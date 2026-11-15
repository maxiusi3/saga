# G1 Recording Finalization Implementation Plan

**Goal:** Add and verify the atomic publication/permanent-failure persistence
boundary after prepared candidate storage.

**Spec:** `docs/superpowers/specs/2026-11-04-g1-recording-finalization-design.md`.

## Global Constraints

- Preserve the inherited dirty checkout, old experiments and all old evidence.
- No staging, commits, pushes, remote migrations, deployment or paid calls.
- Run only disposable local PostgreSQL and synthetic HTTP/data fixtures.
- No worker/browser wiring, automatic retry, candidate/local copy deletion or
  cleanup authorization. `canClearLocalDrafts:false`; G1 remains incomplete.
- Keep existing verifier/worker compiler compatibility and prepare-only behavior.

## Task 1: PostgreSQL terminal transaction

Files: new `supabase/migrations/20261104000001_recording_job_finalization.sql`,
`experiments/pg17-recording-finalization/{verify,fixture,database}.mjs`, README,
evidence under `docs/research/evidence/2026-11-04-g1-recording-finalization/`.

Interfaces: exact finalize_recording_job signature and receipt from the spec;
reuse complete seal/lease/candidate migrations without modifying old files.

- [x] Write native missing-RPC probe and run `node experiments/pg17-recording-finalization/verify.mjs --without-migration`; retain expected undefined-function RED.
- [x] Implement bucket constraint extension, fixed-search-path/UTC service-only RPC, deletion table lock first, READ COMMITTED requirement and bounded lock wait.
- [x] Implement publish only for locked prepared candidates using exact prepare replay; implement pre-candidate known permanent failure; atomically update all four rows and enforce post-DML expiry rollback.
- [x] Run real native matrix described in spec, including full before/after tuples, both race orders, expiry, ACL and rollback; preserve source snapshots and cleanup receipts.
- [x] Record task specification and quality review; resolve actionable findings.

## Task 2: Strict application terminal adapter

Files: new `packages/web/src/lib/server/recording-job-finalization.ts` and
`__tests__/recording-job-finalization.test.ts`; widen only the bucket unions in
`media-export.ts` and `deletion-service.ts`; new finalization harness HTTP module;
new `recording-asset-lineage.ts` and tests, targeted changes/tests in
`media-asset-guard.ts`, `app/api/media/assets/[assetId]/access/route.ts`
and `app/api/projects/[id]/export/route.ts`.

Interfaces: publishRecordingJob(lease, preparedCandidate, options) and
failRecordingJob(lease, brandedPermanentError, options), returning exact closed
terminal receipts. Options are admin, signal?, timeoutMs?. Task 1 RPC is the only
mutation path. No imports from old worker into new code or vice versa.

- [x] Write and run failing behavioral tests for strict input/receipt identity, timestamps, failure branding, cancellation and response loss.
- [x] Implement bounded no-retry RPC wrappers; use exact candidate output and action-specific null parameters, no leaking errors or remote/local deletion.
- [x] Add shared immutable candidate lineage validation; include project/session tombstones in asset access and export initial/final checks; test missing/mismatched lineage and deletion during signing/download. Keep generic URL parser and seal replay strict.
- [x] Add native loopback HTTP + actual Supabase JS finalizer integration for publish, fail, bad receipt, response loss after commit and cancellation; verify no retry and all resources close.
- [x] Run focused tests and old-worker compiler compatibility; review task specification/quality and resolve actionable findings.

## Task 3: Complete local slice verification and handoff

- [x] Add the new migration to the existing dependency-order assertion in scripts/__tests__/deployment-config.test.js, preserving inherited entries.
- [x] Run `npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra`; preserve command, exit code, logs and unchanged source hashes.
- [x] Independently review the final slice against the spec, then quality; fix findings and repeat only affected checks.
- [x] Verify prior evidence hashes and inherited source preservation, restore only build-generated next-env bytes, run git diff --check and verify no staging/HEAD movement.
- [x] Write report/evidence index and update docs/HANDOFF-2026-10-13-upgrade.md and docs/README.md with precise next steps and remaining gates.

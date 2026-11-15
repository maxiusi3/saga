# G1 Deletion Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make deletion requests atomically capture all recording object targets and make backup manifests accept recording candidates.

**Architecture:** One service-only PostgreSQL capture routine replaces the route's read/insert/update sequence. A strict TypeScript adapter exposes an honest accepted-request summary; existing Scheme B manifest validators gain candidate-bucket compatibility. Physical Storage cleanup remains outside this batch.

**Tech Stack:** PostgreSQL 17, PL/pgSQL, Next.js, Supabase JS, TypeScript/Jest, standalone Node CJS.

**Spec:** `docs/superpowers/specs/2026-11-06-g1-deletion-capture-design.md`

## Global Constraints

- Existing feature checkout and inherited dirty work are inputs; no stage/commit/push/deploy/remote migration/paid API/family data.
- Preserve old source evidence; save immediate baseline bytes and unique RED/GREEN artifacts.
- Full acceptance does not mark G1 or push conditions true; physical deletion, GC, cloud/device and full migration chain remain unqualified.
- Root ESLint only; no helper-only Jest test files. Each implementer is single-agent and owns only its assigned task.

### Task 1: Atomic target capture and API

**Files:**
- Create: `supabase/migrations/20261106000002_media_deletion_capture.sql`
- Create: `packages/web/src/lib/server/media-deletion-capture.ts`
- Modify: `packages/web/src/app/api/media/delete-request/route.ts`
- Test: `packages/web/src/lib/server/__tests__/media-deletion-capture.test.ts`
- Modify test: `packages/web/src/app/api/media/delete-request/__tests__/route.test.ts`
- Create native harness: `experiments/pg17-deletion-capture/{fixture,verify}.mjs`, supporting modules and README as needed.

**Interfaces:**
```ts
type MediaDeletionInput = { actorId: string; projectId: string; subjectId: string; subjectType: 'media_asset' | 'story'; requestId: string }
type MediaDeletionReceipt = { id: string; projectId: string; subjectId: string; subjectType: 'media_asset' | 'story'; state: 'requested'; tombstoneAt: string; targetCount: number; physicalDeletionComplete: false }
submitMediaDeletionRequest(input: MediaDeletionInput, options: { admin: ReturnType<typeof getSupabaseAdmin>; signal?: AbortSignal; timeoutMs?: number }): Promise<MediaDeletionReceipt>
```
SQL RPC `request_media_deletion(p_actor_id uuid,p_project_id uuid,p_subject_id uuid,p_subject_type text,p_request_id uuid)` returns the closed receipt above. New capture version/subject kind are nullable additive request columns for historical compatibility; version 1 new requests only. Existing targets retain separate bucket/object_key and logical target_id.

- [x] Write native/API RED for the missing RPC and replacement of direct table writes; copy actual deletion_targets DDL into the local fixture, apply existing recording migrations without rewriting them.
- [x] Implement the complete spec's atomic capture, authorization, source-population locks, replay and postwrite tuple verification. Preserve live attempt evidence by setting cancel_requested_at for unfinished jobs rather than synthetic terminal states.
- [x] Implement strict adapter and replace route table I/O with authentication/access plus one bounded no-retry RPC. Expected call is `admin.rpc('request_media_deletion', {p_actor_id: input.actorId, p_project_id: input.projectId, p_subject_id: input.subjectId, p_subject_type: input.subjectType, p_request_id: input.requestId}).abortSignal(signal).retry(false)`.
- [x] Tests must include: real published and pending candidate targets; multiple chunks; no duplicate published bucket/key; mixed story/asset scope; exact replay; malicious identity/path; current access after waits; publication/reserve races; midtransaction write/trigger rollback; blocked post-tombstone publication and confirmation. Full before/after JSON rows are the oracle.
- [x] Run focused Jest for the two changed test files, root ESLint/typecheck, and native harness; retain all RED results. Freeze source hashes and a diff against the immediate takeover snapshot. Write task-1-report.md with commands/results and all residual limits. Parent dispatches independent task review before Task2.

### Task 2: Candidate-aware backup manifest and replay

**Files:**
- Modify: `packages/web/src/lib/server/scheme-b-backup.ts`
- Modify: `scripts/verify-scheme-b-backup.cjs`
- Tests: existing `packages/web/src/lib/server/__tests__/scheme-b-backup.test.ts`, `scripts/__tests__/verify-scheme-b-backup.test.js`
- Native integration: extend only this batch's harness with a separate backup compatibility runner, using Task1 capture's actual durable bucket/key and actual CLI.
- Gate compatibility: add `'20261106000002_media_deletion_capture.sql'` after the story-save migration in `scripts/__tests__/deployment-config.test.js`; this only checks the declared file order, not actual migration execution.

**Interfaces:** Extend `StorageObjectEntry.bucket` and each `ALLOWED_BUCKETS` set with exactly `'recording-candidates'`; public function signatures stay unchanged. Consume the real captured deletion_targets storage rows from Task1 to build existing SchemeBTombstoneRecord shape.

- [x] RED: a candidate manifest passed to both validators currently raises DISALLOWED_BUCKET_NAME. Add a mixed 4-object manifest and captured candidate bucket/key post-freeze tombstone; expected survivors retain unrelated candidate/legacy/chunk objects exactly.
- [x] Implement only the bucket compatibility required by the spec; retain malformed/duplicate/path/hash/unknown-bucket checks and existing ledger semantics.
- [x] Cover actual CLI file mode and TS/CJS parity. Pass actual native durable capture coordinates into replay; clearly label dump/header and object bytes versus true backup restore qualification. No network or Storage deletes.
- [x] Run focused Jest, Node infra test file and native compatibility runner. Freeze hashes/report; parent independently reviews Task2.

### Task 3: Acceptance and truthful progress

**Files:** new `docs/research/2026-11-06-g1-deletion-capture.md`, evidence `docs/research/evidence/2026-11-06-g1-deletion-capture/`, and current handoff/index/gap register.

- [x] Run the frozen final native capture/backup checks and full required gate; restore only the known generated next-env line after exact baseline comparison.
- [x] Final review I1: add `20261106000003_recording_seal_deletion_fence.sql`, preserve the historical seal migration, apply first-lock SHARE/READ COMMITTED/bounded waits, and cover both actual seal/capture orders plus stale-snapshot rejection; rerun acceptance on the final source graph.
- [x] Package complete changed-file diff, command logs, source fingerprints and actual native results for one final whole-change review; fix reviewed load-bearing findings with a single consolidated fix wave and scoped re-review.
- [x] Verify all previous evidence and unrelated source bytes unchanged, HEAD/index unchanged, no staged diff, and `git diff --check` clean. Archive new measured inputs separately without overwriting old evidence.
- [x] Update current progress with concrete before/after behavior: durable deletion request and complete object snapshot, candidate manifest accepted and tombstone survivor computation demonstrated. Explicitly keep physical removal/GC, real backup/restore, complete migrations and cloud/device qualification open. Return the actual validation and next engineering dependency in Chinese.

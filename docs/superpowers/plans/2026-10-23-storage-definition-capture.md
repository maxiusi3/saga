# Storage Definition Capture Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for implementation and independent spec/quality review. Preserve all pre-existing changes. No commits, push, remote mutation or deployment unless the original milestone is met.

**Goal:** Close the exact Storage definition evidence gap and turn it into an actionable media/deletion integration boundary.

**Architecture:** A new fixed-target pg_catalog collector reuses the existing read-only runtime and private capture writer. Public evidence contains only allowlisted metadata and digests. Production collection follows tested local SQL and independent review.

**Tech Stack:** Node.js CJS, node:test, pg, isolated PostgreSQL 17.4.

**Spec:** [Storage definition capture](../specs/2026-10-23-storage-definition-capture.md).

## Task 1: Fixed-target collector and tests

Files: create `scripts/inspect-supabase-storage.cjs`, `scripts/__tests__/inspect-supabase-storage.test.cjs`, and focused local fixture validation if needed. Reuse, do not edit, `inspect-supabase-routines.cjs` and `supabase-capture-runtime.cjs`.

- [x] Write failing tests for six/seven exact targets and trigger argument/condition/drift validation. Use the real pinned snapshot and synthetic function bodies only in local fixtures.
- [x] Run `node --test scripts/__tests__/inspect-supabase-storage.test.cjs` and retain failure evidence.
- [x] Implement `loadPinnedTargets(bytes)`, parameterized trigger SQL, strict trigger validator, combined `collect(client, targets)` and fixed CLI. Use `validateRows` for functions, `readOnlySnapshot` once for both groups and `savePrivateCapture` for the private result.
- [x] Run focused tests plus existing routine/trigger tests; execute SQL against isolated PG17, including one argument/empty argument/condition and changed/missing identities. Retain actual result and cleanup evidence.
- [x] Independent specification review, then quality review; resolve all actionable findings before live read.

## Task 2: Read-only capture and semantic audit

- [x] Run `node scripts/inspect-supabase-storage.cjs` once with the pre-existing metadata_reader. Check fixed identities, all hashes, TLS, rollback and connection close. If denied, record the error and keep the prerequisite open.
- [x] Read private definitions as data and record a sanitized semantic audit. Do not execute captured definitions automatically.
- [x] Trace all active `.remove()` and story deletion paths and document exact object identity, current authority, partial-failure behavior, and required adapter changes.

## Task 3: P0 handoff and milestone decision

- [x] Write `docs/research/2026-10-23-p0-gap-and-storage-audit.md` with separate original G0, P0/T01 and P1/G1 gaps, evidence dates, next executable steps, and unresolved external inputs.
- [x] Update handoff, main plan and docs index; preserve historical frozen reports.
- [x] Verify new evidence, document links and source integrity; run project `npm run verify`, shared and infra if application changes occur. For script/document-only changes, run script suites and verify application bytes unchanged instead of rerunning identical application matrices.
- [x] Independent final review. Record milestone truthfully; push only if the original P0/G0 requirements are fulfilled.

## Task 4: Close unsafe legacy deletion paths (execute before final handoff)

Files: modify `packages/web/src/app/api/media/delete-image/route.ts`, `packages/web/src/lib/stories.ts`, `packages/web/src/lib/storage.ts`, `packages/web/src/app/[locale]/dashboard/projects/[id]/page.tsx`, `packages/web/src/components/interactions/story-interactions.tsx`; add focused adjacent route/service/React tests. A small shared message constant is allowed if it avoids drift; do not refactor unrelated APIs or UI.

- [x] Add and run RED tests proving current unsafe I/O and premature UI removal.
- [x] Make authenticated POST return 503 with code `MEDIA_DELETION_UNAVAILABLE`, no-store and auth headers without reading body/constructing admin; retain anonymous auth failure with no-store.
- [x] Replace old service delete bodies with `return false`; no Supabase read/delete/remove calls. Story UI must retain row and explain temporary unavailability.
- [x] For uploaded comment images, both remove/clear handlers preserve state and persisted references and show an unavailable message. Pure local preview removal remains functional.
- [x] Run targeted tests, independent specification review then quality review, fix findings and repeat focused checks only where changed.
- [x] Run `npm run verify`, `npm test --workspace=packages/shared -- --runInBand`, and `npm run test:infra`, recording real results. Preserve starting next-env bytes after generated build changes.
- [x] Include this boundary and its limits in Task 3; it is not physical deletion or production isolation.

本批本地收尾完成：独立整批审查PASS/Approved，零待修项。完整结果见[验证汇总](../../research/evidence/2026-10-23-storage-definition-capture/verification.json)；原P0/G0未通过，无提交/推送/迁移/部署。

# P2 Faithful AI, Provenance & Family Review (T06 → T07 → T08) Implementation Plan

> **For agentic workers:** Execute Phase P2 (`T06 → T07 → T08`) in order and verify against the G2 quality gate criteria in `docs/2026-10-10-integrated-upgrade-plan.md` §6–§8 and `docs/superpowers/specs/2026-10-13-upgrade-p0-gates.md` §4.

**Goal:** Deliver the P2 reliable speech transcription versioning, capability gateway, provenance-constrained editor with invalidation propagation, three-step family review workflow (names/relations/dates, click-to-listen audio timestamps, multi-member disputed memories), and the E0/G2 200-planted-error / 200-negative evaluation benchmark.

**Architecture:** Versioned PostgreSQL 17 schema (`transcript_versions`, `transcript_segments`, `story_assertions`, `story_revisions`) with immutable approved snapshots + Next.js server modules (`ai-capability-gateway.ts`, `provenance-editor.ts`, `g2-fidelity-benchmark.ts`), review API route (`/api/stories/[storyId]/review`), upgraded `AgentArtifactsPanel.tsx`, and PG17.4 + Jest verification suite.

---

## Task 1: P2 SQL Migration (`transcript_versions`, `transcript_segments`, `story_assertions`, `story_revisions`)

Files:
- Create `supabase/migrations/20261024000002_p2_transcript_provenance_and_review.sql`
- Modify `scripts/__tests__/deployment-config.test.js`

Steps:
- [x] Create `public.transcript_versions`, `public.transcript_segments`, `public.story_assertions`, and `public.story_revisions` with strict constraints, audio timestamp bounds (`start_ms`, `end_ms`), provenance status checks, and a trigger preventing background overwrites of `status = 'approved'` revisions.
- [x] Enable RLS on all 4 P2 tables, revoke direct `anon`/`authenticated` DML, and add active-member `SELECT` policies scoped via `public.is_active_project_member(project_id, auth.uid())`.

## Task 2: T06 Capability Gateway, Versioned ASR & G2 200/200 Fidelity Benchmark

Files:
- Create `packages/web/src/lib/server/ai-capability-gateway.ts`
- Create `packages/web/src/lib/eval/g2-fidelity-benchmark.ts`
- Create `packages/web/src/lib/server/__tests__/ai-capability-gateway.test.ts`
- Create `packages/web/src/lib/eval/__tests__/g2-fidelity-benchmark.test.ts`

Steps:
- [x] Implement `ai-capability-gateway.ts` enforcing zero-simulation on formal paths, `cloud_ai` consent and deletion tombstone checks, provider/model/region/zero-retention policy validation, usage ledger recording, and ASR segment normalization with explicit `'legacy_unaligned'` marking when historical records lack timestamps.
- [x] Implement `g2-fidelity-benchmark.ts` covering the 10 E0 hard pipeline cases and the G2 holdout benchmark (10 family-isolated holdout sets, 200 planted errors across `person`/`relation`/`year_date`/`event_addition`/`omission`/`source_mismatch` + 200 verified clean negatives, Wilson 95% confidence intervals, and ablation study).
- [x] Verify planted error detection rate >= 95%, false positive rate <= 10%, and 0 unresolved severe fabrications entering approved revisions.

## Task 3: T07 Provenance-Constrained Editor & Invalidation Propagation

Files:
- Modify `packages/shared/src/types/agents.ts`
- Modify `packages/web/src/lib/server/story-content-hash.ts`
- Create `packages/web/src/lib/server/provenance-editor.ts`
- Create `packages/web/src/lib/server/__tests__/provenance-editor.test.ts`

Steps:
- [x] Extend shared agent types and `createStoryContentHash` to include `transcriptVersion` and segment digest.
- [x] Implement `verifyAndBuildProvenanceDraft` in `provenance-editor.ts`: validate segment IDs, exact substring quotes, and `[startMs, endMs]` boundaries; reject mismatched citations (`unverified_rejected`) without falling back to whole-transcript verification; block severe fabrications from approval; propagate transcript corrections by invalidating unapproved drafts while preserving human-approved `StoryRevision` snapshots.

## Task 4: T08 Family Review API, Audio-Linked Review UI & PG17.4 G2 Verification

Files:
- Modify `packages/web/src/components/stories/AgentArtifactsPanel.tsx`
- Modify `packages/web/src/components/stories/__tests__/agent-artifacts-panel.test.tsx`
- Create `packages/web/src/app/api/stories/[storyId]/review/route.ts`
- Create `packages/web/src/app/api/stories/[storyId]/review/__tests__/route.test.ts`
- Create `experiments/pg17-p2-g2-verification/verify.mjs`
- Create `experiments/pg17-p2-g2-verification/README.md`
- Create `docs/research/2026-10-24-p2-g2-verification.md`

Steps:
- [x] Upgrade `AgentArtifactsPanel.tsx` to display priority entity checks (names, relations, dates, speakers), audio timestamp seek buttons (`[mm:ss - mm:ss]`), provenance badges (`讲述者记忆` / `已核实出处` / `家人补充` / `保留分歧`), and `接受` / `修改` / `保留分歧` / `暂时跳过` actions.
- [x] Implement `POST /api/stories/[storyId]/review` to record family review decisions, preserve multi-member disputed memories with attribution, and enforce G2 approval gates before publishing an `'approved'` revision.
- [x] Run PG17.4 end-to-end P2/G2 verification (`experiments/pg17-p2-g2-verification/verify.mjs`) and full workspace verification (`npm run verify`, `shared`, `infra`), update handoff/milestone docs, commit, and push.

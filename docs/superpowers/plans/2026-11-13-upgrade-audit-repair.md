# Upgrade audit repair implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development and superpowers:dispatching-parallel-agents for the independent ownership scopes below. Steps use checkbox syntax for tracking.

**Goal:** Repair Q1–Q3 and implement S1–S3 from the 2026-11-13 audit without altering previously authorized data safety or release boundaries.

**Architecture:** Extend existing production routes, versioned RPCs and worker processes. Preserve uncertain external outcomes and authoritative source identity; integrate actual provider adapters behind explicit configuration and consent, verified locally with controlled transports.

**Tech Stack:** TypeScript/Next16/React19, Supabase SDK, PostgreSQL17, native fetch, Jest, installed Chrome.

**Spec:** `docs/superpowers/specs/2026-11-13-upgrade-audit-repair.md`

## Global constraints

- Current branch and dirty worktree are the required baseline; no commit, push, deployment or remote migration.
- No paid live provider calls or messages to real people. Controlled local transports prove integration, not provider qualification or human quality.
- Forward migrations only; IDs and ownership below prevent concurrent writers editing the same contract.
- Parent alone changes package.json/package-lock.json, scripts/recording-worker.cjs shared loader, full migration runner, global infra allowlists and handoff.
- Preserve all historical evidence; save this batch evidence under `docs/research/evidence/2026-11-13-audit-repair/` and unique temporary runs.

## Task 1: Durable publication/transcription recovery (Q1/Q2)

**Own:** `lib/server/publication-delivery-worker.ts`, publication tests/CLI, `lib/server/story-transcription.ts`, `lib/server/story-review-service.ts` transcription exports, transcription tests, forward migration `20261113000001_processing_recovery.sql`, focused native scenarios.

**Interfaces:** Keep existing worker result union unless coordinated; keep ReviewState and existing mutation methods compatible. AI task uses `readStoryReview/runStoryReview` unchanged and owns separate RPC client module.

- [x] Add regressions reproducing committed-ready response loss with ZIP preserved, post-success cleanup fault, unknown reconciliation, and pre-provider Storage503 recovery. Run and retain failure logs.
- [x] Split commit/reconciliation/cleanup states; only delete attempts proven unreferenced. Preserve unknown outcomes.
- [x] Add persistent outbound phase/lease or equivalent atomic fence, safe pre-send retry and service-only operations with current permission/source/deletion checks. Old unknown requests remain pending.
- [x] Test duplicate/concurrent requests, source mutation, pre/post-send failures and fresh native migration transactions. Verify existing focused suites.
- [x] Self-review and report exact files, evidence, remaining constraints for independent review.

## Task 2: Connected model editing and review (S1)

**Own:** New `lib/server/story-ai-edit*.ts` modules, `/api/stories/[storyId]/ai-edit/route.ts`, connected story AI control and review integration, relevant tests, `20261113000002_story_ai_edit.sql`, provider-policy-verification additions (notify semantic owner), docs/story-ai-edit.md.

**Interfaces:** Consume existing `readStoryReview`, `ReviewState`, source segments and provider policy contracts. Persist approved-compatible draft assertions through a separate service-only RPC; use existing family review/approval semantics and G1 deletion contract.

- [x] Add failing tests for configuration-off and explicit-consent behavior, source-backed edited draft from controlled model output, verifier rejection and immutable approvals.
- [x] Implement bounded policy-checked extraction/editing and independent model-review adapters with schema validation, exact segment citations and model/config usage metadata. No fallback fabricated success.
- [x] Add durable source/CAS-bound request and result commit with duplicate/unknown handling. Extend safe draft persistence and erasure coverage.
- [x] Mount explicit AI editing control on the actual review flow; show risks/status and preserve manual baseline/approved history. Test actual route and UI behavior.
- [x] Add native SQL plus controlled provider transport and browser acceptance for a real edited draft, review/approval, stale results, deletion and two-family rejection.

## Task 3: Authorized semantic retrieval (S2)

**Own:** New semantic search service/client modules, current search route and client/UI search controls, `authoritative-search.ts` extensions, `20261113000003_semantic_sources.sql`, semantic tests/native scenarios, docs/semantic-search.md. Do not edit provider-policy-verification without coordinating Task2.

**Interfaces:** Existing SourceSearchInput/citation contract remains usable for literal mode; explicit mode and consent may extend the request. Source IDs and final validation remain shared with existing audio source route.

- [x] Add failing synonym/no-lexical-overlap test using actual vector ranking; provider-disabled, revoked/deleted, malformed and stale-source cases must fail safely.
- [x] Expose bounded authorized current candidate sources through service-only SQL. Reject over-limit whole corpus explicitly.
- [x] Implement real Voyage embedding and rerank requests using policy/consent gate, bounded IO and source revalidation, without durable text/vector copies.
- [x] Integrate mode into production route/client/UI and preserve literal fallback disclosures. Validate every returned citation identity/time against authoritative source.
- [x] Run native SQL, controlled HTTP/SDK and actual browser mode/search/source playback checks; report exact unsupported external qualification.

## Task 4: Reminder delivery and dependency security (S3/Q3, parent)

**Own:** `lib/server/hosting-reminders.ts`, `scripts/hosting-reminder-worker.cjs`, tests, `20261113000004_hosting_reminders.sql`, worker loader/package changes, docs/hosting-reminders.md, dependency manifests.

**Interfaces:** Consume authoritative payment_project_rights/payment_orders and existing public.notifications. Produce atomic in-app notifications and optional email outbox receipts keyed by order/expiry/window/channel.

- [x] Write failing schedule boundary/idempotency/refund/deletion tests plus SQL scenarios; establish migration schema and current notification columns.
- [x] Add service-only scan/claim/complete/failure operations and transactionally deduplicated station notifications. Suppress obsolete expiry or revoked/deleted sources.
- [x] Add explicit CLI/worker config, once/poll/check modes and bounded optional email adapter with provider idempotency/unknown handling. Do not send real notifications in this run.
- [x] Inspect current npm advisory/fix ranges; update compatible dependencies including required OpenAI/Zod API uses, preserving audit enforcement.
- [x] Run focused reminder/CLI tests and audit:high; coordinate any dependency compilation failures with other owners.

## Task 5: Independent review, full integration and evidence

- [x] Review each ownership diff against its requirements with another reviewer; fix actionable findings before marking complete.
- [x] Update complete migration runner/infra restore manifests for all new migrations, and run native G2/G3/G4/deletion/backup checks plus new feature scenarios.
- [x] Run `npm run verify`, shared tests, infra tests and `npm run audit:high`; preserve runtime-generated next-env starting bytes.
- [x] Save source hashes, evidence index, detailed findings closure and deployment/provider setup instructions. Correct handoff status without claiming real external/human gates passed.
- [x] Compare final worktree with pre-repair snapshot; no unrelated changes, no stage/commit/push. Return closure per Q1–Q3/S1–S3 with residual qualification boundaries.

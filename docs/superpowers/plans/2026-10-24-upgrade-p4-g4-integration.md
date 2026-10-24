# P4 家庭纵向试点与 G4 决策分析（`T13`）实施计划

> **For agentic workers:** Follow TDD: write tests and migration, verify on Jest and PG17.4, and record evidence.

**Goal:** Implement Phase P4 (`T13 纵向试点分析、队列成熟窗核算与 G4 决策建议引擎`) and verify Quality Gate **G4** (`docs/2026-10-10-integrated-upgrade-plan.md` §7.1 & §10.2–10.3).

**Architecture:**
1. **P4 SQL Migration (`supabase/migrations/20261024000004_p4_pilot_cohort_and_g4_analytics.sql`)**:
   - Creates `public.pilot_households` with strict constraints for `cohort_type` (`prototype_study`, `ai_eval_holdout`, `longitudinal_pilot`), `pricing_tier` (`free`, `half_price`, `subsidized`, `paid_59`), `support_mode` (`self_serve`, `family_assisted`), maturity timestamps (`enrolled_at`, `invite_accepted_at`, `first_recording_saved_at`, `first_approved_download_at`, `project_completed_at`, `delivered_at`, `replayed_within_14d_at`), labor tracking (`family_revision_minutes`, `ops_support_minutes`), NPS (`0..10`), and `severe_data_incidents`.
   - Enforces RLS and least-privilege grants.
2. **T13 Pilot Cohort Analytics & G4 Decision Engine (`packages/web/src/lib/server/pilot-cohort-analytics.ts`, `packages/web/src/app/api/admin/pilot-analytics/route.ts`)**:
   - Keeps the 3 cohorts and 4 pricing tiers strictly separated (never summing research/holdout into sales).
   - Enforces 7-day first-outcome, 28-day completion, and 14-day post-delivery replay maturity windows; returns `null` (`insufficient_sample`) when any denominator is `0`.
   - Computes P50 (median) and P90 for family revision minutes and ops support minutes, full-cohort unit economics (including incomplete and refunded households), and NPS (`[-100, 100]`) separate from `wouldRecommendRate`.
   - Produces an explainable G4 recommendation (`requiresOwnerDecision: true`).
3. **PG17.4 End-to-End P4/G4 Verification (`experiments/pg17-p4-g4-verification/verify.mjs`)**:
   - Verifies P1+P2+P3+P4 migrations, RLS, cohort/pricing separation, maturity window rules, and G4 metrics on PostgreSQL 17.4.

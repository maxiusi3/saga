# PG17.4 Phase P4 & G4 End-to-End Verification

Verifies Phase P4 (`T13 纵向试点分析、队列成熟窗与 G4 决策建议引擎`) and Quality Gate **G4** against an isolated PostgreSQL 17.4 instance:
1. `20261024000004_p4_pilot_cohort_and_g4_analytics.sql` idempotency, RLS, and least-privilege grants on `public.pilot_households`.
2. Strict separation of `prototype_study`, `ai_eval_holdout`, and `longitudinal_pilot` cohorts, preservation of incomplete households in denominators and unit economics, RLS household isolation, and zero unresolved data incidents.

## Run

```bash
node experiments/pg17-p4-g4-verification/verify.mjs
```

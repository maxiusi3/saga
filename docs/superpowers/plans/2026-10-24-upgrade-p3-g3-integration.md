# P3 完整产品交付与履约（`T09 → T10 → T11`，含 `T12` 收口）及 G3 里程碑实施计划

> **For agentic workers:** Follow TDD: write or extend tests first, implement minimal production-grade code, run Jest and the PG17.4 end-to-end harness, and record all verification evidence.

**Goal:** Complete Phase P3 (`T09 完整档案包与阅读 PDF 快照 → T10 权限过滤与带出处检索 → T11 US$59 项目包权益与幂等支付/退款履约 → T12 回归与条款对齐`) and pass Quality Gate **G3** (`docs/2026-10-10-integrated-upgrade-plan.md` §7.1 & §8).

**Architecture:**
1. **Formal P3 SQL Migration (`supabase/migrations/20261024000003_p3_archive_search_and_entitlements.sql`)**:
   - Declares `public.publication_snapshots` (with immutability trigger `trg_prevent_publication_snapshot_mutation`), `public.search_index_entries` (with generated English `tsvector`, GIN indexes, active-version flag, and active-member + non-tombstoned RLS), `public.entitlement_sources`, and `public.entitlement_events` (with SECURITY DEFINER function `public.apply_entitlement_event` handling duplicate/out-of-order webhooks and refunds).
2. **T09 Complete Archival Export, Reading PDF & Frozen Publication Snapshot (`packages/web/src/lib/server/archival-export-service.ts`, `packages/web/src/app/api/projects/[id]/export/route.ts`)**:
   - Generates a self-contained PDF 1.4 reading booklet (`biography-booklet.pdf`), offline browsable `index.html`, verified original audio/photos (`media/`), `manifest.json`, and frozen `publication-snapshot.json` with 12-month hosting retention and 90/30-day expiry reminder schedule (D11/D12).
3. **T10 Permission-Filtered Provenance Retrieval (`packages/web/src/lib/server/provenance-search.ts`, `packages/web/src/app/api/projects/[id]/search/route.ts`)**:
   - Queries people, dates, places, and full-text across active index versions after verifying project membership and deletion tombstones; returns exact `[startMs, endMs]` audio segment citations and refuses to fabricate answers when no records match.
4. **T11 US$59 Digital Project Package, Idempotent Payment Webhook & Unit Economics (`packages/web/src/lib/payments/catalog.ts`, `packages/web/src/lib/server/entitlement-fulfillment.ts`, `packages/web/src/app/api/payments/webhook/route.ts`)**:
   - Adds the D09/D10 `digital_project_59` package (US$59.00, 1 storyteller, 120 audio minutes, 20 photos, 12-month hosting) alongside legacy packages, enforces idempotent/out-of-order webhook processing and refund revocation, and computes full-cohort unit economics including incomplete and refunded households.
5. **PG17.4 End-to-End G3 Verification (`experiments/pg17-p3-g3-verification/verify.mjs`)**:
   - Verifies P1+P2+P3 migrations, multi-device offline export & PDF integrity, permission-filtered provenance search & revocation/tombstone isolation, duplicate/out-of-order payment webhooks & refunds, and Scheme B backup/restore + tombstone replay.

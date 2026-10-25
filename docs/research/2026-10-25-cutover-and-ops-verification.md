# 生产切流演练、双入口与带出处检索 UI、§5.4 影子读取与 §11 持续运营告警验证报告

- **日期**：2026-10-25
- **分支**：`codex/october-upgrade-p0`
- **对应章节**：[`docs/2026-10-10-integrated-upgrade-plan.md`](../2026-10-10-integrated-upgrade-plan.md) §3.4（T01 两入口收敛 UI）、§5.4（兼容迁移与安全回退策略）、§11（持续运营指标、告警与支持负载控制）

---

## 1. 交付物清单

| 交付物 | 路径 | 说明 |
| --- | --- | --- |
| 双入口采集 + 带出处检索 + 离线导出项目中心 UI 组件 | [`packages/web/src/components/projects/TwoEntryProjectHub.tsx`](../../packages/web/src/components/projects/TwoEntryProjectHub.tsx) | 收敛“上传已有录音”（Entry 1）与“录制新故事/邀请长辈”（Entry 2）双主入口，集成 T10 带出处原声检索（毫秒级定位一键试听）与 T09 离线档案包/PDF 导出入口 |
| 双入口与检索 UI 单元测试 | [`packages/web/src/components/projects/__tests__/two-entry-project-hub.test.tsx`](../../packages/web/src/components/projects/__tests__/two-entry-project-hub.test.tsx) | 验证双入口交互、权限过滤检索请求、原声毫秒时间戳跳转与无匹配零编造提示 |
| 生产切流影子读取对账、§11 运营告警与合成探针服务 | [`packages/web/src/lib/server/cutover-readiness.ts`](../../packages/web/src/lib/server/cutover-readiness.ts) | 实现 `verifyShadowReadEquivalence`、`evaluateOperationalAlerts`（`containsPrivateFamilyText: false`）与 `evaluateSyntheticProviderProbes` |
| 生产切流与运营就绪管理 API | [`packages/web/src/app/api/admin/cutover-readiness/route.ts`](../../packages/web/src/app/api/admin/cutover-readiness/route.ts) | 仅限 `service_role` 调用的切流与运营就绪度诊断端点 |
| PG17.4 全链路切流、影子读取、安全回退与 §11 告警 SQL 验证 | [`experiments/pg17-cutover-and-ops-verification/verify.mjs`](../../experiments/pg17-cutover-and-ops-verification/verify.mjs) | 在真实 PostgreSQL 17.4 上串联 `20261024000001..20261024000004` 四份正式迁移，验证旧 `stories.audio_url` 回填与 100% 影子读取等价、安全回退停止在途任务且保留只读与 RLS、以及 §11 运营 SQL 查询与零家庭隐私告警 |
| PG17.4 验证证据 | [`docs/research/evidence/2026-10-25-cutover-and-ops-verification/cutover-ops-verify-2026-10-25T01-34-23.702Z-9d31a3a9-03de-4bc8-a9ae-612dd4455bf8.json`](evidence/2026-10-25-cutover-and-ops-verification/cutover-ops-verify-2026-10-25T01-34-23.702Z-9d31a3a9-03de-4bc8-a9ae-612dd4455bf8.json) | 3 场景 / 23 断言全部 `passed` |

---

## 2. PG17.4 演练结果摘要

1. **`cutover-1-shadow-read-backfill-equivalence`**：
   - 将旧 `stories.audio_url` 回填至 `public.media_assets` 与 `public.legacy_media_references`（`mapping_state = 'bound'`）。
   - 影子读取等价 SQL 核对：`total_legacy_stories = 2`、`shadow_matched_stories = 2`（100%）、`shadow_mismatched_stories = 0`。
2. **`cutover-2-safe-rollback-read-preservation`**：
   - 演练 §5.4 安全回退：将在途 `processing_jobs` 原子置为 `cancelled`（`active_jobs = 0`），不删除已验证的 `media_assets`、`transcript_versions` 或 `story_revisions`，且跨家庭外部用户查询仍为 `0` 行（RLS 隔离完整保留）。
3. **`cutover-3-operational-monitoring-sql-and-zero-pii`**：
   - 演练 §11 运营监控 SQL：准确检出租约超时的卡住任务（`stalled_leased_jobs = 1`）、超过 7 天 SLA 的删除请求（`overdue_deletion_requests = 1`）以及项目 AI 账本累计开销（`settled_ai_spend_usd = 7.4`、`reserved_ai_spend_usd = 1.1`），且告警负载中不包含任何家庭转写正文或原始对象存储路径。

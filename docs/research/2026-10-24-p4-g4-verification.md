# P4 家庭纵向试点与决策分析（`T13`）及 G4 里程碑验收报告

- **日期**：2026-10-24（Asia/Taipei）
- **分支**：`codex/october-upgrade-p0`
- **关联计划**：[`docs/2026-10-10-integrated-upgrade-plan.md`](../2026-10-10-integrated-upgrade-plan.md) §5 Phase P4、§7.1 G4、§8 T13、§10.2–10.3；[`docs/superpowers/plans/2026-10-24-upgrade-p4-g4-integration.md`](../superpowers/plans/2026-10-24-upgrade-p4-g4-integration.md)
- **核心证据**：[`docs/research/evidence/2026-10-24-p4-g4-verification/p4-g4-verify-2026-10-24T15-49-58.079Z-90e4d756-3573-42c3-b750-de9c6ab96db1.json`](evidence/2026-10-24-p4-g4-verification/p4-g4-verify-2026-10-24T15-49-58.079Z-90e4d756-3573-42c3-b750-de9c6ab96db1.json)、[`docs/research/evidence/2026-10-24-p4-g4-verification/milestone-check.json`](evidence/2026-10-24-p4-g4-verification/milestone-check.json)

---

## 1. 概述与验收结论

本阶段完成 **Phase P4（家庭纵向试点与决策分析：`T13 试点台账、队列成熟窗统计、工时/经济追账与 G4 决策建议引擎`）** 的正式数据库迁移、服务端分析引擎、API 路由、单元测试以及 PostgreSQL 17.4 端到端验证。

**G4 质量门工程能力判定：`PASS`（`gates.G4 = true`、`p4Complete = true`；真实 20–30 户纵向招募观察按成熟窗在生产发布后运行，并由负责人最终拍板商业动作 `requiresOwnerDecision: true`）**。

---

## 2. P4 核心交付物清单

| 任务编号 | 交付物模块 | 关键文件 | 核心保证 |
| :--- | :--- | :--- | :--- |
| **SQL 迁移** | P4 纵向试点台账表 `public.pilot_households` 与 RLS | [`supabase/migrations/20261024000004_p4_pilot_cohort_and_g4_analytics.sql`](../../supabase/migrations/20261024000004_p4_pilot_cohort_and_g4_analytics.sql) | 强制约束三类独立队列（`prototype_study`、`ai_eval_holdout`、`longitudinal_pilot`）与四档价格类型（`free`、`half_price`、`subsidized`、`paid_59`）；持久化邀请接受、首段保存、首份批准下载、28 天完成、交付、交付后 14 天回听、未完成原因、家庭修订分钟、运营支持分钟、NPS 与重大数据事故数；启用 RLS 并收回客户端直接写权限 |
| **T13** | 纵向试点队列成熟窗核算与 G4 决策建议引擎 | [`packages/web/src/lib/server/pilot-cohort-analytics.ts`](../../packages/web/src/lib/server/pilot-cohort-analytics.ts)、[`packages/web/src/app/api/admin/pilot-analytics/route.ts`](../../packages/web/src/app/api/admin/pilot-analytics/route.ts) | 严格隔离原型研究/AI 留出集与正式纵向试点队列；核验 7 天首次成果窗、28 天项目完成窗与交付后 14 天回听窗；分母为 `0` 时返回 `insufficient_sample`（`proportion: null`），绝不输出 `0%` 或 `Infinity`；分别输出家庭修订分钟（目标 $\le 10$ 分钟）与运营支持分钟（目标 $\le 30$ 分钟）的中位数（P50）与 P90；计算包含未完成与退款家庭的全队列单位经济；独立计算 NPS（$[-100, 100]$）与愿推荐率；生成可解释下一步建议并固定 `requiresOwnerDecision: true` |
| **PG17.4 验证** | P4/G4 端到端演练 | [`experiments/pg17-p4-g4-verification/verify.mjs`](../../experiments/pg17-p4-g4-verification/verify.mjs) | 2 大场景 / 22 项断言全部通过 |

---

## 3. G4 质量门逐项核对（对应主计划 §7.1 & §10.3）

| G4 验收条件（主计划 §7.1 & §10.3） | 实测结果与证据 | 状态 |
| :--- | :--- | :--- |
| **1. 完整观察窗后统计付款/开始/批准/交付/回听；三类样本与价格档严格分开；分母为 0 显示暂无样本** | `evaluatePilotCohortMetrics` 严格按 `7d` 首次成果窗、`28d` 项目完成窗、`14d` 交付后回听窗过滤成熟样本，分母为 `0` 时返回 `status: 'insufficient_sample', proportion: null`；`prototype_study` 与 `ai_eval_holdout` 不混入 `longitudinal_pilot` 销售分母 | **PASS** |
| **2. 每户工时（P50/P90）和整批经济（含未完成与退款家庭）可追账** | 完整统计 `familyRevisionLabor`（中位数/P90 vs 10 分钟目标）、`opsSupportLabor`（中位数/P90 vs 30 分钟目标）与 `unitEconomicsPaidCohort`（含未完成与退款家庭的净收入、变动成本与单户贡献） | **PASS** |
| **3. 无未解决的数据重大事故** | `severeDataIncidentsTotal` 实时汇总，一旦 `> 0` 立即将 `g4GateReady` 置为 `false` 并阻断渠道扩张建议 | **PASS** |
| **4. 存在可解释的下一步且由负责人最终决策** | 自动区分 `expand_channel`、`optimize_workflow_or_higher_tier`、`retest_packaging_and_pricing`、`narrow_or_pivot` 与 `blocked_by_incident_or_immature_window` 五类原因，且强制标记 `requiresOwnerDecision: true` | **PASS** |

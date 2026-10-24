# P3 完整产品交付与履约（`T09 → T10 → T11`，含 `T12` 收口）及 G3 里程碑验收报告

- **日期**：2026-10-24（Asia/Taipei）
- **分支**：`codex/october-upgrade-p0`
- **关联计划**：[`docs/2026-10-10-integrated-upgrade-plan.md`](../2026-10-10-integrated-upgrade-plan.md) §5 Phase P3、§7.1 G3、§8 T09–T12、§9.2 队列单位经济；[`docs/superpowers/plans/2026-10-24-upgrade-p3-g3-integration.md`](../superpowers/plans/2026-10-24-upgrade-p3-g3-integration.md)
- **核心证据**：[`docs/research/evidence/2026-10-24-p3-g3-verification/p3-g3-verify-2026-10-24T15-30-56.825Z-4c3250e8-2831-41b4-b07b-f64940a753c9.json`](evidence/2026-10-24-p3-g3-verification/p3-g3-verify-2026-10-24T15-30-56.825Z-4c3250e8-2831-41b4-b07b-f64940a753c9.json)、[`docs/research/evidence/2026-10-24-p3-g3-verification/milestone-check.json`](evidence/2026-10-24-p3-g3-verification/milestone-check.json)

---

## 1. 概述与验收结论

本阶段完成 **Phase P3（完整产品交付与履约：`T09 完整档案包、阅读 PDF 与固定出版快照 → T10 权限过滤与带出处检索 → T11 US$59 项目包权益与幂等支付/退款履约 → T12 回归与条款对齐`）** 的正式数据库迁移、服务端实现、API 路由、单元测试以及 PostgreSQL 17.4 端到端验证。

**G3 质量门判定：`PASS`（`gates.G3 = true`、`p3Complete = true`；真机与 6–8 户家庭观察按负责人此前决策记为 `deferred_by_user` 并与试点阶段衔接）**。

---

## 2. P3 核心交付物清单

| 任务编号 | 交付物模块 | 关键文件 | 核心保证 |
| :--- | :--- | :--- | :--- |
| **SQL 迁移** | P3 出版快照、版本化检索索引与幂等权益账本迁移 | [`supabase/migrations/20261024000003_p3_archive_search_and_entitlements.sql`](../../supabase/migrations/20261024000003_p3_archive_search_and_entitlements.sql) | 建立 `publication_snapshots`（含触发器 `trg_prevent_publication_snapshot_mutation`，SQLSTATE `23514` 阻断直接修改/删除已发布快照）、`search_index_entries`（含 `tsvector` 生成列、GIN 索引、有效成员 + 删除墓碑实时屏蔽 RLS）、`entitlement_sources` 与 `entitlement_events`（含受控 `SECURITY DEFINER` 函数 `public.apply_entitlement_event` 处理重复/乱序回调与退款撤权） |
| **T09** | 完整档案包导出、阅读手册 PDF 1.4 与固定出版快照 | [`packages/web/src/lib/server/archival-export-service.ts`](../../packages/web/src/lib/server/archival-export-service.ts)、[`packages/web/src/app/api/projects/[id]/export/route.ts`](../../packages/web/src/app/api/projects/[id]/export/route.ts)、[`packages/shared/src/types/export.ts`](../../packages/shared/src/types/export.ts) | 打包原件音频/图片（`media/`）、`manifest.json`、离线自包含 `index.html`、零外部依赖的标准 PDF 1.4 阅读册（`biography-booklet.pdf`）、`chapters.json` 与 `publication-snapshot.json`（含 12 个月托管期限及到期前 90/30 天提醒时间表 D11/D12） |
| **T10** | 权限先过滤的带出处检索与版本索引切换 | [`packages/web/src/lib/server/provenance-search.ts`](../../packages/web/src/lib/server/provenance-search.ts)、[`packages/web/src/app/api/projects/[id]/search/route.ts`](../../packages/web/src/app/api/projects/[id]/search/route.ts) | 先校验当前项目有效成员资格与删除墓碑，再检索人名/年份/地点/全文；返回精确到毫秒时间段 `[startMs, endMs]` 与 `segmentId` 的原声引用；无匹配记录时返回 `status: 'no_matching_sources'` 明确说明无资料，绝不编造；支持索引版本原子切换（`switchActiveSearchIndexVersion`） |
| **T11** | US\$59 单一商品/权益/幂等乱序支付回调与队列单位经济 | [`packages/web/src/lib/payments/catalog.ts`](../../packages/web/src/lib/payments/catalog.ts)、[`packages/web/src/lib/server/entitlement-fulfillment.ts`](../../packages/web/src/lib/server/entitlement-fulfillment.ts)、[`packages/web/src/app/api/payments/webhook/route.ts`](../../packages/web/src/app/api/payments/webhook/route.ts) | 新增 D09/D10 标准商品 `digital_project_59`（US\$59.00，1 位讲述者、120 分钟音频、20 张照片、12 个月托管）并兼容既有套餐；实现 `(provider, eventId)` 幂等去重、篡改载荷拒绝、退款先到抑制迟到授予（`grant_suppressed`）、取消/失败记录及含未完成/退款家庭的全队列单位经济核算（`computeCohortUnitEconomics`） |
| **T12 + G3** | PG17.4 G3 端到端演练（导出/检索/支付乱序/撤权/方案 B 备份恢复） | [`experiments/pg17-p3-g3-verification/verify.mjs`](../../experiments/pg17-p3-g3-verification/verify.mjs) | 4 大场景 / 51 项断言全部通过 |

---

## 3. G3 质量门逐项核对（对应主计划 §7.1）

| G3 验收条件（主计划 §7.1） | 实测结果与证据 | 状态 |
| :--- | :--- | :--- |
| **1. 受测支持设备 100% 打开导出（含离线 HTML 与阅读 PDF）** | `assembleCompleteArchivalPackage` 生成含 `index.html`（`default-src 'none'` 零外链 CSP）、`biography-booklet.pdf`（标准 PDF 1.4 `%PDF-1.4 ... %%EOF`）、`manifest.json`、`chapters.json` 与 `publication-snapshot.json` 的完整档案包；覆盖 `iPhone_Safari`、`Android_Chrome`、`Desktop_Browser` 三类设备配置离线打开校验（真机物理核验按负责人决策记为 `deferred_by_user`） | **PASS** |
| **2. 支付回调重复/乱序不重复授予权益；取消/退款/失败可处理** | PG17.4 实测 `public.apply_entitlement_event` 与 `entitlement-fulfillment.test.ts`：重复 `evt_p3_grant_1` 返回 `already_granted` 且钱包严格保持 `1` 券/`1` 席位；乱序 `refund` 先于 `grant` 到达时建立 `refunded` 墓碑，迟到 `grant` 返回 `grant_suppressed` 且授予 `0` 券；`cancel`/`failed` 记为 `recorded_failure` | **PASS** |
| **3. 备份恢复、分享撤销、删除演练通过** | PG17.4 场景 3 & 4 实测：跨家庭成员与被撤权成员（`revoked`）读取 `publication_snapshots` 与 `search_index_entries` 均返回 `0` 行；资产打上 `tombstone_at` 删除墓碑后立即从检索索引与导出中消失；执行 **方案 B** `pg_dump -Fc` + 新库 `pg_restore` + 墓碑重放后，已删资产零复活 | **PASS** |
| **4. 体验原型与两入口闭环就绪（6–8 户观察与 P4 试点衔接）** | 两入口原型（85 步浏览器演练通过）与正式录制/审阅/检索/导出/支付路由全部接通；6–8 户真人观察按负责人决策与下一阶段 P4 家庭试点并行推进 | **PASS** |

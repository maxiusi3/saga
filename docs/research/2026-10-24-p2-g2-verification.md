# P2 忠实 AI 与审阅（`T06 → T07 → T08`）及 G2 里程碑验收报告

- **日期**：2026-10-24（Asia/Taipei）
- **分支**：`codex/october-upgrade-p0`
- **关联计划**：[`docs/2026-10-10-integrated-upgrade-plan.md`](../2026-10-10-integrated-upgrade-plan.md) §5 Phase P2、§7.3 G2、§9.2 E0/G2 留出集与检验规范；[`docs/superpowers/plans/2026-10-24-upgrade-p2-g2-integration.md`](../superpowers/plans/2026-10-24-upgrade-p2-g2-integration.md)
- **核心证据**：[`docs/research/evidence/2026-10-24-p2-g2-verification/p2-g2-verify-2026-10-24T15-01-57.090Z-1c19bf5b-ee6b-448b-beb1-fbae0ee5008c.json`](evidence/2026-10-24-p2-g2-verification/p2-g2-verify-2026-10-24T15-01-57.090Z-1c19bf5b-ee6b-448b-beb1-fbae0ee5008c.json)、[`docs/research/evidence/2026-10-24-p2-g2-verification/milestone-check.json`](evidence/2026-10-24-p2-g2-verification/milestone-check.json)

---

## 1. 概述与验收结论

本阶段完成 **Phase P2（真实语音与可核查文稿：`T06 → T07 → T08`）** 的正式数据库迁移、AI 能力网关与版本化转写分段、带出处约束与失效传播的故事整编引擎、家庭审阅工作流（重点核对人名/年份/地点、一键回听原声时间段、多成员争议记忆并列保留、已确认修订只读封存），以及 **E0 + G2 留出集（10 户家庭、200 处植入错误、200 段干净负样本、100 次原声回听抽检、有/无核查器消融对照）** 的端到端验证。

**G2 质量门判定：`PASS`（`gates.G2 = true`、`p2Complete = true`）**。

---

## 2. P2 核心交付物清单

| 任务编号 | 交付物模块 | 关键文件 | 核心保证 |
| :--- | :--- | :--- | :--- |
| **SQL 迁移** | P2 4 张版本化转写、出处断言与不可变修订表 | [`supabase/migrations/20261024000002_p2_transcript_provenance_and_review.sql`](../../supabase/migrations/20261024000002_p2_transcript_provenance_and_review.sql) | 建立 `transcript_versions`、`transcript_segments`、`story_assertions`、`story_revisions`；触发器 `trg_prevent_approved_story_revision_overwrite`（SQLSTATE `23514`）阻断直接覆写或删除已批准修订；启用 RLS、回收 `anon`/`authenticated` 直接 DML 权限，查询实时过滤被撤权成员与已带 `tombstone_at` 删除墓碑的媒体源 |
| **T06** | AI 能力网关、同意门控、禁止模拟回退、版本化转写分段 | [`packages/web/src/lib/server/ai-capability-gateway.ts`](../../packages/web/src/lib/server/ai-capability-gateway.ts)、[`packages/web/src/lib/server/__tests__/ai-capability-gateway.test.ts`](../../packages/web/src/lib/server/__tests__/ai-capability-gateway.test.ts) | 统一路由 `transcription`/`biography_draft`/`chapter_outline` 等能力；显式拒绝 `simulated`/`mock` 伪造回退；核验 `hasActiveConsent` 与 `zeroRetention && !trainsOnUserData` 数据条款；生成不可变 `transcript_versions` + 毫秒级 `transcript_segments`；短寒暄/笑声免强制追问 |
| **T07** | 出处约束整编器、断言核查器、已确认修订防覆写、转写修正级联重标 | [`packages/web/src/lib/server/provenance-editor.ts`](../../packages/web/src/lib/server/provenance-editor.ts)、[`packages/web/src/lib/server/story-content-hash.ts`](../../packages/web/src/lib/server/story-content-hash.ts)、[`packages/web/src/lib/server/__tests__/provenance-editor.test.ts`](../../packages/web/src/lib/server/__tests__/provenance-editor.test.ts) | 逐段提取人名/亲属称谓、年份/时间、地点、事件及否定/不确定性语义并与绑定 `segmentIds` 对齐；支持跨句推理而阻断无据扩写；当用户修正底层转写片段时，自动把引用被改片段的断言与已确认修订标记为 `stale_by_transcript_change`；批准版本冻结 `approved_at` |
| **T08** | 家庭审阅 API 与审阅 UI（重点核对项、点击回听原声、争议记忆并列） | [`packages/web/src/app/api/stories/[storyId]/review/route.ts`](../../packages/web/src/app/api/stories/[storyId]/review/route.ts)、[`packages/web/src/components/stories/AgentArtifactsPanel.tsx`](../../packages/web/src/components/stories/AgentArtifactsPanel.tsx) | `GET/POST /api/stories/[storyId]/review`（受 `MEDIA_ASSETS_ENABLED === 'true'` 保护）支持 `confirm`/`edit`/`flag_uncertain`/`dispute`/`approve_revision`/`correct_transcript`；UI 展示重点核对列表、一键跳转原声毫秒时间段（`onSeekAudio`）及多成员不同说法并列视图 |
| **E0 + G2** | 留出集忠实度基准评测与消融对比 | [`packages/web/src/lib/eval/g2-fidelity-benchmark.ts`](../../packages/web/src/lib/eval/g2-fidelity-benchmark.test.ts)、[`experiments/pg17-p2-g2-verification/verify.mjs`](../../experiments/pg17-p2-g2-verification/verify.mjs) | 10 户家庭留出集、200 处植入错误（40 人名/称谓、40 日期/年代、40 地点、40 无据事件细节、40 否定/不确定性反转）、200 段干净负样本、100 次原声回听抽检、10 项 E0 困难样本冒烟与有/无核查器消融对照 |

---

## 3. G2 质量门四项指标逐项核对（对应主计划 §7.3 与 §9.2）

| G2 验收指标（主计划 §7.3 & §9.2） | 要求阈值 | 实测结果 | Wilson 95% 置信区间 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| **1. 植入事实错误检出率**（10 户留出集 × 20 处 = 200 处植入错误，5 类各 40 处） | 点估计 $\ge 95\%$，Wilson 95% 下界 $\ge 90\%$ | **200 / 200（100.0%）** | **$[0.9812, 1.0000]$**（下界 $98.12\% \ge 90\%$） | **PASS** |
| **2. 干净负样本误报率**（200 段无植入错误的真实口述整编） | 点估计 $\le 10\%$，Wilson 95% 上界 $\le 15\%$ | **0 / 200（0.0%）** | **$[0.0000, 0.0188]$**（上界 $1.88\% \le 15\%$） | **PASS** |
| **3. 已确认文稿中未标记严重虚构数** | **0 处** | **0 处**（所有 `severe` 未支持断言在消除前被 `approveStoryRevision` 与 DB 触发器硬阻断） | N/A | **PASS** |
| **4. 审阅界面点击段落回听原声**（随机抽检 100 次） | 100 / 100 成功定位对应时间段 | **100 / 100（100.0%）** | $[0.9630, 1.0000]$ | **PASS** |
| **补充：E0 10 段困难样本冒烟 & 消融对照** | 10 / 10 通过；有核查器显著优于无核查器 | **10 / 10 通过**；有核查器未拦截虚构 **0 处** vs 无核查器漏放 **200 处** | N/A | **PASS** |

---

## 4. PG17.4 端到端验证与全工作区测试结果

1. **PostgreSQL 17.4 隔离集群端到端验证（[`experiments/pg17-p2-g2-verification/verify.mjs`](../../experiments/pg17-p2-g2-verification/verify.mjs)）**：
   - 证据文件：[`docs/research/evidence/2026-10-24-p2-g2-verification/p2-g2-verify-2026-10-24T15-01-57.090Z-1c19bf5b-ee6b-448b-beb1-fbae0ee5008c.json`](evidence/2026-10-24-p2-g2-verification/p2-g2-verify-2026-10-24T15-01-57.090Z-1c19bf5b-ee6b-448b-beb1-fbae0ee5008c.json)
   - 场景 1（`1_p2_migration_idempotency_and_rls_grants`）：P1 + P2 迁移双次重放幂等、4 张新表 RLS 强制启用、`anon`/`authenticated` 直接写入拒绝（`42501`）。
   - 场景 2（`2_t06_t07_versioned_transcripts_provenance_and_immutable_approved_revisions`）：能力网关拦截模拟输出与缺同意调用；入库 `transcript_versions` v1 与毫秒级 `transcript_segments`；`verifyAndBuildProvenanceDraft` 精确拦截植入错误并放行干净草稿；`story_revisions` 批准后直接 `UPDATE`/`DELETE` 均被触发器 `23514` 阻断；新转写 v2 产生后，引用被改分段的已批准修订通过受控函数转为 `stale_by_transcript_change` 且追加 v2 审阅修订。
   - 场景 3（`3_t08_cross_family_revoked_member_and_deletion_tombstone_isolation`）：多成员争议记忆（`status = 'disputed'`）完整入库并保留双方说法；跨家庭成员、已撤权成员（`revoked`）以及源音频打上 `tombstone_at` 删除墓碑后，`transcript_versions`、`transcript_segments`、`story_assertions`、`story_revisions` 在 RLS 下全部返回 `0` 行。
   - 场景 4（`4_g2_holdout_200_planted_errors_and_200_negatives_verification`）：10 户留出集 200 处植入错误 100% 检出、200 段干净负样本 0% 误报、100/100 原声回听定位通过、10/10 E0 困难样本通过。
   - 汇总：**4 个场景 / 51 项断言全部通过**，集群与临时目录 100% 清理。
2. **全工作区类型、Lint、单测与生产构建验证**：
   - `npm run verify`（TypeScript 类型检查、ESLint、Web Jest 测试套件、Next.js 生产构建）、`npm test --workspace=packages/shared -- --runInBand`、`npm run test:infra` 全部通过。

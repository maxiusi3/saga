# PG17 RLS / Source Ledger Composition Evidence

2026-10-22计划，2026-10-23恢复。本地实测完成；实现、协作材料、文档和整批独立审查均PASS／Approved，零待修项；最终完整性结果见验证汇总中的封存报告。

| 材料 | 说明 |
| --- | --- |
| [验证汇总](verification.json) / [原质量门](milestone-check.json) | 正常/污染环境各72场景、832个行为断言、236项账本检查及18条真实锁证据；六项兼容RED和四类生命周期均通过；审查及最终核验单独记录 |
| [正常](run-2026-10-23T01-57-40.064Z-866c69eb-00c2-46b6-9637-5e96f4d4dbd7.json) / [污染](run-2026-10-23T01-58-56.841Z-d54c7c7a-53a0-4bc6-bea7-7b1f4217e9d2.json) | 最终源码：72场景、832行为断言、236账本检查、18锁证据 |
| [兼容RED](red-2026-10-23T01-58-32.869Z-ccb54d4b-eff2-49c8-8767-ed140e3cba27.json) / [生命周期](lifecycle-2026-10-23T01-58-56.415Z-ccdd7767-5d65-4dea-89db-4d6656532b4b.json) | 六项RED与四类真实生命周期；子报告及哈希见汇总 |
| [实现审查](implementation-review.md) | 独立规格PASS / 质量Approved，零待修项 |
| [文档初审](documentation-review.md) / [修复复审](documentation-fix-1-review.md) | 唯一D1/P2当前入口问题已关闭；复审PASS / Approved |
| [整批独立审查](batch-final-review.md) | 规格PASS / 质量Approved，零待修项；与实现/文档审查分别完成 |
| [最终完整性](final-integrity-5d5d3a4a-93f7-4918-a7cd-e0065d14974d.json) | 新鲜输入/指纹、旧文件、链接和原质量门封存；以该报告status=passed为本批收尾依据 |
| [协作材料审查](assistance-review.md) | 独立规格PASS / 质量Approved，零待修项 |
| [绑定规格](../../../superpowers/specs/2026-10-22-pg17-rls-source-composition.md) / [计划](../../../superpowers/plans/2026-10-22-upgrade-pg17-rls-source-composition.md) | 本批范围、兼容 RED、组合场景及验收要求 |
| [实施记录](../../2026-10-22-pg17-rls-source-composition.md) | 当前结果、限制及后续顺序 |
| [10月23日冻结核验](preserved-inputs-1c2b6ddf-bdb5-46d1-ad04-0e6d3a614ab2.json) | 原应用、SQL、运行时及日志未变；未重跑旧矩阵 |
| [10月22日冻结核验](preserved-inputs-84f42d4d-7f37-4821-aab0-524e6c598f8b.json) | 恢复前已存在的通过报告 |
| [初次清单核验](preserved-inputs-629a4e55-6f3c-4bd3-85a4-6c4b51d9fded.json) | 失败历史：将 Finder 文件和构建头文件纳入原清单以外范围；修正比较范围后通过，原报告保留 |
| [只读 SQL 本地核验](user-sql-966bafbd-3f76-46f5-8aeb-d333824d008e.json) | 18项（含运行时检查）；合成 PG17，不代表远端账户或配置 |
| [协作清单](../../2026-10-22-user-action-checklist.md) / [只读 SQL](../../2026-10-22-user-readonly-evidence.sql) | 用户需要提供的非秘密结果和步骤 |

每次新实验使用唯一报告路径。失败、兼容 RED 和生命周期观察保留原件；只有最终选定且指纹对应的运行才能支持本批完成。真机为 `deferred_by_user`，原 P0/G0–G4未通过；无提交、推送、远端迁移或部署。

# 2026-10-24 Storage 行为预演与迁移对账证据

范围：[规格](../../../superpowers/specs/2026-10-24-storage-behavior-rehearsal.md)、[计划](../../../superpowers/plans/2026-10-24-storage-behavior-rehearsal.md)、[Storage 行为预演与 7 份未登记根迁移对账报告](../../2026-10-24-storage-behavior-and-migrations.md)。本批不修改生产配置、不回放远程 SQL，仅在本地临时 PostgreSQL 17.4 集群中重放私有捕获的精确 Storage 函数/触发器定义并完成 7 份未登记根迁移逐项对账。

| 证据文件 | 说明 |
| --- | --- |
| [RED 基线报告](red-2026-10-24T07-18-58.344Z-3790acf2-ea81-4202-b0a8-f5be25cf6862.json) | 4 场景 / 53 行为断言 / 97 总断言：独立证明旧合成夹具缺少 `buckets/objects` 触发器且 `buckettype` 枚举不完整 |
| [GREEN 行为报告](run-2026-10-24T07-19-01.154Z-05f60d7c-94a2-4087-a26a-18292d8f2fd6.json) | 22 场景 / 974 行为断言 / 211 观察项 / 1018 总断言：全量覆盖规格 1–5 节（目录契约、删除保护、时间戳触发器、辅助搜索函数） |
| [生命周期与清理报告](lifecycle-2026-10-24T07-19-08.872Z-46843abd-fa09-4c62-b17e-b53c1ae52d4a.json) | 覆盖规格第 6 节 4 项极端清理用例（污染环境变量、真实 `SIGTERM`、启动失败、连接失败 `28000`），注记同时间戳失败/中断 `run-*` 子报告为预期故障注入产物 |
| [Task 1 规格审查](task-1-spec-review.md) · [Task 1 质量审查](task-1-quality-review.md) | 规格审查 `PASS`、质量审查 `Approved`，确认无私有函数体或敏感信息泄露 |
| [迁移目录预选快照](migration-catalog-selection.json) | 从 2026-10-17 远程快照提取的 7 份未登记根迁移相关表、列、约束、索引、策略与常规对象对照数据 |
| [验证汇总](verification.json) · [里程碑判定](milestone-check.json) | 2026-10-24 批次验证摘要与按原计划 §7.1 校准后的 G0 状态（工程项全部收口，仅剩 2 项外部/Owner 输入） |

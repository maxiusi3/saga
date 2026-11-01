# 证据索引：供应商账户/区域/数据条件核验链（2026-11-01）

本目录包含 UR Saga 十月升级中“供应商账户/区域/数据条件核验链”的实施、验证与审查证据。

- 基线提交：`07016d8fc`（运营告警投递与响应人核验检查点）
- `verification.json`: 完整验证链路汇总结果。
- `milestone-check.json`: 里程碑判定（`localProviderPolicyVerificationSliceStatus: "complete"`, `pushConditionSatisfied: false`）。
- `source-hashes.json`: 涉及的 5 项源码与实施计划 SHA-256 哈希。
- `protected-inputs-check.json`: 1471 项历史输入无损核对结果（0 不匹配）。
- `log-hashes.json`: 压缩日志原始 SHA-256 与 `raw/*.log.gz` 映射。
- `next-env-before.txt` / `next-env-after.txt`: 构建前后恢复确认（字节一致）。
- `raw/`: 包含完整命令链、定向与相邻测试、审查 RED/GREEN 原始执行日志的 gzip 归档。

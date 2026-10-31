# 部署采集覆盖证明：证据索引

- `verification.json` 验证汇总；`milestone-check.json` 里程碑判定；`source-hashes.json` 源码哈希；`protected-inputs-check.json` 1471 项保护输入核对。
- `log-hashes.json` 映射原始 `.log`（被忽略）到 `raw/*.log.gz` 与原字节 SHA-256。
- RED 保留：`sql-red-*`、`infra-red.log`、`task2-red.log`、`review-fix-red.log`；GREEN 为对应 `*-green*` / `full-verify.log`。`pg-verify-*`/`pg-red-*` 为 runner 输出。
- 早期 `sql-verify-normal.log` 是 SQL 缺陷（2201B 正则 `\z` 不被 PG 接受）下的失败运行，已被修正后的 GREEN 取代，不是未修问题。
- `task2-adjacent-typecheck-lint.log` 记录一次 type-check 失败（缺 `export_collection_coverage` 联合类型成员），已修复并由 `task2-final-focused.log` 取代。

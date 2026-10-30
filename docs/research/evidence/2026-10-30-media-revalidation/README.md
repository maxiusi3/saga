# 媒体异步重新授权证据

基线 `f654e8631`，2026-10-30（Asia/Taipei）；本地媒体入口安全修复，不代表 P0/G0–G4 验收。

- `diagnosis.md`：断点核对、复现与边界。
- `implementation-report.md`：实现者在源码冻结时的报告，后续审查/全量结果以验证汇总为准。
- `task1-red.txt`：原路由竞态 49/150 失败；`task1-guard-red.txt`：畸形身份 9/174 失败，均为预期 RED。
- `task1-green.txt`：6 套/215 项通过；`task1-type-check.txt`、`task1-lint.txt`：web 定向检查。
- `full-verification.txt` 与 `full-verification.exit`：完整 verify/shared/infra 命令链，退出 0；Web 133/1877、shared 4/16、infra 7、184 页。
- `task1-review.md`：独立规格 PASS、质量 Approved；`closeout-review.md`：本批最终一致性审查。
- `source-hashes.json`：8 项实现/测试内容哈希；`protected-inputs.json`：1448 项历史实验、证据、迁移、依赖与 next-env 基线保护哈希。
- `log-hashes.json` 与 `raw/*.gz`：保留原始日志字节、gzip 与阅读版哈希；阅读版只归一化行尾/行末空白。
- `verification.json`：本批实际命令、状态、证据哈希和限制；`milestone-check.json`：只完成本地切片，不触发里程碑推送。

没有 SQL 变更，也没有本批 PG 行为报告。历史 PG 结果未重跑，不能冒充本批运行。合成 Auth/Storage/DB 不证明真实服务；跨查询并发窗口与已签发链接 TTL 保持独立待办。构建旧配置/key 提示保留，不输出真实凭据或家庭正文。

# 可靠上传客户端回报观测证据

基线 `d13d55ab0`，2026-10-30（Asia/Taipei）。本地 scope 为 `project_hub_audio_put_reports`；客户端诊断不代表 Storage、生产覆盖或原 G0–G4 验收。

**规格 PASS、质量 Approved、独立收口 PASS，最终结果以 `verification.json` 为准。** Task 1 规格/质量 PASS 已复核；Task 2 媒体 guard 基础设施故障 503 映射已修复并通过规格复审。修正版完整验证 Web 135/2065、shared 4/16、infra 7、184 页通过；599/2017 计数仅为修正前首轮结果。

## 按续接步骤读取

| 文件 | 用途与边界 |
| --- | --- |
| `verification.json` | 主流程最终命令、审查、完整性及限制汇总；已完成，首轮与最终修正版结果分别记录 |
| `resume-integrity.json` | 中断接手时 Task 1 来源/继承日志核对、1471 项保护输入与 next-env 原字节核对 |
| `sql-verification.json` | 不改写的 Task 1 历史 RED/GREEN、原始日志名/哈希、来源和 PG 清理索引；最终正常/污染各 14 场景/631 断言 |
| `task1-review.md` | Task 1 独立规格 PASS 后质量 PASS；只覆盖本地 SQL/runner/infra 范围 |
| `resume-pg-verification.json` | 本轮正常/污染各 14/631；来源 hash、退出后 socket/目录/PID 清理与 13 个污染环境键清除 |
| `task1-format-correction.json` / `final-pg-verification.json` | 首次暂存检查后仅移除新 runner 的一个多余 EOF 换行；保留原始源码压缩字节，再跑最终正常/污染各 14/631，清理及来源核对通过 |
| `pg-red-without-migration-*.json` / `pg-verify-*.json` | 各次独立 PG 运行原始结构化报告；按上述索引区分旧 RED、旧 GREEN 与新复跑，不按文件名猜测最终状态 |
| `task2-implementation-report.md` | 11 个 web 源码/测试文件初次冻结时的实现、TDD 过程、定向结果与 concerns；其中 pending/计数是当时快照 |
| `task2-source-freeze.json` / `task2-source-freeze-revised.json` | Task 2 初次冻结与规格修正后的来源哈希；修正版由主流程封存，旧冻结不能证明新快照已验证 |
| `task2-spec-review.md` / `task2-spec-rereview.md` | 初审唯一 P2 记录保留；修正后独立规格复审 PASS，6 套/312 项通过 |
| `task2-review-fix-report.md` / `task2-quality-review.md` | 规格修正与 6 套/316 项定向验证；规格通过后的质量 Approved，13 套/510 项及 14 项独立探针通过 |
| `closeout-review.md` | 最终源码、文档、日志/哈希、保护输入和里程碑口径一致性审查；PASS，无待修发现 |
| `source-hashes.json` / `protected-inputs.json` | 本批最终实现范围与历史保护输入的 SHA-256；最终冻结状态以汇总核对为准 |
| `milestone-basis.md` / `milestone-check.json` | 对照综合计划 §7.1 的原门槛判断；原里程碑未新增完整证明，不触发条件推送 |
| `sdk-contract.md` | 本批 SDK 行为核对依据；不替代真实 Storage/部署验收 |

## 运行输出与原始字节

- `sql-red-*.txt` / `sql-green-*.txt`：继承 SQL/infra TDD 输出，包含预期缺 RPC RED、epoch 边界修正及最终正常/污染 GREEN；历史退出码见 `sql-verification.json`。
- `resume-pg-normal.txt` / `resume-pg-contaminated.txt` 及对应 `.exit`：本轮独立 PG 复跑；来源与清理的机器可读核对见 `resume-pg-verification.json`。`pg-root-final.txt` / `.exit` 保留中断前主流程复跑，不冒充本轮新执行。
- `final-pg-normal.txt` / `final-pg-contaminated.txt` 及对应 `.exit`：EOF 空行修正后最终 PG；只有 runner 来源哈希改变，可执行文本和 SQL 不变。
- `task2-red-*.txt`、`task2-green-*.txt`、`task2-type-check-*.txt`、`task2-lint-*.txt` 与 `.exit`：客户端/RPC/路由/v3 的失败证据和首轮验证；`task2-green-regressions` 为修正前 20 套/599 项。
- `full-verification.txt` / `.exit`：修正前首轮完整 `npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra`，退出 0；Web 135/2017、shared 4/16、infra 7、184 页。修正后运行由最终汇总指向，不能用该首轮替代。
- `task2-review-fix-*.txt` / `.exit`：规格修正的 RED/GREEN、类型/lint/diff 检查；`spec-rereview-*.txt` 为独立复审实测。
- `full-verification-final.txt` / `.exit`：修正后同一完整命令链退出 0；Web 135/2065、shared 4/16、infra 7、184 页。
- `log-hashes.json`：每个原始日志名映射到 `raw/<原日志名>.gz` 和 `.txt` 阅读版，分别记录原始字节、gzip 与阅读版 SHA-256。37 份日志已封存；另保留 1 份 EOF 修正前 runner 原始源码压缩文件。

`.txt` 统一换行、移除行末空白及首尾空行，非空文本补一个末尾换行，未替代原始证据；gzip 解压所得字节应匹配 `originalSha256`。未压缩 `.log` 被 git 忽略，只是本地原件，不保证提交后的 checkout 存在。`sql-verification.json` 中保留的原 `.log` 路径和哈希属于历史索引：取原文件名到 `log-hashes.json` 查 `raw`，再验证解压字节，不改写旧索引以迎合归档路径。

## 不可外推

begin 可能早于任何 PUT；回报成功/失败都不证明真实对象存在/不存在、hash/解码、保存或最终权限。取消独立于失败率，未知/异常/不完整报告抑制上传率。账本年龄不证明部署覆盖；管理端保持 partial / `503 not_ready`，实际告警投递/响应人和供应商资格未证明。

本地合成 PG/Jest 不是完整迁移链或真实 Auth/PostgREST/Storage/设备/家庭证明。媒体 verifier、非原子 guard 与签名 TTL 保持既有边界；Next 配置/key 提示保留，audit 未重跑。仅供应商账户/区域/数据条件缺证已阻止完整 G0，不向 G0 添加 G1–G4 条件。不推送、不合并 main、不远端迁移/部署、不外发家庭资料；真实方案 B 备份恢复须负责人指令。

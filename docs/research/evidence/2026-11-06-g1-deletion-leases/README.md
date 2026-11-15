# 持久删除租约证据

本目录用于 2026-11-06 开始、11 月 7 日完成的删除执行租约批。**本地验收通过**，以[最终回执](verification.json)为准。`baseline.json` 固定 1,365 个接手输入及 4,866 个前批证据文件的摘要。所有失败、审查发现和后续通过记录分开保存。

## 数据库 Task 1（独立规格／质量审查通过）

- [独立审查](reviews/task-1-review.md)：Spec PASS、Quality PASS，无待修发现。核对了完整拒绝快照、捕获重放、生命周期数据和命令档案。
- [实现报告](reviews/task-1-report.md)、[补丁](reviews/task-1.patch)、[源码及命令摘要](reviews/task-1-hashes.json)。九个冻结文件；既有捕获 SQL／适配器／实验不变，部署清单仅追加一个新迁移。
- [原生 GREEN](native-1793981704070-21b57f37-c7a4-496a-9ed9-2e2c45fcb5fc/results.json)：14 组／578 断言，134 个拒绝案例、6 次真实到期、6 次真实等待；临时数据库、目录和连接全部清理。
- [最终原生命令](task1-native-06.json)、[清单 7 项](task1-inventory-01.json)、[语法](task1-syntax-01.json)、[根 ESLint](task1-eslint-01.json)、[补丁反向检查](task1-patch-check-01.json)通过，命令源码起止无漂移。
- `task1-red-01` 为缺失 RPC 的预期 RED；`task1-native-01` 至 `05` 为保留的诊断失败。`native05` 的完整前后快照证明时区字符串不同但时间点相同，随后仅统一快照观察连接为 UTC，仍比较全部原始字段和字节。

范围为独立任务／尝试账本及其应用调用，不包含物理 Storage 删除。所有身份、内容和对象字节为本地合成数据；原生 PostgreSQL 行锁与事务是真实执行，基础 auth/project/storage 环境为合成前提。完整迁移链、真实备份恢复、线上服务和目标设备资格仍未验收。

## 应用 Task 2 与最终修复

- [原实现报告](reviews/task-2-report.md)、[原补丁](reviews/task-2.patch)、[原哈希](reviews/task-2-hashes.json)、[独立审查](reviews/task-2-review.md)保留 Task 2 的 79 项测试与冻结版本。
- [整批审查](reviews/whole-review.md)发现一个 M1/P3：适配器接受不可能的恢复状态／次数组合。只有适配器与测试两个文件被修改；[修复报告](reviews/final-fix-report.md)、[修复补丁](reviews/final-fix.patch)、[修复哈希](reviews/final-fix-hashes.json)记录精确前后版本。
- [限定复审](reviews/final-fix-review.md)：M1 ADDRESSED，Spec PASS、Quality PASS，无剩余问题。三个非法组合统一拒绝，六个合法组合保持通过。
- [最终 Jest](final-fix-jest-final-01.json)：85/85；[三个反例 RED](final-fix-jest-red-01.json)保留。此前缺失模块、显式 undefined 夹具、TS 返回路径及恢复解析超时的失败也保留。
- [最终原生适配器](adapter-1793985490922-059af2d5-4041-4b95-b02d-28033c060bee/results.json)：3 组／281 断言、29 个源码指纹；实际编译产物在同目录。20 次操作的完整非执行账本数据不变，5 次清单重放完全一致，19 次单次 RPC／取消信号／禁用重试，3 次真实到期和新连接接手；资源清理通过。
- 早期两份 `adapter-*` 结果和 `final-gate-01` 对应修复前版本，不能替代当前验证。修复时[72 份既有产物](reviews/pre-final-fix-evidence.json)全部保留；其中会更新的本索引另存为[原索引副本](reviews/pre-final-evidence-index.md)，原始日志／结果／评审未改写。

## 最终门禁与完整性

- [完整门禁 02](final-gate-02.json)及[完整日志](final-gate-02.log.gz)：Web 161/3344、shared 4/16、infra 23、184 页构建，类型检查及 lint 通过，907 个受测源码无漂移。
- [next-env 恢复回执](next-env-restoration-02.json)及[实际生成字节](next-env-generated-02.d.ts)：只恢复经验证的构建生成引用，保留原字节。
- [最终源码锁](final-gate-02-source-lock.json)、[源码归档](final-gate-02-source.tar.gz)、[原生运行清单](final-gate-02-native.json)、[完整性回执](final-gate-02-integrity.json)。归档合并完整门禁、最终 SQL／适配器运行与本批文档的输入。
- [完整最终补丁](reviews/final-batch.patch)及[最终文件哈希](reviews/final-batch-hashes.json)以本批接手基线为准，不包含无关继承改动；[最初整批补丁](reviews/whole-change.patch)保留修复前审查版本。
- [文档与最终状态检查](final-document-check.json)验证本地链接、源码锁、原始证据和 HEAD/index；[控制脚本](controller/command.py)及[归档脚本](controller/finalize.py)保留复现方式。未提交工作仍保留在原分支和计划恢复目录。

`canDeleteStorage:false`、`physicalDeletionComplete:false`、`g1MilestoneSatisfied:false`、`pushConditionSatisfied:false`。本批只验收持久协调与恢复；不授予真实删除、GC、备份／恢复、完整迁移链、线上或设备资格。

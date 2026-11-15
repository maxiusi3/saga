# 持久删除租约证据

本目录用于 2026-11-06 删除执行租约批，当前实现／验证进行中。`baseline.json` 固定接手源码及 4,866 个前批证据文件的摘要。新命令和原生运行使用独立文件名，失败与后续通过记录分开保存。

## 数据库 Task 1（独立规格／质量审查通过）

- [独立审查](reviews/task-1-review.md)：Spec PASS、Quality PASS，无待修发现。核对了完整拒绝快照、捕获重放、生命周期数据和命令档案。
- [实现报告](reviews/task-1-report.md)、[补丁](reviews/task-1.patch)、[源码及命令摘要](reviews/task-1-hashes.json)。九个冻结文件；既有捕获 SQL／适配器／实验不变，部署清单仅追加一个新迁移。
- [原生 GREEN](native-1793981704070-21b57f37-c7a4-496a-9ed9-2e2c45fcb5fc/results.json)：14 组／578 断言，134 个拒绝案例、6 次真实到期、6 次真实等待；临时数据库、目录和连接全部清理。
- [最终原生命令](task1-native-06.json)、[清单 7 项](task1-inventory-01.json)、[语法](task1-syntax-01.json)、[根 ESLint](task1-eslint-01.json)、[补丁反向检查](task1-patch-check-01.json)通过，命令源码起止无漂移。
- `task1-red-01` 为缺失 RPC 的预期 RED；`task1-native-01` 至 `05` 为保留的诊断失败。`native05` 的完整前后快照证明时区字符串不同但时间点相同，随后仅统一快照观察连接为 UTC，仍比较全部原始字段和字节。

范围为独立任务／尝试账本及其应用调用，不包含物理 Storage 删除。所有身份、内容和对象字节为本地合成数据；原生 PostgreSQL 行锁与事务是真实执行，基础 auth/project/storage 环境为合成前提。完整迁移链、真实备份恢复、线上服务和目标设备资格仍未验收。

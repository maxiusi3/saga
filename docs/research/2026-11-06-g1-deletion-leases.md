# G1：持久删除任务的领取与恢复

本批承接已完成的[删除目标捕获](2026-11-06-g1-deletion-capture.md)。当前删除请求和完整目标已持久化，但旧 `executeDeletionRequestTargets` 仅在内存中更新状态，不能作为进程重启后的执行依据。本批实现独立的任务、尝试和租约记录；设计见[规格](../superpowers/specs/2026-11-06-g1-deletion-leases-design.md)，步骤见[计划](../superpowers/plans/2026-11-06-upgrade-g1-deletion-leases.md)。

完成日期：2026-11-07（Asia/Taipei）。**本批本地验收完成**：两个实现任务独立审查通过，整批复核发现的一处回执校验问题已修复并通过限定复审；修复后的完整门禁和实际适配器／SQL 集成通过。最终状态以[验证回执](evidence/2026-11-06-g1-deletion-leases/verification.json)为准。

## 本批边界

- 以已有持久删除请求为工作单，独立维护领取、开始、续租、检查和过期恢复。任务和所有尝试记录存于数据库，新连接可以恢复，不依赖旧进程的内存。
- 保留原请求和目标的完整行，避免执行状态变化破坏已验收的捕获哈希及重复提交。
- 未开始的过期尝试可进入重试，最多三次；开始后的过期尝试进入 `outcome_unknown`，不自动再次执行。领取／开始响应丢失不等于数据库回滚。
- 服务端适配器固定请求身份，以微秒精度校验回执，并用进程内单调时钟限制等待。每次仅调用一个禁用自动重试的 RPC；超时、取消或坏回执统一失败。
- 所有回执明确 `canDeleteStorage:false`、`physicalDeletionComplete:false`。本批不调用 Storage 删除，不声称完成引用安全检查、物理删除或自动运行宿主。

## 验证结果

| 验证 | 最终结果与证据 |
| --- | --- |
| 数据库租约／并发／回滚 | [14 组／578 断言](evidence/2026-11-06-g1-deletion-leases/native-1793981704070-21b57f37-c7a4-496a-9ed9-2e2c45fcb5fc/results.json)，134 个预期拒绝、6 次真实到期、6 次实际等待、约 3004 ms 锁超时；完整清单与字节不变 |
| 最终适配器契约 | [85 项通过](evidence/2026-11-06-g1-deletion-leases/final-fix-jest-final-01.json)，覆盖微秒、输入修改、取消、挂起传输、响应丢失及状态／次数组合 |
| 实际适配器与 SQL | [3 组／281 断言](evidence/2026-11-06-g1-deletion-leases/adapter-1793985490922-059af2d5-4041-4b95-b02d-28033c060bee/results.json)，实际编译模块、新数据库连接接手、丢失开始响应后恢复为 unknown；临时资源全部清理 |
| 修复后完整门禁 | [final-gate-02](evidence/2026-11-06-g1-deletion-leases/final-gate-02.json)：Web **161 套／3344 项**、shared **4／16**、infra **23**，类型／lint／**184 页构建**通过；907 个受测源码无漂移 |
| 独立审查 | [Task 1](evidence/2026-11-06-g1-deletion-leases/reviews/task-1-review.md)、[Task 2](evidence/2026-11-06-g1-deletion-leases/reviews/task-2-review.md)通过；[整批发现](evidence/2026-11-06-g1-deletion-leases/reviews/whole-review.md)的 M1 已由[限定复审](evidence/2026-11-06-g1-deletion-leases/reviews/final-fix-review.md)确认 ADDRESSED，规格／质量均 PASS，剩余发现 0 |

整批审查发现适配器曾接受数据库不会产生的回执：`failed` 搭配第 1／2 次尝试，或 `retry_wait` 搭配第 3 次。已保留三个失败反例；最终校验拒绝这三种组合，六种合法组合均通过。这是两个文件的限定修复，SQL 和捕获接口未变，详见[修复报告](evidence/2026-11-06-g1-deletion-leases/reviews/final-fix-report.md)。

其他原始失败同样保留，包括缺失 RPC／模块、被吞掉的必需写入、测试快照时区及显式 undefined 夹具、类型返回路径和恢复结果解析期间超时。没有删除快照字段或放宽完整行比较。独立审查还比较了完整行、合成对象字节、重放、单次传输和编译产物，不只读取通过标记。

最终源码归档、原生运行清单及完整性回执见[证据索引](evidence/2026-11-06-g1-deletion-leases/README.md)。4,866 个前批证据文件保留；构建仅增加的 next-env 引用已核实并恢复，实际生成字节单独保存。HEAD 仍为 `c0669e805`，暂存区为空，未提交、推送、远端迁移或部署；本计划恢复目录保留。

## 决策和剩余边界

沿用已接受的执行方向和当前工作目录。执行状态放在独立账本，保持原捕获清单可重放；已授权的持久删除申请不因申请人退出项目而撤销。本批只提供协调能力。若后续产品规则改变，需要调整独立账本／授权衔接并重验，不应直接改写已固定的捕获记录；未提交改动可按本批基线补丁恢复。

PG17 事务、锁和行记录为真实执行；auth/project/storage 前提、对象内容以及 pg transport 是本地合成环境。接手测试使用新 Worker 身份及数据库连接，没有声称终止再启动操作系统进程；响应丢失由明确丢弃已提交结果模拟，不是线上网络分区资格。迁移文件顺序检查不证明完整迁移链，局部合成规模也不证明生产吞吐。

**G1 正式关闭仍为 0/9。** 下一步工程依赖是引用安全的操作规划、晚到写入对账和物理执行结果持久化；之后仍需真实备份恢复、完整迁移链及云端／真机验收。本批没有自动删除宿主、Storage 删除、元数据清除或 GC 资格。

# T05 本地长任务心跳与未知结果核对续批

日期：2026-10-16（Asia/Taipei）。承接 [handoff](../../HANDOFF-2026-10-13-upgrade.md) 与 [T05 持久 Worker PoC](../../research/2026-10-15-t05-durable-worker-poc.md)。

## 目标

在隔离的本地 PostgreSQL/pg-boss 实验中补上长任务的租约心跳和未知结果的显式人工核对边界。只修改 `experiments/t05-durable-worker/` 及本轮证据/交接文档；不连接远端、不生成生产迁移、不调用真实供应商、不接正式保存入口。

## 约束

- 心跳只能由当前 `workerId` 与 `attempt` 持有者续租；已过期、已取消、已撤权或非 running 状态一律拒绝。
- 心跳必须在事务内重新锁定任务行、重新读取服务端时间并写回租约；不能用客户端旧快照覆盖新状态。
- provider 结果未知时，队列重复投递只进入隔离；只有显式人工核对结论才能选择复用结果或授权一次受控重试，不能默认再次调用。
- 证据中的 provider 仍是虚构账本；必须清楚标明不是生产 Worker、真实账单或供应商请求 ID。

## Task 1：实现并验证心跳和未知结果核对

- 先为心跳续租、错误 owner/attempt、过期 lease、撤权和行锁竞争写失败回归，再实现最小事务逻辑。
- 在 Worker IPC 中增加可注入的 heartbeat checkpoint；让长任务在 provider 阶段可续租，并验证续租后不会被 supervisor 错误回收。
- 增加未知结果的显式 reconcile 操作：`reuse_prepared` 只能发布已存在且指纹匹配的结果；`controlled_retry` 必须记录人工批准并消耗一次受控重试资格；其他结论保持隔离。
- 运行实验验证，保留每个场景的断言、源码指纹和清理状态。

## Task 2：项目验证与交接

- 运行实验 package 验证、项目 `npm run verify`、`git diff --check`，恢复 `packages/web/next-env.d.ts`。
- 更新实施记录、综合计划、handoff 与证据摘要，明确本轮仍未达到 G0/G1，不推送 GitHub。
- 只记录本轮改动，保留既有工作树，不做整体 reset/clean。

完成条件：本地实验新增心跳/核对场景全部通过；项目验证仍通过；文档清楚标注生产边界。

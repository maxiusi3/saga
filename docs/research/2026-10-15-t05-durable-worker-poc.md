# T05 本地 PostgreSQL / pg-boss 持久 Worker 验证

2026-10-15，分支 `codex/october-upgrade-p0`，基线 `1caa21a72`。本轮完成独立实验目录 [experiments/t05-durable-worker](../../experiments/t05-durable-worker/README.md)，将此前纯函数契约放进真实 PostgreSQL 事务与独立 Node 进程。原工作树保留，没有接生产路由、写根迁移、调用真实供应商、提交或推送。

**10月16日后续：** [自动监督与持续任务批](2026-10-16-t05-supervision.md)已将业务lease与队列claim同事务续约，新增自主runner/supervisor、退出清理及停止竞态修复。最新为39场景/307项断言，另有真实300秒合成任务及信号/异常清理证据。以下19/167与旧源码哈希保留为历史，不代表当前源码指纹；生产托管、真实长音频与G0/G1仍未验收。

## 实现与证据

固定 Node 22.22.2、PostgreSQL 14.17、pg-boss 12.37.1、pg 8.16.3。实验独立 package/lockfile，安装时 audit 为 0；不修改根应用依赖。`verify.mjs` 将现有 `processing-jobs.ts` 编译到本次临时目录供 Worker 使用，没有复制一套业务状态机。

创建本次专属 `/tmp/saga-t05-*` 集群，使用私有 Unix socket，TCP 监听关闭。`openPoc` 拒绝 localhost/远端 host，连接字段显式指定；harness 不继承 PG 连接设置。测试结束确认自建子进程为 0、集群停止、临时目录删除。代码和可复核 JSON 留在仓库，虚构数据库不留存。

业务创建与 pg-boss 入队共享事务，业务主键防止重复创建。独立队列消息只携带 `jobId`。Worker 使用行锁、owner/attempt/expiry 检查，先提交 leased，再提交 running，再写模拟调用账本。最终产物、任务/attempt 状态和 `{id,retryCount}` 队列确认在同一事务中提交。

真实业务 lease 不晚于队列 claim 的截止时间，避免先 fetch、后 claim 带来的小窗口。过期检查显式设为 1 秒；初次运行发现默认 60 秒 monitor 间隔也限制手动 `supervise`，已按真实失败修正。queue/lease 上限都是 5 秒；本轮续批另外在同一隔离 harness 验证了锁行后读时钟的心跳续租与 fencing，但这仍不是生产级长任务心跳。

`npm run verify --prefix experiments/t05-durable-worker` 退出 0：续批后 **19 个场景、167 项断言通过**（前一版为13个场景/125项）。证据 [results.json](evidence/2026-10-15-t05-worker/results.json) 包含运行时、源码/锁文件 SHA-256、每场景结果、逻辑时间和清理状态。

| 实测场景 | 结果 |
|---|---|
| 隔离连接 | TCP 关闭，使用实验角色，网络 host 配置被拒 |
| 事务回滚/提交 | 回滚时业务和队列均不存在；正常提交后仅一条任务；重复创建不入队 |
| 并发重复消息 | 第二个进程不夺租约、不发调用；终态再投递也不产生第二份结果 |
| leased 阶段 SIGKILL | 真实过期和监督重投后新进程恢复成功，记录第二次 attempt |
| provider 阶段 SIGKILL | 已有模拟调用，恢复为 outcome_unknown，额外投递仍不重发 |
| before_commit 阶段 SIGKILL | 其他连接看不到未提交成功/产物/确认；进程死亡后整笔回滚，恢复为 unknown |
| 旧进程迟到 | 原进程保留存活，租约到期由替代进程完成；原进程恢复执行被拒，调用数仍 1 |
| 提交期间过期 | 暂停超过 5 秒再继续，先回滚成功/产物，再将持久 running 恢复为 unknown |
| 队列 attempt fence | 同一 queue ID 被重投且 retryCount 增加，旧 retryCount 无法确认新 claim |
| 跨天批准 | review 清除租约、产物保持未发布；批准保留 attemptCount/resultRef，后续复用结果，无第二次模拟调用 |
| 撤权后的迟到结果 | provider 暂停时取消并撤权，恢复执行和重复投递均不发布结果 |
| 行锁等待跨过到期 | running 已提交后阻塞派发检查，过期后释放；确认模拟调用为 0、无产物，持久状态为 unknown |
| 心跳与未知结果核对 | 当前 owner/attempt 锁行后续租；stale/过期/撤权失败；unknown 只能 keep、匹配产物复用或显式单次受控重试 |
| Worker 创建失败 | 最后场景在同一集群触发 ENOENT，调用与 finally/信号处理共享的幂等清理；按时完成且进程/数据库/目录全部清理 |

跨天场景通过显式逻辑时钟前移 24 小时，队列操作仍在真实本地进程中执行；没有等待 24 小时。`poc_calls` 只是模拟请求账本，`poc_artifacts` 只是实验结果引用。它们不是供应商账单、真实故事或云端文件的证明。

本续批后项目级 `npm run verify` 重新退出 0：Web **75 套 / 702 项**，shared/web 类型、lint、构建通过，Next 生成 175 页面；摘要见 [T05 续批验证](evidence/2026-10-16-t05-heartbeat/verification.json)。构建前的 `next-env.d.ts` 已恢复。缺少 `SUPABASE_SERVICE_ROLE_KEY`、既有 Next 配置/多 lockfile 提示仍在，不作为生产配置通过。项目验证摘要见 [verification.json](evidence/2026-10-15-t05-worker/verification.json)。

独立审查发现两项 P2：行锁等待前读取的时间可能放行过期调用、失败 fork 可能不发 exit 而卡住清理。两项均先用真实故障复现，再修复并通过定向及完整回归。复审又发现新增测试的嵌套数据库在外层中断时可能残留；现已移除嵌套数据库，失败 fork 成为单集群的最后场景，复用共享清理并检查幂等性。最终[范围限定复审](evidence/2026-10-15-t05-worker/review-final.md)确认全部问题已关闭，规格与质量均通过；没有把本次审查称为整个历史工作树审查。首轮 RED/GREEN 历史证据为同目录 `review-dispatch-*.json`、`review-fork-*.json`；最终实现以 `results.json` 的源码指纹为准。

## 未完成的原计划范围

- 正式 `processing_jobs` / `processing_attempts` schema、版本迁移、保存入口的事务入队和生产 Worker adapter。
- 生产级长任务心跳、进程托管、自动监督、监控、真实负载、部署回滚及数据库恢复；本地短任务 harness 的心跳续租证据不替代这些验收。
- 服务端实际权限/用途同意/删除墓碑查询，真实 Storage 读写与资产/故事引用原子提交。
- 供应商请求 ID、状态查询、费用预留/上限、真实账单、资格与用途条件；本轮人工核对/受控重试仍只是虚构账本，不是供应商资格或生产费用控制。
- G1 5/20/30 分钟与真机故障矩阵、跨家庭直接 Storage/RLS、原件完整导出及恢复证据。

## 下一步与里程碑

本轮另取得 Supabase 项目元数据和 GitHub 工作流/部署只读记录，详见[补核记录](2026-10-15-readiness-refresh.md)。数据库查询仍在 CLI 登录角色初始化阶段失败，没有 schema/RLS/备份证据。先解决合法只读访问路径，对照现状后再设计正式 adapter；未授权远端迁移。独立实验代码可继续复用，不要再把这四类故障写成“完全未执行”，也不要升级成“生产 Worker 已完成”。

原计划 G0 仍缺实际资产/RLS、迁移回滚和供应商资格；G1 仍缺真实采集、隔离、原件导出/恢复矩阵。**本轮未达成现有里程碑，因此不推送 GitHub。** 条件式推送授权已记录在主计划、CLAUDE 和 handoff，下次达到对应门槛时直接执行，无需重复询问。

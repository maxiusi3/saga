# T05 隔离 PostgreSQL / pg-boss 持久任务验证

**Goal:** 用真实本地 PostgreSQL、pg-boss 和独立 Node 子进程验证持久任务恢复，替代仅纯函数模拟的证据。

**Spec:** [P1 第 4 节](../specs/2026-10-13-upgrade-p1-contracts.md)、[D07 供应商准备](../../research/2026-10-11-provider-readiness.md)。按计划执行与 TDD 流程进行，独立审查关键并发/事务边界。

## 约束

- 仅 `experiments/t05-durable-worker/`，独立 lockfile；固定 pg-boss 12.37.1、pg 8.16.3、Node ≥22.12.0。本机 PostgreSQL 14.17 已可执行。
- 创建本次专属 `/tmp/saga-t05-*` 集群，仅私有 Unix socket，不监听 TCP，不使用 `DATABASE_URL` 或已有数据库。不写根 migrations，不调用真实供应商或远端数据库。
- 复用已有 `processing-jobs.ts` 状态函数，实验表只存虚构任务、attempt、模拟调用账本与产物；不是已确认的生产 schema。
- 退出时停止本次数据库/子进程并移除本次临时目录，保留脱敏验证证据和代码。不得清理任何既有数据库或前序修改。
- 达到原计划里程碑才推送 GitHub；本地 PoC 通过不能替代 G0/G1、部署、真实账单、Storage/RLS 或真机验收。

## Task 1: 实验持久存储与独立消费者

文件：`store.mjs`、`worker.mjs`；根控制器提供 `verify.mjs` 和隔离集群生命周期。

接口：

```js
openPoc(config) // { host: '/tmp/saga-t05-.../socket', port, user:'saga_poc', database:'postgres', stateModule:absolutePath }
// => {pool, boss, close()}; only private Unix socket accepted
installPoc(context) // create experimental tables and queue 'saga-poc'
enqueueJob(context, id, { rollback = false, review = false } = {}) // atomic business row + boss.send, => queue id
approveJob(context, id, nowISO) // persist approval + requeue atomically
cancelJob(context, id, nowISO) // revoke access + persist cancellation
processOne(context, {workerId, checkpoint, nowISO}) // fetch one; nowISO optional logical clock for review scenario
// => {status, jobId?, queueId?}; checkpoint(stage, info) awaits parent continuation
```

- [x] 本地回归先证实缺少模块/行为（RED），再实现。
- [x] `poc_jobs(id text PK, snapshot jsonb, revision bigint, allowed boolean, review boolean)`；`poc_attempts(job_id text, attempt int, worker_id text, state text)` 按 job_id/attempt 唯一；`poc_calls(id uuid, job_id text, attempt int)` 模拟外部请求账本；`poc_artifacts(job_id text PK, ref text, published boolean)` 区分 prepared/published。队列仅传 `{jobId}`。
- [x] 业务创建与 `boss.send(...,{db:transaction})` 同事务，回滚两者皆无；已存在 job_id 不重复入队。最终产物与状态、队列确认也同事务。
- [x] `SELECT FOR UPDATE` + 当前 lease owner/attempt/到期时间检查，防并发双领和迟到完成。使用 pg-boss 的 `{id,retryCount}` 确认 fence；副本/terminal/unknown/review 不重新调用模拟供应商。
- [x] 领取后持久化 leased，再持久化 running 后才调用模拟供应商；暂停点为 `leased`、`provider`（模拟调用已持久）、`before_commit`（产物/成功状态写入但尚未提交）。父进程可 SIGKILL 验证真实退出；审查补充 `before_dispatch` 测试停顿，用于 running 已持久后阻塞行锁、验证到期前重新读时钟。
- [x] 使用 5 秒任务过期及 5 秒业务 lease。真实到期后由 `boss.supervise` 触发重投；leased 到期可恢复，running 到期进 outcome_unknown 并阻止自动再次调用。
- [x] review 写入 prepared 产物并释放 lease、确认队列；批准保留 attemptCount/resultRef，重排任务复用 prepared 结果，不重复模拟收费。
- [x] 写回前再次检查 allowed/cancel、lease/attempt；撤权后迟到结果不得发布。
- [x] worker CLI 只接 harness 写入的 config 文件；通过 IPC 发 checkpoint 并等待 continue，正常输出 result 后关闭连接退出。所有故障 hook 都仅在 experiments 内。

## Task 2: 真进程 / 真事务验证与交接

文件：`verify.mjs`、`README.md`、研究记录/证据、主计划/索引/handoff。

- [x] `initdb` 创建独立集群，`pg_ctl` 仅启用本次 Unix socket；将生产状态模块编译到临时目录供实验消费。finally 负责清理，无全局服务变更。
- [x] 事务回滚、正常提交、并发重复消息：断言持久行数、模拟调用数、唯一产物，实际处理跨进程。
- [x] SIGKILL at leased / provider / before_commit：检查 PostgreSQL 持久状态与 pg-boss 实际重投；前者恢复成功，后两者进入 unknown，调用数仍 1，未提交结果不得存在。
- [x] 跨天批准：review 的逻辑时刻为前一天、批准为本日；不用等待 24 小时，并明确这是逻辑时钟验证；无长期 lease，批准后复用产物。
- [x] 撤权后迟到结果与旧队列 attempt 确认被拒；不以模拟调用数宣称真实费用上限已验证。
- [x] 独立审查补充：行锁等待跨过租约截止后不得调用；fork 创建失败（error/close 无 exit）时有界清理仍停止自建集群并删除本次目录。
- [x] 记录 runtime/lockfile/源码指纹、真实检查结果、退出清理；运行 `npm run verify` 与 `git diff --check`。
- [x] 更新里程碑判定和最新授权。无 G0/G1 完成证据时不推送；本轮恢复的 GitHub 项目/部署只读记录单独保存。

完成证据：[13 场景 / 125 断言](../../research/evidence/2026-10-15-t05-worker/results.json)、[最终规格/质量复审](../../research/evidence/2026-10-15-t05-worker/review-final.md)、[项目 75 套 / 702 项验证](../../research/evidence/2026-10-15-t05-worker/verification.json)。本计划仅为隔离 PoC，G0/G1 仍未达成，未提交/推送/部署。

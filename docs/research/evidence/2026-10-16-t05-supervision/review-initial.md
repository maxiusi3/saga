# T05 自动监督批次：独立初审

2026-10-16。审查结论：**需要修改；Critical 0，Important 2，Minor 0。**

## 范围与方法

- 基线：`.superpowers/sdd/2026-10-16-upgrade-t05-supervision/before/experiments/t05-durable-worker/`。
- 审查源码：`store.mjs`、`worker.mjs`、`verify.mjs`，以及新增的 `runner.mjs`、`supervisor.mjs`、`supervision-scenarios.mjs`。README 和交接文稿仍在编写，不作为本次初审定稿。
- 规格：`docs/superpowers/plans/2026-10-16-upgrade-t05-supervision.md` Task 1，以及 `docs/superpowers/specs/2026-10-13-upgrade-p1-contracts.md` 第 4 节。
- 独立阅读实际 diff、完整控制流、被复用的业务状态机以及本地 pg-boss 12.37.1 的相关停止/续约 SQL。未改源码，未启动额外数据库，未重复长测，未调用远端或读取凭据。

## Standards

未发现需要单独报告的仓库编码规范违反。下面两项是可触发的行为缺陷，不是命名或抽象风格意见。

## Spec

### Important R1：监督器自身的维护查询被锁住时，关闭没有截止时间

**位置：** `experiments/t05-durable-worker/supervisor.mjs:117`–`119`；关联 `store.mjs:44`–`47`。

**触发：** 独立事务持有一个已过期的 `pgboss.job` 行锁，自动 pg-boss supervision 已开始执行超时回收并在该行等待，此时向 supervisor 发送 SIGTERM 或断开其父 IPC。`stopRunner()` 对 runner 的停止有上限，但其后的 `await context.close()` 没有上限，也没有取消 supervisor 自身的数据库查询。

这条路径不能靠 `boss.stop({ graceful: false })` 自动解除：本地 pg-boss 的 `dist/boss.js:156`–`164` 会一直等待在途 maintenance；`dist/index.js:298`–`302` 先等待该停止过程，才进入后续 shutdown；超时回收的 DELETE（`dist/plans.js:2829`–`2832`）本身会等待行锁。当前 pool 没有 query/statement/lock timeout。因而 runner 可已退出，supervisor 仍挂在关闭连接之前；失败也没有机会以非零退出完成。

**规格影响：** Task 1 要求“SIGTERM/IPC断开时停止拥有的Worker并关闭连接，失败保留非零退出”。本批首次启用后台 maintenance，原有 `close()` 的无界等待因此进入新的自主运行关闭路径。

**建议：** 为 supervisor 自己的数据库关闭建立截止时间和失败处理，并能终止或取消在途连接/查询；不能只给 runner 设置升级为 SIGKILL 的计时器。新增真实 PostgreSQL 场景：确认 maintenance 正在等待独立持锁事务后发送停止信号，持锁事务仍不释放时验证 supervisor 在截止时间内非零退出、runner 消失、其数据库连接消失。

**验证程度：** 根据本批调用链和实际安装依赖的实现确认；未另起数据库复现。现有 `verify.mjs:105`–`115` 的外层 harness 会在超时后杀进程组，因此最终“无遗留进程”不能单独证明 supervisor 自身可以完成这条关闭路径。

### Important R2：停止信号在异步数据库等待期间到达，仍可能派发或发布

**位置：** `experiments/t05-durable-worker/store.mjs:409`–`419`，尤其是 `await guard(...)` 与 `INSERT INTO public.poc_calls` 之间；同类提交窗口位于 `store.mjs:447`–`448` 与事务 helper 的 `store.mjs:63`。

**触发：** `before_dispatch` checkpoint 返回时任务尚未被中止，409 行检查通过；随后的 guard 等待业务行或队列行锁期间，runner 收到 SIGTERM、父 IPC 断开，或心跳因数据库错误而将 task signal 标记为 aborted。锁释放时，业务租约和队列 claim 仍然有效。guard 只检查数据库状态，后续 INSERT 不再检查 signal，于是模拟供应商调用仍会提交；到 provider checkpoint 才响应中止。

发布路径已有 `before_commit` 和 447 行检查，因此会拦住更早的 guard 等待期间收到的中止。但是 447 行之后仍会 `await databaseNow(client)`；若停止信号在这次最终时钟查询等待期间到达，448 行只检查租约，随后 helper 会直接 COMMIT。这样任务在已知 aborted 时仍提交 succeeded 和产物。

**规格影响：** 本批新增 signal 用来让“心跳异常停止任务”，runner 的 `stop()` 也明确中止 activeTask。当前派发前只有锁等待之前的一次 signal 检查，无法执行已经收到的停止指令。业务撤权在 guard 中有数据库检查，但执行生命周期的停止信号是另一条路径；此发现不等同于断言业务撤权可以绕过。

**建议：** 在 guard 完成、执行模拟派发前重查 signal；本 PoC 的调用记录可回滚，也应让 transaction helper 在所有异步操作结束、发出 COMMIT 前检查中止，覆盖 INSERT 及最终时钟读取的等待窗口。增加真实行锁场景，在已确认 guard 等待后中止任务，再释放锁，断言该 attempt 的 `poc_calls` 为 0 且没有产物；另覆盖最后一次时钟查询后的提交检查。本项要求阻止 COMMIT 发出之前已经收到的中止，不要求撤销已经发出的 COMMIT 或追溯撤销已完成任务。

**验证程度：** 已用实际 `processOne` 和实际 TypeScript 状态机的内存加载版本运行只读交错探针。探针在第三次业务行锁返回前 abort，其他租约与 queue 检查保持有效；输出为：

```json
{"probe":"source-level in-memory await interleaving, no PostgreSQL or filesystem writes","dispatches":[{"signalAborted":true}],"error":"Runner stopping during dispatch guard row-lock wait"}
```

同一探针方式还在 `before_commit` checkpoint 通过后的最终数据库时钟查询内触发 abort，确认发布函数返回 succeeded 并在 aborted 状态下提交：

```json
{"probe":"source-level in-memory await interleaving, no PostgreSQL or filesystem writes","result":"succeeded","commits":[{"signalAborted":true,"state":"succeeded"}]}
```

两次都是控制流交错验证，不是 PostgreSQL 实测，也不是实际外部供应商调用证据。

## 已核对的实现与证据

- 心跳确实绑定当前业务 attempt 的 worker、queue ID、retryCount，并检查 queue payload 的 job ID；错误绑定在 touch 前拒绝。业务行后队列行的锁顺序与锁后 `clock_timestamp()` 符合计划。
- 硬截止与 queue heartbeat 截止都参与租约上限；公开 `boss.touch` 使用同一个 transaction client，重新读取 touch 的实际时间后计算至多 5 秒的租约。回滚故障注入验证覆盖 touch 后业务保存失败，不只是返回值断言。
- runner 使用单一心跳循环，provider 等待结束会等待在途心跳完成后才发布。新 runner 不使用历史 `jobId` 过滤器吞掉别的任务。
- 恢复领取用恢复写入后的新数据库时间，避免先前采样早于刚设置的 `notBefore`。过期 running/outcome_unknown 保持隔离，队列重投不自动再次派发；重复信封与迟到结果沿用事务 guard 和 retry fence。
- supervisor 的 100/200/400 ms 串行退避、三次替换上限、创建失败和非零退出有实际场景。新 fork 的 PG*/DATABASE_URL 环境被过滤，数据库 host/user/database/port 仍显式限制到本地私有 socket。
- harness 对 supervisor 的 `exit` 作为 OS 进程终止证据，同时独立持有并清理进程组、检查 runner PID；这与已复现的 Node 22 父 IPC disconnect 后缺少 `close` 情况相容。此处未把“缺少 close 事件”误判为进程仍存活。
- 读取初审时的 `results.json`：32 场景、278 断言通过，完成时间 `2026-10-16T02:52:34.323Z`，direct children、进程组与 runner PID 均无遗留，数据库和临时目录清理成功。上述六个源码 hash 与该报告相符；README hash 已因文稿编辑变化，不能把它当作源码验证失败。
- 早期 red/green、signal 等材料存在不同历史指纹，适合展示各阶段的实验过程，不应代替最终源码的全量验证。五分钟 soak 在本次初审时尚未取得最终可接受结论，不在此签署通过；主任务已说明将修正过严的累计心跳次数断言并重跑。

这些证据限于本地 PostgreSQL、模拟调用账本和异步合成任务。它们不证明真实长音频、供应商取消/计费、生产托管、Storage adapter、RLS 或 G0/G1 已通过。

## 初审源码指纹

```text
be63c3ccf1893e87a43a7c8e96c0a73b6c4cb8d504c0f148af37e62fe77a5bf1  store.mjs
87bf8f280aae7b34c588411d2284b1b4fdf78d27d74bbedae41494fe864b915b  worker.mjs
5ee95d40a2471e5e4cfc07b9a43dc23b43943e44e0fed2e20d66b3dd5879be03  verify.mjs
62526bc2fdf4e6e61447350bb48a684a4e1ada9982ce4498fe745cc61c864df6  runner.mjs
22e0acfedef07ce896a54b9ca2b43847948e83229b56353d610a27da84c4e6b0  supervisor.mjs
8abab2d9578d2d28a12ec38587f736c7e5e87e19af81320e7b8434e37a18d21b  supervision-scenarios.mjs
```

本报告固定初审状态。修复和后续验证应追加独立复审记录，不应将本次未通过覆盖成初审通过。

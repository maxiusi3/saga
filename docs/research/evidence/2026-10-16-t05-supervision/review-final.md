# T05 自动监督批次：独立定向复审

2026-10-16。结论：**本次复审范围通过。初审 R1、R2 及复审发现的 R1b 均已解决；未关闭的 Critical 0、Important 0、Minor 0。**

本报告补充 `review-initial.md`，不改写初审未通过的结论。范围是两项初审问题及直接相关的关闭、进程归属、退出码、fatal harness 清理和持续任务断言调整。检查了最终 `store.mjs`、`runner.mjs`、`supervisor.mjs`、`verify.mjs`、`supervision-scenarios.mjs` 和 README；没有新增 `review-scenarios.mjs`，相关回归均在 `supervision-scenarios.mjs`。未改源码，未重复全量/长测，未另起数据库或访问远端。

## 问题关闭情况

| 问题 | 最终实现与验证 | 结论 |
|---|---|---|
| R1：维护查询被行锁阻塞，supervisor 关闭无上限 | `supervisor.mjs:137` 起对原始 close promise 设置期限；超时保留退出码 1，并通过 `store.mjs:38` 的独立控制连接取消查询，再有界等待原始 close。每次 `openPoc` 使用 `t05-PID-UUID` 唯一 application_name，取消 SQL 仅选择该实例的 active sessions；控制连接使用同一已校验的私有 socket，且在 finally 关闭。 | 已解决 |
| R1 的服务端连接清理 | 仅强退客户端的中间方案曾留下仍等待锁的数据库 backend，真实 RED 已保留。最终回归保持独立行锁不释放，确认 supervisor 已退出 1、原等待 backend 已从 `pg_stat_activity` 消失，再释放锁；随后原信封仍可完成，证明维护查询未越过取消后继续回收。 | 已解决 |
| R1b：runner 在关闭期间自行返回 1 或被外部信号杀死，却被 supervisor 报为正常退出 | `supervisor.mjs:39` 保存并判断 runner 的 code/signal/error，覆盖已经关闭及等待后关闭两个分支。真实回归分别使用 runner 停止时返回 1、在 supervisor 自身升级前外部 SIGKILL，均保留失败结果及原始 outcome；SIGSTOP 后 supervisor 强制 SIGKILL 也为退出 1。 | 已解决 |
| R2：停止信号在派发锁等待或最终数据库时钟等待期间到达，仍可提交 | `processOne` 使用带 signal 的 processingTransaction；每个派发/发布 guard 返回后检查中止，`store.mjs:72` 的事务 helper 在所有异步 action 完成、发送 COMMIT 前再次检查。实际第三次业务行锁等待期间 abort 和真实 SIGTERM 均产生 0 次模拟派发、0 个产物；最终真实 PostgreSQL 时钟响应后 abort 不发送 COMMIT，产物 SQL 回滚，之前已提交的 running 状态保留。 | 已解决 |

R1 的最终失败回退仍可以强制退出 1；README 明确没有把该回退宣称为服务端 SQL 一定已取消。正常持锁故障场景已经验证查询取消与 backend 消失。R2 的边界也准确：中止检查不承诺撤销已经发送的 COMMIT，更不能据模拟账本事务推出外部供应商调用可回滚。

## 相关交互检查

- supervisor 对每个 runner 只发送一次初始 SIGTERM；runner 与 supervisor 的 SIGINT/SIGTERM handlers 持续注册且幂等。重复停止不会因 once handler 被移除而触发默认信号退出。runner 的在途心跳仍在发布前及停止前被等待；超过关闭期限的进程由 supervisor 升级处理，并保留失败状态。
- harness 的未处理异常进入现有幂等所有权清理，并保存失败证据后退出；它仍按直接子进程、拥有的进程组与 runner PID、数据库、临时目录顺序收尾。最终 fatal 注入确实留下 `failed` 状态，而不是掩盖为通过。
- 持续任务每轮在一次数据库操作完成后再等待一秒，因此原先接近固定每秒 tick 总数的断言会累计误差。现在仍要求合理的平均心跳数量、最大观测静默小于 5 秒、每次租约余量不超过 5 秒、同一业务 attempt、同一 queue retry、唯一调用和唯一产物。这项调整保留租约意义，没有只降低计数后便宣称可靠运行。
- 新取消控制连接以实例随机标记隔离，不会按全库 PID 或共享固定 application_name 取消其他 harness/runner 的查询；PG 环境过滤与显式私有 socket 约束保持。
- `exit` 作为 supervisor OS 进程终止证据，独立进程组与 runner PID 检查继续保留；没有把缺少 `close` 事件等同于进程遗留，也没有把直接进程退出等同于后代已清理。

## 独立补充探针

复审使用最终实际源码执行了两组只读内存交错探针；只替换 OS/IPC/数据库生命周期适配层，没有启动子进程、写文件或连接数据库。这些探针补充源码判断，不代替真实 PostgreSQL 证据。

```text
runner code 0 / signal null     -> supervisor exit 0
runner code 1 / signal null     -> supervisor exit 1
runner code null / SIGKILL      -> supervisor exit 1
上述每种情况下，重复停止事件均只发送 1 次初始 SIGTERM。

派发锁等待内 abort：0 次模拟调用，0 次 abort 后 COMMIT，1 次 ROLLBACK。
最终时钟等待内 abort：保留此前已提交的调用，0 次 abort 后 COMMIT，1 次 ROLLBACK。
```

## 最终证据核对

| 证据文件 | 最终观察 |
|---|---|
| `results.json` | **39 场景 / 307 断言通过**；开始 `03:15:53.774Z`，完成 `03:19:25.549Z`。R1 持锁回归的 remainingMaintenanceBackends 为 `[]`，在释放独立锁之前观测。 |
| `soak.json` | **1 场景 / 11 断言通过**；完成 `03:20:57.518Z`。真实持续 **300018 ms**，**297 次心跳**，最大观测心跳间隔 **1017 ms**，没有重启、重投或重复调用。 |
| `signal-term.json` / `signal-int.json` | 最终状态均为预期的 `interrupted`，分别记录实际 SIGTERM / SIGINT；清理完整。 |
| `fatal-cleanup.json` | 最终状态为预期的 `failed`，错误明确是注入的未处理 harness test failure；清理完整。它是故障收尾证据，不是普通功能测试通过结果。 |

以上五份最终材料的 **9 个记录指纹全部与当前文件一致**，包括 README、实验 package-lock 和复用的状态机。它们均记录：ownedChildrenRemaining 为 0、remainingGroups 为 `[]`、remainingRunnerPids 为 `[]`、集群已停止、临时目录已删除、cleanup.errors 为 `[]`。

读取并区分了 `shutdown-lock-red/green`、`shutdown-backend-red/green`、`shutdown-outcome-red/green`、`stopped-runner-red/green`、`abort-dispatch-red/green` 和 `abort-publication-red/green`。早期材料保留其当时的源码指纹；最终全量结果重新覆盖这些回归。`soak-cadence-red.json` 的首次 300 秒失败和 `soak-before-final-close.json` 的早期成功均保留；本次通过依据是最终指纹匹配的 `soak.json`，没有借用早期成功代替最终源码验证。

最终运行版本：Node 22.22.2、PostgreSQL 14.17、pg-boss 12.37.1、pg 8.16.3。

## 最终源码指纹

```text
2e4d2c98a2cc71eaf45572ce519066ad2bfef6f5ef2a838ed2bae4368d71ed85  experiments/t05-durable-worker/package-lock.json
68cc9934994d07f16b082a921b103933574b48cbdcb22659853583ac176385ba  experiments/t05-durable-worker/store.mjs
87bf8f280aae7b34c588411d2284b1b4fdf78d27d74bbedae41494fe864b915b  experiments/t05-durable-worker/worker.mjs
b9cfedd15738b2ae5eef2e4b6cef836cd8bc069859bf5d2cc722906e88c436a4  experiments/t05-durable-worker/verify.mjs
23f2819b64211cadb68441703152f2b5cb96e475215986d83c9413fb42d11078  experiments/t05-durable-worker/runner.mjs
cda8c9897885e8e7f6b43d0594b172206d7ae6cb0c1af5d891f659b7d2f6f521  experiments/t05-durable-worker/supervisor.mjs
af0eb5de2d8a20c230e6d2266b6dc03cf01174e9829399245689eb9cd91c8a26  experiments/t05-durable-worker/supervision-scenarios.mjs
9064daf1b68d5e9a0e3e79098de71692c90bcfcde698be32c34a5011b91e5c38  experiments/t05-durable-worker/README.md
c6336ad62e1d38c98f35e1321b1ed1767452703128e58267d68e7be6b56f6eb1  packages/web/src/lib/server/processing-jobs.ts
```

## 仍属 PoC 的边界

无本次复审范围内待修复问题。通过仅覆盖本地私有 PostgreSQL、模拟调用账本、独立 Node 进程与异步合成任务；不证明真实长音频处理、外部供应商收费/幂等/取消、生产托管、RLS、Storage/故事 adapter、备份恢复、真实设备或 G0/G1 已完成。harness 本身遭 SIGKILL 后无法执行 JavaScript 清理，README 已说明该限制。

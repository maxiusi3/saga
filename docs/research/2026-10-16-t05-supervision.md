# T05 自动监督与持续任务本地验证

日期：2026-10-16（Asia/Taipei）。分支`codex/october-upgrade-p0`，HEAD仍为`1caa21a72`。承接[现有PoC](2026-10-15-t05-durable-worker-poc.md)及[本批实施计划](../superpowers/plans/2026-10-16-upgrade-t05-supervision.md)，只推进隔离的本地实验。

## 发现与实现

此前心跳仅延长`poc_jobs`业务lease，没有刷新pg-boss队列心跳，且从旧到期时间不断累加。真实PostgreSQL回归使用30秒硬上限和10秒队列心跳窗口，连续执行12次一秒间隔心跳：业务lease仍活跃并延伸到未来，队列约10.6秒已进入retry。失败证据见[heartbeat-red.json](evidence/2026-10-16-t05-supervision/heartbeat-red.json)。

本轮为每个业务attempt绑定确切queue ID和retryCount。心跳事务按相同顺序锁定业务行和队列行，在取得两把锁后读取数据库时钟，核对owner/attempt、queue claim、取消/删除、业务到期与队列硬截止。通过公开`boss.touch`同事务刷新队列，重新读取实际队列时间，业务lease取数据库当前时间加至多5秒与队列截止的较早值。快速重复心跳、未来的调用参数和旧attempt均不能预支租约或续约别人的任务。

`runner.mjs`持续消费并串行执行自动心跳；任务停止前等待在途心跳，沿用调用前及发布前的guard。它不使用旧harness的目标job过滤器。`supervisor.mjs`开启pg-boss自动监督，拥有一个runner；异常退出最多连续重启3次，退避100/200/400毫秒，成功交付后重置连续失败计数。IPC只用于观测和显式故障注入，不依赖父进程逐步continue、heartbeat或手动supervise。

默认短任务维持5秒硬上限；持续任务显式使用10秒队列心跳和有限硬上限。合成异步任务跨越多次5秒业务lease，关闭心跳或达到硬截止仍应回收。运行前死亡可以重试；调用后结果未知进入`outcome_unknown`隔离，重复投递不自动追加调用。撤权后的迟到结果不发布。

本轮另修复回收与领取的时序：恢复过期任务会写入新的`notBefore`，必须在恢复后重新读取领取时间，不能用恢复之前的时间将刚恢复的任务错误判为未到期。进程清理区分OS退出与Node的stdio/IPC `close`事件，harness核对自己拥有的进程组与runner PID，并在停止临时数据库前清理所属后代；真实IPC断开回归用于验证这一差异。

## 独立审查修复

[初审](evidence/2026-10-16-t05-supervision/review-initial.md)提出两项Important，均先在真实本地数据库中记录失败，再修复：

- **关闭可能无限等待。** 持有过期队列行锁，让pg-boss自动维护阻塞，再向supervisor发送SIGTERM。先等待数据库关闭1秒，受阻则用新的本地控制连接取消本实例随机标识对应的活跃查询，再等待原关闭过程；取消和后续等待各有1秒上限，失败保留明确非零退出。真实回归在独立持锁事务尚未释放时确认该后台会话已经消失，取消范围不会包含同集群的harness或其他Worker。最后的强制退出退路不承诺服务器会话已消失。runner停止有时限，任何非零/信号退出都会传递到supervisor；正常关闭与失败退出分别验收，不把强制终止当作清理无错误。
- **停止信号在数据库等待中被漏掉。** 调用前guard等待行锁，或发布前最后时钟查询等待期间收到AbortSignal，原实现仍可能插入调用或发送COMMIT。现在每个异步guard之后检查signal，事务helper在发送COMMIT之前再检查一次。真实行锁/停止信号回归验证零新调用和零新产物；发布回归在真实数据库时钟响应后注入AbortController，验证回滚。此保证不包含撤销已经发送的COMMIT。

定向证据为[关闭锁等待](evidence/2026-10-16-t05-supervision/shutdown-lock-green.json)、[强制停止runner](evidence/2026-10-16-t05-supervision/stopped-runner-green.json)、[派发前停止](evidence/2026-10-16-t05-supervision/abort-dispatch-green.json)、[提交前停止](evidence/2026-10-16-t05-supervision/abort-publication-green.json)、[真实SIGTERM等待行锁](evidence/2026-10-16-t05-supervision/signal-dispatch-green.json)；各自对应的RED文件也保留。

增量复查又明确了“只退出客户端，后端仍等待”与“runner失败被吞成supervisor退出0”两个关闭分支，分别用[后台会话回收](evidence/2026-10-16-t05-supervision/shutdown-backend-green.json)和[退出状态传递](evidence/2026-10-16-t05-supervision/shutdown-outcome-green.json)回归。停止信号改为幂等处理，每个runner仅发送一次初始SIGTERM，避免重复信号终止正在正常清理的进程。

一个中间测试的未处理Promise拒绝曾跳过普通finally并遗留本轮专属临时集群；该集群已停止并删除，[清理证据](evidence/2026-10-16-t05-supervision/intermediate-emergency-cleanup.json)保留。harness现为未处理拒绝/异常走统一紧急清理，仍以退出1记录失败，不将这条路径写成正常完成。

## 验证与证据边界

实验继续使用Node22.22.2、PostgreSQL14.17、pg-boss12.37.1、pg8.16.3。未修改根/Web manifest、任何锁文件或应用状态机。所有任务、调用、产物仍是合成实验记录；数据库仅监听harness专属Unix socket，未连接现有PG配置或远端。

旧19场景/167项断言属于前批历史结果。本轮改变实验源码，最终结果与源码指纹以新证据目录为准，不能继续称旧五项哈希与当前源码一致。

最终固定源码验证：

| 验证 | 实际结果 | 证据 |
|---|---|---|
| 完整实验 | 退出0；**39场景/307项断言**，含原19场景与新增20场景 | [results.json](evidence/2026-10-16-t05-supervision/results.json) |
| 真实300秒合成任务 | 退出0；1场景/11项断言；实际300018ms，297次自动心跳，最大间隔1017ms；同一attempt、queue retryCount为0、一次调用、一份产物 | [soak.json](evidence/2026-10-16-t05-supervision/soak.json) |
| harness SIGTERM / SIGINT | 预期退出143 / 130；记录interrupted，完整回收所属资源 | [SIGTERM](evidence/2026-10-16-t05-supervision/signal-term.json)、[SIGINT](evidence/2026-10-16-t05-supervision/signal-int.json) |
| 注入未处理异常 | 预期退出1；记录failed，完整回收所属资源 | [fatal-cleanup.json](evidence/2026-10-16-t05-supervision/fatal-cleanup.json) |

各份最终证据的9项源码/依赖/README指纹均与本轮完成时文件匹配；正常、信号和故障路径均确认直属子进程、进程组和runner PID无遗留，临时集群已停止、目录已移除。预期失败路径的非零码不是测试失败被忽略。汇总见[verification.json](evidence/2026-10-16-t05-supervision/verification.json)；[独立增量复审](evidence/2026-10-16-t05-supervision/review-final.md)关闭上述发现，没有将本批结论扩大为历史工作树或生产验收。

第一轮300秒任务因验证脚本对心跳数量要求过严而失败，后续以真实最长间隔小于5秒租约及平均频率检验；[原失败](evidence/2026-10-16-t05-supervision/soak-cadence-red.json)和[关闭逻辑最终修复前的成功运行](evidence/2026-10-16-t05-supervision/soak-before-final-close.json)均作为历史保留。上表仅引用最终源码的新运行。类似`legacy-green.json`等中间文件的真实status可能为failed，文件名不作为通过依据。

项目级检查已通过，见[project-checks.json](evidence/2026-10-16-t05-supervision/project-checks.json)：`npm run verify`退出0、Web75套/702项、类型/lint与175页构建；shared4套/16项、infra7项。`next-env.d.ts`恢复为本批开始时内容。依赖审计仍42项（34high/8moderate），见[同轮复审记录](2026-10-16-dependency-review-followup.md)。

## 未覆盖与下一步

这批不接Supabase、真实Storage、故事写回或供应商；合成等待不能证明音频合并、FFmpeg负载、内存/CPU容量或真实请求费用。自动监督是本机实验进程，不是托管服务、机器故障恢复、运维告警或生产发布。杀死整个harness的进程组不能执行自身清理，测试仅证明声明的故障注入路径。

原计划仍需：合法的远端schema/history/RLS与bucket/备份只读证据；对照后设计正式事务adapter；T04本地合并接入并验证输出回读；实际权限/同意/墓碑投影；供应商请求ID、状态核对和账单；G1真机5/20/30分钟及故障矩阵。当前G0/G1均未通过，没有提交、推送或部署。条件推送授权继续有效，达成原计划里程碑后再执行。

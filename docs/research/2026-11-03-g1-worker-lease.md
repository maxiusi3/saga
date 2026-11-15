# G1-01 Worker 持久领取、租约与输入核验监督

- 日期：2026-11-03（Asia/Taipei）。基线 `c0669e805`，分支 `codex/october-upgrade-p0`。
- 负责人已确认本切片；保留前批可信输入实现、未提交改动和全部历史证据，不重做目录整理。
- 设计见[边界](../superpowers/specs/2026-11-03-g1-worker-lease-design.md)，执行见[清单](../superpowers/plans/2026-11-03-upgrade-g1-worker-lease.md)。本地实现不等于 G1 通过。

## 本批实现

1. 新增正式表上的 `recording_job_lease` 五动作 RPC。`claim` 原子递增 attempt 并写入未派发的 leased attempt；`start` 固定派发时点；`heartbeat` 在阻塞锁和校验后使用数据库时钟续租；`check` 只检查；`recover` 原子落库恢复状态。重复领取和旧 fence 均拒绝。
2. 数据库重算 UUIDv8 资产、幂等键、固定清单摘要并核对会话／分块／资产／任务／尝试历史。固定 3 次预算，固定 service-role-only EXECUTE、可信 search_path 和 UTC；保留旧调用者的 dispatch 默认值与 job/asset 权限，不恢复 session/chunk 广泛直接写权限。
3. 严格 RPC 客户端只接受封闭回执，固定 job/worker/attempt/输入身份；禁止自动重试、拒绝超时和未知提交结果、清洗错误。以请求起点与数据库剩余 TTL 建立保守单调时钟截止时间。
4. 核验器可使用 running fence，前后调用检查 RPC。只有租约过期时间和 job 更新时间允许随正常心跳变化，其余原有输入固定；原 queued 只读路径保留。
5. `verifyLeasedRecordingJobInput` 顺序 claim → start → 实际输入核验 → 最终 check。串行续租；失租、超时、到期或 caller 取消都中止共同信号，并等待实际流／FFmpeg／临时文件清理和在途心跳结束。

## 状态含义

- 未派发的 leased 到期：显式 recover 后进入 `retry_wait`；第三次预算耗尽进入 `failed`。
- 已派发的 running 到期：进入 `outcome_unknown`，不能自动重新领取或重复核验。
- 活跃任务发生撤权、删除或取消：recover 原子结束匹配 attempt 并取消任务，未到期也可取消。
- 核验成功仍只返回 `input_verified`、running lease 和 `canClearLocalDrafts:false`。本切片没有候选上传或终态成功／ready API，返回后不再续租；未由后续发布层承接则到期后显式恢复为 unknown。

## 验证记录

- 真实缺失 RPC RED（`42883`）；SQL 回归分别复现旧 dispatch 默认值丢失、取消在真实到期后更新 job 时间导致 recover 错拒绝，再修复。
- 客户端初始 RED 21 fail/13 pass；running reader RED 8 fail；Worker RED 8 fail/7 pass。补充回执 attempt 超预算 RED 1 fail/41 pass 后收紧上限。中间 type-check 的 `Object.hasOwn` 目标库不兼容已改为兼容写法。
- 应用定向 **4 套 / 293 项通过**；规格审查独立复跑同组通过。质量审查另行独立复跑 input/verifier/lease/worker/executor/decoder **6 套 / 362 项通过**。
- 独立 SQL/process 运行两轮均 **13 场景 / 329 断言通过**。真实独立进程竞争、SIGKILL leased/running 分界、锁等待越过到期、三次真实期限、权限/删除/取消及第二笔写入失败的事务回滚均覆盖。
- 最终真实 PG + 生产 TypeScript + 原生 FFmpeg **17 场景 / 1943 断言通过**，覆盖跨初始租期持续核验、读取中撤权、claim/heartbeat 已提交但响应超时。成功场景 3.658 秒、18 次续租、3 块、64000 PCM 字节；明确断言已开始的 Storage 请求因续租响应超时而取消。所有临时 cluster、socket、PID、连接、子进程和应用请求清理通过，23 份源码摘要无漂移。首轮 1895 断言的超时发生在账本 I/O，保留原证据，不冒充 Storage 取消验收。
- 冻结源码后完整门禁再次 exit 0：`npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra`。Web **146 套 / 2588 项**、shared **4 套 / 16 项**、infra **14 项**、类型检查、lint、**184 页构建**全部通过，源码摘要稳定；`next-env.d.ts` 只恢复核实过的构建生成 import，原字节一致。audit 未重跑，原 Next／可选配置警告仍在。先前完整门禁也通过，但运行中存在已知 harness-only 改动，最终以冻结重跑为准。
- 独立规格 **PASS** 后质量 **Approved**，无待修阻塞。质量审查另跑新唯一 PG/FFmpeg 证据 **17 场景 / 1933 断言通过**，源码与清理均通过；这是独立运行，正常心跳次数造成计数差异，不替换指定的 1943 记录。前七批 **272 证据文件**与 **1471 历史输入**摘要复核未变。
- 所有运行使用新建的唯一证据目录，失败记录保留。证据及复跑方式见[证据索引](evidence/2026-11-03-g1-worker-lease/README.md)和[实验说明](../../experiments/pg17-recording-worker/README.md)。

## 未完成边界

- 新测试是真实隔离 PostgreSQL 17.4，合成前置表加正式相关表 DDL 和两份完整迁移；不是全迁移链或远端迁移。实际 Supabase JS 的 HTTP 请求由严格 injected fetch 转成参数化本地 PG 查询，Storage 为进程内合成响应，不是活体 PostgREST/TLS/RLS/云端对象存储验收。
- 只核验 2 秒合成 WebM/Opus，不是真机 5/20/30 分钟录音、尾部连续性或人工核听；FFmpeg 运行时仍待部署与 OS 级隔离验收。
- 当前授权行加锁不等于完整发布屏障，缺失 tombstone 行不能阻止并发插入。将来候选上传、原子发布与删除撤权必须统一最终授权／fence／输入版本规则。
- 旧删除 route 仍能直接取消 job 并清掉 fence，而不结束 attempt；本批对此 fail closed，不修复终态、不恢复执行，可能留下未完成 attempt 的观测残留，需后续统一取消写入。
- 每块多次全量账本及 RPC 清单校验仍有二次增长成本；大清单、资源有界化与生产吞吐未验收。AbortSignal 不证明远端已提交的 SQL 被撤销。
- 尚无常驻调度器、自动恢复调度、内容失败终态写入、输出上传/原子 ready 发布、客户端 seal/status/持久确认与安全清理。
- `g1Item01Complete:false`、`g1MilestoneSatisfied:false`、`pushConditionSatisfied:false`。本批不暂存、提交、推送、合并 main、远端迁移、部署、付费调用或外发家庭资料。

下一批在当前 fence 基础上设计候选输出与原子发布／失败终态，解决撤权删除与发布竞态，再接客户端确认清理；不得把本次输入核验回执当成云端成功或清理授权。

# T05 持久 Worker 本地 PoC

用真实 PostgreSQL、pg-boss 和独立 Node 进程验证恢复、事务边界和自动监督。默认场景使用模拟调用账本；`--only-merge` 使用虚构音频的真实本地文件及 FFmpeg 解码。不接应用路由、Supabase、Storage 或真实供应商。

需要 Node ≥22.12.0、根项目 TypeScript 依赖，以及 PATH 中的 `postgres`、`initdb`、`pg_ctl`。实验独立固定 pg-boss 12.37.1 / pg 8.16.3，不加入根应用工作区。

```bash
npm ci --prefix experiments/t05-durable-worker --ignore-scripts
npm run verify --prefix experiments/t05-durable-worker
node experiments/t05-durable-worker/verify.mjs /tmp/saga-supervision-heartbeat.json --only-supervision-heartbeat
node experiments/t05-durable-worker/verify.mjs /tmp/saga-new-soak.json --only-supervision-soak
# 实际中断 harness；预期退出码分别为 143 / 130，证据中的 cleanup 必须完整：
node experiments/t05-durable-worker/verify.mjs /tmp/saga-signal-term.json --only-supervision-signal
node experiments/t05-durable-worker/verify.mjs /tmp/saga-signal-int.json --only-supervision-signal --signal=SIGINT
```

默认输出为 `docs/research/evidence/2026-10-16-t05-local-runs/results-<时间戳>-<PID>.json`；重跑请使用新的显式路径，保留历史证据。`--only-supervision` 运行新增场景；`--only-supervision-duration` 单独运行 20 秒任务。原有 `--only-dispatch-contention`、`--only-fork-cleanup` 继续可用。

`verify.mjs` 只创建一个自己拥有的 `/tmp/saga-t05-*` 集群，监听私有 Unix socket、禁用 TCP、不继承 `DATABASE_URL` 或 PG 环境变量。它将直接 worker、runner、supervisor 都作为独立进程组启动并登记，保留组标识直到清理结束；supervisor 启动的 runner 及 FFmpeg 继承其组。子进程只使用现有集群，不启动嵌套的数据库 harness。退出、SIGINT/SIGTERM、fork 失败和未处理异常共用幂等清理：先中止并 join 已登记的进程内处理、向所属直接子进程发送 SIGTERM；超时则对已登记的整个进程组 SIGKILL，父进程已经退出也继续核对并清理其组及已观测 runner PID，最后停库和删临时目录。停止失败会记录失败并保留仍运行集群的数据目录。单独运行的 harness 或最外层观察器被 SIGKILL 时无法执行自身清理；本实验不承诺最外层进程被强杀后的自动收尾。

- `store.mjs`：实验表、事务入队、领取/重投、审批/取消、结果与队列确认；复用应用 `processing-jobs.ts` 状态机。每次实际领取保存确切 `queue_id` 与 `queue_retry_count`。
- `worker.mjs`：原有单次消费故障夹具；IPC 在 leased、before_dispatch、provider、before_commit 停顿。原有目标 job 过滤只服务旧夹具，不能用于连续消费策略。
- `runner.mjs`：持续消费所有消息；默认以可取消异步等待模拟耗时工作，真实录音任务交给本地 adapter，从 leased 开始每秒自动心跳。心跳只有一个串行循环，失败会中止任务；停止任务和发布前均等待已发出的心跳结束。
- `supervisor.mjs`：通过 `openPoc(config, { supervise: true })` 开启 pg-boss 自带自动监督，只启动本实验 runner。异常退出最多连续重启三次，退避为 100/200/400ms；成功完成业务后重置计数，耗尽后退出 1。SIGINT/SIGTERM 或父 IPC 断开会停止所拥有的 runner 并关闭数据库连接。重复停止指令只发送一次初始 SIGTERM；runner 先等 2 秒，仍不退出则 SIGKILL 并保留非零退出；数据库关闭先等 1 秒，仍受阻则报告 cleanup_error，并用连接到同一私有数据库的独立连接，按该 openPoc 实例的唯一 application_name 取消其活动查询；取消和后续关闭各最多等 1 秒。持锁测试会在释放测试锁前确认维护后端已消失。取消或关闭仍失败时最后强制退出 1；此失败回退不声称服务端 SQL 已成功取消。任何 runner 在关闭时退出非零或被信号杀死，supervisor 都保留失败退出码。IPC 只观测或注入 SIGKILL，不发送 continue、heartbeat 或手工 supervise。
- `supervision-scenarios.mjs`：真实 20 秒任务、真实 300 秒异步合成 soak、两处 SIGKILL、撤权、硬截止、旧 queue retry、重复消息、事务回滚、两种行锁竞争及进程树清理。

默认短任务仍是 5 秒队列硬上限。长任务必须显式给出有限 `expireInSeconds` 和 `heartbeatSeconds: 10`；pg-boss 12.37.1 不接受小于 10 秒的 heartbeat 窗口。`expireInSeconds` 从每次队列领取的 `started_on` 开始，是独立硬截止；公开 `boss.touch` 只更新 `heartbeat_on`，不会延长硬截止。

`heartbeatJob` 按业务行 → 队列行的顺序加锁，两个锁均取得后使用 PostgreSQL `clock_timestamp()` 检查业务 owner/attempt、取消状态、确切 queue ID/retryCount 绑定、队列 active 状态、旧 heartbeat 截止与硬截止，再用公开且带 retryCount fence 的 `boss.touch` 在同一事务提交。新 lease 为 `min(DB now + 5s, 实际存储的 queue heartbeat 截止, queue 硬截止)`，不从旧 lease 到期时间累加。pg-boss 的 `job_now()` 使用事务开始时间，因此 touch 后重新读取实际写入的 heartbeat 时间；即使等待过锁也不假设 touch 写入了锁后当前时间。

领取、调用前、发布前继续检查业务状态与队列 claim。每个异步 guard 返回后重新检查停止信号；事务 helper 在发送 COMMIT 前再检查一次，防止等待行锁或最后数据库时钟期间到达的停止被漏掉。停止信号不能撤销已经发送的 COMMIT。派发后失去所有权会停止合成任务，随后由自动监督重投并隔离为 `outcome_unknown`；重启或额外消息都不自动再次调用。原有人工核对/准备结果复用/受控重试契约保持不变。跨天审批仍是显式逻辑时钟推进 24 小时，不能算真实跨天 soak。

新增回归中的真实等待与故障注入分开记录。队列 heartbeat 截止单项测试显式通过 SQL 将该时间戳调旧 11 秒；事务回滚测试通过 trigger 注入写失败。发布时序回归在真实 PostgreSQL 最后时钟查询返回后注入 AbortController，不伪造数据库结果；另有实际 SIGTERM 在调用前 guard 等待行锁时到达的回归。20 秒与 300 秒任务、租约等待、硬截止、崩溃后的自动重投均使用实际墙钟。Node 22 在父进程主动断开 fork IPC 后可能只报告 `exit` 而无 `close`；harness 以实际 `exit` 确认该 OS 进程终止，并另查整个进程组，不把直接进程退出当作后代已清理。

`poc_calls` 仅是默认场景的模拟供应商账本；真实录音合并不会写入该账本。`poc_artifacts` 仍仅是实验引用。默认异步等待不解码音频、不发送网络请求，也不证明收费、供应商幂等或取消真实请求。正式 schema/adapter、RLS、Storage/故事发布、生产托管/负载、备份恢复、真实设备与 G0/G1 仍须独立验收。

## T04 真实本地文件接入

```bash
SAGA_FFMPEG_PATH=/absolute/path/to/ffmpeg node experiments/t05-durable-worker/verify.mjs --only-merge /tmp/saga-new-merge.json
```

需明确提供本地 FFmpeg 可执行文件。实验不会安装、下载或分发 FFmpeg。当前证据使用本机已有 7.1 nonfree 构建，只作为测试运行时；生产来源、许可和资源隔离仍未选定。

- `local-recording-merge.mjs` 复用真实 T04 TypeScript helper（由 harness 编译），从私有目录中的固定文件名读取有界、可取消的 regular file，拒绝符号链接、FIFO、硬链接和不符大小/hash 的块。任务数据不提供源/输出路径。
- `enqueueRecordingMerge` 冻结完整清单和任务身份；相同 job ID 不得换输入，相同幂等键不得换 job ID 重复入队。任务持久化与只含 job ID 的队列消息同事务提交。调用前、心跳及写回时核对清单摘要和身份；测试表不是正式会话封口或 Supabase adapter。
- 合并/解码在数据库事务外运行。runner 从领取开始维持心跳，真实文件处理直到 `before_publication` 才停止并 join 心跳；取消传播到文件流和解码进程。故障检查点的等待仅用于时序控制，不能当作长音频解码负载证据。
- 输出使用唯一引用和排他创建，文件/目录 sync 后从磁盘回读大小及 SHA-256，再由事务检查权限标志、取消/删除、输入、租约和 queue claim，原子提交任务、产物引用和队列确认。重复消息不重复生成已发布结果。
- 文件系统与 PostgreSQL 没有共同事务。崩溃或未知 COMMIT 可留下私有孤立文件；store 不删除已准备文件以免破坏可能已经提交的引用。只有 `readPublishedRecording` 根据已提交引用、当前可用状态和再次回读校验返回内容；它不接受文件路径。本批不实现孤立文件 GC 或真实合并的人工审批/结果复用。
- 本地 allowed 标志不代表正式对象授权。私有目录检查和 O_NOFOLLOW 不是 OS sandbox；同用户恶意替换目录、不可抢占的内核文件调用和生产媒体进程隔离仍在本批范围外。

本批结果、故障覆盖和未完成边界见[实施记录](../../docs/research/2026-10-16-t04-t05-local-merge.md)。

异常清理另由 `verify-merge-cleanup.mjs` 外部观察器验证：

```bash
SAGA_FFMPEG_PATH=/absolute/path/to/ffmpeg node experiments/t05-durable-worker/verify-merge-cleanup.mjs /tmp/saga-new-cleanup
```

探针在实际 FFmpeg `-re` 解码期间故意停止 owner/decoder，再向 harness 注入异常或 SIGTERM；外部观察器在 harness 退出后检查记录的真实 decoder PID、所属组、数据库和临时目录，不能仅凭 harness 自报零直接子进程判断清理成功。观察器在私有目录建立、可能启动数据库、登记进程组和解码器时，通过所属 harness 的 IPC 提前接收并保留所有权快照，不依赖成功退出或完整 raw evidence。观察器超时、收到中断或 harness 非预期退出，都进入同一个幂等有界清理：先向所属 harness 发 SIGTERM，等待后再按确切组/PID 兜底；只对已核验的本次私有目录执行 `pg_ctl stop/status`，确认数据库已停且无残留后才删除目录。未能确认则保留并报告，不静默删除运行中集群。必要时在强杀前暂停仍存活的所属 harness，核对其后代，避免创建与快照之间的遗漏。所有退出等待、命令和报告写入均有界。正常信号和异常注入的非零退出按预期分别记录，不能当作应用失败或生产隔离证明。

额外验证观察器自身故障与实际中断：

```bash
SAGA_FFMPEG_PATH=/absolute/path/to/ffmpeg node experiments/t05-durable-worker/verify-merge-cleanup.mjs /tmp/saga-new-observer-faults.json --observer-faults
# 实际向观察器发送 SIGTERM，预期退出 143，仍须检查其清理证据：
SAGA_FFMPEG_PATH=/absolute/path/to/ffmpeg node experiments/t05-durable-worker/verify-merge-cleanup.mjs /tmp/saga-new-observer-interrupt.json --observer-interrupt
```

已知的本地合并失败另有专用验证：

```bash
SAGA_FFMPEG_PATH=/absolute/path/to/ffmpeg node experiments/t05-durable-worker/verify.mjs --only-merge-failures /tmp/saga-new-merge-failures.json
```

`RecordingProcessingError` 以真实 helper 实例及固定 code 识别失败。缺源、大小/hash 不符、非私有 regular file、无诊断且退出 0 后的无效 PCM，以及实际测得的时长超限为永久错误；adapter 自己的源读取超时和明确的暂时 OS 读取错误为暂时错误。普通异常、FFmpeg 不可用、通用非零退出/诊断、解码器超时、诊断溢出及不明确的资源故障保持未知。FFmpeg 的退出状态和 stderr 无法区分坏输入与运行时/资源故障，因此部分损坏音频仍需后续核对；不匹配诊断文字来推断永久失败。停止信号优先于任何错误分类，包括 reason 恰好是已知错误实例的情况。

只有 `prepare` 尚未成功返回且本次局部产物已正常清理的失败才可分类。失败处理按 business job → queue 行顺序加锁，核对当前 queue ID/retryCount、业务 owner/attempt、输入摘要、权限/墓碑、数据库时钟和租约。事务同时写 snapshot、当前 attempt 的 `{code, disposition, phase}`、旧 envelope 确认和必要的新延迟消息；不记录原始诊断、任意错误消息或路径。重试复用原任务预算、expire/heartbeat 限制，退避依次为 1/2/4/5/5 秒，到 maxAttempts 转为 failed。新消息仅含 jobId，startAfter 不早于 notBefore；过早重复消息直接确认且不增加 attempt。

准备输出成功返回之后的回读、guard、发布与 COMMIT 异常保持原有未知结果隔离；不自动重试、复用或删除私有孤立输出，也未实现 GC。专用 harness 覆盖永久错误、损坏音频的保守 lease 恢复与重复投递隔离、真实源流超时、修复后成功、预算耗尽/退避封顶、context 重开、失败写入/入队/确认回滚、取消/撤权/删除/输入变化、失租、队列/attempt fencing、停止信号、cleanup 故障和 runner 连续消费。OS 错误测试是在真实 filesystem 调用边界注入固定 errno；并非操作系统自然故障发生率证据。原 `--only-merge` 保留真实 FFmpeg、准备后崩溃及 COMMIT 回执丢失回归。

## 私有输出候选与持久发布意图

```bash
SAGA_FFMPEG_PATH=/absolute/path/to/ffmpeg node experiments/t05-durable-worker/verify.mjs --only-output-candidates /tmp/saga-new-candidates.json
SAGA_FFMPEG_PATH=/absolute/path/to/ffmpeg node experiments/t05-durable-worker/verify.mjs --only-output-candidates --output-case=quarantine /tmp/saga-new-quarantine.json
```

`recording-output-candidates.mjs` 管理实验表 `poc_recording_outputs` 的身份、状态和 SQL；事务及加锁由 `store.mjs` 负责。每个 reference 和 `(job_id, attempt)` 唯一，记录 job、attempt、worker、确切 queue ID/retryCount、冻结输入 digest、不可变准备 metadata 及各阶段数据库时间。受支持 API 不更新身份或已经准备的 metadata，不允许逆向状态转换，也不移除候选记录。

| 状态 | 含义与后续操作 |
| --- | --- |
| reserved | 身份已提交，文件可能尚未创建；只允许准备成功后变 prepared，或已知 prepare 失败且局部清理完成后变 cleaned。 |
| prepared | prepare 已完全返回，文件同步、回读及 metadata 已确认；可写入发布意图，或在明确停止且无引用时隔离。 |
| publishing | 独立事务已写入发布意图，包含意图或最终发布 COMMIT 回执不确定的情况；只能由持有原 claim 的最终事务发布，不能隔离。 |
| published | 与 artifact、snapshot、attempt 成功及 queue 确认同事务提交；不可隔离。 |
| cleaned | 已知 prepare 失败的局部清理完成，与失败审计、重试及 queue 确认同事务提交；身份保留，新 attempt 必须取得新 reference。 |
| quarantined | 持久声明禁止发布；幂等检查仍核对身份及全部引用，不删除或复用文件。 |

adapter 的内部 `prepare(frozen, { ref, signal, checkpoint })` 只使用 store 在 reservation COMMIT 确认后交付的 reference，保留引用格式校验、O_EXCL、文件/目录 sync、磁盘回读与局部清理。reservation 回执不确定时不调用 prepare。prepare 返回后的任何错误均在已知失败 catch 之外；prepared/publishing 的提交或结果不确定不会自动回退、重试、复用或删除。

所有候选写入遵循 job → queue → candidate 锁顺序。取得候选锁后及可暂停的提交检查点后重新核对停止信号、数据库时钟、业务 lease 和确切 queue claim。prepared → publishing 是独立持久事务，确认成功后才开始最终发布事务，因此最终 COMMIT 未知后发生取消也不能将该输出当作普通 prepared 回收。

`quarantineRecordingOutput(context, id, { ref, attempt, inputDigest, signal })` 不接受文件路径；身份不匹配、输入/metadata 漂移、查询失败、取消信号或提交失败会拒绝并回滚。正常返回 `{ status: 'quarantined', ref, state }` 或 `{ status: 'retained', ref, state, reason }`。只有当前业务和对应 attempt 明确 cancelled/failed、没有业务 lease 或活跃 queue lease、没有任何 artifact.ref 或任何 job.resultRef 引用、且尚未进入 publishing 的 prepared 才能隔离。outcome_unknown 以及取消后遗留的 `lease_expired_after_dispatch_unknown` 均继续保留。quarantined 仅禁止发布，本实验没有 unlink、TTL 扫描或物理 GC 接口。

`readPublishedRecording` 的磁盘读取前后都要求 published 候选、成功 attempt、冻结输入、artifact metadata 及 snapshot.resultRef 完全匹配；不能仅凭文件存在或 artifact 引用读取。真实录音仍拒绝 synthetic review/reconcile 路径。

专用场景使用真实 PostgreSQL、pg-boss 与本机 FFmpeg，覆盖 reservation 回滚/回执丢失、文件创建和各事务边界的 SIGKILL、永久失败/有界重试、未知异常、发布意图和最终发布的两种 COMMIT 回执故障、取消/隔离/重开、双向锁竞争、候选锁等待后 abort/lease 到期及身份/metadata 漂移。SIGKILL 发生在 helper 内部时可能留下私有临时文件；测试记录这些文件，最终由所属 harness 连同本次隔离目录收尾，不能据此推导正式 Storage 的保留或删除语义。所有源块保持原字节，本地证据不代替 G1 真机验收。

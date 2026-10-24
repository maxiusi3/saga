# T05 私有输出候选：独立规格与质量审查

审查日期：2026-10-16。范围为本批唯一耦合代码任务，同时完成 store / adapter / runner / publication / quarantine 的最终接线审查。

## 双 verdict

- **Spec compliance: PASS** — 本批候选身份、持久发布意图、发布/隔离互斥、未知结果保留、受检读取及本地故障证据满足任务契约。
- **Quality: PASS** — 未发现本次增量引入的可确认正确性、回归或维护性问题。
- **发现数：Critical 0 / Important 0 / Minor 0。** 无需修正项。

这份报告是独立审查，不以实现者自审代替审查。结论仅适用于隔离 PoC 与受支持 API，不代表正式 Storage、生产部署或 G1 真机验收通过。

## 审查基线与方法

依据 `.superpowers/sdd/2026-10-16-upgrade-t05-output-candidates/review-brief.md`、`task-1-brief.md`，并对照 `docs/research/2026-10-16-t05-merge-failures.md:51` 的保留/回收契约及 `docs/superpowers/specs/2026-10-13-upgrade-p1-contracts.md:51` 的状态、取消与未知结果要求。

按有界片段读取本批 `review-initial.diff`，使用提供的 before snapshot 增量，不将未变化的 HEAD 当作基线。Diff SHA256：`7ef26f66e0fb758bb18808e6187d8094ee444193c2b48064ef57bef19d400278`。增量为两个新增模块及 store、adapter、verify、README，共六个文件。

只针对明确风险读取未变代码：transaction 的 COMMIT/rollback 边界，guard/cancel/recover，synthetic approval/reconciliation/publication，以及 runner 的 heartbeat 停止与等待。未扩展为全库审查，未改源码、测试、依赖或 git，未另派 agent，未重跑完整套件。随后补读已交付的 `task-1-report.md`，逐项核对其提交回执、SIGKILL 遗留和首次夹具失败清理说明。

## 已核对的关键不变量

| 检查项 | 源码依据与判断 |
| --- | --- |
| 持久身份先于输出 | `experiments/t05-durable-worker/recording-output-candidates.mjs:6` 定义 ref 主键、job/attempt 唯一、attempt 外键、完整 owner/queue/retry/digest 与阶段约束；`store.mjs:604` 仅在 reservation 事务返回成功后将该 ref 交给 adapter。COMMIT 异常不调用 prepare。 |
| 排他文件及准备边界 | `local-recording-merge.mjs:173` 使用传入的内部引用并验证 frozen input；`:215` 保留 O_EXCL/O_NOFOLLOW，随后同步文件和目录、回读校验。`store.mjs:619` 的已知失败 catch 仅包住 prepare，准备返回后的 metadata/回读/事务错误不会进入失败重试分类。 |
| 原子 cleaned 与重试 | `store.mjs:629` 在 guard 及候选 fence 下将 reserved→cleaned，与 snapshot、失败审计、预算内延迟入队和确切旧 queue 确认共同提交。未知错误和局部清理失败不产生 cleaned；新 attempt 不覆盖旧候选。 |
| 独立持久发布意图 | `store.mjs:696` 单独提交 prepared→publishing，确认返回后才进入 `:710` 的最终事务；最终 published、artifact、snapshot、attempt 和 queue 确认原子提交。没有 publishing→prepared 或解除未知意图的受支持路径。 |
| 锁序与等待后的有效性 | 所有 store 候选写入先持 job、再持 queue、最后持 candidate。`store.mjs:462` 在候选等待后及可暂停提交点后重新取数据库时间，检查 signal、业务 lease、确切 queue deadline/identity 和 attempt binding。最终发布/失败结算再次检查提交时限；后续再次读取 queue 是已持有锁的读取，不构成反向获取新锁。 |
| 隔离和发布互斥 | `store.mjs:477` 使用相同锁序，并在持锁时核对 frozen input、attempt/candidate 身份、metadata、全部 artifact.ref 和全部 job.resultRef。只允许当前 attempt 与业务都明确 stopped、无业务 lease/有效 queue lease/引用/未知标记的 prepared 隔离；reserved/publishing/published/cleaned 保留。幂等 quarantined 返回前仍检查身份、引用与停止条件。无删除或强制释放接口。 |
| 未知 COMMIT 与取消 | 意图实际提交但回执丢失时保留 publishing；最终 COMMIT 未提交仍为 publishing，已提交则为 published。取消不会把它们变成可隔离 prepared。意图事务实际回滚后，后续拿到全部锁读到 prepared，且终态与无引用等条件成立，才能隔离；这依赖数据库状态证明，不凭错误消息、进程退出或时间猜测。`store.mjs:506` 还保留 outcome_unknown 以及后续取消仍携带的未知恢复 errorCode。 |
| 读取必须受检 | `store.mjs:311` 在 I/O 前后分别联查 published candidate、artifact、成功 attempt 与 job；完整身份及 metadata 必须一致，冻结输入重新验证，实际读文件校验 SHA256，前后结果再作深比较。候选未发布或任一关联漂移均不能仅凭文件存在读取。 |
| 全部发布入口与 runner 接线 | `store.mjs:193` 和 `:353` 在 synthetic reconcile/approval 前拒绝真实 recording；普通 synthetic 路径只产生其自身 poc 引用，受支持入口不能指定其他 recording ref。`runner.mjs:80` 在 before_publication 停止并等待 heartbeat，新增意图/最终事务使用该点后的剩余 lease，并继续接收停止 signal。 |

## 原始证据核对

独立重新计算以下四份 raw report 的 SHA256，与 `verification.json` 的记录全部相符；也逐一重新计算各报告 `sources` 中的当前文件哈希，四组均无不匹配。`verification.json` 的全部 protectedFilesUnchanged 哈希亦匹配当前文件。未仅依赖汇总中的“passed”文字。

| 原始报告 | 场景 / 断言 | 退出及清理 |
| --- | --- | --- |
| `candidates-implementation-final.json` | 45 / 277 | `.exit` 为 0；无残留子进程，集群停止，临时目录删除，errors=[] |
| `merge-final.json` | 52 / 402 | execution 记录退出 0；相同完整 cleanup |
| `failures-final.json` | 42 / 371 | execution 记录退出 0；相同完整 cleanup |
| `t05-final.json` | 39 / 307 | execution 记录退出 0；相同完整 cleanup |

检查了新场景的实际断言和故障注入：创建前可见 committed reserved、reservation 两种提交故障、八个 SIGKILL 边界、唯一性/不覆盖、cleaned 原子回滚与新候选重试、两阶段 COMMIT 真提交/真回滚后的回执异常、双向发布/隔离竞争、未知恢复后取消、上下文重开幂等、全局引用保护、读前/读后漂移、quarantine abort/query/commit 回滚、候选锁等待后的 abort 与实际 lease 到期、原块字节保持不变。旧回归继续覆盖实际 FFmpeg、runner heartbeat/shutdown、输入身份、撤权/删除及失败分类。

`candidates-red.json` 的退出码为 1，失败点是缺少“输出创建前存在已提交候选”的行为断言，且 cleanup 完整。首次 green 的 pool.connect callback 包装缺陷被单列为失败，不计入成功证据；当前 `output-candidate-scenarios.mjs:62` 正确将 callback 形式交回原 connect。已读 `candidates-green-1-external-cleanup.json`：记录本次精确私有目录、PostgreSQL shutdown 日志、pg_ctl status=3、所属 PID 不存在与目录清除，未声称该失败运行产生了完整 raw report。

## 限制与计划冲突

- 本次没有重新运行故障套件；使用与当前源码逐哈希对应的既有最终运行结果，并独立检查实现及断言。历史资源清理由既有原始记录支持，本次未重演已结束进程的生命周期。
- 数据库与文件系统没有共同事务，reserved/publishing 可以长期保留；本批没有物理 GC。SIGKILL 留下的 helper temp 文件由测试记录，最终随本次所属隔离目录清理，不构成业务输出删除授权。
- 身份与 prepared metadata 的不可变性按任务要求由受支持 API 保证；直接 SQL 的全权篡改不是完整性安全边界。跨 job 引用查询的互斥结论也依赖受支持发布入口，不涵盖绕过 API 的任意并发写库。
- 应用全量检查由协调线程另行保存；本审查未重复审计应用测试日志，规格/质量 verdict 不依赖它们替代 PoC 证据。
- **计划强制冲突：无。** 独立审查已按本轮只读、无子 agent、无重复全套测试约束完成；未发现需要以计划要求为由接受的实现缺陷。

# Task 1 实现报告：私有输出候选与发布互斥

状态：实现与真实专用验证完成，交独立审查；未 commit/push/deploy。所有既有工作区改动保留。源码最后修改后运行的 `candidates-implementation-final.json` 为本实现的最终证据：45 场景、277 断言、退出 0。

## 修改范围与接口

新增 `experiments/t05-durable-worker/recording-output-candidates.mjs` 和 `output-candidate-scenarios.mjs`；修改同目录 `store.mjs`、`local-recording-merge.mjs`、`verify.mjs`、README。没有修改 runner/supervisor/外部清理观察器、旧 merge/failure 场景、通用状态机、生产 TS helper、依赖、主计划、handoff 或研究记录。

- `poc_recording_outputs`：ref 主键、`(job_id, attempt)` 唯一且关联 attempt，持久保存 worker、queue ID/retryCount、冻结 input digest、metadata、创建/准备/发布意图/发布/清理/隔离时间。CHECK 约束限制状态及 metadata/时间戳一致性。支持状态 reserved、prepared、publishing、published、cleaned、quarantined；不删除身份记录。
- 内部 candidate 模块只提供身份验证和 SQL；store 持有事务与锁。受支持 API 不修改身份或 prepared metadata，不提供逆转、复用或强制释放未知结果的入口。直接 SQL 的超级用户恶意改写不是安全边界；测试直接 SQL 用于注入漂移。
- `prepare(frozen, { ref, signal, checkpoint })` 接收已登记内部引用，保留引用格式校验、O_EXCL、同步、回读和局部清理；不再生成引用，不接受输出路径。
- `quarantineRecordingOutput(context, id, { ref, attempt, inputDigest, signal })` 返回 `{status:'quarantined', ref, state}` 或 `{status:'retained', ref, state, reason}`。输入/候选/attempt/queue 身份或 metadata 不符、查询失败、signal 取消、提交失败均抛错；不提供文件路径参数，不做 unlink/TTL/物理 GC。
- `readPublishedRecording` 在实际文件读取前后，分别核对同一已发布候选、artifact metadata、成功 attempt、冻结输入和业务 resultRef，读回后再次比较完整身份。
- 新入口 `--only-output-candidates`，可用 `--output-case=` 子串筛选；无匹配时报错。原 merge/failure 入口保持可运行。

## 状态与事务边界

1. 在原 guard 下取得 job → queue 锁，INSERT reserved；reservation COMMIT 确认成功后才传 ref 给 adapter。回滚/回执丢失均不调用 prepare。
2. prepare 完全返回后退出已知失败 catch；核对 ref/metadata，以新事务持 job → queue → candidate 锁，将 reserved → prepared。已知 prepare 错误且局部清理成功时，reserved → cleaned 与失败审计、预算内重试入队、旧 queue 确认同事务提交；未知和清理异常保持 reserved。
3. prepared → publishing 为独立持久事务，验证完整身份及准备 metadata，确认 COMMIT 后才能开始最终发布事务。
4. 最终事务要求 publishing，并原子提交 published、artifact、snapshot、attempt 成功及确切 queue 确认。意图已提交但回执丢失，或最终 COMMIT 结果未知，都不会回退/回收。若意图事务实际回滚，数据库保持 prepared；后续取得全部锁且证明终态、无引用、无未知标记，才可能隔离。
5. 每次 candidate 锁取得后，以及 reservation/prepared/publishing 可暂停提交检查点后，`candidateFence` 重新检查 signal、DB clock、lease、queue 截止/身份和 attempt。最终发布/失败结算保留原来的最后 DB clock 与 fence。
6. 隔离取得 job → queue → candidate 锁后检查 frozen/candidate/attempt、DB clock、业务终态及所有 artifact.ref 和所有 job.resultRef。只允许当前 attempt 明确 cancelled/failed、无业务 lease、无有效 active queue lease、无引用的 prepared → quarantined；quarantined 幂等返回前仍核对这些条件。reserved/publishing/published/cleaned 保留；outcome_unknown 及后来 cancelled 仍携带 `lease_expired_after_dispatch_unknown` 的序列继续保留。

新增检查点：`before_output_reservation_commit`、`output_reserved`、`merge_output_create`、`merge_file_prepared`、`before_output_prepared_commit`、`before_output_publishing_commit`、`output_publishing`。原 `merge_prepared` 现在表示 prepared 已提交，原 `before_publication`/`before_commit` 继续工作。

## RED / GREEN 与退出码

使用技能：test-driven-development、verification-before-completion。初始 RED 先于候选模块/adapter/store 实现：现有系统能完成音频合并，但没有“创建输出前已提交 reserved”检查点；行为断言 `file creation checkpoint observed committed reservation` 失败。RED 不以导入错误或语法错误代替目标行为失败。

命令在仓库根目录运行：

```bash
SAGA_FFMPEG_PATH=/Users/eat/.codex/handoffs/videocut/2026-10-06-video-upgrade/evidence/runtime/ffmpeg-macos-x86_64-v7.1 node experiments/t05-durable-worker/verify.mjs --only-output-candidates docs/research/evidence/2026-10-16-t05-output-candidates/candidates-red.json
SAGA_FFMPEG_PATH=/Users/eat/.codex/handoffs/videocut/2026-10-06-video-upgrade/evidence/runtime/ffmpeg-macos-x86_64-v7.1 node experiments/t05-durable-worker/verify.mjs --only-output-candidates docs/research/evidence/2026-10-16-t05-output-candidates/candidates-implementation-final.json
```

证据都在 `docs/research/evidence/2026-10-16-t05-output-candidates/`，每次实现运行均保留独立 `.log`、`.exit`，未覆盖前批。

| 运行 | 退出码 | 结果 |
| --- | --- | --- |
| candidates-red | 1 | 目标行为缺失；完整 cleanup，无残留 |
| candidates-green-1 | 1 | 测试夹具 pool.connect 包装遗漏 callback 转发，导致 pool.query 挂起；SIGTERM 后原始报告未成功写出，另有 external-cleanup 证据 |
| candidates-green-2 | 1 | 17 场景通过后，测试对已经 succeeded 的 job 调用 cancelJob；修正夹具只取消非终态 |
| candidates-green-3 | 1 | 21 场景通过后，测试将“取消 queue 已确认的旧 worker”误期望为 cancelled；实际安全结果是 duplicate |
| candidates-green-4 | 1 | 24 场景通过后，拒绝断言遗漏已有 frozen input changed 错误文字；扩充断言匹配 |
| candidates-green-5 | 0 | 40 场景、242 断言；此后补5项事务/漂移测试与README |
| candidates-implementation-final | 0 | 最终源码45场景、277断言，约21秒，完整cleanup |

最终覆盖包括 reservation 两种 COMMIT 故障、8处真实 SIGKILL、unique attempt/ref、排他输出不覆盖、已知永久错误清理原子回滚、临时错误新 candidate/预算耗尽、未知异常保留、意图与最终发布各两种 COMMIT 故障、取消后隔离/重开幂等/不复用、未知恢复后取消、两种发布与隔离锁竞争、伪造/漂移身份和 metadata、读前读后漂移、隔离 query/commit/abort 回滚、候选锁等待后的 abort 和实际5.2秒 lease 到期，以及原始源块不变。

协调线程按同一最终源码运行并提供的旧回归原始证据已读取：`merge-final.json` 为52场景/402断言，`failures-final.json` 为42/371，`t05-final.json` 为39/307，均 status=passed、cleanup完整。退出码及应用全量命令由协调线程的验证汇总保存；本实现未重复运行这些完整套件。

## 源码哈希、运行时与清理

最终运行：Node v22.22.2、PostgreSQL14.17、pg-boss12.37.1、pg8.16.3、FFmpeg7.1。FFmpeg SHA256 为 `4a4a968b98859588e98500ae25973d80a5ca5eed0724222b9f76360dcb72a001`；只使用指定已有本地二进制。

`implementation-audit.json` 逐一验证最终证据的19份 source hash，全部与当前磁盘一致。基线24份文件中，仅4份预期既有文件发生变化；其余20份（含保护的 TS helpers/状态机、依赖、runner、supervisor、旧场景、next-env、主计划和handoff）原字节一致。另新增2份源码文件。

| 文件（均位于 experiments/t05-durable-worker） | 最终 SHA256 |
| --- | --- |
| recording-output-candidates.mjs | `5ef0000d648e0242edcf378d439b6d82da9ab435ebc4d5276fa70cc59ff3f225` |
| output-candidate-scenarios.mjs | `8ad34d44ba0da50f0e92317d1939fd7b8135f5cec5999bbe9cf05fde23e540df` |
| store.mjs | `30ff73eecfb01fb2ef1937dc46cf2a8150b711e8b779ebb603a040d383618e86` |
| local-recording-merge.mjs | `0b86c400ec5ceed3f2dccb0d0b860d792d86e2d3ddf6f510976f78c53fd5d4ce` |
| verify.mjs | `eaea542a6ad5f6bb0e281f9e1b9fa2d80fe5f59adb0ced38a6533b1ab1862837` |
| README.md | `6049bc52e01535fae822030e1f59cc2db1ae8de0586a3d63f31efe81df1d71ca` |

最终 cleanup：`ownedChildrenRemaining=0`、`clusterStopped=true`、`tempDirectoryRemoved=true`、`errors=[]`，`remainingGroups=[]`、`remainingRunnerPids=[]`、`directOperationsRemaining=0`。RED及green-2到green-5也有完整cleanup。

green-1 的夹具缺陷单列，不计作成功证据：SIGTERM收尾关闭数据库时，泄漏的checked-out client抛未处理连接错误，未写raw JSON/删除临时目录。保存的 `candidates-green-1-external-cleanup.json` 核对本次准确 `/tmp/saga-t05-eTf9iE` 配置、日志和 PID（harness81261/postmaster81314），`pg_ctl status` 退出3、两PID已不存在，随后删除该已停止的本次目录。没有对其他集群/目录清理；此夹具已按既有测试正确转发 callback 修复。

SIGKILL发生在helper内部时，可留下本次私有temp文件；测试记录 `outputCandidateCrashScratch`，核对后续操作没有新增意外残留，最终由harness移除所属整棵目录。没有将文件年龄、进程退出或暂时无引用用作业务回收许可。

运行 `node --check` 检查5份修改/新增 mjs 均退出0；`git diff --check` 无输出。由于源码原本未跟踪，另对6份完整增量执行 `git diff --no-index --check`，均无空白错误（该命令退出1表示文件存在差异，已在audit明确记录）。

## 自审与待独立审查关注点

- 已逐一核对“候选锁等待后时钟”和“提交检查点后时钟”；candidate锁不会延长lease。隔离与发布共用job首锁，避免candidate→job逆序。测试里的独立candidate阻塞锁只用于真实竞争注入。
- 发布意图独立事务是本批关键：意图/最终COMMIT回执不确定不可用cancelled覆盖；未知lease恢复留下的errorCode也不能通过后来取消清除保留要求。
- 全部已知失败分类仅在prepare返回前，candidate cleaned与失败业务/审计/queue同事务；发布阶段异常不进入重试分类。
- 对任意artifact引用、其他job.resultRef、quarantined幂等的引用复查均有用例；quarantined状态无物理删除授权。
- 最终专用/旧回归通过不是正式Storage/G1验收。文件系统与数据库没有共同事务，reserved/publishing可能永久保留；本批未提供管理员强制释放、GC、自动复用或生产schema迁移。
- 身份/metadata不可变约束是受支持store/module API保证；实验DB具有直接SQL访问能力，不声称阻止超级用户同时篡改所有绑定。独立审查重点仍为发布意图、锁顺序、COMMIT不确定性和隔离条件。

归档说明：以上实现者基线核对截至源码交接；主计划/handoff由协调线程随后更新，未包含在实现者代码变更范围中。

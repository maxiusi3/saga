# T05 私有输出持久登记与发布互斥 Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for the coupled implementation and independent review. Continue the authorized dirty checkout; this local batch is not a release milestone.

**Goal:** 为每次本地合并登记唯一私有输出，并证明发布、取消和隔离声明之间不会产生可发布又可回收的结果。

**Architecture:** 先提交候选身份，再允许文件创建；准备完成后持久记录不可变元数据。独立事务先写入发布意图，最后发布事务同原业务状态/attempt/queue确认一起将候选变为published。隔离声明使用相同锁序，只接受已明确停止且尚未进入发布的prepared候选；本批不删除任何文件。

**Tech Stack:** Existing Node22, PostgreSQL14, pg-boss12.37.1, pg8.16.3, local FFmpeg7.1.

**Spec:** [保留/回收契约](../../research/2026-10-16-t05-merge-failures.md#私有输出保留与未来回收契约)、[P1契约](../specs/2026-10-13-upgrade-p1-contracts.md)、[handoff下一步](../../HANDOFF-2026-10-13-upgrade.md#下一步执行顺序)。

## Global Constraints

- 仅使用隔离的 `/tmp/saga-t05-*` PostgreSQL/socket和虚构本地音频。不接正式路由/Storage，不迁移、部署、扫描真实家庭或调用付费API。
- 保留所有原有修改和历史证据；不改依赖、通用状态机或生产TS helper。仅原计划里程碑达成后才允许提交/推送。
- 输出存在、文件年龄、进程退出、过期租约和暂时无引用均不足以允许回收。未知发布COMMIT仍保留，不自动重试、复用或删除。
- 候选身份至少绑定reference、job、attempt、worker、queue ID/retryCount和冻结输入digest。不得接受任务提供的文件路径，不修改原始块。
- 所有候选写操作使用job→queue（需要时）→candidate锁序；等待后复查signal、数据库时间及适用的原有guard。不能用candidate→job逆序。
- 回收范围仅为持久隔离声明；没有unlink/TTL扫描/物理GC。不得新增凭日志或管理员猜测强制释放未知结果的接口。
- 已知prepare错误仍只在prepare返回前且局部清理成功时分类；通用FFmpeg错误保持未知，不匹配message/诊断。

### Task 1: 候选生命周期、事务接线和真实故障验证

**Files:** 新增 `experiments/t05-durable-worker/recording-output-candidates.mjs`（候选SQL/identity/state校验）与 `output-candidate-scenarios.mjs`（专用故障测试）；修改 `store.mjs`、`local-recording-merge.mjs`、`verify.mjs`、README。必要时仅调整旧merge场景的行为断言；不重构runner/supervisor/外部清理观察器。

**Interfaces:** `prepare(frozen, { ref, signal, checkpoint })`消费已持久登记的内部reference，保留O_EXCL写入/同步/回读和局部清理。`quarantineRecordingOutput(context, id, { ref, attempt, inputDigest, signal })`返回明确的隔离或保留状态；未匹配身份、查询失败、取消signal应拒绝且不产生声明。它不接受文件路径、不删除文件。候选模块内部API由实现确定，但锁与事务由store控制。

- [x] 写独立真实PostgreSQL行为用例，先运行RED并保存退出码与完整清理报告。例如在输出文件创建前的checkpoint查询候选，必须已有committed reserved身份，且output尚不存在；成功后candidate与artifact/snapshot一致，不能绕过candidate直接读文件。

```js
// 使用既有harness的实际SQL、trackOperation、worker/checkpoint和断言设施。
const result = await processOne(context, { workerId, jobId, checkpoint });
equal(result.status, 'succeeded');
equal(candidate.state, 'published');
equal(candidate.ref, snapshot.resultRef);
equal(candidate.input_digest, attempt.input_digest);
```

- [x] schema创建 `poc_recording_outputs`，reference及(job_id, attempt)唯一；存身份、状态、创建/准备/发布意图/发布/隔离时间及准备元数据。身份和prepared元数据按受支持API不可更改；任何不一致均拒绝。可用状态为reserved、prepared、publishing、published、cleaned、quarantined，禁止不安全逆转。保留身份记录，即使文件从未创建。
- [x] 在文件prepare前按guard持锁保留候选，事务commit成功后才把reference交给adapter。COMMIT异常不调用prepare。重复投递/同一attempt不能换reference或覆盖候选。adapter保留reference格式校验与O_EXCL，不再自己生成未登记的引用。
- [x] prepare完全返回、清理成功且回读通过后，持锁guard将reserved变为prepared并存metadata；checkpoint能验证准备提交前后崩溃。prepare已返回后的错误不能进入已知失败catch。已知失败结算事务可以将reserved变为cleaned，与失败审计/重试/queue确认原子完成；未知和cleanup失败保持reserved。
- [x] 发布前新增独立持久意图事务prepared→publishing，复用guard并验证全部候选身份/metadata；只有这次事务确认提交后才进入最终发布事务。发布最终事务核对publishing候选，与artifact、snapshot、attempt和queue确认一起提交published。意图可能已提交但回执丢失或最终COMMIT结果未知均不得自动回退/回收。
- [x] `readPublishedRecording`的前后两次读取均要求匹配的published候选、artifact元数据、输入/attempt身份。synthetic review/reconcile路径继续拒绝真实recording，不引入旁路。
- [x] 隔离API在锁内核对冻结输入/候选/attempt、当前业务状态与所有artifact引用。仅prepared且对应attempt明确cancelled或failed、没有resultRef/任何artifact引用、没有正在执行的lease/未核对发布意图时允许prepared→quarantined。reserved/publishing/published、outcome_unknown、active或身份漂移一律保留/拒绝；quarantined幂等返回前仍核对身份与引用。取消/查询失败/提交失败整笔回滚。
- [x] 真实故障覆盖：保留事务回滚及回执丢失不写文件；文件准备前后退出保留候选；重复attempt/ref拒绝；已知失败和有界重试每次新候选；unknown异常保留；两种发布COMMIT回执故障；prepared取消后隔离并保留文件；pending发布与隔离两种锁竞争顺序；锁等待后abort/lease到期；伪造或漂移identity/metadata拒绝；已发布ref永不隔离；重开context后隔离幂等且不复用文件；原块字节不改。
- [x] 增加 `--only-output-candidates` 入口和可选 `--output-case=`筛选，沿用真实helpers/FFmpeg与资源所有权清理，报告源码哈希、场景、断言、运行时和清理。旧merge/failure入口维持可运行。
- [x] 运行新场景及必要旧merge/failure回归，自审后写实现报告并提交给独立review。不得提交git。

### Task 2: 最终验证、交接与里程碑核对

**Files:** 新研究记录 `docs/research/2026-10-16-t05-output-candidates.md`、证据目录 `docs/research/evidence/2026-10-16-t05-output-candidates/`、本计划、主计划及handoff。

- [x] 独立审查相对于本批保存基线的完整增量，重点核对publication-intent与quarantine锁竞争、未知COMMIT、安全保留及真实测试证据；修复后定向复审。
- [x] 最终源运行output candidates、merge failures、merge与原T05回归。不重复无关300秒soak或未改的外部观察器。

```bash
SAGA_FFMPEG_PATH=/Users/eat/.codex/handoffs/videocut/2026-10-06-video-upgrade/evidence/runtime/ffmpeg-macos-x86_64-v7.1 node experiments/t05-durable-worker/verify.mjs --only-output-candidates docs/research/evidence/2026-10-16-t05-output-candidates/candidates-final.json
SAGA_FFMPEG_PATH=/Users/eat/.codex/handoffs/videocut/2026-10-06-video-upgrade/evidence/runtime/ffmpeg-macos-x86_64-v7.1 node experiments/t05-durable-worker/verify.mjs --only-merge docs/research/evidence/2026-10-16-t05-output-candidates/merge-final.json
SAGA_FFMPEG_PATH=/Users/eat/.codex/handoffs/videocut/2026-10-06-video-upgrade/evidence/runtime/ffmpeg-macos-x86_64-v7.1 node experiments/t05-durable-worker/verify.mjs --only-merge-failures docs/research/evidence/2026-10-16-t05-output-candidates/failures-final.json
node experiments/t05-durable-worker/verify.mjs docs/research/evidence/2026-10-16-t05-output-candidates/t05-final.json
npm run verify
npm test --workspace=packages/shared -- --runInBand
npm run test:infra
git diff --check
```

- [x] 保存并恢复本批构建前next-env原字节；最终核对source hashes、进程/数据库/目录清理及保护文件不变，存验证汇总。
- [x] 文档明确：publishing含不确定intent/COMMIT均保留；prepared隔离须终态及互斥证明，quarantined仅表示禁止发布，尚无物理删除；本地证据不是正式Storage语义或G1真机验收。
- [x] 更新handoff、主计划和本计划进度，核对G0/G1、依赖审计现有证据。条件未满足则保留分支不推送，不把新增本地批次冒充里程碑。

## 最终结果

Task 1–2完成。[独立审查](../../research/evidence/2026-10-16-t05-output-candidates/review-initial.md)规格/质量PASS，零Critical/Important/Minor。专用候选45/277、完整合并52/402、失败重试42/371、原T05 39/307均在本批最终源码运行并通过；全部source hash及资源清理核对一致。项目verify76/730与175页、shared4/16、infra7通过，next-env原字节恢复。

[本批记录](../../research/2026-10-16-t05-output-candidates.md)、[验证汇总](../../research/evidence/2026-10-16-t05-output-candidates/verification.json)、主计划、handoff与docs索引已更新。候选quarantined仅为禁止发布声明，没有物理GC；未知结果与原始块继续保留。依赖未改，复用前批实际audit42项，G0/G1外部证据仍缺，未提交、推送、迁移或部署。保留本批ignored基线和ledger，供未提交工作续接。

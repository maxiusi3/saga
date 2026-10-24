# T05 本地合并已知错误与有界重试 Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan and independently review the incremental diff. This is a continuation of the authorized handoff, not a new release milestone.

**Goal:** 将本地合并中可证实未发布的输入/解码错误持久分类，让暂时故障有界恢复，保留未知结果的隔离。

**Architecture:** T04 helpers 在实际失败处产生结构化错误，实验 adapter 只在 prepare 尚未成功返回的阶段接受明确的已知失败。T05 持锁复核业务/队列/输入及取消状态后，同事务写失败尝试、业务状态、旧队列确认和必要的新延迟消息。已准备输出及发布阶段错误沿用未知结果隔离；不以异常文字推断可重试性。

**Tech Stack:** Existing Node 22 / PostgreSQL 14 / pg-boss 12.37.1 / TypeScript / Jest / local FFmpeg.

**Spec:** [P1契约第4及6节](../specs/2026-10-13-upgrade-p1-contracts.md)、[综合计划T04/T05](../../2026-10-10-integrated-upgrade-plan.md)、[handoff下一步第3项](../../HANDOFF-2026-10-13-upgrade.md)。

## Global Constraints

- 本地虚构音频、临时 PostgreSQL/socket；不接生产路由、远端 Storage、迁移或付费 API。
- 保留既有工作树。现有 G0/G1 仍需独立证据，本批不是发布里程碑。构建前保存并恢复 next-env.d.ts。不改依赖或覆盖历史证据。
- 未知 COMMIT 不自动重试、复用或删除私有输出；取消/撤权/删除/失租及输入变更不能因错误分类绕过。
- 每次尝试使用原任务的 maxAttempts；重试不重置计数，不产生模拟供应商调用；领取及写回维持相同 queue ID/retryCount/business attempt/input digest fence。
- 错误记录只保存固定 code / disposition / phase，不持久化路径、原始诊断或任意错误消息。

## Task 1: 结构化失败与原子重试

**Files:** 新增 `packages/web/src/lib/server/recording-processing-error.ts`；修改 `recording-merge-executor.ts`、`recording-audio-decoder.ts` 及其现有测试；修改 `experiments/t05-durable-worker/local-recording-merge.mjs`、`store.mjs`、`verify.mjs`、`merge-scenarios.mjs`、README；可新增专用 `merge-failure-scenarios.mjs` 避免继续扩大原场景文件。不修改通用 `processing-jobs.ts` 状态机，复用现有 transition/retry helper。

**Interfaces:** helper 新增 `RecordingProcessingError`，包含稳定 code、`permanent | transient` disposition；实验只信任真实 helper/adapter 的结构化错误身份。`processOne` 对已持久处理的已知错误返回 `failed | retry_wait`，让 runner 继续消费；无法可靠持久处理时保持抛错/原隔离路径。

- [x] 写失败回归并保存 RED：缺源、大小/hash不符、非法文件、无有效PCM、时长上限的明确失败可持久分类；暂时读取超时可重试；未知普通 Error 仍不得被解释为已知故障。通用解码退出按下述审查裁定保持保守。

```js
const result = await processOne(context, { workerId: 'failure-test', jobId });
assert.equal(result.status, 'failed');
assert.equal((await getJob(jobId)).snapshot.state, 'failed');
assert.equal(await artifactCount(jobId), 0);
assert.equal(await callCount(jobId), 0);
```

示例断言用现有 harness 的实际查询/断言设施实现，不增加仅镜像实现的测试。RED 必须来自缺失行为而非错误夹具。

- [x] 在真实失败点发出固定分类：缺源、大小/hash不符、非私有regular file、成功解码进程无有效PCM/实际时长超限为永久失败；adapter 自己触发的源读超时和明确暂时源读取 OS 错误为暂时失败。FFmpeg不可用、通用非零退出/诊断、内部未知异常及未明确判定的资源问题保持保守异常。不要匹配 message 或诊断文字；用户/停止信号的 reason 即使伪装成可重试错误也不能触发重试。为接口兼容保留现有 message 文本。
- [x] 只有 `prepare` 尚未成功返回且已正常回收本次局部产物的已知错误可持久分类；准备后回读、guard、输出提交/COMMIT异常不得落入该 catch。cleanup失败不得被已知错误掩盖后继续重试。
- [x] 分类事务按 job→queue 加锁，复用 guard 并在异步后检查 abort；重新核对数据库时钟与 live lease、queue deadline、owner/attempt/input binding、权限/墓碑。永久失败清 lease/notBefore、保存 errorCode，更新本次 attempt，并确认当前 envelope；错误审计保存在该 attempt 的实验字段，保留前次失败。
- [x] 暂时错误使用 `retryProcessingJob`，延迟 `min(1000 * 2 ** (attemptCount - 1), 5000)` 毫秒；到 maxAttempts 则 failed。未耗尽时，在同事务内发送仅含 jobId 的新消息、保存 retry_wait 与 notBefore 并确认旧 envelope。保持原任务 expire/heartbeat限制；新消息的 startAfter 不早于 notBefore。重复消息在未到期前安全确认且不消耗新的业务attempt，不得靠抛错反复重启runner。发生事务/队列确认失败时整笔回滚，不丢任务、不发送孤立重试。
- [x] 真实PostgreSQL验证：暂时故障修复后一次成功发布；持续失败耗尽预算；重复消息/重开context不绕过退避；失败写入/新消息/队列确认任一步失败整笔回滚；锁等待后lease过期、queue attempt改变、取消/撤权/删除/输入变化、停止信号不能重试或发布；伪造code的普通Error拒绝分类。沿用并核对原 COMMIT 成功但回执丢失/实际未提交和准备后崩溃场景。
- [x] 单元测试覆盖结构化code及取消优先；本地运行覆盖源流超时、真实FFmpeg拒绝与进程清理；更新旧负例的期望结果以反映明确的终态。存证命令退出码、来源哈希、环境、断言及清理结果。现有清理故障观察器仅在其覆盖逻辑被改变时重跑。
- [x] 独立审查增量差异并修复问题；无里程碑证据时不提交/推送。

## Task 2: 最终验证、保留契约与交接

**Files:** `docs/research/2026-10-16-t05-merge-failures.md`、新证据目录 `docs/research/evidence/2026-10-16-t05-merge-failures/`、主计划、handoff、当前计划进度。

- [x] 对最终源码运行本批已知错误场景、完整真实合并场景；原T05已在本轮运行，R1未修改其实际执行源码时按逐项哈希复用，并明确旧报告附带的README/合并场景指纹不再当前。不得将复用写成重跑；不重复无关300秒soak。

```bash
SAGA_FFMPEG_PATH=/absolute/existing/ffmpeg node experiments/t05-durable-worker/verify.mjs --only-merge docs/research/evidence/2026-10-16-t05-merge-failures/merge-final.json
node experiments/t05-durable-worker/verify.mjs docs/research/evidence/2026-10-16-t05-merge-failures/regression-final.json
npm run verify
npm test --workspace=packages/shared -- --runInBand
npm run test:infra
git diff --check
```

- [x] 补充私有孤立文件保留/未来回收契约：已提交引用、正在prepare/commit的attempt和未知提交都不可仅凭文件年龄删除；未来GC需持久候选身份、发布/回收互斥及提交结果核对。本批不新增自动GC，不删除原始块或未知输出。
- [x] 保存最终验证汇总和独立审查，核对新文档链接、源哈希及受保护文件。恢复构建前next-env。
- [x] 更新handoff、主计划与批次记录，区分本地完成、远端只读前置缺失、G0/G1未完成；核验原计划里程碑后才推送GitHub。

## 独立审查裁定（2026-10-16）

R1确认通用非零退出或短stderr不能区分输入错误与运行时/资源故障。以P1真实失败和保守恢复约束为准，收窄原计划“解码拒绝永久失败”：只有已明确的无有效PCM与实际时长上限仍可分类；通用退出/诊断保持未知，不引入诊断字符串匹配。代价是部分损坏音频仍需后续核对，不能仅凭当前FFmpeg接口自动结束为永久输入错误。补启动后exit127及资源exit1回归，复查准备后与未知COMMIT保护。

## 完成记录

Task 1–2完成。[最终复审](../../research/evidence/2026-10-16-t05-merge-failures/review-final.md)关闭R1，无新增Important/Critical。修复后故障42/371、完整合并52/402、定向69、Web76/730与175页构建通过；shared4/16、infra7及原T05的39/307按记录边界保留。新的相关源码指纹与清理全部核对，next-env恢复，依赖/通用状态机/runner/supervisor/清理观察器保持本批起点。

主计划、handoff及[实施记录](../../research/2026-10-16-t05-merge-failures.md)同步；[最终汇总](../../research/evidence/2026-10-16-t05-merge-failures/verification.json)记录原T05复用范围。审计仍42项，G0/G1未通过，没有提交、推送或部署。保留本批scratch基线与ledger供未提交工作续接。

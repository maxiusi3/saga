# T04 本地流式合并与实际解码实施计划

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans. 本批沿用用户已有工作树，不提交或部署。

**Goal:** 将既有录音合并契约推进为可执行的、逐块校验原始字节并实际解码的本地处理能力。

**Architecture:** 在独立 Node 处理模块中按可信任务清单读取流、顺序写临时文件、核对每块及总输出指纹，再用受限 FFmpeg 子进程实际解码。仅在消费回调存活期间提供验证过的临时原件；无数据库、队列、Storage 或 API 接入。

**Tech Stack:** TypeScript、Node streams/fs/child_process、Jest、独立 FFmpeg。

**Spec:** [P1 契约第 6 节](../specs/2026-10-13-upgrade-p1-contracts.md)、[前批合并契约](../../research/2026-10-15-t04-server-merge-contract-local.md)。

## Global Constraints

- 暂不部署、不推送、不执行远端迁移、生产写入、真实家庭资料扫描或付费供应商调用。
- 保留当前工作树及前序未提交修改。本批不接入 HTTP 请求、正式上传、数据库 ready 更新或本地草稿清理。
- 原声保留原始连续字节，不用重编码文件替代。播放/解码成功不能证明录音尾部未丢失。
- 仅接收未来 adapter 已授权并冻结的任务清单；bucket/key 是定位信息，不代表权限。未来写回仍须重查权限/墓碑及租约，并验证已封口清单。
- 所有新逻辑先做有意义的失败测试；完整项目以 `npm run verify` 为出口。

## Task 1: 合并处理器与 FFmpeg 解码器

**Files:**
- Create: `packages/web/src/lib/server/recording-merge-executor.ts`
- Create: `packages/web/src/lib/server/recording-audio-decoder.ts`
- Test: `packages/web/src/lib/server/__tests__/recording-merge-executor.test.ts`
- Test: `packages/web/src/lib/server/__tests__/recording-audio-decoder.test.ts`

**Interfaces:**

```ts
withVerifiedRecordingMerge<T>(input: RecordingMergeTaskInput, dependencies: {
  readChunk: (chunk: RecordingMergeChunk) => Promise<AsyncIterable<Uint8Array>>
  decodeAudio: (filePath: string, mimeType: string) => Promise<{ durationMs: number }>
  maxInputBytes: number
  tempRoot?: string
}, consume: (artifact: {
  filePath: string
  mimeType: string
  completion: RecordingMergeCompletionEvidence
}) => Promise<T>): Promise<T>

createFfmpegRecordingDecoder(options: {
  executable: string
  timeoutMs: number
  maxDurationMs: number
}): (filePath: string, mimeType: string) => Promise<{ durationMs: number }>
```

- [x] RED：真实临时目录和内存异步块流覆盖乱序清单排序、精确原件输出、块缺失/错误大小/hash/流失败、超限、恶意任务修改、解码失败与所有出口清理；不对模拟内部结构做断言。
- [x] GREEN：重新从快照构建并校验输入幂等键/总量，限制安全整数总字节，先验证再读取；按序流式写入，不整段 Buffer.concat；每块校验字节与 SHA-256，流迭代器失败/提前终止正确关闭。
- [x] 验证：调用实际解码依赖后再生成 completion；回调取得的是未经重编码的文件。成功、读取/解码失败、回调失败均移除本次私有临时目录；不能触碰其它目录或源块。
- [x] RED/GREEN：FFmpeg 以参数数组 spawn（无 shell），允许明确支持的 WebM/Opus、MP4、Ogg 输入，固定 demuxer 并禁止网络/外部引用；完整解码成固定采样率 PCM，以实际样本数计算正时长。限制运行时间、解码输出长度及诊断量；不可用、非零退出、零样本、超时、时长超限均失败并终止子进程。测试使用本地 Node 可执行 fixture 模拟子进程边界，不要求系统 FFmpeg 才能跑日常 Jest。
- [x] 定向回归、类型与 lint；记录 RED 和 GREEN 结果，独立规格/质量审查。

## Task 2: 实际解码证据与 G1 交接

**Files:**
- Create: `scripts/verify-recording-merge.cjs`
- Create: `docs/research/2026-10-15-t04-local-merge-execution.md`
- Create: `docs/research/2026-10-15-t04-g1-device-runbook.md`
- Update: 主计划、`docs/README.md`、handoff。

- [x] 用显式 `SAGA_FFMPEG_PATH` 指向可用独立运行时；不修改系统 FFmpeg 或项目 lockfile。脚本编译并调用生产模块，只用临时生成的虚构音频。
- [x] 正例包含 WebM/Opus、MP4/AAC、Ogg；将完整音频切成多块，打乱清单顺序，再经实际执行器与解码器验证原件哈希、大小和时长。负例包含错 hash、缺块、不可解码字节、错误 MIME、时长限额；不记录家庭数据。
- [x] 记录运行时版本/哈希、源码哈希、各检查结果和限制。整理真机矩阵操作步骤、记录模板及缺证据规则，全部未执行项保持未验证。
- [x] 执行 `npm run verify`，仅恢复本轮构建改写的 `next-env.d.ts`，执行 `git diff --check`。
- [x] 更新 handoff：本批完成项、实际测试数、构建警告、远端 adapter/封口/写回与真机 G1 剩余工作。

完成：本批新增41项回归，最终 `npm run verify` 75套/702项通过，Next生成175页面；真实FFmpeg 56项检查通过。独立审查的读流清理P2经真实句柄RED/GREEN和增量复审关闭。实际结果与未接入边界见[实施记录](../../research/2026-10-15-t04-local-merge-execution.md)。

# T04/T05 本地真实文件合并接入

**Goal:** 将已有 T04 流式合并和 FFmpeg 解码接入 T05 隔离 Worker，用真实本地文件证明输出回读、取消和失租隔离。

**Spec:** `docs/superpowers/specs/2026-10-13-upgrade-p1-contracts.md`、综合升级计划 T04/T05；本批延续 handoff 的已授权下一步。

**Architecture:** PostgreSQL 中冻结完整合并清单，队列仅传 job ID；Worker 在事务外读取版本固定的本地块、合并和解码。输出使用私有、唯一且排他的对象名，回读核对大小/hash 后才进入受租约/queue claim/权限/输入版本保护的事务，原子提交产物引用、任务状态和队列确认。文件写入与数据库事务不能跨系统原子化：数据库引用才代表发布；进程死亡或 COMMIT 结果未知时允许保留未引用的私有对象，禁止暴露或自动复用。读取结果必须检查当前权限、删除/取消及输入绑定并再次回读验证。

**Global constraints:** 本地虚构音频、临时 PostgreSQL/socket；不接生产路由、远端 Storage、迁移或付费 API。保留既有工作树。现有 G0/G1 仍需独立证据，本批不是发布里程碑。构建前保存并恢复 next-env.d.ts。不改依赖或覆盖历史证据。

### Task 1: T04 可取消执行

Files: `packages/web/src/lib/server/recording-merge-executor.ts`, `recording-audio-decoder.ts` 及各自的 `__tests__/*.test.ts`。

- [x] 新增向后兼容的 `dependencies.signal?: AbortSignal`，readChunk 的第二个可选参数及 decodeAudio 的第三个可选参数传递同一 signal。关键 async 边界检查 abort；失败关闭迭代器、输出句柄并删除临时目录。
- [x] 解码器返回函数接收第三个可选 signal。预先取消不 spawn；解码期间 abort 杀死自己的 FFmpeg 并等待 close，注销监听器，不把取消当成功。非合作 reader 的 I/O 超时仍由 adapter 负责，不宣称能终止任意注入 Promise。
- [x] 测试先行：预取消、读块中取消、解码完成前取消、消费前取消、FFmpeg 子进程终止与监听清理；已有无 signal 调用保持兼容。保存 red/green 输出并独立审查。

### Task 2: 隔离 Worker 的真实合并 adapter

Files: `experiments/t05-durable-worker/store.mjs`, `runner.mjs`, 新 `local-recording-merge.mjs`；必要时 harness 配置/Worker 适配。

- [x] 冻结合并输入与 job/project/session/asset/version/processor/parameter 身份绑定；可重建 manifest/idempotencyKey 校验；queue 只持 job ID；拒绝相同 job ID 的不同输入，也拒绝同一规范幂等键用不同 job ID 重复入队。
- [x] 本地 reader 从受控私有根目录及内部派生文件名读取，无用户绝对路径/遍历或符号链接；定额、限时且取消合作。FFmpeg 使用显式本地 executable、既有真实 T04 helper；全过程在数据库事务外，持续 heartbeat 覆盖 I/O/解码。
- [x] 写唯一私有输出且排他创建，sync 后从磁盘回读核对 size/hash；完成后重查 allowed、cancel/deletion、租约、queue claim 及冻结输入/版本再提交引用。真实合并不插入模拟 provider 调用账本。
- [x] 输出仅能经受检读取入口由已发布引用访问；权限撤销、删除、版本变化、输出丢失/篡改均拒绝。未知提交/崩溃遗留仅为私有孤立文件；本批不实现 GC 或人工结果复用，明确拒绝 real merge 走 synthetic review/reconcile 分支。
- [x] runner 的 abort/shutdown 传到 reader 和 decoder；heartbeat 覆盖整个合并工作，到最终提交前才停止并 join；保持原 synthetic 流程。

### Task 3: 故障证据、审查和交接

Files: 新 `experiments/t05-durable-worker/merge-scenarios.mjs`、扩展 `verify.mjs`，新 `docs/research/evidence/2026-10-16-t04-t05-merge/`、实施记录和 handoff。

- [x] 用现有 harness 自建/清理数据库，编译真实 TS helpers、生成虚构 WebM/MP4/Ogg 音频并实际解码；证明原块不变、数字排序、输出 hash/大小/duration 和事务引用一致。
- [x] 测试重复投递、坏块/缺块、输出篡改、输入版本/manifest 变化、撤权/删除/取消、失租、读取/解码中止、发布前进程死亡和旧 Worker 迟到；未提交引用不可读，保留孤立文件不得误当发布。
- [x] 跑原 T05 场景回归和本批真实文件场景；不重复无关5分钟 soak；若修改监督逻辑则跑相应关闭故障。独立规格/质量审查，修复后复审。
- [x] `npm run verify`、shared/infra，恢复 next-env，记录源码指纹、运行时及命令退出码。
- [x] 更新主计划及 handoff，明确本地完成与 G0/G1 未完成边界；仅达到原计划里程碑才提交/推送。

## 完成记录（2026-10-16）

Task 1–3 均完成。[最终独立复审](../../research/evidence/2026-10-16-t04-t05-merge/review-final.md)确认两处异常回收 P2 已关闭，新增规格及代码质量问题均为 0。真实合并 52 场景 / 396 项、原 T05 回归 39 场景 / 307 项、实际解码异常清理 6/6、观察器故障清理 3/3 通过；项目 verify 为 Web 75 套 / 716 项及 175 页构建，shared 4 套 / 16 项、infra 7 项通过。所有最终运行源码指纹匹配，所属进程、数据库和临时目录完成清理，next-env 恢复构建前内容。

[实施记录](../../research/2026-10-16-t04-t05-local-merge.md)、[handoff](../../HANDOFF-2026-10-13-upgrade.md)和综合计划已更新；最终证据见[汇总](../../research/evidence/2026-10-16-t04-t05-merge/verification.json)。G0/G1 仍未达成，本地批次不构成发布里程碑；未提交、推送或部署。继续保留本批 scratch 基线和 ledger，供未提交工作续接。下一步是正式 adapter 前置只读证据；本地可继续已知错误重试分类与孤立文件保留/回收契约。

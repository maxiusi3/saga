# T04 本地流式合并与实际解码

日期：2026-10-15（Asia/Taipei）。承接 [合并契约](2026-10-15-t04-server-merge-contract-local.md) 与 [本批计划](../superpowers/plans/2026-10-15-upgrade-t04-local-merge-execution.md)。本批完成本地执行能力，不代表服务端会话、Storage、数据库、队列或 G1 已接通。

## 本轮实现

- `recording-merge-executor.ts`：重新构建并核对可信任务快照、幂等键、总量和输入上限；按数字顺序读取确切块流，核对逐块字节数和 SHA-256。原始字节顺序写入私有临时目录，避免把整段录音拼到内存；写入期间复制当前帧，避免读取方复用 Buffer 造成指纹与内容不一致。
- `recording-audio-decoder.ts`：以绝对路径、参数数组启动独立 FFmpeg，无 shell。固定 WebM/MP4/Ogg 解复用器，只开放本地 file/pipe 协议，禁用 MOV 外部数据引用；支持明确的 Opus/Vorbis/AAC-LC MIME 编码参数并指定对应解码器。映射全部轨道到单一 PCM 输出，拒绝额外视频/多轨等不符合录音输入的内容。
- 解码全部音频为 16 kHz、16 bit、单声道 PCM，流式计数取得实际时长；正时长和既有完成证据门全部通过后，才向消费回调提供原始音频文件。超时、时长上限、过多诊断输出会终止并等待子进程关闭；解码错误、空/不完整样本也失败。
- 成功、读取/解码错误和消费失败都清理本次临时目录；源块不改写、不删除。回调得到的文件仅在回调期间存在；没有执行云端上传、ready 更新、客户端 confirmed 或恢复草稿清理。

## 已执行验证

| 检查 | 结果 |
|---|---|
| 初始失败测试 | 新模块不存在，两套测试失败；记录在本批 scratch 的 `red.log` |
| 编码参数回归 RED | 两条常见浏览器 MIME 参数被旧实现拒绝；真实 Vorbis 伪报 Opus、包含视频的 MP4 被旧实现接受；修复前已复现 |
| 本轮新增 Jest | 执行器 20 项、解码器 21 项；覆盖块损坏/缺件/读流异常、快照篡改、限额、清理、进程退出、诊断、超时和 MIME 参数 |
| 真实 FFmpeg 集成 | `scripts/verify-recording-merge.cjs`：56 项检查通过 |
| 全量项目验证 | 修复后 `npm run verify` 退出 0；75 套 / 702 项 Web 测试，类型、lint 与 175 个页面构建通过 |

集成证据：[results.json](evidence/2026-10-15-t04-merge/results.json)。输入为本机生成的 2 秒虚构正弦音，每份切为 13 块、反向提交清单后由生产执行器排序；涵盖 WebM/Opus、MP4/AAC、带 AAC MIME 参数的 MP4、分段 MP4 和 Ogg/Opus。实测时长分别约 2000、2006、2006、2027、2000 ms。每份输出与源文件逐字节一致，SHA-256 和字节数匹配；差异来自容器/编码填充，不写成麦克风时长保证。

真实负例包含同大小块损坏、对象缺失、清单正确但不可解码字节、容器/MIME 不符、编码声明不符、额外视频轨、时长超限和输入超限；均没有消费验证结果且清理本次目录。证据保存源码/脚本/运行时 SHA-256、运行时版本、fixture 指纹与各项结果。临时生成的音频及编译产物在脚本结束后清理，不包含家庭资料。

完整构建仍报告既有 `SUPABASE_SERVICE_ROLE_KEY` 缺失、Next 配置弃用和多 lockfile 提示；不作为生产配置验收。验证摘要见 [verification.json](evidence/2026-10-15-t04-merge/verification.json)。

日常 Jest 通过真实启动的本地 Node fixture 测进程边界，不要求系统安装 FFmpeg。调试发现测试子进程启动可能比 watchdog 慢，原先让子进程先写 PID 文件的断言会发生竞态；现改为观察实际 spawn 的 PID，再确认 Promise 拒绝时 OS 中已无该进程。正常启动测试给足预算，生产超时仍由调用方显式配置。

独立审查提出一项 P2：通用异步迭代器的 `next()` 拒绝时，`for await` 不会自动调用 `return()`，可能遗留源文件/响应句柄。新增三条真实文件句柄回归，先复现两项失败，再改为显式持有迭代器、等待失败清理且保留原始读写错误；20 项执行器测试通过。独立增量复审已确认该问题关闭，未发现新破坏。审查范围为本批两份生产模块，不包括全部历史未提交代码。

## 本地复跑

```bash
npm test --workspace=packages/web -- --runInBand recording-merge-executor.test.ts recording-audio-decoder.test.ts recording-merge.test.ts
SAGA_FFMPEG_PATH=/absolute/path/to/ffmpeg node scripts/verify-recording-merge.cjs
npm run verify
```

本机系统 FFmpeg 8.0.1 因缺少 `libvpx.11.dylib` 无法启动。本批使用已存在、可独立运行的 FFmpeg 7.1，运行时指纹见证据；没有修复系统安装、新增 npm 依赖或改 lockfile。该本地二进制带 `enable-nonfree` 构建选项，**不是选定或可分发的生产 runtime**；生产前须另行固定来源、构建、许可、补丁和隔离配置。

## 未完成边界与下一步

1. `readChunk` 目前是注入端口；集成测试使用内存中的虚构块流。真实 Storage adapter、鉴权、版本固定、读取超时/取消、断点对账、只写一次对象和上传后回读校验尚未实现。不能把本地流式校验写成 Storage 已验证。
2. 任务必须来自已授权、已封口的服务端会话快照；还没有数据库封口/末块确认。某段可解码不能证明录音尾部未丢失，不能据此清理本地恢复副本。
3. 真正发布资产需要重新核对权限、删除墓碑、任务租约与输入版本，并原子写回输出引用。T05 队列/outbox/Worker 和 T02 `verifying → ready` 仍未接入。
4. 子进程超时、输出限额和协议限制不等于 OS 级沙箱；生产独立 Worker 仍需 CPU/内存/磁盘配额、运行身份、网络及文件系统隔离。未知格式或未支持的编码参数明确失败；不宣称覆盖全部 Safari/Android 实际录音。
5. [G1 真机 runbook](2026-10-15-t04-g1-device-runbook.md)已准备组合、故障阶段、核听标记和逐案记录模板；全部实际真机长录音/锁屏/来电/强杀/配额案例仍未执行。
6. 本轮保留现有工作树；没有提交、推送、部署、远端迁移、生产写入或付费调用。

# T04 服务端录音合并契约：本地实施记录

日期：2026-10-15（Asia/Taipei）。本记录只证明本地纯函数契约和测试通过，不能证明服务端录音会话表、Storage 对账、T05 Worker、FFmpeg/容器解码、`media_assets` 迁移或生产权限已经部署。

## 本轮范围

承接 [P1 录音契约第 6 节](../superpowers/specs/2026-10-13-upgrade-p1-contracts.md) 和 [T04 恢复预览记录](2026-10-15-t04-recovery-preview-browser.md)，新增：

- `packages/web/src/lib/server/recording-merge.ts`
- `packages/web/src/lib/server/__tests__/recording-merge.test.ts`

契约把浏览器会话交给未来 T05 合并任务时需要的输入固定为：项目、会话、目标资产、输入版本、实际 MIME、处理器/参数版本，以及带数字序号、确切 bucket/key、字节数和 SHA-256 的有序块清单。块必须位于 `audio-recordings/projects/<projectId>/sessions/<sessionId>/<index>`，从 0 连续、无重复 ID，且只能使用正的安全整数大小。

幂等键复用 T05 的版本化 tuple，并追加会话、实际 MIME 和规范化块清单摘要；因此同一输入顺序稳定，项目、资产、输入版本、处理器、参数、会话或块指纹变化都会产生新任务身份。该键只是未来 adapter 的输入，不是数据库唯一约束或队列恰好一次证明。

完整确认 helper 只有在项目/会话/资产身份匹配、实际容器解码成功、时长和输出大小为正、输出 SHA-256 格式有效，以及完成证据中的块清单与任务快照完全匹配时才返回 `ready`。它不读取 Storage、不执行合并、不调用 FFmpeg，也不把“纯函数通过”解释为音频容器已真实解码。

## TDD 与验证

1. 先新增 9 项失败测试；首次运行因目标模块不存在而失败。
2. 实现最小契约后，定向 `recording-merge` 为 1 套 / 9 项通过。
3. 与 T04 会话、恢复及 T05 状态回归合并运行：4 套 / 79 项通过。
4. `npm run type-check --workspace=packages/web` 和 `npm run lint --workspace=packages/web -- --no-warn-ignored` 通过。

全量 `npm run verify`、构建改写文件恢复和 `git diff --check` 在本轮收尾时重新执行；最终数字以 handoff 为准。

## 未完成与边界

- 没有创建 `recording_sessions`、`recording_chunks`、`processing_jobs` 或 `processing_attempts` 迁移。
- 没有把块上传从现有本地 SmartRecorder 临时路径切换到服务端会话 adapter，也没有断点上传对账。
- 没有实现 Storage 流式合并、容器重组、实际解码、时长提取、输出对象写入或 `media_assets` `verifying → ready` 更新。
- 没有接入 T05 事务 outbox、独立 Worker、租约心跳、请求 ID/账单或撤权后迟到结果的集成检查。
- 当前仍缺 Supabase 远端只读凭据；不执行迁移、生产写入、部署、真实家庭资料扫描或付费供应商调用。
- 真机 G1 的 iPhone Safari、Android Chrome、桌面长录音、锁屏、来电、进程退出、离线和 5/20/30 分钟矩阵仍待独立证据。

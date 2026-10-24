# T04 恢复预览与真浏览器本地证据

日期：2026-10-15（Asia/Taipei）。本记录承接 [T04 SmartRecorder 入口记录](2026-10-14-t04-smart-recorder-local-integration.md) 与 [恢复预览计划](../superpowers/plans/2026-10-14-upgrade-t04-recovery-preview.md)。它只证明本地浏览器和应用组件边界，不证明生产部署、远端 schema、RLS、真机 G1 或云端资产确认。

## 实现

- 新增 `recording-recovery.ts`：读取当前项目/登录用户的 `recording` 或 `interrupted` 会话；拒绝已确认、跨项目、跨用户、未知 MIME、空块、缺块、重复序号、会话不匹配、大小不符、空 Blob、缺少或错误 SHA-256；重新读取会话元数据（含 updatedAt）后才生成单会话 Blob；同长度块被另一标签覆盖时会拒绝展示。
- 新增 `RecordingRecoveryPanel.tsx` 并挂到录音首页 hub：列出当前项目/用户的本地草稿，支持回听与下载；明确提示结尾可能缺失且尚未确认保存到项目。播放失败仍保留下载链接；账号/项目切换、重复选择和卸载会使旧请求失效并释放对象 URL。
- 英文、简体中文、繁体中文 recording 文案已补齐；其他语言继续使用英文回退。
- 新录音入口仍独立进入 SmartRecorder；恢复预览不会自动上传、确认、清理、续录或拼接新容器。

## 验证

| 证据 | 结果 |
|---|---|
| `recording-recovery.test.ts` | 23 项通过；含隔离、元数据、损坏块、SHA-256、空草稿和跨标签变化 |
| `recording-recovery-panel.test.tsx` + 录音页回归 | 与现有回归合计 3 套 / 45 项通过 |
| `node scripts/verify-recorder-db.cjs` | 退出 0；Chromium 147.0.7727.15，24 项通过 |
| `npm run verify` | 退出 0；72 套 / 652 项 Web 测试通过，类型检查、lint、Next 编译与 175 个页面生成完成 |
| `git diff --check` | 通过 |

浏览器证据见 [results.json](evidence/2026-10-14-t04-browser/results.json)、[移动宽度截图](evidence/2026-10-14-t04-browser/recovery-preview-mobile-width.png) 和 [繁中截图](evidence/2026-10-14-t04-browser/recovery-preview-zh-TW.png)。演练用 Web Audio 生成短暂虚构音频，经实际 MediaRecorder 分块、IndexedDB 保存、关页重开、恢复 helper 校验、`decodeAudioData` 解码和原生 `<audio>` 播放；实际 MIME 为 `audio/webm;codecs=opus`，7 块，解码约 0.66 秒。另以 mutation 演练确认去掉用户过滤或数字排序会被失败测试捕获。

构建仍有既有 `SUPABASE_SERVICE_ROLE_KEY` 缺失、Next 配置弃用和多 lockfile 根目录提示；不构成生产配置或远端验收证据。

## 仍未证明

- 麦克风真实输入、iPhone Safari/Android Chrome、5/20/30 分钟、锁屏、来电、进程强杀、配额、跨设备恢复和网络中断矩阵；当前证据只覆盖桌面 Chromium 的短虚构音频。
- IndexedDB 恢复 Blob 可解码不代表录音没有丢失结尾，也不代表 T02 `ready`、服务端会话、重组、时长确认或正式导出可用。
- 远端录音会话/合并任务、断点上传对账、RLS、撤权、备份恢复、迁移和部署仍未执行。

没有提交、推送、部署、远端迁移、真实家庭资料或付费供应商调用。

# T04 录音会话与块持久化：本地契约实施记录

日期：2026-10-14（Asia/Taipei）。本记录只证明浏览器端纯函数、IndexedDB 版本升级和本地回归通过，不能证明服务端录音会话、合并任务、解码器、真机恢复或生产上传已完成。

## 本轮新增

- `packages/web/src/lib/recording-session.ts`：MIME 选择、项目/用户绑定会话、块排序与校验、上传状态、中断恢复和完整确认；所有动作返回新快照。
- `packages/web/src/lib/recorder-db.ts`：IndexedDB 从 v1 升至 v2，保留 `chunks` 并新增 `sessions`；旧块缺失的新字段按兼容默认值读取，旧四个方法保持兼容。
- `packages/web/src/lib/__tests__/recording-session.test.ts`：7 项测试覆盖 MIME、绑定、块校验、上传前置、中断恢复、完整确认和输入不可变。

## 验证

| 命令 | 结果 |
|---|---|
| T04 定向 Jest | 1 套 / 7 项通过 |
| `npm run type-check --workspace=packages/web` | 通过 |
| `npm run lint --workspace=packages/web -- --no-warn-ignored` | 通过 |
| `npm run verify` | 退出 0；68 套 / 588 项 Web 测试通过；Next 编译和 175 个页面生成完成 |
| `git diff --check` | 通过 |

构建仍报告既有 Next 配置弃用、多 lockfile 根目录推断以及本机缺少 `SUPABASE_SERVICE_ROLE_KEY`；这些提示不构成生产环境配置、远端 schema 或部署已验证的证据。

## 尚未完成

后续进展：[SmartRecorder 本地接入](2026-10-14-t04-smart-recorder-local-integration.md)已继续实现实际块哈希、先落盘后上传、保留副本和生命周期隔离；以下描述保留为首批完成时的边界，最新状态以续批记录为准。

本轮没有创建服务端录音会话表，没有执行远端迁移，没有改造 `SmartRecorder` 的正式上传/合并入口，也没有声称 MediaRecorder 字节拼接可解码。后续仍需接入实际块哈希/容器解码、受控上传恢复、服务端有序重组、完整确认和清理策略，并按 P0 设备矩阵完成真机中断、锁屏、来电、离线和跨设备恢复验收。继续保持不部署、不推送触发部署、不执行远端迁移。

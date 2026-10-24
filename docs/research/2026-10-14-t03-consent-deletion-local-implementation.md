# T03 权限、用途同意与删除墓碑：本地契约实施记录

日期：2026-10-14（Asia/Taipei）。本记录只证明纯函数和本地测试通过，不能证明 `consent_records`、`deletion_requests`、`deletion_targets`、RLS、Storage 删除或供应商删除已部署。

## 本轮新增

- `packages/web/src/lib/server/consent-deletion.ts`
  - 项目读取、项目管理、家庭分享、故事删除、讲述者本人故事编辑/录音/AI/公开贡献的动作判定；未激活成员、未知角色、删除阻断和不匹配故事归属默认拒绝。
  - 用途同意的精确匹配：grantor、subject、purpose、policy、provider、region 和生效时间；撤回时间到达即失效，历史记录保持不可变。
  - 删除请求创建即生成墓碑；开始处理递增 attempt；失败保留墓碑并允许重试；仅所有目标为 `deleted` 或 `not_found` 时可完成。
  - 恢复后重新应用墓碑；完成状态转为待处理失败状态，避免恢复数据重新开放访问/处理。
- `packages/web/src/lib/server/__tests__/consent-deletion.test.ts`
  - 12 项测试覆盖动作隔离、同意撤回与精确匹配、删除重试、目标完整确认、恢复墓碑、非法输入和输入快照不可变。

## 验证

| 命令 | 结果 |
|---|---|
| T03 定向 Jest | 1 套 / 12 项通过 |
| `npm run type-check --workspace=packages/web` | 通过 |
| `npm run lint --workspace=packages/web -- --no-warn-ignored` | 通过 |
| `npm run verify` | 退出 0；67 套 / 581 项 Web 测试通过；Next 编译和 175 个页面生成完成 |
| `git diff --check` | 通过 |

## 边界与下一步

本轮没有调用 Supabase、Storage、队列、供应商或真实家庭资料，没有新增迁移，没有切换正式权限/删除路由。动作判定的成员、角色、故事归属和 `isDeletionBlocked` 均是未来服务端 adapter 提供的最新投影；纯函数不能替代数据库原子检查、直接 Storage RLS、已签发短链撤销、物理删除、备份重放或供应商删除确认。

下一步先取得远端 schema、RLS、Storage 和备份只读证据，再设计同意/删除 adapter 与事务边界；在此之前继续保持不部署、不推送触发部署、不执行远端迁移。

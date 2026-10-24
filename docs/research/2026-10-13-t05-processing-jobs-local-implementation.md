# T05 持久任务：本地状态契约实施记录

日期：2026-10-13（Asia/Taipei）。本记录只证明纯函数和测试在本地通过，不能证明 `processing_jobs`/`processing_attempts` 已部署、队列已安装、Worker 可恢复或供应商不会重复计费。

## 本轮新增

- `packages/web/src/lib/server/processing-jobs.ts`
  - 固定 `queued → leased → running → succeeded` 主路径；
  - 固定 `retry_wait`、`outcome_unknown`、`awaiting_review`、`failed` 和 `cancelled` 分支；
  - 以项目、资产、输入版本、任务类型、处理器版本、模型配置版本和参数版本生成稳定幂等键；
  - 领取时校验 due 时间、最大尝试次数并递增 attempt；
  - 领取前租约过期可回到 `retry_wait`；运行中租约过期进入 `outcome_unknown`，默认禁止盲目重试；
  - 可重试错误按延迟进入 `retry_wait`，耗尽次数进入 `failed`；
  - 取消清除租约并记录取消时间，迟到完成被拒绝；
  - 成功完成要求非空 `resultRef`，已完成任务不能二次完成。
  - 幂等键现在验证所有身份字段为非空、无首尾空白字符串，`inputVersion` 为正安全整数，并用版本化 JSON tuple 避免分隔符碰撞。
  - 任务快照加入 `deletionRequestedAt` 投影；领取、重试、进入人工复核、批准和完成在取消标记或删除标记存在时一律拒绝。
  - 运行中任务可带持久结果引用进入 `awaiting_review`，释放租约；批准在后续日期重新排队但保留 `attemptCount` 与结果引用，不重置最大尝试次数。
  - `outcome_unknown` 只能由严格布尔值 `controlledRetry: true` 进入受控重试，不能通过人工复核路径绕过。

- `packages/web/src/lib/server/__tests__/processing-jobs.test.ts`
  - 39 项测试覆盖幂等输入、分隔符碰撞、状态转移、due 领取、两类租约恢复、受控未知结果、人工复核/跨天批准、取消/删除阻断、重试上限和输入快照不可变。

## 验证

| 命令 | 结果 |
|---|---|
| T05 定向 Jest | 1 套 / 39 项通过 |
| `npm run type-check --workspace=packages/web` | 通过 |
| `npm run lint --workspace=packages/web -- --no-warn-ignored` | 通过 |
| `npm test --workspace=packages/web -- --runInBand` | 66 套 / 569 项通过 |
| `npm run verify` | 退出 0；类型、lint、66 套 / 569 项测试通过；Next 编译和 175 个页面生成完成 |
| `git diff --check` | 通过 |

## 当前限制与下一步

本轮没有调用 Supabase、Storage、队列、模型供应商或真实家庭资料。没有创建迁移文件，也没有修改现有 `agent-store` 或编辑器路由。`npm run verify` 的构建阶段仍报告本地缺少 `SUPABASE_SERVICE_ROLE_KEY`，并保留 Next 配置弃用及多 lockfile 根目录提示；这不构成生产配置验证。纯函数的删除标记必须由未来 adapter 提供最新服务端投影，不能视为数据库字段已部署。下一步必须先取得远端 schema/权限/备份与 Worker 部署证据，再决定数据库 adapter 和事务 outbox；在此之前只继续做可独立验证的契约测试，不切换正式处理入口。

继续遵守：不部署、不推送触发部署、不执行远端迁移。

## 2026-10-15 持久 Worker 续批

已新增[本地 PostgreSQL/pg-boss PoC](2026-10-15-t05-durable-worker-poc.md)，复用本记录的状态函数，验证真实事务、独立进程、重复投递、unknown隔离、跨天批准和撤权后迟到结果。下文/前文“未接数据库/Worker”描述的是10月13日纯函数批次；生产adapter、正式表、心跳、供应商账单和部署仍未完成。

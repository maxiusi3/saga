# T05 持久任务状态契约本地实施计划

日期：2026-10-13（Asia/Taipei）。本计划只覆盖 T05 的本地状态与恢复契约，不创建数据库表、不安装或部署队列、不连接真实供应商，也不把现有 HTTP agent 处理称为持久 Worker。

## 目标与边界

把 P1 契约中的 `processing_jobs` 状态、租约、尝试次数、外部结果未知和取消语义先固定为可测试的纯函数。后续数据库 adapter、事务 outbox、pg-boss/替代队列和独立 Worker 必须在远端 schema、连接权限和部署环境核实后另行实施。

本批允许：

- 状态转移与非法转移拒绝；
- 覆盖输入资产/版本/处理器/模型/参数的稳定幂等键；
- due 检查、租约领取、尝试次数递增和租约到期时间；
- 领取前进程退出回到 `retry_wait`；
- 已进入运行阶段但结果未知时进入 `outcome_unknown`，禁止无控制重试；
- 达到最大尝试次数后进入 `failed`；
- 取消后清除租约并拒绝迟到完成；
- 成功结果只接受一次并要求结果引用。

本批不允许：

- 假设 `processing_jobs` 或 `processing_attempts` 已存在；
- 以本地 helper 代替原子数据库更新、队列可见性或第三方请求复用；
- 复制家庭正文到任务消息或日志；
- 把“未知结果”重试测试解释为第三方不会重复收费；
- 接入现有 agent HTTP 路由或切换生产处理入口。

## 文件与测试

| 产物 | 责任 |
|---|---|
| `packages/web/src/lib/server/processing-jobs.ts` | 状态类型、合法转移、幂等键、领取、租约恢复、重试、取消和完成 helper |
| `packages/web/src/lib/server/__tests__/processing-jobs.test.ts` | 纯函数行为测试，不访问 Supabase、Storage 或供应商 |
| `docs/research/2026-10-13-t05-processing-jobs-local-implementation.md` | 本地实现、验证结果和远端/部署边界记录 |

## 后续出口

在 T05 进入数据库/Worker 前，必须补齐：

1. 远端迁移历史、可用 schema 权限和备份恢复证据；
2. `processing_jobs` / `processing_attempts` 的唯一约束、并发领取和事务 outbox 设计；
3. 真实队列版本、Node/数据库连接模式和租约心跳配置；
4. 四类故障演练：领取后退出、供应商请求后退出、结果写回前退出、重复投递；
5. 跨天人工批准、撤权/删除墓碑和迟到结果拒绝测试；
6. 固定虚构素材的预算、请求 ID、结果复用和账单核对记录。

当前仍遵守“不部署、不推送、不执行远端迁移”的约束。

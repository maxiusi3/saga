# 托管到期提醒 Worker

`npm run worker:hosting-reminders` 持续扫描已付款、已分配项目的托管期限。提醒以 `payment_project_rights.hosting_expires_at` 为准，不修改期限，也不删除资料。

## 启动与配置

先由部署流程应用 `20261113000004_hosting_reminders.sql`，然后在独立进程或外部进程管理器中运行 Worker。所有环境变量由操作者显式提供，脚本不加载 `.env`，不代建远端资源。

```sh
npm run worker:hosting-reminders -- --check
npm run worker:hosting-reminders -- --once
npm run worker:hosting-reminders
```

`--check` 只校验配置并编译生产模块，不创建 Supabase 客户端或出站。`--once` 执行一个有限批次；邮件失败、未知或服务不可用时退出码为 1。持续模式处理每一批后等待，SIGINT/SIGTERM 中止等待或出站，仍尝试在独立的有界请求内记录当前邮件结果。日志仅含计数与固定状态，不记录地址、凭据、ID、故事或错误响应正文。

| 环境变量 | 要求 |
| --- | --- |
| `SUPABASE_URL` | HTTPS 项目根 URL；可回退到 `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | 必需，仅用于此服务器进程 |
| `HOSTING_REMINDER_BATCH_SIZE` | 1–100，默认 50；每批最多新增相同数量的站内提醒及尝试邮件 |
| `HOSTING_REMINDER_POLL_MS` | 1000–3600000，默认 60000 |
| `HOSTING_REMINDER_EMAIL_ENABLED` | 仅接受 `true` / `false`，默认 `false` |
| `HOSTING_REMINDER_EMAIL_FROM` | 邮件启用时必需；单一邮件地址，需在 Resend 完成域名验证 |
| `RESEND_API_KEY` | 邮件启用时必需 |
| `HOSTING_REMINDER_WEB_ORIGIN` | 邮件启用时必需；HTTPS 网站根 URL |

默认站内通道可独立工作。邮件启用只影响之后新创建的提醒，不追发先前 `disabled` 的任务。收件人来自 Auth 当前已验证的邮箱。邮件只包含期限日期、项目 ID 所构成的链接和导出说明；不读取或保存项目名称、故事正文。

## 窗口与持久状态

90 天提醒在到期前 90 天（含）至 30 天（不含）之间生成；30 天提醒在到期前 30 天（含）至到期（不含）之间生成。首次运行已进入 30 天窗口时只生成 30 天提醒，不补发 90 天旧提醒。以数据库当前 UTC 时间计算，在出站授权前再次复核。

`hosting_reminders` 用 `(order_id, expires_at, days_before)` 约束唯一身份。站内 `notifications` 插入与提醒身份提交在同一事务中完成，重复扫描、并发 Worker、用户删除已读通知均不重复创建。同一项目的付款权益本身由唯一分配约束保证。到期值变化产生新身份，并取消旧邮件、移除旧站内通知；退款取消旧任务；项目物理删除、删除状态或项目删除墓碑会清除通知与提醒。每次扫描和出站授权还检查付款、权益、项目、当前成员权限和墓碑。

站内 action URL 使用无语言前缀的 `/dashboard/projects/{id}`，由已有通知页面/下拉菜单按当前语言导航；邮件默认指向网站的英文项目入口。该入口包含已有的归档导出功能。

邮件状态：

- `disabled`：创建时关闭邮件。
- `queued` → `preparing`：单一令牌与 2 分钟租约；尚未授权出站。租约到期可重新领取，最多 5 次。
- `preparing` → `outbound`：事务持久化的一次出站许可。同一令牌再次 begin 返回 `unknown`，不能再次发送。
- `sent`：Resend 成功响应包含合法供应商 ID，并已写入回执。仅表示供应商接受，不表示进入收件箱、投递到终端或已读。
- `unknown`：出站网络结果不明、超时、无法解析成功回执，或出站许可超过 15 分钟仍无回执。不会自动重新领取。
- `failed`：确定的供应商拒绝、无法取得已验证邮箱，或调用前准备次数耗尽。不会自动追发。
- `canceled`：退款、期限或项目变更等来源已失效。

所有 RPC 和邮件传输各自有 15 秒超时；RPC 显式关闭 SDK 自动重试。成功邮件响应最多读 8192 字节。Resend 请求是 `POST https://api.resend.com/emails`，发送 `from`、`to`、`subject`、`text`；幂等键为 `hosting-reminder/{reminder_id}`。禁止重定向。

Resend 幂等键有效期只有 24 小时，本系统不靠无限期重用此键来防重复。`outbound` / `unknown` 不自动重发；数据库回执丢失也不再次出站。操作者应在供应商后台核实固定请求身份：只有确认供应商已接受并取得消息 ID，才可使用受限服务 RPC `complete_hosting_reminder_email(id, token, 'sent', receipt)` 对账。若证据不足则保留 unknown。过期、退款或删除后不能创建新一次旧提醒；此 Worker 不提供自动“重置再发”操作。

## 验证边界

本批回归使用原生 PG17.4、真实数据库角色与 RLS、实际 Supabase SDK、本地受控 Resend HTTP、生产通知 API/页面/Hook/客户端及已安装 Chrome。所有账户和邮件地址均为合成 `.invalid` 地址。受控成功和失联可证明状态协议及 UI 接线，不构成真实邮箱到达、生产 Resend 域名或部署认证。

```sh
npm test --workspace=packages/web -- --runInBand --watchman=false src/lib/server/__tests__/hosting-reminders.test.ts
node --test scripts/__tests__/hosting-reminder-worker-cli.test.js
node experiments/g1-local/verify-migrations.mjs --hosting-reminders --chrome
```

测试与运行证据索引见 `docs/research/evidence/2026-11-13-audit-repair/reminders-*.log`。原始失败日志保留，`--hosting-reminders` 额外验证完整迁移后的提醒行为；只应用迁移成功不能证明已投递。

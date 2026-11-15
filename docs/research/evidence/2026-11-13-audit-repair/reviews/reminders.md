# S3 托管到期提醒独立审查

审查日期：2026-11-13。范围为 `2026-11-13-upgrade-audit-repair.md` 第四节，以及托管提醒迁移、Worker/CLI、通知 API、客户端、Hook、列表和下拉菜单接线。只审不改实现；保留既有 G1–G4 工作区改动，未暂存、提交或修改远端。

## 规格结论

**S3 核心规格通过；未发现新增提醒逻辑的 P1/P2 阻塞项。** 站内通道已经实际写入用户通知；邮件存在持久化出站许可与回执状态，不把扫描日期或日志计作投递。真实邮箱送达及生产部署仍未验收。

| 要求 | 独立核对结果 |
| --- | --- |
| 固定托管期限、90/30 天窗口 | `hosting_reminder_source_valid` 与 tick 均使用权益表的固定 `hosting_expires_at`；90 天窗口不包含最后 30 天，首次晚启动不补旧 90 天提醒。tick 使用 UTC。 |
| 唯一任务及站内幂等 | `(order_id, expires_at, days_before)` 唯一约束；权益表 `order_id` 主键、`project_id` 唯一且分配请求固定项目。提醒身份、notification 插入和回填在一个事务内完成。删除 notification 只清空外键，保留身份，不能重复创建。 |
| 退款、撤权、删除、期限变更 | 扫描与 begin 都重新核对付款、权益、项目权限和项目墓碑；权益更新取消旧邮件并删除旧通知；项目物理删除、删除状态及项目墓碑清除提醒和通知。已完成且曾经合法投递的通知不被视为新的出站。 |
| 邮件租约与并发 | 准备阶段有令牌和 2 分钟租约；出站许可只允许从 preparing 转移一次。再次 begin 返回 unknown 或在并发锁冲突时失败，不能得到第二个出站许可。准备回收最多 5 次；outbound/unknown 不回队列。 |
| 未知结果与有界传输 | SDK RPC 显式 `.retry(false)`，各自 15 秒有界。HTTP 禁重定向、固定供应商端点、固定提醒幂等键；成功回执最多 8192 字节。丢响应保留 unknown，不通过重发“恢复”；相同令牌可用供应商证据对账为 sent。 |
| 通知内容、访问和界面 | 通知仅有期限、项目/订单身份及项目导出入口，无故事或项目标题。API 按收件人过滤并使用用户凭据；通知 RLS 隔离其他用户。现有 Chrome 证据覆盖真实页面、Hook、API 的读取、已读、删除与语言前缀导航。 |
| CLI 安全启动 | 默认关闭邮件；不加载 `.env`；`--check` 离线检查；`--once` 使用真实 SDK RPC。持续运行、信号处理、失败退出码与文档一致。 |

## 质量发现

**[P2，继承的界面问题，非本次提醒差异引入] 单条已读/删除按钮无法被普通用户看到。**

位置：`packages/web/src/components/notifications/NotificationItem.tsx:114`、`:125`。两个按钮使用 `opacity-0 group-hover:opacity-100`，但该组件外层 `:49–53`、通知页面的 Card、下拉列表以及各自祖先均没有 `group` 类，因此悬停通知也不能显示按钮。新站内到期提醒继续使用这个组件，用户只能碰巧点击不可见的区域。已保存的 `notifications-desktop.png` 也确实没有显示操作按钮；现有 Chrome 测试直接按按钮角色查找并点击，不能证明按钮视觉可发现，因为 `opacity: 0` 不会阻止这种点击。

建议使操作按钮默认可见，或加入正确的 hover/focus 可见条件，并检查触摸屏。验证应断言实际 computed opacity 或可见操作截图，不能仅断言点击成功。该问题与核心提醒任务的持久幂等/投递协议分开列示。

同一截图中，未读圆点位于通知卡片外侧。`NotificationItem.tsx:138` 的 absolute 圆点没有对应的 relative 行容器，属于同一旧组件的定位问题；不单独升级为阻塞项。

## 独立验证

- 当前提醒相关代码、页面、Hook、测试源码的 SHA-256 与既有完整迁移 + Chrome 结果中记录的源码全部一致：`docs/research/evidence/2026-11-07-g1-chrome/migrations-1794567286153-f689d57d-0d2f-4e68-94c4-a5c077682dee/results.json`，`status=passed`，180 个断言，`sourceDrift=[]`。本轮检查并查看了该运行的通知截图，没有重复执行其整套浏览器场景。
- 本轮执行 `npm test --workspace=packages/web -- --runInBand --watchman=false src/lib/server/__tests__/hosting-reminders.test.ts`：1 套、8 项通过。
- 本轮执行 `node --test scripts/__tests__/hosting-reminder-worker-cli.test.js`：2 项通过。
- 本轮额外执行独立原生 PG17 探针：完整 bootstrap/迁移后，只增加提醒边界核对，结果见 [reminders-probe/results.json](reminders-probe/results.json)。总计 106 个断言（包含基础角色/迁移检查），`sourceDrift=[]`。并发 begin 的实际结果为一次 `outbound`、一次 `55P03`；另验证 anon/authenticated 无权调用领取、begin、complete，unknown 不被重新领取且可凭回执对账，项目墓碑清除站内/邮件记录并阻止旧令牌，期限变更删除旧通知并取消旧邮件，以及邮箱失去验证后不能出站。
- 探针源码：[reminders-probe/probe.mjs](reminders-probe/probe.mjs)，SHA-256 `23628c4e7a1357c5203435ebc2cfab3940208c74837cb91de62c9dc218762578`。这是从现有迁移驱动适配的本机审查探针，使用隔离 Unix socket 和合成用户；未读取生产凭据或调用真实邮件供应商。数据库集群已停止、临时目录已删除、连接归零。

## 验证限制

原生 PG 测试使用合成 Supabase Auth/Storage 平台表；受控 HTTP 测试使用实际 SDK 和路由，但不是托管 PostgREST、真实 Resend 域名或收件箱验收。已有 Chrome 场景为英文桌面通知页，认证/Realtime 在浏览器边界替换，导航终点为项目入口占位页；没有证明下拉菜单的完整浏览器交互、手机布局、键盘可访问性、生产 Realtime 或实际导出完成。上述边界已与核心提醒代码结论区分。

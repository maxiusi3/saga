# 邀请只读兼容与接受恢复页面

2026-10-19（Asia/Taipei）。续接 [HTTP 适配](../../research/2026-10-18-invitation-http-adapter.md)及 handoff 的旧 GET/verify/check-pending 与正式 UI 恢复步骤。用户已授权按现有升级计划继续；本批为现有接口和页面的兼容实施，不调整 D01–D16 或质量门。

## 范围与取舍

两个 token GET 入口复用现有已验证 Bearer 的只读 status 适配，不再读 service 表或在 GET 中更新 expired。两个接受页面共用状态/接受/显式恢复组件。没有可信 pending 列表候选，因此 check-pending 暂停并返回明确不可用；首页 invite 回跳只导向原链接提示，不猜测第一条邀请。发送、取消、邮件、可信权益 source/event、直接数据库权限、历史 opaque token 映射和迁移另批实施。

只读结果不包含项目名、邀请者名、邮箱或问题正文，因此此阶段 UI 仅展示角色与邀请状态；目标体验中的“谁邀请、想问什么”仍待可信最小预览接口。缺 token 时提示重新打开原邀请链接；不把暂不可用称作无邀请。不得恢复旧 service/直表/多 token 兼容路径。

## 绑定约束

- 保留当前分支 `codex/october-upgrade-p0`、基线 `1caa21a72` 和既有未提交内容。无远端调用、真实家庭数据、付费供应商、邮件、迁移或部署；未达原里程碑不提交/推送。旧实验/运行时/证据、依赖和根迁移不改。
- `INVITATION_TRANSACTIONS_ENABLED` 仅精确 `true` 启用 token GET；其他值在配置/client/认证/网络前返回安全 JSON 503。check-pending 在所有开关值均返回 503、`success:false,outcome:not_attempted`，不返回伪造空列表，不读配置或创建 client。
- `GET /api/invitations/[token]` 的 params 只消费 Next 已解码一次的 token；`GET /api/invitations/verify?token=...` 要求恰一个 token 参数，使用 URLSearchParams 已解码一次的值，缺失/重复视为非法。所有 token 必须匹配原 `v1_` 加 32 位小写十六进制，不 trim、不二次 decode、不试变体；debug 无额外信息。
- 两个 GET 成功均返回现有 status 安全形状，与 POST status 相同；保留 Cache-Control:no-store、Vary:Authorization。同一实际 SDK client 验证 getUser 后只执行一次 invitation_candidate.status({p_token})，不得 accept/send/release、直表读写或其他外调。复用原十秒截止/caller abort、安全失败与严格 TABLE 验证。
- 所有触及的应用路径不记录/显示原 token、Bearer、邮箱、完整邀请对象或供应商错误；token 仅用于原链接、认证 next 回跳及既有 status/accept 请求。UI 无凭据持久化、无新增 token 日志或调试回显。

## 页面流程

保留 `/{locale}/invite/{token}` 与 `/{locale}/accept-invitation?token=...`，均使用共享组件；query 重复 token 视为非法，type 不作为认证/接受依据。不再调用公开 token GET、verify 或 check-pending，不做多次解码、不在页面注册时推断已确认邮箱。复用应用现有 signin 页面，其 OTP/OAuth 支持登录或创建账号，提供单一“登录或创建账号”动作；不存在独立 signup 页面，不发明路由。next 仅为本地 locale 的原规范邀请地址，不改认证页面。现有 signin/callback 会记录 URL/next/认证错误，signin 会暂存 auth_next；这些保留为必须后续修复的发布阻塞，不属于本批新增组件的无日志/无持久化保证，也不声称端到端认证隐私已完成。

1. 无/非法 token：明确提示原链接缺失/不可用，无 status/accept 网络请求。
2. 尚未登录：显示登录或创建账号并返回原邀请的动作，无邀请数据请求。浏览器 session 仅提供 Bearer；资格由服务端验证。
3. 已登录：经 `getInvitationStatusOverHttp` 读取安全状态；pending 且 `is_expired=false` 才提供接受按钮。数据库 is_expired 是展示判断来源，不能由本机时钟修改状态。expired/declined、不可用、拒绝、未确认邮箱均有明确非成功 UI。
4. 接受动作只能由用户点击，复用 `acceptInvitationOverHttp`；同步防重复点击，每次最多一个请求。只对严格完整确认结果跳转，且返回 invitation_id/project_id/role 须与当前显示状态一致、user_id 与当前 session 用户一致。不显示原服务端错误文本。
5. unknown（包括畸形成功/网络丢失）保留原页面，禁用再次接受，显示“查询状态”。该按钮只读 status；confirmed accepted 且 user_id 为当前身份时显示“进入项目”，不再 accept。unknown 后即使 status=pending 也不在当前页面恢复写按钮，用户可继续显式查询。只读 accepted 不称作本次接受成功。
6. token/账号改变或组件卸载后，旧请求结果不能覆盖当前界面、启用动作或触发导航。认证订阅和异步加载须清理；同账号 token 刷新不能把 unknown 锁重置成可再次提交。不得自动 accept、自动重试或轮询。
7. 使用现有 Card/Button 与可访问的状态/错误提示，保持页面简单。不输出数据库 schema、RPC、席位账本等实现细节。

## 验证与边界

先保存旧 GET/check-pending 不遵守关闭开关的真实 RED，不能用缺模块作为业务失败。实际 handler + Supabase SDK + 合成 loopback 验证两 GET 的 Bearer/anon key/schema/精确参数/一次只读、无 service/更新、认证失败、错误行、debug、取消和清理。复用原 acceptance 回归，不重复原 PG17 矩阵。

React 测试经共享 HTTP helper mock fetch，覆盖两页面接线、无 session、规范 token/单次解码、登录返回、pending/accepted/expired/declined、关闭/拒绝、未知写结果显式查询、连续点击、stale token/账号/unmount、无不受信字段和无日志。测试承担行为保证，不写只镜像实现的断言。完整 `npm run verify`、shared、infra 在最终源码执行，恢复 next-env 原字节。独立规格/质量审查及整批审查后更新交接与里程碑判断。

这批只证明应用与合成提供方/浏览器组件的本地行为，不证明真实 Supabase JWT/PostgREST/RLS、可信权益、历史兼容或 G0/G1。保持生产开关关闭。

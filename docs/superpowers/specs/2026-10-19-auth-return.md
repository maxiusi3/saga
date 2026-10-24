# 认证回跳日志、目标与临时状态

2026-10-19（Asia/Taipei）。落实 [handoff](../../HANDOFF-2026-10-13-upgrade.md) 在邀请恢复批之后的首项工作。用户已要求按既定升级计划继续。沿用已确认 D01–D16、本地分支和生产质量门；这是现有 signin/callback 的兼容加固，不是新认证供应商或全站会话迁移。

## 已核实原因与本批边界

signin 记录完整 URL/search/next、原始认证错误，并将未经验证的 next 写入 localStorage.auth_next 后兜底读取。callback 记录 code/token_hash/错误，失败时回显提供方内容，成功时将 next 拼进 HTML 内联脚本。问题来自缺少统一的回跳目标契约与自定义持久化兜底。应用只有一个支持 OTP/OAuth 的 signin 页；邀请组件已提供规范本地 next。

本批修改 signin、callback 和 AuthProvider 的旧 key 清理，新增共享回跳 helper、必要的服务端 adapter 与行为测试。保留 Google/邮件登录入口、现有 SDK/browser client、认证 store 和 session 持久化策略。verify 页面、首页/middleware 的历史隐式兼容、浏览器 localStorage session 与 SSR cookie 的统一、全站日志/遥测和真实提供方资格不在本批改造；不得因为本批成功而宣称完整认证链已通过。原邀请协议/页面、实验、依赖、根迁移与旧证据不改。

## 目标契约

共享 helper 只接受 URLSearchParams 已解码一次的 next，不 trim、不再次 decode、不从 localStorage 恢复。缺失、重复或非法 next 均回退当前合法 locale 的 `/dashboard`；locale 来自完整八语言配置，非法 locale 回退 en。显式目标中已有合法 locale 则保留，不重复加前缀。

允许的目标仅为：

- `/dashboard` 及由非空 ASCII 字母、数字、下划线、连字符路径段组成的 dashboard 子路径；不得带 query/fragment。
- `/invite/<规范token>`；token 复用现有 `v1_` 加 32 位小写十六进制契约。
- `/accept-invitation?token=<规范token>`，恰一个 token 且没有其他 query/fragment。
- 上述三类的合法 locale 前缀形式。

其他目标一律回退，不开放任意站内路由或嵌套 auth/API 入口。不允许绝对 URL、`//`、反斜线、空白/控制符、引号/HTML、点段、百分号残留、重复斜线、尾斜线、fragment、认证凭据或嵌套 next。输入长度上限 2048；不靠 URL 构造器静默修正非法路径。不将非法原值放入日志、错误、响应或生成的 provider redirect URL。合法邀请目标可以出现在必要的 next/Location 中，它是路由参数，不是成员访问授权。

## signin 与旧状态清理

- 移除该页所有 console 调试/原始错误输出，以及所有 auth_next 写入和读取。Signin 挂载及 AuthProvider 挂载均只 best-effort 删除旧 `auth_next`，不先读取值、不清其他 storage/session key，storage getter/removeItem 抛错也不能中断登录或恢复旧值。无需新 TTL/key 或替代持久缓存。
- 同一次页面流程的目标来自当前显式 next，并经共享 helper 验证。Google redirectTo 与邮件 emailRedirectTo 指向当前站点合法 locale 的 callback，仅携带经过验证的 next。重试发送不会恢复过期旧目标；缺 next 的新登录不能继承此前邀请。
- 保留现有 signin 显式 session-return 接入能力，清除重复/畸形解析导致的未捕获异常和原始错误回显。URL 认证信息是给 SDK 验证的输入，不自己解码 JWT 当用户；不得把 error:null 或空 session 当登录成功。成功导航用 replace 与同一安全目标；组件卸载或回跳上下文改变后，旧异步结果不更新 UI/导航。相同上下文的重复 effect 不得重复触发页面自身的 session 写入。无需扩展认证模式。
- callback/error query 和 SDK 错误只映射固定安全文案；不渲染原始 message/description、邮箱、认证 token 或完整 next。对 URL 中认证字段的清理尽力使用 replaceState，保持规范 next；不承诺已送达服务器/浏览器历史/外部 SDK 的值被全局抹去。共享 factory 的自动 URL/session 行为保持，是后续真实认证集成的独立边界。
- 本批没有新 auth_next 持久化兜底；provider 若丢失 next，回 dashboard 而不是猜测旧邀请。该兼容代价必须写进交接。
- 保留的能力限定为登录入口、显式安全 callback URL 的请求形成，以及不含错误参数的 signin session-return。共享客户端仍默认使用 implicit flow；若提供方将 session 放在 callback 的 fragment 中，服务端无法读取它，会返回固定错误，signin 对错误与 session 混合输入安全拒绝。旧 signin 曾无视同时存在的错误并写入 session，这种容错不继续保留。此兼容变化须用独立探针记录并列为发布阻塞；下批优先统一实际 OAuth/OTP 返回路径及浏览器/SSR 会话，不能宣称端到端登录已保留或通过。

## callback 服务端

- 先解析合法 locale、安全目标及输入。支持一个非空 code，或者一对非空 token_hash/type；两模式互斥，身份字段重复、缺半边、未知 type、空白/控制字符或超长字段均安全失败，不创建 SDK client。code/token_hash 上限 4096；type 仅限 Supabase 的 email、magiclink、invite、signup、recovery、email_change。error 参数存在时始终固定失败，不反射 error_description。只解码 URLSearchParams 一次。
- 使用现有 @supabase/ssr 的实际 createServerClient，仅公开 URL/anon key 与该请求的 cookie。同一 client 只尝试一次 exchangeCodeForSession 或 verifyOtp；不能从失败切换另一认证模式、service key、用户 ID 或其他凭据，不自动重试。
- callback 本地隔离 SDK 的初始会话读取：仅保留本次 PKCE verifier 的值，其他请求 cookie 只保留名称用于旧分块清理，不把旧 session 当兑换凭据或恢复来源。实际 SDK 的 INITIAL_SESSION 即使在关闭 autoRefreshToken 时仍可能刷新过期 cookie，因此运输层也只允许本次模式的单次 POST；此限定不修改共享浏览器会话策略。
- 全流程含响应 body 受十秒操作截止和 caller abort 约束；完成清理 timer/listener。SDK 运输层失败只见安全合成错误，避免 SDK 内部记录原始传输异常。测试验证实际请求次数及清理，不把 mock 方法称为运输证据。
- 成功须取得完整非空 session 和提供方 user，user UUID 与 session.user.id 一致；不以额外 getSession 空结果或 error:null 装成功。成功通过标准 HTTP 303 重定向到当前 origin 的安全目标，保留 SDK 正常写出的 Set-Cookie（含分块和删除 cookie 的各自 options）。不生成内联脚本/HTML，不把 code/token_hash 或提供方错误复制到 Location。
- 明确认证拒绝、输入失败、配置缺失、超时、异常均返回固定错误标识的 signin 重定向，保留安全 next 便于手动重新登录；未知结果不自动重放 code/OTP。失败不得输出新 session cookie；可保留 SDK 明确的删除 cookie。cookie/config 操作异常同样安全失败，无原始日志。
- 所有响应 `Cache-Control: no-store`、`Referrer-Policy: no-referrer`。这些头约束本次响应，不能证明上游访问日志或全部认证页面已完成隐私控制。

## 验证与发布边界

先保存旧代码实际日志/错误回显、持久化或 HTML 回跳失败的 RED；使用虚构 sentinel，不访问真实家庭或认证。shared helper 验证八语言、三类合法目标、重复/嵌套/编码/注入反例。React 挂载真实 signin/AuthProvider，替代 SDK/auth/router 边界，覆盖 provider URL、session 真假、失败固定文案、旧 key 删除/不读取、storage 异常、晚到结果/重复 effect。与上一批邀请回归一起运行，避免破坏原邀请返回。

Callback 采用真实 route/adapter、真实 Supabase SSR/JS SDK 与 loopback Auth fixture，覆盖 PKCE code、六种 token_hash/type、cookie 写入/清理、严格失败、零调用拒绝、deadline/abort、日志与响应无敏感 sentinel/脚本反射。需要的 PKCE verifier/cookie 完全合成；没有实际 Supabase/browser-cookie 整合或提供方授权证明。

定向通过并独立审查后，控制器执行新 `npm run verify`、shared、infra，保存原始文本与 SHA-256、恢复 next-env；全量验证有源码变化则重跑，未变不重复。最终更新研究、handoff、主计划与 P0/P1 证据索引，保留原失败与复审。G0/G1 原门槛不降低；达原里程碑才推送，不提交/推送本地小批，不迁移、部署、发邮件或调用远端 Auth/付费服务。

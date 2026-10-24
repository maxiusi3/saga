# 认证返回与浏览器／服务器会话衔接

2026-10-19（Asia/Taipei）。承接已完成的[认证回跳批](../../research/2026-10-19-auth-return.md)及 handoff 首项。用户已授权继续原升级计划；本批仅本地实现、合成验证和交接，不调用真实 Auth／邮件，不迁移或部署。

## 已核实原因与选择

共享 `createClientSupabase` 目前使用 plain supabase-js 默认 implicit 流程与 localStorage；服务端 callback 只处理 code 或 token_hash/type，并写 SSR cookie。fragment 无法到达服务端，因此既有 mixed-error/fragment 探针暴露真实页面兼容变化。Zustand 还持久保存 user/isAuthenticated，初始化先读 session 再重复注册 listener；首页会把 fragment token 改写到 query，OTP 页面只以 error=null 判断成功。

采用已安装 `@supabase/ssr` 的浏览器 PKCE／cookie 实现，保持 `createClientSupabase()` 公共调用入口。其 `detectSessionInUrl=false`：code 交给既有有界服务端 callback，显式 signin session-return 仍由既有严格 parser 处理，SDK 不绕过页面验证。与继续 implicit＋客户端专用回调、手工复制 localStorage/cookie 相比，这一选择直接使用现有服务端 callback 和 SDK cookie 协议。

旧 localStorage SDK session、verifier 与 `auth-store` 缓存只按本项目精确 key 尽力删除，不读取／自动导入、不枚举清空 storage，不触碰录音 IndexedDB 和其他用户数据。已有 cookie 按 SDK 正常恢复和验证；只持有旧 localStorage 会话的用户需要重新登录。旧的 fragment-only callback／畸形域名路径不恢复为成功；应重新发起规范登录，不能为兼容接受 error＋token 混合输入。

## 实现约束

1. 浏览器使用一份 cookie-backed PKCE client，公开 URL/anon key、完整 SDK cookie 编码／分块；禁止在服务器渲染环境共享浏览器认证 singleton。服务器无请求上下文的匿名 client 禁止持久 session、自动刷新和 URL 检测。预览缺配置仍返回明确失败的完整 auth stub（包括 OTP/setSession），不报告虚假成功。client 创建不打印配置、凭据或原始 SDK 异常。
2. AuthStore 不再从 localStorage 重建已登录身份。初始化幂等、仅一份 auth listener，先监听再核对现有会话；异步身份校验在 listener 回调外执行，避免 SDK 锁内重入。UI 的 authenticated user 由当前 session 与 provider `getUser` 核对，provider 拒绝／空会话／错误只得到未认证和固定安全错误。初始化、身份事件、显式登录／退出之间有代次失效；退出或新身份出现后旧结果不得恢复旧账号。`getAccessToken` 仅交付当前有效 session token，权限仍由服务器检查。保留公开 store action API 和 signin/signup 的确认邮件语义；不要求每次组件挂载产生额外 listener。同一已核实用户的常规焦点恢复／token 刷新复核须保持现有页面挂载，不能因临时 loading 卸载录音；这不授予未经核实的新身份。普通并发读取互不失效，token getter 自身触发的同身份成功刷新应等待／协调核实结果后返回当前 token，真实退出／换账号／拒绝仍使旧操作失效。
3. `getAuthenticatedUser(request)` 用公开配置核实身份，不依赖 service-role 才能验证 Bearer。显式 Authorization 无效／畸形／过期时不得回退到另一个 cookie 身份。Cookie 模式使用请求的 `getAll`／SDK `setAll`，刷新、分块和删除 options 传入响应 headers，不能仅支持五块。以 provider `getUser` 为准，不相信请求 cookie 中 user 声明。配置／SDK异常返回固定安全 503/401，无原始日志；认证网络等待应有十秒总截止、caller abort，禁止无界刷新或网络重试。保留现有 `AuthResult` 接口与调用方响应头传播。暂时性网络／服务故障仍返回安全 503，但不得把用于限制 SDK 重试的合成错误所诱发的 cookie 删除写给浏览器；保留可恢复凭据不代表通过认证。真实提供方拒绝的删除与已成功刷新产生的有效 cookie 写入仍按各自结果传播。
4. 已有 callback 的一次选定 POST、PKCE verifier 隔离、cookie-preserving 303、安全 next、固定错误和 deadline 不回退。浏览器产生的 verifier 必须能由该 callback 消费，回调 cookie 必须可由新浏览器 client 恢复，不能额外自行兑换同一 code。显式合法 next 和八语言规则不变；丢失 next 回 dashboard。
5. OTP verify 页面通过共享会话判定检查完整 session/user，合法 next 返回邀请或 dashboard；错误、安全上下文变化／卸载、重发和重复提交不能让迟到结果导航。重发的 callback 使用同一安全 next。首页停止将凭据从 fragment 复制到 query；历史误落首页的认证输入清理后进入固定错误重新登录，不猜测 token/invitation。仅精确单一 `?type=invite` 且无 fragment、凭据、错误、重复或额外 query 的既有入口，保留 `router.push('/<locale>/accept-invitation')` 原始链接指引，不读取 session 或发出 fetch；该无凭据指引不认证、不推断邀请，既有回归断言保持不变。middleware 删除硬编码畸形域名修补，只保留正常 locale 路由；规范 PKCE callback 路径始终保留。
6. 不改邀请协议／业务事务、生产开关、依赖／lockfile、根迁移、前批证据、付款与真实家庭数据。共享认证行为变动需运行既有 signin、邀请、store 回归，不能用更弱断言换取通过。

## 验收与真实环境边界

先记录旧 factory 的实际 implicit/no-cookie 行为、旧缓存身份或 OTP 假成功的行为 RED，使用虚构标记；保留原始失败及 before 源码。新回归覆盖 PKCE challenge/verifier、一份 cookie client、禁用自动 URL session、旧 key 删除但不导入、无配置失败、server/browser 隔离，以及 store 初始化／事件／退出／晚到结果。

使用实际浏览器 SDK、服务端 callback／guard 和 loopback Auth fixture验证：OAuth PKCE 请求→callback code兑换→cookie响应→新页面／新 client读取→provider核实同一user；邮件请求形成 PKCE challenge，code返回和 token_hash 两种服务端返回；数值OTP在浏览器写入同一cookie；SSR cookie身份与Bearer身份一致；拒绝无verifier、错误、空会话、伪造cookie、重复／混合输入；刷新后的cookie传播、退出后新SSR请求拒绝。至少有一条真实 Chromium cookie/导航的本地链，浏览器外联仅允许本地 fixture/app，所有模拟账户均虚构，清理所属服务／进程／socket。合成服务不等于真实Google授权、SMTP发送、Supabase JWT/RLS/PostgREST或生产域名配置已通过。

定向通过、冻结源码和独立审查后运行新 `npm run verify`、shared、infra；保留日志／哈希和 next-env 起点字节。RB1 状态精确区分“本地 code/cookie 根因已修复及合成链通过”与“真实提供方／部署验收仍待完成”；发布层面的认证资格不得被本地通过自动关闭。原G0/G1还需正式权限、Storage、迁移／回退／备份、供应商和真机证据，不降低门槛。

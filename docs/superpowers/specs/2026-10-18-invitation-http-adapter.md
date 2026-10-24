# 邀请接受与状态恢复 HTTP 适配

2026-10-18（Asia/Taipei）。继续[邀请事务候选](../../research/2026-10-18-invitation-transactions.md)及[handoff](../../HANDOFF-2026-10-13-upgrade.md)的身份/兼容接入步骤。本批属于应用接口调整，不改 D01–D16、商品或 G0/G1。

## 范围

实现应用内接受邀请与显式状态恢复，将两个旧 HTTP 接受入口和 Supabase facade 的接受调用收敛到同一适配层。新增服务端开关 INVITATION_TRANSACTIONS_ENABLED，仅精确值 true 启用；默认或其他值关闭。关闭时两个接受入口及新状态入口返回 503，且不读认证配置、不创建客户端、不访问网络/数据库。不存在旧 RPC、service client、直表或多个 token 回退。

本批只修改两个旧 accept route 和 api-supabase.ts 的 invitations.accept；新增协议、服务端适配、客户端 HTTP helper、状态 route 及相关测试；更新五份交接文档。本批前所有实验/运行时、根迁移、依赖、旧证据及其他应用行为保持。无真实 Supabase/Auth/支付/邮件/家庭数据调用，无迁移/部署；原里程碑未达到不提交/推送。

发送/释放/权益供给、旧 GET/verify/check-pending 中的公开信息与日志、钱包/支付/直表权限、历史 token/member 兼容及正式 UI 恢复体验不在本批完成范围。旧 RPC/直表仍可能被绕过，不能因 HTTP adapter 完成而宣称生产权限已关闭。生产开关不得在本批启用。

## 身份和请求

- 接受入口保留 POST /api/invitations/accept（JSON body）和 POST /api/invitations/[token]/accept（Next params 已解码一次）；新增 POST /api/invitations/status（JSON body）。只接受规范 v1_ 加 32 位小写十六进制 token，不 trim、不再次解码、不改大小写、不猜测历史映射。不得将 token 放入错误/调试响应或日志。
- JSON body 只允许 token 和可选 user_id；user_id 仅为旧调用兼容的一致性断言，若提供，须为 UUID 且与验证后的身份完全相等，不作为身份来源。拒绝数组、null、非法 JSON、未知键和非字符串 token；path 接受入口不消费 body 中的身份。debug 参数不产生诊断回显。
- 请求必须显式携带格式有效的 Authorization: Bearer <token>。无 Bearer、空/畸形 header 均 401；cookie-only 不支持，Bearer 失败也不尝试 Cookie 身份或 service key。Cookie 与 Bearer 同在时仅使用 Bearer。
- 只用 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 建立每请求独立 Supabase client。使用 auth.getUser(bearer) 向认证服务验证，不解码 JWT payload 当身份；persistSession/autoRefreshToken/detectSessionInUrl 均关闭。后续 status/accept 用同一 client、同一 Authorization，绝不替换凭据。只读取提供方顶层 id/email/email_confirmed_at，metadata/self-asserted email 不授资格；id 必须 UUID、email 必须非空且满足候选 ASCII 邮箱契约、email_confirmed_at 必须有效时间。未确认/缺失邮箱返回 403。身份服务失败/不可用或配置缺失返回安全 503；明确认证拒绝返回 401。
- 使用一个 10 秒请求操作截止和请求 abort signal 约束认证及 RPC 读取；所有退出清理计时器/监听。PostgREST 请求显式禁用重试。取消或超时不能诱发新的接受写入。
- 所有响应为 JSON，Cache-Control: no-store、Vary: Authorization；不输出原始错误 message/details/hint/context、邮箱、Bearer、token 或 service key。错误使用固定安全文案及可判定 outcome。

## 实际 SQL / HTTP 契约

固定消费 invitation_candidate schema，不更改原实验定义：

| 操作 | RPC 名与实际参数 | 调用约束 |
| --- | --- | --- |
| 状态 | status，{ p_token: token } | 始终用已验证的收件身份，只读持久状态 |
| 接受 | accept，{ token: token } | 严格一次写入尝试，不传 user_id、邮箱、余额或角色 |

参数名取自旧 candidate.sql；status 的 p_token 与 accept 的 token 有意不同。真实 PostgREST schema 暴露、函数授权、生产 Auth/RLS 和候选迁移未部署，本批只实现可关闭的应用适配。

接受前调用 status 一次，严格验证其恰一行 TABLE 返回、规范 token 精确相等、UUID/角色/状态/时间/布尔类型。accepted 时 user_id 必须等于已验证身份，member_id/joined_at 有效；其他状态这三项必须 null，expired 要求 is_expired=true。该读取仅建立 invitation_id/project_id/role 等返回一致性期望，不生成成员、不跳过后续 accept、不能把预读 accepted 当本次成功，也不把本机时钟当数据库资格。

只有 status 结果可确认时才进行一次 accept。accept 返回必须恰一行，invitation_id/project_id/role 与 status 一致，user_id 与已验证身份一致，member_id 为 UUID、status=accepted、joined_at 为有效时间，outcome 只允许 accepted/already_accepted。若预读已经 accepted，返回 member_id/joined_at 也须相同且 outcome=already_accepted；pending 预读没有成员映射可比较。任一缺失/null/多行/类型或身份冲突均不得成功。只将明确允许的安全字段复制到响应，拒绝额外身份/凭据信息进入响应。

接受确认响应 200：success=true、outcome、invitation_id、project_id、user_id、member_id、role、status、joined_at。保留旧 UI 所需 project_id/role，但不使用预读字段补造缺失的接受结果。成功仅依据最终 accept 返回。

已识别的 SQLSTATE 42501 归安全 403，22023 归 400，23502/23503/23505/23514 归 409，outcome=rejected。接受尚未发出时的配置/身份/不可确认预读返回非 2xx、outcome=not_attempted（参数/资格拒绝可标 rejected）。接受发出后的超时、连接丢失、未知 SQLSTATE、结果结构不符等返回 503、outcome=unknown，并指示可显式查询状态；不得返回 2xx、自动重试、自动查询后回写或切换 token。

status route 从同一认证过程调用且只调用 status，一致性验证通过后返回 200、success=true、outcome=confirmed，以及 invitation_id/project_id/role/status/expires_at/is_expired/user_id/member_id/joined_at；不回传 token。状态查询的 pending/declined/expired 不是接受成功。状态不可确认时只报告未知/拒绝，不执行 accept/release/send。

## 客户端衔接

api-supabase.ts 的 invitations.accept 使用当前 session.access_token 调用共享 HTTP helper，POST /api/invitations/accept，只发送 token（不从浏览器推断确认邮箱/成员身份），不再直接调用旧 accept_project_invitation。无 session 时拒绝且不发 HTTP。helper 校验非 2xx/未知结果和完整确认响应；畸形 2xx 不算加入成功。可提供独立 status helper 供后续显式恢复，不能自动调用或重试接受。保留 ApiClient facade 的返回包装，不修改发送/list/钱包分支。

## 验证

1. 先保存旧 HTTP 接受在开关关闭时仍进入认证/旧逻辑的真实 RED；测试依赖可在外部边界替代，不能将缺新模块/环境错误冒充业务 RED。
2. 真实 handler 与实际 Supabase SDK 对接本地 loopback HTTP fixture：核对 Auth 请求 Bearer 与后续 PostgREST Bearer、apikey/schema profile、status/accept 的精确参数及顺序/次数。fixture 是合成认证/REST 提供方，不宣称真实 Supabase/JWT/PG17 集成。禁止将所有 SDK 方法 mock 后称为运输验证。
3. 覆盖关闭零外调、错误/缺失 bearer、相异 Cookie、身份未确认、metadata 邮箱伪造、body user_id 不匹配、非法 token/JSON、status 非法/多行/错 token/已接受另一人、accept 缺字段/项目或身份冲突、SQL 拒绝、网络丢失/超时/abort。验证接受结果丢失后显式 status 查询不追加 accept，未进行自动写重试。
4. 覆盖两个现有 HTTP 入口与 facade/helper 的真实响应行为；客户端不能把畸形 2xx 当成功。认证失败、预读失败、接受未知以及状态只读请求都要以 fixture 捕获的实际外部请求次数断言无额外写入。
5. 测试服务器/连接/计时器完整清理；本地 HTTP 日志仅保存安全摘要，合成 token/Bearer 不进入公开输出。原始 RED/中间失败保留并分类；最终代码输入与日志哈希固定。
6. 应用有变化，执行完整 npm run verify、shared、infra；不得复用前批 707 输入的旧执行当本批通过。next-env 恢复起点字节，依赖未改，audit 42 项旧失败继续单列。旧 PG17 实验输入/证据不变则仅核对指纹，不重跑其矩阵。
7. Task 1、Task 2 和整批独立审查，更新 handoff/主计划/docs 索引/P0/P1。原 G0/G1 仍按生产权限、可信权益事件、兼容迁移回退、备份、供应商、真机证据判断；本地 HTTP 实现不是里程碑。

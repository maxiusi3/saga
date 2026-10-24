# 邀请发送、释放与发送者恢复 HTTP 契约

2026-10-21（Asia/Taipei）。继续已批准升级方向及 handoff 的 send/release HTTP 与发送者恢复。本批是默认关闭的应用传输层与旧入口关闭，不实现完整发送管理产品，不修改已审 SQL。

## 范围与边界

- 复用 `invitation_candidate.send/release/lookup` 的实际签名与数据库权限，不修改实验、依赖、根迁移或旧证据。保留当前分支和全部未提交工作；本地合成 HTTP fixture，不调用真实 Auth/数据库/邮件/支付，不迁移或部署。
- `INVITATION_TRANSACTIONS_ENABLED` 仅精确 `true` 启用新操作。关闭时先返回安全 503/not_attempted；不解析 body、不读认证配置、不创建客户端或外调。
- 本批送入 send 的 `source_id` 是明确引用，必须由 SQL 核对 actor、角色席位、remaining、verified/revoked；不是客户端授权证明。尚无受限来源选择接口，旧表单没有 source/request ID 时明确不可用。不能填写虚构来源、用钱包镜像替代来源、自动调用付款/初始化 RPC。完整来源选择、发送管理 UI、历史列表/映射、生产资格另批验收。
- 用户授权在原升级里程碑及 P0 修复达成后推送。按原 G0/P0 验收证据判断，不能把本批传输层完成当作 P0 已完成；未达条件保持不提交/推送，不合并 main。

## HTTP 入口

| 入口 | 请求与操作 |
| --- | --- |
| POST `/api/projects/[id]/invitations` | 新发送契约；项目来自已解码一次的 path。body `{request_id, source_id, email, role, message?}`。只调用一次 send，无预读、无邮件 |
| POST `/api/invitations/release` | 新全局释放入口；body `{invitation_id, reason}`，reason 为 cancelled/expired。只调用一次 release |
| POST `/api/invitations/lookup` | body `{request_id, project_id, role}`。只调用 lookup，验证结果所属项目/角色；不执行写入 |
| 项目邀请 GET、旧集合 DELETE、admin cleanup GET/POST | 始终安全 503/not_attempted，零认证/表/旧 RPC/邮件调用；不以开关 true 恢复旧旁路 |

所有新 body 只接受规定键；拒绝数组/null、非法 JSON、未知键、缺失/错误类型。UUID 为规范小写 36 字符形式。邮箱仅去除外层 ASCII 空白，限定可见 ASCII、一个非空 @ 对并转小写，最大 254 字符。role 仅 facilitator/storyteller。message 缺省/null/空串归 null，其他必须字符串且最多 2,000 Unicode 码点；不 trim 非空正文。标准 token 仅 `v1_` 加 32 位小写十六进制，服务端不生成 token。

旧发送 body 缺 request_id 或 source_id 时明确 503/not_attempted；不生成新请求 ID、猜测来源或尝试旧调用。其他非法输入返回 400/rejected。发送和 lookup 的 project/role 必须与最终返回一致。

释放刻意采用全局 invitation ID 地址，body 不接受 project_id 或 request_id。原 SQL 在同一事务核对当前项目 facilitator，并允许撤销来源/非活动项目/项目转移后的合法释放；HTTP 不用 sender lookup 作为释放前置，因为后者会拒绝这些合法清理情景。旧项目路径 DELETE 不再执行释放。管理页取消调用改用此全局入口，并校验返回的 invitation_id/project_id 与当前 UI 上下文一致；禁止把错误路径或畸形 2xx 当成功。这里没有客户端提供的项目权限声明，项目权威来自 SQL 中该 invitation 的绑定。

## 身份、截止与返回

沿用接受适配的 Bearer-only 规则：每请求独立 anon-key Supabase SDK client，`auth.getUser(bearer)` 核实提供方顶层 UUID/email/email_confirmed_at，同一个 Authorization 用于后续 RPC。Cookie-only 拒绝；错误 Bearer 不回退 Cookie/service key。不得使用用户 metadata 的 email 或浏览器 user_id 赋权。

认证和操作共用 10 秒截止与 caller abort；包括响应 body 的读取。PostgREST `.retry(false)`，取消/超时后不得开始新写入。写入是否可能发生以实际 fetch 发出为界。所有路径清理计时器/监听，错误与日志不含 token/Bearer/email/原始提供方消息；固定安全文案。响应 `Cache-Control: no-store`、`Vary: Authorization`，fetch 禁止重定向和凭据 Cookie。

| 操作 | 精确 RPC 参数 | 确认返回 |
| --- | --- | --- |
| send | `{p_project_id,p_request_id,p_invitee_email,p_role,p_source_id,p_message}` | 恰一行，UUID invitation/project、匹配项目/角色、规范 token、真实时间、状态 pending/accepted/declined/expired；outcome created/reused，created 必须 pending |
| release | `{p_invitation_id,p_reason}` | 恰一行，匹配 invitation UUID、合法 project UUID、status 与 reason 一致、outcome released/already_released |
| lookup | `{request_id}` | 恰一行，匹配项目/角色、规范 token、expires_at、is_expired 布尔、状态与 nullable 成员字段一致；accepted 的 user_id 是收件人，不要求等于发送者；expired 要求 is_expired=true |

只复制确认所需字段到成功响应，额外提供方字段丢弃。send/release 返回 `success:true` 加确认字段；lookup 返回 `success:true,outcome:'confirmed'` 加状态及 token。仅成功 send/lookup 响应可包含用于恢复邀请的 token；不记录或在错误中回显。请求 ID 已由调用方持有，不将缺失 SQL 字段从预读/输入拼造为最终写入结果。

SQLSTATE 42501→403、22023→400、23502/23503/23505/23514→409，outcome rejected。配置/认证/输入在写入前失败为 not_attempted 或明确 rejected。发送或释放真正发出后的超时、断连、未知 SQLSTATE、空/多行/缺失/冲突结果为 503/unknown；不自动重试、不后读冒充本次写入成功。lookup 不可确认为 unknown/rejected，不能推断原请求未提交。

lookup 仅代表原发送者的 request_id 恢复资格。项目转移或其他权限变化可能令查询被拒；释放无需持有发送请求 ID。没有可确认的恢复结果时保持 unknown，本批不伪造可供所有维护者查询的状态接口。邮件送达不在 send 成功含义中，所有邮件调用移除。

## 客户端与兼容

新增 sender protocol/client helper，严格验证成功、失败及其与原命令的一致性。网络/畸形结果不能成功，无自动写重试、token 改写、localStorage/sessionStorage 凭据或邀请内容缓存。调用方保留同一 request_id/source/规范化 payload 供显式恢复；本批不提供刷新后的完整发送草稿恢复 UI。

`supabaseApi.invitations.send` 和稳定 `api.invitations.send` 接受可选 options `{request_id,source_id,message?}`，完整 options 才用当前 session Bearer 调 HTTP；旧三参数调用明确 not_attempted、零 RPC。新增 release/lookup facade，保持稳定 API 的 data 包装。`api.projects.generateInvitation` 同样经严格 helper，旧不完整调用明确不可用；`invitations.list` 不再直表返回旧 token，明确不可用。

管理页取消使用新 helper，不要求 source/request ID。旧发送页面/组件仍缺可信来源选择，不能声称本批已恢复正常发送；只允许严格确认响应触发成功，不凭 response.ok。定向测试必须覆盖实际取消调用的 URL、payload、Bearer、确认/unknown 行为以及旧发送/列表不可用。

## 验证与出口

1. 在新业务实现前保存真实 RED：旧项目 POST/DELETE/GET、cleanup 在本应关闭时仍触发身份/旧逻辑，或旧 facade send 仍调 RPC；使用外部边界替代，不用缺模块当业务 RED。
2. 真实 handlers + 实际 Supabase SDK + 本地 loopback HTTP fixture，捕获 auth/RPC 的方法、schema profile、Bearer、精确参数、顺序和次数。覆盖所有成功状态、幂等/终态、两角色，以及输入/身份/结果污染、SQL 拒绝、断连/响应体滞留/超时/abort。
3. 丢弃 send/release 响应后显式 lookup 不追加写；释放不预读 lookup，已撤销来源等由数据库事务裁决。真实 PG17 行为沿用冻结前批输入/证据，HTTP fixture 不声称真实 PostgREST/JWT/PG17 端到端。
4. 客户端/facade/UI 关键取消行为验证；不把 token 或凭据写入公开测试日志。保留 RED/失败/最终运行归属和哈希，旧实验与证据仅核指纹。
5. 新运行 `npm run verify`、shared、infra，保存日志/退出码，恢复 next-env。独立规格、质量、文档及整批审查；更新 handoff、总计划、docs 索引、P0/P1 和原里程碑判断。

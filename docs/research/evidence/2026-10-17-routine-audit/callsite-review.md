# 12 个 SECURITY DEFINER 目标：调用点与根迁移核对

2026-10-17（Asia/Taipei）。仅静态读取已捕获的元数据与当前工作树源码。本次没有读取凭据、连接远端、执行 RPC、运行测试或修改现有源码/迁移。HEAD 为 `1caa21a72a23d6f5166ed127847ca931374b890a`；未提交源码以文末 SHA-256 为准。远端函数正文尚未纳入本报告，不能据本地同名 SQL 宣称远端函数语义已验证。

入口依据：[补充元数据](../../2026-10-17-metadata-supplement.md)、[本批计划](../../../superpowers/plans/2026-10-17-upgrade-routine-audit.md)、[06:13 UTC 快照](../2026-10-17-remote-metadata/snapshot-2026-10-17T06-13-03-052Z.json)。以下 `lib/`、`app/`、`components/`、`stores/`、`services/`、`types/` 位置均相对于 `packages/web/src/`；`supabase/` 开头路径相对于仓库根目录。所有行号为核对时的一基行号。

## 结论与边界

- 在 `packages` 的 TS/TSX/JS/CJS/MJS 源码中检索全部 10 个目标函数名，并核对 `packages/web/src` 的全部 `.rpc(`：得到 **13 处字面 RPC 调用**。8 处的参数名对应 5 个已捕获重载；另 5 处均为邀请调用，参数名不能匹配所捕获重载。字符串是否是合法 UUID、具体部署代码与 PostgREST schema cache 状态未实测。
- 邀请差异位于实际页面调用链，不只有库封装。发送页面走根迁移的 email/token 契约；两个接受页面分别走 `p_token/p_user_id` 和 `invitation_token/user_id` 契约；捕获的远端接受函数只列出 `p_invitation_id/p_user_id`。后一个 API 的命名也不匹配根迁移。
- TABLE 返回值存在后续契约缺口：发送 API 直接读 `invitation.invitation_id`；token 接受 API 直接读 `result?.project_id`，均未 `.single()` 或取数组首项。即使先修复参数契约，仍须修复/验证结果解包。此处是基于 set-returning RPC 的常规 JSON 数组契约推导的静态缺陷，不是线上请求失败记录。
- 应用层已验证用户的事实，不能替代数据库对直接 RPC 的授权。快照显示 12 个目标均由 `postgres` 拥有、`SECURITY DEFINER`、有效 `PUBLIC EXECUTE`；anon/authenticated/metadata_reader/service_role 都有 public USAGE 和函数 EXECUTE。函数正文、对象范围、真实 JWT claims 与副作用仍需逐重载核对。
- 根迁移中 `auth.uid() != p_user_id` 和 `v_user_role NOT IN (...)` 的 NULL 路径不是完整拒绝；其余多个函数只信任传入身份或完全没有授权检查。下文只把这些结论归属于本地文件，不归属于远端函数。`SEC-02/03 FIX`、`safe`、`admin` 等注释不作为安全证据。

## 完整目标签名与调用覆盖

`TABLE` 的字段顺序、参数名和参数类型取自快照。`timestamptz` 是快照 `timestamp with time zone` 的等价简写。C 编号见下一节。根迁移 M1 指 `supabase/migrations/20261006000001_fix_wallet_rls_and_rpcs.sql`，M2 指 `supabase/migrations/20260625081000_dashboard_support_tables.sql`；B 指独立的 `supabase/bootstrap/20260624000000_app_base_schema.sql`，不把 B 当作根迁移。

| ID | 完整远端签名 | 远端返回类型 | 真实调用对照 | 本地定义位置/兼容性 |
|---|---|---|---|---|
| F01 | `public.accept_project_invitation(p_invitation_id uuid, p_user_id uuid)` | `TABLE(project_id uuid, user_id uuid, role text, status text, joined_at timestamptz)` | C05/C06/C07 均不匹配 | M1:204 是 `(p_token text,p_user_id uuid)`，返回 `TABLE(project_id uuid,role text,success boolean)`；是不同重载 |
| F02 | `public.cleanup_expired_invitations()` | `integer` | C08/C09/C10 参数吻合 | M1:246 参数/返回吻合；正文未证等价 |
| F03 | `public.create_checkout_session(user_email text, user_id uuid, project_title text)` | `json` | 未找到目标 RPC 调用 | 根 migrations 没有该定义；支付页面是否走其他结账实现不在本报告的函数语义范围内 |
| F04 | `public.create_project_with_role(project_name text, project_description text, facilitator_id uuid, creator_role text)` | `uuid` | C02/C03 参数吻合 | 根 migrations 没有该定义；B:399 参数/返回吻合，不能当线上正文 |
| F05 | `public.get_unread_notification_count(user_id uuid)` | `integer` | 未找到目标 RPC 调用 | M2:235 参数/返回/SQL 语言吻合；正文未证等价 |
| F06 | `public.initialize_user_wallet(p_user_id uuid)` | `TABLE(user_id uuid, standard_hours integer, premium_hours integer, created_at timestamptz, updated_at timestamptz)` | C01 参数吻合 | M1:32 参数/返回吻合；UI 使用 vouchers/seats 字段，与该函数的 hours 返回不同 |
| F07 | `public.mark_notifications_as_read(user_id uuid, notification_ids uuid[])` | `integer` | 未找到目标 RPC 调用 | M2:201 参数/返回/plpgsql 语言吻合；本地 `notification_ids default null`，快照没有捕获参数默认值，不能据此断言远端可省略第二参 |
| F08 | `public.process_package_purchase(p_user_id uuid, p_package_code text, p_standard_hours integer, p_premium_hours integer, p_payment_reference text)` | `TABLE(user_id uuid, standard_hours integer, premium_hours integer, updated_at timestamptz)` | 未找到此重载调用 | M1:62 参数/返回吻合；不能将它的收紧当作覆盖 F09 |
| F09 | `public.process_package_purchase(package_id text, payment_intent_id text, user_id uuid)` | `jsonb` | C11 参数吻合 | 根 migrations 没有此重载定义；浏览器库实际使用这一版 |
| F10 | `public.request_data_export(p_user_id uuid, p_project_id uuid, p_include_audio boolean, p_include_photos boolean)` | `TABLE(export_id uuid, status text, created_at timestamptz)` | C12 参数吻合 | M1:267 参数/返回吻合；本地正文仅返回虚构 queued/UUID，无持久入队 |
| F11 | `public.request_data_export(project_id uuid, user_id uuid, export_options jsonb)` | `uuid` | 未找到此重载调用 | 根 migrations 没有此重载定义；不能将 F10 的变更当作覆盖 F11 |
| F12 | `public.send_project_invitation(p_project_id uuid, p_invitee_id uuid, p_role text, p_invited_by uuid, p_invitation_message text)` | `TABLE(invitation_id uuid, project_id uuid, invitee_id uuid, role text, status text, invited_at timestamptz)` | C04/C13 均不匹配 | M1:133 是 `(p_project_id uuid,p_inviter_id uuid,p_invitee_email text,p_role text,p_token text)`，返回 `TABLE(id uuid,token text,email text,role text,expires_at timestamptz)`；参数类型序列也不同 |

“未找到”限于当前仓库源代码检索；不意味着远端 RPC 不可调用或不存在旧版客户端、外部服务、手工请求。未检索构建产物、依赖、私有采集结果或凭据。通知 UI 当前可见服务使用 HTTP/表操作，不调用 F05/F07；不能因此把移除权限认定为全客户端无影响。

## 客户端、身份、参数、返回与失败路径

共同客户端事实：`packages/web/src/lib/supabase.ts:27` 的 `createClientSupabase()` 返回 `any`；:52 使用 public anon key、持久化/刷新用户 session，没有管理员 key。在浏览器有会话时使用用户凭据；无会话时是 anon 配置，调用点需另外处理登录。`:63` 的 `createServerSupabase()` 只创建 anon client、不会自动绑定请求 cookie，本批 13 处调用未使用它。`:77` 的 `getSupabaseAdmin()` 使用 service role key、关闭 session 持久化/刷新；没有传入终端用户 JWT。`types/supabase.ts:567` 的 Functions 类型为空，`api-supabase.ts:2` 只是导入/导出 Database，没有用它创建 RPC 类型约束。

下表中的 TS `string` 不构成 UUID 校验。应用传入登录用户 ID 是良性调用行为，也不能阻止攻击者跳过 JS 封装直接构造 RPC 参数。

| 调用 | 精确源码位置和参数 | 客户端/身份来源与调用前检查 | 返回/失败路径及实际可达性 |
|---|---|---|---|
| C01 → F06 | `lib/api-supabase.ts:190`：`p_user_id=user.id` | 浏览器 client；:103 经 `auth.getUser()` 取得 user（公用实现 :38）；无 user 抛错。先从 `/api/wallets/me` 取钱包，已有钱包三类资源均严格为 0 才调用 (:183) | RPC data 被忽略。成功后另写 seat_transactions，再查询钱包 (:192–213)；这两步的返回 error 未检查。RPC 返回 error 则静默返回旧钱包 (:217)，无失败提示。`components/wallet/wallet-status.tsx:38` → `lib/api.ts:105` → 该分支；本次未确认 WalletStatus 是否挂载于当前页面 |
| C02 → F04 | `lib/api-supabase.ts:300`：`project_name`/`project_description` 来自参数，`facilitator_id=user.id`，`creator_role='facilitator'` | 浏览器 client；:296 用 `getUser()` 验证有 user；此封装没有钱包余额检查 | :307 抛 RPC error，:308 原样返回 uuid。`lib/api.ts:65–69` 包成 `{data: uuid}`；`stores/project-store.ts:98–99` 却取 `response.data.data` 并当 Project，存在另一个静态返回契约缺口。本次未找到调用该 store createProject action 的页面；现用创建页走 C03 |
| C03 → F04 | `lib/projects.ts:110`：name/description；`facilitator_id=projectData.facilitator_id`；`creator_role=projectData.role || 'facilitator'` | 始终 `this.supabase`，不是 :66–67 条件构建的 admin。方法本身未 getUser/绑定 facilitator；实际 `app/[locale]/dashboard/projects/create/page.tsx:77–82` 从 useAuthStore user.id 传入，:43 检查登录，:54–68 在 UI 检查券和席位。调用者可跳过这些 UI 检查 | 期望 scalar UUID，用 `.eq('id', data).single()` 取项目 (:123–127)，此返回处理与 F04 声明相符。RPC 失败抛错；二次查询失败抛 “Project created but failed to fetch details” (:131)，不可等同创建已回滚。UI :92–103 映射资源错误/一般错误 |
| C04 → F12 不匹配 | `lib/api-supabase.ts:346`：`p_project_id`、`p_inviter_id=user.id`、`p_invitee_email=email`、`p_role`、`p_token=crypto.randomUUID()` | 浏览器 client；:341 getUser，有 user 才调用。该封装未验证项目所有权、成员状态、邮箱/席位 | :354 抛 error、成功原样返回。被 `lib/api.ts:118` 转发；在本批源码检索未找到 UI 直接调用该 send 封装，实际发送页走 C13 |
| C05 → F01 不匹配 | `lib/api-supabase.ts:363`：`p_token=token`、`p_user_id=user.id` | 浏览器 client；:359 getUser，仅检查有 user，未在调用前查邀请/email/有效期 | :368 抛 error、成功原样返回。被 `lib/api.ts:123` 转发；未找到 UI 直接调用该 accept 封装，实际页面走 C06/C07 |
| C06 → F01 不匹配 | `app/api/invitations/[token]/accept/route.ts:132`：循环 `p_token=t`、`p_user_id=user.id` | Cookie client `getUser` (:32)；失败时用 anon key + Bearer header 并 `getUser(bearer)` (:39–45)；admin `getUser` 仅作为身份验证 fallback，RPC 仍用 bearer client (:49–53)。admin 预读 invitations (:84–100)，校验存在 (:107)、过期/expired (:113)、邮箱相等 (:119)；未强制 status=pending。没有 service key 时预读被跳过并在 :107 返回 400，不会调用 RPC | 所有 token 变体仍用同一不匹配参数名；:136 接受任何无 error data，没有验证行数/业务 success。:237 读 `result?.project_id`，未数组解包。普通 RPC error 经 :214–231 映射为 400/409/500；`debug=1` 在 :178–193 返回 RPC 错误与预查信息。真实 UI `app/[locale]/invite/[token]/page.tsx:80` 调它，:97 使用返回 project_id 跳转；如果未来只修参数而不修 TABLE 解包，跳转值仍可能缺失 |
| C07 → F01 不匹配 | `app/api/invitations/accept/route.ts:126`：`invitation_token=token`、`user_id` | 从 JSON body 接收 user_id (:9)，Cookie getUser 或 admin getUser(bearer) 验证身份 (:23–50)，:53 要求 user.id===user_id。RPC 使用独立 service-role client (:61–64)，未转发用户 JWT。admin 预读 invitations 要求 token/status=pending (:67–79)、邮箱相等 (:89)、未过期 (:97)、没有 active project_roles (:110–118) | 命名既不匹配 F01，也不匹配 M1。:131–142 把 RPC error 映射 404/409/500。:146–147 读取对象字段，但用预读 invitation 的 project_id/role fallback 掩盖 TABLE 解包问题；不验证返回行数/业务 success。真实 UI `app/[locale]/accept-invitation/page.tsx:221–228` 传 token/user.id；:234 跳转 |
| C08 → F02 | `app/api/admin/cleanup-invitations/route.ts:18`：无参数 | `getSupabaseAdmin()`；:10 先 `requireCronSecret()`，实际检查见 `lib/server/cron.ts:7–25`：未配置 expected 返回 503，header 不相等返回 401，正确才放行；不依赖终端用户 JWT | :20 有 RPC error 返回 500，成功 `{success:true,result:data}`。这是可访问 API 导出，仓库未找到调度调用配置的事实不影响其代码入口存在 |
| C09 → F02 | 同文件 `:76`：无参数 | 同一 cron-secret 检查 (:50) 和 service-role client (:54)。先从 invitations 查询过期列表，非空才调用 | 只解构 cleanupData、不检查 RPC error (:75–77)，可返回 `cleanup_triggered:true` 和 null result (:80–84)；HTTP 200 不能证明清理成功。调用是否产生副作用取决于真实 F02 正文 |
| C10 → F02 | `app/api/projects/[id]/invitations/route.ts:104`：无参数 | Cookie/getUser 或 admin.getUser(bearer) 验证 (:37–77)；admin 读项目并要求 facilitator_id===user.id (:89–99)。RPC service-role client (:84)，无用户 JWT | 一位项目 owner 打开自己的邀请列表就会请求无项目参数的 cleanup；实际范围需 F02 正文判断，不能说只清该项目。忽略返回 `{error}`，try/catch 仅覆盖 throw/reject，失败也继续列表 (:102–115)。真实 UI `components/invitations/invitation-manager.tsx:101`、项目 invitations 页面 :65 |
| C11 → F09 | `lib/api-supabase.ts:482`：`package_id=packageId`、`payment_intent_id=paymentIntentId`、`user_id=user.id` | 浏览器 client，:479 getUser；package/payment intent 是方法调用者给定的 TS string。此封装未向支付服务核实成功、金额、归属或重放状态 | :488 抛 error，:489 原样返回 jsonb，`lib/api.ts:183` 包为 data；未找到 UI 调用该 purchasePackage 方法。不能将此静态入口认定为当前支付页面的实际入账路径，也不能在未读 F09 正文前认定直接发参就能获资源 |
| C12 → F10 | `lib/api-supabase.ts:505`：`p_user_id=user.id`、`p_project_id=projectId`、`p_include_audio`/`p_include_photos` 为 options boolean | 浏览器 client，:501 getUser；未查询项目成员资格。对外 options 另有 includeTranscripts/includeInteractions (:498–499)，RPC 调用不传它们 | :512 抛 error，:513 原样返回 TABLE data；`lib/api.ts:196–197` 将整份 data 放进 `{data:{exportId}}`，与 scalar exportId 名称/后续 string 入参不合。未找到 UI 调用该 exports.request 方法；可见导出对话框走 `services/data-export.service.ts:77` 的 HTTP `/exports/request`，不据此认定导出 UI 已故障 |
| C13 → F12 不匹配 | `app/api/projects/[id]/invitations/route.ts:378`：`p_project_id=projectId`、`p_inviter_id=user.id`、`p_invitee_email=email.toLowerCase()`、`p_role=role`、`p_token=crypto.randomUUID()` | Cookie getUser 或 admin.getUser(bearer) 验证 (:182–223)；独立 service client (:230–233)。要求 projects.facilitator_id===user.id (:262)、email/role 存在且角色为 facilitator/storyteller (:272–283)、检查待处理重复邀请 (:286–309)、storyteller 唯一性 (:312–345)、本用户可用席位 (:349–372)。重复邀请检查使用 cookie client，即使用户由 bearer 验证亦未向它绑定 bearer (:287)；错误被忽略，不能将该预检当事务约束 | RPC error 直接 HTTP 500 (:386–391)。无 error 后 :398 用 `invitation.invitation_id` 查 invitations，未解 TABLE；根 M1 返回列还叫 id。取详情失败返回 500 (:401–406)，此前 RPC 成功不表示回滚。邮件失败被吞并仍 201 (:423–437)。UI `components/invitations/invitation-manager.tsx:140` 和 `app/[locale]/dashboard/projects/[id]/invitations/page.tsx:98` 均真实调用；页面发送 message，但 API :270 读取后未传 RPC |

## 本地定义的授权语义与依赖差异

这些事实来自本地文件，不推断远端 body 相等；签名/语言/search_path 一致不是语义等价。所有以下 SQL 都未执行。

| 定义 | 静态可证语义 | 与调用方/捕获结构的关系 |
|---|---|---|
| M1:32 初始化钱包 | :45 的 `IF auth.uid() != p_user_id` 只会在比较为 TRUE 时拒绝；任一侧 NULL 导致 UNKNOWN、跳过该 IF。:50–57 插入 hours=0 或返回已有行，不给 vouchers/seats 初始包。无固定 search_path | C01 期待用于三项资源均为零后的初始化，且成功后另记 initial_package grant；本地函数行为与该期待不同。快照 user_resource_wallets 未列 standard_hours/premium_hours；不能把这个本地定义直接重放成可靠修复 |
| M1:62 购买 5 参 | 未验证 auth.uid/role；p_user_id 和增量 hours 均来自参数；p_package_code 未使用；未核实支付成功/归属/金额；只查钱包最后一次支付参考作为幂等判断 (:82–102)，不是全历史唯一约束；SELECT 写 payment_reference，而迁移添加的是 last_payment_reference (:121) | F08 没有已发现源码调用，C11 用 F09。快照钱包没有 payment_reference/standard_hours/premium_hours；本地函数存在依赖缺口，不证明线上 F08/F09 是否可执行或有何漏洞 |
| M1:133 发送邀请 | 以传入 p_inviter_id 查询 project_members/owner_id，未绑定 auth.uid；:168 的 NOT IN 若 v_user_role 为 NULL 不进入拒绝；未检查成员 active 状态。插 project_invitations，无显式席位消费/锁定/通知等逻辑 | 根契约符合 C04/C13 参数，但不是 F12；快照 public 表清单无 project_invitations，应用 API 查的是 invitations。即便增加该重载也未完成返回 id/invitation_id、存储表、权限或席位语义迁移 |
| M1:204 接受邀请 | 验证 token/pending/有效期 (:219–227)，未绑定 auth.uid，也未核对登录邮箱/邀请接收人；将传入 p_user_id 插入 project_members，接受 token | C05/C06 参数对应本地契约；C07 名称仍不对应。快照 project_members 没有 joined_at 列，public 无 project_invitations；返回 success 与 F01 字段不同。不能用 API 外层邮箱检查证明直接 RPC 安全 |
| M1:246 清理 | 无身份检查、无项目过滤，删除 project_invitations 的过期待处理记录 | C08/C09 有 cron secret；C10 则任何通过项目 owner 检查的请求都可调用。只基于本地定义可判断其全表条件范围；远端 F02 范围待正文。快照 public 无该表 |
| M1:267 导出 4 参 | 以传入 p_user_id 查 project_members 或 owner_id，未绑定 auth.uid、未检查成员 active；:297–303 仅生成 UUID/queued/time，没有插入 export_requests；include flags 未使用 | C12 的有登录检查不能防止直接调用伪造 p_user_id；即使身份修复，本地 placeholder 也不能满足导出 getStatus 查持久记录的契约。是否对应远端 F10 尚未知 |
| M2:201 标记通知 | 按传入 user_id 过滤 recipient_id，notification_ids 可为 NULL（标记全部）；没有 auth.uid/role 检查；有固定 search_path | 当前源码未找到 RPC 使用。若要保留对浏览器开放，需绑定调用者身份与接收者；有没有服务端替别人标记的历史需求未知 |
| M2:235 通知计数 | SQL 按传入 user_id 聚合通知，无 auth.uid/role 检查；有固定 search_path | 当前源码未找到 RPC 使用；仅有 count 返回也不能自动视为无跨用户信息风险；远端正文是否一致未知 |
| B:399 建项目（非根迁移） | 未绑定 auth.uid/检查 role 以外的成员权限；非法 creator_role 回退 facilitator；先创建项目/角色，再仅在余额>0时扣券 (:413–436)，没有券不足拒绝，也未扣两类席位 | C03 的 UI 余额检查不是数据库保证。B 是本地 bootstrap 证据；不能将其直接当作实际 F04 的资源/权限实现 |

M1:312–321 只做 GRANT，没有先 REVOKE PUBLIC；“授予 authenticated”不等于“只有 authenticated”。而且 M1 的邀请 GRANT 精确指向 `(uuid,uuid,text,text,text)` / `(text,uuid)`，不能覆盖捕获的 F12 `(uuid,uuid,text,uuid,text)` / F01 `(uuid,uuid)`；M1 的购买/导出 GRANT 也只覆盖各一个重载。F03/F09/F11 在根迁移无对应正文，不能从邻近或同名函数借用安全结论。

快照 F01/F02/F06/F08/F09/F10/F11/F12 没有函数级 search_path；F03 固定为空，F04/F05/F07 为 `public, auth, extensions, pg_temp`。public 对四角色都不可 CREATE，不能仅凭缺少 search_path 就声称已能放置恶意对象；仍须结合真实未限定对象名和可写 schema 路径审查。

## 候选收紧的兼容影响与验证要求

本报告不生成或应用候选 SQL。以下是供本地实验选择方案时必须保留的约束。

1. **按完整重载授予/撤销权限。** 覆盖 F08 和 F09、F10 和 F11；不能用同名覆盖当完成。撤销 PUBLIC 后，明确授予需要直连的 authenticated 或受控 service_role。当前无源码调用的 F03/F05/F07/F08/F11 只能记为“本仓库未发现兼容依赖”，不能断言可删除。
2. **把浏览器本人操作和可信服务操作分别设计。** F04/F06 现有浏览器路径需要用户 JWT；正确的 NULL 拒绝与身份绑定应保持本人正例。C13/C07/C08–C10 使用无终端用户 JWT 的 service client；统一要求 `auth.uid() = p_user_id` 会中断它们。可信服务例外必须核对实际角色/claims与对象范围，不可仅信任 p_user_id 或接口名。C10 是用户请求触发的 service 清理路径，是否仍允许全局清理需要明确决定。
3. **邀请迁移是完整接口转换。** UI 面向 email/token，F12 接收 invitee UUID、F01 接收 invitation UUID。需要先确定邮箱未注册时的业务方案、token 到真实邀请 ID 的受控解析、邀请表/成员表真源，再选择保留旧兼容包装或切换页面/API。仅给参数加/去 `p_` 或加一个重载不足以兼容。TABLE 结果必须解包并校验恰一行/明确成功；统一 id/invitation_id、project_id/role。C06 无预查回退对象，C07 有 fallback，两者需分别验证。
4. **付款不能只加“当前 user”检查。** C11 可传 package/payment intent，F08 更接收任意 hours 增量；必须同时确定付款成功、归属、金额/套餐映射和持久去重来源。把购买函数改为仅 service_role 将中断 C11 库入口（当前未找到 UI 使用），应先有经过验证的服务端付款完成路径。未读远端定义前不选择哪一版为真源。
5. **初始化和导出需要业务结果兼容。** C01 目前忽略 RPC data/error并另写交易；应核实一次性资源发放是否发生及幂等边界。F10 的 TABLE 与 `api.exports.request` 所称 scalar exportId 不合；两未传 options 也需明确保留/废弃。本地 M1 导出是 placeholder，不能把返回 queued 当任务已持久化。
6. **失败要能被调用者识别。** cron GET C09 与列表 cleanup C10 忽略 Supabase 返回的 error；候选权限拒绝可能表现为 HTTP 200 或无提示。C03、C13 的 RPC 后续查询失败也可能在业务动作完成后报错，重试兼容要独立验证；不将第二步失败当数据库事务回滚。测试只需虚构用户/项目和合成付款记录，不应触发邮件或支付外部调用。

## 未知与本报告的验收状态

已完成：12 个目标签名、13 个字面调用、真实邀请 UI 链、客户端来源、方法/route 内实际检查、返回消费、失败处理、根迁移对应及源码指纹。没有依据运行时/远端日志宣称“线上已坏”“已越权”或“已泄露”。

待 controller/后续审查补齐：12 个真实远端定义与捕获 MD5 绑定；数据库实际身份检查/NULL 分支、对象归属、支付或外部副作用、表/列依赖与 search_path；PostgREST 暴露/schema cache 与实际部署版本；不存在本仓库里的旧客户端兼容情况；在独立本地数据库用合成正反例核对候选。此报告独立于定义采集器实现，不构成采集器审查、线上验收或 G0/G1 达成。

## 精确指纹

远端正文只记录前批公开 MD5，不在这里复制函数正文。MD5 仅用于后续取得定义时绑定精确对象，不表示正文已被本报告审阅。

| ID | 定义 MD5（06:13 UTC 快照） |
|---|---|
| F01 | `638c776a2a70d1cddd47055c583e1abd` |
| F02 | `84e83304fb503123d44f16e9fc18cb31` |
| F03 | `cc86b4d0449681833037c4a5c49c79a6` |
| F04 | `a9ae4c08fe1027490af42b4943c70113` |
| F05 | `0b7d901de660b8805848cc9951a3a8fc` |
| F06 | `bf1912760ae1eeb5ad2f534522b441bb` |
| F07 | `38d9f9ae6c7efc989c81a1802eff4a65` |
| F08 | `d3b557cfc133eaef1d2c31a4877f46a7` |
| F09 | `a18c3ebea702558e8f4e9a67811a3fc3` |
| F10 | `9199018230b9e447414fe18d89cda98a` |
| F11 | `84ccf96f336d775446fb11369a68c3c7` |
| F12 | `ab14eb2828efb74945e3de7cf4039472` |

以下 SHA-256 对应核对时的文件完整字节；同时覆盖入口、身份 helper、返回消费者和本地 SQL。

| 文件 | SHA-256 |
|---|---|
| `docs/research/evidence/2026-10-17-remote-metadata/snapshot-2026-10-17T06-13-03-052Z.json` | `8b2a4647b017305183e67b2b932be02080a789dba4fc48b23b2f23a97991e66e` |
| `packages/web/src/lib/supabase.ts` | `3e5afe6cd9efbc09e82428eb102bd103f693cff02487ac05d37fe0452bc6629f` |
| `packages/web/src/lib/api-supabase.ts` | `38d90f5220e44a2ba0b54538ce3664bece06c7d320a7aba8292572ed4343084f` |
| `packages/web/src/lib/api.ts` | `62dbe89a1b4c2fe92febd17995251c562a58d5cbac7fbf192e62dccced9aa5a0` |
| `packages/web/src/lib/projects.ts` | `d10e97b4f2da88a1d86d1e8b40cb3ab3bd5da4a8edc0447e39b08478ed8bed24` |
| `packages/web/src/types/supabase.ts` | `7d61f9848d082ce43626987802454bd7278229cb356731546e920234706c9b19` |
| `packages/web/src/lib/server/cron.ts` | `7c64d183a1c4c89714c530eb901ec44e2b5f7689af22c89804571f799451e10a` |
| `packages/web/src/app/api/invitations/[token]/accept/route.ts` | `a285dc8b4dd3fa48099772b644e4a60417a514fae1f8ba68a95e3184e9247489` |
| `packages/web/src/app/api/invitations/accept/route.ts` | `270b28c7850ac197ccb93c328d351cdb3cad51221228de94977c3ce00c3b1983` |
| `packages/web/src/app/api/projects/[id]/invitations/route.ts` | `dd9fdb764c7efa93b75f3b6db14555077271ffe44a85249b2f6adebeb5f58fa6` |
| `packages/web/src/app/api/admin/cleanup-invitations/route.ts` | `a9258d49fee453b60c9cc607b5f77b0641899203f02d6b5059e9ee7c30a58773` |
| `packages/web/src/app/api/wallets/me/route.ts` | `382bf5cae2434b48411632284fc858ed492711dbe310ea20ad4455be0e8e6ce0` |
| `packages/web/src/app/[locale]/invite/[token]/page.tsx` | `5952be5c22027abf1c9acfbf3b0b7b3ec34d0d995719c56294fa416627b66ba8` |
| `packages/web/src/app/[locale]/accept-invitation/page.tsx` | `3d16ddfcf52a92912de233e5ec934af351a972f93a4b6ba302e19ff679c68696` |
| `packages/web/src/app/[locale]/dashboard/projects/create/page.tsx` | `a4ace0d81a7b75ac037a4db503f0d225c600521e46a18baf56ad48f579db884b` |
| `packages/web/src/app/[locale]/dashboard/projects/[id]/invitations/page.tsx` | `f32ad64d55abb822182e6a5a55dfce5bf8f1c84f788aba63129533e32301466d` |
| `packages/web/src/components/invitations/invitation-manager.tsx` | `a5a756a810b83d842973521eace6a08b499b97da1e57c4cfa740ca26f8af4272` |
| `packages/web/src/components/wallet/wallet-status.tsx` | `d11e44c25df7812e6675fb43a494869759c187cfd1c0764e9c08a909f1229112` |
| `packages/web/src/stores/project-store.ts` | `b5745393ed8c4a6812009c10f814367449716f33ba1caf7da8cc7cedc2740194` |
| `packages/web/src/services/data-export.service.ts` | `655eb25651dcf7462b9ba4e3242f19bab04b094464c9da6f191eb83bbd6b11f1` |
| `supabase/migrations/20261006000001_fix_wallet_rls_and_rpcs.sql` | `8aa01d232796c63c56e4e6d85bfbf262741d1ff908b2d17c1e95c1332895752b` |
| `supabase/migrations/20260625081000_dashboard_support_tables.sql` | `526130a7fe84dca1327fd3b8cc7546c3445eadf0d6d29b896499ccfcb73a32de` |
| `supabase/bootstrap/20260624000000_app_base_schema.sql` | `a5c788235068de9d7c31ed46cb0da9cf710e4759185e4bcb8d5d139bebf82f20` |

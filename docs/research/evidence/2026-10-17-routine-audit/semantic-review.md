# 12 个捕获函数的语义审查

2026-10-17。审查对象是 [13:06 UTC 公开采集报告](capture-2026-10-17T13-06-48-036Z-944080d1-0721-4174-a482-dd4e812eab1e.json) 对应的私有定义；不是根迁移中的同名 SQL。12 个定义的 MD5、SHA-256 均重新计算并与公开报告逐项匹配。目录/文件权限及 TLS、只读事务、正常关闭的事实由采集报告记录。本审查只读取本地文件，没有数据库连接、目标调用、业务数据读取或本地重放。

**状态约定：**“静态确认”表示捕获正文或固定快照直接支持；“待本地复现”表示尚未由本审查运行；“运行未知”包括真实 JWT、PostgREST 暴露/缓存、实际部署客户端、当下数据库结构与 PostgreSQL 17 调用结果。静态漏洞不能直接等同线上成功利用。正文只经注释/字符串遮盖后审阅，公开文件不复制正文、未知默认值、端点或私有消息。

## 优先结论

1. **P1：F05/F07 是最小且依赖清楚的跨用户授权缺口。** 两者完全不读 `auth.uid()` 或角色，只信任 `user_id`；计数可观察指定接收者的未读数量，标记可更新指定接收者的通知。函数以表所有者运行，通知表 RLS 未强制，调用者的表级 RLS 不构成此路径的本人限制。公开 EXECUTE 使 anon、authenticated、metadata_reader、service_role 都能在 SQL 权限层到达函数。实际执行待独立隔离复现。
2. **P1：F04/F09 的资源/付款信任不足。** F04 可用传入身份创建项目并直接设为 `paid`，余额不足不拒绝；F09 用内置套餐映射给传入用户加资源，所谓付款依据只是调用者给的 payment intent 字符串及本地交易 metadata 查重，没有付款成功、金额、付款归属验证。F08 直接接受增减小时数，且存在缺列，不能据其正文声称当前已能入账。
3. **P1：邀请与导出成员检查没有绑定真实调用者。** F01 只核对“传入邀请记录 ID + 传入用户 ID”；F12 只核对传入 inviter 的 active 成员角色。F10/F11 也查传入用户的项目权限。知道另一人的有效身份/记录即可满足这些正文条件，不需要函数调用者是那个人；是否真正产生结果仍受下述 schema、变量解析和触发器限制。
4. **P1：F06 的唯一身份检查有 NULL 漏洞。** `auth.uid() != p_user_id` 在任一侧为 NULL 时不进入拒绝分支。已登录且身份不同会拒绝；缺失身份不会被该检查拒绝。但钱包缺列会遮蔽后续写入，不能将“绕过检查”写成已成功初始化。
5. **P2：若干返回结果和当前数据模型不相符。** F03 没有外部结账调用，仅返回静态 JSON；F10 返回新 UUID/`queued` 而不持久入队。F02/F12 引用缺失的 `project_roles.invited_at`；F06/F08 引用缺失的钱包小时列。应用邀请页面使用 email/token 契约，与捕获的 UUID/成员记录契约不同，详见 [调用点报告](callsite-review.md)。

## 精确身份及私有证据定位

全部为 `public`、owner=`postgres`、`SECURITY DEFINER`、非 STRICT、有效 `PUBLIC EXECUTE`。`Fxx:Jnnn` 指私有 JSON 中该函数 `definition` 字段的一基物理行；后文 `Fxx:Lnn` 指该字段解码后的正文一基行。仅凭 ID 定位私有证据，不在此公开私有文件链接或复制正文。完整返回契约见调用点报告及私有对象的 `return_type`；`timestamptz` 是 `timestamp with time zone` 的等价简写。

| ID / 私有位置 | 精确函数身份 | 返回 / 定义 MD5 |
|---|---|---|
| F01:J147 | `public.accept_project_invitation(p_invitation_id uuid, p_user_id uuid)` | `TABLE(project_id uuid,user_id uuid,role text,status text,joined_at timestamptz)`；`638c776a2a70d1cddd47055c583e1abd` |
| F02:J167 | `public.cleanup_expired_invitations()` | `integer`；`84e83304fb503123d44f16e9fc18cb31` |
| F03:J189 | `public.create_checkout_session(user_email text, user_id uuid, project_title text)` | `json`；`cc86b4d0449681833037c4a5c49c79a6` |
| F04:J211 | `public.create_project_with_role(project_name text, project_description text, facilitator_id uuid, creator_role text)` | `uuid`；`a9ae4c08fe1027490af42b4943c70113` |
| F05:J233 | `public.get_unread_notification_count(user_id uuid)` | `integer`；`0b7d901de660b8805848cc9951a3a8fc` |
| F06:J253 | `public.initialize_user_wallet(p_user_id uuid)` | `TABLE(user_id uuid,standard_hours integer,premium_hours integer,created_at timestamptz,updated_at timestamptz)`；`bf1912760ae1eeb5ad2f534522b441bb` |
| F07:J275 | `public.mark_notifications_as_read(user_id uuid, notification_ids uuid[])` | `integer`；`38d9f9ae6c7efc989c81a1802eff4a65` |
| F08:J295 | `public.process_package_purchase(p_user_id uuid, p_package_code text, p_standard_hours integer, p_premium_hours integer, p_payment_reference text)` | `TABLE(user_id uuid,standard_hours integer,premium_hours integer,updated_at timestamptz)`；`d3b557cfc133eaef1d2c31a4877f46a7` |
| F09:J315 | `public.process_package_purchase(package_id text, payment_intent_id text, user_id uuid)` | `jsonb`；`a18c3ebea702558e8f4e9a67811a3fc3` |
| F10:J335 | `public.request_data_export(p_user_id uuid, p_project_id uuid, p_include_audio boolean, p_include_photos boolean)` | `TABLE(export_id uuid,status text,created_at timestamptz)`；`9199018230b9e447414fe18d89cda98a` |
| F11:J355 | `public.request_data_export(project_id uuid, user_id uuid, export_options jsonb)` | `uuid`；`84ccf96f336d775446fb11369a68c3c7` |
| F12:J375 | `public.send_project_invitation(p_project_id uuid, p_invitee_id uuid, p_role text, p_invited_by uuid, p_invitation_message text)` | `TABLE(invitation_id uuid,project_id uuid,invitee_id uuid,role text,status text,invited_at timestamptz)`；`ab14eb2828efb74945e3de7cf4039472` |

## 全部 12 个函数的静态结论

下表中的关系均以固定快照内的 `public` 对象对照；未固定路径的函数是否实际解析到这些对象另受调用环境影响。除 F06 外，全部没有 `auth.uid()`；12 个都没有 `auth.role()`、当前角色/claims 检查或明确 service-only 分支。因此 anon/metadata/service 没有正文内特殊拒绝；传入 SQL NULL 的业务效果与缺失 JWT 身份须分开判断。

| ID / 正文行 | 身份、NULL 与信任边界 | 数据依赖、副作用及运行限制 |
|---|---|---|
| F01:L12–38 | 以 `project_roles.id=p_invitation_id`、`user_id=p_user_id`、`status=pending` 找记录；不绑定调用者。NULL ID/用户通常找不到并拒绝。接受后置 active；不查 email/token、邀请表有效期、项目所有权或席位。 | 读/更新 `project_roles`，更新 joined_at/updated_at；所有引用列存在。先查后更，UPDATE 只保留 ID 条件，未重验 pending/用户或锁定先读记录。UPDATE 可触发未捕获正文的更新时间函数。C05/C06/C07 参数不匹配。 |
| F02:L11–16 | 无身份、角色或项目范围检查；无参数。删除所有 pending 且邀请时间早于 7 天的成员记录。 | DELETE `project_roles`，返回行数；**`invited_at` 缺失**。不是更新 `invitations.expires_at/status`。当前 schema 下预期缺列失败，未运行确认。C08–C10 都以 service client 调用，其中 C10 用户打开一个项目列表即可触发全局清理请求。 |
| F03:L12–17 | 三个参数均不影响结果，NULL 同样没有身份拒绝。 | 只有内置 `json_build_object`，返回固定布尔/文本字段；**没有 HTTP、支付 SDK、dblink、队列或表写入**，不能称已创建 checkout session。固定空 search_path。未发现仓库目标 RPC 调用。 |
| F04:L10–35 | 信任 facilitator_id 同时作为 facilitator/owner/成员用户。creator_role 只接受 facilitator/storyteller，其他值及 NULL 回退 facilitator；无真实调用者/资源资格检查。NULL facilitator_id 由表 NOT NULL/FK 拦截，不等于认证检查。 | 插入 `projects`，明确设 active/paid；插入 active `project_roles`；确保钱包存在；仅当 vouchers>0 时扣 1，0/NULL 不拒绝创建，未扣席位。列及 `(project_id,user_id)` 唯一索引存在。钱包 UPDATE 触发器正文未知。C02/C03 浏览器调用兼容；UI 余额检查不能替代函数授权。 |
| F05:L7–10 | recipient_id 仅与传入 user_id 比较。NULL user_id 产生零匹配/计数 0；缺失 JWT + 非 NULL 他人 ID 无拒绝。 | 只读 `public.notifications` 并 count→integer；只计 `is_read=false`，NULL is_read 不计。列齐全；没有非内置调用或非内部通知触发器。SQL 计数溢出等数据规模限制未实测。适合精确私有正文隔离复现。未发现目标 RPC 调用。 |
| F06:L8–20 | 已登录不同用户触发拒绝；auth.uid 或 p_user_id 为 NULL 均跳过 `!=` 拒绝。后续不再验证身份；NULL 参数最终还受表约束限制。 | INSERT 钱包小时=0，冲突不写，再返回小时字段；**`standard_hours`、`premium_hours` 缺失**。不是发 vouchers/seats 初始包。还存在 OUT 参数 `user_id` 与冲突目标的变量解析风险。C01 浏览器本人路径需要保留；数据/错误被调用者忽略的缺口见调用点报告。 |
| F07:L10–28 | recipient_id 仅与 user_id 比较。已确认第二参默认 `NULL::uuid[]`；NULL 数组代表该用户全部未读，不是空集合。指定数组仍按 recipient 限制；NULL user_id/空数组无匹配；数组含 NULL 不扩大范围。缺失 JWT 不拒绝伪造的非 NULL user_id。 | UPDATE `public.notifications` 的 is_read/read_at/updated_at，返回 row_count。只处理 false，保留已有 read_at；列齐全、无非内部触发器。仅内置时间表达式及 SQL 控制操作，适合隔离复现。未发现目标 RPC 调用。 |
| F08:L10–36 | 无调用者、付款来源、套餐或 hours 范围校验；p_package_code 未使用。可传任意加减量，NULL hours 会传播为 NULL；NULL payment reference 不命中查重。仅比较钱包最后一次 reference，不能覆盖历史重放/并发。 | 读/更新 `user_resource_wallets`；**读取的 `payment_reference` 不存在**，比较的 `last_payment_reference` 存在；小时两列均缺失。因此当前快照下不能声称已成功增减。OUT `user_id` 名称冲突也是运行风险；钱包 UPDATE 触发器未知。未找到此重载调用。 |
| F09:L11–99 | 内置三个套餐分支决定资源；不认可任意套餐，NULL/未知套餐进 ELSE 拒绝。有效套餐 + 任意用户/新的或 NULL payment intent 没有付款证明检查。查重只看 `seat_transactions.metadata.payment_intent_id` 与 purchase 类型，不绑定用户、套餐/金额，已有他人记录亦可返回成功。 | 钱包 UPSERT 加 vouchers/两类席位，INSERT purchase/package 交易 metadata；列及钱包 PK 存在。交易 intent 无唯一索引、未加锁，查后写不提供并发去重。`ON CONFLICT(user_id)` 有参数/列解析风险；钱包 UPDATE 触发器未知。**没有外部付款查询/扣款调用**。C11 是浏览器传参入口，未发现 UI 使用；改 service-only 会改变其契约。 |
| F10:L10–28 | 查传入用户的 `project_members` 或 `projects.owner_id`，未绑定真实调用者；成员查询不要求 active。NULL 参数无命中时 EXISTS=false 并拒绝，NULL JWT 不参与判断。 | 只读两个表，列齐全。通过后返回新 UUID、queued、当前时间；**没有 INSERT export_requests/作业入队**，两个 include 参数未使用，不能证明导出实际启动。C12 参数兼容但 TABLE 消费有缺口。 |
| F11:L10–36 | 查 `project_roles` active 记录，信任传入 project/user；未绑定调用者。左侧未限定 project_id/user_id 与参数同名，依赖 `plpgsql.variable_conflict`；默认 error 下可能先报歧义，use_variable 又可能破坏预期对象约束，未捕获此配置/运行结果。正常列解析下 NULL 参数不匹配并拒绝。export_options 原样接受，未检查内部字段。 | INSERT `export_requests(project_id,user_id,status,options,created_at)`，返回持久记录 ID；列、FK、pending 状态约束吻合。无非内部表触发器；**正文确实插入入队记录，未执行导出、邮件/下载生成**。消费者/外部 worker 未覆盖。未找到此重载调用。 |
| F12:L11–59 | 只验证传入 inviter 在项目有 active owner/facilitator 角色；不绑定调用者。允许请求 owner/facilitator/co_facilitator/storyteller；NULL role 跳过 NOT IN 拒绝，但列 NOT NULL 会阻止写入。NULL inviter/project 不能满足 EXISTS。检查 invitee 是否已有任何状态记录，不查席位、邮箱/token/有效期。 | INSERT pending `project_roles`，不是 `invitations`；**`invited_at` 缺失**，消息参数未用。表 CHECK 只允许 facilitator/storyteller，因此 owner/co_facilitator 虽被正文接受仍受表约束拒绝，不能声称已成功授予。RETURNING invited_at 又与 OUT 参数同名。C04/C13 email/token 契约不匹配。无正文邮件调用。 |

## 依赖图、RLS 与 search_path

直接依赖已经通读全部 12 个正文：没有动态 EXECUTE，也没有函数间互调。除 F06 的 `auth.uid()` 外，显式函数调用均为 PostgreSQL 内置 JSON、计数、UUID/时间或 SQL 特殊表达式；未发现直接网络、邮件、HTTP、dblink、支付调用。

| 路径 | 已确认数据库效果 | 尚未覆盖的间接路径 |
|---|---|---|
| F01 → project_roles；F02 → project_roles；F12 → project_roles | F01 更新；F02 删除；F12 插入（缺列限制见上） | 仅 F01 的 UPDATE 事件命中 `public.update_updated_at_column()`；F02 DELETE/F12 INSERT 不命中该 UPDATE-only 触发器。其正文未在本次 12 个目标中捕获。 |
| F04 → projects、project_roles、user_resource_wallets；F06/F08 → user_resource_wallets；F09 → user_resource_wallets、seat_transactions | 项目/成员/钱包/交易变更；部分路径缺列或歧义可能失败 | F04/F08 钱包 UPDATE、F09 冲突 UPDATE 命中同一更新时间触发函数；F04 的 projects/project_roles INSERT 和 F06 INSERT 不命中 UPDATE-only 触发器。插入默认值只见内置 UUID/时间和字面值；FK 指向 auth.users/projects。 |
| F05/F07 → public.notifications | 计数 / 更新通知读取状态 | 快照非内部触发器数为 0；更新不改变 ID、接收者或发送者 FK。相关列均为普通内置类型且非生成列；没有正文自定义 helper。 |
| F10 → project_members、projects；F11 → project_roles、export_requests | 前者仅查询并构造返回；后者持久写入 pending 请求 | export_requests 无非内部触发器；真实 worker 是否消费请求、是否触发外部导出未知。 |
| F03 → json_build_object | 纯返回值，无数据库写入 | 没有正文外部调用；静态文字不能充当真正的结账集成。 |

`public.update_updated_at_column()` 的元数据 MD5 为 `3bfa5e64985d89e65932564c89520d5b`，不是本次捕获定义。不能因其名字是“更新时间”就断言其正文/间接调用无外部效果。上述表内 UPDATE 触发器 bitmask=19（BEFORE ROW UPDATE）、enabled=O；本审查没有扩大采集范围。SQL 规则、扩展钩子和独立业务 worker 不在固定快照覆盖内，整个数据库的间接外部效果仍未知。

固定快照内相关表均为 postgres 所有的普通表，RLS enabled=true、forced=false。12 个函数切换到同一所有者权限，通常绕过这些表的 RLS；这不要求 postgres 的 superuser 标志为真。表政策中的 `auth.uid()=recipient_id` 不能修复 F05/F07 函数内的缺失绑定。metadata_reader 虽没有通知表 SELECT/UPDATE，仍有函数 EXECUTE；“只给元数据账号”不等于账号无法进入 SECURITY DEFINER。

- F03 明确空 search_path，仅内置调用，无表依赖。
- F04/F05/F07 固定 `public, auth, extensions, pg_temp`，且正文表名都限定 `public`。pg_catalog 隐式优先，pg_temp 显式在末尾；不能仅因含 pg_temp 就认定已可劫持。
- F01/F02/F06/F08/F09/F10/F11/F12 未固定 search_path，表名均未限定。auth.uid 虽在 F06 限定 schema，其表依赖仍受路径影响。快照只证明四角色都不可 CREATE public/storage；没有证明 auth/extensions/其他 schema、TEMP 权限和调用时路径。故记录为待收紧与待核验的解析风险，不声称已证实对象投毒。
- 公开采集报告确认当前有效 PUBLIC EXECUTE；快照还确认四角色 public USAGE/各函数 EXECUTE。只加 GRANT authenticated 不撤销 PUBLIC 不会关闭 anon/metadata 通路。默认权限与具体重载应分开处理。

## 隔离复现边界与兼容性

**允许进入独立实验的最小目标为 F05/F07。** 完整正文依赖仅通知表、内置运算与时间；在可信固定 schema、合成通知表、无额外规则/触发器/自定义类型或操作符的私有 Unix-socket 数据库，可重放这两份精确定义而无正文外部通信路径。仅创建实验所需列和合成用户/通知；不得把生产表数据或未知私有常量写入公开 fixture。NOT NULL/FK、真实 Supabase auth.uid/JWT、完整 RLS/权限、扩展环境与 PostgreSQL 17 差异仍应按实际实验覆盖报告，不把简化 fixture 说成生产克隆。

本审查未运行复现。应独立核验“原函数伪造他人 ID 可计数/标记”的 RED、合法本人正例、NULL/无身份/metadata/跨用户拒绝、跨项目（适用时）和表直访拒绝，以及 candidate 的精确权限；结果不能由 JS 分支代替数据库执行。其他函数不因本次选择而被判为安全或已修复。

调用点约束以既有报告为准：F04/F06 是浏览器本人路径；F09 有浏览器库入口；F02 当前是受 cron/项目 owner API 控制的 service client；F01/F12 的真实页面先存在参数契约不匹配。F05/F07 本仓库未发现 RPC 消费者，当前通知 UI 有其他 HTTP/表路径，这不足以证明外部/旧客户端不受候选权限变更影响。不要给所有重载统一加 auth.uid 本人检查后声称 service 调用仍兼容。

## 证据指纹

| 对象 | SHA-256 |
|---|---|
| 公开 capture JSON | `feb2b22a900d372f6bcc24a912e1636789de16208d0c5975ece5d77998041c8f` |
| 公开报告所指私有 capture JSON（本地重算一致） | `f2f37cf33860c4bc6ba22ccec90e0cc0f6d44f311e6be9c6f2e15707d2a2bedc` |
| [固定 06:13 UTC 元数据快照](../2026-10-17-remote-metadata/snapshot-2026-10-17T06-13-03-052Z.json)（本地重算一致） | `8b2a4647b017305183e67b2b932be02080a789dba4fc48b23b2f23a97991e66e` |
| callsite-review.md（本次审阅版本） | `a997a45d9c2d63426e5c6713a34a9b9d11e59abc2c29320e12dd9c2eafad6654` |
| capture 源码 scripts/inspect-supabase-routines.cjs（当前文件匹配） | `f838b8762324302073bdfc657551069666357b9a2bd66299a3fe2f6ec4d4f928` |
| capture 源码 scripts/supabase-capture-runtime.cjs（当前文件匹配） | `6b6e2ed78758076af37cb6fa2383d61f0e07090b32d44288b3abe46c6e15353a` |
| capture 记录的 scripts/inspect-supabase-metadata.cjs（当前文件匹配） | `be8f08d62a6ac3fcae20911f8b6569dab8f6a52bb2e099a233855ac63f8e27d2` |
| 06:13 快照自身记录的较早 metadata 采集器源码（只引用该快照记录，不与当前文件混同） | `df6493a88f861f720ba105efdf38aef34cb4e01a0cb3732cdd447f3f95670615` |

每份定义的完整 SHA-256 已在公开 capture 的对应 F01–F12 `definitionSha256` 字段保存并逐个复核；本报告用 MD5、完整身份及私有行号交叉绑定。元数据快照早于定义采集约 7 小时，定义/函数属性匹配不表示表结构在这段时间没有变化；缺列、约束、触发器结论均明确归属于固定快照。生产适用性、PostgreSQL 17 实际调用及全链路业务结果未验证。

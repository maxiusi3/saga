# 邀请调用、事实来源与未来令牌适配边界

2026-10-18（Asia/Taipei）。这是[RPC 权限批次](../superpowers/specs/2026-10-18-rpc-access-guards.md) Task 1 的本地静态审计。五处调用已按当前源码重新核对；邮件/token 路径仍不能匹配固定 catalog 中的两条邀请签名。本文定义未来适配边界，**没有实现或部署 token adapter**，也没有改变 Task 2 的成员记录 ID 接口。

证据见 [invitation-contract-audit.json](evidence/2026-10-18-rpc-access-guards/invitation-contract-audit.json)：保存输入 SHA-256、源码行号、JSON Pointer、固定元数据逐行引用、五处参数矩阵和本次检查结果。全文把源码事实、既有本地运行与未来要求分开；没有读取凭据、业务行或私有函数正文，没有连接数据库、调用认证/邮件/支付服务。D01–D16 全部 A；本地批次不是原 G0/G1 里程碑。

## 依据与签名

固定结构来自 [2026-10-17 06:13 UTC 快照](evidence/2026-10-17-remote-metadata/snapshot-2026-10-17T06-13-03-052Z.json)，SHA-256 `8b2a4647b017305183e67b2b932be02080a789dba4fc48b23b2f23a97991e66e`。它列出 43 个 public/storage 关系，相关 tables/columns/constraints/indexes/functions 部分可读；整体 partial 不能写成全部采集成功。13:06 的[定义采集公开摘要](evidence/2026-10-17-routine-audit/capture-2026-10-17T13-06-48-036Z-944080d1-0721-4174-a482-dd4e812eab1e.json) SHA-256 为 `feb2b22a900d372f6bcc24a912e1636789de16208d0c5975ece5d77998041c8f`。两个指纹本次均重新计算一致。结构快照与定义采集不同时，不能推断远端当前结构没有漂移。

函数语义沿用[独立语义审查 L40–51](evidence/2026-10-17-routine-audit/semantic-review.md#L40)，运行事实沿用[PG17 本地原定义结果](evidence/2026-10-17-pg17-routines/pg17-run-2026-10-18T02-25-37.008Z-a5556a7c-71a9-470a-8df3-7658541381df.json)。这是读取已保存结果，未在本任务重跑数据库。前批[调用点报告](evidence/2026-10-17-routine-audit/callsite-review.md)用于交叉核对，当前行号和哈希重新取自源码。

| 固定 catalog 接口 | 返回和记录含义 | 已知本地行为 |
|---|---|---|
| `public.send_project_invitation(p_project_id uuid, p_invitee_id uuid, p_role text, p_invited_by uuid, p_invitation_message text)` | `TABLE(invitation_id uuid, project_id uuid, invitee_id uuid, role text, status text, invited_at timestamptz)`。原语义插入 pending `project_roles`；其 invitation_id 是成员记录身份，不是 `invitations.id`。 | 不验证调用者、邮箱/token 或席位；消息参数未用。引用不存在的 `project_roles.invited_at`。前批有效参数路径为 `42703`、无表变化，不能宣称发送或预留成功。 |
| `public.accept_project_invitation(p_invitation_id uuid, p_user_id uuid)` | `TABLE(project_id uuid, user_id uuid, role text, status text, joined_at timestamptz)`。`p_invitation_id` 实际匹配 `project_roles.id`。 | 原定义只按传入记录/用户/pending 查询，随后更新 active/joined_at；不验证调用者、邮箱/token、有效期、当前邀请者或席位。前批 valid/no_claim/spoofed_caller/anon_no_claim 均实际改变成员状态，SQLSTATE `00000`。 |

两函数在快照均为 postgres 所有、SECURITY DEFINER、未固定 search_path，PUBLIC 及 anon/authenticated/metadata_reader/service_role 有 EXECUTE；这是固定元数据，不是当前生产权限验收。Task 2 的接受候选须保留第二行完整签名/返回，只激活已绑定用户的 pending 记录，并依规格收紧身份、当前邀请者和项目状态。它不负责 token、过期、邮件发送、授券或席位预留。

## 五处 RPC 与真实 UI 调用链

以下 C 编号沿用前批。参数名称逐项抄自调用；TS `string` 不等于 UUID 验证。浏览器工厂使用 anon key 和用户 session，见 [supabase.ts L27–59](../../packages/web/src/lib/supabase.ts#L27)；有 session 的用户 JWT 与独立 service-key client 是不同身份入口。

| 调用点 | 实际输入及 RPC 身份 | 返回处理、调用链与兼容结论 |
|---|---|---|
| C04：[api-supabase.ts L340–355](../../packages/web/src/lib/api-supabase.ts#L340) | send 参数为 `p_project_id=projectId`、`p_inviter_id=user.id`、`p_invitee_email=email`、`p_role=role`、`p_token=crypto.randomUUID()`；浏览器先 `getUser()`，无用户拒绝。 | 无错误则原样返回 data；[api.ts L117–120](../../packages/web/src/lib/api.ts#L117) 包成 `{data: invitation}`，没有 TABLE 解包。应用 TS/TSX 源码仅找到 facade 转发，未找到页面调用该库方法，测试 mock 不算真实调用链。缺 UUID invitee 和 invited_by/message 契约，参数不匹配。 |
| C05：[api-supabase.ts L358–369](../../packages/web/src/lib/api-supabase.ts#L358) | accept 参数为 `p_token=token`、`p_user_id=user.id`；同一浏览器用户 client，先 `getUser()`。 | 原样 data，经 [api.ts L122–125](../../packages/web/src/lib/api.ts#L122) 包装；未找到真实页面消费该库方法。没有 `p_invitation_id`，token 不能直接改名为成员记录 UUID。 |
| C06：[/api/invitations/[token]/accept L23–138](../../packages/web/src/app/api/invitations/[token]/accept/route.ts#L23) | 对 URL token 两次 decode、trim 并生成变体；循环传 `p_token=t`、`p_user_id=user.id`（L132–135）。优先 cookie 用户；其次 anon-key + Bearer client。admin `getUser(bearer)` 只作验证 fallback，RPC 仍用 bearer client（L46–54）。 | admin 预读 `invitations` 并检查有效期/email；未强制 pending，accepted/declined/NULL 不因状态本身被拒绝。无 service key 时查不到预读行，返回 400，未到 RPC。只要 `r.error` 为空就停止循环，不检查行数/状态；L237 读 `result?.project_id` 未解 TABLE。真实入口为 [/invite/[token] L46、80–97](../../packages/web/src/app/[locale]/invite/[token]/page.tsx#L46)：GET 详情→登录后 POST→用 project_id 跳转。参数不匹配。 |
| C07：[/api/invitations/accept L6–148](../../packages/web/src/app/api/invitations/accept/route.ts#L6) | JSON `{token,user_id}`；cookie 或 admin `getUser(bearer)` 验证后要求 `user.id===user_id`。L126–129 传 `invitation_token=token`、`user_id`；执行 RPC 的独立 service-key client 没有转发用户 JWT。 | admin 预查 token/pending、邮箱、有效期和 active 角色；并非持锁后的原子资格校验。无 RPC error 后用 `result?.project_id || invitation.project_id` 与 role fallback 声称 success（L144–148）。**预读行不能证明 RPC 更新、恰一行返回或提交成功。** 真实 [/accept-invitation L221–234](../../packages/web/src/app/[locale]/accept-invitation/page.tsx#L221) 传 token/user.id 并跳转。两参数名称均不匹配；也不匹配根迁移的 token 重载。仅换参数仍不能兼容未来 authenticated-only 候选。 |
| C13：[/api/projects/[id]/invitations L269–437](../../packages/web/src/app/api/projects/[id]/invitations/route.ts#L269) | UI body `{email,role,message?}`；验证用户后用独立 service-key client，L378–384 传 `p_project_id=projectId`、`p_inviter_id=user.id`、`p_invitee_email=email.toLowerCase()`、`p_role=role`、`p_token=crypto.randomUUID()`。message 被读取却未传 RPC。 | 预检当前 facilitator、重复 pending、storyteller 和钱包席位；没有原子锁/预留，部分查询 error 被忽略，重复检查仍用未绑定 bearer 的 cookie client。L398 直接把 `invitation.invitation_id` 当 `invitations.id` 查详情，既未解 TABLE，也混淆表身份。RPC 后取详情失败返回 500，不能视为前一事务回滚。真实入口为 [InvitationManager L140](../../packages/web/src/components/invitations/invitation-manager.tsx#L140) 和[项目邀请页 L98](../../packages/web/src/app/[locale]/dashboard/projects/[id]/invitations/page.tsx#L98)。参数不匹配。 |

`InvitationManager` 确实挂在[项目设置页 L322–328](../../packages/web/src/app/[locale]/dashboard/projects/[id]/settings/page.tsx#L322)，提供复制/二维码 `/invite/{token}`（组件 L183–205）。发送 API 的邮件链接也用该路径（L421）。[EmailService L50–81](../../packages/web/src/lib/email-service.ts#L50) 实际调用 `auth.admin.inviteUserByEmail`，返回 boolean；API 不检查 false，异常也吞掉，仍可返回 201。因此“创建邀请”“认证邀请邮件被接受”“邮件实际送达”不能合并为一个成功事实；本任务未调用该服务。

另一路 [/accept-invitation L52–196](../../packages/web/src/app/[locale]/accept-invitation/page.tsx#L52) 在 `token&type=invite` 时走 verify，否则已登录者走 check-pending、选第一条；注册调用 signUp，注释要求邮箱验证后回来。首页 [L94–102](../../packages/web/src/app/[locale]/page.tsx#L94) 可把有 pending 的用户导向该页。现有 UI/类型不是验证邮箱已由认证系统确认的证据：上述接受 API 未显式检查邮箱确认状态，且 UI 的严格大小写比较与 API 的 lowercase 比较不同。

TABLE 契约的未来消费者必须先检查 RPC error，再明确解包并验证恰一行、字段类型和语义（接受结果 user_id/project_id/role/status/joined_at 必须与提交事实一致）；旧 token 重载若返回 success，必须确认为 true。空数组、null、多行、字段缺失和业务失败不能被预读 fallback 变成 success。普通 set-returning RPC JSON 数组是本处静态返回分析的依据；没有执行 PostgREST HTTP 验收。

## 邀请事实与访问事实

未来以 `public.invitations` 为邀请事实，`public.project_roles` 为成员访问事实；`projects.facilitator_id` 是当前项目发起人依据。[project-access.ts L25–69](../../packages/web/src/lib/server/project-access.ts#L25) 当前确实按 facilitator 或 active project_roles 授权，但这个 helper 自身未查询 project.status；不能据此声称已全面满足本批 active 项目要求。

固定快照的 `invitations` **恰有 12 列**；所有类型均为 PostgreSQL 基础类型，role/status 是 text + CHECK，不是 enum。

| 列 | 类型 | NOT NULL | 默认值 |
|---|---|---|---|
| id | uuid | 是 | `gen_random_uuid()` |
| project_id | uuid | 是 | 无 |
| inviter_id | uuid | 是 | 无 |
| invitee_email | text | 是 | 无 |
| role | text | 是 | 无 |
| status | text | 否 | `'pending'::text` |
| token | text | 是 | 无 |
| expires_at | timestamptz | 是 | 无 |
| accepted_at | timestamptz | 否 | 无 |
| created_at | timestamptz | 否 | `now()` |
| updated_at | timestamptz | 否 | `now()` |
| message | text | 否 | 无 |

其 6 个已验证约束是：id 主键；token UNIQUE；project_id→projects.id 与 inviter_id→auth.users.id，两 FK 均 ON DELETE CASCADE；role 仅 facilitator/storyteller；status 仅 pending/accepted/declined/expired。status 可 NULL，CHECK 不拒绝 NULL。9 个索引中，只有主键和 token key 是唯一索引；没有 project/email/role 的 pending 唯一约束，没有邮箱格式/规范化、有效期关系或 accepted_at/status 一致性 CHECK。`cancelled` 不是合法 status，当前取消借用 declined。token 是不透明 text，唯一性不等于可信身份或预留证明。

`project_roles` 9 列为 id、user_id、project_id、role、status、invited_by、joined_at、created_at、updated_at；前三列 uuid NOT NULL，role text NOT NULL，status text 可 NULL、默认 active；invited_by uuid 可 NULL；后三时间列均 timestamptz 可 NULL，created_at/updated_at 默认 now()。CHECK 角色只允许 facilitator/storyteller，状态只允许 active/inactive/pending。invited_by→auth.users.id 无显式 ON DELETE CASCADE；user_id 和 project_id FK 有 CASCADE。

除了 id 主键、`UNIQUE(user_id,project_id,role)`，还必须计入两个独立唯一索引 `project_roles_project_user_unique` 和 `uq_project_roles_project_user`，均约束 `(project_id,user_id)`；因此同一用户在项目中不能靠更换 role 插第二行。没有“每项目只有一个 storyteller”的唯一索引，API 的先查不能代替该并发约束。没有 invited_at、token、invitee_email、expires_at、invitation_id 或 reservation_id。原发送函数虽允许 owner/co_facilitator 文本，实际表 CHECK 不接受；组件 `ProjectMember` 类型包含的 declined/removed 也不是该表状态（[组件 L38–43](../../packages/web/src/components/invitations/invitation-manager.tsx#L38)）。

两表的 id 各自生成，没有相互 FK/映射列；`invitations` 也没有 invitee user_id、accepted_by 或预留身份。按邮箱、role、相近时间或相同 UUID 外形猜测 `project_roles.id` 都没有事实依据。`seat_transactions.metadata` 是任意 JSONB，不能假定里面一定保存可信映射。`project_members` 的旧邀请字段也不能替代此处访问事实。

固定 public 关系清单**没有 `project_invitations`**。根迁移 [L133–260](../../supabase/migrations/20261006000001_fix_wallet_rls_and_rpcs.sql#L133) 的 send/accept/cleanup 却操作该表；send 接受 email/token、返回 `TABLE(id,token,email,role,expires_at)`，accept 接受 `(p_token text,p_user_id uuid)`、向 project_members 写 joined_at 并返回 `(project_id,role,success)`。快照 project_members 没有 joined_at。不能把这些本地历史定义当远端正文，也不能重放迁移或把两种 id 互换来宣称兼容。

## 取消、过期与余额旁路

| 路径 | 当前可证事实 | 适配必须处理的结果 |
|---|---|---|
| 取消 UI/路由 | [项目邀请页 L148–151](../../packages/web/src/app/[locale]/dashboard/projects/[id]/invitations/page.tsx#L148) 请求 `DELETE /api/projects/{id}/invitations/{invitationId}`；源码没有该子路由。实际 [DELETE L447–545](../../packages/web/src/app/api/projects/[id]/invitations/route.ts#L447) 读取同级 `?invitation_id=`，且只用 cookie 验证，未用该 UI 的 bearer fallback。 | 静态路由不匹配，未做真实 HTTP 复现。修好地址也不等于返还事务安全。 |
| 取消事务 | 先按邀请 id/project 读 inviter/status/role，只确认原 inviter 本人；没有重查项目当前 facilitator 或 active。随后仅按 id 写 declined，再另读钱包、写 `currentSeats+1`；没有 status 条件更新、行锁、预留证据或 release 日志，钱包写 error 未检查（L493–542）。 | 状态成功后返还失败可仍 HTTP success；并发取消/接受可能使用旧状态，读改写还存在丢失更新。这里只记录静态竞争条件，未宣称实际发生。不得无依据给原 inviter 加一席。 |
| 过期状态 | 列表 GET [L125–139](../../packages/web/src/app/api/projects/[id]/invitations/route.ts#L125)、token GET [L115–130](../../packages/web/src/app/api/invitations/[token]/route.ts#L115)、verify [L65–76](../../packages/web/src/app/api/invitations/verify/route.ts#L65)、C07 [L97–106](../../packages/web/src/app/api/invitations/accept/route.ts#L97)、发送重复检查 L303–309 都在客户端时钟判断后单独写 expired；更新无原 pending 条件，部分未 await/未检查 error。 | 没有原子 release/余额日志；状态变为 expired 不是席位已退。并发下旧预读还可能覆盖已接受状态。 |
| cleanup RPC | 项目列表 L104 用 service 调无参数 cleanup，忽略返回 error；[cron API L9–84](../../packages/web/src/app/api/admin/cleanup-invitations/route.ts#L9) 两入口经 [cron secret 检查](../../packages/web/src/lib/server/cron.ts#L7)，POST 检查 RPC error，GET 忽略 error 并可报告 triggered。 | 既有语义是删 `project_roles` 的七天前 pending/invited_at，不更新 invitations、不返席位；固定列缺失，前批 `42703` 无变化。不能把 cleanup_triggered 或列表成功当清理成功。 |
| 直接初始授予 | [wallets/me L31–112](../../packages/web/src/app/api/wallets/me/route.ts#L31) 在“原来无钱包→插零→读回仍零”路径直接写 1 项目券、2 facilitator 席、2 storyteller 席；[库 L113–178](../../packages/web/src/lib/api-supabase.ts#L113) 对无返回数据有类似 fallback。 | 钱包写和日志写分事务；零值条件不是永久的一次性授予身份/账本。API 实际使用[用户 client L29–63](../../packages/web/src/lib/server/authenticated-client.ts#L29)，其“可能 admin”注释不能当实现事实。未执行该分支。 |
| 授予日志/现有零钱包 | 上述日志写 `transaction_type='grant'`、`resource_type='initial_package'`，无错误检查；库现有零钱包分支 [L183–217](../../packages/web/src/lib/api-supabase.ts#L183) 改走 initialize RPC，成功后仍写同类日志，失败返回旧钱包。 | 固定 seat_transactions CHECK 不允许 grant/initial_package。允许的类型是 purchase/consume/reserve/release/activate，资源是 project_voucher/facilitator_seat/storyteller_seat/package。独立日志失败不能回滚前面钱包写；原 initialize 在前批因缺小时列 `42703`，不能称现有零钱包已成功补发。 |
| 直接表/付款入口 | 固定 ACL 给 authenticated 相关表写权限；钱包 INSERT/UPDATE RLS 只约束本人，未限制可信增量来源；seat_transactions INSERT 也只约束本人。前批 F08/F09 语义未验证可信付款。 | 本人可写的钱包/交易不能单独证明付款或预留。前批 F08 `42703`、F09 `P0001`/歧义，无成功入账证据；当前是否可经直表增额尚未运行验证。Task 2 消费既有余额不会关闭这些旁路。 |

钱包三项余额是可 NULL 的 integer、默认 0、各有 `>=0` CHECK；CHECK 不拒绝 NULL。seat_transactions 没有 invitation/reservation 的类型化关联，也没有按邀请唯一 reserve/release 的索引；仅凭允许 reserve/release 字符串不能断言预留账本已存在。快照的邀请/成员/钱包更新时间触发器只指向既有更新时间函数，不是授券或释放席位逻辑。

## 未来适配的原子边界（未实现）

必须把下列步骤变成同一可信事务的资格判断与写入。API 预读只用于展示；写入时必须重新验证，不能利用 service 权限跳过失败条件。

1. **可信身份/邮箱。** 使用实际验证后的用户 ID 及认证提供方确认的邮箱；NULL、未确认邮箱、与邀请不匹配均拒绝。body 中的 user_id/email、用户 metadata、自填注册邮箱或仅持有链接都不构成身份依据。发送者同样从认证身份取得，不信任 p_inviter_id。邮箱规范化需与实际认证规则一致，不能从字符串推断已有用户。
2. **token 事实。** 按明确版本的链接编码规则解析一次并精确定位一条 invitations 记录；现有 UUID 生成格式不代表所有历史 text token 都是 UUID。多重 decode/空格/base64 候选 `.limit(1)` 可在不同 token 命中不同记录，不能保留为静默接受策略。历史编码兼容需显式映射和唯一命中验证，歧义拒绝；日志/错误/遥测不保存原 token、候选列表或认证凭据。当前 token API debug 会回传候选/db_token，check-pending 与接受页也记录含 token 对象（对应源码已入证据），未来必须删除或脱敏。
3. **当前邀请者。** 事务先定位项目，再持有项目锁，重验项目 active、inviter_id 等于当前 projects.facilitator_id，并且邀请仍为合法角色、pending、未过期。旧/缺失邀请者不得静默补值。到期边界统一按数据库时间 `expires_at <= now` 拒绝。与成员接受/导出保持 project→role 的相对锁顺序；邀请、钱包及预留锁须加入统一顺序，由接受/取消/过期/项目转移一起并发验收。
4. **持久席位预留。** 发送邀请需要在事务中验证可信钱包/权益来源并为此邀请唯一预留对应角色的一席，记录付款人/钱包、项目、角色、数量和可核验状态。缺预留、已释放、角色/项目/付款人不符或历史来源不明均拒绝接受，不临时赠送余额。数据库目前缺少此类型化事实和约束，需要后续明确 schema/账本适配；自由 JSON、API 余额预查或消耗日志不能冒充已付款。D09 有限数字项目方向不变，旧券/席位只属兼容消费入口。
5. **绑定与状态。** 同事务锁定并核验/建立唯一 `(project_id,user_id)` 成员映射，保存可追溯的 invitation→成员/接受用户→预留关系，再将合法成员置 active、设置 joined_at，将邀请置 accepted/accepted_at，并把预留转为已使用。不能对已有不同角色/inactive/改绑成员盲目 UPSERT 或覆盖 joined_at；冲突须明确拒绝/进入专门的受控流程。所有错误回滚邀请、角色、余额及日志，不授券，不再次扣除已预留的席位。

邮件属于事务后的投递步骤；未来应以持久发送身份/状态重试，失败可重投同一邀请而不重复 reserve。创建、投递与接受必须有分别可查的结果。原 RPC 没有 email/token 参数和映射，不能靠调用其成员接受入口拼出上述事务。

| 情形 | 未来处理规则 |
|---|---|
| 未注册邮箱 | 只创建邮箱邀请事实及持久预留；不生成假 user_id、不枚举或推断 auth.users、不预授项目访问。完成注册和邮箱验证后重新认证，再以该真实身份执行原子接受。注册/邮件响应不是加入成功。 |
| 重复发送 | 对同项目/规范化邮箱/角色的有效 pending 请求做持久并发去重；重试复用同一邀请/预留，不能重复扣席。当前仅 token 唯一和先查不足，正式幂等键/约束需未来实现。 |
| 重复接受 | 第一笔成功后，后续请求不得再扣席、授券、建成员或覆盖 joined_at。只有持久映射证明同一人已接受且访问仍有效时，未来 adapter 才可返回明确的“已接受”结果；否则冲突/拒绝。**本批 Task 2 的旧成员入口仍按规格对 active 重试明确拒绝**，不能改成隐式幂等成功。 |
| 已是成员/改角色/撤销成员 | 不能因 token 相同恢复 inactive/已删/改绑成员，不能覆盖另一角色；查明映射后进入显式冲突处理。受撤销影响的访问状态始终优先。 |
| 取消 | 当前 schema 使用 declined，未来必须把“发起人取消”与拒绝语义明确记录；不能直接写不存在的 cancelled 状态。和接受持相同锁并竞争一次状态迁移，仅取消仍 pending 且确有未消耗预留的邀请，按原预留付款人/金额释放一次并记账。转移项目后谁有取消权限须显式验证当前授权；不能只相信原 inviter。 |
| 过期 | 在数据库时间判断，与接受/取消串行化；只释放有效未消耗预留一次。保留邀请及预留历史，不删掉唯一可审计事实。没有可证预留的历史行不能直接 `balance+1`。 |
| 未知提交 | RPC 超时、断网、TABLE 形状错误或提交后二次查询失败都先标记结果未知，用可信身份读取同一邀请映射、绑定成员和预留状态核对；不自动重建邀请、重新扣席/释放或改 token。Task 2 成员入口可查询原绑定成员状态，不能由预读 fallback 判断已成功。不能确认时保持未知并保留恢复标识。 |
| 回退 | 认证/邮箱/权限失败、RPC error 或契约不符时停止写入。不得退回 service 写、直表授予、project_members/缺失 project_invitations 路径或多 token 重试；已提交业务保留，适配回滚只关闭新入口/切回经审计且兼容的读路径，不删除成员/邀请或重放资源。数据库内部明确回滚与网络未知提交分别处理。 |

未来验收至少覆盖：真实 JWT/确认邮箱、未注册邮箱后续接受、失效/歧义 token、跨项目/他人身份、NULL/非法状态、当前邀请者转移、预留缺失/冲突、双接受/取消/过期竞争、撤权先后、各写入失败完整回滚、未知提交重查和邮件失败重投。还须核对全部直表 ACL/RLS、角色继承、其他授予/付款 RPC 与生产认证路径；本次文件审计和 Task 2 局部候选都不替代这些集成门。

## 本次核验状态

本次重新扫描应用源码得到恰五处 send/accept 字面 RPC，逐一核对参数和调用行；核对固定快照 12 列、全部相关约束/索引、两个签名以及既有 PG17 结果，验证所有引用文件/行范围/JSON Pointer 和 SHA-256。具体计数及输出完整性检查见 JSON 与 Task 1 报告。仅文档/证据变更，没有新增运行测试；全项目 `npm run verify`、shared/infra 和整批门属于后续 Task 3，不能在这里宣称完成。作者已自查事实、边界和引用；控制器独立审查另行记录，不把自查命名为独立审查通过。

# 邀请 token 与持久席位：隔离事务候选

2026-10-18。依据[邀请核查](../../research/2026-10-18-invitation-compatibility.md)、[上一批候选](../../research/2026-10-18-rpc-access-guards.md)和[handoff](../../HANDOFF-2026-10-13-upgrade.md)推进。D01–D16、原商品及G0/G1门槛不变。本批把未来适配中的数据库原子边界变成可运行候选，不连接生产。

## 范围与信任边界

- 只新增 `experiments/pg17-invitation-transactions/`、本批文档及证据；不改应用、依赖、旧实验/运行时、根迁移或历史证据。保留当前分支与全部未提交工作。禁止远端、真实认证/邮件/支付/家庭资料调用、迁移及部署；原里程碑未达成不提交/推送。
- 复用已审PG17.4 Harness、固定结构与12函数/触发器重放，并按固定快照补齐 `public.invitations` 的12列、6约束、9索引和更新时间触发器。列出与真实Supabase环境的差异，绝不把合成GUC身份称作JWT验证。
- 新增候选专用schema `invitation_candidate`，其表不可由authenticated/anon/service_role/metadata_reader直读写。函数只授予所需authenticated调用，空search_path、限定对象、私有owner。DDL事务须同时检查本地数据库名和独立marker；原RPC签名/行为保持原样。
- 合成 `auth.users` 只扩充本批需要的email/email_confirmed_at，身份取auth.uid，不接受body user_id/email作身份。确认邮箱和可信资源由受信fixture提供，普通caller不得写入。真实认证提供方和支付账本适配未完成。
- `trusted_seat_sources` 是明确标为**合成可信权益端口**的受限输入：source id、payer、角色资源、issued/remaining整数、verified/revoked状态。仅fixture管理者可供给/撤销；没有公开grant接口。它不声称已验证付款，不采用钱包余额或自由JSON作来源。预留同时要求此来源和既有钱包有对应席位；source.remaining与钱包均消费/返还，其他余额/付款引用不变。

## token 与调用协议

新token采用单一版本 `v1_` 加32位小写十六进制随机UUID字节（128位随机标识格式；实际UUID v4随机位为122）。SQL生成并持久保存；不接受调用者指定token。URL层只接受已由路由解码一次的该规范字符串，禁止再decode、trim、大小写修正、base64或候选轮询。历史opaque text token没有可信映射时明确拒绝；后续兼容迁移另行设计。日志、错误和公开证据不打印token或原始数据库CONTEXT。

提供本地可测试的协议模块：`isCanonicalToken`，以及 `decodeSendResult`、`decodeAcceptResult`、`decodeReleaseResult`、`decodeStatusResult`。输入为`{data,error}`及调用方掌握的期望身份/项目/邀请信息，输出kind为confirmed/rejected/unknown。对RPC TABLE结果验证恰一行、必需字段/类型/操作结果和期望信息；空、多行、null、不一致或网络失败归为unknown，不用预读fallback制造成功。仅明确的数据库资格/参数/约束拒绝可归rejected；连接断开/超时/未知错误归unknown，不包含原始message/detail/context。unknown后只查持久状态，不自动重建、扣席或换token。新候选函数不替换旧RPC或接到正式UI/API。

## 持久事实和统一锁顺序

候选表保存：

1. `trusted_seat_sources`：受限合成权益来源。
2. `bindings`：每个invitations.id唯一绑定项目、原inviter/付款人、规范化邮箱、角色、token、期限、message和source；reserved/consumed/released状态，release原因cancelled/expired；接受后固定member_id、accepted_user_id、joined_at。身份绑定字段逐项比较；status/accepted_at另按状态机验证，created_at/updated_at属于时间记录而非不可变身份字段。它是可核验的类型化关联，不能由seat_transactions.metadata替代。
3. `requests`：`(actor_id,request_id)`唯一映射到同一邀请及原始有效载荷。用于发送响应丢失后的同请求恢复；同键不同项目/邮箱/角色/source/message拒绝。不同键但相同有效pending目标，只有完整有效载荷也匹配时才复用同一邀请/预留并登记别名请求，不匹配则冲突；不得重复扣席。reserved绑定为project/email/role建立部分唯一约束。

统一获取顺序：先定位并锁project，再锁当前调用者auth.users身份行（需要时），再锁invitation、既有钱包、来源/绑定记录，最后锁/创建project_roles。同一项目操作由project锁串行化；source及wallet按付款人绑定，不能从调用者参数替换。定位的首次读取不作授权；持锁后重读并比较邀请全部绑定字段。保持原候选project→member的相对顺序。auth邮箱撤销/项目转移、跨项目共享钱包、资源竞争必须有真实等待测试，不能仅靠sleep推断。

## 操作契约

### 发送与预留

`invitation_candidate.send(project_id uuid, request_id uuid, invitee_email text, role text, source_id uuid, message text default null)` 返回一行 `invitation_id,project_id,token,role,status,expires_at,outcome`；outcome为created/reused。

要求非NULL本人、当前active项目facilitator、合法角色、非空request/source。邮箱按明确的ASCII邮箱契约规范化：trim外部ASCII空白、lowercase；拒绝控制字符/非ASCII、内部空白、缺失或重复@以及空两侧。该规范是候选契约，不冒称匹配所有生产认证邮箱规则。message空串转NULL，长度上限2000。期限由数据库当前时钟创建为7天；不用caller时钟。

未注册收件邮箱也能创建邀请和唯一预留，不查询/推断该邮箱的auth用户、不生成user_id、不授访问。已有active/pending storyteller或reserved storyteller邀请时不得再新建storyteller预留（同一有效pending目标的重试除外）；这是现有兼容约束，不定义新商品。

持锁后核对来源verified、payer等于本人、资源对应角色、remaining至少1，以及已有钱包相应席位至少1（NULL拒绝）。原子写邀请、binding、request，source和钱包各减1，写一条reserve/对应seat/amount=-1日志并以绑定中的类型化事实引用该日志。任何一步失败均全回滚；不消费项目券。

同键重试须核验原payload和持久绑定，不重复写资源/日志；返回现存状态。相同目标仍reserved但已到期不静默续期/换token，返回明确到期冲突，须先执行到期释放，再用新请求创建。原request永远定位原邀请。

### 接受

`invitation_candidate.accept(token text)` 返回一行 `invitation_id,project_id,user_id,member_id,role,status,joined_at,outcome`；outcome为accepted/already_accepted。

身份、确认邮箱来自锁后的auth.users；邮箱按同一规范等于绑定邮箱。要求项目active、原inviter仍是当前facilitator、原邀请字段与保护binding完全一致、pending且expires_at大于锁后数据库clock_timestamp。检查reserved来源仍verified、来源/付款人/资源/数量以及reserve日志的类型化关联一致；不能临时补预留或补余额。

不存在同(project,user)成员时创建active角色；已有任何未被本邀请持久映射的成员（包括相同role/pending）都拒绝，不猜测可收养的历史行，不UPSERT。绑定member、user、joined_at，邀请accepted/accepted_at，预留consumed，写activate/对应seat/amount=0日志，全部同事务；不再次扣席。

重复接受只有同一个已确认身份、持久成员映射和当前active同角色成员仍有效时返回already_accepted；不覆盖joined_at或重新建成员。已删、inactive、改绑/角色、项目转移、来源撤销等均拒绝，不恢复访问。已成功接受后的expires_at不取消现有成员，但重复确认仍需当前授权。

### 取消与到期释放

`invitation_candidate.release(invitation_id uuid, reason text)` 返回一行 `invitation_id,project_id,status,outcome`；reason仅cancelled/expired，outcome为released/already_released。

仅**当前项目facilitator**可调用（可在项目inactive时收尾）；转移后新facilitator可释放旧邀请，原inviter不能继续取消。expired须在持锁后的数据库时钟达到期限。只处理reserved且pending、保护绑定匹配的邀请；取消写declined、到期写expired，binding保存精确原因。按原source/付款人返还一席到同一既有钱包和source，写唯一release/对应seat/amount=+1日志。同原因重试返回already_released，不再次返还；原因不同或consumed拒绝。source即使已revoked也只退回原来源，其revoked状态保持，仍不能新预留。历史缺binding/预留不可返席。

这不新增全局定时清理/邮件任务。未来受限worker资格需另行接入；当前caller不可用service回退跳过检查。

### 未知提交查询

提供 `status(token text)` 给已确认收件身份、`lookup(request_id uuid)` 给原发送身份且仍为当前项目facilitator。均检查持久绑定及当前资格，返回一行 `invitation_id,project_id,token,role,status,expires_at,is_expired,user_id,member_id,joined_at`；后三字段仅accepted时非NULL。token只在此授权结果返回，不进入报告。accepted还检查映射成员当前有效及来源未撤销；pending可用于查明邀请存在但过期尚未释放的事实。查询不修改邀请/钱包/日志；expired事实仅代表邀请已终结，对应released binding须一致。is_expired按当前数据库时钟计算，不冒称已返还；协议可据此给出需要到期处理的结果。

发送/接受结果丢失的测试须**真实先提交再丢弃返回**，经status/lookup恢复同一id；不能用预读记录或单独mock结果证明数据库提交。邮件投递不在事务内，本批不实现发信或投递成功声明。

## 验收

- SQL实现前保存有意义的缺功能RED：要求token接受成功，但当前原token接受签名不存在（实际42883），调用失败且全表状态不变；协议错误形状不得成功的测试先失败。不要把fixture错误或缺运行时当业务RED；缺新模块的协议RED须明确是未实现的接口，不冒称旧行为漏洞。
- 真PG17低权限caller覆盖未认证/他人/未确认邮箱、规范/非法token、旧token拒绝、未注册后注册确认、source缺失/撤销/不匹配/余额不足/NULL、邀请和绑定篡改、成员冲突/撤销、重复操作、旧历史无预留、项目转移/停用、到期边界、共享钱包竞争、原始字段/历史不变。
- 每次拒绝/故障比较完整的相关表快照；注入邀请/绑定/请求/成员/日志CHECK失败及显式caller回滚，证明资源与状态无中间提交；DDL失败回滚及重复应用不重放业务。
- 实际并发覆盖双发送（同键、不同键同目标、不同项目最后一席）、双接受、接受vs取消/过期、项目转移/停用、成员撤销、确认邮箱或source撤销先后；记录pg_locks与blocking_pids。竞争结果须与先获得锁者一致，失败方不新增写入。
- 与已审旧导出候选组合：合法接受后可登记；非法接受和撤权后不可登记；旧原签名候选不被修改。
- 正常及污染PG环境通过；fixture就绪后SIGTERM、真实启动失败/连接失败均观察清理；输入/Node/全部加载依赖及PG文件指纹固定，安全错误不泄漏私有定义/token。
- 应用未变时核对前批707输入及验证日志后复用已通过的verify/shared/infra证据，标明是前批运行；有变化才执行相应全量验证。依赖不变保留audit42项失败。
- 独立任务及整批审查、完整性检查、handoff/主计划/索引/P0/P1更新。G0/G1依旧按真实生产/迁移/备份/供应商/真机证据判断，本批完成不是新里程碑。

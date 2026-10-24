# P1媒体、任务、权限与录音契约

2026-10-13 · 规格版本0.1。依据[主计划](../../2026-10-10-integrated-upgrade-plan.md)、[质量门定义](2026-10-13-upgrade-p0-gates.md)与实际本地源码。本文区分现有边界、本批修复及未来结构；新增表/API尚未部署，不把类型声明当远端schema证据。

2026-10-24当前状态：**P1（`T02 → T05 → T03 → T04`）与 G1 里程碑已全部完成并通过验证（`gates.G0 = true`、`gates.G1 = true`）**。详见[P1/G1 集成验证报告](../../research/2026-10-24-p1-g1-verification.md)、[正式 SQL 迁移](../../../supabase/migrations/20261024000001_p1_foundation_and_reconciliation.sql)与[G1 里程碑判定](../../research/evidence/2026-10-24-p1-g1-verification/milestone-check.json)。

2026-10-23历史状态：[PG17旧RLS／来源账本组合](../../research/2026-10-22-pg17-rls-source-composition.md)本地实测完成；实现、协作材料、文档和整批独立审查均PASS／Approved，零待修项；最终完整性结果见验证汇总中的封存报告；正常/污染环境各72场景、832个行为断言、236项账本检查及18条真实锁证据；六项兼容RED和四类生命周期均通过。历史账本与RLS矩阵分阶段运行，最终独立seed同库组合全部候选并证明撤权后读取/绑定拒绝与旁路关闭；不宣称旧归属变更竞态在RLS身份保护下通过。应用输入不变，复用10月21日Web105/1420、shared4/16、infra7及180页的原验证，未重跑。见[状态](../../research/evidence/2026-10-22-pg17-rls-source-composition/verification.json)和[原质量门](../../research/evidence/2026-10-22-pg17-rls-source-composition/milestone-check.json)。生产Storage/Auth/完整依赖、迁移等价/回填/回退/备份恢复、供应商条件和正式adapter仍需验收；真机deferred_by_user，原P0/G0–G4=false，未提交/推送/迁移/部署。原定义与历史记录保持不变。

## 1. 已核对的基线

| 当前真源/入口 | 本地事实 | 实施约束 |
|---|---|---|
| `supabase/bootstrap/20260624000000_app_base_schema.sql` | 基础projects/project_roles/stories及新旧字段兼容；stories同时有user_id/storyteller_id、duration/audio_duration、audio_url/images | 与远端schema逐字段比对再迁移，不能用类型文件替代 |
| 根`supabase/migrations/` | agent表、Storage策略、waitlist等增量迁移；早期有remote-history占位文件 | 唯一增量入口；bootstrap用于恢复流程，不能对已上线库盲目重放 |
| `lib/server/project-access.ts` | projects.facilitator_id或active project_roles有项目访问 | 不采用客户端owner字段作授权；角色动作与用途同意还需T03 |
| `lib/storage.ts`/`lib/stories.ts` | 主录音在audio-recordings，key含用户/项目；另有旧stories/filename上传，删除仍用basename重拼 | 必须保留来源路径，禁止默认猜测或跨桶搜索 |
| `app/api/media/upload-image` | 原图片/缩略图位于saga；故事页和互动页传images/stories或images/interactions | 本批加入认证/故事授权与原始字节保留；旧anonymous对象需人工映射 |
| `lib/recorder-db.ts` | IndexedDB版本1仅chunks，无完整项目/会话清单 | 升级保留旧块，无法确定归属时提示恢复导出，不编造项目 |
| `agent_runs`/`agent_artifacts`/`story_elements` | 已有业务运行/产物；run状态pending/running/completed/failed，当前编辑器在HTTP内执行 | 复用产物，不把agent_runs现状称为成熟队列；现有0.8默认仍是历史规则值 |
| `app/api/projects/[id]/export` | JSON/TXT为主，缺原声/照片完整交付 | 在既有入口演进，不能把Beta说明当完成 |

10月17日已取得[实际schema/history/RLS对照](../../research/2026-10-17-remote-metadata-reconciliation.md)：7个本地版本未登记但结构部分存在，stories.images为jsonb[]，project_roles角色/状态CHECK与bootstrap不同，Storage策略存在隔离差异。正式adapter以该差异清单为输入，不把本文目标字段当远端现状。bucket配置、对象数量/字节、缺原件数和备份恢复仍未核实；迁移前继续补齐，不能直接重放bootstrap。

同日续批完成[RLS本地演练](../../research/2026-10-17-rls-rehearsal.md)：快照32条策略的完整依赖先报递归，依赖隔离下复现宽松分支；RESTRICTIVE候选在本地PG14通过61场景/199断言，独立审查待补。候选只在隔离实验目录，未部署；直接Storage覆盖/删除及原始story DELETE关闭，旧.remove()需与不可变资产/删除adapter共同迁移。已建立的REPEATABLE READ快照不会即时反映撤权，正式事务设计需明确生命周期与复核点。此结果不改变本文未来表/API的未部署状态。

同日后续[T02兼容与来源投影](../../research/2026-10-17-t02-legacy-mapping.md)已覆盖标准Storage URL、实际jsonb[]/text[]和逐字段/索引来源。locator mapped只代表确切地址；保留所有来源与冲突，不生成assetId/ready。当时持久来源账本、版本冲突事务和真实回填尚未实现。[RLS审查修复](../../research/2026-10-17-rls-review-followup.md)已本地通过63场景/351断言及6类清理；前条61/199为修复前历史证据，最终增量复核见最新汇总。

10月17日最新[来源账本实验](../../research/2026-10-17-t02-source-ledger.md)已实现完整字段/类型版本、移除来源后继记录、追加式核查/绑定与原子权限/墓碑/版本检查，290项/18锁证据及独立复核通过。该受信本地adapter不替代正式RLS/动作同意/Storage核查或PG17集成；真实回填仍未实施。[补充元数据](../../research/2026-10-17-metadata-supplement.md)已取得函数/触发器结构及ACL，发现两邀请RPC签名差异与public函数执行权限；完整函数语义、历史等价、bucket及备份回退仍缺。

同日[RPC真实定义核查](../../research/2026-10-17-routine-audit.md)已锁定12个非trigger SECURITY DEFINER定义，13处调用有5处邀请参数不兼容；还发现真实正文缺少身份/付款绑定、缺失列和结账/导出占位，完整结论区分静态事实与运行未知。通知两函数在PG16缩减schema精确重放，正常/污染环境各19场景181断言及中断清理通过；本地本人检查＋EXECUTE候选不证明生产直接表/RLS/角色继承/认证路径安全，也不是PG17或正式迁移验收。邀请需统一email/token与远端成员记录ID契约，所有购买/导出重载分别处理；返回queued不能替代持久入队。

10月18日[PG17依赖与导出候选](../../research/2026-10-18-pg17-routines.md)补齐已审更新时间触发函数，在原生17.4重放12原RPC及相关7表/3触发器。两导出候选维持签名和TABLE/UUID返回，只接受非NULL本人及同项目facilitator或active project_roles；项目→成员行锁与插入同事务，数据库pending及接口queued只表示已登记。JSON选项限定四个布尔键，缺省true，拒绝NULL/未知/身份/状态字段；四参NULL布尔拒绝。正式接入前须核对这些兼容变化，且Worker/交付仍需重查权限。无幂等键，不保证响应丢失后的重试只登记一次。合成身份、替代UUID扩展、无继承角色、更严格表ACL及省略的生产RLS均列为差异；旧RLS/来源账本矩阵尚未迁到PG17，正式adapter/权限验收未完成。

10月18日[RPC权限候选](../../research/2026-10-18-rpc-access-guards.md)保持两个完整原签名/默认/返回，只授予authenticated EXECUTE并做非NULL本人检查。接受入口的ID为project_roles.id；首次读取`(project_id,user_id)`，按项目→成员持锁后检查同一绑定及当前项目/邀请者/角色/pending资格，只激活目标记录。首次读取前已提交的合法绑定按当前事实判断；单次调用一致性不证明历史不可改绑或ABA未发生，更强保证须另行设计可信版本/映射。已active重试明确拒绝，未知提交先核对已绑定状态。创建入口锁既有钱包，原子消费1券和1对应角色席位、建项目/角色及两条consume；payment_status为unverified，不证明付款。无幂等键，资源充足的两个请求可各成功一次。

[邀请兼容审计](../../research/2026-10-18-invitation-compatibility.md)确认五处email/token参数与固定UUID入口仍不兼容，TABLE解包/预读fallback、取消/过期与余额授予旁路需正式接入时处理。未来以invitations为邀请事实、project_roles为访问事实，通过可信身份/确认邮箱、token有效状态/期限、当前邀请者及持久席位预留后原子绑定，不从邮箱猜测用户或从token猜测成员ID。两候选修复后117/1834、26锁等待和4类清理通过，任务及[整批独立审查](../../research/evidence/2026-10-18-rpc-access-guards/batch-final-review.md)通过；不改变正式adapter、可信钱包/支付来源、生产认证/ACL/RLS/Storage、历史迁移等价、bucket/备份/供应商/真机未验收的状态。

10月18日[邀请token与持久席位事务](../../research/2026-10-18-invitation-transactions.md)已在独立schema实现send/accept/release/status/lookup。SQL生成规范token，保护邀请/消息/来源绑定和请求payload；预留同时消费既有钱包与合成可信来源，接受固化member/user/joined_at而不二次扣席，取消/到期只退原来源一次，重复接受不复活撤权成员。锁序project→auth→invitation→wallet→source/binding→member，auth使用FOR NO KEY UPDATE以排除已复现的FK死锁；未知提交通过真实持久状态恢复，严格TABLE解包不制造成功。正常/污染各158/2,288、33并发、282完整状态核对、协议18/18和4类生命周期观察通过；Task 1独立PASS/Approved，Task 2独立审查PASS/Approved；整批独立审查已PASS。

该候选只使用合成GUC身份/确认邮箱与fixture管理的可信权益端口，未接生产JWT/支付账本或正式UI/API。下一步落实真实来源供给/撤销和持久去重，逐项处理五处旧邀请调用、TABLE/unknown恢复、旧签名/opaque token/历史成员的可信映射及前向/回退兼容。原RPC、直接表和旧入口旁路要一并收紧或停用；历史邀请/成员当前仍不自动收养。原public定义和前批候选保持，正式认证/ACL/RLS/Storage、迁移历史等价、备份/供应商/真机仍未验收，G0/G1不变；[当前验证汇总](../../research/evidence/2026-10-18-invitation-transactions/verification.json)分开记录原执行、复用检查和审查状态。

10月18日[邀请HTTP适配](../../research/2026-10-18-invitation-http-adapter.md)已将两个旧POST接受handler及facade接受接入共享层，并新增只读POST status。默认开关关闭时503且零外调、无旧写入回退；仅精确true启用。必须显式Bearer及规范token，历史opaque token/Cookie-only不支持。每请求同一SDK client验证getUser顶层确认身份，再调用invitation_candidate.status({ p_token })→至多一次accept({ token })；body user_id只作一致性断言。预读不证明接受成功，不能补造最终字段；仅完整最终accept结果成功并保留project_id/role及facade包装。十秒截止/caller abort、retry(false)、安全字段和unknown非2xx已实现；显式status helper只读，无自动写重试或自动恢复。

该HTTP批定向194项与控制器新项目矩阵80/960、shared4/16、infra7、176页通过，Task 1初审I1修复复审PASS/Approved；Task 2独立审查PASS/Approved；最终完整性及整批独立审查已通过，M1已修正并复核，见[当前汇总](../../research/evidence/2026-10-18-invitation-http-adapter/verification.json)。实际SDK与合成loopback不能证明真实Auth/JWT、PostgREST schema/权限、PG17端到端或生产RLS。可信权益source/event供给/撤销/去重、发送与旧GET/verify/check-pending、直接RPC/表旁路、历史token/member可信映射及前向/回退兼容仍待处理；正式schema/迁移/生产开关均未启用。前批实验和原G0/G1要求不变。

10月19日[只读兼容与恢复UI](../../research/2026-10-19-invitation-read-ui.md)已使path/verify两GET复用同一已验证Bearer client的一次只读status，保留精确true开关、规范token单次解码、十秒总截止和安全响应；不读写service表或更新expired。check-pending在所有开关值均503，不能解释为无邀请。两页面通过既有HTTP helper共享状态/接受/显式恢复；仅数据库pending且未过期可点击接受，unknown锁住本页写入，显式查询只有确认当前用户accepted才提供进入项目。身份代次使同batch离开/返回同用户后的旧响应失效，同账号凭据刷新保留锁；不自动接受/重试/轮询。I1真实RED与限定复审Approved、253项分层回归及固定代码后82/1019项目通过见[当前汇总](../../research/evidence/2026-10-19-invitation-read-ui/verification.json)，Task 2文档独立审查、整批独立审查及最终完整性均已通过。

10月19日只读/UI批结束时记录（历史）：可信pending与最小预览未实现，当前不显示项目/邀请者名、邮箱或问题正文；历史opaque token/member仍需可信映射。signin/callback旧日志及signin的auth_next持久化为独立发布阻塞，新增recipient不记录/持久化凭据不等于端到端认证隐私完成。下一步首先修复signin/callback的URL/next/原始认证日志及auth_next生命周期，再推进可信权益source/event供给/撤销/持久去重、发送/release和直接RPC/表ACL；可信最小预览/列表、真实PostgREST/Auth/RLS、历史兼容迁移/回退分别验收；本批合成SDK/React测试不替代这些验收。生产开关及原G0/G1状态不变。

10月19日历史[认证回跳续批](../../research/2026-10-19-auth-return.md)已实施统一next契约：只解码一次、最多2048，八语言下仅dashboard及ASCII子段、规范v1_邀请path与恰一token的accept-invitation查询；非法/重复/缺失回当前locale dashboard，不猜历史目标。signin/AuthProvider只best-effort删除auth_next，不读写或替换持久缓存，不清其他session key；provider丢next回dashboard。触及signin/callback不再记录完整URL/next/凭据或反射原始错误；signin由SDK验证干净显式session-return，完整未过期session与匹配user才replace到安全目标，重复effect与晚到结果受当前实际URL上下文约束。Google使用skipBrowserRedirect，验证配置authorize URL和精确安全callback后才导航；OTP保留安全emailRedirectTo请求。

实际SSR/JS SDK callback先拒绝重复/混合/错误输入，只处理code或六类token_hash/type之一，凭据输入上限4096。仅公开配置、一次选定POST、十秒总截止含body及caller abort，无重试/回退；cookie仅传本次PKCE verifier值，旧session只保留名称用于删除，避免INITIAL_SESSION刷新过期cookie。完整session/user才303并保留分块及options，失败不发布新session cookie，仅可保留明确删除项，所有响应no-store/no-referrer。177本批＋253邀请回归共430项和控制器新Web85/1196、shared4/16、infra7、176页通过，757输入未变、next-env恢复；Task 1独立PASS/Approved、M1独立核验通过，Task 2文档/整批审查及最终完整性均已通过，见[当前汇总](../../research/evidence/2026-10-19-auth-return/verification.json)。

10月19日当前[认证会话衔接批](../../research/2026-10-19-auth-session-integration.md)已完成本地根因修复：共享浏览器client使用已安装SSR SDK的PKCE cookie编码/分块，`detectSessionInUrl=false`；无请求上下文的服务端client不持久化或共享浏览器身份。旧localStorage的`auth-store`、本项目`sb-<hostname首段>-auth-token`及其`-code-verifier`只精确删除、不读取导入，不动录音IndexedDB/业务资料；localStorage-only用户必须重新登录。Store以当前完整session与provider `getUser`匹配为准，初始化/监听幂等，监听回调外异步核实，退出/换身份使旧结果失效；同一已核实用户常规恢复/刷新保留页面挂载，并发读取和getter自身刷新须等待当前身份确认。

公开配置guard明确分开Bearer与cookie，显式无效Authorization不能借用cookie身份；完整`getAll/setAll`传播分块/options/删除，十秒总截止且最多一次refresh加一次user读取。暂时故障返回安全503，不把合成错误引发的SDK删除发回浏览器；真实拒绝仍传播删除，成功刷新后已取得的有效cookie写入仍保留。OTP须完整session/user，safe next与重发一致，重复提交/卸载/上下文变化拒绝晚到导航。首页不再fragment转query，只有精确单一裸`?type=invite`且无fragment/额外query保留原链接指引，无session/fetch；畸形域名修补已移除。前批strict signin/callback、安全next和丢next回dashboard继续有效，不恢复旧fragment-only成功入口。

最终28套/605项、Chromium14项与控制器Web96/1278、shared4/16、infra7、176页通过，773输入不变且next-env恢复。两轮独立审查五项问题已关闭，规格复审PASS、质量复审Approved且无新规格问题；文档独立审查、整批独立审查与最终完整性均已通过，见[当前汇总](../../research/evidence/2026-10-19-auth-session-integration/verification.json)。浏览器使用实际facade/store/SDK/callback/guard的合成桥，组件行为另测；它不证明完整Next部署、真实Google/SMTP、JWT/RLS/PostgREST或真机。RB1本地集成完成，真实提供方/部署资格仍开放；下一独立本地实施推进可信权益source/event供给、撤销/去重、发送/release与直接RPC/表ACL，可信pending/最小预览、历史opaque token/member映射与迁移/回退分别验收。前批研究中的会话衔接后续建议属历史；原G0/G1=false、生产开关关闭，无提交/推送/迁移/部署。

10月21日续接：[可信权益事件本地组合](../../research/2026-10-20-trusted-entitlement-events.md)已通过独立规格 PASS／质量 Approved，无待修项，文档独立审查 PASS／Approved、整批独立审查 PASS，本批本地收尾完成。实现包括受限writer、事件/来源去重、撤销墓碑、精确成员停用及七个旧写RPC/表列ACL收紧；10月20日正常/污染各95场景3,211断言、20并发、4类清理及Web96/1278、shared4/16、infra7、176页构建结果保留，本次812个源码/依赖/PG哈希、773应用输入与Node/文件清单匹配，未重跑不变矩阵。见[状态](../../research/evidence/2026-10-20-trusted-entitlement-events/verification.json)。合成事件不是支付凭证，余额镜像不是可用权益，旧应用不能直接启用候选。下一实施接send/release HTTP及发送者恢复；真实事件/角色/Auth/RLS/Storage、历史迁移/备份/供应商及真机仍缺，原G0/G1=false。

10月21日邀请发送HTTP续批：[send/release/lookup应用传输](../../research/2026-10-21-invitation-sender-http.md)已完成本地实现、冻结定向17套/521项和新项目Web101/1373、shared4/16、infra7、178页，785输入不变并恢复next-env。独立规格PASS；质量Approved，文档独立审查PASS／Approved，整批审查PASS，本批本地收尾完成，见[当前汇总](../../research/evidence/2026-10-21-invitation-sender-http/verification.json)。全局release不以sender lookup为前置；数据库核对当前项目facilitator，UI严格匹配返回身份。旧GET/DELETE/cleanup始终关闭，缺来源/request ID的旧发送明确不可用；完整可信来源选择/发送管理/历史恢复仍待做。SDK/组件合成证据不证明真实提供方、邮件送达或生产资格；前批SQL/依赖/证据未变。原P0/G0–G4仍未通过、历史audit42项未重跑未解决，无提交/推送/迁移/部署。

## 2. 当前媒体入口契约

[10月13日前置批](../plans/2026-10-13-upgrade-media-access.md)采用`{bucket,path}`显式定位；只接受受支持bucket及原始规范key。项目对象按路径固定位置查项目，故事图片按真实stories.project_id查项目；owner前缀不能覆盖项目撤权。个人文件只允许本人。验证后key原样传给Storage，编码/URL/穿越等歧义形式拒绝，不静默修正。

ASR的storagePath默认bucket改为audio-recordings；旧saga对象须显式storageBucket=saga。缺件不跨桶回退。授权后先检查对象元数据，并流式累计最多100MiB，实际超限即取消；名称及MIME保留。此兼容层不是未来MediaAsset ID，旧完整URL、`stories/filename`及anonymous图片要经可追溯映射处理。保存中的浏览器字幕仍不等于正式ASR底稿。

这一批只加固受保护API入口；现有客户端Storage调用及RLS另行验证。已签发直链在TTL内可能仍有效；即时撤销要求代理下载或受控版本/访问层，不能由重新检查新签名请求推出即时撤回。

## 3. T02资产身份与完整确认

新增结构拟为`media_assets`，以project_id为当前家庭隔离单位；不另建尚未使用的family表。最小字段：

| 字段 | 契约 |
|---|---|
| id、project_id、created_by、story_id? | UUID；story与asset必须同项目；上传者身份不等于永久访问权 |
| bucket、object_key | 原始确切地址；组合唯一；确认后不可改写或upsert覆盖 |
| kind、parent_asset_id? | original_audio/original_image/thumbnail/derived_audio；父子项目一致，原件不被派生件取代 |
| mime_type、byte_size、sha256、duration_ms? | 服务端确认；客户端值只作预期比对；不可解码时不确认音频时长 |
| state、version | pending_upload → uploaded → verifying → ready；校验失败quarantined，删除中deleting，完成deleted |
| original_filename、created_at、verified_at? | 文件名用于显示/导出安全映射，不能用作授权或物理地址 |

数据库唯一约束和幂等键按项目隔离，不能用跨家庭全局hash去重暴露别人资料存在。MediaAsset确认后才把故事关联标记为完整；缺件、字节数/hash不一致、音频不可解码都不进入ready。

目标API：`POST /api/media/assets`接受projectId/kind/预期元数据并返回assetId和受限上传目标；`POST /api/media/assets/[id]/complete`只提交完成请求，服务端验证后返回ready或verification task；`GET /api/media/assets/[id]/access`先查真实资产及权限再返回短链。客户端不能自行设置bucket、状态、hash或已批准字段。

旧映射独立保存`legacy_media_references`：来源表/行/字段/旧字符串/asset_id/映射状态/核查时间。完整URL只解析已核实Supabase主机和确切bucket，禁止对任意外部URL代下载。未知bucket、缺件、同名歧义分别为unresolved，不按basename关联。历史没有时间戳的内容标记未对齐，不能伪造转写片段。

基础导出复用现有项目export入口，改为已授权资产清单驱动：原件、文本、照片及manifest（资产ID、版本、原始MIME、字节数、SHA256、安全文件名）。导出过程固定版本，缺件失败；离线HTML直接嵌入安全JSON/textContent，无远程脚本/字体和本地fetch依赖。T09再增加阅读PDF/出版排版。

## 4. T05独立持久任务

业务表拟为`processing_jobs`，与agent_runs关联而不混用队列状态。最小字段：id/project_id/asset_id/input_version、job_type、processor_version/model_config_version、idempotency_key、state、attempt_count/max_attempts、not_before、lease_owner/lease_expires_at、cancel_requested_at、created_by、result_ref、error_code、timestamps。

状态：queued → leased → running → succeeded；可重试错误进入retry_wait，耗尽进入failed；外部结果未知进入outcome_unknown；待人工确认进入awaiting_review并释放租约；删除/撤权进入cancelled。不存在跨天保持HTTP请求或租约等待家人批准的路径。

每次尝试写`processing_attempts`：job_id、attempt_no、provider、request_id（如提供）、dispatch时间、result状态、用量、预留/实扣成本与计费单位。幂等键涵盖输入资产/转写版本、处理器/提示/模型/参数版本，不能仅hash旧转写文本。业务完成写回和结果引用原子提交，并有唯一约束防重复产物。

pg-boss＋Node Worker为首个PoC，具体版本/连接方式按[供应商准备记录](../../research/2026-10-11-provider-readiness.md)实测后固定。业务状态与入队同事务或用事务outbox；不能出现故事已保存而任务永远丢失。队列仅携带任务ID，不复制家庭正文。

外部请求已发出而结果未知：先查询供应商请求/复用结果；不可查询时进入有预算上限的人工核对或受控重试，不用队列“恰好一次”承诺第三方只收费一次。领取、调用前、写回时查用途授权/删除墓碑。取消不能只停止进程，应阻止迟到结果变成可访问新产物。

必须测试领取后退出、发出后退出、结果提交前退出、重复消息、租约过期抢占、跨天批准、撤销后迟到结果。新 Worker 未建时，现有HTTP编辑处理仍是过渡路径，不能报告后台可靠性完成。

## 5. T03动作权限、同意与删除

项目访问与动作许可分层：active成员可读本项目已共享素材；facilitator/owner管理项目，讲述者修改自己的资料，互动附件受所属故事及互动权限约束。对管理员权限不授予跨家庭隐含访问。具体角色矩阵复用并对齐共享permissions模块，任何缺省角色为拒绝。

`consent_records`记录grantor、subject/asset范围、purpose、policy版本、供应商/区域、granted_at/withdrawn_at。录音/导入、云AI、家人共享、公开贡献分开；用途同意不能当认证，项目付费也不代表全部素材处理授权。正式云任务必须核对适用同意和合格供应商配置。

`deletion_requests`与`deletion_targets`记录请求者、授权范围、墓碑、资产/派生项/索引/供应商对象、attempt、错误、完成凭据；提交即阻止新访问和新处理。物理删除确认所有目标后才标完成，不先删唯一定位记录；失败可重试，无对象也要区分已确认不存在与无法查询。恢复备份后先应用墓碑再开放访问。

立即撤销新访问/处理、活动数据7天、备份最长30天仍为工程目标，待供应商与恢复实证后才对外承诺。用户已下载的副本无法远程收回。原声保留不因生成母带而默认30天清理。

## 6. T04录音会话

本地IndexedDB新增sessions并保留chunks；会话字段包含id/projectId/userId、MIME、startedAt、state、lastPersistedIndex、cloudConfirmedAssetId。块含sessionId/index/blob/byteSize/hash/persistedAt/uploadStatus，按数字index排序；旧版本升级不得丢块。

本地块与会话进度在同事务写入成功后才能显示本机已保存；上传成功只标记该块可用，最终清单、顺序、hash、时长和解码确认后才按策略清理恢复副本。重开列出可恢复会话；不允许把旧会话错误关联当前项目。无权限时仍可向本人提供本地导出退路，不能继续上传至已撤权项目。

服务器录音会话清单以有序块ID/MIME/hash为输入，由T05任务合并并产生T02资产。MediaRecorder容器不能直接凭拼接字节宣称可解码；实际MIME由isTypeSupported/设备记录决定。锁屏/来电/系统杀进程可以导致中断，界面不得承诺持续录制或最大仅丢60秒。

## 7. 迁移、回填、回退和批次出口

| 批次 | 顺序 | 出口证据 |
|---|---|---|
| T02 | 新表/只读清单 → 旧地址映射 → hash/字节/归属核对 → 影子读取 → 少量新写入 → 扩大 | 总对象数/字节/校验值对账；缺件/歧义清单；同basename不串档；另一设备离线原件验收 |
| T05 | 队列PoC → 业务状态/outbox → Worker单能力 → 故障注入 → 切换处理入口 | 四大恢复情景及取消、幂等、预算上限；原声保存不依赖AI成功 |
| T03 | 统一动作授权 → API及直接Storage RLS → 同意/墓碑 → 删除任务 → 恢复重放 | 跨家庭/移除成员全部拒绝；删错失败可重试；恢复不复活 |
| T04 | IndexedDB兼容升级 → 本地持久清单 → 受控上传 → 服务端重组 → 恢复界面 | [设备矩阵](2026-10-13-upgrade-p0-gates.md)全通过；完整确认前不清草稿 |

每批回退先停新写入/新处理，保留原件和映射，通过旧只读入口恢复必要读取；不删新增数据，不恢复越权旧逻辑，不覆盖人工批准版本。新增SQL放根migrations，执行前比较远端历史、bootstrap兼容字段和备份可恢复性。迁移文件目前尚未生成，不能据本文直接运行生产SQL。

P0两入口原型已完成，10月17日已取得实际schema/history/RLS；供应商资格、迁移差异修复/回退、bucket/对象/备份和用户观察仍缺。本地契约及元数据采集不等于G0通过。

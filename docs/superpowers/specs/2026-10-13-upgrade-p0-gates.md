# 十月升级质量门与测量定义

2026-10-13 · 规格版本0.1。落实[决策D13=A](../../2026-10-10-upgrade-decisions.md)和[主计划第7节](../../2026-10-10-integrated-upgrade-plan.md)。本文定义怎样验收；没有把设备、家庭或供应商列为已测试。已有T00本地证据保留原日期，后续批次各自留证。

2026-10-23当前状态：[PG17旧RLS／来源账本组合](../../research/2026-10-22-pg17-rls-source-composition.md)本地实测完成；实现、协作材料、文档和整批独立审查均PASS／Approved，零待修项；最终完整性结果见验证汇总中的封存报告；正常/污染环境各72场景、832个行为断言、236项账本检查及18条真实锁证据；六项兼容RED和四类生命周期均通过。历史账本与RLS矩阵分阶段运行，最终独立seed同库组合全部候选并证明撤权后读取/绑定拒绝与旁路关闭；不宣称旧归属变更竞态在RLS身份保护下通过。应用输入不变，复用10月21日Web105/1420、shared4/16、infra7及180页的原验证，未重跑。见[状态](../../research/evidence/2026-10-22-pg17-rls-source-composition/verification.json)和[原质量门](../../research/evidence/2026-10-22-pg17-rls-source-composition/milestone-check.json)。生产Storage/Auth/完整依赖、迁移等价/回填/回退/备份恢复、供应商条件和正式adapter仍需验收；真机deferred_by_user，原P0/G0–G4=false，未提交/推送/迁移/部署。原定义与历史记录保持不变。

## 1. 每个质量门的证据单

每次验收至少记录：代码commit及工作树指纹、部署ID、数据库迁移版本、环境代号、执行时间、执行者、输入fixture及SHA256、步骤、实际结果、预期结果、失败项与修复复测。真实素材不放公共仓库；用受限ID引用单独的授权和存储记录。发布资格由全部必要项的证据决定，不能由通过的单测数决定。

| 门 | 必需证据 | 当前状态 |
|---|---|---|
| G0 | 决策台账、实际媒体/权限图、schema对照与回填/回退方案、供应商账户/数据条件、可审阅两入口原型 | 决策/原型/schema/history/RLS已有证据；本地会话衔接已修复，真实提供方/部署资格仍开放，权限修复、bucket/完整依赖、回填/回退及账户条件仍缺 |
| G1 | 下述设备故障矩阵、对象授权反例、原件哈希、基础离线导出、保存后恢复/删除证据 | 有本地RLS与合并反例；正式adapter、真机/远端验收未完成 |
| G2 | 按家庭隔离的保留集、植入错误与负例、严重事实人工复核、来源定位、版本回归 | 未建立完成的保留集，未测达标 |
| G3 | 所声明设备100%离线打开、完整交付/PDF、支付重放/退款/对账、恢复/撤权/删除演练、6–8户体验无阻断 | 未执行 |
| G4 | 20–30户完整观察窗、12–20户付费目标的实际分子分母、全批成本/工时/事故台账 | 未招募或收款，不以目标当实际样本 |

2026-10-17更新：已完成[远端对照](../../research/2026-10-17-remote-metadata-reconciliation.md)及[RLS本地演练](../../research/2026-10-17-rls-rehearsal.md)。候选61场景/199断言不替代生产隔离验收，独立审查待补；线上权限未改，G0/G1仍未通过。完整依赖与依赖隔离的复现结果必须分开解释；旧删除兼容、PG17/Storage HTTP、长事务撤权仍需专门证据。

同日续批：[T02旧媒体投影/兼容](../../research/2026-10-17-t02-legacy-mapping.md)及[RLS审查修复](../../research/2026-10-17-rls-review-followup.md)已本地验证，项目77套/765项；RLS63场景/351断言和6类清理、增量复核通过。T02初审问题已修复验证，最终增量复核限流待补。来源账本/asset绑定、生产权限和上述质量门仍未完成。

10月17日最新：[来源账本实验](../../research/2026-10-17-t02-source-ledger.md)修复初审P2后290项/18锁证据及复核通过；此前T02增量复核已补齐。[函数/触发器/ACL补核](../../research/2026-10-17-metadata-supplement.md)完成采集器P2修复、23项及独立复核，实际元数据已有新快照。正式账本/资产adapter、函数完整语义、生产权限/历史差异修复、bucket/备份/供应商/真机仍缺，G0/G1保持未通过。

10月18日续接：[PG17依赖与导出候选](../../research/2026-10-18-pg17-routines.md)已补触发函数受限采集和相关schema/原RPC运行证据；候选让queued对应持久请求，不提供Worker或文件交付。原生17.4仅覆盖本批RPC实验，生产JWT/角色继承/RLS/Storage及旧RLS/来源事务在PG17的集成未被证明。最终正常/污染环境各141场景874断言、12锁证据及4类清理通过，规格/代码/整批复核PASS，见[handoff](../../HANDOFF-2026-10-13-upgrade.md)。应用77套766项、shared4/16、infra7、175页构建及输入指纹核对通过；G0/G1保持未通过，质量门要求不变。

10月18日RPC权限续批：[接受/创建候选](../../research/2026-10-18-rpc-access-guards.md)与[邀请兼容核查](../../research/2026-10-18-invitation-compatibility.md)完成本地验证及任务独立审查；修复后正常/污染环境各117场景1834断言、26次真实锁等待和4类清理通过。项目77/766、shared4/16、infra7及175页通过，707输入复核未变；[最终整批独立审查](../../research/evidence/2026-10-18-rpc-access-guards/batch-final-review.md)通过。候选不提供token/可信确认邮箱/持久预留、历史/ABA绑定不可变或幂等保证，旧余额消费不证明付款。可信钱包/支付来源、生产认证/ACL/RLS/Storage、7个未登记迁移的历史等价、bucket/备份恢复/回退、供应商及G1真机仍未验收，audit仍42项失败。G0/G1保持未通过；本批不形成新里程碑，未提交/推送/迁移/部署，见[质量门判定](../../research/evidence/2026-10-18-rpc-access-guards/milestone-check.json)。

10月18日邀请事务续批：[本地token与持久席位候选](../../research/2026-10-18-invitation-transactions.md)已完成最终正常/污染环境各158场景2,288断言、33实际并发场景、282完整状态核对，协议18/18及4类生命周期观察；Task 1独立规格PASS、质量Approved，Task 2独立审查PASS/Approved；整批独立审查已PASS。本批核对707应用输入/3日志并复用前批RPC权限12:24:38.969365—12:26:48.304226 Asia/Taipei执行，未重跑。合成身份/可信权益端口不证明生产JWT/付款；原RPC、直接表和旧UI/API旁路未关闭，正式adapter/签名与历史token兼容、前向/回退迁移、生产权限/Storage、bucket/备份恢复、供应商和G1真机仍缺。audit仍42项失败；[本批质量门判定](../../research/evidence/2026-10-18-invitation-transactions/milestone-check.json)继续G0/G1=false，原证据门槛与商品决策不变，未提交/推送/迁移/部署。

10月18日邀请HTTP续批：[默认关闭的接受/状态适配](../../research/2026-10-18-invitation-http-adapter.md)已本地实现。两个旧接受handler关闭时503且零外调、无旧写回退；启用后只接受Bearer与规范token，拒绝旧opaque token/Cookie-only。只有最终accept结果确认成功，unknown须显式只读恢复。定向三套共 194 项通过；handler 测试使用实际 SDK 对接合成 loopback；控制器本批Web80/960、shared4/16、infra7及176页通过；Task 1初审I1修复复审PASS/Approved，Task 2独立审查PASS/Approved；最终完整性/整批独立审查已通过，M1已修正并复核，见[当前状态](../../research/evidence/2026-10-18-invitation-http-adapter/verification.json)。该证据不证明真实Auth/JWT/PostgREST/PG17或生产授权；可信权益事件/来源、发送/旧读取/直RPC/表路径关闭、历史兼容迁移/回退及原G0/G1要求仍待验收。audit42项未解决、生产开关未启用，[本批判定](../../research/evidence/2026-10-18-invitation-http-adapter/milestone-check.json)仍G0/G1=false；本地批次不新增里程碑，无提交/推送/迁移/部署。

10月19日只读/UI续批：[token GET兼容与恢复页面](../../research/2026-10-19-invitation-read-ui.md)已本地实现，check-pending始终503，两页面unknown后只允许显式查询。I1同batch账号往返缺陷经真实RED/GREEN修复及限定复审Approved；最终253项（18新读取路由SDK＋41 React＋194既有回归），固定代码后Web82/1019、shared4/16、infra7、176页通过，751输入不变并恢复next-env。Task 2文档独立审查、整批独立审查及最终完整性均已通过，见[当前状态](../../research/evidence/2026-10-19-invitation-read-ui/verification.json)。SDK/组件合成测试不证明真实提供方或生产权限。signin/callback旧日志与auth_next持久化是独立发布阻塞；可信pending/最小预览、历史opaque token、权益source/event、发送/取消/直接RPC与表ACL，以及原G0/G1证据仍缺。[本批判定](../../research/evidence/2026-10-19-invitation-read-ui/milestone-check.json)继续G0/G1=false，audit42项及构建旧警告未解决，生产开关关闭，无提交/推送/迁移/部署。

10月19日认证回跳续批（历史）：[本地加固](../../research/2026-10-19-auth-return.md)已修复触及signin/callback的旧日志/错误回显与auth_next读写，后者只删除且无替代缓存；安全next只支持八语言下的dashboard与规范邀请路径，丢next回dashboard。实际SSR SDK callback限选定一次POST、十秒总截止含body/caller abort，303保留成功cookie，失败只保留删除cookie。最终430项（177本批＋253邀请回归）与新项目Web85/1196、shared4/16、infra7、176页通过；757输入未变、next-env恢复。Task 1独立Spec PASS/Quality Approved、M1独立核验通过；Task 2文档审查、整批审查及最终完整性均已通过，见[当前汇总](../../research/evidence/2026-10-19-auth-return/verification.json)。

10月19日认证会话衔接续批（当前）：[本地PKCE/cookie实现](../../research/2026-10-19-auth-session-integration.md)已完成，provider核实store/SSR/Bearer、完整session OTP与同用户刷新页面连续性已有定向28套/605项及实际Chromium合成桥14项证明。两轮独立审查五项问题已修复；规格复审PASS、质量复审Approved且无新规格问题。控制器新Web96/1278、shared4/16、infra7、176页通过，773输入不变、next-env恢复；文档独立审查、整批独立审查与最终完整性均已通过，见[当前汇总](../../research/evidence/2026-10-19-auth-session-integration/verification.json)。

RB1的本地根因/合成集成完成，真实Google/SMTP、完整Next/域名cookie部署与JWT/RLS/PostgREST资格仍开放。旧localStorage-only用户须重新登录，精确认证key只删不导入；旧fragment-only/畸形callback不恢复，裸`?type=invite`仅保留无凭据指引，safe next及dashboard兜底不变。下一独立本地任务推进可信权益source/event、撤销/去重、send/release及直接RPC/表ACL；真实提供方另验。原G0仍缺正式权限/Storage/bucket、迁移等价/回填/回退/备份及供应商条件；G1仍缺正式adapter、设备故障矩阵和保存/导出/删除恢复证据，不能凭本批通过关闭。audit42项（34high/8moderate）未重跑未解决；旧Next配置及缺服务端key的configuration-validation诊断不因成功build而消失。[本批判定](../../research/evidence/2026-10-19-auth-session-integration/milestone-check.json)继续G0/G1=false，生产开关未启用，无提交/推送/迁移/部署。前批“先做会话衔接”建议只作日期历史。

10月21日续接：[可信权益事件本地组合](../../research/2026-10-20-trusted-entitlement-events.md)已通过独立规格 PASS／质量 Approved，无待修项，文档独立审查 PASS／Approved、整批独立审查 PASS，本批本地收尾完成。实现包括受限writer、事件/来源去重、撤销墓碑、精确成员停用及七个旧写RPC/表列ACL收紧；10月20日正常/污染各95场景3,211断言、20并发、4类清理及Web96/1278、shared4/16、infra7、176页构建结果保留，本次812个源码/依赖/PG哈希、773应用输入与Node/文件清单匹配，未重跑不变矩阵。见[状态](../../research/evidence/2026-10-20-trusted-entitlement-events/verification.json)。合成事件不是支付凭证，余额镜像不是可用权益，旧应用不能直接启用候选。下一实施接send/release HTTP及发送者恢复；真实事件/角色/Auth/RLS/Storage、历史迁移/备份/供应商及真机仍缺，原G0/G1=false。

10月21日邀请发送HTTP续批：[send/release/lookup应用传输](../../research/2026-10-21-invitation-sender-http.md)已完成本地实现、冻结定向17套/521项和新项目Web101/1373、shared4/16、infra7、178页，785输入不变并恢复next-env。独立规格PASS；质量Approved，文档独立审查PASS／Approved，整批审查PASS，本批本地收尾完成，见[当前汇总](../../research/evidence/2026-10-21-invitation-sender-http/verification.json)。全局release不以sender lookup为前置；数据库核对当前项目facilitator，UI严格匹配返回身份。旧GET/DELETE/cleanup始终关闭，缺来源/request ID的旧发送明确不可用；完整可信来源选择/发送管理/历史恢复仍待做。SDK/组件合成证据不证明真实提供方、邮件送达或生产资格；前批SQL/依赖/证据未变。原P0/G0–G4仍未通过、历史audit42项未重跑未解决，无提交/推送/迁移/部署。

## 2. G1设备与故障矩阵

设备清单目前是测试目标，不是支持声明。实际执行前填写硬件、OS、浏览器完整版本、麦克风、可用空间、网络条件与录音MIME；字段缺失时该设备仍为“未验证”。

| 目标设备 | 浏览器 | 当前结果 |
|---|---|---|
| iPhone | Safari | OS/硬件/版本待登记 |
| Android手机 | Chrome | OS/硬件/版本待登记 |
| macOS桌面 | Safari、Chrome | 两浏览器分别验证，版本待登记 |
| Windows桌面 | Chrome或Edge | 执行前确定声明支持者，不能用macOS结果替代 |

每个声明支持的组合用5/20/30分钟虚构音频；输入含开头/每分钟/结尾可识别标记，保存参考时长和文件hash。每一组合各执行：正常结束、录制中断网再联网、上传中断网、刷新、关闭页面再打开、锁屏、来电/麦克风被抢占、磁盘/IndexedDB配额失败、存储上传失败、重复点击保存。中断点覆盖尚未落盘、已落盘未上传、云端已收块未确认、确认后清理前。

预期：界面分别呈现本机持久化、上传、云端已确认范围；没有证明时不得显示“已安全保存”。恢复必须校验块顺序、完整性、可解码性及实际时长；缺块不能用播放成功冒充完整恢复。重开后可选择继续/导出恢复内容，完整确认前不能删除恢复副本。浏览器强制停止录音时允许明确中断和重新开始，不承诺后台不中断。任何声明支持的组合失败，应修复或明确缩小支持范围并复测。

基础原件导出须在另一台设备断网后双击打开，不能依赖登录、远程资源或`file:// fetch`；清单里逐个对象的字节数与SHA256匹配。缺件或校验失败返回失败清单，不给“完整备份成功”。

## 3. 权限与真实失败反例

建立虚构家庭A/B，每家有facilitator、active storyteller、pending邀请和removed成员。覆盖：API签名、直接Storage URL/SDK、ASR、上传、导出、删除、Worker领取与写回。仅测API不足以通过G1。

- A成员读写B对象均被拒绝；改变projectId、storyId、bucket或basename不得改写对象归属。
- 移除的原上传者不能凭key内自己的ID继续获取新链接或触发处理。新请求重新查权限；失败查询不使用缓存许可。已签发直链的剩余TTL单列，不承诺瞬间撤回已下载副本。
- 测试URL、编码/双编码穿越、空目录、伪造嵌套`projects`、未知bucket、丢失原件与同名不同目录。
- AI超时、拒绝、无额度、非法JSON/结构、低/零/未知置信度显示真实状态，不补模拟转写或故事。音频保存与AI处理状态独立；保存失败不能借AI失败提示“原声安全”。
- 删除/撤权后新处理被拒；运行中的结果写回再次核对撤销状态。数据库恢复后重新应用墓碑，不能复活待删资料。

10月13日前置批只验证服务端媒体入口。直接Storage RLS、已签发链接、Worker和完整物理删除仍须后续集成测试。

## 4. G2数据集与统计口径

E0使用5–10个虚构困难片段做管线验证；不是准确率样本。E1目标20–30位单独授权的讲述者，每位10–20分钟；开发/保留集按家庭划分，同一家庭的说话人、片段和标准答案不能跨集。建议至少10个家庭留作保留集；达不到时保留逐案结果，不发布泛化结论。

保留集目标至少200个植入错误、200个经人工确认的无错负例，分布在人名/人物主体、关系、关键年份、事件新增、重要遗漏、来源错配等类别。每条有原声位置、正确答案、植入方式、严重等级与双人核听裁决；不能用同一错误的重复改写充样本。模型不能看到植入标记或答案。数据规模及样本独立性在评估报告中明确说明。

| 指标 | 定义与门槛 |
|---|---|
| 错误检出率 | 被正确指出且定位的植入错误数 / 全部植入错误数，≥95%；200例时至少190例 |
| 误报率 | 被错判为错误的无错项 / 全部无错负例，≤10%；200例时最多20例 |
| 严重新增事实 | 主体、关系、关键年份、虚构事件未解决不得进入批准稿；通过总体分数也不能豁免 |
| 核心事实出处 | 每一核心事实段必须有正确版本、片段范围和原声位置，或明确标记“家人补充/尚待确认”；未知不冒称证据 |
| 定位回听 | 每个保留家庭至少抽查10个核心事实来源（不足10个时全查）；找得到且内容支持陈述，错误逐项修复 |
| 人工修订 | 每户核听、改稿、解决分歧、等待与客服分钟分别记录，不把后台运行时间算成人工 |

同时报告x/n、类别分布及Wilson区间；家庭内样本相关，不能把200项当200个独立家庭。WER仅作ASR诊断。高档基准和一个挑战者匿名随机顺序评审；有/无模型复核做消融对照，不能用模型互相赞同当事实正确。固定输入、提示、模型ID/配置、处理器、运行版本；升级后重跑对应集。

## 5. 产品与经营窗口

- 邀请启动时点：首次有效项目邀请；已有声音导入与新录音都记录`first_material_submitted_at`，不只依赖first_recording。
- 首次成果：邀请后7天内，至少一份讲述者/家人认可且能下载回听的成果；目标≥80%，分母为已到7天窗口的全部进入测试家庭，退出/未完成保留。另报独立/陪同、导入/新录音分层。
- 项目完成：项目开始后28天内满足该家庭购买/研究约定的范围并完成批准与交付；目标≥70%，分母保留全部成熟队列家庭。
- 回听：交付后14天窗口成熟才入分母；记录至少一次可归属的回听，不能用下载推断实际收听。未成熟者单列。
- 免费、折扣、全价、退款分开；整批净收入扣全批模型/重试/存储/支付/退款/人工成本，再分别报每个付费家庭和每个完成项目分摊。零分母显示无样本。
- NPS = 100 ×（9–10分答卷数 − 0–6分答卷数）/有效答卷数；愿推荐比例另算。所有比例同时展示x/n及未回复数，小样本不触发自动扩张/停项。

下一项证据工作为两入口可交互原型和6–8户观察；需要真实样本安排，本文不将研究计划写成已执行访谈。

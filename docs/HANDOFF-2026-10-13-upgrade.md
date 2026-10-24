# Handoff：UR Saga 十月升级继续执行

- 更新时间：2026-10-23（Asia/Taipei）
- 工作目录：`/Users/eat/Documents/eatpotato/saga传奇`
- 当前分支：`codex/october-upgrade-p0`
- 基线 HEAD：`1caa21a72`（当前工作树包含大量未提交变更）

**10月23日本轮接续：Storage完整定义与旧删除阻断。** [P0差距与实施记录](research/2026-10-23-p0-gap-and-storage-audit.md)按原计划重新区分P0/G0与P1/G1：两入口原型可评审已有证据，T01观察仍0/6–8户；真机继续deferred_by_user，不加成G0新门槛。一次真实metadata_reader只读采集取得六函数/七触发器，全部指纹匹配；[语义审查](research/evidence/2026-10-23-storage-definition-capture/semantic-audit.md)已补齐参数、UPDATE OF、删除GUC与生命周期角色约束。无需再索要这些正文或A/B/C/D。

本轮已关闭旧故事/文件删除服务与管理员图片删除接口；已上传评论图片不可移除时保留引用并提示，纯本地预览仍可移除。它是本地安全阻断，**正式物理删除adapter未完成，线上旧代码/Public桶未改变**。新旧采集测试53项、PG17合成采集34断言/4场景、删除定向3套/18项通过；两项实现的独立规格/质量分别PASS/Approved。新执行项目验证为 **10月23日18:52:57—18:56:11 Asia/Taipei，Web108/1438、shared4/16、infra7、180页**，810输入未变、next-env恢复。构建仍有旧Next配置及缺服务端key诊断，audit42项沿用旧证据未重跑。整批独立审查PASS/Approved、零待修项；本批本地收尾完成。收尾状态见[本批汇总](research/evidence/2026-10-23-storage-definition-capture/verification.json)与[计划](superpowers/plans/2026-10-23-storage-definition-capture.md)。

**原P0/G0仍未通过，未提交/推送/迁移/部署。** 仍缺真实私密访问/部署Auth资格、迁移语义与回填回退/备份恢复、供应商账户/数据条件/预算及家庭观察；完整adapter与真机另按P1/G1推进。下一步使用本批已审定义补完整Storage/enum的隔离行为演练，分开归因GUC、角色和RLS，再落实正式媒体/Storage/删除事务和七项迁移的兼容方案。旧源码/历史审查与实验原样保留，后文旧“尚缺定义”叙述是本轮之前的历史。

**10月23日部署补充（URL/提示已收齐）：** 无隔离测试 Supabase 项目；Vercel 域名 `maxiusi.dpdns.org`、commit `1caa21a`（10月7日）与升级前基线一致。九个变量条目、Google/SMTP 状态、Site URL、17 条 Redirect URLs、应用 URL 及 service-role 提示原文已保存，勿重复索要。生产 8 个语言回调齐全；Site URL 粘贴值无协议，后台应确认为完整 HTTPS；应用 URL 尾部 `/` 会使报告旧 commit 拼出双斜杠邀请链接。Vercel 提示指向可回读的 Config，应检查 Secret 存储，非失效/泄露证据。具体调整、`next` 回调与轮换边界见[部署对账](research/2026-10-23-deployment-config-user-feedback.md)。三项 Supabase 变量 All Environments 且无隔离项目，Preview 数据库隔离未证明；本轮仅静态核对与文档验证，未读取 key、未登录/发邮件、未部署或改配置，真实登录与原 P0/G0 仍未通过。

**10月23日此前回传：A/B/C/D采集已完成，无需重跑。** [用户结果与对账](research/2026-10-23-supabase-user-feedback.md)确认两桶均Public、STANDARD、versioning DISABLED、生命周期未配置；`audio-recordings`桶级大小/MIME为null，`saga`为52428800字节和12种MIME。B完整标签为STANDARD/ANALYTICS/VECTOR；C六个函数所有返回属性/指纹与10月17日一致，对应旧七个触发绑定的五个不同函数加foldername。函数正文、触发参数/条件与真实Storage行为仍未验证，旧本地shim证据不升级为生产等价。D四条登记一致；Free Backups未开启，音视频无独立副本，图片副本未单独确认。下一步准备精确Storage定义采集/审查，推进正式媒体/Storage/删除adapter及备份恢复方案。原SQL/实验/验证证据保留，未改应用行为或重跑应用测试；P0/G0仍未通过，无提交/推送/迁移/部署。下文实现批审查结论仅对应原冻结版本。

**10月23日上一实现批（历史）：** [PG17旧RLS／来源账本组合](research/2026-10-22-pg17-rls-source-composition.md)本地实测完成；实现、协作材料、文档和整批独立审查均PASS／Approved，零待修项；最终完整性结果见验证汇总中的封存报告。正常/污染环境各72场景、832个行为断言、236项账本检查及18条真实锁证据；六项兼容RED和四类生命周期均通过；最终同库组合证明授予/接受/读取、跨家庭拒绝、撤权后拒读/拒绝绑定及旧RPC/表写入旁路拒绝。历史账本归属竞态在RLS身份触发器安装前运行，最终独立seed才同时组合全部候选，未削弱身份保护。实际Auth/JWT/PostgREST、七个省略的Storage触发器、完整enum及Storage HTTP仍未验证，见[汇总](research/evidence/2026-10-22-pg17-rls-source-composition/verification.json)。本次应用796输入及前批实验/证据保持不变，应用测试仍为10月21日原执行。真机按用户要求记为 `deferred_by_user`；[协作清单](research/2026-10-22-user-action-checklist.md)已独立审查通过。恢复入口为 `.superpowers/sdd/2026-10-22-upgrade-pg17-rls-source-composition/progress.md`。[原P0／G0–G4未通过](research/evidence/2026-10-22-pg17-rls-source-composition/milestone-check.json)，未提交、推送、迁移或部署。

本批[整批审查](research/evidence/2026-10-22-pg17-rls-source-composition/batch-final-review.md)已通过；[最终完整性](research/evidence/2026-10-22-pg17-rls-source-composition/final-integrity-5d5d3a4a-93f7-4918-a7cd-e0065d14974d.json)的status=passed为本地收尾依据。下一步从本文末尾的正式媒体/Storage/删除adapter设计继续。

以下邀请管理批已完成，保留为前批记录：

[可信来源选择与邀请管理批](research/2026-10-21-invitation-management.md)已完成本地 SQL/HTTP、两个入口共用的发送管理 UI 和最小请求票据恢复；独立实现规格/质量复审 Approved，零待修项。10月21日冻结验证：PG17 **16场景/2448断言、四类生命周期**，应用定向 **5套/54项**、Web **105套/1420项**、shared **4/16**、infra **7项**及 **180页**通过。10月22日恢复时仅核对哈希、清单、日志、Node和next-env，全部匹配，未重跑业务/项目测试。**文档独立审查 PASS／Approved、整批独立审查 PASS／Approved、最终完整性核验通过，本批本地收尾完成。** 见[当前汇总](research/evidence/2026-10-21-invitation-management/verification.json)、[计划](superpowers/plans/2026-10-21-upgrade-invitation-management.md)、[规格](superpowers/specs/2026-10-21-invitation-management.md)及[恢复核验](research/evidence/2026-10-21-invitation-management/resume-integrity-20261022T011825076698Z.json)。恢复读取 `.superpowers/sdd/2026-10-21-upgrade-invitation-management/progress.md`。

来源选择只使用当前项目/角色的可信返回行；历史只读已登记绑定，旧 opaque token/member 不自动收养。刷新保留的只是 version/actor/project/request/role 票据，不是表单正文或凭据；unknown 后仅显式查询，查询被拒不代表原写入未提交。release 无 sender lookup 前置。两个管理/事务开关仍默认关闭，旧 GET/DELETE/cleanup 继续关闭；本地分层证据不代表真实 Auth/JWT/PostgREST 全链、邮件送达或生产资格。前批[发送/释放 HTTP](research/2026-10-21-invitation-sender-http.md)已完成，其来源选择/管理 UI 后续现由本批承接。

原 P0/G0–G4 尚未通过，仍缺生产权限与供应商条件、迁移等价/回填/回退/备份，以及正式 adapter/真机等后续验收。按用户的条件推送授权，本批**未提交、推送、远端迁移或部署**；保留全部未提交工作与原始恢复资料。

10月21日用户继续授权按升级计划推进、完成后更新handoff，并在原计划里程碑/P0修复完成后推送；本地传输层完成不等于P0/G0已通过。暂不部署/远端迁移，保留全部未提交工作。

前批[可信权益事件批](research/2026-10-20-trusted-entitlement-events.md)已完成本地实现和冻结验证：独立 writer 事件入账、payload 去重、终态撤销、精确成员停用、邀请组合及七个旧写 RPC/表列权限收紧。正常/污染环境各95场景/3,211断言、20并发顺序、4类生命周期通过；本次项目Web96/1278、shared4/16、infra7、176页通过，773应用输入不变，next-env恢复。**10月21日独立规格 PASS／质量 Approved，无待修项；文档独立审查 PASS／Approved、整批独立审查 PASS，本批本地收尾完成。** 10月20日的限流记录保留为历史，控制器复核不替代独立审查。本次只重新核对指纹与证据；以上业务/项目矩阵执行于10月20日。见[当前汇总](research/evidence/2026-10-20-trusted-entitlement-events/verification.json)、[计划](superpowers/plans/2026-10-20-upgrade-trusted-entitlement-events.md)、[规格](superpowers/specs/2026-10-20-trusted-entitlement-events.md)及[控制器复核](research/evidence/2026-10-20-trusted-entitlement-events/controller-review.md)。

**前批交接项现由10月21日 HTTP 批承接。** 10月20日权益事件批的独立规格、质量、文档及整批审查均已完成，详见[当前汇总](research/evidence/2026-10-20-trusted-entitlement-events/verification.json)；恢复资料与原始证据保留，不重做账本或不变的成功矩阵。writer 仍代表合成的预先核实输入；旧余额是镜像，不能单独消费，旧应用不能直接开启本候选。原G0/G1=false，无提交/推送/迁移/部署。

历史：已完成的[认证会话衔接批](research/2026-10-19-auth-session-integration.md)的本地实现已完成：浏览器改用 PKCE cookie，会话由 provider 核实，SSR/Bearer、数值 OTP 与生命周期保护已接通。两轮独立审查提出的五项问题均已修复；[规格复审 PASS](research/evidence/2026-10-19-auth-session-integration/task-1-spec-fix1-review.md)及[质量复审 Approved／无新规格问题](research/evidence/2026-10-19-auth-session-integration/task-1-quality-fix2-review.md)已有证据。最终定向28套/605项、Chromium14项及新项目Web96套/1278项、shared4/16、infra7、176页通过；773输入不变，next-env恢复。文档独立审查、整批独立审查与最终完整性均已通过，见[当前汇总](research/evidence/2026-10-19-auth-session-integration/verification.json)、[计划](superpowers/plans/2026-10-19-upgrade-auth-session-integration.md)与[绑定规格](superpowers/specs/2026-10-19-auth-session-integration.md)。恢复读取 `.superpowers/sdd/2026-10-19-upgrade-auth-session-integration/progress.md`。

RB1的本地根因修复和合成集成已完成，真实Google/SMTP、完整Next部署/域名及Supabase JWT/RLS/PostgREST资格仍开放。旧localStorage-only用户必须重新登录；只精确删除认证缓存，不导入凭据或清理录音草稿。当时的下一项可信权益source/event本地供给、撤销/持久去重及SQL权限组合现已由10月20日本地批承接；HTTP send/release与真实事件/生产ACL资格仍待接入。原G0/G1=false，无提交/推送/迁移/部署；[前批认证回跳记录](research/2026-10-19-auth-return.md)及其中当时的后续建议保留为日期历史。

2026-10-19 11:06 历史状态：[邀请只读兼容与恢复 UI 批](research/2026-10-19-invitation-read-ui.md)已本地实现，I1 经真实 RED/GREEN 修复后[独立复审 Approved](research/evidence/2026-10-19-invitation-read-ui/task-1-fix-1-review.md)。最终定向253项（18读取路由SDK＋41 React＋194既有回归）与固定代码后的项目Web82/1019、shared4/16、infra7、176页通过；Task 2文档独立审查、整批独立审查及最终完整性均已通过，见[当前汇总](research/evidence/2026-10-19-invitation-read-ui/verification.json)、[计划](superpowers/plans/2026-10-19-upgrade-invitation-read-ui.md)和[规格](superpowers/specs/2026-10-19-invitation-read-ui.md)。中断恢复读取 `.superpowers/sdd/2026-10-19-upgrade-invitation-read-ui/progress.md`。两旧token GET复用默认关闭的Bearer只读status，check-pending始终503；两接受页面已接显式unknown恢复。可信pending/最小预览、历史opaque token仍不可用；signin/callback旧日志及auth_next持久化是独立发布阻塞。G0/G1未达成，无提交/推送，继续保留本地工作与恢复数据。

前批[邀请token与持久席位事务批](research/2026-10-18-invitation-transactions.md)已完成隔离候选实现与原始最终验证，[Task 1独立规格/质量审查](research/evidence/2026-10-18-invitation-transactions/task-1-review.md)为PASS/Approved，无发现。Task 2文档与完整性收尾独立审查PASS/Approved；整批最终独立审查已PASS；该批本地实现、验证与独立审查已完成。该批证据见[验证汇总](research/evidence/2026-10-18-invitation-transactions/verification.json)、[该批计划](superpowers/plans/2026-10-18-upgrade-invitation-transactions.md)和忽略目录 `.superpowers/sdd/2026-10-18-upgrade-invitation-transactions/progress.md`。G0/G1仍未达成，保留本地分支与未提交/恢复内容。

## 新会话先读什么

当前先读[PG17组合记录](research/2026-10-22-pg17-rls-source-composition.md)、[当前验证与审查状态](research/evidence/2026-10-22-pg17-rls-source-composition/verification.json)和[原质量门判定](research/evidence/2026-10-22-pg17-rls-source-composition/milestone-check.json)。邀请管理、邀请发送HTTP及更早批次均为已完成背景；无需重新执行不变的成功矩阵。

按以下顺序读取：

1. 本 handoff；
2. [综合升级计划](2026-10-10-integrated-upgrade-plan.md)；
3. [P0 准备计划](superpowers/plans/2026-10-11-upgrade-p0-preparation.md)；
4. [P1 契约 v0.1](superpowers/specs/2026-10-13-upgrade-p1-contracts.md)；
5. 与当前批次对应的实施记录：
   - [媒体入口记录](research/2026-10-13-media-access-implementation.md)
   - [T02 资产记录](research/2026-10-13-t02-assets-local-implementation.md)
   - [T05 任务记录](research/2026-10-13-t05-processing-jobs-local-implementation.md)
6. 最新先读[PG17组合记录](research/2026-10-22-pg17-rls-source-composition.md)、[其计划](superpowers/plans/2026-10-22-upgrade-pg17-rls-source-composition.md)、[其规格](superpowers/specs/2026-10-22-pg17-rls-source-composition.md)和[当前验证/审查状态](research/evidence/2026-10-22-pg17-rls-source-composition/verification.json)。前批[邀请管理记录](research/2026-10-21-invitation-management.md)、[其计划](superpowers/plans/2026-10-21-upgrade-invitation-management.md)、[其规格](superpowers/specs/2026-10-21-invitation-management.md)和[验证](research/evidence/2026-10-21-invitation-management/verification.json)保留为已完成背景。前批[邀请发送/释放 HTTP 记录](research/2026-10-21-invitation-sender-http.md)及[其验证](research/evidence/2026-10-21-invitation-sender-http/verification.json)保留为已完成背景。前批再读[可信权益事件记录](research/2026-10-20-trusted-entitlement-events.md)、[当前计划](superpowers/plans/2026-10-20-upgrade-trusted-entitlement-events.md)、[绑定规格](superpowers/specs/2026-10-20-trusted-entitlement-events.md)和[当前验证/审查状态](research/evidence/2026-10-20-trusted-entitlement-events/verification.json)。前批[认证会话衔接记录](research/2026-10-19-auth-session-integration.md)、[其计划](superpowers/plans/2026-10-19-upgrade-auth-session-integration.md)及[其验证](research/evidence/2026-10-19-auth-session-integration/verification.json)保留为已完成背景。以下均为历史背景：[认证回跳记录](research/2026-10-19-auth-return.md)、[当前计划](superpowers/plans/2026-10-19-upgrade-auth-return.md)和[当前验证/审查状态](research/evidence/2026-10-19-auth-return/verification.json)；[邀请只读兼容与恢复UI](research/2026-10-19-invitation-read-ui.md)及[其验证](research/evidence/2026-10-19-invitation-read-ui/verification.json)为已完成前批；[前批HTTP适配](research/2026-10-18-invitation-http-adapter.md)保留为历史背景。前批已完成：[邀请token与持久席位事务](research/2026-10-18-invitation-transactions.md)、[本批实施计划](superpowers/plans/2026-10-18-upgrade-invitation-transactions.md)和[验证/审查状态](research/evidence/2026-10-18-invitation-transactions/verification.json)。前批背景读[RPC邀请/项目权限候选](research/2026-10-18-rpc-access-guards.md)、[邀请兼容核查](research/2026-10-18-invitation-compatibility.md)、[本批执行计划](superpowers/plans/2026-10-18-upgrade-rpc-access-guards.md)及[验证汇总](research/evidence/2026-10-18-rpc-access-guards/verification.json)。前批[PG17依赖与持久导出请求](research/2026-10-18-pg17-routines.md)及[执行计划](superpowers/plans/2026-10-17-upgrade-pg17-routines.md)已完成。再读[受限RPC定义与调用契约核查](research/2026-10-17-routine-audit.md)及[通知验证汇总](research/evidence/2026-10-17-routine-audit/verification.json)；再读[T02来源账本与绑定事务](research/2026-10-17-t02-source-ledger.md)、[函数/触发器/ACL补核](research/2026-10-17-metadata-supplement.md)和[来源账本批验证汇总](research/evidence/2026-10-17-t02-source-ledger/verification.json)；旧媒体背景见[T02投影与兼容](research/2026-10-17-t02-legacy-mapping.md)、[RLS审查修复](research/2026-10-17-rls-review-followup.md)、[前批RLS演练](research/2026-10-17-rls-rehearsal.md)、[G0/T02远端元数据与迁移差异](research/2026-10-17-remote-metadata-reconciliation.md)。T05继续前读[私有输出候选与发布互斥](research/2026-10-16-t05-output-candidates.md)、[已知合并错误与原子重试](research/2026-10-16-t05-merge-failures.md)、[T04/T05真实本地文件接入](research/2026-10-16-t04-t05-local-merge.md)、[自动监督与持续任务](research/2026-10-16-t05-supervision.md)及各自最终证据。依赖审查见[复审与P2修复](research/2026-10-16-dependency-review-followup.md)，供应商接入前读[资格准备](research/2026-10-11-provider-readiness.md)。

历史恢复记录：前批读取中断聊天`01a14a7d-558d-7c02-b11d-9af3f201e445`并完成当时的PG17函数审查与交接；随后读取续接聊天`01a14cbd-e715-75e2-bf51-139f10f95b4d`推进RPC权限候选批。这两批已完成，不是当前启动入口；当前按页首PG17组合状态继续，不重复远端采集或运行时构建。沿用此前有效决策：`D03=A，其他按照推荐`，即 D01–D16 全部选择 A。

## 用户约束与执行规则

- 暂不部署，完成里程碑后统一部署。
- 2026-10-15 新增授权：达到现有升级计划的里程碑后推送 GitHub。先核验对应质量门/完成证据；本地批次完成不算里程碑，不自动授权合并 main、远端迁移或部署。
- 不执行远端迁移、生产写入、真实家庭资料扫描或付费供应商调用。
- 保留当前工作树和已有未提交变更；不能整体 reset、checkout 或清理未提交文件。
- 新增 API 默认用功能开关保护；`MEDIA_ASSETS_ENABLED` 不是生产启用证明。
- 任何远端 schema、Storage bucket、RLS、备份、Vercel 构建或生产环境变量都必须有实际只读证据，不能用本地 `.temp`、bootstrap、工作流 YAML 或类型文件替代。
- 正式原声、AI 处理、完整导出和 G1/G0 质量门必须分别验证；本地测试通过不等于生产验收通过。

## 已完成的工作

### 邀请token与持久席位事务（10月18日续接完成）

[本批实现](research/2026-10-18-invitation-transactions.md)已完成隔离send/accept/release/status/lookup、持久预留/请求去重/成员绑定及严格协议。中断前正常/污染环境各158场景、2,288断言、33组实际锁竞争，协议18/18与4类生命周期验证通过；续接复核原始证据和输入哈希，并完成Task 1、Task 2及[整批独立审查](research/evidence/2026-10-18-invitation-transactions/batch-final-review.md)，无待修项。应用707输入/3日志未变，复用前批项目验证。正式身份/支付来源、旧入口兼容、迁移回退及G0/G1保持未完成；下一步见下文。

### RPC邀请/项目权限候选（10月18日；整批独立复审通过）

[邀请兼容核查](research/2026-10-18-invitation-compatibility.md)重新核对五处调用、实际UI链及固定表约束；email/token与成员记录ID接口仍不匹配，TABLE解包、取消/过期返席、余额授予来源均有缺口。Task 1独立规格/质量审查PASS；正式token适配未实现。

两个[本地候选](research/2026-10-18-rpc-access-guards.md)保持完整原签名、默认参数及返回形状，只允许authenticated调用并核对非NULL本人。接受入口以首次读取的`(project_id,user_id)`为单次调用一致性基准，按项目→成员持锁后核对同一绑定及当前项目/邀请者/成员资格；只激活已有pending记录。首次读取前已提交的合法绑定按当前事实判断；不保证历史不可改绑或ABA检测，更强历史保证须另行设计可信版本/映射。创建入口锁既有钱包，同事务扣1券和1对应席位、建项目/角色并记两条consume；`payment_status='unverified'`，消费不证明付款。

初审P2发现等待期间改绑到调用者仍可被接受；已先保存真实RED，再保留初始user_id并增加NULL安全比较。修复后正常/污染环境各 **117场景/1834断言**、**26次实际锁等待**，**4类生命周期验证**完整清理；原116/1828证据及初审CHANGES_REQUIRED保持不变。[修复复审](research/evidence/2026-10-18-rpc-access-guards/access-review-fix1.md)规格/质量均PASS、无残留发现。Task 3项目验证及文档/完整性核验完成，[最终整批独立审查](research/evidence/2026-10-18-rpc-access-guards/batch-final-review.md)通过，见[汇总](research/evidence/2026-10-18-rpc-access-guards/verification.json)。

本批仅新增隔离实验和文档；未接正式UI/API或根迁移。没有幂等键，未知提交后不能盲目重试；token/可信确认邮箱/持久预留、钱包与付款来源、生产认证/ACL/RLS/Storage、历史迁移等价、bucket/备份/供应商/真机仍待补齐。G0/G1未达成，未提交、推送GitHub、迁移或部署，本批不构成新里程碑。

### PG17依赖与持久导出候选（10月18日续接完成）

固定更新时间触发函数采集和独立审查已完成：新增17项＋旧52项共69项通过；单次远端只读采集摘要匹配，连接正常关闭。原生PG17.4由官方源码校验后构建，运行时在本批忽略工作目录，不能删除后仍声称可复现。

7张相关表的70字段、34约束、34索引和3触发绑定已在隔离PG17核对；12原RPC逐重载记录实际行为、SQLSTATE、表变化与回滚。两导出候选保留签名/返回形状，本人＋当前项目权限检查、受限布尔选项和持久请求写入均已实现。候选仅在实验目录，queued只表示请求登记，不代表Worker或文件交付。

中断前141场景864断言保留为历史证据。续接已校正两项测试前提：project_members-only使用active成员，deleted_member先建立再删除成员记录，新增10项前提断言。最终正常/污染环境各 **141场景874断言**、**12组实际锁等待**和 **4类生命周期验证**通过，源码/运行时/私有输入指纹匹配，连接/集群/临时目录清理完整。README及[实现报告](research/evidence/2026-10-17-pg17-routines/pg17-implementation.md)已补齐，[独立规格/代码审查](research/evidence/2026-10-17-pg17-routines/pg17-task-review.md)均PASS、无待修项；[整批独立复核](research/evidence/2026-10-17-pg17-routines/batch-final-review.md)也已PASS；[最终验证汇总](research/evidence/2026-10-17-pg17-routines/verification.json)记录当前状态。

原解码测试维护已独立审查通过，生产解码代码未改。应用verify77套766项、shared4/16、infra7及175页构建在中断前通过；续接核对707个输入和52个受保护文件全部一致，next-env原字节保持。G0/G1仍未达到，未提交、推送、迁移或部署。

### RPC 定义与通知权限核查（10月17日前批）

按[本批计划](superpowers/plans/2026-10-17-upgrade-routine-audit.md)完成固定12目标签名的私有定义采集器。原16条元数据查询及23项回归保持；两项独立审查P2（本地PG环境继承、启动失败清理）均先复现再修复，最终52项通过，规格/质量增量复核PASS。原始定义保存在被忽略的0700目录/0600文件，公开证据只保留摘要和安全元数据。

单次远端只读采集12/12身份、属性和定义MD5匹配前批快照；PG17.4版本摘要、TLS1.3、metadata_reader、只读一致性事务及10s/2s/15s限时核对，连接正常关闭。没有调用远端RPC或读取业务行。[独立调用点报告](research/evidence/2026-10-17-routine-audit/callsite-review.md)核对13处调用，确认5处邀请参数不匹配和TABLE结果解包缺口，涉及实际UI；这是静态差异，不是线上HTTP失败记录。

12个真实定义已逐一审阅，确认通知身份缺口、付款来源不足、初始化NULL检查、缺列/角色约束及结账/导出占位；静态正文不等于线上成功利用。通知两函数仅访问notifications及内置函数，快照未列通知表非内部触发器，选入隔离PG16精确重放。真实RED复现匿名取得他人未读数2、伪造接收者修改1条通知；本地本人检查＋EXECUTE候选正常/污染环境各 **19场景181断言**通过，实际SIGTERM退出143、无效启动退出1，清理完整。源码/运行时/私有定义指纹已核对；[独立规格](research/evidence/2026-10-17-routine-audit/notification-spec-review.md)与[质量审查](research/evidence/2026-10-17-routine-audit/notification-quality-review.md)均PASS，无剩余审查问题。

候选不进入根迁移；表ACL比远端严格，身份helper仅模拟可信PostgREST验证后的claim，不能证明真实JWT/PG17/完整生产权限正确。metadata角色即使伪造claim也被EXECUTE拒绝；无service回退，旧/外部客户端兼容仍需确认。详见[本批记录](research/2026-10-17-routine-audit.md)。应用verify **77套765项**、shared **4/16**、infra **7**及175页构建通过；next-env恢复、依赖未改，audit沿用42项失败。G0/G1未达成，未提交、推送、远端迁移、权限变更或部署。

### T02 来源账本与函数权限补核（10月17日前批）

按[本批计划](superpowers/plans/2026-10-17-upgrade-t02-source-ledger.md)新增隔离来源账本、核查记录和绑定事务。完整字段/实际类型的版本摘要、项目/来源位置唯一性、只追加历史、精确核实证据、当前权限/墓碑/来源/资产版本检查，以及未知COMMIT的持久身份核对已在真实本地PG14演练。初审R1发现字段清空或数组/属性移除不入账，已先RED再补100项回归；移除路径现在追加不可绑定的明确版本，旧观察/核查/绑定保留，旧projector未改。

修复后正常及合成宿主PG环境各 **290项通过、18条实际锁证据**，稳定fixture SIGTERM退出 **143**；三份报告源码指纹一致，连接/集群/临时目录清理完整。[最终独立增量复核PASS](research/evidence/2026-10-17-t02-source-ledger/review-fix1.md)，R1/P2关闭且无新增问题。实验使用受信owner连接和模拟核实资产，不是生产adapter、Storage字节核实或PG17证明。详见[本批记录](research/2026-10-17-t02-source-ledger.md)。

前批T02宿主PG环境P2已[独立复核PASS](research/evidence/2026-10-17-t02-compatibility/review-followup.md)。采集器独立初审发现关闭等待无截止P2，现已用统一异步截止/强制断开/安全落盘修复；**23项**及本地SQL验证通过，[增量复核PASS](research/evidence/2026-10-17-metadata-supplement/review-followup.md)。随后单次只读采集取得 **39函数、156执行权限组合、21非内部触发器、8 schema权限、9默认ACL**；PG17.4、TLS、只读/限时与连接正常关闭已确认。前11节与前快照一致；bucket仍42501，结果partial/退出2。

新证据显示public 20函数均授予PUBLIC EXECUTE，其中14个SECURITY DEFINER（12非trigger）、8个未设置函数级search_path；metadata_reader有public USAGE，表SELECT被拒不能推出函数路径全部安全。未读取/调用函数体，不宣称已证实越权。两处邀请RPC的参数/返回签名与根迁移不同，七个未登记版本仍不能重放。下一步补受限函数体语义与完整依赖对账，详见[补核记录](research/2026-10-17-metadata-supplement.md)。

本轮项目verify **77套/765项**、shared **4/16**、infra **7**、类型/lint及 **175页**构建通过，next-env原字节恢复；旧应用/依赖/RLS/T05/根迁移未改。未重跑audit，前批 **42项（34high/8moderate）**仍失败。G0/G1未达成，未提交、推送、迁移、修改远端权限或部署。

### T02 旧媒体投影与 RLS 审查修复（10月17日前批）

按[本批计划](superpowers/plans/2026-10-17-upgrade-t02-compatibility.md)修复标准Supabase public/sign/authenticated URL被误认bucket的问题，直接验证原始key，不trim/decode或按basename猜测。新增stories媒体投影，逐字段/数组位置/属性保留来源；原件、缩略图、派生音频分开，URL/path冲突或异常形状显式待核。`mapped`仅是定位候选，未建立assetId/ready、归属或真实对象存在证明。

定向 **2套/40项**、真实PostgreSQL兼容 **19项**通过，覆盖jsonb[]/text[]、必填、角色CHECK与项目/用户唯一性，原数据保持；稳定fixture SIGTERM退出143完整清理。已写只增来源账本、来源版本冲突、核查后绑定和停写回退草案，未创建持久账本或正式迁移。

前批RLS独立审查恢复并提出两项P2：SQL空白字符集不全、目录分配与signal清理竞态。已先复现再修复，RLS现为 **63场景/351断言**，另 **6类**真实目录/PG异常与中断清理通过，取消后的启动标记也有正反例；最终[RLS增量复核PASS](research/evidence/2026-10-17-rls-rehearsal/review-fixes.md)，两P2及后续两P3已关闭。独立T02审查发现pg客户端受宿主SSL/密码环境影响，已在两个runner显式固定本地连接参数，并以合成PGSSLMODE=require反例复测通过。T02的最终增量复核因限流待补，见[本批审查状态](research/evidence/2026-10-17-t02-compatibility/review-status.md)，未把初次审查的changes requested改称PASS。

项目verify **77套/765项**、shared **4/16**、infra **7**、类型/lint和 **175页**构建通过。next-env原字节恢复，依赖/根迁移/前批T05未改；本批未重跑audit，沿用前批实际 **42项（34high/8moderate）**失败证据。未接正式保存/删除路由，生产RLS未改，G0/G1未达成，未提交、推送、迁移或部署。详见[T02记录](research/2026-10-17-t02-legacy-mapping.md)、[RLS修复记录](research/2026-10-17-rls-review-followup.md)和[验证汇总](research/evidence/2026-10-17-t02-compatibility/verification.json)。

### G0/T02 Storage 与 stories RLS 隔离演练（10月17日前批）

新增 `experiments/rls-rehearsal/`，以虚构两家庭数据逐字重放保存快照中的32条策略。完整依赖RLS先得到42P17递归错误；显式关闭依赖表RLS的诊断阶段分别复现audio匿名读取/跨项目上传、撤权上传者旧分支、projects.name误绑定及stories宽松INSERT。候选回归前全部重新启用RLS。这些是缩减本地schema的行为证据，不是线上攻击或资料外泄证明。

本地候选使用窄SECURITY DEFINER helper消除递归，以RESTRICTIVE门约束并行宽松策略，项目/故事对象按当前成员授权，写入绑定本人路径及owner字段；stories项目/创建者不可变。管理bucket的覆盖、改名、直接删除和upsert暂时关闭，原始故事DELETE也关闭，**旧客户端直接.remove()需后续兼容，候选不可部署**。READ COMMITTED下一语句能看到撤权，已建立REPEATABLE READ快照保留旧视图，未声称即时撤销全部访问。

最终本地PostgreSQL14.17验证 **61场景/199断言**，包含正反例、未知宽松策略、原子DDL回滚、重复应用及撤权隔离级别；独立SIGTERM退出143报告确认数据库/连接/临时目录完整清理。两份最终报告的五份源码指纹一致。项目verify **76套/730项**、shared **4/16**、infra **7**、类型/lint和 **175页**构建通过；next-env原字节恢复，应用/依赖/根迁移/前批实验保持原样。实际audit仍 **42项（34high/8moderate）**。

见[实施记录](research/2026-10-17-rls-rehearsal.md)、[验证汇总](research/evidence/2026-10-17-rls-rehearsal/verification.json)及[里程碑核对](research/evidence/2026-10-17-rls-rehearsal/milestone-check.json)。独立审查派发后因模型限流失败，见[审查状态](research/evidence/2026-10-17-rls-rehearsal/review-status.md)；主代理自查不当作独立PASS。前批采集器审查也仍待补。生产权限未改，bucket/完整函数与触发器/ACL/迁移等价/备份回退、正式adapter及真机验收仍缺；G0/G1未完成，未提交、推送、迁移或部署。

### G0/T02 远端元数据补核（10月17日前批）

已使用前置会话配置的metadata_reader，在TLS证书/主机验证和只读一致性事务中取得真实PostgreSQL17.4元数据：**43个表/视图、459字段、79策略、141索引、167约束、4条迁移版本**。先前audit_meta tables/columns的0/0是权限过滤结果，不能再据此称远端schema未知或空库。连接池忽略启动超时参数，已改为SET LOCAL并实际确认10s/2s/15s；所有连接关闭。bucket配置仍42501，最终采集状态为partial/退出2。

迁移账本仅有4个旧版本，**7个根迁移未登记，但其中20张声明表已存在**；不得直接db push、修复历史或重放bootstrap。真实stories.images为jsonb[]、title/storyteller_id必填，project_roles角色/状态CHECK与本地契约有差异。正式P1新增表尚不存在。

需优先处理的实际规则：audio-recordings对public全桶SELECT、authenticated全桶INSERT；saga项目策略将路径误绑定到projects.name，且旧上传者分支可绕过项目撤权；stories也有并行PERMISSIVE宽松分支。只读静态证据已足以阻止隔离门通过，**没有读取真实对象或证明已经发生资料外泄**。本轮未改线上权限。

本批新增可重跑的只读采集器与**10项定向测试**；项目verify **76套/730项**、shared **4/16**、infra **7**、类型/lint及**175页**构建通过，next-env原字节恢复。实际audit仍**42项（34high/8moderate）**，退出1。凭据两文件已精确gitignore且未入索引。见[实施记录](research/2026-10-17-remote-metadata-reconciliation.md)、[比较](research/evidence/2026-10-17-remote-metadata/comparison.json)、[最终汇总](research/evidence/2026-10-17-remote-metadata/verification.json)。本批已自查，独立审查因模型不可用/限流待补，见[审查状态](research/evidence/2026-10-17-remote-metadata/review-status.md)。G0/G1仍未完成，未提交、推送、迁移或部署。

### T05 私有输出候选与发布互斥（10月16日前批）

按[本批计划](superpowers/plans/2026-10-16-upgrade-t05-output-candidates.md)完成实现、本地最终验证及独立审查，规格/质量均PASS，未发现Critical/Important/Minor问题。新增持久候选绑定ref/job/attempt/worker/queue与冻结输入摘要；文件创建前先确认reservation提交，prepare返回后登记metadata，发布前独立提交publishing意图，最终published与artifact/业务状态/attempt/queue确认同事务提交。读取前后都复核匹配的published候选。

发布与隔离按job→queue→candidate加锁，candidate锁等待及提交检查点后重查signal/数据库时间/lease/queue/attempt。仅无引用、明确终止、无有效queue、无未知结果且尚未进入publishing的prepared候选可登记quarantined；已发布、reserved、publishing与未知结果保留。outcome_unknown后取消也不能解除保留。已知prepare失败的cleaned状态与原失败/重试事务原子完成；每次重试使用新候选。quarantined只禁止发布，本批没有物理删除、TTL扫描或未知结果自动复用。

最终候选验证 **45场景/277断言**、完整真实合并 **52/402**、失败重试 **42/371**、原T05 **39/307**全部在本批运行并通过，四报告源码指纹与清理核对一致。项目verify **76套/730项**、类型/lint及 **175页**构建，shared **4/16**、infra **7**通过；next-env原字节恢复，依赖、TS helpers、通用状态机、runner/supervisor及外部清理观察器保持本批起点内容。中间夹具失败及一次外部清理单独存证，不当最终通过。

见[本批记录](research/2026-10-16-t05-output-candidates.md)、[独立审查](research/evidence/2026-10-16-t05-output-candidates/review-initial.md)、[验证汇总](research/evidence/2026-10-16-t05-output-candidates/verification.json)、[实现报告](research/evidence/2026-10-16-t05-output-candidates/implementation-report.md)和[里程碑核对](research/evidence/2026-10-16-t05-output-candidates/milestone-check.json)。用户已获元数据范围解释，尚未提供新的只读访问/导出；未重试被拒的CLI角色初始化。依赖未改，沿用前批实际audit **42项（34high/8moderate/0critical）**，没有重跑或宣称通过。G0/G1仍缺正式远端/供应商/adapter/真机证据，本轮未提交、推送、迁移或部署。

### T05 已知合并错误与原子重试（10月16日前批）

按[本批计划](superpowers/plans/2026-10-16-upgrade-t05-merge-failures.md)完成R1修复后实现与本地验证，独立复审已关闭R1，没有新增Important/Critical问题。缺源、非法文件、大小/hash不符、无有效PCM和时长超限持久记录为failed；源读超时和明确暂时OS读取错误沿用原maxAttempts，以1/2/4/5秒封顶退避重试。失败attempt审计、业务状态、延迟消息与旧消息确认同事务完成；过早重复消息不消耗attempt。只有prepare尚未返回且局部清理成功的真实结构化错误可分类；取消/停止/失租、撤权/删除/输入变化仍优先拒绝，准备后及未知COMMIT不自动重试或删文件。R1明确通用FFmpeg非零退出/诊断不证明永久坏输入，修复后保持未知；部分损坏音频仍需后续核对。

最终失败验证 **42场景/371断言**、完整真实合并 **52/402**、原T05回归 **39/307**通过；定向单元 **3套/69项**。项目verify **76套/730项**、类型/lint、**175页**构建，shared **4/16**、infra **7**通过。修复后的失败/合并报告全部源码指纹匹配；原T05在R1修复前运行，其实际执行源码保持相同，附带的合并场景/README旧哈希不再当当前证明。所属进程/组/进程内任务、数据库与临时目录完成清理。首次项目检查发现两处TS类型库兼容问题，修复后重跑通过；next-env恢复。根/Web manifest、lockfile、通用状态机、runner/supervisor和外部清理观察器保持本批开始时内容。

见[本批记录与保留/回收契约](research/2026-10-16-t05-merge-failures.md)、[最终独立复审](research/evidence/2026-10-16-t05-merge-failures/review-final.md)、[最终汇总](research/evidence/2026-10-16-t05-merge-failures/verification.json)、[运行核验](research/evidence/2026-10-16-t05-merge-failures/fix1-final-verification.json)与[项目检查](research/evidence/2026-10-16-t05-merge-failures/fix1-project-checks.json)。本批没有自动GC；未来回收须持久候选身份、发布/回收互斥及未知提交核对，不能按年龄或暂时无引用直接删除。

实际audit:high仍退出1，**42项（34high/8moderate/0critical）**。限定配置范围仍未发现此前四类数据库凭据，没有重试被拒的角色初始化或远端SQL。正式schema/Storage/会话adapter、供应商资格与G1真机仍缺，G0/G1未达成，本轮未提交、推送或部署。前批源码指纹只代表各自运行当时状态，本批以新的最终运行核验为准。

### T04/T05 真实本地文件合并（10月16日前批）

实现、本地验证与最终独立复审均已完成，两处异常回收 P2 已关闭，未发现新增规格或代码质量问题。见[本批记录](research/2026-10-16-t04-t05-local-merge.md)与[实施计划](superpowers/plans/2026-10-16-upgrade-t04-t05-merge.md)。真实 T04 流式合并/FFmpeg 解码已接入隔离 T05 Worker：持久冻结清单与身份、同清单跨 job ID 幂等约束、限时且可取消的本地源流、唯一私有输出与回读校验，以及发布前的权限标志/删除/取消/输入/租约/queue 与 business attempt 复查。真实合并不会写模拟 provider 调用账本。

应用 helper 增加向后兼容 AbortSignal；reader 与解码器收到同一信号，FFmpeg 取消等待进程退出。runner 心跳覆盖文件读取、解码和回读，到发布事务前才停止并 join。文件系统与 PostgreSQL 无共同事务；完全准备的输出在崩溃/COMMIT 结果未知时保留为私有文件，只允许从受检的已提交引用读取。该批当时将本地错误保守恢复为outcome_unknown；本次续批已补明确失败分类与有界重试，见上节。孤立文件 GC 尚未实现。

真实本地验证 **52场景/396项断言**、原 T05 回归 **39/307**通过；Web **75套/716项**、shared **4/16**、infra **7**、类型/lint及**175页**构建通过，next-env 已恢复。两组主验证清理完整，所有最终运行源码指纹与当前文件一致。实际解码异常清理 **6/6** 通过：登记独立进程组并保留父进程退出后的所有权，协作停止后有界回收；同进程直接任务也中止并 join。观察器超时、harness 非预期退出及观察器 SIGTERM 共 **3/3** 通过，提前记录 IPC 所有权并有界回收所属进程、独立停止私有数据库，确认资源消失后才删除临时目录。两处 P2 的关闭结论见[最终独立复审](research/evidence/2026-10-16-t04-t05-merge/review-final.md)与[最终汇总](research/evidence/2026-10-16-t04-t05-merge/verification.json)。先读最终结果，不把中间失败/12场景/50场景结果当当前验收。

测试素材是生成的 WebM/MP4/Ogg；实际 FFmpeg `-re` 输入节流、读检查点暂停及客户端 COMMIT 回执故障分别标注，不当作长音频 CPU 负载、网络分区或真机证明。FFmpeg 7.1 nonfree 仅为本地测试 runtime。没有接生产 Storage/会话封口/正式资产表，没有完成 G0/G1，也没有提交、推送或部署。

### T05 自动监督与持续任务（10月16日前批）

完成[本批记录](research/2026-10-16-t05-supervision.md)与[实施计划](superpowers/plans/2026-10-16-upgrade-t05-supervision.md)。修复业务心跳未刷新队列claim及lease累计到未来的问题；每个attempt绑定queue ID/retryCount，双方同事务续约，租约以锁后数据库当前时间计算并受硬截止约束。新增持续消费runner与自动监督supervisor，异常退出最多连续重启3次；调用结果未知保持隔离。

独立审查发现并修复了维护SQL受锁导致关闭挂起、停止信号在锁等待/最后时钟查询间被漏掉的问题；增量复查补齐后台会话取消、runner失败退出传递与幂等停止。取消仅针对本次私有数据库中本实例标记的会话；不连接远端或取消其他会话。中间夹具曾遗留的自建临时集群已清理，并补未处理异常的紧急清理回归。

最终实验 **39场景/307项断言**通过；另有真实 **300018ms** 合成任务、**297次心跳**、最大间隔**1017ms**，同一attempt、queue无重试、一次模拟调用、一份产物。SIGTERM143、SIGINT130及异常退出1均是预期注入结果，所属子进程/进程组/runner PID、数据库、临时目录全部清理。最终9项源码指纹匹配，见[汇总](research/evidence/2026-10-16-t05-supervision/verification.json)和[独立复审](research/evidence/2026-10-16-t05-supervision/review-final.md)。原19/167及中间失败文件属于历史，不能代替最终结果。

本轮项目verify再次通过：Web75套/702项、类型/lint、175页构建；shared4套/16项、infra7项。原next-env、根/Web manifest、根与实验lockfile保持本批开始时内容。没有接真实Storage、故事发布或供应商；合成等待不证明长音频解码、生产托管或G1真机通过。G0/G1及审计仍未过，未提交、未推送、未部署。

### 依赖审计兼容修复（10月15日历史；16日已补复审）

完成[依赖修复记录](research/2026-10-15-dependency-audit-remediation.md)和[实施计划](superpowers/plans/2026-10-15-upgrade-dependency-audit.md)。修改根/ Web package manifest 与根 lockfile：Next 和 eslint-config-next 统一为 16.4.1，sharp 统一为 0.35.5，Sentry 保持 10 系列升级到 10.76.2，Handlebars 升至 4.7.10；Web PostCSS 下限提高到 8.5.23，所有保留副本均高于当前受影响上限。清除了间接 peer 曾保留的旧 Next/sharp 副本，没有改应用业务代码或隔离 T05 package/lockfile。

干净 `npm ci` 成功安装 1416 个包；`npm run verify` 退出 0，Web **75 套 / 702 项**、类型/lint 和 **175 页**构建通过；shared **4 套 / 16 项**、infra **7 项**通过。新增本地运行验证 **18 项**通过：真实 JPEG/PNG/GIF/WebP 缩略图与像素解码、损坏拒绝、三语言页面/登录页、locale 跳转、AI 配置健康响应和未登录资产拒绝，以及 Chromium 页面运行/CSS。外部浏览器请求被阻断，未读写真实家庭或 Storage。证据见[验证汇总](research/evidence/2026-10-15-dependency-audit/verification.json)。

10月15日审计从 **59 项（17 moderate / 40 high / 2 critical）降到 42 项（8 moderate / 34 high / 0 critical）**；实际 `npm run audit:high` 仍退出 1。剩余 high 条目均包含当前无已发布补丁的 braces 链；另外保留旧 postcss-selector-parser、sprintf-js 相关 moderate 链。没有降级、跨大版本 override、强制修复或降低审计门槛。此结果不是 GitHub CI 已恢复的证明。

10月16日已补齐[独立复审](research/2026-10-16-dependency-review-followup.md)。发现的运行脚本启动失败保留旧成功JSON的P2已修复，4项启动回归及18项实际运行检查通过，增量复审关闭问题。两份旧JSON保持原样，旧脚本另存用于核对历史哈希；新执行记录绑定已修复脚本。当前审计再次确认42项（34high/8moderate/0critical）；没有修改依赖或降低门槛。此前工具错误只记为失败派发，不再列为独立复审阻塞。

### P0/T00/T01 与媒体入口前置批

已完成本地真实失败行为、响应校验、录音结果隔离、媒体签名回放、ASR 对象授权、图片上传认证/原件保留，以及 T01 两入口 HTML 原型和观察脚本。

媒体入口批的历史验证：58 套 / 488 项 Web 测试，类型、lint、shared/web build 通过。详细边界见[媒体入口记录](research/2026-10-13-media-access-implementation.md)。

T01 原型位于 `docs/prototypes/2026-10-13-two-entry/index.html`，只使用虚构材料，不连真实存储、录音或 AI。浏览器演示 85 步、7 次预期拒绝；真实家庭观察仍为 0 户。

### T02 资产本地批

新增/修改的主要文件：

- `packages/web/src/lib/media-assets.ts`
- `packages/web/src/lib/legacy-media-reference.ts`
- `packages/web/src/lib/server/media-asset-verifier.ts`
- `packages/web/src/lib/server/media-export.ts`
- `packages/web/src/app/api/media/assets/route.ts`
- `packages/web/src/app/api/media/assets/[assetId]/complete/route.ts`
- `packages/web/src/app/api/media/assets/[assetId]/access/route.ts`
- `packages/web/src/app/api/projects/[id]/export/route.ts`
- 对应 `__tests__` 文件

已实现的本地契约：

- 服务端生成 bucket/key；客户端不能提交 bucket、state、sha256。
- 可选 `storyId` 必须存在且属于 `projectId`，合法值写入 `story_id`。
- 无幂等键使用 SQL `NULL` 语义，不以空字符串代替 NULL。
- 图片完整校验后进入 `ready`；音频完成确认后暂留 `verifying`，等待 T04 解码能力正式接入；本轮本地解码器尚未接该路由。
- 缺件、大小不符、SHA-256 不符、错误 MIME 或非 ready 资产不能访问/导出。
- 导出前重新读取原件，校验字节数和 SHA-256，再写入 ZIP 与 `manifest.json`。
- 资产 API 和导出仅在 `MEDIA_ASSETS_ENABLED=true` 时触发拟议 `media_assets` 表；默认关闭。

T02 定向测试：7 套 / 42 项通过。最近全量验证时 Web 为 66 套 / 569 项；测试数量包含本轮 T05 合同扩展。

T02 尚未做：`media_assets`/`legacy_media_references` 迁移、旧对象映射回填、正式录音/删除切换、远端对象盘点、RLS/备份核对。

### T05 任务状态本地批

新增：

- `packages/web/src/lib/server/processing-jobs.ts`
- `packages/web/src/lib/server/__tests__/processing-jobs.test.ts`
- [T05 实施计划](superpowers/plans/2026-10-13-upgrade-t05-jobs.md)
- [T05 本地记录](research/2026-10-13-t05-processing-jobs-local-implementation.md)

纯函数已固定：

- 主路径：`queued → leased → running → succeeded`。
- 可恢复分支：`retry_wait`、`outcome_unknown`、`awaiting_review`、`failed`、`cancelled`。
- 幂等键覆盖项目、资产、输入版本、任务类型、处理器、模型配置和参数版本。
- due 检查、租约领取、attempt 递增、最大尝试次数。
- 领取前租约过期进入 `retry_wait`；运行中租约过期进入 `outcome_unknown`，默认禁止盲目重试。
- 重试耗尽进入 `failed`；取消清除租约并拒绝迟到完成；成功完成要求非空 `resultRef` 且只能一次。

T05 定向测试：1 套 / 39 项通过。全量 Web：66 套 / 569 项通过。类型、lint、`git diff --check` 通过；`npm run verify` 退出 0，Next 生成 175 个页面。

本轮又固定了严格幂等输入、删除/取消阻断、运行中人工复核与跨天批准、未知结果的显式受控重试和输入快照不可变。批准保留尝试次数，不把它当作新阶段；删除时间是未来服务端授权查询投影，不证明数据库字段已部署。

T05 正式数据库 adapter、`processing_jobs`/`processing_attempts` 表、保存入口事务入队、部署/自动监督、租约心跳、真实供应商请求 ID/账单仍未完成。10月15日已补本地 PostgreSQL/pg-boss 与独立进程故障验证，见下节；不可把隔离实验写成生产接入。

### T05 持久队列与独立进程续批

新增 [PoC 实施记录](research/2026-10-15-t05-durable-worker-poc.md)、[实施计划](superpowers/plans/2026-10-15-upgrade-t05-durable-worker-poc.md)和 `experiments/t05-durable-worker/` 独立 package/lockfile、store、worker、verify、README。使用 Node 22.22.2、PostgreSQL 14.17、pg-boss 12.37.1、pg 8.16.3；复用应用状态函数，根应用依赖没有改变。

本地已实测事务入队回滚/提交、并发重复投递、leased/provider/before_commit 三处 SIGKILL、旧 Worker 迟到、提交期间过期、queue retryCount 确认隔离、跨天批准结果复用和撤权后拒绝发布。租约恢复区分“尚未调用”和“调用结果未知”；unknown 不自动重发。独立审查发现行锁等待后的时钟更新和失败 fork 清理问题，已修复并补充真实行锁竞争和 fork 失败回归；复审新增的嵌套数据库清理问题通过简化为单集群解决。基础 PoC 为13个场景 / 125项断言；续批加入心跳与未知结果核对后，隔离实验为19个场景 / 167项断言，证据见 [results.json](research/evidence/2026-10-15-t05-worker/results.json)。这仍是合成账本和本地短任务实验，不是生产 Worker/供应商资格。

证据见 [results.json](research/evidence/2026-10-15-t05-worker/results.json)。数据库仅为本次专属 Unix socket 临时集群；测试结束停止并清理。跨天使用显式逻辑时间推进 24 小时，模拟调用账本不等于真实请求/费用。实验结果引用不等于故事或云端文件交付。

生产 schema/adapter、长任务心跳、自动监督/托管、权限/用途同意/墓碑投影、真实 Storage/故事写回及供应商资格仍缺。G0/G1 仍未完成，本轮未提交或推送 GitHub。条件推送授权继续有效，不需下轮重复询问。

### T03 权限、用途同意与删除本地批

新增：

- `packages/web/src/lib/server/consent-deletion.ts`
- `packages/web/src/lib/server/__tests__/consent-deletion.test.ts`
- [T03 实施计划](superpowers/plans/2026-10-14-upgrade-t03-consent-deletion.md)
- [T03 本地记录](research/2026-10-14-t03-consent-deletion-local-implementation.md)

纯函数已固定：

- active 成员读取、facilitator/owner 管理、storyteller 本人故事动作和删除/分享的角色边界；未知角色、撤权和删除阻断默认拒绝。
- 用途同意必须匹配主体、用途、策略版本、供应商、区域和时间；撤回在时间点生效。
- 删除请求创建即产生墓碑；失败保留墓碑并可重试；所有目标确认删除或不存在后才完成；恢复后重新应用墓碑。

T03 定向测试：1 套 / 12 项通过。数据库 adapter、同意/删除迁移、直接 Storage RLS、备份恢复和正式路由接入仍未完成。

### T04 录音会话与本地恢复批

新增：

- `packages/web/src/lib/recording-session.ts`
- `packages/web/src/lib/recorder-db.ts`（IndexedDB v2）
- `packages/web/src/lib/__tests__/recording-session.test.ts`
- [T04 实施计划](superpowers/plans/2026-10-14-upgrade-t04-recording-session.md)
- [T04 本地记录](research/2026-10-14-t04-recording-session-local-implementation.md)

已固定 MIME 支持选择、项目/用户绑定、数字块顺序、字节数和 SHA-256 校验、先持久化后上传、中断恢复以及完整确认前保留本地副本。IndexedDB v2 新增 `sessions` store 并保留旧 `chunks` 数据和 SmartRecorder 兼容方法。

T04 定向测试：1 套 / 7 项通过。后续 SmartRecorder 入口续批和恢复预览已完成，恢复批为 3 套 / 45 项；前批服务端合并契约新增 1 套 / 9 项，本轮执行器/解码器再新增 2 套 / 41 项；最新全量 Web：75 套 / 702 项通过；类型、lint、`git diff --check` 和 `npm run verify` 通过，Next 生成 175 个页面。

T04 尚未做：服务端录音会话封口/数据库 adapter、断点上传对账、真实 Storage 读写和上传后回读验证、T05 Worker 接入、完整确认后的清理、真机锁屏/来电/进程退出/跨设备恢复矩阵。本地流式合并及 FFmpeg 实际解码已完成；桌面 Chromium 也已对短虚构 WebM 做解码/回放，两类本地证据都不替代 G1 设备证据。构建仍提示缺少 `SUPABASE_SERVICE_ROLE_KEY` 和既有 Next 配置警告；不能作为生产配置或远端 schema 证据。

### T04 服务端合并契约本地续批

新增[服务端合并契约记录](research/2026-10-15-t04-server-merge-contract-local.md)和 `packages/web/src/lib/server/recording-merge.ts`：未来 T05 合并任务输入必须绑定项目、会话、目标资产、实际 MIME、处理器/参数版本及从 0 连续的确切块清单；幂等键包含规范化块摘要。完整确认只在实际解码、正时长/大小、输出 SHA-256、身份和块证据全部匹配时返回 `ready`。本地定向 1 套 / 9 项通过；这不是数据库、Storage、Worker 或 FFmpeg 已部署的证明。

### T04 本地流式合并与实际解码续批

新增[本轮实施记录](research/2026-10-15-t04-local-merge-execution.md)、[实施计划](superpowers/plans/2026-10-15-upgrade-t04-local-merge-execution.md)与[G1 真机 runbook](research/2026-10-15-t04-g1-device-runbook.md)。新增代码：

- `packages/web/src/lib/server/recording-merge-executor.ts`
- `packages/web/src/lib/server/recording-audio-decoder.ts`
- 对应两份 `__tests__` 文件
- `scripts/verify-recording-merge.cjs`

已实现可信任务快照校验、按序读流、逐块字节数/SHA-256、原件流式写入和失败清理。FFmpeg 实际解码受超时/时长/诊断量限制；固定容器与已声明编码，拒绝不符格式/编码及额外视频等轨道。完整解码后才生成完成证据供本地消费，消费结束清理临时文件；不清理源块，不写云端 ready，不改变旧保存流程。

真实 FFmpeg 集成 **56 项检查通过**，五种 2 秒虚构 fixture（WebM/Opus、普通 MP4、带 AAC MIME 参数的 MP4、分段 MP4、Ogg/Opus），每份 13 块、逐字节原件对照；包含损坏、缺件、错误容器/编码/额外视频、输入/时长超限反例。证据见 [results.json](research/evidence/2026-10-15-t04-merge/results.json)。新增执行器 20 项与解码器 21 项 Jest 回归；全量结果见下节。

独立审查的读流句柄释放 P2 已通过失败回归、修复和增量复审关闭；没有把该审查写成历史全部工作树审查。

本机系统 FFmpeg 8.0.1 缺动态库；本轮使用已存在的独立 FFmpeg 7.1，源码/运行时指纹已留存，没有改系统或依赖。该二进制不作为生产分发选择。未来须配置合格 runtime 和 OS 资源/网络/文件系统隔离；当前进程限额不等于沙箱。

`readChunk` 只是可注入端口，目前实测用虚构本地流。真实 adapter 仍须鉴权、读取超时/取消、冻结版本、封口清单、输出上传与回读、写回时重查墓碑/租约/权限并原子提交。解码成功不能证明结尾未丢失。真机 runbook 仅准备，实际 G1 矩阵仍未执行。

### T04 SmartRecorder 本地入口续批

已完成实际 MIME/登录用户会话、真实块哈希、先落盘后上传、补传保留副本、停止等待末块和项目/账号/重录代次隔离。新增 `local-recording-session.ts`；临时块上传在 StorageService 核对当前认证用户。另修复唤醒锁释放/重复可见性/取消期间晚到锁/浏览器主动释放的生命周期竞态。定向回归 1 套 / 24 项通过；最新全量验证和审查状态见[续批记录](research/2026-10-14-t04-smart-recorder-local-integration.md)。

`interrupted` 在现有三态模型中包含“正常停止但尚未云端确认”。既有录音完成回调仍通往旧审阅/保存流程；没有调用 T04 confirmed，没有删除本地块，也没有保证录音尾部完整。新增[恢复预览与浏览器记录](research/2026-10-15-t04-recovery-preview-browser.md)：恢复 UI 只读取当前项目/账号的未确认草稿，校验连续块/大小/SHA-256，提供回听和本机下载，不自动上传、确认、清理或续录。

## 当前验证结果

邀请管理批的原执行时间为 **2026-10-21 23:01:19—23:04:58 Asia/Taipei**：[项目验证](research/evidence/2026-10-21-invitation-management/project-verification.json)记录五命令exit0、定向5/54、Web105/1420、shared4/16、infra7、180页及796输入未变/next-env恢复。SQL于同日22:47:16—22:47:23执行16场景/2448断言；22:49:45—22:49:59完成四生命周期。**2026-10-22 09:18:25**的[恢复核验](research/evidence/2026-10-21-invitation-management/resume-integrity-20261022T011825076698Z.json)只读确认796应用输入、19本批源码、986保护输入、774 SQL/runtime输入、38原始/公开日志、17引用报告/最终日志及Node/清单/next-env一致；未重跑测试。实现复审Approved；10月22日[文档审查](research/evidence/2026-10-21-invitation-management/task-3-review.md)与[整批审查](research/evidence/2026-10-21-invitation-management/batch-final-review.md)均PASS／Approved，零待修项；[最终完整性](research/evidence/2026-10-21-invitation-management/final-integrity-20261022T110637+0800.json)通过。两项收尾审查由同一位独立审查员完成，不是两份相互独立的意见；首次文档审查任务无报告，未计入结论。

以下邀请发送 HTTP 结果属于前批历史：

前批邀请发送 HTTP 批：控制器于 **2026-10-21 10:25:37—10:29:36 Asia/Taipei** 新执行[项目矩阵](research/evidence/2026-10-21-invitation-sender-http/project-verification-20261021T022537Z-f5820706-f190-44bf-9100-8aa7dfc5b528.json)：verify/shared/infra均exit 0，Web **101套/1373项**、shared **4套/16项**、infra **7项**、**178页**；785输入不变，next-env恢复。冻结源码定向[17套/521项](research/evidence/2026-10-21-invitation-sender-http/19-frozen-targeted-green.log.txt)、类型与范围lint通过。独立规格PASS，质量Approved；文档独立审查PASS／Approved，整批审查PASS，本批本地收尾完成。813个前批源码/依赖/Node/PG指纹、129个保护输入及975个旧实验/证据/依赖文件匹配，不重跑旧SQL矩阵。历史audit42项未重跑未解决；旧Next配置和缺服务端key诊断仍在，构建成功不等于生产配置合格。

以下为认证会话及更早批次的历史验证，不能替代当前源码证据：

认证会话衔接最终以[fix2的21路径冻结](research/evidence/2026-10-19-auth-session-integration/fix2/source-freeze-fix2.json)为准：[定向日志](research/evidence/2026-10-19-auth-session-integration/fix2/focused-final.log.txt)28套/605项覆盖认证、邀请和相关录音回归；[Chromium结果](research/evidence/2026-10-19-auth-session-integration/fix2/browser-results.json)14项通过。浏览器为实际facade/store/SDK、callback/guard的合成桥；页面组件另有回归，不能称完整Next部署或真实提供方端到端。原始RED、中间harness失败、两轮修复前结果和预期负例401均保留，详见[证据索引](research/evidence/2026-10-19-auth-session-integration/README.md)。

控制器在 **2026-10-19 20:37:31—20:40:22 Asia/Taipei** 对最终源码新执行[完整项目矩阵](research/evidence/2026-10-19-auth-session-integration/project-verification-20261019T123731Z.json)：verify/shared/infra均exit 0，Web **96套/1278项**、shared **4套/16项**、infra **7项**、**176页**；773输入未变、next-env恢复。Task 1规格复审PASS、质量复审Approved且无新规格问题；文档独立审查、整批独立审查与最终完整性均已通过。构建仍出现旧Next `eslint`配置、`images.domains`弃用和缺少`SUPABASE_SERVICE_ROLE_KEY`的configuration-validation诊断；成功退出不等于生产配置合格。前批认证回跳430项/Web85/1196及其审查保持日期历史，不作当前源码证明。

以下是 **2026-10-19 11:06前批只读/UI的历史验证**，不作当前认证源码证明：

前批[只读兼容与恢复UI验证](research/evidence/2026-10-19-invitation-read-ui/verification.json)：最终定向 **253/253**，其中18项新读取路由使用实际SDK与合成loopback，41项React行为通过真实helper/parser与mock fetch验证，另194项是本次重跑的既有protocol/client/acceptance回归。初审I1证明同一React batch离开/返回同账号可接纳旧结果；保留2 failed的RED，身份代次修复后3项GREEN及[限定复审Approved](research/evidence/2026-10-19-invitation-read-ui/task-1-fix-1-review.md)。初次250项/1016项通过与原审查均为修复前历史，不当当前证明。

控制器于 **2026-10-19 10:38:22—10:40:45 Asia/Taipei** 在固定源码后新执行[完整矩阵](research/evidence/2026-10-19-invitation-read-ui/project-verification-20261019T023821Z.json)：verify、shared、infra均退出0，Web **82套/1019项**、shared **4套/16项**、infra **7项**、**176页**；751输入未变，next-env恢复起点字节。实际SDK/React合成边界不证明真实JWT/PostgREST/PG17或生产权限。Task 2文档独立审查、整批独立审查及最终完整性均已通过。缺服务端key及旧Next配置警告仍在，初审M1作为独立清理项保留；构建成功不是生产配置验收。

以下为前批邀请事务与其应用复用证据，保留原执行归属：

邀请事务原始最终正常/污染PG17运行各 **158场景/2,288断言、33实际并发场景、282完整状态核对**，协议 **18/18**，4类生命周期观察通过；子进程预期退出0/143/1/1并全部清理。最终24个直接输入、44个加载依赖/package、743个PG文件、Node/pins及27份原实现证据哈希相同，本次续接未重跑已完成矩阵。Task 1独立规格PASS、质量Approved；Task 2独立审查PASS/Approved；整批独立审查已PASS，见[当前汇总](research/evidence/2026-10-18-invitation-transactions/verification.json)。

应用结果复用前批RPC权限控制器在 **2026-10-18 12:24:38.969365—12:26:48.304226 Asia/Taipei**的实际执行，见[本批复用记录](research/evidence/2026-10-18-invitation-transactions/project-checks.json)。`npm run verify`、shared、infra均退出0，Web **77套/766项**、shared **4套/16项**、infra **7项**、类型/lint及 **175页**构建通过。本次重新核对707个应用输入、3份日志及next-env起点字节，均未变；这是前批执行证据复用，不是本批新运行或生产配置验收。

邀请事务批应用、旧实验/运行时、依赖、根迁移和历史证据保持起点内容；仅新增实验/本批文档证据并更新五份授权交接文档。新候选已具有token、合成确认邮箱、持久预留/映射与请求去重；正式生产身份、可信付款来源及UI/API adapter仍未接入。原RPC、直接表及旧入口旁路需正式收紧或停用，详见[本批边界与下一步](research/2026-10-18-invitation-transactions.md)。缺服务端Supabase配置、旧Next配置等构建提示仍在。前批RPC权限的规格澄清/原审计哈希属于前批历史记录，原样保留。

依赖未变且未重跑audit；沿用前批`npm run audit:high -- --json`实际退出1，**42项：34high/8moderate/0critical**，见[前批审计](research/evidence/2026-10-17-rls-rehearsal/audit-high.json)。

## 已知阻塞与不可假设的事实

RB1分两层记录：**本地PKCE/cookie根因修复、OTP及store/guard合成集成已完成**；**真实提供方与部署资格仍阻塞发布**。浏览器`detectSessionInUrl=false`，既有callback继续唯一自动code兑换；旧localStorage认证key只删不读，localStorage-only用户重新登录。旧fragment-only/畸形callback不恢复，精确单一裸`?type=invite`且无其他query/fragment仅保留原链接指引。安全next、八语言、丢next回dashboard和strict signin/callback边界保留。真实Google/SMTP、完整Next域名/cookie部署、JWT/RLS/PostgREST、全站日志仍分别待验收。可信pending/最小预览与历史opaque token/member映射仍缺，不猜测或恢复旧旁路。

已补齐：实际schema字段/约束/索引/RLS及迁移版本，详见[10月17日差异](research/2026-10-17-remote-metadata-reconciliation.md)。不再重复被42501拒绝的CLI登录角色初始化，继续用已有metadata_reader。表和字段必须读pg_catalog；现有information_schema包装视图为0/0是可见性过滤。只读账户的43个关系表级/列级读取和写入权限均未授予；未据此推断所有函数路径也安全。

当前必须处理：Storage/直接表权限差异、已确认的RPC身份/付款/假成功与依赖缺口、7个未登记迁移及邀请RPC契约对账。12个非trigger SECURITY DEFINER及唯一相关更新时间触发函数已审并在原生PG17重放；这不包含完整Supabase认证/角色继承/生产RLS/扩展环境，旧RLS和来源事务矩阵现已按明确阶段在PG17运行，最终seed组合全部候选；生产Storage/JWT及历史归属变更矩阵在RLS身份保护下的行为不在该证明范围。三参购买实际抛P0001并被限定模式分类为歧义，三参导出才是直接42702；不能把前者写成成功支付。jsonb[]/CHECK与来源事务已有本地证据；历史metadata_reader读取bucket为42501，现已由用户A/B/C补齐精确配置、enum及函数指纹；对象盘点、备份恢复/回退、供应商账户条件、正式adapter和真机验收仍缺。仅看到bucket策略不能推定bucket存在/private或文件限制。迁移版本未登记不能推定对应SQL未执行。

10月15日Supabase项目身份/区域和GitHub运行记录仍仅为当日证据；10月23日用户已回传Vercel域名/基线commit/九项变量范围和Google/SMTP状态，见顶部部署记录；没有独立刷新实际alias、部署ID或读取变量值。无隔离项目已确认，网址配置/真实登录与恢复环境仍待验收。未取得四类旧env键不妨碍当前专用只读账户可用，不再以它们缺失为schema访问阻塞。

## 下一步执行顺序

### 下一步：完整Storage行为与正式媒体/删除adapter

0. 先读[10月23日差距/实现记录](research/2026-10-23-p0-gap-and-storage-audit.md)、[本批汇总](research/evidence/2026-10-23-storage-definition-capture/verification.json)和[精确定义语义审查](research/evidence/2026-10-23-storage-definition-capture/semantic-audit.md)。六函数/七触发器正文及静态审查、本地旧删除阻断已完成；不要重复采集或重新开放旧删除。下一轮按该审查中的GUC/角色/生命周期/更新时间边界建立隔离回归，随后将正式资产/Storage/删除adapter与迁移回退顺序落为可执行规格。

1. [邀请管理批](research/evidence/2026-10-21-invitation-management/verification.json)的实现、文档/整批审查及最终完整性已完成；无需重新收尾。10月21日原始运行与10月22日恢复核验分开保留，有具体新问题才定向修复、复测和复审。
2. [PG17和已审依赖下的旧RLS/来源账本组合](superpowers/plans/2026-10-22-upgrade-pg17-rls-source-composition.md)本地实现、实测及独立审查完成；[当前汇总](research/evidence/2026-10-22-pg17-rls-source-composition/verification.json)和[最终完整性](research/evidence/2026-10-22-pg17-rls-source-composition/final-integrity-5d5d3a4a-93f7-4918-a7cd-e0065d14974d.json)记录收尾依据。下一项设计正式资产/Storage/删除 adapter 与旧.remove()兼容。可信来源/历史管理与最小票据恢复已本地完成；历史 opaque token/member 映射及表单正文恢复不在该完成范围。
3. 真实事件签名、账户/商品映射、writer角色、Auth/JWT/PostgREST/RLS/Storage及Google/SMTP/部署cookie资格另验。七个旧写RPC和表列ACL只在本地候选中关闭，正式应用其他依赖、历史opaque token/member映射、七个未登记迁移的语义对账、前向/回退仍缺。导出候选的Worker/交付再授权和实际文件不由成员停用替代；不运行repair或重放bootstrap。

4. A/B/C/D及本轮限定函数正文、触发器参数/条件均已取得并审查。Free Backups未开启，音视频无独立副本、图片副本未单独确认；[恢复方案](research/2026-10-23-p0-gap-and-storage-audit.md)已写明冻结点、独立媒体副本、墓碑与隔离恢复次序，受控位置/容量/预算和真实恢复仍未落实。结构/hash不等于历史等价，配置不证明对象完整或私密权限通过；真实对象盘点和影子读取只按另行核准的最小字段范围执行。
5. 正式 adapter 须把实际对象核查、动作/用途同意、摘要版本和提交边界一并集成；来源账本仍是受信实验 adapter。生产资格与上述本地组合分别验收。
6. T05物理GC可作独立本地后续：只处理已quarantined候选，保留reserved/publishing/未知提交、原始块和已引用输出，不按TTL删除。供应商、依赖审计及G1真机保持独立待办；达到原计划里程碑才推送。

### T04 后续：服务端封口/adapter 与 G1，不接生产

1. 先读[真实Worker接入记录](research/2026-10-16-t04-t05-local-merge.md)，再读[本地合并/解码记录](research/2026-10-15-t04-local-merge-execution.md)和[G1 runbook](research/2026-10-15-t04-g1-device-runbook.md)；不重复已完成的恢复 UI、短音频合并/解码演练。
2. 远端 schema/Storage/RLS 只读证据齐备后，先比较迁移历史，再设计会话封口、有序块清单和幂等写入 adapter；不执行生产迁移。封口必须核对末块/清单版本，不能仅凭可播放确认完整。
3. 本地真实文件adapter与事务测试已接通；正式Storage接入仍需真实、限时且可取消的读流。输出只写一次并回读核对 SHA-256/大小，写回前重查权限、删除墓碑、租约和输入版本，以事务提交资产/任务引用。没有证据前不要接旧正式保存入口。
4. 独立 Worker 部署前固定 FFmpeg 来源/版本/许可与资源隔离，并将已通过的 T05 故障 harness 接入正式 adapter，再验证重复投递、进程退出、取消/撤权后迟到结果；现有隔离实验不替代真实 Storage/业务写回。
5. 按 G1 runbook 在真实设备执行 5/20/30 分钟及故障矩阵；暂无设备或 adapter 的项目保持未执行/blocked，不从本地测试推断通过。
6. 继续保留本地草稿；云端完整确认与清理事务接通前，不调用客户端 confirmed，不删除恢复块。每批同步实施记录、主计划和 handoff。

### 正式迁移与adapter前

1. schema/history/RLS及函数/触发器结构/ACL已保存；Storage bucket配置、enum及六函数/七触发器正文与静态语义本轮均已补齐。下一步验证完整依赖下的行为和历史等价；当前角色成员图、服务GUC设置及真实Storage HTTP仍未捕获或验收。
2. 与 bootstrap、根 migrations、P1 契约逐项对照，记录冲突；不要先写迁移。
3. 只读盘点对象的 bucket/key/大小/更新时间/metadata/hash/可推断归属，不读家庭正文。
4. 在测试项目用虚构素材做影子读取和导出校验。
5. 再决定 `media_assets`、`legacy_media_references`、`processing_jobs`、`processing_attempts` 的迁移文件和回填顺序。

### 后续任务顺序

保持主计划顺序：`T02 → T05 → T03 → T04`。T03 的本地纯函数契约已先完成，正式 adapter 仍依赖远端证据。

- T03：动作权限、用途同意、删除请求/墓碑、派生数据和恢复重放；依赖 T02/T05 证据。
- T04：IndexedDB 会话/块持久化、格式探测、上传恢复、服务端合并与完整确认；依赖 T02/T05/T03/T01。
- T09：完整原件/照片/文字/manifest/PDF 交付；当前导出只是基础资产分支，不能宣称完整成品。

## 重要代码边界

- `requireProjectAccess` 当前按 `projects.facilitator_id` 或 active `project_roles` 检查；不要用客户端 owner 字段或路径前缀授权。
- 旧 `stories.audio_url`、`images` JSON、`audio-recordings/stories/<basename>` 不是资产身份；必须保留确切 bucket/key 并显式映射。
- 现有 `agent-store.ts` 与编辑器路由仍是 HTTP 内处理，不能称为持久 Worker。
- 直接 Storage RLS、已签发短链在 TTL 内的即时撤销、物理删除、供应商用途同意和备份删除都未被本地 API 测试证明。
- 原型中的保存/恢复/处理全部是内存演示，不连接真实系统。

## 工作树处理

当前工作树同时包含前序 T00、媒体入口、T01 文档/原型、T02 资产、T05 helper 和大量文档变更。新会话应：

1. 先 `git status --short`；
2. 不做整体 reset/checkout/clean；
3. 修改前读取目标文件与对应测试；
4. 只报告自己本轮新增/修改的文件，避免把全部工作树误归因于当前批次；
5. 完成验证后恢复 `next-env.d.ts` 并运行 `git diff --check`。

## 交接完成标准

新会话在继续实现前应能回答：

- 当前分支、基线 commit 和未提交状态是什么；
- T02/T05 哪些已在本地通过，哪些仍未接入真实系统；
- 为什么现在不能创建/执行远端迁移；
- 下一步是纯契约测试还是需要用户提供远端只读凭据；
- 哪些文档是计划，哪些是本地证据，哪些不能当生产事实。

完成任何新批次后，更新本 handoff 或新增对应实施记录，并把测试数量、构建限制和未完成边界写清楚。

## 2026-10-17 Supabase 元数据只读访问

已在远端项目 `encdblxyxztvfxotfuyh` 创建 `metadata_reader` 角色，并仅授予 `audit_meta` 下的 schema、columns、RLS policies、indexes、constraints、migration metadata 视图读取权限。业务表读取与 DDL 均验证为拒绝。证据见 [Supabase 元数据只读记录](research/2026-10-17-supabase-metadata-readonly.md) 与 [JSON](research/evidence/2026-10-17-supabase-metadata-readonly.json)。本地连接凭据保存在 `supabase/.temp/metadata-reader-credentials`；本批已把它与password文件精确加入.gitignore，未入索引。上文为配置会话的历史拒绝测试，本轮仅做只读元数据采集。


同日后续：已补[函数/触发器/ACL元数据](research/2026-10-17-metadata-supplement.md)。metadata_reader在public具有USAGE及函数EXECUTE，不能把原表级拒绝扩写成所有函数访问路径已拒绝；本批仍只运行固定只读采集，不调用业务函数。

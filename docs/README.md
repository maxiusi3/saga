# UR Saga 项目文档索引

更新：2026-10-24（Asia/Taipei）。当前决策为负责人“D03=A，其他按照推荐”：**D01–D16全部A，一名主要开发者，高质量优先，约24–34周。** 决策已确认；产品实施和G0–G4验收分别跟踪。

## 当前执行入口

最新：[P1可靠资料底座与G1里程碑集成验证报告](research/2026-10-24-p1-g1-verification.md)。完成正式 SQL 迁移 `20261024000001_p1_foundation_and_reconciliation.sql`（9 张 P1 核心表 + 7 份未登记根迁移幂等收敛 + RLS/最小权限函数）、T02 原件校验与无外链自包含 HTML 导出、T03 删除墓碑与立即访问屏蔽、T04/T05 持久录音封口与幂等归并任务，并在本地 PG17.4 完成 G1 端到端验证（4 场景/61 断言通过：5/20/30 分钟录音故障矩阵、跨家庭与被撤权成员隔离、删除墓碑实时屏蔽与方案 B `pg_restore` 墓碑防复活重放）。**至此 P0/G0 与 P1/G1 均已达成（`G0 = true`、`G1 = true`），下一阶段进入 P2（`T06 → T07 → T08` → G2）。** 详见[G1里程碑判定](research/evidence/2026-10-24-p1-g1-verification/milestone-check.json)与[handoff](HANDOFF-2026-10-13-upgrade.md)。

同日第一阶段收口：[Storage行为预演与7份未登记根迁移对账](research/2026-10-24-storage-behavior-and-migrations.md)。在本地 PG17.4 重放私有捕获的 6 个 `storage` 函数与 7 个触发器（RED 4/53、GREEN 22/974、生命周期 4 例，规格 PASS/质量 Approved），完成 7 份未登记根迁移逐项对账，并在本地 PG17.4 完成负责人确认的 **方案 B**（`pg_dump -Fc` + 对象存储冻结清单 + 独立删除墓碑重放 + `pg_restore`）与五步幂等前向收敛 SQL 演练（5 场景/47 断言通过）；供应商样本探针与耗时/账单测算按负责人决策推迟至 P2 `T06` 前（`deferred_by_user`）。**至此 §7.1 的 G0 里程碑与 P0 修复已全部达成（`G0 = true`、`p0Complete = true`），已按授权推送 `codex/october-upgrade-p0` 至 GitHub。** 详见[本批验证汇总](research/evidence/2026-10-24-storage-behavior/verification.json)、[里程碑判定](research/evidence/2026-10-24-storage-behavior/milestone-check.json)及[handoff](HANDOFF-2026-10-13-upgrade.md)。

前批：[P0差距与Storage/旧删除修复](research/2026-10-23-p0-gap-and-storage-audit.md)。六函数/七触发器真实只读采集及静态语义审查完成，旧删除调用本地关闭；Web108/1438、shared4/16、infra7与180页构建通过。范围、审查和限制见[前批汇总](research/evidence/2026-10-23-storage-definition-capture/verification.json)。

部署安排：2026-10-13负责人明确暂不部署，完成里程碑后再统一部署；2026-10-15授权达到原计划里程碑后推送 GitHub。2026-10-24 负责人授权在本地分支 `codex/october-upgrade-p0` 创建检查点提交（不推送远端）。


| 文档 | 用途 |
|---|---|
| [Storage行为预演与迁移对账报告](research/2026-10-24-storage-behavior-and-migrations.md) · [本批证据索引](research/evidence/2026-10-24-storage-behavior/README.md) | PG17 精确函数/触发器重放（22场景/974断言）、4项极端生命周期清理、7份未登记根迁移逐项对账与回滚方案、G0工程收口 |
| [Storage定义/旧删除本批证据](research/evidence/2026-10-23-storage-definition-capture/README.md) | 精确采集、语义审查、53项采集回归、34项PG17验证、18项删除回归及完整项目检查；真实HTTP/恢复未验收 |
| [PG17旧RLS/来源账本组合](research/2026-10-22-pg17-rls-source-composition.md) | 正常/污染环境各72场景、832个行为断言、236项账本检查及18条真实锁证据；六项兼容RED和四类生命周期均通过；[汇总](research/evidence/2026-10-22-pg17-rls-source-composition/verification.json)记录四项通过审查与最终封存状态 |
| [用户协作清单](research/2026-10-22-user-action-checklist.md) | Storage、迁移/备份、模型账户、部署/Auth只读步骤；真机暂缓 |
| [当前会话交接 Handoff](HANDOFF-2026-10-13-upgrade.md) | 新会话续接入口：当前分支、未提交工作树、已完成批次、验证、阻塞和下一步 |
| [已确认决策台账](2026-10-10-upgrade-decisions.md) | 16项选择、条件和原备选；D03执行A，原推荐B仅供追溯 |
| [综合升级实施计划](2026-10-10-integrated-upgrade-plan.md) | 单人排期、范围、架构、T00–T13、质量门、预算和试点 |
| [P0准备计划](superpowers/plans/2026-10-11-upgrade-p0-preparation.md) | 先建立环境/数据/供应商基线和实现规格，再推进P1 |
| [T00首批实施](superpowers/plans/2026-10-11-upgrade-t00-truthful-ai.md) | 真实AI失败、响应校验、录音审阅状态及旧结果隔离；已落代码 |
| [10月11日基线与核验](research/2026-10-11-upgrade-baseline.md) | T00运行环境、媒体路径和测试证据；后续变化见10月13日实施记录 |
| [10月13日媒体入口实施](research/2026-10-13-media-access-implementation.md) | 签名回放/ASR/图片上传的定位与权限加固，保留T00 |
| [T01两入口本地原型](prototypes/2026-10-13-two-entry/README.md) | 导入/邀请录音、失败恢复、核对与交付的状态演示；研究未执行 |
| [T01观察脚本](research/2026-10-13-t01-study-guide.md) | 6–8户研究准备、任务话术、分母与记录模板；0户已观察 |
| [T01实施与验证](research/2026-10-13-t01-prototype-implementation.md) | 本地原型完成；85步、键盘/窄屏、演示下载及独立审查证据 |
| [T05持久Worker本地验证](research/2026-10-15-t05-durable-worker-poc.md) | 隔离 PostgreSQL/pg-boss、独立进程与事务故障，13场景/125断言；真实供应商/生产 adapter 尚未接入 |
| [10月21日邀请管理／22日恢复收尾](research/2026-10-21-invitation-management.md) | 当前：可信来源、绑定历史、共享管理UI及最小票据恢复已本地实现；原测试PG17 16/2448、四生命周期、定向5/54、Web105/1420、shared4/16、infra7、180页；22日仅完整性核验、未重跑；实现/文档/整批审查Approved，最终完整性通过，本地收尾完成，见[状态](research/evidence/2026-10-21-invitation-management/verification.json) |
| [10月21日邀请发送 HTTP](research/2026-10-21-invitation-sender-http.md) | 前批：默认关闭send/release/lookup、旧入口关闭、取消严格确认；17/521及项目101/1373、shared4/16、infra7、178页通过；规格、质量、文档及整批审查完成；当时的来源选择/管理UI后续由当前批承接 |
| [10月20日可信权益事件](research/2026-10-20-trusted-entitlement-events.md) | 前批：事件/来源去重、终态撤销、邀请成员与RPC/表列ACL本地组合；95/3211、20并发、4类清理及项目96/1278通过。10月21日独立规格PASS／质量Approved，文档独立审查 PASS／Approved、整批独立审查 PASS，本批本地收尾完成；原运行结果与输入保持不变 |
| [10月19日认证会话衔接](research/2026-10-19-auth-session-integration.md) | 前批：本地PKCE/cookie、provider核实store/SSR/Bearer与OTP完成；28套/605项、Chromium14项及项目96/1278通过，Task 1规格复审PASS/质量Approved；文档独立审查、整批独立审查与最终完整性均已通过，真实提供方/部署资格开放 |
| [10月19日认证回跳安全与旧状态清理](research/2026-10-19-auth-return.md) | 历史批：安全next、auth_next只删不读、固定错误/日志与实际SDK callback；430项及项目85/1196通过，Task 1 PASS/Approved；文档/整批审查及最终完整性均已通过，当时会话衔接后续已由当前批本地实现承接 |
| [10月19日邀请只读兼容与恢复UI](research/2026-10-19-invitation-read-ui.md) | 前批：token GET只读兼容、pending暂停、两页面显式unknown恢复；253项及固定代码后项目82/1019通过，I1修复复审Approved；Task 2文档独立审查、整批独立审查及最终完整性均已通过 |
| [10月18日邀请HTTP接受与状态适配](research/2026-10-18-invitation-http-adapter.md) | 前批：默认关闭/Bearer-only、两个接受入口/facade/显式只读恢复；194项与项目80/960通过，Task 1修复复审PASS/Approved；Task 2独立审查PASS/Approved；整批审查及最终完整性已通过，M1已关闭 |
| [10月18日邀请token与持久席位事务](research/2026-10-18-invitation-transactions.md) | 前批：隔离send/accept/release/查询、持久预留与绑定；158/2,288、33并发、协议18/18和4类清理，Task 1独立PASS/Approved；Task 2独立审查PASS/Approved；整批独立审查已PASS |
| [10月18日RPC邀请/项目权限候选](research/2026-10-18-rpc-access-guards.md) | 前批：原签名本人/资源事务候选，修复后117场景1834断言、26锁等待及4类清理；任务及整批独立审查PASS，未部署 |
| [10月18日邀请兼容核查](research/2026-10-18-invitation-compatibility.md) | 五处调用、固定表/约束及未来token/确认邮箱/持久预留边界；独立审查PASS，正式适配未实现 |
| [10月18日PG17依赖与导出请求](research/2026-10-18-pg17-routines.md) | 前批：受限触发采集69项、原生17.4的12原RPC与7表依赖、两重载持久请求候选141场景874断言、4类清理及规格/代码/整批复核PASS，生产未改 |
| [10月17日RPC定义与通知权限](research/2026-10-17-routine-audit.md) | 前批：12个真实定义/13处调用核对，52项采集器验证；通知精确重放及本人授权候选19场景181断言、独立审查PASS，生产未改 |
| [10月17日T02来源账本与绑定](research/2026-10-17-t02-source-ledger.md) | 前批：完整来源版本/移除历史、不可变绑定、290项/18锁证据，初审P2修复与复核PASS；正式adapter未接 |
| [10月17日函数/触发器/ACL补核](research/2026-10-17-metadata-supplement.md) | 采集器P2修复、23项及复核；真实39函数/21触发器，邀请RPC差异/函数授权语义待核，bucket仍拒绝 |
| [10月17日T02来源投影与兼容](research/2026-10-17-t02-legacy-mapping.md) | 前批：旧URL修复、逐字段/数组来源、2套40项和真实DB19项；宿主环境P2复核已补齐 |
| [10月17日RLS审查修复](research/2026-10-17-rls-review-followup.md) | 修复Unicode边界、分配中断竞态及宿主PG环境影响；63场景351断言和6类清理，增量复核见汇总 |
| [10月17日RLS隔离演练](research/2026-10-17-rls-rehearsal.md) | 前批32条策略复现，61场景/199断言；后续审查/修复见上项，线上权限未改 |
| [10月17日远端元数据与迁移差异](research/2026-10-17-remote-metadata-reconciliation.md) | 只读前批：schema/history/RLS已取得；Storage隔离、历史缺口与字段兼容需修复，bucket/备份仍缺 |
| [T05私有输出候选与发布互斥](research/2026-10-16-t05-output-candidates.md) | 创建前持久登记、发布意图与隔离声明，45场景/277断言及独立审查通过；尚无物理GC |
| [T05已知错误与原子重试](research/2026-10-16-t05-merge-failures.md) | 明确prepare失败分类与有界重试；通用FFmpeg错误、准备后与未知提交继续保留 |
| [T04/T05真实本地文件接入](research/2026-10-16-t04-t05-local-merge.md) | 真实合并、FFmpeg、输出回读与受保护发布；正式Storage/会话adapter仍待接入 |
| [10月15日远端只读补核](research/2026-10-15-readiness-refresh.md) | Supabase项目与GitHub记录已取得，schema/RLS/备份仍缺，CI审计失败 |
| [T05任务状态续批计划](superpowers/plans/2026-10-13-upgrade-t05-contract-hardening.md) | 幂等输入、删除/取消阻断、人工复核与未知结果受控重试的本地契约 |
| [T03权限与删除续批计划](superpowers/plans/2026-10-14-upgrade-t03-consent-deletion.md) | 动作权限、用途同意、删除目标与恢复墓碑的本地契约 |
| [T04录音会话计划](superpowers/plans/2026-10-14-upgrade-t04-recording-session.md) | IndexedDB会话/块持久化、MIME选择和完整确认的本地契约 |
| [T04录音入口接入](research/2026-10-14-t04-smart-recorder-local-integration.md) | SmartRecorder先落盘、真实哈希、补传保留副本及生命周期隔离；服务端/真机仍待验收 |
| [T04恢复预览与浏览器证据](research/2026-10-15-t04-recovery-preview-browser.md) | 本地草稿校验、回听/下载、桌面 Chromium IndexedDB 重开与 UI 证据；G1/远端仍待验收 |
| [T04本地合并与实际解码](research/2026-10-15-t04-local-merge-execution.md) | 流式原件校验、受限 FFmpeg 实际解码、56 项本地集成检查；尚未接远端/Worker |
| [T04真机G1执行模板](research/2026-10-15-t04-g1-device-runbook.md) | 设备/时长/故障/阶段组合、核听标记与记录模板；实际矩阵未执行 |
| [T04服务端合并契约](research/2026-10-15-t04-server-merge-contract-local.md) | 有序块清单、合并幂等输入和完整确认门槛的本地纯函数；数据库/Worker 仍待验收，实际本地解码见续批 |
| [P0质量门定义](superpowers/specs/2026-10-13-upgrade-p0-gates.md) | 设备、权限、样本、统计分母和观察窗；尚未验收 |
| [P1数据与迁移契约](superpowers/specs/2026-10-13-upgrade-p1-contracts.md) | 资产/任务/删除/录音字段、状态、回填与回退v0.1 |
| [实施差距核查](research/2026-10-10-implementation-gap-audit.md) | 媒体路径、恢复、模拟降级、权限、导出、删除和支付缺口；2026-10-10静态快照 |
| [既有产物与证据核查](research/2026-10-10-evidence-and-artifact-review.md) | 研究来源、成本工具、旧计划的证据边界 |

执行顺序：P0基线与设计 → G0 → P1资产/任务/权限/录音 → G1 → P2忠实AI/审阅 → G2 → P3完整交付/付费 → G3 → P4成熟家庭试点 → G4。P1单人按T02→T05→T03→T04；测试随阶段执行。

当前决策台账优先于旧计划中的冲突建议；本轮明确采用US$59数字项目价格假设、完整档案/PDF、12个月托管与续存选项。实际账户、费用、商品配额、供应商删除能力和质量门结果必须有证据。

当前G0/G1仍未通过。[认证会话衔接批](research/2026-10-19-auth-session-integration.md)本地实现完成：浏览器PKCE/cookie与provider核实store/SSR/Bearer、完整session OTP、刷新时页面连续性已有证据，旧localStorage-only用户须重新登录，认证key只精确删除不导入。严格signin/callback、安全next、丢next回dashboard及裸`?type=invite`无凭据指引保留，旧fragment-only/畸形callback不恢复。最终28套/605项、Chromium14项与新项目Web96/1278、shared4/16、infra7、176页通过；773输入不变、next-env恢复。Task 1两轮独立审查的五项问题已修复，规格复审PASS、质量复审Approved且无新规格问题；文档独立审查、整批独立审查与最终完整性均已通过，见[当前汇总](research/evidence/2026-10-19-auth-session-integration/verification.json)。

RB1本地根因修复与合成集成完成，真实Google/SMTP、完整Next/域名cookie部署及JWT/RLS/PostgREST仍须独立资格验收。下一独立本地任务推进可信权益source/event、撤销/持久去重、send/release与直接RPC/表ACL；正式权限/Storage/bucket、迁移/回填/回退/备份、供应商和G1真机证据仍缺。前批[认证回跳研究](research/2026-10-19-auth-return.md)及其中的后续指令保留为日期历史。audit42项（34high/8moderate）未重跑未解决；构建仍有旧Next配置与缺服务端key的configuration-validation诊断，成功build不等于生产合格。生产开关未启用，无提交/推送/迁移/部署。

2026-10-19 11:06前批历史状态：G0/G1尚未通过。[只读兼容与恢复UI](research/2026-10-19-invitation-read-ui.md)已替换两旧token GET的直表路径，默认503、启用须Bearer与规范token；check-pending始终503。两接受页面已共用显式接受/unknown只读查询，I1身份代次修复经真实RED/GREEN和独立复审Approved。最终253项由18新读取路由SDK、41 React及194既有回归组成；控制器固定代码后Web82/1019、shared4/16、infra7、176页通过，751输入不变且next-env恢复。Task 2文档独立审查、整批独立审查及最终完整性均已通过，见[当前汇总](research/evidence/2026-10-19-invitation-read-ui/verification.json)。合成loopback/组件测试不证明真实JWT/PostgREST/PG17或生产权限。pending/可信最小预览、历史opaque token仍不可用，signin/callback旧日志及auth_next持久化是独立发布阻塞；可信权益source/event、发送/取消、直接RPC/表ACL与历史兼容迁移回退仍需完成。audit42项与构建旧警告未解决，生产开关未启用；无提交/推送/部署。

前批邀请事务候选本地实现、最终158/2,288、33并发、282完整状态核对、协议18/18和4类生命周期观察已完成，Task 1独立规格PASS、质量Approved；Task 2独立审查PASS/Approved；整批独立审查已PASS，见[前批汇总](research/evidence/2026-10-18-invitation-transactions/verification.json)。本批复用前批RPC权限2026-10-18 12:24:38.969365—12:26:48.304226 Asia/Taipei的项目执行：77/766、shared4/16、infra7、175页；707输入/3日志及next-env原字节一致，未重跑。新候选有token/合成确认邮箱/持久预留，生产JWT/可信付款来源、正式adapter及旧RPC/直接表/旧入口兼容旁路仍待处理；迁移等价/回退、bucket/备份、供应商和真机仍缺。依赖audit未重跑，前批42项失败仍有效；本地批次不是原计划里程碑，未提交/推送/部署。

## 产品、代码与部署

| 文档 | 用途 |
|---|---|
| [基线PRD](../UR%20saga%20v1.8.md) | 原产品规格；开头标明与10月确认决策的优先关系 |
| [代码库约定](../CLAUDE.md) | 目录、命令、架构和工程约定 |
| [部署流程](deployment/github-vercel-supabase.md) | GitHub/Vercel/Supabase配置与发布流程；执行前核对实际环境 |
| [新Supabase项目恢复](deployment/supabase-new-project-restore.md) | 恢复步骤与验证 |
| [此前部署记录](deployment-summary-2026-10-07.md) | 历史证据，不自动证明当前线上状态 |

## 研究依据

研究按日期保存；模型、价格与供应商条件接入时复核。

| 文档 | 主题 |
|---|---|
| [10月11日引用资料补读](research/2026-10-11-reference-review.md) | 全文覆盖、PRD与旧计划冲突、历史社交证据边界 |
| [10月11日供应商准备核查](research/2026-10-11-provider-readiness.md) | 公开ID/价目、留存/训练/区域条件、队列PoC建议及未完成账户资格 |
| [综合研究](research/2026-10-07-strategic-review.md) | 产品、技术和商业全景 |
| [市场与商业](research/2026-10-07-market-and-business.md) | 英语市场、竞品和商品 |
| [产品与体验](research/2026-10-07-product-and-ux.md) | 家庭任务、流程和使用障碍 |
| [AI与架构](research/2026-10-07-ai-and-architecture.md) | 代码基础和能力缺口 |
| [社交需求与市场修正](research/2026-10-08-social-and-market-strategy.md) | 原声、开始困难和陪同场景；不等于市场规模或付费验证 |
| [AI蓝图与模型分层](research/2026-10-08-ai-blueprint-and-model-tiers.md) | 前沿候选、质量基准和分层成本 |
| [OpenAI官方资料核查](research/2026-10-08-ai-openai-and-platform-sources.md) | 当时的API能力、价格与数据政策 |
| [选型证据](research/2026-10-08-ai-sota-selection-evidence.md) · [语音证据](research/2026-10-08-ai-sota-speech-evidence.md) | 候选依据及限制 |
| [本地部署](research/2026-10-08-ai-local-deployment.md) | 设备、运行时、许可和实测路线 |
| [费用计算器](research/ai_cost_calculator.py) · [场景结果](research/2026-10-08-ai-cost-scenarios.json) | 给定工作量下的可复算预算，不是实际每户全部成本 |

## 历史规划与交付文件

以下保留查阅，**不作为现行排期、已批准商品或生产完成证明**。旧“8周生死线”、固定国家配额、自动停项/退款和紧急模型降档等建议不由本次决策继承；以当前台账及质量证据为准。

- [旧综合计划](STRATEGIC-IMPLEMENTATION-PLAN.md)
- [旧团队摘要](DECISION-SUMMARY-FOR-TEAM.md) · [旧速查卡](QUICK-REFERENCE-CARD.md)
- [旧8周清单](8-WEEK-EXECUTION-CHECKLIST.md) · [旧完成报告](COMPLETION-REPORT.md) · [旧交付摘要](DELIVERY-SUMMARY.txt)
- [旧快速部署清单](QUICK-DEPLOY-CHECKLIST.md)
- [早期执行摘要](EXEC-SUMMARY.md) · [历史下一步](NEXT-STEPS.md) · [历史完成记录](NEXT-STEPS-completion-report.md)
- [交付审计](delivery-audit-and-remediation-checklist.md) · [修复进度](remediation-progress.md)

文档更新须分清“决定了什么”“代码实现了什么”“实际验证了什么”。质量门附commit、测试/真机/恢复证据；既有报告勾号不能代替当前结果。

# 综合升级前的实施差距核查

## 2026-10-13执行更新

T01本地原型及研究准备现已完成，见[实现与验证记录](2026-10-13-t01-prototype-implementation.md)。六情景85步与独立审查覆盖两入口及故障/核对流程；没有修改生产录音、邀请或导出实现，也没有完成家庭观察。原型中的问题返回、恢复与批准快照是待落地设计，不能反向视为下方代码差距已关闭。按用户要求，暂不部署，里程碑后统一安排。

继续按全部A实施。[本批记录](2026-10-13-media-access-implementation.md)记录已完成的签名回放/ASR/图片上传服务端定位与权限修复；图片认证/anonymous回退、原件重编码、下载先缓冲等问题一并修复。最终verify退出0，58套/488项，独立复审三项发现已关闭。另已完成[质量门定义](../superpowers/specs/2026-10-13-upgrade-p0-gates.md)与[P1契约v0.1](../superpowers/specs/2026-10-13-upgrade-p1-contracts.md)。实际Storage RLS、旧对象映射、删除错误路径、持久任务和真机恢复仍需后续任务，不以API回归通过代表全量权限/保存验收。

## 2026-10-11执行更新

用户已确认D01–D16全部A，并要求更新文档后开始实施。以下原审计保留为10月10日快照；其中“待选择”“本次不实施”及旧阶段划分不代表当前状态。当前以[决策台账](../2026-10-10-upgrade-decisions.md)和[主计划](../2026-10-10-integrated-upgrade-plan.md)为准：单人约24–34周，两入口串行建设后均进入试点，完整交付与支付经G3验收后再收费。

首批[T00](../superpowers/plans/2026-10-11-upgrade-t00-truthful-ai.md)已实现：删除AIService随机/模板降级；校验ASR和生成响应；缺失置信度保持未知、0不覆盖、不强抬低分；健康接口分别报告配置；移除虚假音质增强标签；录音页显示整理状态且允许失败后保存原声；阻止上次录音的文字或迟到AI结果进入新故事。5套/41项相关回归已通过；完整核验和复审结果集中记录在[当前基线与实施记录](2026-10-11-upgrade-baseline.md)。这些修复没有完成来源级事实核对或持久恢复。

本轮额外确认`api/media/signed-url`允许任意包含`/projects/`的路径，未校验项目成员，列为T02/T03发布阻塞项。原审计中的桶/删除路径不一致、ASR对象级权限、录音持久会话、完整导出和Worker仍未解决。根迁移目录的说明已在CLAUDE.md修正；远端迁移历史未核实。G0–G4均未宣告通过。

引用补读与新增供应商条件分别见[本地资料复核](2026-10-11-reference-review.md)、[供应商准备核查](2026-10-11-provider-readiness.md)。以下旧行号用于追溯10月10日代码，修改后的定位以当前源码为准。

## 10月10日静态审计原文

核查日期：2026-10-10（Asia/Taipei）。依据为本地当前代码、`CLAUDE.md`、10 月 7 日产品/架构研究及旧战略、8 周计划。用户本轮已选择“高质量优先、工期灵活”，因此建议按质量验收门推进。本文只做静态审计，未运行完整测试、真机录音、真实模型、生产迁移或支付；“现有”仅表示代码存在。本次不实施修改，不代表用户已批准具体选型、预算或发布日期。下列路径相对仓库根目录 `/Users/eat/Documents/eatpotato/saga传奇`。

**结论：保留现有 Next.js / Supabase 架构，但升级的关键路径是媒体资产与恢复 → 持久任务 → 可核对成品 → 交付与收费。** 当前的角色权限、录音分块、Agent 产物及公开贡献撤回值得复用；它们尚未构成经过验证的家庭服务闭环。10 月 7 日研究中的主要差距仍然存在，并新发现音频桶、删除路径不一致。

## 1. 实际能力与缺口

| 能力 | 状态与证据 | 实施含义 |
|---|---|---|
| 录音与恢复 | **部分**。`packages/web/src/components/recording/SmartRecorder.tsx:82` 在线先上传、失败才写 IndexedDB；`:128` 上传成功即删本地块；`:513` 会话 ID 只在 ref；`:504` 仅选 WebM，`:533` 60 秒切块。`packages/web/src/lib/recorder-db.ts:3` 仅有块、会话 ID 与时间，没有项目、完整会话目录。 | 先写本地会话清单和有序块，再备份；确认完整资产提交后清理。加入重开恢复、格式能力检测及本地下载退路。切块间隔不能当作最大丢失量承诺。 |
| 音频资产真源 | **缺失统一表示**。`packages/web/src/lib/storage.ts:80` 生成 `userId/folder/name`，`:117` 上传至 `audio-recordings`；`packages/web/src/app/api/ai/transcribe/route.ts:71` 却从 `saga` 下载。 | 媒体资产必须保存准确 `bucket + object_key + checksum + MIME + duration + owner/project`；导出、转写、播放、删除共用解析器。不能仅把 ASR 函数接到保存按钮。 |
| 转写、模型路由、任务 | **部分**。主录音页 `packages/web/src/app/[locale]/dashboard/projects/[id]/record/page.tsx:140` 仅对浏览器已有文字生成摘要，`:189` 客户端发起编辑后不等待。ASR 路由 `:111` 默认 SiliconFlow / SenseVoiceSmall；`packages/web/src/lib/server/text-ai-config.ts:1` 默认 OpenRouter / gpt-oss-20b free。 | 默认值不代表生产配置。服务器 ASR 应成为原声提交后的正式环节；浏览器字幕只作反馈。补任务表、重试、去重、可见状态、处理版本与真实成本账。供应商路由尚待实施、实测。 |
| 真实性与回源 | **部分**。`packages/web/src/lib/agents/editor-agent.ts:39` 正文基本保留转写，`:63` 正则提取；`packages/web/src/app/api/agents/editor/process-story/route.ts:81` 明示 deterministic；`:100` 引用为文本偏移。`packages/web/src/lib/server/story-content-hash.ts:3` 未含模型/处理器版本。 | 已有引用资产可扩展，但不等于每句能回放音频。需要转写版本、片段时间、证据匹配验证、人工确认与发布版本。新模型应避免复用旧处理缓存。 |
| 真实失败状态 | **部分且有误导降级**。`packages/web/src/lib/ai-service.ts:42`、`:112` 健康检查失败进入 mock；`:235` 随机预设故事。`packages/web/src/components/recording/ReviewStage.tsx:35` 默认开启“Auto-Leveling Applied”。 | 优先隔离演示内容；正式档案失败显示“录音已保存、整理待重试”。处理完成标签必须来自真实产物；固定置信度不能当作测得准确率。 |
| 权限与同意 | **部分**。`packages/web/src/lib/server/project-access.ts:14` 有项目访问检查；ASR 路由 `:66` 接受路径后用 admin 下载，只经过 `ai-guard.ts:19` 的认证/限流。`packages/web/src/app/api/privacy-pledge/route.ts:18` 记录通用版本；公开贡献路由 `packages/web/src/app/api/stories/[storyId]/public-archive/route.ts:69` 验证预览版本、`:101` 记审计。 | 补媒体对象归属与动作权限，测试跨家庭访问；分别记录录音/导入、云 AI 处理、家庭共享、公开贡献的适用同意，列明真实供应商。不能把通用隐私勾选视为所有二次用途授权。 |
| 删除与撤回 | **部分**。`packages/web/src/lib/stories.ts:198` 仅取 basename 删除 `audio-recordings/stories/name`，与上传路径不一致且未检查 remove 结果；`packages/web/src/lib/projects.ts:357` 仅删除项目行；`packages/web/src/components/settings/settings-page.tsx:668` 账号删除按钮无 handler。公开撤回路由 `packages/web/src/app/api/public-archive/contributions/[contributionId]/withdraw/route.ts:25` 有撤回与派生内容重算。 | 建立可重试删除任务，覆盖原件、块、转写、索引、草稿、成品、日志及备份生命周期。公开撤回不等于物理全量删除；`supabase/migrations/20260612000000_agent_phase2_public_archive.sql:55` 的 restrict 外键还需处理。 |
| 导出与保留 | **部分**。设置页 `packages/web/src/app/[locale]/dashboard/projects/[id]/settings/page.tsx:196` 只 toast；`packages/web/src/app/api/projects/[id]/export/route.ts:85` 标明不含音频/照片，`:207` 又覆盖该 README。订阅服务 `packages/web/src/services/subscription.service.ts:79` 调用归档接口，不能据此证明停付后的保留策略有效。 | 完成包含原件、文本、照片、元数据、校验清单、离线目录的下载包；定义托管期、停付访问、删除缓冲及备份期限。托管与用户持有副本分别承诺。 |
| 支付 | **部分**。`packages/web/src/app/[locale]/dashboard/purchase/page.tsx:58` 实际提交 waitlist；`packages/web/src/app/api/payments/create-intent/route.ts:35` 有服务器价格校验；`packages/web/src/services/stripe.service.ts:147` 调用未见对应活动路由的 complete/status 接口。 | 收费前需 Webhook 验签、事件幂等、权益发放与对账、退款/失败/重复点击测试。订阅 UI 和 PaymentIntent 存在均不证明收费闭环完成。 |

## 2. 测试与部署证据的边界

`package.json:20` 定义 `verify`（类型、lint、web Jest、构建）；`.github/workflows/deploy.yml:42` 有 CI 检查，`:111` 至 `:174` 已配置 Supabase CLI 迁移再部署 Vercel。**不能沿用 `CLAUDE.md` 所说“不是迁移框架”，也不能机械重跑旧文档要求手工执行的 SQL。** 应先比较迁移目录、远端历史与实际 schema，再决定补迁移或修历史。

已有测试资产，但 `packages/web/src/__tests__/e2e/complete-user-journey.test.tsx:38` mock API，`packages/web/src/__tests__/data-export.test.tsx:7` mock 导出服务，`packages/web/src/components/recording/__tests__/record-page-uses-smart-recorder.test.tsx:35` mock 录音器；它们不证明真机音频恢复、离线成品或支付到账。ASR 测试 `packages/web/src/app/api/ai/transcribe/__tests__/route.test.ts:35` 主要覆盖大小、认证、CORS，未覆盖对象归属。

`docs/deployment-summary-2026-10-07.md:19` 的“生产成功”依赖此前反馈，`:22` 仍是占位域名；本次未核对线上部署、密钥配置、迁移或完整测试结果。发布验收应记录 commit、构建 ID、实际域名、迁移版本、测试报告和回滚演练，不能把文档勾号当作证据。

## 3. 旧实施计划需要先纠偏

1. **将“已决定”退回候选。** `docs/STRATEGIC-IMPLEMENTATION-PLAN.md:4`、`:11` 擅自把作者设为决策者；美国比例、双入口同时开发、固定模型、三份备份及 8 周期限均须由用户决定。`docs/8-WEEK-EXECUTION-CHECKLIST.md:3` 的 10 月 9 日开工、团队会议并非已确认资源；以用户批准后的 T0 和可用人日重排。
2. **删除伪完成与重复新建任务。** 旧清单 `:77`、`:221` 要新建已存在的 export / create-intent 路由，应改为补齐/替换。`:93` 的“6 个月后仍能打开”只能列长期回访，不能纳入第 2 周已完成验收；`:66` 的 3/5 恢复场景通过不足以开放尚未支持的场景。
3. **伪代码不能直接施工。** 旧战略 `:1609` 把同步 `await fetch` 称为后台任务，未传认证、未核对响应，还与当前 ASR 的 multipart 合约不符；须换成持久任务提交。`:1162` 引用未匹配就返回全文范围，会把缺证据伪装成可追溯；必须返回无匹配并阻止该陈述获批。`:680` 的离线播放器依赖 `fetch('manifest.json')`，双击 `file://` 打开可能受浏览器限制；`:688` 直接将用户标题放入 `innerHTML`，应改为安全嵌入清单和文本节点，并实测断网双击打开。此次指定文件中未检出 `Promise.all/race` 的多模型竞跑实现，故不声称已有“伪并发重复付费”事故；未来降级/影子评测需显式预算，不能靠 Promise 结束误认为上游请求已取消或不计费。
4. **限定成本与指标口径。** 旧战略 `:88` 的每项目模型算例不能作为服务毛利或预算上限；`:2043` 的平均 0–10 分不是 NPS。试点需记录输入时长、重试、复核、人工、存储/流量、支付费、退款及每户获客成本，并报告样本分子/分母。

## 4. 推荐的依赖与验收顺序

| 阶段 | 任务与依赖 | 离开阶段的证据 |
|---|---|---|
| G0：基线与决策 | 核对部署/schema/支持设备；确认首发用户、入口、托管承诺、供应商边界和投入；拆工单。 | 用户批准决策表；已验证能力清单、数据流图、支持矩阵和资源估算。 |
| G1：信任底座 | 统一媒体资产；修对象权限、模拟内容和删除；持久录音会话、重组校验、基础原声导出。依赖 G0。 | 虚构故事/测试账号下，声明支持矩阵全部通过；跨家庭访问被拒绝；重复保存不重复建档；已确认保存内容可恢复、可删、可离线打开。 |
| G2：可信整理 | 持久任务/预算/版本；ASR 适配；时间戳与来源校验；可修正事实、保留不确定性；完整交付包。依赖 G1。 | 服务超时/重试不丢原声；授权样本盲测；重要陈述均有有效证据或明确待确认；另一设备断网可播放。 |
| G3：单入口试点 | 优先完成用户选定入口；邀请/陪同/独立路径分别统计。收费选项确定后接支付与权益。依赖 G2。 | 真实家庭完成故事、核对、分享、下载；收费路线另过测试支付、Webhook 重放、退款和权益对账。 |
| G4：扩展决定 | 用完成率、第二故事率、事实错误、人工分钟及完整贡献利润决定第二入口/实时语音/公共档案。依赖 G3。 | 提交实测结果与备选方案，由用户决定继续、收敛或扩展；不以某周到期自动扩大。 |

建议暂按“单名全栈执行者 + 用户负责产品取舍/试点资源”的资源假设估算，另列多人并行方案；两者都是待确认估算，不能把 AI 并行开发换算成同等人类测试、设计或招募资源。每个阶段允许内部并行独立工作，但不能跨过保存、授权、交付与收费的前置验收。

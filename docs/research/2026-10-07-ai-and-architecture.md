# UR Saga：AI 与架构调研

> **2026-10-08选型更新：** 新增[SOTA优先的AI架构、三档组合与本地部署](2026-10-08-ai-blueprint-and-model-tiers.md)，不受本文现有实现或供应商约束。该专题结合独立评测重选质量基准，并补充开放模型、硬件路线与成本计算器；本文保留代码审计与实施差距记录。

> **2026-10-08需求层补充：** [社交讨论研究](2026-10-08-social-and-market-strategy.md)提示应比较已有声音保存与新访谈，而非默认所有内容都需AI扩写。原声回听、人物/事件索引和忠实整理优先；保存亲人声音不等于想要AI人格模拟。本文模型与价格仍为10月7日核实基线，本轮未重新测价或模型质量。

调研日期：2026-10-07（Asia/Taipei）。范围：英语市场家庭，以老年讲述者及其家人为核心。方法：源代码静态核对、官方产品/API 文档与模型作者仓库；未运行真实家庭录音评测、未检查生产部署或账单。以下“已实现”指仓库中存在实现，不代表生产环境已经配置并验证。动态官方页面以抓取日为准，除特别注明，不把抓取日当成发布日期。

## 1. 判断：不要重写整个平台，先补上可信的录音到成品链路

现代 ASR、实时语音、结构化输出已经降低“能转写、能追问、能生成一篇故事”的实现门槛。Saga 值得保留的基础是故事与项目权限、录音分块备份、Agent 运行记录、来源引用、私有传记与公开贡献分离。当前主要问题不是框架年龄，而是核心流程中的能力落差：主录音页依赖浏览器识别文本，命名为 Agent 的核心处理还是模板和正则，降级可能返回模拟内容，来源只关联文字偏移而未完整关联原音频。

建议近期产品承诺收敛成：**放心讲述，可靠保存；家人能核对原话；几次访谈后拿到可信且有本人声音的故事。**实时拟人对话是需要验证的体验选项，不能代替保存可靠性与事实忠实性。

## 2. 当前代码：已实现、缺口与优先级

以下路径均相对于仓库根目录 `/Users/eat/Documents/eatpotato/saga传奇`。

| 领域 | 代码证据 | 结论与动作 |
|---|---|---|
| 实际供应商 | `packages/web/src/app/api/ai/transcribe/route.ts:5,111–112` 为 `api.siliconflow.cn` + `FunAudioLLM/SenseVoiceSmall`；`packages/web/src/lib/server/text-ai-config.ts:1–2,15–22` 默认 OpenRouter 与 `openai/gpt-oss-20b:free` | `CLAUDE.md` 将 AI 描述为 OpenAI，但 SDK 兼容不等于直接使用 OpenAI 服务。先形成实际数据流/供应商清单，再选英语市场服务区域与合同。环境变量可覆盖文本配置，不能据此断言生产正在使用默认模型。 |
| 主录音识别 | `SmartRecorder.tsx:226–244` 使用浏览器 `SpeechRecognition/webkitSpeechRecognition`；`app/[locale]/dashboard/projects/[id]/record/page.tsx:124–150,168–189` 用现有文本生成摘要并保存 | 在该主路径未见音频存在、浏览器文本缺失时自动补跑服务器 ASR。必须补可靠的“已存音频→后台转写”链路，浏览器实时字幕只作临时反馈。 |
| 录音备份 | `SmartRecorder.tsx:80–133,495–533`：Wake Lock、64 kbps、60 秒分块、失败存 IndexedDB 并同步 | 是可保留的工程资产。仍需真机验证断网、页面刷新、iOS 中断、存储额度、长录音恢复；分块上传存在不等于完整重建及提交已有端到端保证。 |
| MIME 兼容 | `SmartRecorder.tsx:504` 选择 Opus WebM 或 WebM | 没有在该选择处看到 MP4 回退；按实际目标设备矩阵验证，不能只用桌面 Chrome 通过作为录音可靠性证据。 |
| “采访 Agent” | `lib/agents/interview-agent.ts:34–139`：阶段、静默阈值、固定问题；情绪识别是词匹配（30–32、142–145） | 已有可控的低干预规则，但不等于模型理解讲述上下文。保留 Off/Low/High；再比较规则、文本生成追问和实时语音三个版本。不要把词匹配包装成情绪理解。 |
| “编辑 Agent” | `lib/agents/editor-agent.ts:30–42,63–151`；`api/agents/editor/process-story/route.ts:81` 明确 `deterministic-editor-agent` | 正文基本原样返回，摘要截断，人物/地点/事件由正则提取；真实姓名、相对日期、关系及冲突需要模型与人工确认。当前属于可测试的框架雏形。 |
| 来源与幂等 | `editor-agent.ts:11–18,182–193` 有引用与偏移；`api/agents/editor/process-story/route.ts:47–63,94–128` 有内容哈希、运行复用和 sourceRefs | 方向正确。补 transcript version、audio segment 时间戳、模型/提示词版本；模型升级后仅内容哈希不变可能复用旧结果，缓存键应包含处理器版本。 |
| 模拟降级 | `lib/ai-service.ts:42–50,112–120,235–246`：健康检查失败后可能随机返回预设转写或模板生成内容 | 属于真实的代码风险，但不是每个录音都会走这个路径。生产必须明确返回“处理中/失败可重试”，示例内容只允许明确隔离的演示模式；不可混入家庭档案。 |
| 置信度 | `api/ai/transcribe/route.ts:167` 默认 0.9；`editor-agent.ts:66–151` 多个固定数值；模拟转写 0.92 | 这些数不能作为测量过的正确率向用户展示。优先显示“待确认姓名/听不清片段”，以后根据标注集校准置信度。 |
| 授权边界 | `api/ai/transcribe/route.ts:66–71` 接收 storagePath 后以 admin 下载；`lib/server/ai-guard.ts:19–41` 只体现身份与限流 | 此路由未见对象归属校验，需在上线前审查并补项目/对象访问验证。此处是静态检查发现，尚未进行攻击复现。 |
| 限流与任务可靠性 | `ai-guard.ts:6–7` 固定窗；`lib/server/rate-limit.ts:20` 内存 Map；主录音页 189 行 fire-and-forget 编辑调用 | 单实例内存限流不等于跨实例预算；客户端异步请求不等于持久任务队列。用可恢复任务状态、重试上限、分钟配额和供应商成本日志。 |
| 公开贡献脱敏 | `lib/public-archive/anonymizer.ts:43–62,71–86,118–125`：已知姓名/联系方式正则、排除原音频照片 | 这是可识别信息替换，不是匿名性保证。编辑器当前无法可靠提取所有姓名，且地点/年份/亲属组合仍可能指向个人。公开档案保持人工审核和单独授权。 |

## 3. 外部技术能力：现在可以做什么，不能推导什么

### 3.1 文件转写已经有更合适的基线

OpenAI 当前 speech-to-text 文档推荐 `gpt-transcribe` 处理普通已录制语音；文件上限为 25 MB。说话人分离使用专门的 `gpt-4o-transcribe-diarize`，`diarized_json` 返回 speaker/start/end，超过 30 秒应配置 chunking strategy。普通转写、说话人分离、逐词时间戳并非同一个接口能力的不同开关；文档明确 `timestamp_granularities[]` 只支持 `whisper-1`。[S1]

对 Saga 的含义：做三条可互换流水线基线：当前 SenseVoiceSmall、经济型 OpenAI 转写、当前推荐的一般转写模型。亲子同场访谈另外测说话人分离。为专名提供用户确认过的人名/地名词表，但词表只是识别上下文，不能成为凭空补写事实的依据。保留原始音频，允许模型更换后重跑。

SenseVoice 官方模型作者 README 说明发布的 Small checkpoint 支持普通话、粤语、英语、日语、韩语；说话人分离需组合其他模型，不是这个 checkpoint 自带的输出。[S7] “支持英语”不能推出“适合英语老年家庭”；更不能把厂商公开基准等同于本项目方言/噪声/专名准确率。

### 3.2 实时语音已成熟到值得做试验，但不是默认采购项

OpenAI Realtime 可以直接处理语音、保留会话状态并调用工具，浏览器典型连接为 WebRTC；服务端创建 ephemeral client secret，浏览器不得持有长期 API key。[S2] Google Gemini Live 官方说明支持低延迟音视频流、用户打断、工具使用及输入/输出音频转写，可作为第二家实时供应商的技术候选。[S6]

Saga 应比较：

1. **录音优先**：用户说，偶尔显示一个问题；最少打断。
2. **链式主持**：ASR→文本决策→短 TTS；较容易审计提问内容和替换供应商。
3. **实时语音主持**：自然轮替、可打断，但需要额外处理回声、长停顿、误抢话、恢复会话和输出费用。

不建议第一步购买全程高拟人语音。先在英语家庭中测“停顿后合适的一句追问”是否增加有效回忆与完成率。老人思考 15 秒不一定需要机器人接话；用户表达悲伤不等于应自动心理干预。所有模式都要允许暂停、跳题和保留沉默。

### 3.3 结构化输出提高格式可靠性，不证明传记真实

官方 Structured Outputs 文档明确模型仍会犯错；输入不相关时也可能为了满足 schema 产生幻觉。[S3] 因此建议把编辑流程分为：

- **证据提取**：只输出事件、人物、关系、时间及原话引用；没有依据就空值，保留不确定时间。
- **一致性检查**：跨故事同名人、年龄与年份冲突生成“需要确认的问题”，不自动选择一个真相。
- **叙事编辑**：在已确认事实范围内组织段落；保留第一人称、口头语气、记忆的不确定性。
- **家庭批准**：展示原话与编辑后差异；一句重要陈述能回放对应音频；最终出版版本独立于持续编辑中的素材。

建议数据链：`原音频→带时间的转写版本→带证据的事实/事件→编辑草稿→用户确认→成品`。当前 sourceQuote、偏移与内容哈希正好可以发展为此链路，无需推倒。

### 3.4 真正的异步编辑是后台任务，不是前端 await 的写法

录音保存与 AI 成功应解耦：先确认音频持久保存，再提交 ASR 任务，随后证据提取与编辑，通知家人核对；每个阶段可独立重试且不能重复扣费或产生重复故事。把状态显示为“音频已安全保存，文字整理中”，不要用虚假的完成进度。

OpenAI Batch 官方提供约 50% 成本折扣、24 小时完成窗口，支持页面列出的文本/嵌入等端点；此次页面未列音频转写端点。[S4] 可考虑用于不着急的全书整理，不能直接假设给音频 ASR 打五折，也不适合必须几秒内出预览的录音结束页。

## 4. 英语老年用户评测方案

这是建议的实验设计，不是已经测得的结果。

第一阶段取得明确授权的 20–30 位讲述者，每位 10–20 分钟录音；按真实用户构成覆盖美国/英国/澳洲等口音及英语非母语者，覆盖手机/笔电、弱声/慢语速、正常犹豫停顿、电视背景声、家人插话、姓名地名、年代和金额。训练提示用开发集，供应商比较用独立保留测试集，避免“把正确答案放进专名提示后又计入准确率”。中文方言仅在确定扩展市场后单列评测。

| 层面 | 核心指标 | 为什么不能只看 WER |
|---|---|---|
| ASR | WER、专名准确率、数字/年份准确率、静默幻写率、未识别片段比例 | 少错一个冠词不如正确记录祖母姓名重要；静默变成一句新故事是严重失败。 |
| 多人场景 | speaker attribution error；家人问题误当老人经历的比例 | 传记归属错误会改变事实主体。 |
| 保存与恢复 | 录音保存成功率、最长丢失秒数、断线恢复、崩溃恢复 | 生成得再好也无法补回丢失的原声。 |
| 采访体验 | 首次完成率、被抢话次数、追问相关性、有效新增事实、愿否再录 | 自然语音只是手段，更多 token 或更多问题不代表更好采访。 |
| 编辑忠实性 | 无来源陈述率、日期/主体改变、遗漏重要信息、本人认可度 | 必须用音频和原文核对，不能仅让另一个 LLM 给文采打分。 |
| 可运营性 | 每批准 1 分钟/1 篇故事的总成本，家人修订时间，人工客服时间 | AI 单次调用便宜不等于完整服务赚钱。 |

建议首轮硬门槛：正式记录中零模拟内容、音频可导出、所有陈述可回源、识别/生成失败不丢原音频。其余准确率与时延目标先测基线后确定，不伪造行业标准。有限样本“零失败”不证明总体失败率为零。

## 5. 隐私：以实际端点和服务区域为准

OpenAI 官方说明，自 2023-03-01 起，API 数据默认不用于训练，除非明确 opt in。但“不训练”“不保存”“不跨境”是三个不同承诺。该页通用滥用监控留存说明为最长 30 天并有法定等例外；端点表具体列 `/v1/audio/transcriptions` 的监控与应用状态均为 None，`/v1/realtime` 监控 30 days、状态 None。ZDR/Modified Abuse Monitoring 有资格和审批条件，不应声称注册付费 API 就自动获得所有端点零留存。[S5]

当前代码的数据流还包含 Supabase、可能的浏览器语音识别服务、SiliconFlow 中国端点、OpenRouter 及其实际模型提供商。OpenAI 官方承诺不能转用于这些服务。针对英语市场：确定首发国家、服务区域、跨境路径、用户删除如何传播到原音频/转写/缓存/成品与备份；不要只在隐私页泛称“第三方 AI”。供应商切换要记版本及处理区域。

最小工程措施：音频下载访问验证、私有存储与短期签名链接、按项目授权、关闭生产原始文本日志、记录每次处理供应商、删除任务和审计事件、家庭共享与公开贡献分别授权。声音克隆、逝者对话和公开历史档案不纳入早期 MVP：它们不能替代家庭希望留住真实声音的基本目标，且需要独立验证授权与误导风险。

## 6. 可核算的成本示例

来源为 [S8] 抓取日官方价格表，美元、税前。表中 transcription 的分钟价标为 estimated cost；不当作合同报价，也不代表本项目当前账单。

| 官方条目 | 抓取日价格/估算 | 60 分钟一次转写 |
|---|---:|---:|
| gpt-4o-mini-transcribe | $0.003/分钟 | $0.18 |
| gpt-transcribe | $0.0045/分钟 | $0.27 |
| gpt-4o-transcribe | $0.006/分钟 | $0.36 |
| gpt-realtime-2.1 | 音频输入 $32、输出 $64 / 百万 token | 不能在没有音频 token 用量时直接折算 |
| gpt-realtime-2.1-mini | 音频输入 $10、输出 $20 / 百万 token | 同上，另计文本及缓存规则 |

**假设 A：一篇 60 分钟录音的异步编辑。**ASR 用 `gpt-transcribe`，$0.27；文本处理假设累计输入 20,000 token、输出 4,000 token，选择价格表标准短上下文 `gpt-6.1-sol` 输入 $2/百万、输出 $10/百万，文本 $0.08；单次模型成本合计 $0.35。这里 token 数是工作量假设，不是英语时长到 token 的固定换算；模型只是成本示例，不是未经评测的推荐。若平均处理量因重试/修订增加 20%，示例为 $0.42；另需存储、流量、支付、人工与基础服务。

**假设 B：十次、每次 30 分钟的家庭项目。**300 分钟 ASR 约 $1.35；若每次文本用量是上述 A 的一半，文本约 $0.40，模型基础约 $1.75；加 20% 处理量为 $2.10。这不能推出套餐应定价 $3：人工帮助、成品编辑、实体书、获客和退款通常不由 token 价格决定，必须另建成本表。

**实时对话预算公式。**`音频输入token×输入价 + 音频输出token×输出价 + 文本token费用 + 其他服务`，除以 1,000,000。仅作为算术例子，若实测每会话 30,000 音频输入 token、6,000 输出 token，2.1-mini 的音频项为 $0.42；2.1 为 $1.344；不能把这组假设冒充“60 分钟实时访谈价格”。先采集真实用量、模型说话比例和上下文增长曲线。

## 7. 建议推进顺序

- **P0，收费试点前**：禁用真实档案的模拟降级；服务器 ASR 兜底；核实 storagePath 授权；真机断线恢复与原音频导出；明确供应商/区域；建立成本和失败日志。
- **P1，第一轮英语家庭试点**：保持当前架构，加入可切换 ASR；20–30 人评测；结构化证据提取与姓名日期核对；事件/草稿/发布版本分离；可恢复任务队列。
- **P2，证明复录与成品认可后**：比较低干预与实时语音主持，评估书稿整合、多人协作、按来源回放和高质量导出；只扩展有需求证据的口音/语言。
- **推迟**：公开百科的规模化自动发布、声音克隆、全面多 Agent 编排、为新框架重写已有业务。技术升级是否值得，应由家庭完成率、事实质量和每个成品成本决定。

## 8. 官方来源与证据摘录

均于 2026-10-07 获取。动态文档没有核实的独立发布日期；不据页面当前内容倒推出模型发布时间。

- **[S1] OpenAI Speech to text** — https://developers.openai.com/api/docs/guides/speech-to-text 。摘录：`Files can be up to 25 MB`；`Use gpt-4o-transcribe-diarize only when you need to identify who speaks`；`timestamp_granularities[] ... only supported for whisper-1`。用于一般转写、分离与时间戳能力边界。
- **[S2] OpenAI Realtime** — https://developers.openai.com/api/docs/guides/realtime 。摘录：`The model works directly with audio, maintains conversation state, and can call tools`；`Your application server creates an ephemeral client secret`；浏览器 WebRTC/服务端 WebSocket。用于实时架构判断。
- **[S3] OpenAI Structured Outputs** — https://developers.openai.com/api/docs/guides/structured-outputs 。摘录：`Structured Outputs can still contain mistakes`。用于区分格式可靠性与事实正确性。
- **[S4] OpenAI Batch API** — https://developers.openai.com/api/docs/guides/batch 。摘录：`50% cost discount compared to synchronous APIs`、`Each batch completes within 24 hours`；当前列出的支持端点未见 audio transcription。用于非即时文本整理。
- **[S5] OpenAI Your data** — https://developers.openai.com/api/docs/guides/your-data 。摘录：`As of March 1, 2023, data sent to the OpenAI API is not used to train ... unless you explicitly opt in`；ZDR `subject to prior approval`。端点表列明音频转写与 realtime 不同留存策略，不能概括成统一 30 天或统一零留存。
- **[S6] Google Gemini Live overview** — https://ai.google.dev/gemini-api/docs/live 。摘录：`low-latency, real-time voice and vision interactions`；`Users can interrupt the model at any time`；输入/输出音频转写。只据此判断候选能力，未比较实际效果或价格。
- **[S7] FunAudioLLM SenseVoice 官方仓库 README** — https://github.com/FunAudioLLM/SenseVoice （此次读取 https://raw.githubusercontent.com/FunAudioLLM/SenseVoice/main/README.md ）。摘录：`SenseVoiceSmall supports ASR and language ID for Mandarin, Cantonese, English, Japanese, and Korean`；diarization `is not an output of the SenseVoiceSmall checkpoint itself`。README 主分支为可变资料；未声称已经在 Saga 样本上验证。
- **[S8] OpenAI API Pricing** — https://developers.openai.com/api/docs/pricing 。摘录：`gpt-transcribe ... $0.0045 / minute`；`gpt-4o-mini-transcribe ... $0.003 / minute`；`gpt-6.1-sol` 标准短上下文输入 `$2.00`、输出 `$10.00` / 百万 token。实时音频条目与表中一致。公开营销价格页此次返回 HTTP 403，成本引用已成功获取的开发者价格文档，不引用未读取页面。

未解决的外部核实：SiliconFlow 当前服务套餐、价格与数据政策未成功获取，不能给当前实现填入未经验证的成本/保留期；OpenRouter 的具体供应商选择与留存要按实际生产配置和合同核实。此次也未做真实模型请求或评测，所有产品效果判断应经试点验证。

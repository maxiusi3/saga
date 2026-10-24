# AI 文本、多模态理解与检索：官方能力和价格核验

核验日期：2026-10-08（Asia/Taipei）。对象：英语市场家庭口述史，涉及忠实编辑、事实抽取、跨语言、旧照片/录像理解、家庭内部检索。仅调用公开 HTTP GET 读取官方文档，未调用付费 API、读取密钥或开展质量 benchmark。所有费用为美元/百万 token（MTok），按厂商直接 API 的公开价格；不含税、存储、网络、向量数据库、重试、人工核对和其他工具费用。token 数不能跨厂商视为完全相同。

> **SOTA优先更新：** 新增[独立文字/视觉/检索证据](2026-10-08-ai-sota-selection-evidence.md)。主方案改为Opus 5.5质量基准，并加入Fable 5.1和Voyage 4 / rerank-3；本篇保留早一轮官方价格及能力记录。

## 1. 可进入采购评测的候选

| 候选与精确 API ID | 官方状态和输入/输出 | 标准输入 / 输出 $/MTok | 上下文与输出上限 | 对 Saga 的候选用途 |
|---|---|---:|---|---|
| Claude Sonnet 5.5 `claude-sonnet-5-5` | Active (latest)，2026-09-28 发布；文字、图片 → 文字 [A1,A3] | 2 / 10 | 1M context；128K output | 中档主编辑、来源对照、跨语言改写候选；尚未证明其在 Saga 文风或忠实度优于其他厂商 |
| Claude Opus 5.5 `claude-opus-5-5` | Active (latest)，2026-09-22 发布；文字、图片 → 文字 [A1,A4] | 4 / 20 | 1M context；128K output | 本轮更新为提取、编辑与常规照片质量基准；降本需在保留测试集验证 |
| Claude Haiku 5.5 `claude-haiku-5-5` | 当前官方模型总览列出的正式产品，文字、图片 → 文字 [A1] | 提示 ≤100K：0.10 / 0.50；>100K：0.50 / 2.50 | 1M context；128K output | 分类、提取、路由的低价候选；长提示会越过价格档位 |
| Gemini 3.8 Flash `gemini-3.8-flash` | Stable；文字、图片、视频、音频、PDF → 文字 [G1,G3] | **2026-12-31 前：0.75 / 3.75；2027-01-01 起：1.50 / 7.50** | 1,048,576 input；65,536 output | 原生视频/音频/照片材料理解与索引辅助，不必替代全部文本流程 |
| Gemini 3.5 Flash-Lite `gemini-3.5-flash-lite` | Stable；文字、图片、视频、音频、PDF → 文字 [G1,G4] | 0.30 / 2.50 | 1,048,576 input；65,536 output | 大批量材料分类、简单数据提取、翻译候选 |
| Gemini 3.1 Pro `gemini-3.1-pro-preview` | **Preview**；文字、图片、视频、音频、PDF → 文字 [G1,G5] | 提示 ≤200K：2 / 12；>200K：4 / 18 | 1,048,576 input；65,536 output | 复杂多模态备选，必须接受 preview 生命周期风险 |
| DeepSeek-V4.1-Flash `deepseek-flash` | 2026-09-10 正式发布公告；原生图片、文字 → 文字 [D1,D2,D3] | 峰时：未缓存 0.30 / 输出 1.20；非峰：0.15 / 0.60 | 定价页：1M context，最大384K output | 开放权重模型的商业托管低价对照组；不是已通过家庭隐私、语言质量与服务稳定性评审的推荐生产配置 |

**解释：** 以上是可测试的工程/采购选择，不是任务效果排名。官方“multilingual”“reasoning”等能力说明只能证明支持方向，不能证明对英语口述中的口音、亲属称呼、错误转写、方言混合或记忆歧义具有足够忠实度。应使用同一批获授权的样本、人类标注和成对盲评决定最后分工。

Claude 1M 是 context window，不应按“1M 输入再额外加128K输出”规划；Gemini 专属页则分列 input/output token limit。当前官方 Claude 页面没有给上述两个5.5模型的1M窗口加旧版beta条件；定价页明确全1M窗口按标准单价，账户限流和平台差异仍需上线时检查 [A2]。本次没有用认证 Models API 验证具体账户额度。

## 2. Claude：可以做什么、需要怎样组合

### 2.1 能力与约束

- 官方总览说当前模型支持文字/图片输入、文字输出、多语言、视觉和工具使用 [A1]。这**不是原生音频/视频输入承诺**；要处理家庭录像，可先用受支持模型解析/抽帧及转写，再让 Claude 编辑与核对。
- 结构化输出文档的 supported models 明确列出 Sonnet 5.5 和 Opus 5.5；`output_config.format` 支持 JSON Schema 约束 [A6]。但结构正确不等于事实正确；拒绝、输出被截断等异常仍需处理，应用端仍要校验来源和字段。
- citations 文档明确 **all active models support citations**；可以引用上传的 PDF 文本、纯文本、自定义内容块 [A7]。引用返回的指针可用于回查原稿，但不能证明模型推论正确，也不能证明讲述本身客观准确。
- **原生 citations 与 `output_config.format` 不能同时启用**；两者同请求会返回400。当前只支持文字引用，不能把图片区域当原生引用证据 [A6,A7]。建议两步：结构化事实账本使用应用自有 source ID、offset/时间码并校验；自然文稿可选择原生 citations。不要在一张功能表里勾选两项后假定能一次同时使用。
- Sonnet 5.5 默认 adaptive thinking，高默认 effort；`between_tools` 可关闭前置 thinking。Opus 5.5 thinking 始终启用，可用 effort 控制深度 [A3,A4]。生成更长的思考和输出会影响实际费用及延时。
- 5.5 迁移有兼容性变化：强制 tool use 会报错；Sonnet设置非默认 temperature/top_p/top_k 会报错 [A3,A4]。应按文档迁移，而不是仅替换模型字符串。

### 2.2 缓存、Batch、长上下文

| 项目 | Sonnet 5.5 | Opus 5.5 | 说明 |
|---|---:|---:|---|
| 5分钟缓存写入 $/MTok | 2.50 | 5.00 | 1.25×标准输入 |
| 1小时缓存写入 $/MTok | 4.00 | 8.00 | 2×标准输入 |
| 缓存命中 $/MTok | 0.10 | 0.20 | 这两个模型为0.05×，不要套旧版通用0.1× |
| Batch 输入/输出 $/MTok | 1 / 5 | 2 / 10 | 标准输入输出50%折扣 |
| 最小可缓存提示 | 512 tokens | 512 tokens | 需实际复用前缀才能获得命中节省 |
| 全1M长上下文 | 标准单价 | 标准单价 | 无200K以上额外阶梯价 |

依据 [A2,A3,A4]。US-only inference 的 `inference_geo:"us"` 对4.6及以后模型所有token计费类别应用1.1×，全球默认不加这一系数；其他云平台有自己的地域计费规则 [A2]。

Message Batch 每批最多100,000请求或256MB（先到为限），24小时未完成会过期，结果创建后保留29天 [A5]。因此适合异步整理和评测，不适合长辈说完后必须马上给出的回应。官方300K输出仅限 Batch beta 条件；Saga不需要为单段家史使用此极限，也不要把它写成一般同步输出上限 [A3,A4]。

### 2.3 Anthropic 没有自己的 embedding 模型

Anthropic 文档直述 “Anthropic does not offer its own embedding model”，后续介绍 MongoDB 的 Voyage AI [A8]。所以“Claude embedding”不是可以采购的独立官方模型。要用 Claude 编辑，可以继续使用别家 embedding 与现有向量库，不必为厂商统一而迁移检索。该页面出现 Voyage 模型不代表它们按 Claude token 价计费；本次不将未核验的 Voyage 价格填入比较表。

## 3. Gemini：原生多模态与阶段性价格

### 3.1 支持范围

3.8 Flash 与3.5 Flash-Lite专属页明确支持图片、视频、音频、PDF输入、结构化输出、function calling、缓存、Batch；输出为文字，不支持音频生成、图像生成或Live API [G3,G4]。这非常适合**把旧家庭录像、相片说明、文字与录音材料变成可回查的文本索引**。不能将“理解音频”自动当成满足严格词级时间码、说话人分离和逐字保真要求的专用转写替代。

3.8 Flash thinking支持 low/medium/high，`minimal` 会报错 [G3]。3.1 Pro仍为preview [G5]，官方版本说明称preview通常限流更严格、至少提前两周通知弃用；稳定版本更适合作为默认配置 [G1]。

### 3.2 费用限制

- 3.8 Flash当前缓存输入 $0.075/MTok、缓存存储 $0.50/MTok·小时；2027年起分别 $0.15 与 $1.00。Batch当前 $0.375/$1.875，2027年起 $0.75/$3.75 [G2]。
- 3.5 Flash-Lite缓存 $0.03/MTok、存储 $1.00/MTok·小时；Batch输入/输出 $0.15/$1.25 [G2]。
- 3.1 Pro按完整提示长度跨200K档位：标准缓存命中 $0.20 或 $0.40，存储 $4.50/MTok·小时；Batch为输入 $1/$2、输出 $6/$9 [G2]。不要把一大段家庭史反复整本发送当成免费的“长记忆”。
- 输出价格包含thinking tokens [G2]。当前促销、context长度、缓存存储、视频采样、隐含思考都要进入真实成本账单。
- Gemini Batch目标周转24小时，内联请求小于20MB，更大任务可用最大2GB的JSONL输入文件 [G6]。这是目标周转说明，不是即时完成保证。
- 缓存页为3.8 Flash与3.1 Pro列出最小4,096输入tokens；相同大前缀短时间重复更可能命中隐式缓存 [G7]。本次缓存页未列3.5 Flash-Lite的最小值，不能外推。
- 价格页区分免费层“用于改进产品 Yes”和付费层“No” [G2]。开发者的免费原型成本不能直接套到私密家庭生产数据；需选择与对用户承诺一致的商业条款和数据配置。

## 4. Gemini Embedding 2：功能有价值，资料差异要留下记录

专属模型页与使用指南都使用 **`gemini-embedding-2`**，专属页明确 **Stable**；价格页同样使用此ID [G8,G9,G2]。然而总模型列表的 specialized task models 仍把endpoint列成 `gemini-embedding-2-preview` [G1]。因此这里以专属页+指南+价格页作为功能候选依据，并记录总览不一致；不建议仅凭本文立即更换生产检索模型。上线前还应以账户Models列表、真实请求和版本文档交叉核对。

| 输入 | Standard $/MTok | Batch $/MTok | 官方限制/解释 |
|---|---:|---:|---|
| 文字 | 0.20 | 0.10 | 总输入最多8,192tokens |
| 图片 | 0.45 | 0.225 | 每请求最多6张PNG/JPEG；价格页等效约$0.00012/张 |
| 音频 | 6.50 | 3.25 | 最多180秒，MP3/WAV；等效约$0.00016/秒 |
| 视频 | 12.00 | 6.00 | 最多120秒，最多32帧；不处理视频内音轨；等效约$0.00079/帧 |
| PDF | 未单列独立PDF单价 | 未单列 | 每请求1文件、最多6页；实际账单需按处理内容核验 |

费用 [G2]，输入规格 [G8,G9]。输出是向量，不是按生成文字输出token另外付费；向量数据库和存储另算。

输出维数128–3072，官方推荐768/1536/3072，默认3072；可用于跨文字、音频、视频和照片的统一空间检索，指南称跨100多语言 [G8,G9]。对Saga的合理候选任务是“用英文找出祖母母语录音里讲某个地点的片段”，但这需要用真实家族专名和混合语言样本测试检索召回，不能把多语言宣称当成通过评测。

迁移限制特别重要 [G9]：

1. `gemini-embedding-001` 与2的向量空间不兼容，升级必须重嵌全部已有数据，不能混在同一向量距离检索中。
2. embedding2不支持原有 `task_type` 参数，文字任务需在输入中写任务说明。
3. 一次直接传多个输入默认可能生成一个聚合向量；要逐条向量需正确包装Content或用Batch，不能当成“数组进、同长向量数组出”。
4. 视频 embedding **不处理音轨**；若想搜录像里说的话，必须另做音频/转写索引。它不替代文字事实账本和原声时间码。

英语家庭MVP仍可先采用简单文本embedding。统一多模态检索只有在用户确实拥有大量旧照片/录像、且文本索引召回不足时才值得增加。

## 5. 开放权重模型的商业托管对照：DeepSeek-V4.1-Flash

DeepSeek官方发布页链接其 Hugging Face 模型；官方组织仓库README frontmatter标注 `license: mit`，描述原生图片和文字输入、一百万上下文 [D2,D3]。因此它是可核实的开放权重对照项。这里比较的是**DeepSeek付费托管API**，不是建议Saga自建552B模型推理集群；自托管硬件和运维成本不在token价内。

当前建议使用的API ID为 `deepseek-flash`。定价页写其对应 DeepSeek-V4.1-Flash [D1]。

| 场景 | 未缓存输入 | 缓存命中输入 | 输出 | 单位 |
|---|---:|---:|---:|---|
| 峰时 | 0.30 | 0.006 | 1.20 | $/MTok |
| 非峰 | 0.15 | 0.003 | 0.60 | $/MTok |

峰时：周一至周五UTC 01:00–04:00及06:00–10:00，中国公共假期除外；其他时间非峰。换算台湾时间分别为09:00–12:00及14:00–18:00。非峰是峰价50%，不能全年按最低价预算 [D1]。定价页明确JSON output、tool calls、思考/非思考模式；未核验到该模型托管Batch统一折扣，不填假定价格。

**官方资料冲突：** [D1]仍单列 `deepseek-v4-pro` 的模型版本和价格；但2026-09-10发布公告[D2]说从2026-09-14 04:00 UTC起所有该ID请求改路由V4.1-Flash、按Flash价，直到V4.1-Pro发布。未做认证请求无法证明实际账户路由；因此不把“V4-Pro高档价”列为可独立选择的生产方案，也不建议使用旧alias作为质量固定点。

可以将DeepSeek纳入合成/获授权去标识样本的低价抽取、中文亲属专名、多语言混合编辑对照。但输入输出兼容OpenAI格式不等于行为、schema保证、数据处理条款和质量完全相同。是否接收私密家庭材料需单独确认合同和数据处理，不从MIT权重许可推导云服务隐私保证。

## 6. 费用示例与评测建议

假设一次文本任务确实计费30,000输入token和8,000输出token，无缓存、Batch、额外工具、重试或其他收费：

| 模型 | 本次理论token费用 |
|---|---:|
| Haiku 5.5（≤100K提示） | $0.007 |
| Sonnet 5.5 | $0.140 |
| Opus 5.5 | $0.280 |
| Gemini 3.8 Flash（2026优惠价） | $0.0525 |
| Gemini 3.8 Flash（2027已公告价） | $0.105 |
| Gemini 3.5 Flash-Lite | $0.029 |
| DeepSeek Flash（峰时） | $0.0186 |

这是算术示例，不是“30分钟录音成本”：音频转写、生成思考、人物图谱、后续核查、不同tokenizer和输出长度都会改变真实费用。Anthropic定价页还明确其4.7及以后tokenizer对同一文字约产生30%更多token，具体依材料不同 [A2]，因此不能单凭每MTok标价判定端到端最便宜。

建议以至少以下错误类型作为候选筛选，不用通用榜单替代：

- 是否添加原稿没有的事件、因果、情绪、亲属关系或确定年份；
- 专名、代词、口音错词、跨语言称谓的正确性；
- 每条事实是否能落到真实source ID/音频时间码，引用是否真正支持句子；
- 同一故事的冲突说法是否并列保留，避免替家人作最终裁决；
- 照片/视频描述是否把猜测人物身份、地点、年份写成事实；
- 检索是否找到相关原声，且不会返回未授权家庭成员或其他项目的数据；
- 人工修订分钟数、最终每个“家人接受并可导出故事”的总成本和p95延时。

多厂商流水线可作为采购候选；增加第二模型的核查并不自动使结果正确，仍需对照证据并允许人工拒绝。建议首先固定一个主编辑+应用端事实校验，再用样本证明第二模型复核能减少重大错误，才承担额外复杂度。

## 7. 来源清单与核验边界

所有链接均在2026-10-08读取官方页面。A6/A7传输在25秒后超时，但已经收到文档正文，包括支持模型/兼容性段落；本报告只引用收到的部分，没有声称完整下载。其余列出的页面成功读取。未引用厂商基准成绩作为Saga实测。

- [A1] Anthropic Models overview — https://platform.claude.com/docs/en/about-claude/models/overview
- [A2] Anthropic Pricing — https://platform.claude.com/docs/en/about-claude/pricing
- [A3] Claude Sonnet 5.5 — https://platform.claude.com/docs/en/models/sonnet-5-5/overview
- [A4] Claude Opus 5.5 — https://platform.claude.com/docs/en/models/opus-5-5/overview
- [A5] Message Batch processing — https://platform.claude.com/docs/en/build-with-claude/batch-processing
- [A6] Structured outputs — https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- [A7] Citations — https://platform.claude.com/docs/en/build-with-claude/citations
- [A8] Embeddings（明确无自有embedding模型）— https://platform.claude.com/docs/en/build-with-claude/embeddings
- [G1] Gemini model catalog — https://ai.google.dev/gemini-api/docs/models
- [G2] Gemini Developer API pricing — https://ai.google.dev/gemini-api/docs/pricing
- [G3] Gemini 3.8 Flash — https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash
- [G4] Gemini 3.5 Flash-Lite — https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite
- [G5] Gemini 3.1 Pro Preview — https://ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview
- [G6] Gemini Batch API — https://ai.google.dev/gemini-api/docs/batch-api
- [G7] Gemini context caching — https://ai.google.dev/gemini-api/docs/caching
- [G8] Gemini Embedding 2 专属模型页 — https://ai.google.dev/gemini-api/docs/models/gemini-embedding-2
- [G9] Gemini embeddings 使用指南 — https://ai.google.dev/gemini-api/docs/embeddings
- [D1] DeepSeek Models & Pricing — https://api-docs.deepseek.com/quick_start/pricing
- [D2] DeepSeek-V4.1-Flash 2026-09-10公告 — https://api-docs.deepseek.com/news/news260910
- [D3] DeepSeek官方组织模型README（含MIT许可元数据）— https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/raw/main/README.md

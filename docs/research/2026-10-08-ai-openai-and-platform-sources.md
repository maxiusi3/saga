# AI专题：OpenAI与平台组件官方核验记录

核验日期：2026-10-08。用途：支持[独立AI架构与三档模型方案](2026-10-08-ai-blueprint-and-model-tiers.md)。这里记录官方可读页面的事实，不把厂商能力描述当作Saga的实测结果。采用公开文档读取，未调用付费推理API、读取密钥或上传家庭资料。

## 1. 模型、价格与边界

文本金额均为美元/百万token；Standard、未缓存、短上下文，不含区域附加费、税费与工具费。输出预算需要包含供应商计费的推理token，不能只数用户看见的成稿。

| 模型ID | 输入 / 输出 | 核实能力与选型边界 |
|---|---:|---|
| `gpt-6-luna` | $0.10 / $0.50 | 文本、图像输入；文本输出；structured outputs/function calling；适合列为大量提取、标签、简短问题和低价编辑候选。支持none推理档。并非音频识别模型。 |
| `gpt-6.1-sol` | $2 / $10 | 文本、图像输入；文本输出；工具调用使用Responses API，Chat Completions不支持其工具调用；不支持none/minimal推理档。列为主编辑/证据检查候选。 |
| `gpt-6-astra` | $10 / $50 | 文本、图像输入；文本输出；支持结构化输出与工具。SOTA优先修订中作为常规证据复核候选；不凭旗舰名称保证回忆真实性。 |
| `text-embedding-3-small` | $0.02 / — | 默认1536维、单条最大8192输入token；可设置dimensions。 |
| `text-embedding-3-large` | $0.13 / — | 默认3072维、单条最大8192输入token；可设置dimensions。更大模型是否改善家庭检索，需要专用测试。 |

前三个模型的文档上下文窗口为1,050,000，最大输入922,000、最大输出128,000；这是上限，不是建议一次塞入整家所有资料。超过272K输入token时，整次请求输入/缓存价×2、输出价×1.5；可用区域处理的附加费为10%。Batch/Flex为Standard的50%，Fast通常×2。报告预算不假设缓存命中或Batch折扣。官方模型页本次仅列同名别名，没有可自行虚构的日期快照。[O1–O5]

| 语音/图像模型ID | 抓取日计价 | 限制 |
|---|---|---|
| `gpt-4o-mini-transcribe` | 官方estimated cost $0.003/分钟 | 与有说话人分离的模型不同；不能由此推定含逐词时间戳。 |
| `gpt-transcribe` | 官方estimated cost $0.0045/分钟 | 普通文件转写候选。 |
| `gpt-4o-transcribe-diarize` | 官方estimated cost $0.006/分钟 | ASR及说话人分离候选；详细返回字段见语音专题。 |
| `gpt-realtime-2.1-mini` | 音频输入$10、输出$20/MTok；文本$0.60/$2.40 | 音频token与文本token分开；不能拿文本价乘录音时长。 |
| `gpt-realtime-2.1` | 音频输入$32、输出$64/MTok；文本$4/$24 | 同上；上下文、缓存和可选转写会影响总价。 |
| `gpt-live-1` | $0.05/会话分钟，按秒结算 | full-duplex；听说可同时进行，推理和工具委派后台；后台模型/工具另付。音频与文本输入输出，不支持图像/视频、structured outputs。文档列付费Build档50并发、Launch300、Grow500；账户实际权限仍须在采购时确认。 |
| `gpt-4o-mini-tts` | 文本输入$0.60/MTok、音频输出$12/MTok | 输入上限2000token；本次不把以前常见的分钟近似价当固定合同价。 |
| `gpt-image-2` | 图像输入$8、输出$30/MTok；文本输入$5/MTok | 图像生成/编辑的预算须计算输入图及生成图token，不等于每张统一价格。只建议用于明确标注的艺术衍生品。 |

音频与图片价格来自[O1]，能力来自[O7–O9]及[语音供应商记录](2026-10-08-ai-speech-sources.md)。普通文字模型的image input与专用image generation是两条不同能力。

## 2. 会影响架构的事实

- **持久任务和Batch是两件事。** OpenAI Batch公布24小时完成窗口和50%折扣，端点包含Responses、Chat Completions、embeddings等，本次列表未含audio/transcriptions。Saga自己仍须保存任务状态、结果和失败信息；不能依赖浏览器保持连接。[O10]
- **不训练不等于不保留。** API默认不用于训练，除非明确选择共享；通用滥用监控最长30天并有例外。`/v1/audio/transcriptions`表中监控与应用状态均None，`/v1/embeddings`和`/v1/realtime`的监控为30天；Responses、缓存、Background和Live持久化还须看各自脚注。ZDR/MAM有资格与审批条件。`store:false`不是对整个供应链零留存的保证。[O6]
- **区域选择属于模型路由约束。** 模型、功能、端点的区域处理资格分别列出；Realtime tracing本次文档仍注明不符合EU data residency。不能把一种API的资格推广到所有语音、媒体、日志和故障切换路径。[O6]
- **图片费用与尺寸有关。** 官方说明视觉输入会计为token，token化方式按模型/尺寸/detail而变，可能存在缩放。主报告照片项采用显式的计费token预算，不声称每张照片固定token数。元数据需要应用自己提取；模型不自动处理原始文件名和EXIF。[O11]
- **可恢复编排不自动解决重复扣费。** Temporal用事件历史恢复Workflow，通过Activities执行外部调用，Activity可能因超时重试。应用仍需供应商request ID、幂等键、已完成结果复用、成本预留与超时后的状态查询；无法保证所有第三方接口恰好执行一次。[P1–P2]
- **小型家庭检索不必先建独立向量服务。** pgvector支持与PostgreSQL全文检索组合及RRF；小家庭可以先对授权子集精确检索。近似索引的过滤可能发生在索引扫描之后，影响召回；需迭代扫描/分区/精确查询等方案，不能先跨家庭取片段再交给LLM筛权限。[P3]
- **向量维度要与索引相容。** 本次pgvector文档中HNSW的vector上限2000维、halfvec上限4000维。1536维small直接适用；3072维large需要halfvec或经验证的降维。换embedding模型必须单独重建索引，不能在同一空间混排新旧向量。[O5、P3]

## 3. 来源账本

全部于2026-10-08直接抓取官方正文；未以搜索摘要代替价格表。

- **O1** [OpenAI API Pricing](https://developers.openai.com/api/docs/pricing)，另有[Markdown正文](https://developers.openai.com/api/docs/pricing.md)。标准价、语音、embedding、图片及附加费用。
- **O2** [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)。能力、价格、推理和上下文。
- **O3** [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol)。能力、价格与工具接口限制。
- **O4** [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra)。能力、价格与上下文。
- **O5** [Vector embeddings](https://developers.openai.com/api/docs/guides/embeddings)。维度、输入上限及语义检索。
- **O6** [Data controls](https://developers.openai.com/api/docs/guides/your-data)。训练、保留、缓存、端点与区域条件。
- **O7** [GPT-Live 1](https://developers.openai.com/api/docs/models/gpt-live-1)。full-duplex、后台委派、分钟价与付费并发档。
- **O8** [GPT-4o Mini TTS](https://developers.openai.com/api/docs/models/gpt-4o-mini-tts)。文本/音频价与2000输入token上限。
- **O9** [Using GPT-6](https://developers.openai.com/api/docs/guides/latest-model)。官方模型定位，只用来确定候选角色，不作为Saga质量排名。
- **O10** [Batch](https://developers.openai.com/api/docs/guides/batch)。50%、24小时及支持端点。
- **O11** [Images and vision](https://developers.openai.com/api/docs/guides/images-vision)。视觉输入计费、缩放、元数据和能力限制。
- **P1** [Temporal Workflow Execution](https://docs.temporal.io/workflow-execution)。事件历史和恢复。
- **P2** [Temporal Activity Execution](https://docs.temporal.io/activity-execution)。外部任务、超时和重试。
- **P3** [pgvector官方README](https://github.com/pgvector/pgvector)。混合检索、过滤、向量类型与索引限制；本次读取其官方仓库master正文，后续部署应锁定发布版本。

报价、模型别名、资格和促销都有可能变化。报告给出的是核验日可实施的候选方案，不保证用户账户已经开通所有模型，也没有证明任何一家在英语长辈、杂音、家族专名或忠实编辑任务中最好。

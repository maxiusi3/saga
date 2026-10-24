# Saga：SOTA选型依据与证据边界

核验：2026-10-08。用于修订[AI架构主报告](2026-10-08-ai-blueprint-and-model-tiers.md)。本篇记录文字、视觉和检索证据；语音见[独立语音评测](2026-10-08-ai-sota-speech-evidence.md)，开放权重与硬件见[本地部署研究](2026-10-08-ai-local-deployment.md)。未进行付费推理或家庭素材实测。

## 1. 怎样满足“尽量用SOTA，减少试错”

先为每个关键环节选一个有前沿证据、可接入且满足输出要求的高质量基准；遇到实际失败再引入一个挑战者。参考顺序是：任务相关的独立评测 → 官方能力与可用性 → Saga自己的保留测试集 → 总成本。模型名气和单价都不能替代这些判断。

这里将证据分成三类，避免把整个推荐组合宣传成“每一项全球第一”：

- **独立评测领先组：** 指定榜单、任务、日期、模型版本和推理配置，结论限于该评测。
- **可落地旗舰候选：** 官方当前强模型且具备必需能力，但没有足够独立证据证明它在Saga任务中领先。
- **观察或挑战者：** 排名高但可用性、功能或证据覆盖不全，不能直接替换生产基准。

SOTA路线减少的是从低能力模型开始反复调试的成本；它仍需要少量业务验收。若转写错误、检索漏源或提示要求错误，更强的编辑器也未必能补救。

## 2. 文字推理与写作

### Artificial Analysis Intelligence Index

直接读取[模型榜](https://artificialanalysis.ai/leaderboards/models)及[方法说明](https://artificialanalysis.ai/methodology/intelligence-benchmarking)。核验日页面列出：

| 模型与评测配置 | Intelligence Index |
|---|---:|
| Claude Opus 5.5，max with fallback | 58 |
| Claude Sonnet 5.5，max with fallback | 56 |
| Claude Opus 5.5，xhigh with fallback | 56 |
| Claude Opus 5.5，high with fallback | 54 |
| Claude Fable 5.1，max / xhigh | 各53 |
| GPT-6 Astra，max | 53 |
| Gemini 4 Argon，high | 53 |

方法版本v4.3.2包含10项评测，权重为agentic 30%、coding 20%、scientific 20%、general 30%，主要是文字/英语。它不是传记忠实度、长辈访谈或照片理解测试。`max with fallback`也不是API默认参数；不能把58分附到任意Opus调用上，更不能把不同推理努力下的分数当同成本比较。

**决策：** Opus 5.5是有独立前沿证据的文字基准。Saga先显式设`high`作离线质量基准；难例再比较`max`，记录真实推理输出和等待时间。普通调用与榜单封装并不完全相同，不能承诺复现分数。GPT-6 Astra列为跨模型证据复核候选，理由是旗舰能力与不同模型家族；本轮没有证明它是“全球最强事实核验器”。

作为开放权重路线的补充，同一AA页面中GLM-5.3（max）为45，Qwen3.8 27B（xhigh）为34。官方已确认GLM权重可取得，但约753B总参数和自定义许可使它属于机构多卡评估；不能用27B单机的部署方便代表全部开放模型上限，也不能用通用指数证明家史质量。权重、运行时及许可依据见[本地专题](2026-10-08-ai-local-deployment.md)。

### Arena文字偏好榜

[Arena Text](https://arena.ai/leaderboard/text)页面显示日期2026-10-02，8,626,731票、413模型。Gemini 4 Argon high为1525±9、Preliminary、4,932票；Opus 4.6 high 1505±3；Fable 5 high 1504±4；Opus 5.5 high 1504±9、4,552票。

这是用户偏好证据，不能直接推导无来源陈述更少。它与AA的次序不同，说明不存在一个所有维度通用的第一名。

### 最新不等于已经可接入

[Google的Gemini 4 Argon公告](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-argon/)日期2026-09-30：当时向Fairwind可信网络防御伙伴开放，更广泛的开发者/消费者接入仍为即将推出。公告写出的初期$2/$10、后续$4/$20每百万输入/输出token，不能证明Saga账户已经能使用。

**因此不把Argon写成今天可直接购买的默认API，也不猜API ID。** 排名高而无法一般接入，会增加等待和集成不确定性。

### Claude当前官方建议

[模型总览](https://platform.claude.com/docs/en/about-claude/models/overview.md)建议多数工作从Opus 5.5开始，只有要求更高的推理/长程任务，或Opus更高effort仍不足时用Fable 5.1。

| 模型ID | 官方基础输入/输出价（美元/MTok） | 本报告角色 |
|---|---:|---|
| `claude-opus-5-5` | 4 / 20 | 提取、组织、编辑、常规照片与翻译的初始质量基准 |
| `claude-sonnet-5-5` | 2 / 10 | 基准通过后才做降本对照 |
| `claude-fable-5-1` | 10 / 50 | 复杂推理、困难视觉/长材料的一个挑战者 |
| `claude-haiku-5-5` | ≤100K：0.10 / 0.50；更长0.50 / 2.50 | 后续结构化轻任务优化，不先放在关键事实链路 |

[Fable 5.1官方页](https://platform.claude.com/docs/en/models/fable-5-1/overview.md)列Active、2026-09-01、1M上下文、128K输出、文字/图像输入，thinking始终启用，forced tool use不支持。更贵和更新不保证在AA或Saga所有任务上更强。

Claude当前无日期的这些ID也是官方固定快照；不能将所有无日期ID一概说成浮动别名。其他供应商按各自版本规则登记。

## 3. 视觉、视频与图像生成

[Arena Vision](https://arena.ai/leaderboard/vision)显示2026-10-02、1,436,923票、159模型：Fable 5 high首位1309±7，排名范围1–10；Qwen3.8-max 1301±7，范围1–16；Opus 4.6 high 1299±6。区间大量重叠，不能声称显著拉开。

**三个版本边界：** Fable 5的成绩不能赋给Fable 5.1；Qwen3.8-max不是本地Qwen3.8-27B；Opus 4.6不是5.5。Saga为了少集成，先用文字主模型Opus 5.5处理一般照片；复杂手写/OCR以Fable 5.1为挑战者，属于官方能力推断，不是已验证视觉排名第一。

[Gemini 3.8 Flash模型页](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash)确认Stable、文字/图像/视频/音频/PDF输入、文字输出，1,048,576输入、65,536输出token；它不是Live、TTS或图像生成模型。高要求视频理解将Gemini 3.1 Pro Preview列为优先质量候选，3.8 Flash为稳定版本对照；本轮没有找到能直接证明这两者在家庭录像上谁最好的独立评测。Preview隔离于可重跑任务，不作为原件唯一保存或唯一理解途径。[Google价格与模型入口](https://ai.google.dev/gemini-api/docs/pricing)

[GPT Image 2.5 Sunburst](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst.md)是官方当前最强图像生成/编辑候选，ID `gpt-image-2.5-sunburst`，快照`gpt-image-2.5-sunburst-2026-09-08`。文字输入$5/MTok、图像输入$8、输出$30，Batch图像输出$15。**GPT Image 2计算器不能推算2.5的token消耗。** 本次未完成独立图像生成榜核验，不称它全球第一。只用在明确标注的插画、修复衍生图中，不能从生成细节反推家庭史。

视频成品先用原声、原片、字幕和确定性编排。虚构场景生成不是首期必要能力；若将来销售此类艺术衍生品，应独立核验当时的视频模型，而不是现在指定一个未经查证的“未来SOTA”。

## 4. Embedding与reranker

[Voyage模型文档](https://docs.voyageai.com/docs/embeddings)列`voyage-4-large`，32K上下文、1024默认维度，支持256/512/2048。[reranker文档](https://docs.voyageai.com/docs/reranker.md)列`rerank-3`为最高准确率/多数应用推荐、32K上下文；这些是供应商能力说明。

直接检查[MTEB的RTEB English beta页面](https://mteb-leaderboard.hf.space/benchmark/RTEB%28eng%2C%20beta%29)：可见rank 1为`mongodb/voyage-4-large (embed_dim=2048, evolved_prompts=True)`，rank 2为`nvidia/Nemotron-3-Embed-8B-BF16`；Voyage 4 large普通默认配置在另一行。**Rank是Borda排名，多数Mean(Task)为“—”，头部模型数量与可见行不一致，Private列暂移除。** 本次不从该页面摘一个缺乏完整分母的“准确率”，也不把带特定提示/2048维的第一行等同默认API。

[Voyage 4发布评测](https://blog.voyageai.com/2026/01/15/voyage-4/)报告29组RTEB数据的nDCG@10优势，但这是2026-01-15供应商选定比较集，不能证明10月对所有最新模型仍领先。上述两类证据支持它作为前沿候选，不能独立证明全球最优。rerank-3同样缺本次已核验的跨厂商全球第一证据。

**决策：** 用`voyage-4-large`＋`rerank-3`建立完整检索基准，避免先用便宜embedding＋临时LLM重排，再把召回问题误诊为写作模型问题。在本报告的小库预算里，两者加起来每家庭约$0.0071，先省这部分没有明显价值。

原始文本、人物/日期关键词与结构化过滤仍保留。建议基准明确设置2048维；Postgres近似索引用`halfvec`或先做家庭子集精确搜索，因为普通`vector`的HNSW维度上限为2000。halfvec/降维也要核查召回变化。[pgvector官方限制](https://github.com/pgvector/pgvector)

[2026-09-29更新的价格表](https://docs.voyageai.com/docs/pricing.md)：voyage-4-large $0.12/MTok；4 $0.06；4-lite $0.02；rerank-3 $0.05，3-lite $0.02。rerank计费token为“查询长度×候选数量＋全部候选长度”，不是只付一次查询。Batch折扣33%、12小时完成窗口，不能混用其他厂商50%的比例。本报告不计免费额度。

Voyage 4家族官方说明共享向量空间：本地`voyage-4-nano`可产生与云端4-large兼容的查询向量，但必须对齐维度、输入类型和编码约定，并验证质量。这个特例不适用于任意两种embedding。切到Nemotron或Qwen需重建索引，不能直接混算。

## 5. 推荐不是已经完成的模型实验

还没有实测以下结论：Opus对Saga的文风优于其他旗舰；Astra能显著降低事实错误；Fable能识别更多旧照片手写字；本地27B可达到云端旗舰的忠实度；某英语榜单对目标长辈口音同样有效。

上线前采用同一批授权素材和相同验收标准，优先核查人名、年份、人物归属、无来源增写、修改分钟和原声回放。只给出现具体失败的环节增加一个挑战者。成本档位随后由这套基准降级验证，不能把低、中、高价命名直接当质量实验结果。

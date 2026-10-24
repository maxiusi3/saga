# UR Saga：语音模型 SOTA 证据与收敛选型

**核验日期：2026-10-08｜面向英语家庭口述史｜研究与选型建议，未调用付费模型、未上传家庭录音、未安装模型**

本报告重新回答“尽量接近 SOTA，同时少做选型试错”。它补充并修正[此前的语音资料报告](2026-10-08-ai-speech-sources.md)中的采购倾向：官方功能说明能证明可用性，不能单独证明质量领先。下面把独立评测、厂商自测和工程判断分开，并按任务保留一个主选和至多一个挑战者。榜单为读取当日快照，不代表之后的排名。

## 1. 直接采用什么

| 任务 | 主选 | 唯一挑战者／替代条件 | 判断依据 |
|---|---|---|---|
| 导入家庭录音，形成可回放的转写档案 | **ElevenLabs `scribe_v2`** | **StepFun `stepaudio-3-asr-max`**，用于疑难片段的第二意见；补齐对齐能力后才考虑全面替换 | Scribe v2 在独立英语 ASR 榜接近领先组，且官方同时提供逐词时间戳、说话人分离。StepAudio 3 ASR 榜单领先，但榜单名称与具体 API ID 的严格映射尚未建立，当前读取的 SSE 文档也未提供逐词时间戳或说话人字段 |
| 多人、抢话、身份归属困难的录音，独立加强说话人分离 | **pyannoteAI `precision-3`**，按需要调用 | **`pyannote/speaker-diarization-community-1`**，本地处理或控制云费用时 | Precision-3 是厂商当前最高精度模型；独立学术比较支持的是上一代 Precision-2，不能把上一代排名直接授予 Precision-3。Community-1 有明确离线运行路径 |
| 故事集旁白、访谈员固定声音 | **ElevenLabs `eleven_v4_turbo`** | **Qwen-Audio-3.1-TTS-Plus**，统一声线榜第一；官方具体 API ID、区域与采购条件核清后才接入 | Turbo 位于原生声线独立榜第一组，且其常价低于 v4；Qwen 是另一个评测维度的领先者。此处 Qwen 云服务不是开源 Qwen3-TTS |
| 自然实时访谈，能用工具查资料与安排后续问题 | **OpenAI `gpt-live-1`＋Astra，medium** | **`stepaudio-3-realtime-preview`**，若轮替和打断比工具任务完整度更关键 | Live＋Astra 当日 AA 综合指数最高；StepAudio 3 的双工动态与语音推理单项最高，但综合评测缺项、版本仍处于试用生命周期 |

这些是可执行的默认值，不是宣称四项都已经证明适合所有家庭。特别是“ASR 正确率”“谁说了这句话”“说话好听”“访谈主持得好”是四项不同能力，不能用其中一个第一名包办其他任务。

**Nova-3 应改为成熟吞吐基线，不再作为精度优先的默认 ASR。** 它并非因为用户不熟悉就不可靠；但在当日独立准确率与官方价格证据下，也没有理由仅凭成熟度让它占据 Saga 的默认位置。Scribe 的基础目录价甚至更低，详见第3节。

## 2. 本次什么证据算数

| 证据层 | 例子 | 能支持什么 | 不能支持什么 |
|---|---|---|---|
| 独立评测机构原榜＋方法 | Artificial Analysis ASR、TTS、Speech-to-Speech | 同一评测定义下，指定模型／服务的相对结果 | 自动推断中文、长辈低音量、家庭专名、长时间情感访谈也保持相同排名 |
| 独立研究者原论文 | ETH Zurich《Benchmarking Diarization Models》 | 论文中明确版本、数据和 DER 设置下的比较 | 把2025年的 Precision-2、pyannote 3.1 结果外推到2026年的 Precision-3、Community-1 |
| 官方模型卡／API文档 | StepFun、ElevenLabs、OpenAI、pyannote、Qwen | 真实 ID、输入输出、语言、部署和许可路径 | 把厂商自报“最好”“更准确”当作独立横向结论 |
| Saga 的工程判断 | 优先返回词时间戳的 ASR；独立分离只处理难例 | 降低集成与人工校对负担的合理方向 | 宣称已经实测节省多少工时或提高多少转化率 |

搜索摘要只作为找页面的线索。文中数值均来自实际读取的榜单正文、方法页、官方文档或论文；没有用未打开的媒体转载代替原始证据。

## 3. ASR：Scribe 是高质量完整接口基准，Step 是精度上限挑战者

### 3.1 当日独立结果

Artificial Analysis 的 **AA-WER v2，非流式转写**显示以下结果。WER 越低越好；这是识别文字的错误率，不是说话人分离错误率。[S1][S2]

| 榜单原始名称 | AA-WER v2 | 对 Saga 的解读 |
|---|---:|---|
| StepAudio 3 ASR, StepFun | **1.7%** | 当日并列最低；公开 API 已核，榜单到具体 ID 的映射仍有一处缺口 |
| Fun-Realtime-ASR-preview | **1.7%** | 并列最低；名称包含 Realtime，但这里跑的是非流式基准；本报告未完成该预览接口的生产采购核验 |
| MAI-Transcribe-2 | **2.0%** | 非常有竞争力，且官方提供词时间戳、说话人信息；Azure 官方仍标 public preview、无 SLA，并不建议生产负载，因此不增加为第三个部署候选 [S5] |
| Scribe v2 | **2.2%** | 接近领先组；适合用完整输出直接建立原声索引 |
| Grok Voice Transcribe 2.0 | 2.3% | 证明当前前列并非只有传统语音公司；本报告未继续扩张采购候选 |
| Voxtral Small | 2.8% | AA 当日标注的开放权重最优项；不能据此推断普通笔记本部署负担 |
| Universal-3 Pro, AssemblyAI | 3.1% | 必须保留这个榜单版本名，不能将结果擅自套到官方当前 `universal-3-5-pro` |
| GPT Transcribe, OpenAI | 3.3% | 有可用官方接口，但此榜不支持把它称为最高精度 |
| Nova-3, Deepgram | 5.2% | 非准确率领先；其当日批量速度因子约 **628.1×**，体现吞吐优势 |

**评测边界。** AA-WER v2 约8小时音频，由 AA-AgentTalk 50%、VoxPopuli-Cleaned-AA 25%、Earnings22-Cleaned-AA 25%组成。VoxPopuli 采用英语子集；这些结果应视为英语工作负载证据，不能用来宣布中文或方言 SOTA。AA 直接调用服务端点，使用统一规范化处理，包括数字、标点、拼写及部分填充词；因此低 WER 也不证明逐字保存所有“嗯、啊”和停顿。部分模型因输入限制采用约9分钟或约30秒切块，长音频比较并非所有模型完全相同的输入方式。[S2]

### 3.2 为什么仍主选 Scribe，而不直接用榜首替换

Scribe v2 的官方 API 提供逐词时间戳与最多32位说话人标注。Saga 需要点击一句话就回到原声，因而最终目标是“正确文字＋准确归属＋可回放出处”，并非只产出一段最像正确答案的文本。Scribe 的独立 WER 比 Nova-3 更好，基础目录价为 **$0.22/音频小时**，并没有要求为这个初始选择接受明显更高的按量 ASR 费用。[S1][S6]

StepFun 官方已明确提供 **`stepaudio-3-asr-max`**，`POST /v1/audio/asr/sse`；一次提交 Base64 音频，通过 SSE 返回增量文字与最终文字。语言参数支持 `zh`、`en`、`ja`、`ko`、`fr`、`es`，其中后四种在文档中标为 preview。模型页标价 **$0.24/小时**。[S3][S4]

但本次有两项明确缺口：

1. AA 原榜名称是 **StepAudio 3 ASR**，官方推荐名称是 **StepAudio 3 ASR Max／`stepaudio-3-asr-max`**。本次未找到 AA 明确公开该榜单条目请求的精确模型 ID，故不能把1.7%写成已验证的 `stepaudio-3-asr-max` 复现成绩。
2. 已读取的 SSE 返回结构只有文字、usage、事件时间；`meta.timestamp` 是服务器 Unix 事件时间，**不是原音频里的词时间戳**。文档也未列说话人标签。不能把它当成 Scribe 的无缝完整替代。

因此，Step 更适合首先进入疑难片段复核插槽：给它同一段音频，发现候选词差异；保留 Scribe 的原始时间轴，对人工接受的改字另做对齐。不要让第二遍文字静默覆盖已有词时间和人物归属。若后续取得匹配的对齐、说话人能力与明确部署条款，再考虑主备倒置。

### 3.3 Nova-3 的真实定位

Deepgram 是有持续产品线与成熟接口的专门语音服务商。Nova-3 提供词时间、批量／流式转写、说话人分离等实用接口；其高吞吐适合机构导入大量旧录音。AA 的628.1×是10分钟批量音频测试、近期中位数且包含网络的速度因子，**不能解释成实时对话延迟**。[S1][S2]

当日 Deepgram 预录单语 PAYG 基础价 **$0.0043/分钟＝$0.258/小时**；Scribe v2 为$0.22/小时，Step 模型页为$0.24/小时。差距很小，人工校对更值得关注。此前“低价默认 Nova”不应继续成为无条件结论；尤其 Deepgram `mip_opt_out=true` 后能否保留该目录价，本次公开资料仍未建立。[S6]

Nova 的批量 diarization v2 与流式 v1 也须区分；旧 `diarize=true` 未必自动切到最新批量版本。若保留 Nova 作基准，需要固定实际版本，不能只记录营销产品名。[S6]

### 3.4 确有本地处理要求时

**英语、NVIDIA资源充足且优先质量：选 `mistralai/Voxtral-Small-24B-2507` 作为本地高质量候选。** AA原榜的 Voxtral Small 为2.8%，当日开放权重领先；同页公开嵌入数据注明请求的 `hostApiId` 为 `voxtral-small-2507`，与Mistral官方24B／2507模型系列对应，不能误换成 Voxtral Mini Transcribe 2。[S1][L2]

官方模型卡为 **Apache-2.0**，推荐 **vLLM≥0.10.0**，也支持 Transformers；原卡说明 BF16／FP16 运行约需 **55GB GPU RAM**，服务示例采用 tensor parallel 2。32K上下文支持最多约30分钟转写，主要覆盖英、西、法、葡、印地、德、荷、意语；没有据此承诺中文。它适合大显存单卡或多卡服务器，**不能作为24／32GB卡完整FP16的直接方案**。公开示例具备专门 transcription mode，但本次没有建立词级时间戳与说话人标签的原生输出保证，仍要另接对齐与分离。AA测试的是其托管API，2.8%不是本次自托管复现结果。[L2]

**资源受限或需要更广多语言：用 `Qwen/Qwen3-ASR-1.7B` 作实用替代**，资源紧张可换同家族0.6B。官方提供 `qwen-asr` 的 Transformers／vLLM 后端，Apache-2.0；词时间需要另配 **`Qwen/Qwen3-ForcedAligner-0.6B`**。对齐器覆盖11种语言、单段最长5分钟，不能把 ASR 的30种语言覆盖直接套给对齐器。[L1]

英语／欧洲语言、尤其 Apple 原生部署条件下，保留 **`nvidia/parakeet-tdt-0.6b-v3`** 作为一个替代：25种欧洲语言、词／段时间戳，官方 `NeMo-Speech.cpp` 已列 CPU／Metal／Vulkan／CUDA 路径，不能默认非 NVIDIA 机器无路可走；它不含中文。[L1] AA 当日 Together AI 托管的该型号 WER 为4.5%，低于同表 Nova-3，但不能把云端吞吐数据当成本机速度。[S1]

按条件只实施其中一条路线：大显存质量优先选 Voxtral；广语言或有限资源选 Qwen；Apple英语部署便利优先考虑 Parakeet。**没有独立证据证明 Qwen3-ASR-1.7B 是当日英语开放权重第一**，也不能把Parakeet部署便利改写成准确率第一。具体硬件与许可证见[本地部署专题](2026-10-08-ai-local-deployment.md)。

## 4. 说话人分离：用专用层处理高代价错误

“爷爷说过这件事”被错误归给奶奶，即使文字全对，也会污染家族档案。Scribe 的内置分离先覆盖普通录音，**独立 `precision-3` 用于多人、重叠、切分明显异常或归属反复修正的材料**，无需默认每份录音叠两次分离。

### 4.1 独立比较支持到哪里

ETH Zurich 研究者2025-09-30的论文比较196.6小时、四套数据，包含英语、普通话、德语、日语和西班牙语。总体上商业 PyannoteAI **Precision-2：11.2% DER**，开放模型 **DiariZen：13.3% DER**。设置为 **0.25秒 collar，`skip_overlap=False`**，因此重叠讲话计入评价。[D1]

该论文的开放 pyannote 是 **3.1**，不是 Community-1；商业版是 **Precision-2**，不是 Precision-3。论文也显示某些 Sortformer 模型的4人上限会在更多说话人录音上带来归属问题。它提供的是版本明确的独立依据，不能直接用来给今天所有模型排总榜。

### 4.2 当前模型和费用

pyannote 当前官方文档将 **Precision-3**列为最准确型号，需显式请求 `model: "precision-3"`；默认仍是 **Precision-2**。Precision-3 支持重叠与 VAD 灵敏度设置、每20ms概率输出以及便于与转写对齐的 exclusive diarization。厂商称相对 Community-1 平均“更准确34.2%”，这是厂商结论，不能改写成独立确认的 DER 降幅或准确率。[D2]

| 方案 | Precision-3 标价 | 固定采购条件 |
|---|---:|---|
| Developer | **€0.112/音频小时** | **€19/月，含€19使用额度** |
| Starter | **€0.096/音频小时** | **€99/月，含€99使用额度** |
| Enterprise | 协商 | 官方支持自托管等部署方式；不是免费下载商业权重 |

价格为欧元，不与其他表的美元直接相加。低使用量项目必须把月费下限纳入预算，不能只报“分离一小时约一毛钱”。页面有免费试用，不进入长期成本；STT orchestration 为另一产品，不把这里的分离费解释成已经包含 Scribe 转写。[D3]

**本地替代只保留 Community-1。** 官方模型卡提供离线加载、CPU默认运行与 CUDA 示例、词转写对齐所需的 exclusive diarization，模型为 CC-BY-4.0。初次下载需要接受模型条件，之后可离线运行。其官方2025-09基准不设 collar、保留重叠，所以不能把该卡 DER 与上述论文的11.2%直接横比。[D4] 细节见[本地部署专题](2026-10-08-ai-local-deployment.md)。

exclusive diarization 方便给词选一个主要说话人，但不代表真实录音没有抢话；应另保存重叠标注。模型产生的 speaker_0 也不是已验证的真实人物姓名。

## 5. TTS：Eleven v4 Turbo 是更有依据的当前主选

### 5.1 两个原榜回答不同问题

| 模型 | Provider Voice 原生声线榜 | Controlled Voice 统一声线榜 |
|---|---:|---:|
| **Eleven v4 Turbo** | **1332 ±19**，排名范围1–2 | **1169 ±15**，排名范围1–3 |
| Eleven v4 | 1324 ±17，排名范围1–2 | 1159 ±15，排名范围2–3 |
| **Qwen-Audio-3.1-TTS-Plus** | 1295 ±17，排名范围3–4 | **1184 ±16**，排名范围1–2 |

以上为 AA 当日 Elo 和95%区间。[T1][T2] **两个榜独立拟合，不能把1332与1184跨榜相减。** Turbo 和 v4 区间重叠，不能说 Turbo 已被统计证明声音一定更好；Qwen 与 Turbo 在统一声线榜的区间也重叠。

AA 原生声线榜采用供应商公开声线，主要覆盖 US／UK、男女声组合；统一声线榜通过相同专业参考声音的克隆，控制音色偏好。匿名双盲成对选择，经音量和格式统一；大多数投票来自筛选过的付费英语母语评审。模型公司可以建议某些公开声线，所以原生声线结果更接近“模型＋可选声音产品”的体验，不是完全剥离声线的架构比较。[T3]

Saga 初期用中性旁白和固定访谈员声音，原生声线榜十分相关，因此 **`eleven_v4_turbo` 比较适合作为直接采用值**。已核官方常价 **$40/百万字符**，v4 为$80；2026-10-12前促销不计入长期毛利。最贵的版本不应自动进入高质量档。[S6]

Qwen-Audio-3.1-TTS-Plus 是统一声线榜的点估计第一，值得成为唯一挑战者；本报告尚未核得官方确切 API ID、可购买区域和商业账户约束，**不能直接把排行榜展示名填入生产配置**。也不能拿这个云模型成绩证明开源 `Qwen3-TTS-12Hz-1.7B-CustomVoice` 同样领先。

### 5.2 本地旁白：最多两家族，不宣称云端同级 SOTA

- **主选：Qwen3-TTS `Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice`。** 官方开放模型支持10种语言、9个预设声音，Apache-2.0；官方运行方案适合固定旁白。选 CustomVoice，避免把普通朗读需求变成默认克隆家人的声音。官方 vLLM-Omni 已提供流式 `/v1/audio/speech` 路线，不能继续根据旧模型卡概括为“只支持离线”。
- **低资源替代：`hexgrad/Kokoro-82M`。** Apache-2.0，体量小，英语旁白优先；本地、低成本与容易部署是选择理由。AA 原生声线榜的 Kokoro 82M v1.0 为1064±11，明显低于当前云端领先组，因此不能把“本地可用”写成“质量同级”。[T1]

**开放权重听感领先者 Breeze TTS 2 已核，但不能按当前免费许可用于 Saga 商业自托管。** AA原榜的模型链接直接指向 **`BreezeBlue/Breeze-TTS-2`**，当日1219±15；官方模型卡与LICENSE v1.1（2026-09-01）明确：**代码Apache-2.0，权重、衍生模型及自托管输出采用研究与非商业许可**，商业用途须另签书面许可。普通付费云订阅不授予本地商用权，也不存在小企业／低收入自动豁免。[T5][T6]

Breeze有真正可运行的官方PyTorch路径：Linux、Python≥3.10、CUDA NVIDIA；厂商报告 eager约7.7GiB并建议12GB显存，`--fast-all`约14.4GiB并建议24GB。提供单并发 `/v1/audio/speech` 流式API、24kHz单声道PCM；官方小于40ms首包是H100预热快路径测量，不能转成普通消费卡承诺。[T5] **只有取得独立商业许可后，才把它作为本地音质优先挑战者；未取得时仍采用上述Qwen／Kokoro路线。** 这里是许可边界排除，绝不是把较低分模型重新宣布为SOTA。

Qwen／Kokoro 的硬件和部署范围由[本地专题](2026-10-08-ai-local-deployment.md)说明。[L1]

对长篇有声书，短句 Arena 不能替代章节间音色稳定、专名发音、一小时听感与无漏句检查；这是交付验收，不是重新组织十家模型大赛。

## 6. 全双工：Live 综合领先，Step 单项领先，二者都不能称全能第一

### 6.1 当日 AA 原榜

| 模型／配置 | 综合指数 | 双工动态 | 语音推理 | 𝜏-Voice 工具任务 | BBA 首段音频时间 |
|---|---:|---:|---:|---:|---:|
| **GPT-Live-1，Astra medium** | **83.2** | 94.9% | 约90% | **74.5%** | 1.34秒 |
| Gemini 3.8 Live Extended Thinking，High | 82.6 | 91.9% | 97.7% | 68.6% | 1.35秒 |
| GPT-Live-1，Sol low | 80.1 | **97.3%** | 约89% | 59.3% | 1.24秒 |
| GPT-Realtime-2.1，High | 75.2 | 95.7% | 约96% | 45.7% | 1.21秒 |
| **StepAudio 3 Realtime** | **未评分，缺项** | **98.9%** | **99.7%** | 未公布 | **8.83秒** |

综合83.2为当日已具备全部组件模型的最高点估计；82.6不是已被证明显著落后的结果。语音推理精确小数取自 AA 页面自己的摘要，部分表格四舍五入到整数。GPT-Live 两配置的𝜏-Voice结果目前**仅1轮试验**，Realtime 2.1 High为2轮，多数其他结果为3轮，应保留这一证据强度差异。[R1]

AA 的综合指数自2026-08起为四项等权：语音推理、𝜏-Voice、Arena偏好、工具任务成功率；**当前综合指数已不包含双工动态**。所以 Step 缺综合分不意味着差，Live 综合第一也不意味着最会处理沉默和插话。[R2]

双工动态是 Full Duplex Bench v1／v1.5 子集，测停顿、轮替、用户打断、附和处理。Big Bench Audio 是1,000道由文本推理任务转换来的语音问题；𝜏-Voice 是航司、零售、电信客服任务。它们均未直接测“采访长辈是否追问得体、尊重哽咽和回忆停顿、能否帮助讲出一段完整人生故事”。[R2]

### 6.2 具体选法与接口边界

**主选 `gpt-live-1`＋Astra medium**，因为已有较完整的独立综合证据，并能让实时语音层与后端档案工具协作。官方已核计费是 **$0.05/活跃会话分钟＝$3/小时，再加后端模型和工具**；用户沉默与后端处理中的活跃会话也计费。Live 是独立接口和产品，不能套用 Realtime 的音频 token 单价。[S6]

**挑战者 `stepaudio-3-realtime-preview`** 有官方公开 WebSocket API，支持对话上下文、VAD、工具与边说边思考；并非只存在于演示视频。但官方明确它是免费试用期 ID，试用结束将退役并加入正式付费版本，故必须在正式上线前固定届时的 ID、价目和版本生命周期。[R3]

Step 的当日8.83秒 TTFA 来自 Big Bench Audio 推理题，不能直接当作家常聊天每次等8.83秒；同样，厂商“Very low latency”也不能推翻独立测试，宣布它最快。它适合成为双工行为的上限挑战者，是否替换主选，取决于真实访谈的首句等待与工具表现。

纯本地全双工暂不进入默认清单：AA 上 PersonaPlex 的双工动态为91.0%、语音推理约19%，Moshi分别约61.0%和4%；本次没有足够独立证据证明可直接获得与所选云服务相当的访谈与工具能力。[R1] 这不是判断所有本地组合都不行，而是避免为了本地化再建设一套尚未证明有用的主持系统。

## 7. 少试错的验收方式

先落实上表主选，**不并行采购整张榜单**。保留必要的产品验收即可：

1. **ASR：** 用少量已获授权且人工核对的材料，覆盖清晰单人、长辈低音量、专名日期、两人抢话。确认点击词句能回放正确位置，以及人物归属可修正。默认只跑 Scribe；难例才让 Step给第二意见。
2. **说话人：** 只有内置标签明显不可靠时加 Precision-3；比较归属修正量，而不是只看转写 WER。不会把“每个音节谁说的”都自动宣称已确定。
3. **TTS：** 用同一声线设置完成一段包含人名、年份、引文的章节。检查漏读、错误发音和连续听感；Turbo满足交付就停止选型。只有具体缺陷才启用一个挑战者。
4. **实时：** 验收长停顿、附和、打断后改口、工具等待和中断恢复。Live通过就进入产品试点；若主要问题是双工行为，再在同样脚本下试 Step。不要把纯聊天的“听起来聪明”当作工具正确和原声存档可靠。

这些是建议的验收环节，本次没有执行，也没有声称改善已被测得。数据保留是采购的一部分：**ElevenLabs 默认保留；ZRM面向部分Enterprise客户，不能当作普通付费账号默认能力；Step 的正式处理区域与保留条款本次未核齐。** 具体采购前提已在同日官方语音资料报告中列明。[S6]

## 8. 来源

以下均在2026-10-08实际读取；括号说明证据性质。

- **S1** [Artificial Analysis Speech-to-Text](https://artificialanalysis.ai/speech-to-text)（独立原榜：非流式WER、速度、原始型号名称）。
- **S2** [AA Speech-to-Text methodology](https://artificialanalysis.ai/methodology/speech-to-text)（数据、权重、规范化、分块和速度定义）。
- **S3** [StepAudio 3 ASR官方模型页](https://platform.stepfun.ai/docs/en/guides/models/stepaudio-3-asr)（API产品与$0.24/小时；页面性能宣传属于厂商自测）。
- **S4** [StepFun ASR SSE API](https://platform.stepfun.ai/docs/en/api-reference/audio/asr-sse)（精确ID、语言、入参与返回字段）。
- **S5** [Microsoft Learn：MAI-Transcribe](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/mai-transcribe)（MAI-Transcribe-2功能、public preview限制）。
- **S6** [同日四家语音供应商官方来源与价格核验](2026-10-08-ai-speech-sources.md)（链接汇总25项原始官方来源；复用已核价格，避免因促销与单位混用产生新口径）。
- **D1** [Benchmarking Diarization Models，arXiv:2509.26177v1](https://arxiv.org/html/2509.26177v1)（ETH Zurich研究者，2025-09-30，独立历史版本比较）。
- **D2** [pyannoteAI Models](https://docs.pyannote.ai/models)（Precision-3、默认Precision-2、厂商精度陈述与API功能）。
- **D3** [pyannoteAI Pricing](https://www.pyannote.ai/pricing)（小时费、欧元单位、月费额度、企业自托管条件）。
- **D4** [Community-1官方模型卡](https://huggingface.co/pyannote/speaker-diarization-community-1)（离线、许可、官方DER表及其不同评测设置）。
- **T1** [AA Provider Voice Leaderboard](https://artificialanalysis.ai/text-to-speech/leaderboard/provider-voice)（原生声线独立盲测）。
- **T2** [AA Controlled Voice Leaderboard](https://artificialanalysis.ai/text-to-speech/leaderboard/controlled-voice)（统一声线独立盲测）。
- **T3** [AA TTS methodology](https://artificialanalysis.ai/methodology/text-to-speech)（盲测、声线、评审与区间定义）。
- **T4** [Qwen3-TTS官方仓库](https://github.com/QwenLM/Qwen3-TTS)；[Kokoro官方模型卡](https://huggingface.co/hexgrad/Kokoro-82M)（本地模型与许可证，实际部署细节由本地专题交叉核验）。
- **T5** [BreezeBlue/Breeze-TTS-2官方模型卡](https://huggingface.co/BreezeBlue/Breeze-TTS-2)（从AA榜单锚点定位；部署、显存、流式接口与许可区分）。
- **T6** [BreezeBlue Research and Non-Commercial License v1.1](https://huggingface.co/BreezeBlue/Breeze-TTS-2/blob/main/LICENSE)（2026-09-01；模型、自托管输出、商业许可与云订阅边界）。
- **L1** [本地AI模型与部署路线](2026-10-08-ai-local-deployment.md)（同轮研究实际读取的官方模型卡、当前runtime recipes、硬件与许可证证据；含Qwen3-ASR、ForcedAligner、Parakeet及TTS来源）。
- **L2** [mistralai/Voxtral-Small-24B-2507官方模型卡](https://huggingface.co/mistralai/Voxtral-Small-24B-2507)（Apache-2.0、vLLM／Transformers、55GB显存与转写模式）。
- **R1** [AA Speech-to-Speech Leaderboard](https://artificialanalysis.ai/speech-to-speech)（各配置独立结果、缺失项、试验轮数、TTFA）。
- **R2** [AA Speech-to-Speech methodology](https://artificialanalysis.ai/methodology/speech-to-speech-benchmarking)（指数版本变化、Full Duplex Bench、Big Bench Audio、𝜏-Voice和Arena）。
- **R3** [StepAudio 3 Realtime官方文档](https://platform.stepfun.ai/docs/en/guides/models/stepaudio-3-realtime)（公开接口、preview生命周期、工具能力；厂商延迟主张与独立结果分开处理）。

**仍未确定的范围：** Step榜单ASR精确ID映射；Qwen-Audio-3.1-TTS-Plus官方部署参数；最新Precision-3独立跨厂商DER；所有候选在家庭录音、长章节与长辈实时访谈上的实际质量。这些缺口已经约束推荐范围，没有用“最新”“最贵”或厂商宣传把它们补成事实。

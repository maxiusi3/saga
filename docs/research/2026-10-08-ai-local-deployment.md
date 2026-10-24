# UR Saga：本地 AI 模型与部署路线

**资料核查日期：2026-10-08。本文是部署研究，没有安装运行时、下载模型权重、读取本机硬件、上传家庭资料或调用付费模型。**

本文补充[AI 架构与模型方案](2026-10-08-ai-blueprint-and-model-tiers.md)，回答一个具体问题：如果 Saga 希望尽量采用当前高水平模型，又希望部分或全部本地处理，应该从哪条路线开始，怎样避免因模型版本、显存和运行时选错而反复试错。

结论是：**原声转写、说话人分离、检索和中性语音输出已经有明确的本地部署选择；高质量故事编辑可以保留云端质量基线，再决定哪些步骤迁到本地。** 本地优先并不要求全部任务共用一个模型，也不要求一次买齐硬件。本文给出少量候选和三种硬件条件路线；“首选”表示最值得先验证，不表示已经在 Saga 的家庭录音上证明最好。

## 1. 先确定要取得哪一种收益

| 本地化目标 | 最先迁移的任务 | 对 Saga 的直接价值 | 不能由此推导的结论 |
|---|---|---|---|
| 家庭原件尽量不离开设备或私有环境 | 转写、分离、检索索引 | 原声和照片可以留在受控存储；可离线重跑 | 只要模型开源，整个系统就没有外部流量 |
| 降低持续 API 支出 | 批量 ASR、批量索引、重复整理 | 工作量稳定后，可按队列摊薄计算成本 | 免费权重意味着计算、运维和人工校对也免费 |
| 保持模型选择权 | 标准化任务输入输出、版本与出处 | 换 ASR、编辑或检索模型时保留家庭档案 | 所有模型都能塞进同一个聊天 API，行为仍完全一致 |
| 保持高质量 | 每项任务保留一个强基线和一个本地候选 | 用同一份材料比较错误与人工返工 | 榜单第一就一定最忠实地处理老人弱声、家庭专名和口述史 |

如果当前没有受控 GPU 环境，推荐先形成 **“本地原件与档案＋可替换 Worker＋按需云端编辑”**。如果业务明确要求资料完全不出私有环境，再采用下文的完整本地链路，并接受需要自己承担的模型维护和容量规划。

## 2. 本轮保留的模型选择

### 2.1 语音识别：先区分质量前沿与设备适配

| 定位 | 精确候选 | 已核实能力与许可 | 运行路径与重要边界 |
|---|---|---|---|
| NVIDIA大内存、英语质量优先 | `mistralai/Voxtral-Small-24B-2507` | Apache-2.0；AA当日Voxtral Small条目WER 2.8%，其公开host ID为`voxtral-small-2507`，是当日标注的开放权重领先项 | 官方推荐vLLM≥0.10.0/Transformers，BF16/FP16约55GB GPU RAM；32K上下文、转写最多30分钟。高质量本地ASR先测它；时间戳/分离另补，不能将托管结果保证为本机成绩。[S25] |
| 多语言本地主选 | `Qwen/Qwen3-ASR-1.7B`；资源紧时同家族 `0.6B` | Apache-2.0；30 种语言＋22 种中文方言；离线与流式统一；厂商报告强开放模型识别结果 | 官方 `qwen-asr` 的 Transformers/vLLM 后端。时间戳配 `Qwen/Qwen3-ForcedAligner-0.6B`；分离另接 pyannote。语言数量不是每种方言都已满足 Saga 的承诺。[S1] |
| 英语与欧洲语言、尤其 Apple 原生部署候选 | `nvidia/parakeet-tdt-0.6b-v3` | CC-BY-4.0；600M；25 种欧洲语言；词级/段级时间戳、标点与大小写 | NVIDIA NeMo 或官方 `NeMo-Speech.cpp`；后者明确有 CPU、Metal、CUDA 和 Vulkan 路线。**不含中文**，也不把它称作 NVIDIA 所有语音模型中的最新版本。[S2][S3] |
| 兼容与质量回归基线 | `openai/whisper-large-v3` | 成熟的多语言转写基线；不再将它默认为当前绝对 SOTA | NVIDIA 用 `faster-whisper`/CTranslate2；Apple 用 MLX Whisper。原 OpenAI 仓库声明代码与权重 MIT，HF 转换卡标 Apache-2.0，交付时按实际 checkpoint 固定许可证和来源。[S4][S5][S6] |

**质量优先时，不用消费卡便利性代替模型能力判断。** 有80GB级GPU或合适多卡环境，Voxtral Small进入第一轮本地ASR；已有Apple/24GB环境，则先按下表选Parakeet/Qwen，保留与Scribe云基准的差距记录。约55GB是官方给出的GPU RAM需求，不是所有24GB卡量化后都能运行的证明。

**Qwen 的时间戳是额外步骤。** ForcedAligner 支持 11 种语言、单段最长 5 分钟；不能把 ASR 的 30 种语言覆盖直接当成相同的时间对齐覆盖。长录音应分段、保存全局时间偏移，再对齐和拼接；跨段说话人标签也需要统一。对齐会把已提供的文字定位到音频，不能修复一段本来就识别错了的文字。[S1]

**Parakeet 的长音频上限有硬件条件。** 官方“full attention 可到 24 分钟”注明 A100 80GB；local attention 可支持更长音频。不能把它转述成“24GB 显卡可以无条件整小时转写”。Saga 仍应以可恢复分片处理作为默认。[S2]

`faster-whisper` 不是 Apple Metal 加速工具。其当前 CTranslate2 路径涉及 CUDA 12、cuDNN 9；在 Apple 上优先选择明确支持 MLX/Metal 的实现，避免先配完 CUDA 风格环境再发现平台不合适。[S5][S6]

### 2.2 说话人分离：独立组件，不能等同于身份识别

推荐 `pyannote/speaker-diarization-community-1`。模型 CC-BY-4.0，`pyannote.audio` 代码 MIT。首次取得模型需要在 Hugging Face 接受使用条件并取得下载权限；下载完整依赖后可本地运行。此次研究没有接受条款、创建 token 或下载权重。[S7]

它输出的 `speaker_0`、`speaker_1` 是声音片段分组，**不能直接认定为父亲、母亲或采访者**。家庭应确认身份映射，之后才能用于故事署名和人物关系。

原始录音若已有分开的声轨，先利用声轨；不要为了送入 diarization 把有用的分轨证据混掉。Community-1 会将多声道输入平均下混；它提供的 exclusive diarization 便于与转写对齐，但仍应保留普通分离结果中的重叠讲话信息。[S7]

### 2.3 文字与照片理解：区分单机选择与机构级前沿

**主候选是 `Qwen/Qwen3.8-27B`。** 官方卡将其定义为 27B 稠密视觉语言模型，原生支持图片与视频理解、文字输出，Apache-2.0；原生上下文 262,144，可扩至 1,000,000 tokens。[S8]

这让它有资格进入 Saga 的人物事件提取、带证据改写、照片描述和疑点检查评测。其官方成绩涵盖编码、研究、专业任务和视觉任务，但对比表包含旧版 Opus 4.6；不能据此写成“已胜过当前全部旗舰模型”或“已经证明写家史最好”。官方最大上下文也不是消费卡可用上下文。

**内存受限退路是 `Qwen/Qwen3.5-9B`。** 同为 Apache-2.0，支持文字与视觉输入；更适合较小内存 Apple Silicon，或需要给其他任务保留资源的单卡环境。这里的推荐理由是资源和部署便利，不是与 27B 同等的编辑质量。[S9]

**机构级开放权重前沿候选另列 `zai-org/GLM-5.3`。** 官方已公开权重，模型卡列出 vLLM、SGLang、Transformers 等本地部署路径。Hugging Face 权重元数据统计约 **753.3B 参数**，当前产物主要为 FP8，另含 BF16/F32；它属于大内存服务器/多卡集群研究范围，不能由“部分参数激活”推导为消费卡可驻留。按总参数粗算，统一 8-bit 纯权重约 753GB、4-bit 约 377GB；后者只是理论算式，不是本次确认存在并验证可用的 4-bit 部署包。GLM-5.3 采用自定义许可证，允许部署与商业使用，但有特定超大规模 Model-as-a-Service 企业条款，不能标为 Apache/MIT。[S24]

保留 GLM-5.3 的目的，是把“开放模型可达到的前沿能力”与“单机容易部署”分开。其厂商证据偏重编码、复杂任务和长期任务；这同样不是家史忠实编辑实测。若需要比较其质量，先通过受控租用环境或已有合规托管接口评估，再讨论集群采购，不用 27B 的硬件便利性替代质量选择。

不建议为了“统一技术栈”而让同一个 27B 模型兼做 ASR、声纹分离、TTS、检索向量。它们的输入、输出、计费或资源单位都不同；专用模型通常更便于独立替换和验证。

### 2.4 检索：按迁移成本或质量选择，不把旧榜首当作今日结论

| 决策条件 | 推荐候选 | 选择依据 | 实施边界 |
|---|---|---|---|
| 云端准备采用 Voyage 4，希望以后容易转本地 | `voyageai/voyage-4-nano` | Apache-2.0；约 0.34B；32K 输入；官方明确与 `voyage-4-large`、`voyage-4`、`voyage-4-lite` **共享向量空间** | 2048/1024/512/256 维；Transformers、SentenceTransformers 和 vLLM 示例。要保持维度、查询/文档 prompt、归一化与数据类型一致；共享空间不等于质量完全相同。[S10] |
| NVIDIA 环境，优先测试当前较强开放检索质量 | `nvidia/Nemotron-3-Embed-8B-BF16` | 2026-07-16 发布；34 种评测语言；官方报告发布当日多语 RTEB SOTA；32768 输入、4096 维 | 权重 **OpenMDW-1.1**，不是 Apache-2.0。支持 PyTorch/SentenceTransformers/vLLM；可截短向量后重新 L2 归一化。先单独批量索引，不与 27B 同卡常驻。[S11][S12] |
| 需要尺寸选择和配套本地重排，且更看重部署控制 | `Qwen3-Embedding`＋`Qwen3-Reranker` | 两者均有 0.6B/4B/8B，Apache-2.0，100＋语言、32K；小尺寸适合低资源路线 | 0.6B/4B/8B 向量上限分别为 1024/2560/4096 维。官方“8B 榜首”说明来自 2025 年，不能称作 2026-10 的现时冠军。[S13] |

推荐默认保持简单：**如果采用主报告的 Voyage 云端检索，先用 Voyage 4 nano 做本地对照；完全本地且有 GPU 时，让 Nemotron 3 Embed 8B 与它对比一次。** 只有在错误类型或质量门槛表明需要更强重排时，再引入 Qwen3-Reranker；不要求三个 embedding 家族全部集成。

Embedding 负责召回，reranker 逐对判断查询和候选片段的相关性，是另一轮计算。人名、日期和别名检索、授权过滤、全文检索仍然保留。模型向量不能替代“这是谁的资料、谁有权看到”这些应用规则。

**共享向量空间是需要明确证明的例外。** Voyage 4 系列有官方承诺；Qwen、Nemotron、Gemini 与 Voyage 之间没有此承诺，不能直接混算。其他模型切换应建立新索引并保存旧版本。向量维度也要兼容数据库：pgvector HNSW 的普通 `vector` 上限是 2000 维，`halfvec` 上限是 4000 维。2048 维可使用 `halfvec`；4096 维不能直接套用，需先采用经评估的降维配置，例如 2048 维，再建索引，或选择精确检索/其他索引方案。[S10][S14]

照片/视频搜索真正成为需求后，再增加 `Qwen/Qwen3-VL-Embedding-2B` 与 `Qwen/Qwen3-VL-Reranker-2B`。两者 Apache-2.0，支持文字、图片、截图和视频；卡中没有列原生音频输入，所以家庭录像的音轨仍应单独转写索引。2B embedding 最大 2048 维，可选更低维度。这是媒体扩展，不是首期所有家庭都必须运行的组件。[S15]

### 2.5 语音输出：预设中性旁白优先

`Qwen3-TTS` 是已核实部署细节的多语言实用候选：Apache-2.0，10 种语言，1.7B CustomVoice 有 9 个预设声音；同家族有更轻的 0.6B。Saga 中性旁白应从 `Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice` 开始，避免把 `Base` 参考语音克隆变成默认步骤。VoiceDesign、Base 与 CustomVoice 是不同 checkpoint。[S16]

本轮另一低资源候选为 `hexgrad/Kokoro-82M`，Apache-2.0，体积小、适合英语旁白起步。官方声音文档提示部分非英语声音和 G2P 仍有弱项；它是资源与成熟度选择，不能因为模型小就承诺所有语言、所有短句都表现好。[S17]

**开放榜领先但不能直接商用的选择：Breeze TTS 2。** AA原生声线榜当日标注其为开放权重最高项，1219±15。已核官方`BreezeBlue/Breeze-TTS-2`：代码Apache-2.0，但模型权重、衍生权重及自托管输出受Research/Non-Commercial条款约束；自托管商用需要另签书面许可，购买其云套餐不自动授予此权。它可作为取得相应许可后的机构候选，当前不进入Saga默认商业本地链路。官方Linux/Python3.10+/CUDA运行参考为eager约7.7GiB、建议12GB，fast-all约14.4GiB、建议24GB；与27B并行仍须额外规划。[S26]

这里**没有证明 Qwen3-TTS 或 Kokoro 的主观听感达到当前商业旗舰水平**。相同稿件、语种和声音条件下的盲听结果，才适合决定 Saga 的默认声音。先生成已批准的旁白；家庭原声仍保留原件，不因 TTS 可用就重新合成所有回忆。

Qwen3-TTS 官方模型卡中“vLLM-Omni 当前仅支持离线、以后支持在线”的段落已经落后于运行时资料：当前官方 recipe 已有 `vllm serve … --omni`、`/v1/audio/speech` 和 24kHz 单声道 PCM streaming。应该依据固定版本的当前 recipe 验证，而不是继续沿用旧限制；普通 vLLM 与 vLLM-Omni 仍是不同部署路径。[S16][S18]

## 3. 三种条件下的具体路线

下表是部署建议，不是对用户现有硬件的判断。本研究没有读取设备配置。

### A. Apple Silicon：先完成离线整理链路

| 统一内存条件 | 建议起点 | 需要保留的限制 |
|---|---|---|
| 16–24GB | 英语/欧洲语言 ASR 用 Parakeet＋NeMo-Speech.cpp Metal，或 Whisper＋MLX；文本用 Qwen3.5-9B 量化；检索先 Voyage 4 nano 的 CPU/SentenceTransformers 路径；TTS 选低资源方案 | 系统、数据库、模型共用内存；顺序加载。pyannote 可采用 CPU 路径，但本次没有该设备速度数据；不预先保证实时主持 |
| 32GB | 同上，增加 Qwen3.8-27B MLX 标签的受控试验，短上下文、一次一个任务 | 18GB 下载包不等于 18GB 峰值内存；32GB 仍需给系统、视觉处理和 KV 缓存留余量 |
| 48–64GB 及以上 | 27B 量化更有余量，能比较较高精度或较长上下文 | 仍不能把目录标注 256K 当成所有并发和视觉任务都可用；先从 8K/16K 上下文验证 |

NeMo-Speech.cpp 官方安装文档明确：Apple Silicon 自动选择 `macos-aarch64-metal` 包；Metal 构建需要 Xcode Command Line Tools，不需另装独立 Metal SDK。Whisper 的 MLX 示例也明确支持模型转换与词时间戳。[S3][S6]

Ollama 目录已列出 `qwen3.8:27b-mlx` 和 `qwen3.5:9b-mlx`。前者目录包大小为 18GB，后者 **8.9GB**；不要把常规 `qwen3.5:9b` 的 6.6–7.6GB 误套到 MLX 标签。目录明确的是文字/图片输入；模型卡中的视频能力是否经该标签完整暴露，仍要单独验证。[S19]

纯文本 `mlx-lm` 的存在也不等于任意视觉或语音模型都可直接运行。模型支持、量化格式、processor 和接口必须一起确认。Apple 统一内存接近耗尽时会显著影响速度；不建议为了“能装进来”取消系统余量。[S20]

### B. 24–32GB NVIDIA 单卡：区分普通量化与 Blackwell 专用量化

**24GB 卡的推荐起点**：Qwen3-ASR-1.7B → 对齐/pyannote → Qwen3.8-27B 的受支持 4-bit 路径，或者 Qwen3.5-9B → 检索/旁白。阶段间卸载模型，保留中间结果。27B 的 Ollama 目录包为 18GB，是值得试的候选，但本次没有对任意 24GB 卡的峰值显存和速度实测；遇到余量不足时改用 9B，不无限堆叠 offload 和补丁。

**32GB RTX 5090 有更具体的证据**：vLLM 官方 Qwen3.8 recipe 明确验证了单卡 `Inferact/Qwen3.8-27B-NVFP4`，使用 32K 上下文、FP8 KV cache 和 `--enforce-eager`。该记录指出，CUDA graph capture 会因显存不足失败，单纯调整 `gpu_memory_utilization` 不能解决，关闭 graph capture 才能启动。[S21]

这条路径的含义是“有官方记录可复用的特定组合”，不是“27B 在所有 24–32GB GPU 上都能用 NVFP4”。NVFP4 对 Blackwell 硬件和内核有要求，不能照搬到 3090/4090。该 recipe 的验证范围还明确限于 **文字 serving**，不能把启动成功当成照片/视频理解也完成验证。[S21]

单卡建议同时只常驻必要的轻量服务。ASR、27B 编辑、8B 检索、1.7B TTS 全部常驻会相互挤占显存；单独能运行不等于并行能运行。用持久任务队列依次调度，是本阶段减少问题最有效的结构选择。

### C. 48–96GB、双卡工作站或租 GPU：优先用来验证质量和并发

| 条件 | 推荐用途 | 内存与并发边界 |
|---|---|---|
| 单卡 48GB | 27B FP8/高质量量化、较大输入；独立跑 Nemotron 8B 检索或 Qwen reranker | 27B 的 BF16 标称纯权重就约 54GB，因此 **48GB 不适合按完整 BF16 全卡驻留规划** |
| 80–96GB 单卡 | Voxtral Small作为英语本地ASR质量基准；另分时尝试27B BF16、检索与量化比较 | 54GB 不是总运行显存；视觉、KV、激活、并发仍要预算。没有本次 Saga 吞吐数据 |
| 双卡或更多卡 | 按运行时支持做 tensor parallel，或让不同 Worker 各占一张卡 | 总显存不能简单当成一块无损共享内存；每卡容量、互联和模型切分决定能否运行 |
| 按小时租 GPU | 用固定样本验证候选、峰值显存、处理时间与成本，再决定是否长期部署 | 租用云 GPU 是自托管计算，仍然在外部基础设施处理；不能对用户描述为“资料始终留在个人电脑” |
| 更大机构集群/大内存服务器 | GLM-5.3 等开放权重前沿模型的质量与服务成本评估 | 约 753B 总参数，超出本表的普通 48–96GB 单卡规划；具体卡数、切分、offload 和吞吐本次未验证，不给采购数量承诺。[S24] |

vLLM 的 Qwen3.8 recipe 也给出双 RTX 5090、TP2 的 FP8/NVFP4 运行记录；这是可参考的特定双卡路径。它不保证其他主板、互联、驱动或上下文条件下得到相同性能。[S21]

对于小规模试点，租 GPU 的主要价值是减少买错硬件的风险。成本比较应采用实际 GPU 时长、利用率、存储、出站流量与运维时间；没有真实工作量时不宜宣布本地一定比 API 便宜。

## 4. 内存数字必须分四类

### 4.1 只按参数量计算的理论权重体积

以下统一使用十进制 GB：`参数量 × 每参数字节数 ÷ 10^9`。这是便于估算的下限示意，**不是可购买显存建议、下载包大小或峰值运行内存**。

| 标称参数 | BF16/FP16，2 bytes | 8-bit，1 byte | 4-bit，0.5 byte |
|---|---:|---:|---:|
| 27B 文本模型 | 54GB | 27GB | 13.5GB |
| 9B 文本模型 | 18GB | 9GB | 4.5GB |
| 8B embedding/reranker | 16GB | 8GB | 4GB |
| 1.7B ASR/TTS | 3.4GB | 1.7GB | 0.85GB |
| 0.6B ASR/embedding/reranker | 1.2GB | 0.6GB | 0.3GB |
| 约 0.34B Voyage 4 nano | 约 0.68GB | 约 0.34GB | 约 0.17GB |
| 82M Kokoro | 约 0.164GB | 约 0.082GB | 约 0.041GB |

表中不同精度只是算式；**不表示每个模型都存在可用的该精度版本，更不表示质量不变**。实际量化通常有分组尺度、未量化层、视觉编码器、codec、额外对齐模型和元数据。运行时还需要 KV cache、激活、工作空间、输入媒体解码和并发缓冲。

### 4.2 下载体积、运行时配置值与已报告测量值

| 数字类型 | 官方资料中的具体数字 | 正确读法 |
|---|---|---|
| 目录下载包大小 | Ollama `qwen3.8:27b`/`27b-mlx`：18GB；`qwen3.5:9b`：6.6–7.6GB；`9b-mlx`：8.9GB | 用于估算下载和磁盘；不能直接当峰值显存。[S19] |
| recipe 中的量化 checkpoint 体积/门槛 | Qwen3.8 Inferact NVFP4：约 24.6GiB 权重 footprint；单 5090 配置 32K、关闭 CUDA graph | GiB 与 GB 不混用；权重 footprint 仍小于完整运行需求，且绑定具体量化产物。[S21] |
| recipe 配置门槛，非独立峰值实测 | Qwen3-TTS vLLM-Omni：1.7B 变体 `vram_minimum_gb: 16`；0.6B：8 | 是该 recipe 的容量配置；不能用前表 3.4GB 纯权重推断 4GB 卡能跑完整服务。[S18] |
| 原实现参考需求 | OpenAI Whisper README：large 约 10GB required VRAM | 原实现的参考值，不等于 faster-whisper、MLX 或所有精度都需要相同内存。[S4] |
| 限定环境实测 | faster-whisper README：large-v2、13 分钟音频、RTX 3070 Ti 8GB、beam 5；INT8：59秒/2926MB；INT8 batch 8：16秒/4500MB | **模型是 large-v2**；不能改写成 large-v3、老人口述史或用户设备的实测。[S5] |
| 限定环境实测 | pyannote Community-1：H100 80GB，AMI IHM 约 1 小时文件，31 秒/小时音频 | 后处理规模参考；不是 Apple 或消费卡速度承诺。14 秒/小时是另一款 premium `precision-2` 的数据，不能挪给 Community-1。[S7] |

Qwen3-ASR 的“并发 128、约 2000 倍吞吐”和 Qwen3-TTS 的“最低 97ms 首包”均为厂商给定条件下的性能宣传；缺少匹配 Saga 设备、样本、并发和完整管线的证据时，本文不据此承诺单用户体验。[S1][S16]

## 5. 运行时兼容性：按模型、模态、版本一起锁定

| 运行时 | 本轮适合承担的任务 | 不能默认成立的事 |
|---|---|---|
| Ollama | 本地 Qwen3.8/Qwen3.5 的简单文字/图片入口；目录已有 MLX 标签 | 不保证统一承载 ASR、TTS、分离；不因目录写 256K 就保证本机可以开满 |
| MLX / MLX Whisper | Apple Silicon 的量化文本与 Whisper | `mlx-lm` 不是全部多模态模型的通用支持清单；Qwen 模型的视觉 processor 与具体 serving 接口要核实 |
| llama.cpp | GGUF、Metal、CPU/CUDA offload 等本地推理 | 发现一个 GGUF 文件不等于目标架构、视觉 projector、工具调用都兼容；本次通用 README 的 Qwen3.5 示例不能单独证明 Qwen3.8 每个功能已验证 |
| vLLM | NVIDIA 的并发文字推理、embedding，以及有适配的 ASR | 基础支持表列 Qwen3.5、Qwen3-ASR 等架构；Qwen3.8 需看专门 recipe。不能只按最低版本号判断完整功能可用 |
| vLLM-Omni | Qwen3-TTS 的在线/离线语音生成 | 需要 Omni 组件和 `--omni`；CustomVoice/Base/VoiceDesign 不能在同一个 checkpoint 上任意换任务 |
| NeMo-Speech.cpp | Parakeet 等 NVIDIA 语音模型的原生 CPU/Metal/CUDA/Vulkan 推理 | 默认模型可能是其他 Nemotron 模型；必须显式固定 Parakeet 模型与 GGUF 来源，避免 CLI 默认变化后悄悄换模型 |
| Transformers/SentenceTransformers | 本地 embedding、ASR/TTS 原厂实现的参照路径 | CUDA 示例不自动等价于 Apple 高效加速；`trust_remote_code` 意味着还有需要固定与审阅的模型代码 |

来源：[S3][S6][S10][S11][S19][S20][S21][S22][S23]。

**两处最容易引起返工的版本细节：**

1. Qwen3.8 vLLM recipe 的 `min_vllm_version: 0.17.0` 是架构注册的最低条件。该 recipe 同时注明具体验证使用开发版/专用镜像，旧发布版没有全部被验证；不能把 0.17.0 写成“稳定完整支持 Qwen3.8 的已测版本”。先固定 recipe 当次验证的模型 revision、镜像 digest 和参数，再评估升级。[S21]
2. Nemotron 3 Embed 8B 当前卡对 `/v2/embed` 给出 vLLM 0.25.0，另外列出曾验证的 0.21.0、0.24.0 和 NVIDIA 26.06 容器。其 FP8 加速有硬件条件，卡中的精度一致性验证是在 H100＋vLLM 0.25.0；不能按“支持 FP8”就承诺任意卡都加速且结果相同。[S11]

不要把所有模型装在项目现有 Python 环境中。独立 Worker 或独立容器能隔离 Transformers、Torch、CUDA/CTranslate2、vLLM-Omni 等版本。小规模不要求上 Kubernetes，几个清楚的容器或进程就能保留这条边界。

## 6. 许可证与真正离线的含义

### 6.1 商用许可需要记录到实际产物

| 模型或组件 | 已核实许可 | Saga 交付时保留什么 |
|---|---|---|
| Voxtral Small 24B 2507 | Apache-2.0 | 固定24B checkpoint与运行时；不把Voxtral Mini或其他版本许可/能力混用 |
| Breeze TTS 2 | 代码Apache-2.0；权重/自托管输出Research/Non-Commercial | 商业本地部署须另签书面许可；云订阅不等于本地商用权 |
| Qwen3.8、Qwen3.5、Qwen3-ASR、Qwen3-TTS、Qwen3 Embedding/Reranker、Qwen3 VL 检索 | Apache-2.0 | 实际模型版本的 LICENSE/NOTICE；量化产物额外来源；依赖清单 |
| Voyage 4 nano | Apache-2.0 | 模型与远程自定义代码 revision、许可证、query/document 编码约定 |
| Nemotron 3 Embed 8B | OpenMDW-1.1 | 分发时保留协议和适用来源/版权通知；不能把底座 Apache-2.0 当作最终权重许可证 |
| GLM-5.3 | 自定义 GLM-5.3 License | 保留版权和许可；其 Model-as-a-Service 条款涉及被许可方及关联方连续 12 个月合计收入超过 100 亿美元时的 Z.AI 安全审查；特定功能内嵌模型的终端产品被明确排除在该 MaaS 定义之外。按实际业务结构判断，不把它简写成无限制 MIT。[S24] |
| Parakeet TDT 0.6B v3、pyannote Community-1 | CC-BY-4.0 | 按条件署名、许可链接和修改说明；分别处理代码依赖许可 |
| OpenAI Whisper | 原官方仓库称代码与模型权重 MIT；HF 转换卡元数据 Apache-2.0 | 固定选用的分发产物及许可证，不简单抹平来源差异 |
| Kokoro-82M | Apache-2.0 模型 | 声音文件、G2P 和其他依赖的各自条款；不把模型卡当成所有人格/声音权利的授权 |

OpenMDW-1.1 允许免费处理、修改与分发 Model Materials，分发时要求保留协议和适用通知；它没有对输出另加使用/修改/分享限制，但明确不替使用者取得第三方权利与同意。Apache/MIT/CC-BY 的模型许可也不能自动代替家属对声音克隆、公开故事或使用私人照片的授权。[S12]

### 6.2 “本地模型”之外还要检查的实际网络行为

- **首次安装与下载和日常推理分开。** 模型、tokenizer、音频 codec、processor、语音活动检测或分离依赖都准备完整后，固定本地路径；缺文件时应失败并提示，不能悄悄改走云端。
- **关闭不必要遥测。** `pyannote.audio` 提供 `PYANNOTE_METRICS_ENABLED=0`；其遥测说明涉及模型来源、音频时长和说话人配置等，不能因为不上传原音频就忽略。[S7]
- **外部资源也算外传。** 远程图片 URL、错误追踪、prompt 日志、云端向量库、备份与自动模型回退都需要明确安排。最终用断网/出站拒绝环境验证一次完整任务。
- **设备本地、私有服务器、租用云 GPU 分别说明。** 三者都能自托管权重，但用户对“资料在什么地方处理”的理解不同。
- **同意与删除沿用主系统。** 原声、转写、向量、草稿、缓存与导出版本都遵循家庭权限和生命周期；本地运行不会自动修复这些业务规则。

## 7. 减少试错的部署与验收顺序

### 7.1 先固定一套组合，不同时试所有模型

1. 按实际硬件选择上文 A/B/C 路线，只确定一个 ASR 主模型、一个文字模型、一个 embedding；TTS 在用户确实需要朗读时启用。
2. 先以短的合成或获准样本确认模型加载、输入格式、输出字段、时间码与离线行为，再处理长录音。此阶段优先 batch 1、8K/16K 文字上下文，按需增加。
3. 保存转写和中间证据后再卸载/加载下一阶段模型；失败从失败阶段恢复，不重跑整个家庭项目。
4. 与一个强云端基线比较质量时，只处理明确获准使用的材料；要求完全离线的项目采用人工标注基线。
5. 如果本地模型未达门槛，先按错误类型更换一个候选或降低自动化程度。不要仅凭总分不满意就重新装一套全部不同的工具链。

### 7.2 小而固定的验收集

以下是建议门槛设计，不是此次已经完成的测量。**先用 5–10 个困难短片完成首轮筛选**，覆盖弱声、旧录音噪声、两人插话、人名和年代。选出组合后，再逐步扩充为约 30 个固定场景＋一段约 60 分钟的连续录音，加入口音、长停顿和拒绝回答；随后与主报告的 20–30 人产品试点衔接。中文/西语等扩展语言各自加入场景，不能只测英语后宣称全语言通过。这样不必在尚未确认模型能加载时就准备完整大型评测。

| 能力 | 要测的东西 | 对 Saga 有意义的判断 |
|---|---|---|
| ASR | 按语言分别统计 WER/CER；另记录人物名、地点、日期错误；静音幻听；漏掉微弱讲话 | 总 WER 较好但关键人名错误多，仍可能增加家属返工；不使用跨语言平均分掩盖问题 |
| 时间码/分离 | 词段可回放、跨分片全局偏移、说话人换人和重叠处错误 | 引文能回到正确原声；说话人不明时保留待确认，不能强行归属 |
| 提取/编辑 | 新增无依据事实、主体/年代被改、遗漏与引用覆盖；完成同一篇故事所需人工分钟 | 任一无依据的确定事实都应退回审阅；把“少改字”与“少事实错误”分别计数 |
| 检索 | 约 30 个带人工出处的问题；Recall@k、重排后相关性、无答案问题 | 找得到正确原声，也能在资料不足时回答没有依据；每次比较使用相同切片与权限范围 |
| TTS | 相同稿件盲听；专名读法、长句、短追问、数字、停顿；首音频与总处理时长 | 首包快不代表整段自然；中性旁白与实时采访分别验收 |
| 稳定性 | 峰值内存、单任务耗时、长任务恢复、连续运行、断网失败方式 | 记录模型/量化/硬件/输入长度/并发，不留只有“很快”“效果好”的结论 |

可以把“关键事实新增错误为 0、所有发布段落有可回放出处、权限泄漏为 0”作为首轮硬门槛；这是 Saga 的产品要求建议，不是对当前模型的保证。速度和自然度则按具体用户场景设定，例如离线整理不需要达到实时主持的时延标准。

### 7.3 每个部署保存一张可复现清单

至少记录：模型仓库与 revision、量化发布者与格式、许可证、运行时/容器 digest、Torch/驱动依赖、上下文和 batch 限制、采样设置、prompt/processor 版本、输入预处理、峰值内存、样本集版本、质量结果和回退策略。

模型升级先跑这套固定验收，再决定替换。旧故事的发布快照保持不变；换模型重跑生成新版本供家人确认。模型替换不应该抹掉原声、人工更正和不同讲述者之间的分歧。

## 8. 官方来源与证据范围

以下均在 2026-10-08 读取。GitHub/Hugging Face 的 `main` 文档会继续变化；生产实施应固定当时 commit。本报告中的厂商基准、运行时验证和本研究建议已分别标注，没有把它们混称为 Saga 实测。

- **[S1] Qwen3-ASR 与 ForcedAligner：**[官方模型卡](https://huggingface.co/Qwen/Qwen3-ASR-1.7B)，[原文 README](https://huggingface.co/Qwen/Qwen3-ASR-1.7B/raw/main/README.md)。语言覆盖、对齐长度、运行时与许可。
- **[S2] Parakeet：**[NVIDIA 官方模型卡](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3)。语言、时间戳、许可与长音频硬件条件。
- **[S3] NeMo-Speech.cpp：**[官方仓库](https://github.com/NVIDIA/NeMo-Speech.cpp)，[安装文档](https://github.com/NVIDIA/NeMo-Speech.cpp/blob/main/docs/install.md)，[构建文档](https://github.com/NVIDIA/NeMo-Speech.cpp/blob/main/docs/build.md)。支持模型、Apple Metal 包和其他后端。
- **[S4] Whisper：**[OpenAI 官方仓库](https://github.com/openai/whisper)，[large-v3 转换模型卡](https://huggingface.co/openai/whisper-large-v3)。许可来源差异与原实现内存参考。
- **[S5] faster-whisper：**[官方仓库与性能表](https://github.com/SYSTRAN/faster-whisper)。具体 benchmark 条件、CUDA/cuDNN 边界。
- **[S6] MLX Whisper：**[Apple MLX 示例](https://github.com/ml-explore/mlx-examples/tree/main/whisper)。转换、词时间戳和量化。
- **[S7] pyannote：**[Community-1 模型卡](https://huggingface.co/pyannote/speaker-diarization-community-1)，[pyannote.audio README](https://github.com/pyannote/pyannote-audio)，[代码许可证](https://github.com/pyannote/pyannote-audio/blob/develop/LICENSE)。访问条件、离线运行、重叠/独占分离、H100 基准和遥测。
- **[S8] Qwen3.8：**[27B 官方模型卡](https://huggingface.co/Qwen/Qwen3.8-27B)，[许可证](https://huggingface.co/Qwen/Qwen3.8-27B/blob/main/LICENSE)。架构、上下文、模态和厂商评测。
- **[S9] Qwen3.5：**[9B 官方模型卡](https://huggingface.co/Qwen/Qwen3.5-9B)。资源受限候选的能力与许可。
- **[S10] Voyage：**[voyage-4-nano 官方卡](https://huggingface.co/voyageai/voyage-4-nano)，[2026-01-15 Voyage 4 发布说明](https://blog.voyageai.com/2026/01/15/voyage-4/)。共享向量空间、维度、运行示例与许可。
- **[S11] Nemotron：**[Nemotron-3-Embed-8B-BF16 官方卡](https://huggingface.co/nvidia/Nemotron-3-Embed-8B-BF16)。发布日榜单主张、维度、运行时和验证硬件。读取时模型仓库 revision：`d1f2f25730bbd775b99b29185134bc86653bf2d1`。
- **[S12] OpenMDW：**[OpenMDW-1.1 许可全文](https://openmdw.ai/license/1-1/)。许可和分发条件以此为准。
- **[S13] Qwen 文本检索：**[Embedding-0.6B/家族表](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B)，[Reranker-0.6B](https://huggingface.co/Qwen/Qwen3-Reranker-0.6B)。尺寸、维度、上下文、指令和评测日期。
- **[S14] pgvector：**[官方 README](https://github.com/pgvector/pgvector)。索引类型与向量维数上限。
- **[S15] Qwen 媒体检索：**[VL-Embedding-2B](https://huggingface.co/Qwen/Qwen3-VL-Embedding-2B)，[VL-Reranker-2B](https://huggingface.co/Qwen/Qwen3-VL-Reranker-2B)。输入模态、维度和许可。
- **[S16] Qwen TTS：**[官方模型卡/家族说明](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base)，[CustomVoice](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice)。任务变体、语言、声音、原厂实现。
- **[S17] Kokoro：**[模型卡](https://huggingface.co/hexgrad/Kokoro-82M)，[声音说明](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md)，[官方代码](https://github.com/hexgrad/kokoro)。英语优先、非英语限制和依赖。
- **[S18] Qwen TTS 当前 serving：**[vLLM 官方 recipe 源码](https://github.com/vllm-project/recipes/blob/main/models/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice.yaml)，[vLLM-Omni 支持表](https://github.com/vllm-project/vllm-omni/blob/main/docs/models/supported_models.md)。在线服务、PCM streaming、版本与容量配置；优先于模型卡里的旧“仅离线”段落。
- **[S19] Ollama 目录：**[Qwen3.8](https://ollama.com/library/qwen3.8)，[Qwen3.5](https://ollama.com/library/qwen3.5)。标签、包大小和目录暴露的输入能力。
- **[S20] MLX-LM：**[官方仓库](https://github.com/ml-explore/mlx-lm)。Apple 量化推理与内存边界。
- **[S21] Qwen3.8 当前 serving：**[vLLM 官方 recipe 源码](https://github.com/vllm-project/recipes/blob/main/models/Qwen/Qwen3.8-27B.yaml)。2026-10-02 更新；单/双 RTX 5090 验证条件、量化版本、启动参数与验证范围。
- **[S22] llama.cpp：**[官方仓库](https://github.com/ggml-org/llama.cpp)。Metal、CUDA、offload、GGUF 与许可；没有据此泛化任意新模型支持。
- **[S23] vLLM：**[官方支持模型列表源码](https://github.com/vllm-project/vllm/blob/main/docs/models/supported_models.md)。架构支持表；具体模型能力以对应 recipe 和部署验收为准。
- **[S24] GLM-5.3：**[官方模型卡](https://huggingface.co/zai-org/GLM-5.3)，[权重元数据 API](https://huggingface.co/api/models/zai-org/GLM-5.3)，[许可证全文](https://huggingface.co/zai-org/GLM-5.3/blob/main/LICENSE)。读取时 revision 为 `aca966e4e02791568aa6a4ced368624b3d897f42`，safetensors 元数据总参数 `753,329,940,480`；本次未下载权重、验证部署或将其厂商编程成绩外推成家史质量结论。

- **[S25] Voxtral Small：**[官方模型卡](https://huggingface.co/mistralai/Voxtral-Small-24B-2507)，[独立ASR结果与版本对应](2026-10-08-ai-sota-speech-evidence.md)。Apache-2.0、vLLM/Transformers、约55GB GPU RAM、时长和上下文；本研究未部署。
- **[S26] Breeze TTS 2：**[官方模型卡](https://huggingface.co/BreezeBlue/Breeze-TTS-2)，[许可证](https://huggingface.co/BreezeBlue/Breeze-TTS-2/blob/main/LICENSE)，[独立听感与许可核验](2026-10-08-ai-sota-speech-evidence.md)。核实版权许可与模型卡运行参考，未取得商用许可或实际部署。

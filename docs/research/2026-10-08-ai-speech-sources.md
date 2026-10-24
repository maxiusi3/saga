# UR Saga 语音栈官方资料核验

研究日期：**2026-10-08**。范围：英语家庭口述史的录音导入、长辈实时访谈、多人家庭对话、原声索引及合成朗读。仅使用实际读取的官方价格页、模型页和文档；未付费调用API、未评测真实家庭录音。页面读取日不等于发布时间；厂商的准确率和延迟宣传未作为跨厂商实测排名。

> **SOTA优先更新：** 质量与采购结论以[独立语音评测](2026-10-08-ai-sota-speech-evidence.md)及[主报告](2026-10-08-ai-blueprint-and-model-tiers.md)为准；本篇保留官方接口、价格和数据条件依据。

## 结论与选型方向

**现有录音处理应优先采用“预录制ASR＋原声时间索引＋独立编辑稿”路线；实时访谈另设成本与体验实验。** 单声道一小时录音的公开ASR标价约为$0.15—$0.36，远低于一小时完整实时会话的部分服务费；模型标价之外，返工、资料核对、断线恢复和人工支持仍需单独核算。

建议的第一轮候选：

- **现有录音底稿：** 更新为ElevenLabs `scribe_v2`。Nova-3保留吞吐对照；困难片段挑战者Step ASR Max的榜单版本映射、词时间缺口见新增语音评测。重点评估人名、低音量、归属和时间位置。
- **必要的二次说话人标注：** OpenAI `gpt-4o-transcribe-diarize` 可给段级说话人和时间。它不能自动替代第一遍的逐词时间索引；对齐和人工确认后另存标注层。
- **自然实时访谈：** 质量基准采用 `gpt-live-1`＋Astra medium；Realtime或链式方案是其后的降本/控制对照。`gpt-live-1` 和 Realtime 是不同接口与计费产品，不能互换报价。
- **TTS：** 用普通合成访谈员声音，不用合成声音替代家庭成员的原始录音。本轮独立听感依据支持ElevenLabs v4 Turbo作为基准。Deepgram官方推荐及Aura-2价格仍记录于下表，但不将厂商推荐等同于独立听感领先；2026-10-12前促销不进入长期预算。

上述是待测方案，不代表已经验证哪家对本项目最好。**Deepgram的退出模型训练选项已核实，但其$0.0043/分钟标价在`mip_opt_out=true`后的适用性/是否加价未由本次公开页面建立；使用该数字时必须保留“基础目录价，隐私配置后账单待确认”的标注。**

## 1. 已核实价格与计费单位

### 1.1 预录制ASR：按实际处理音频、声道与附加功能比较

以下均美元；小时换算为本报告计算。OpenAI部分分钟价格是官方表中的“Estimated cost”，不是所有录音固定一致的承诺。未计税、重试、存储、下载、LLM编辑、人工或电话服务。

| 服务与真实模型ID | 官方公开价格 | 一小时单声道基础成本 | 说话人分离/附加项 |
|---|---:|---:|---|
| OpenAI `gpt-transcribe` | $0.0045/分钟 | $0.27 | 官方当前推荐普通文件转录；字级时间戳和说话人标签使用专门模型 [O1][O2] |
| OpenAI `gpt-4o-mini-transcribe` | 约$0.003/分钟 | 约$0.18 | 音频输入$1.25/百万token、输出$5/百万token；不要默认有逐词时间戳 [O1] |
| OpenAI `gpt-4o-transcribe-diarize` | 约$0.006/分钟 | 约$0.36 | 包含段级说话人分离；仅Transcription API [O1][O3] |
| OpenAI `whisper-1` | $0.006/分钟 | $0.36 | 支持`word`/`segment`时间戳；不等于已包含说话人分离 [O1][O2] |
| Deepgram `nova-3` / `nova-3-general`，预录制单语PAYG | **$0.0043/分钟** | **$0.258** | 预录制Speaker Diarization标价Included；keyterm另$0.0013/分钟。MIP退出后实价待确认 [D1][D2] |
| Deepgram Nova-3预录制多语PAYG | $0.0052/分钟 | $0.312 | 不应因主语言为英语而误用更贵的多语配置 [D1] |
| AssemblyAI `universal-3-5-pro` | $0.21/小时 | $0.21 | 分离另$0.02/小时，合计$0.23；keyterms另$0.05/小时；prompting另$0.05/小时 [A1][A2] |
| AssemblyAI `universal-2` | $0.15/小时 | $0.15 | 分离另$0.02/小时；keyterms表中Included，普通prompting不支持 [A1] |
| ElevenLabs `scribe_v2` | $0.22/小时 | $0.22 | 模型支持逐词时间戳和最多32位说话人；价格页未单列分离费。keyterm另$0.05/小时、transcript editing另$0.07/小时 [E1][E2][E3] |

**声道不等于说话人数。** 单声道里三个人讲话，通常是一次ASR加说话人分离；两条独立声道各一位讲话，可逐声道识别。Deepgram官方FAQ示例：10分钟双声道按20分钟处理；AssemblyAI示例：一小时双声道按两小时计费。[D1][A1] 如果立体声只是同一环境的左右麦克风，不能假定左右各代表一位家庭成员。

Deepgram Growth价格以至少$4,000/年承诺为前提，不宜用它替代早期PAYG预算。免费额度、首月折扣与促销回赠均未当作稳定商业成本。[D1][E1]

### 1.2 流式ASR与完整实时会话

| 服务/配置 | 官方价格 | 计费区别 |
|---|---:|---|
| OpenAI `gpt-live-transcribe` / `gpt-realtime-whisper` | $0.017/分钟 | 单独实时转录，不能当包含AI回答的完整访谈 [O1] |
| Deepgram Nova-3单语Streaming PAYG | 当前促销$0.0048/分钟；**Regular $0.0077/分钟** | 常价$0.462/处理小时；流式分离另$0.002/分钟；长期预算宜用常价 [D1] |
| Deepgram `flux-general-en` | 当前$0.0065/分钟；Regular $0.0077/分钟 | 专为会话的ASR与turn detection；不是LLM或TTS全包 [D1][D2] |
| AssemblyAI `universal-3-6-pro` | $0.45/小时 | 流式分离另$0.12/小时；keyterms Included，prompting另$0.05/小时 [A1][A3] |
| AssemblyAI `universal-streaming-english` | $0.15/小时 | 流式分离另$0.12/小时；keyterms另$0.04/小时 [A1][A3] |
| ElevenLabs `scribe_v2_realtime` | $0.39/小时 | keyterm另$0.08/小时、transcript editing另$0.12/小时；不能把预录制价格套进来 [E1] |
| **OpenAI `gpt-live-1`** | **$0.05/会话分钟，按秒计，无整分钟进位** | **$3/活跃会话小时＋后端模型和工具费用**；说话、沉默、后端工作均计入active session；关麦不等于结束会话 [O4][O5] |
| Deepgram Voice Agent Standard | $0.075/分钟 | 按WebSocket连接时间，$4.50/连接小时；BYO LLM/TTS档需另外付自带服务费 [D1] |
| AssemblyAI Voice Agent API | $4.50/小时 | 官网称包含ASR、turn/interruption detection、其Voice Agent LLM、TTS与托管；未核实具体账户资格与另行电信费 [A1] |
| ElevenLabs Speech Engine | $0.08/分钟 | $4.80/分钟数折算小时；是speech pipeline，不据此假定覆盖用户自己的LLM；burst价$0.16/分钟 [E1] |

**计费注意：** 本次已明确OpenAI Live和Deepgram Agent的计费时长定义；AssemblyAI/ElevenLabs流式ASR的静默处理、连接时间计费细则及最低计费粒度未完整核实，不能把表中的“小时”自动理解成只计算说出的语音。Deepgram FAQ确认per-second billing，但关于静默的问答与回答并不充分解释全部模式；不要外推为静默一概免费。

### 1.3 OpenAI Realtime不能用统一“每会话分钟”报价

官方`gpt-realtime-2.1`及mini均按token计费：[O1]

| 模型 | 新音频输入/百万token | 缓存音频输入/百万token | 音频输出/百万token | 文本输入/输出，百万token |
|---|---:|---:|---:|---:|
| `gpt-realtime-2.1` | $32 | $0.40 | $64 | $4 / $24 |
| `gpt-realtime-2.1-mini` | $10 | $0.30 | $20 | $0.60 / $2.40 |

官方成本指南说明：用户音频约每100ms一个token，即600 token/音频分钟；助手音频约每50ms一个token，即1200 token/音频分钟，另有少量特殊token。[O5] 因此首次新增音频的局部换算为：

- `gpt-realtime-2.1`：输入$0.0192/音频分钟，输出$0.0768/音频分钟。
- `gpt-realtime-2.1-mini`：输入$0.006/音频分钟，输出$0.024/音频分钟。

**例子是预算假设，不是完整账单：** 若一次访谈的实际计费新增用户音频45分钟、助手输出10分钟，新增音频部分分别约$1.632与$0.51。仍要加文本、历史上下文再次输入及其缓存、工具、重试、其他服务。不能把输入和输出两个单价简单相加，然后乘整场会议时长。

### 1.4 TTS：字符、token和输出时间不能混算

| 服务/模型ID或型号 | 官方价格 | 对UR Saga的意义 |
|---|---:|---|
| OpenAI `gpt-4o-mini-tts` | 文本输入$0.60/百万token，音频输出$12/百万token | 不使用Realtime的token/时长比例自动换算另一模型；正式预算用实际usage [O1][O6] |
| OpenAI `tts-1` / `tts-1-hd` | $15 / $30 每百万字符 | 旧模型仍有公开价；选择前应试听，不仅凭低价 [O1][O6] |
| Deepgram `aura-2-thalia-en`等Aura-2 | $0.030/千字符，即$30/百万字符 | `/v1/speak`；具体声音通过`aura-2-{voice}-{language}`选择 [D1][D5] |
| Deepgram `flux-alexis-en`等Flux TTS | $0.045/千字符，即$45/百万字符 | 新一代英语TTS，`/v2/speak`；官方当前推荐英语新项目优先用它。首次返赠不进入长期成本 [D1][D5] |
| ElevenLabs `eleven_v4` | 常价$0.08/千字符，即$80/百万字符 | 页面显示72%折扣至Oct 12、当前$0.022/千字符；不按促销承诺长期毛利 [E1][E2] |
| ElevenLabs `eleven_v4_turbo` | 常价$0.04/千字符，即$40/百万字符 | 当前限时$0.011/千字符；正式商业账户最低条件/资格尚未核实 [E1][E2] |
| ElevenLabs `eleven_multilingual_v2` / `eleven_flash_v2_5` | $0.08 / $0.04 每千字符 | 表中不同档有月费和包含额度；不要在模型单位价之外遗漏套餐固定成本 [E1][E2] |

例如生成10,000字符，Aura-2目录价$0.30、Flux TTS $0.45、Eleven v4常价$0.80、v4 Turbo常价$0.40；字符不等于英文单词数或固定朗读分钟数。Eleven API页当前列Starter $6/月、Creator $22/月、Pro $99/月等档位及包含额度，也列Free/PAYG；本次未结账，不能据此保证任意账号可用全部模型、商业许可或无限并发。[E1]

## 2. 能力与接口边界

### OpenAI：普通转录、分离、时间戳和实时是不同能力

- 当前文件转录推荐ID为`gpt-transcribe`。文件上限25MB，支持MP3、MP4、MPEG、MPGA、M4A、WAV、WebM；长录音需压缩或分块，不能因为能流式返回文本就把它叫实时麦克风转录。[O2]
- 字级/段级时间戳明确用`whisper-1`与`timestamp_granularities[]`。不要以为所有新ASR型号自动继承此参数。[O2]
- `gpt-4o-transcribe-diarize`的`diarized_json`给每段`speaker/start/end`；超过30秒要求`chunking_strategy="auto"`或VAD配置；可提供最多4位已知说话人、每人2—10秒参考录音。仅Transcription API可用，不支持Realtime。[O2][O3]
- `gpt-live-1`支持同时听说、可将推理和工具交给后端；输入/输出为音频与文本，不支持图像、视频和Structured Outputs。照片应由后端单独理解后再提供安全的文字上下文，不能直接假定Live看见照片。[O4]
- TTS支持控制说话风格和流式输出；文档要求告知用户声音为AI生成。本文不建议将TTS伪装为家庭成员真实说过的话。[O6]

### Deepgram：保存字级索引，显式管理分离版本

- `nova-3`/`nova-3-general`适合预录制或流式普通ASR；`flux-general-en`是带轮次判断的英语会话ASR。默认`language=en`，多语配置须显式选择。[D2]
- 分离接口提供版本：`diarize_model=latest`当前预录制对应v2，流式对应v1；可固定`v1`或预录制`v2`。旧`diarize=true`仍指向v1，**仅使用旧布尔参数不会自动得到新的预录制分离器**。[D3]
- 预录制输出逐词`start/end`、`speaker`与`speaker_confidence`；流式示例有`speaker`但没有`speaker_confidence`。不能把模型置信度当“此人真实身份”的证明。[D3]
- `multichannel=true`分别转录声道，最多20声道；此功能与在混音中判断说话人是两个问题。[D4]

**建议的数据层：** 原文件和每次处理的模型ID、参数、时间戳原样保存；二次分离产生`segment → speaker`标注；编辑稿另外关联原词/原段。即使二次模型给出的文字更流畅，也不要覆盖第一遍Nova的逐词时间索引。跨chunk的`speaker_0`不能天然当作同一个人，需家庭确认或独立对齐。

### AssemblyAI：预录制和实时模型、收费附件不同

- 预录制真实ID是`universal-3-5-pro`与`universal-2`；`speech_models`默认顺序为前者再后者，前者支持18种语言，其他语言可回退；应记录实际模型而非只记录用户请求列表。[A2]
- 实时真实ID是`universal-3-6-pro`、`universal-3-5-pro`、`universal-streaming-english`、`universal-streaming-multilingual`；当前未指定时默认3.6，支持32种语言。固定测试ID，避免默认升级使成本/行为难以追踪。[A3]
- 官网ASR说明包含逐词时间戳；说话人分离另有附加费。Speaker Identification（真实名字/角色识别）又是不同的Speech Understanding附加能力，不应和分离混称。[A1]
- Sync API以短片段一次返回为目标，官网注明最多2分钟/请求、$0.30/小时。它不能直接替代长访谈导入管线。[A1]
- Voice Focus“只保留主要说话人”的能力适合某些单人情境，可能不适合本项目希望保留所有家庭成员的多人访谈，需按任务决定是否启用。[A1]

### ElevenLabs：丰富语音能力之外仍有模式约束

- `scribe_v2`批处理支持逐词时间戳、最多32位说话人；标准模式上限3GB/10小时。`scribe_v2_realtime`为WebSocket实时识别；本次文档未明确证明它具备与批处理相同的32说话人分离能力。[E2][E3]
- 多声道最多5条、每声道应只有一个人；`use_multi_channel=true`时必须`diarize=false`，不允许`num_speakers`。`combined`输出可按起始时间合并，但当前不能与webhook交付或entity detection/redaction同时使用。[E4]
- **官方文档内部限制有冲突：** STT FAQ说多声道所有声道合计须少于10小时，同页Key facts又写多声道1小时。本次不擅自选择较宽限制；长多声道上传前需核实。多声道金钱计费倍数也未由本次页面明确，不能拿“并发成本随声道增加”当价格证明。[E3][E4]
- `no_verbatim`会删除填充词、停顿失误等；`transcript_edit`是实验性改写并另收费。口述史底稿应保留原话版本，不能为了干净而丢掉可追溯原文。[E3]
- v4的每次TTS请求上限10,000字符；v3为5,000；Flash v2.5为40,000；v4 Turbo上限本次未取得明确行，标为待核实。[E2]

## 3. 数据保留、训练与区域

“API不训练”“零内容保留”“本地存储”和“区域处理”是不同承诺，不能互相替代。

| 供应商 | 实际读取到的官方区别 | 项目需要做的事 |
|---|---|---|
| OpenAI | API表列不用于训练；`/v1/audio/transcriptions`为无abuse-monitoring/application-state保留；`/v1/audio/speech`与`/v1/realtime`默认abuse监控30天；Live默认监控30天，application state为None或stored时30天。ZDR需批准且有端点限制 [O7] | 按使用端点核实；不要把“转录无保留”外推到TTS/Live/其他存储接口 |
| Deepgram | 参与MIP的数据可用于训练；可逐请求加`mip_opt_out=true`，官方称退出请求仅保留完成处理所需时长 [D6] | 所有预录/流式调用都明确设置；**退出后是否影响目录单价仍待合同/账单确认** |
| AssemblyAI | 符合合同的数据可用于训练；BAA、EU服务器或退出训练时不训练。退出后Streaming可零音频/转录保留，但元数据仍用于日志计费；异步管线另有TTL [A4] | 核实退出状态与删除机制。无TTL/BAA时，上传音频24小时开始删除、最多48小时，转录30天开始删除；最短1h TTL也可能因AWS处理延迟而非立即完成 |
| ElevenLabs | 默认保留数据；Zero Retention Mode为部分Enterprise客户提供，符合条件的API请求使用`enable_logging=false`；网页UI/playground不在ZRM范围；常规删除后的备份可保留最多30天 [E5] | 不把ZRM视为普通套餐默认；明确账号资格、日志与备份；普通默认保留完整时长本次未核实 |

区域区别：

- **OpenAI：**地区存储与地区处理分别列能力；非美国地区通常要求先获批准并签Modified Retention amendment。价格页提示符合条件、2026-03-05起发布的模型使用regional processing端点加10%；本次不逐模型断言全部语音型号适用。[O1][O7]
- **Deepgram：**`api.eu.deepgram.com`承诺EU内处理，区域不可用时失败而非转往境外；具体欧盟国家可能变化。另有澳洲端点，区域功能不完全一致，例如EU流式Nova-3中途更新keyterms的支持限制。[D7]
- **AssemblyAI：**预录默认`api.assemblyai.com`为美国；`api.eu.assemblyai.com`为欧盟数据驻留。流式使用其专门区域端点，不能直接把预录主机名复制到WebSocket接口；本次未逐项核实实时区域可用型号。[A5]
- **ElevenLabs：**数据驻留是Enterprise功能，US默认、另有EU/India/Singapore隔离环境。存储位置不等于全部处理位置；官方说明EU配合API与ZRM可以限制处理，但外接LLM/webhook可能再次跨区。[E6]

## 4. 针对项目的成本与验收建议

**预录制基准账：** 假定一条单声道录音、只做一遍Nova-3预录转录，1/5/20小时分别为$0.258/$1.29/$5.16。这是目录基础价，不是“含隐私配置的已验证最终价”，也不含keyterms和二次模型。若再将全部音频送OpenAI diarize，分别另加约$0.36/$1.80/$7.20；可只对需要复核的片段做第二遍，但必须保留上下文及跨片段说话人映射。

**实时验收：** 把输入音频分钟、输出音频分钟、连接活跃分钟、token、重连、工具与后端调用分别记录。不要只把“聊了一小时”存成一个无区分数字。长辈停顿多，按连接时间付费会放大停顿成本；不应为省几角钱强行催促，需要在体验和成本之间实测。

首轮不用接入所有供应商。用同一批取得同意的20—30段测试录音，比较两个预录候选与两个实时方式即可。至少包含：单人清晰、低声/沙哑、地名人名、两人抢话、家庭环境噪声、电话音质、長停顿与中途断线。衡量：事实词错误、说话人归属、原声定位误差、漏字/补字、恢复能力、每个被接受章节的真实费用。这个建议是测试设计，不是本轮已经完成的测试。

## 5. 明确未核实项

1. Deepgram退出MIP后的真实单价、是否有合同特价或附加费；不能从退出文档未写价格就推断免费。
2. ElevenLabs正式商用最低账户条件、企业ZRM/驻留价格，以及多声道金钱计费规则与时长冲突。
3. 所有账户的实际并发、速率、区域准入和新型号访问；官网存在型号不等于本项目账号已开通。
4. 多家厂商模型在英语长辈/家庭场景的真实相对准确率；没有调用付费API，不声称已测质量或延迟。
5. 实时转录各服务的静默计费完整条款、最短时间粒度及网络异常扣费；表中只写已核实单位。
6. Gemini Live本次未扩展核验，不用旧记忆补充其型号或价格。

## 6. 官方来源索引

全部于2026-10-08读取。价格页可能实时变化，应在采购/上线时再核一次；完整临时抓取保存在`/tmp/saga-speech/`。

- **O1** [OpenAI pricing](https://developers.openai.com/api/docs/pricing.md)：语音、ASR、TTS、Live计费；Markdown包含HTML默认折叠的型号行。
- **O2** [Speech to text](https://developers.openai.com/api/docs/guides/speech-to-text.md)：推荐gpt-transcribe、25MB、时间戳、分离与分块。
- **O3** [GPT-4o Transcribe Diarize](https://developers.openai.com/api/docs/models/gpt-4o-transcribe-diarize.md)：模型ID、Transcription限定。
- **O4** [GPT-Live 1](https://developers.openai.com/api/docs/models/gpt-live-1.md)：全双工、模态、后端与按秒会话计费。
- **O5** [Voice latency and cost](https://developers.openai.com/api/docs/guides/voice-latency-cost.md)：Live时长定义、Realtime音频token换算及历史上下文费用。
- **O6** [Text to speech](https://developers.openai.com/api/docs/guides/text-to-speech.md)：gpt-4o-mini-tts、tts-1/hd、语音风格和AI声音告知。
- **O7** [Your data](https://developers.openai.com/api/docs/guides/your-data.md)：按端点的数据保留、ZDR与地区条款。
- **D1** [Deepgram pricing](https://deepgram.com/pricing)：PAYG/Growth、流式促销与常价、附加功能、TTS、Agent与声道FAQ。
- **D2** [Deepgram models/languages](https://developers.deepgram.com/docs/models-languages-overview)：Nova-3、Flux准确ID与用途。
- **D3** [Deepgram diarization](https://developers.deepgram.com/docs/diarization.md)：v1/v2、字级speaker和时间戳。
- **D4** [Deepgram multichannel](https://developers.deepgram.com/docs/multichannel)：分声道、最多20声道。
- **D5** [Deepgram TTS models](https://developers.deepgram.com/docs/tts-models-languages-overview.md)：Flux、Aura-2的型号与接口区别。
- **D6** [Deepgram MIP](https://developers.deepgram.com/docs/the-deepgram-model-improvement-partnership-program.md)：退出参数与数据处理范围；**未提供退出后的计价确认**。
- **D7** [Deepgram regional endpoints](https://developers.deepgram.com/reference/regional-endpoints.md)：区域与功能可用差异。
- **A1** [AssemblyAI pricing](https://www.assemblyai.com/pricing)：预录/流式型号、附加费、Sync、Agent、按声道FAQ。
- **A2** [AssemblyAI prerecorded model selection](https://www.assemblyai.com/docs/pre-recorded-audio/select-the-speech-model.md)：真实ID与回退。
- **A3** [AssemblyAI streaming model selection](https://www.assemblyai.com/docs/streaming/select-the-speech-model)：3.6、3.5与Universal-Streaming ID。
- **A4** [AssemblyAI data retention and training](https://www.assemblyai.com/docs/data-retention-and-model-training)：异步TTL、流式零保留与训练控制。
- **A5** [AssemblyAI cloud endpoints](https://www.assemblyai.com/docs/pre-recorded-audio/select-the-region.md)：US/EU预录入口。
- **E1** [ElevenLabs API pricing](https://elevenlabs.io/pricing/api)：Scribe、TTS、Speech Engine、套餐、限时折扣；未结账。
- **E2** [ElevenLabs models](https://elevenlabs.io/docs/overview/models)：Scribe v2、v4/Turbo等ID、字符限制。
- **E3** [ElevenLabs STT capabilities](https://elevenlabs.io/docs/overview/capabilities/speech-to-text)：说话人、长文件、no_verbatim、实验编辑；多声道时长内部有冲突。
- **E4** [ElevenLabs multichannel](https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/batch/multichannel-transcription.md)：最多5声道、每声道一人、分离/合并/异步限制。
- **E5** [ElevenLabs Zero Retention Mode](https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode.md)：Enterprise资格、API开关、默认保留与备份。
- **E6** [ElevenLabs data residency](https://elevenlabs.io/docs/overview/administration/data-residency.md)：地区存储与处理、Enterprise范围。

读取失败与修正：AssemblyAI根`/models.md`、Deepgram猜测`/docs/data-privacy-and-security`、ElevenLabs猜测`/docs/overview/administration/zero-retention-mode`返回Not Found；随后根据各官方`llms.txt`定位正确页面。AssemblyAI预录模型HTML首次超时，Markdown版本读取成功。错误页面没有作为能力或价格证据。

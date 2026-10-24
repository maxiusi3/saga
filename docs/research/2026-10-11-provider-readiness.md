# UR Saga：供应商与 Worker 接入准备核查

核查日期：2026-10-11（Asia/Taipei）。配套[综合计划](../2026-10-10-integrated-upgrade-plan.md)、[已确认决策](../2026-10-10-upgrade-decisions.md)、[P0准备计划](../superpowers/plans/2026-10-11-upgrade-p0-preparation.md)。

**结论：保留 D01–D16 全 A，以及 Scribe → Opus → Astra 的高质量基准。官方公开页面确认这些候选的型号和基础价格，但没有任何一家取得本项目的账户、数据配置、费用与质量全项验收。** 可以继续本地契约和模拟服务故障测试；本表不允许把候选状态写成生产已接入，也不构成 G0/G1 通过。

本次只读取本地文档和公开 HTTP GET。没有读取环境密钥、登录供应商账户、接受条款、付费推理、上传家庭资料、采购、部署或下载模型权重。下文的“确认”限定为已读官方正文；用户账户资格和实际运行结果另列。

## 1. 补读覆盖与证据日期

全文补读以下七份本地专题及其中列出的来源索引：

- [AI架构与三档](2026-10-08-ai-blueprint-and-model-tiers.md)
- [OpenAI与平台](2026-10-08-ai-openai-and-platform-sources.md)
- [文字与多模态](2026-10-08-ai-text-sources.md)
- [语音供应商](2026-10-08-ai-speech-sources.md)
- [文字/视觉/检索选型](2026-10-08-ai-sota-selection-evidence.md)
- [语音选型](2026-10-08-ai-sota-speech-evidence.md)
- [本地部署](2026-10-08-ai-local-deployment.md)

关联阅读用户指定的综合计划、决策清单、[实现差距审计](2026-10-10-implementation-gap-audit.md)与[证据和产物复核](2026-10-10-evidence-and-artifact-review.md)，重点核对 D06/D07/D08/D12/D15、T00/T05/T06 和 G0。旧证据复核中的“尚待选择”描述保留为 10 月 10 日历史；当前执行状态以 10 月 11 日全部 A 为准。

本次重新读取的网页限于第 6 节明确列出的官方来源和导航索引，**没有逐一重开七份专题的全部外链**。AA、Arena、MTEB、社交帖子、当地设备性能及全部开放模型许可均未重新联网复核；其分数、排名和部署条件仍是 10 月 8 日证据，不更新为本日实测。

## 2. 每能力一条基准：公开事实与未完成资格分开

以下均为美元，文本价格单位为百万计费 token；不含税、最低套餐、企业条款、区域费用、重试、存储和人工。价格是读取日目录价，账户未报价、未结账。

| 能力 / 接口候选 | 本次公开正文确认 | 接入前仍需取得的证据 |
|---|---|---|
| ASR：ElevenLabs `scribe_v2`，Speech to Text API | 模型目录与能力页列逐词时间戳、最多 32 位说话人；示例含 `words[].start/end/type/speaker_id`。API价为 **$0.22/小时**，keyterm另 $0.05/小时、transcript editing另 $0.07/小时。[E1–E3] | 项目账户模型权限、商用条件、并发/文件限制、训练退出、允许处理区域、普通保留/删除时限、ZRM资格和实际报价。多声道旧文档冲突尚未结清，不以较宽数值作为上传承诺。 |
| 提取/编辑：Anthropic `claude-opus-5-5`，`/v1/messages` | 精确ID、文字/图片输入、文字输出、1M上下文、128K输出；基础 **$4/$20**。官方默认 effort 为 `medium`；Saga 的 `high` 是应显式配置的基准。thinking始终开启；forced tool use有兼容限制。[A1–A2] | 商业组织可调用性、速率、区域设置、标准保留条款或ZDR安排、费用上限、实际schema/拒绝/截断行为。不可只替换旧模型字符串。 |
| 证据复核：OpenAI `gpt-6-astra`，`/v1/responses` | 精确ID、文字/图片输入、结构化输出；`high`受支持；基础 **$10/$50**。超过272K输入token时整次请求触发长上下文加价。官方列同名snapshot；本次不编造日期ID。[O1] | 实际API组织/项目、账户访问与配额、端点及区域资格、数据共享关闭状态、保留控制、单任务账单和复核增益。Codex中可选择同名模型不能证明Saga API账户已开通。 |
| 后续检索：Voyage `voyage-4-large`＋`rerank-3` | 4-large支持2048维，默认1024维；基础 **$0.12/$0.05**。重排按查询长度×候选数＋候选正文计费。[V1–V3] | 管理员完成并记录训练/存储退出、处理地域和分包、速率、支付条件、实际调用和检索效果。检索阶段再接入，不让当前工程依赖四家同时就绪。 |

模型网关须记录实际请求的供应商、完整主机/端点、模型ID、配置版本、请求ID、输入素材版本、用途/地域约束、用量与结果状态。Opus的无日期ID按官方文档属于固定snapshot；其他供应商的别名规则分别处理。[A1] 所有候选都没有 Saga 质量结果，不能据公开参数或价格写“最强”“已达标”。

原声底稿不启用 `no_verbatim`；官方说明该模式会删除填充词、false starts和不流利部分。`transcript_edit`为另收费的实验编辑功能，不能成为唯一原始转写。[E2–E3] Claude原生citations与`output_config.format`同请求不兼容，会返回400；事实账本继续采用Saga自有来源ID并由代码校验。[A4]

## 3. 数据资格：必须进入 P0 的新增核查项

| 供应商 | 训练、保留与地域的本次证据 | 对 D08/D12 的影响 |
|---|---|---|
| ElevenLabs | 默认保留。ZRM仅对部分Enterprise账户开放，合格API请求使用`enable_logging=false`，UI/playground不在范围。普通删除会从数据库移除音频/文字，但debugging/moderation日志仍可能保留；删除后备份最长30天。地区隔离也为Enterprise功能；默认US存储，EU/India/Singapore为独立环境。存储地域不保证处理地域；文档以EU＋API＋ZRM说明限定处理条件，外接服务可能再次出区。[E4–E5] | 普通付费、训练退出、ZRM、地区隔离是不同资格。默认保留的完整时长、本项目训练设置、日志删除和合约范围仍未核实。不能承诺供应商全部活动数据7天内删除。 |
| Anthropic | 数据保留文档称保留数据未经明确许可不用于训练；ZDR需单独组织启用，仅覆盖合格API功能，Console和消费产品不自动继承。JSON schema可能在最后使用后缓存最多24小时；Batch为29天保留且不适用ZDR。[A3] | 不在schema属性名/描述中放家庭专名和正文；同步Messages也不能仅凭账户有ZDR就使用任意有状态功能。标准商业保留的完整条款需账户核对，本报告不虚构默认删除SLA。 |
| Anthropic挑战者Fable | 当前文档将Fable 5/5.1列为Covered Models，要求30天数据保留，除非Anthropic明确例外授权，否则不适用ZDR；该要求随其不同托管平台仍需各自落实。[A3] | **Opus合格不代表Fable回退合格。** 高质量路线保持不变；有严格留存要求的项目不得静默用Fable替换。这个新增限制应进入能力路由和评测候选表。 |
| OpenAI | API默认不用于训练，除非明确opt-in。通用滥用日志通常保留最长30天并有例外；Responses默认/`store=true`另有至少30天应用状态保留。`store:false`不能消除通用监控、缓存或有状态功能的规则。ZDR/MAM需批准，功能/模型/项目各有约束；非US驻留通常还需Modified Retention amendment，驻留与处理地域分别核对。[O2] | 先以最小文本/图片API范围落实数据条件；不把文件、Batch、Background、工具及缓存自动纳入同一删除承诺。记录项目配置和真实端点，不能从“不训练”推出零留存。 |
| Voyage | FAQ明确：Voyage托管API可退出存储及未来训练，取得公开所述zero-day retention；必须有付款方式在档，组织Admin在Terms of Service把`Opted In`切成`Opted Out`。[V4] | **不能把Voyage零留存当成默认值。** 本项目未核对/修改该开关；地域、分包、元数据及所有功能的删除边界尚缺合同证据。先记录资格，不调用含家庭正文的embedding/rerank。 |

上述并不把 D08=A 改成必须购买企业零留存。实际项目可采用符合已同意用途的数据条件；但 D12 的“立即撤销访问/新处理、活动数据7天、备份30天”仍是带验证条件的工程目标。向家庭给出具体天数前，要逐项区分Saga控制的原件/派生件、供应商应用状态、监控日志、备份和法定例外。当前没有足够证据覆盖整个链路的7天承诺。

供应商资格登记的最小验收材料：账户/组织代号（不记录密钥）、合同/设置证据日期、实际API端点、用途、训练开关、存储及处理区域、保留与删除机制、分包处理、最低支出及限额；然后才以虚构短样本记录请求ID、输出字段、失败行为和账单。没有合格备用时保留原件并显示待处理。

## 4. D07 队列与独立 Worker 的具体选择范围

**建议先以 pg-boss＋独立 Node Worker 做 D07=A 的代表性恢复验证；Supabase Queues/pgmq作为同一选项内的备选。** 这是基于当前TypeScript/Postgres栈与减少自写调度代码的工程判断，没有采购、安装、连接数据库或完成故障演练。

| 方案 | 公开依据 | 本项目仍需验证 |
|---|---|---|
| pg-boss＋独立Worker，首轮PoC建议 | 官方README列Postgres事务内入队、重试/退避、死信与redrive、后台消费者；worker文档列过期与心跳。读取日发布包元数据为 **12.37.1**，Node **≥22.12.0**，MIT；README要求PostgreSQL≥13。[Q1–Q3] | 安装时固定实际版本与lockfile；核对部署Node/PG版本、数据库连接模式、schema权限、事务内业务状态与入队、心跳/过期和取消。网页示例不等于当前环境支持；API密钥不授予数据库连接权限。 |
| Supabase Queues/pgmq＋独立Worker | 官方称Postgres原生持久队列；“exactly once”明确限定 **visibility window内向consumer投递**，可归档和控制访问。[Q4] | 已部署pgmq版本及可用性、私有消费者权限、visibility续期、退避/死信/取消的责任。队列消息留资产/任务ID，避免复制家庭正文到队列及归档。 |
| Supabase Edge Functions，短处理入口 | 官方托管上限：256MB、CPU 2秒/请求；wall clock免费150秒/付费400秒，request idle 150秒。[Q5] | 可承接受限编排/回调；不能据此认定长音频FFmpeg、长模型任务或跨天批准已可在请求内完成。独立Worker仍是D02/D07的实现边界。 |
| Temporal，保留条件性升级 | 官方Activity说明Worker崩溃等场景依赖超时和Retry Policy恢复，Activity可能重试。[Q6] | 仅当A方案恢复维护成本有实际证据过高时再提出D07调整；不自动采购，不宣称Temporal可消除模型重复收费。 |

四个必须留下执行证据的场景（10月11日未运行；10月15日已完成[本地 PostgreSQL/pg-boss 与独立进程验证](2026-10-15-t05-durable-worker-poc.md)，真实供应商与部署证据仍缺）：

1. **进程退出**：领取后、供应商发出前、结果落库前分别终止Worker；租约恢复并复用已完成阶段。
2. **重复消息**：同一任务/输入版本/配置版本只生成一份业务结果；新重试有attempt记录。
3. **外部结果未知**：保存request ID；能查询则先查询，不能查询则进入待核对/有预算上限的重试，不能无限重发。
4. **跨天批准与撤销**：保存`awaiting_review`业务状态，批准后创建下一阶段任务；执行前重新查权限、用途同意和删除墓碑，取消不能只靠杀本地进程。

队列的事务、锁或visibility只解决其自身范围；第三方请求已被接受而Worker尚未提交结果时，仍可能重复收费。应把`ProcessingRun`与attempt、幂等键、供应商请求ID、结果复用和预算预留作为Saga责任。

检索约束亦保持：pgvector当前README的HNSW普通`vector`最多2000维、`halfvec`最多4000维。Voyage基准2048维不能直接建普通vector HNSW；初期可按家庭授权子集精确检索，或验证halfvec召回后建索引。[Q7]

## 5. 可继续实施的范围与未关闭项

- **可继续**：T00真实失败/演示隔离、T02资产契约、T05任务状态/幂等设计、两家庭授权反例、用固定虚构响应测试超时与失败、独立Worker部署规格。
- **供应商接入前**：补每行账户/地域/训练/保留/删除/预算条件，再做虚构素材探测。`high`、来源ID、`store`及日志参数在适配器中显式配置，不依赖默认值。
- **G0仍缺**：真实账户可调用性、有效合同/设置、实际费用上限、生产队列/Worker环境证据（四场景已有本地进程/事务实验）；公开资料通过不等于供应商资格通过。
- **G1前不处理正式珍贵素材；G3前不接受真实付款**。D15继续只选一条本地链、先实测后采购；本轮未验证硬件、runtime、权重revision或离线出站，不把10月8日的条件路线升级为本机可用事实。
- **费用**：本次核心基础目录价与10月8日算例一致，但未重跑成本脚本或生成账单；$2.62452仅为原固定工作量且已含20%预留的算例。最低套餐、企业ZRM/驻留、真实token、重试与失败家庭成本需补入经营账。

## 6. 本次实际读取的官方来源

以下全部于 **2026-10-11** 成功HTTP GET并读取相关正文；网页日期不是发布日期。动态HTML转换为可读文字，Markdown按原文读取。表中未声明全部页面逐行审阅；引用仅限上文使用的段落/参数。抓取时使用临时响应与manifest，续接时临时目录已不存在；持久交付为本报告的来源表、读取日期及核查结论，不声称保留了原始网页快照。采购/接入时需重新留存对应账户与条款证据。

| 编号 | 官方URL / 阅读内容 |
|---|---|
| E1 | [ElevenLabs models](https://elevenlabs.io/docs/overview/models)：Scribe型号与能力 |
| E2 | [Speech to Text](https://elevenlabs.io/docs/overview/capabilities/speech-to-text)：词时间、speaker字段、no_verbatim与编辑 |
| E3 | [API pricing](https://elevenlabs.io/pricing/api)：$0.22/h、附加费及套餐显示；未使用首月促销作长期成本 |
| E4 | [Zero Retention Mode](https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode.md)：企业资格、API范围、普通删除/日志/备份 |
| E5 | [Data residency](https://elevenlabs.io/docs/overview/administration/data-residency.md)：存储/处理区分、地区主机及独立账户 |
| A1 | [Claude models](https://platform.claude.com/docs/en/models/overview.md)：原about-claude路径重定向至此，精确ID、固定snapshot与默认effort |
| A2 | [Opus 5.5](https://platform.claude.com/docs/en/models/opus-5-5/overview.md)及[pricing](https://platform.claude.com/docs/en/about-claude/pricing.md)：型号、基本价与兼容限制 |
| A3 | [API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention.md)：原zero-data-retention路径重定向至此；ZDR、Covered Models、Batch/schema条件 |
| A4 | [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md)：citations同请求冲突 |
| O1 | [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra.md)及[pricing](https://developers.openai.com/api/docs/pricing.md)：精确ID、能力、基本价与长上下文 |
| O2 | [Your data](https://developers.openai.com/api/docs/guides/your-data.md)：API训练、Responses、ZDR/例外、驻留资格 |
| V1 | [Embeddings](https://docs.voyageai.com/docs/embeddings)：型号、默认/可选维度 |
| V2 | [Reranker](https://docs.voyageai.com/docs/reranker.md)：rerank-3与接口边界 |
| V3 | [Pricing](https://docs.voyageai.com/docs/pricing.md)：文本与重排计价，页面元数据updatedAt为2026-09-29 |
| V4 | [FAQ](https://docs.voyageai.com/docs/faq.md)：付款方式、Admin、Opted Out与zero-day retention |
| Q1 | [pg-boss官方README](https://raw.githubusercontent.com/timgit/pg-boss/master/README.md)：PG要求、事务、重试、死信 |
| Q2 | [pg-boss发布元数据](https://registry.npmjs.org/pg-boss/latest)：本日12.37.1、Node≥22.12.0、MIT；这是动态latest读取，不是已安装版本 |
| Q3 | [pg-boss workers](https://pgboss.io/api/workers)：心跳、过期及事务worker边界 |
| Q4 | [Supabase Queues](https://supabase.com/docs/guides/queues)：持久化、可见窗口和投递语义 |
| Q5 | [Supabase Edge Functions limits](https://supabase.com/docs/guides/functions/limits)：内存、CPU、wall clock与idle上限 |
| Q6 | [Temporal Activity Execution](https://docs.temporal.io/activity-execution)：丢失任务、超时与重试 |
| Q7 | [pgvector官方README](https://raw.githubusercontent.com/pgvector/pgvector/master/README.md)：HNSW维度；部署时仍需固定实际版本 |

导航/可访问性记录：ElevenLabs和Voyage的`llms.txt`只用来定位官方页面，不作为功能或合同证据。无浏览器User-Agent的首次索引/FAQ读取出现403，使用普通浏览器User-Agent重试后ElevenLabs索引和Voyage FAQ可读；未绕过登录或访问权限。Claude根`llms.txt`返回403，未作为证据。pgmq仓库根README仅返回24字节占位内容，未作为能力依据；另取得Supabase pgmq文档但没有据此认定本项目安装版本。末批额外请求未完成内容审阅，不纳入上表证据。

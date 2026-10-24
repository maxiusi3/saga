# October Upgrade P0 Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this preparation plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan produces evidence and implementation specifications; feature implementation follows those specifications.

**Goal:** 将D01–D16全部A落实为可核查的环境、数据、供应商和验收规格，让一名主要开发者按T02→T05→T03→T04实施可靠资料底座。

**Architecture:** 保留Next.js与Supabase，增加独立持久Worker。原声、权限、处理、导出和删除围绕同一资产身份；正式AI失败不得生成模拟档案。工程串行，外部研究和真机测试使用独立资源。

**Tech Stack:** Next.js 16.2.6、React 19、TypeScript、npm workspaces、Supabase Postgres/Auth/Storage、Jest；队列产品和模型账户经资格验证后记录确切配置。

**Spec:** [已确认综合实施计划](../../2026-10-10-integrated-upgrade-plan.md) · [决策台账](../../2026-10-10-upgrade-decisions.md) · [代码差距审计](../../research/2026-10-10-implementation-gap-audit.md)。

**10月24日本轮更新（G0 里程碑达成，已推送 GitHub）：** [Storage行为预演与7份未登记根迁移对账](../../research/2026-10-24-storage-behavior-and-migrations.md)在本地 PG17.4 完整重放私有捕获的 6 函数/7 触发器（RED 4/53、GREEN 22/974、生命周期 4 例，规格 PASS/质量 Approved），完成 7 份未登记根迁移逐项对账与实际资产路径汇总；负责人随后确认采用 **方案 B**（`pg_dump` 自定义归档逻辑备份 + 对象存储 SHA-256 冻结清单 + 独立删除墓碑重放 + `pg_restore` 隔离恢复），并明确将供应商样本探针与耗时/账单测算推迟至后续阶段（`deferred_by_user` 至 P2 `T06` 前）。已在本地 PG17.4 完成方案 B 备份恢复、五步幂等前向收敛 SQL 双次重放、应用回退与删除墓碑防复活演练（[`rehearsal-2026-10-24T08-51-18.795Z-380f131c-7974-4690-b297-421575017a6b.json`](../../research/evidence/2026-10-24-migration-rehearsal/rehearsal-2026-10-24T08-51-18.795Z-380f131c-7974-4690-b297-421575017a6b.json)，5 场景/47 断言通过）。810 应用输入未变，接手复核 `npm run verify`（Web 108/1438、180 页）退出 0。**至此主计划 §7.1 的 G0 五项条件与 P0 修复全部达成（`G0 = true`、`p0Complete = true`）**，见[里程碑判定](../../research/evidence/2026-10-24-storage-behavior/milestone-check.json)。按负责人授权推送 `codex/october-upgrade-p0` 分支至 GitHub（不合并 `main`、不执行远端迁移或生产部署）。

**10月23日本轮更新：** [P0差距与Storage/旧删除修复](../../research/2026-10-23-p0-gap-and-storage-audit.md)补齐六函数/七触发器真实定义及静态语义，完成旧删除入口本地关闭。采集53项、PG17合成采集34断言/4场景、删除3/18及项目Web108/1438、shared4/16、infra7、180页通过，两实现独立规格PASS/质量Approved；收尾见[汇总](../../research/evidence/2026-10-23-storage-definition-capture/verification.json)。原型可评审已有证据；T01观察仍0/6–8户。真实权限/Storage HTTP、迁移/备份恢复、供应商账户条件、部署Auth仍未验收；P1完整adapter与deferred_by_user真机单列，不将它们加为G0新门槛。P0/G0仍未通过，无提交/推送/迁移/部署。以下PG17记录为前批历史。

**当前更新（2026-10-23）：** [PG17旧RLS／来源账本组合](../../research/2026-10-22-pg17-rls-source-composition.md)本地实测完成；实现、协作材料、文档和整批独立审查均PASS／Approved，零待修项；最终完整性结果见验证汇总中的封存报告；正常/污染环境各72场景、832个行为断言、236项账本检查及18条真实锁证据；六项兼容RED和四类生命周期均通过。历史账本与RLS矩阵分阶段运行，最终独立seed同库组合全部候选并证明撤权后读取/绑定拒绝与旁路关闭；不宣称旧归属变更竞态在RLS身份保护下通过。应用输入不变，复用10月21日Web105/1420、shared4/16、infra7及180页的原验证，未重跑。见[状态](../../research/evidence/2026-10-22-pg17-rls-source-composition/verification.json)和[原质量门](../../research/evidence/2026-10-22-pg17-rls-source-composition/milestone-check.json)。生产Storage/Auth/完整依赖、迁移等价/回填/回退/备份恢复、供应商条件和正式adapter仍需验收；真机deferred_by_user，原P0/G0–G4=false，未提交/推送/迁移/部署。原定义与历史记录保持不变。

## Global Constraints

- 2026-10-13负责人要求暂不部署，完成里程碑后再统一部署；2026-10-15授权达到原计划里程碑后推送GitHub。继续本地开发/验证，未达门槛不推送，不自动授权合并main、远端迁移或部署。


- 决策来源：2026-10-11负责人“D03=A，其他按照推荐”；D01–D16全部A。
- 一名主要开发者、每周约4有效工程人日；总体约24–34周；高质量优先、工期灵活。
- 正式档案零模拟、权限隔离、原件可交付；严重事实错误未解决不得进入批准稿。
- 首版音频＋照片；先音频导入，再可靠录音＋家人陪同；两入口均进入试点。
- 模型候选取自10月8日报告；接入时核实确切ID、账户、区域、保留/训练/删除条件。
- US$59有限范围数字项目、完整档案＋PDF、12个月托管、续存选项、到期前90/30天提醒；数量限制和续存/退款细则在T11前落实。
- 删除工程目标：立即撤销访问/新处理、活动存储与派生数据7天、备份最长30天；对外承诺须有供应商能力与演练证据。
- 正式素材等G1，真实付款等G3；G2错误检出率≥95%、误报≤10%；首次成果≥80%、项目完成≥70%为内部评估目标。
- 不在`_archive_backend`新增业务；迁移入口核对根`supabase/migrations/`与实际远端历史。
- 本准备计划不改变应用运行行为；T00的模拟隔离修复和T01的产品原型须另有实现与验收记录。

## 范围与文件职责

这是P0的证据与规格准备部分，不等于整个P0/G0完成。P0另含真实失败路径修复、原型及研究；人日仍计入主计划T00/T01，不重复增加估算。

| 后续执行时创建的产物 | 职责 |
|---|---|
| `docs/research/2026-10-11-upgrade-baseline.md` | commit、运行时、命令结果、远端状态和媒体流证据 |
| `docs/research/2026-10-11-provider-readiness.md` | 模型/Worker供应商能力、数据边界、费用和接入资格 |
| [2026-10-13-upgrade-p0-gates.md](../specs/2026-10-13-upgrade-p0-gates.md) | 支持矩阵、样本与指标定义、G0–G4证据要求；10月13日已写规格，未执行真机/家庭验收 |
| [2026-10-13-upgrade-p1-contracts.md](../specs/2026-10-13-upgrade-p1-contracts.md) | 资产、任务、权限/删除、录音接口与迁移契约v0.1；本地schema已对照，远端待核 |

基线与供应商准备报告已创建；质量门定义和P1契约v0.1于10月13日落文。原计划中规格文件使用10月11日占位日期，实际按创建日期命名。定义已写不代表外部证据或验收通过；下列步骤分别跟踪剩余工作，不能照抄旧战略的示例代码。

## Task 1: 固定代码与环境基线

**Files:** 读取`package.json`、`packages/web/package.json`、`CLAUDE.md`、`.github/workflows/deploy.yml`、`supabase/config.toml`；创建`docs/research/2026-10-11-upgrade-baseline.md`。

**Interfaces:** 输入当前Git状态和命令输出；输出带时间、commit、检查方法、结果及证据位置的表。生产状态独立于本地状态。

- [x] **Step 1: 记录运行时与工作树。** 在仓库根目录执行；保留既有未提交文档，不混入功能提交。

```bash
git rev-parse HEAD
git status --short
node --version
npm --version
```

- [x] **Step 2: 获取匹配代码状态的验证证据。** 已完成基线及T00修改后的核验，具体结果见[实施基线](../../research/2026-10-11-upgrade-baseline.md)；变化后重跑。infra和shared不包含在verify内，分别验证。

```bash
npm run verify
npm run test:infra
npm test --workspace=packages/shared -- --runInBand
```

预期全部退出0；记录失败、跳过、警告和测试数量。命令通过不证明线上部署、真机录音、权限或备份恢复通过。

- [x] **Step 3: 核对实际部署。** 已检查工作流、部署文档、本地环境变量和 CLI/GitHub 只读尝试；远端迁移与部署记录因 CLI 权限 400、GitHub API EOF 未取得，逐项记为未验证及其 G0/G1影响，见[T02 schema/部署核对](../../research/2026-10-13-t02-schema-and-deployment-check.md)。10月15日[补核](../../research/2026-10-15-readiness-refresh.md)已取得Supabase项目身份和GitHub运行/部署记录；数据库SQL仍未执行，RLS/备份/当前Vercel设置仍未取得。不记录凭据值或家庭正文。

## Task 2: 核对媒体、权限和迁移

**Files:** 读取`packages/web/src/lib/storage.ts`、`lib/stories.ts`、`lib/recorder-db.ts`、`lib/server/project-access.ts`、`app/api/ai/transcribe/route.ts`、`app/api/projects/[id]/export/route.ts`（简写路径相对`packages/web/src/`）；读取根迁移、历史SQL及部署文档；更新Task 1基线。

**Interfaces:** 消费Task 1的commit与环境；输出“入口→身份/项目校验→bucket/key→派生件→导出/删除”路径表和迁移对照表。

- [x] **Step 1: 找到真实调用。** 搜索后逐段阅读命中代码。

```bash
rg -n 'audio-recordings|storagePath|\.download\(|\.remove\(|uploadStoryAudio' packages/web/src/lib packages/web/src/app/api
rg -n 'requireProjectAccess|requireAiRequest|getSupabaseAdmin' packages/web/src/app/api/ai packages/web/src/app/api/projects packages/web/src/lib/server
rg --files supabase/migrations packages/web/supabase
rg -n 'migration|db push|supabase' .github/workflows/deploy.yml docs/deployment/github-vercel-supabase.md
```

- [x] **Step 2: 复核失配。** 核实上传`audio-recordings`、ASR固定`saga`、删除另拼路径是否仍存在；逐项附当前代码位置、资产身份来源及失败情景。
- [x] **Step 3: 对照schema和迁移。** 本地 bootstrap/类型/根迁移已与拟新增职责映射到P1契约；10月17日已用专用只读账户取得实际表/字段/RLS/索引/约束和4条历史，发现7个未登记迁移与已存在结构、Storage规则及字段兼容差异；bucket配置仍42501，详见[本次对照](../../research/2026-10-17-remote-metadata-reconciliation.md)。孤儿对象、缺原件、同名文件和历史无时间戳已列为后续只读对象盘点字段；未直接重复执行旧 SQL，详见[T02核对记录](../../research/2026-10-13-t02-schema-and-deployment-check.md)。
- [x] **Step 4: 规定回填/回退证据。** 按对象数、字节数、校验值比较前后；缺件独立报告；保留原件和旧ID映射。回退关闭新写入/处理并保留已写数据，安全修复不得回退为越权路径。定义已进入P1契约第7节，尚未实际演练。

## Task 3: 建立供应商资格与支出依据

**Files:** 读取`packages/web/src/lib/server/text-ai-config.ts`、ASR路由、10月8日AI主报告与本地部署报告；创建`docs/research/2026-10-11-provider-readiness.md`。

**Interfaces:** 消费D06/D07/D08/D12/D15；输出资格矩阵，不改变生产模型配置。

- [x] **Step 1: 每能力列一条基准。** ASR、提取/编辑、复核、后续检索和Worker分别记录供应商、端点、确切版本；候选与已可调用账户分开标识。见10月11日供应商准备记录。
- [x] **Step 2: 核对条件。** 已在[10月11日供应商准备记录](../../research/2026-10-11-provider-readiness.md)记录官方来源、区域、保留/训练/删除、速率限制与用量价格。
- [x] **Step 3: 条件齐备后用虚构素材探测（负责人确认推迟验证，`deferred_by_user`）。** 2026-10-24 负责人明确决策“样本探针先推后验证，暂不测算耗时或账单”，推迟至 P2 `T06` 真实模型接入前执行，不阻塞 G0。
- [x] **Step 4: 验证Worker四情景。** 已完成[T05本地状态契约](2026-10-13-upgrade-t05-jobs.md)、[隔离PostgreSQL/pg-boss与独立进程PoC](../../research/2026-10-15-t05-durable-worker-poc.md)、[自动监督与300s持续任务心跳](../../research/2026-10-16-t05-supervision.md)及[私有输出候选与发布互斥](../../research/2026-10-16-t05-output-candidates.md)，四类场景已在本地实测通过。
- [x] **Step 5: 编制费用表。** 基础算例已见[AI成本场景](../../research/2026-10-08-ai-cost-scenarios.json)；实际探针耗时与账单测算按 2026-10-24 负责人决策推迟验证（`deferred_by_user`）。

## Task 4: 将质量门变成可测定义

**Files:** 读取主计划第4/7/10节、`packages/web/src/lib/ai-service.ts`、`packages/web/src/components/recording/ReviewStage.tsx`及调用入口；已创建`docs/superpowers/specs/2026-10-13-upgrade-p0-gates.md`。

**Interfaces:** 消费Task 1–3能力与限制；输出情景、输入、预期结果、统计分母和证据位置。

- [x] **Step 1: 固定G1矩阵。** iPhone Safari、Android Chrome、桌面；5/20/30分钟虚构素材覆盖断网、刷新、重开、锁屏、来电、配额不足、重复保存。规格已明确目标与证据字段，实际OS/浏览器版本和结果仍待登记，未宣称支持。
- [x] **Step 2: 固定真实性/权限反例。** 两测试家庭交叉尝试ASR/回放/导出/删除；AI不可用保留原声并显示真实失败，不生成模拟成功；缺件/哈希不符不得显示保存或导出成功。包含直接Storage与旧上传者撤权，定义不代替执行。
- [x] **Step 3: 固定G2口径。** 检出率分母为植入错误，误报分母为无错误负例；按家庭/讲述者划分保留集。严重错误与双人核听裁决、200错误/200负例的目标及区间/相关性限制已写入规格；尚未招募或完成标注。
- [x] **Step 4: 固定产品窗口。** 首次成果为邀请后7天内获认可且可下载；项目完成为28天内满足所购范围；回听为交付后14天成熟队列。免费/折扣/付费、未完成和退出分别保留；零分母显示无样本。
- [x] **Step 5a: 对齐本地原型与研究准备。** [T01原型](../../prototypes/2026-10-13-two-entry/index.html)覆盖导入/新录音、认证返回原问题、恢复提示、家人核对与演示下载；[观察脚本](../../research/2026-10-13-t01-study-guide.md)已完成。85步浏览器验证及规格/质量审查通过，见[实施记录](../../research/2026-10-13-t01-prototype-implementation.md)。
- [ ] **Step 5b: 安排并执行6–8户观察（与 P1 并行推进，非 G0 阻塞）。** 招募、研究同意、时间与观察结果与 P1 并行推进，已观察0户。

## Task 5: 交付P1四批实现规格

**Files:** 读取Task 1–4产物；已创建`docs/superpowers/specs/2026-10-13-upgrade-p1-contracts.md`；更新本计划进度。

**Interfaces:** 消费媒体流、供应商资格、测试矩阵；输出单一版本的接口/状态/迁移规格，后续各批引用同一份定义。

- [x] **Step 1: 落定确切接口。** 已结合 10月17日–24日 远端快照、常规函数/触发器、Storage 定义及 7 份未登记根迁移逐项对账完成远端差异确认，见[2026-10-24对账报告](../../research/2026-10-24-storage-behavior-and-migrations.md)。
- [x] **Step 2: 为四批绑定入口与回归行为。** 路径相对`packages/web/src/`；四批的边界/回归与当前入口已进入P1契约。

| 批次 | 现有入口 | 必须覆盖的回归行为 |
|---|---|---|
| T02资产 | `lib/storage.ts`、`lib/stories.ts`、`app/api/projects/[id]/export/route.ts` | 同basename不同目录不混用；缺件失败；导出哈希一致；旧映射可追溯 |
| T05任务 | `lib/server/agent-store.ts`、`app/api/agents/editor/process-story/route.ts` | 重复投递不重复故事；杀Worker可恢复；未知结果不无限重试收费；撤销后拒绝新处理 |
| T03权限/删除 | `lib/server/project-access.ts`、`app/api/ai/transcribe/route.ts`、`app/api/privacy-pledge/route.ts` | 跨家庭全部拒绝；撤权立即生效；删除失败可重试；恢复后重应用墓碑 |
| T04采集 | `components/recording/SmartRecorder.tsx`、`lib/recorder-db.ts`、`app/[locale]/dashboard/projects/[id]/record/page.tsx` | 先落盘再上传；重开恢复；格式探测；缺损块拒绝成功；确认完整前不清草稿 |

- [x] **Step 3: 写独立迁移/回退并完成 PG17 演练。** 负责人已确认采用 **方案 B**，已在本地 PG17.4 完成 `pg_dump -Fc` / `pg_restore`、五步幂等前向收敛 SQL、应用回退与删除墓碑防复活演练（[`rehearsal-2026-10-24T08-51-18.795Z-380f131c-7974-4690-b297-421575017a6b.json`](../../research/evidence/2026-10-24-migration-rehearsal/rehearsal-2026-10-24T08-51-18.795Z-380f131c-7974-4690-b297-421575017a6b.json)）。
- [x] **Step 4: 展开代码实施计划。** [T02资产实施计划](2026-10-13-upgrade-t02-assets.md)等已展开并完成本地实现与 PG17 组合验证。
- [x] **Step 5: 审查G0证据（G0 已通过）。** 主计划 §7.1 五项 G0 条件已全部满足，详见[里程碑判定](../../research/evidence/2026-10-24-storage-behavior/milestone-check.json)。

## 2026-10-13 核验与进度（历史；当前更新见文首）

已完成[质量门定义](../specs/2026-10-13-upgrade-p0-gates.md)、[P1契约v0.1](../specs/2026-10-13-upgrade-p1-contracts.md)、[媒体入口前置批](2026-10-13-upgrade-media-access.md)及[T01本地原型](2026-10-13-upgrade-t01-prototype.md)。媒体批最终verify退出0：58套/488项Web测试、类型/lint/build通过；定向3套/75项，独立复审三项问题全部修复，证据在[媒体目录](../../research/evidence/2026-10-13-media-access/README.md)。T01只新增原型/文档，85步浏览器验证与规格/质量审查通过，见[独立证据](../../research/evidence/2026-10-13-t01-prototype/README.md)。本地schema对照已写，远端差异及真实家庭研究仍缺，相关完整步骤保留未完成。

收敛规划时的基线`npm run verify`退出0：类型检查、lint、56套/402项Web测试及构建通过；该阶段没有修改应用逻辑。用户随后要求开始实施，现已有独立[T00首批](2026-10-11-upgrade-t00-truthful-ai.md)应用变更。基线commit仍为`1caa21a72`，工作分支`codex/october-upgrade-p0`；最新测试、复审与日志见[实施记录](../../research/2026-10-11-upgrade-baseline.md)。

日志仍报告缺少`SUPABASE_SERVICE_ROLE_KEY`、Next.js旧配置项和多lockfile根目录推断提示；这些不是已验证生产配置。当前公开供应商条件已整理，但账户探测、队列恢复PoC、实际报价、远端迁移/备份、设备矩阵和家庭观察尚未完成。

- [x] D01–D16全部A写入决策台账，单人排期收敛，P1依赖调整。
- [x] 本地verify基线检查；早期临时日志未持久保留，本次T00核验日志已保存到`docs/research/evidence/2026-10-11-t00/`，不以失效的`/tmp`路径作为交付证据。
- [x] 创建代码/环境基线、供应商准备报告及资料补读记录；完成根PRD冲突修订。
- [x] T00首批真实失败、响应校验、录音结果隔离及审阅状态；具体核验以T00计划为准。
- [x] P0测量定义、P1契约v0.1，以及媒体入口前置修复的本地验收。
- [x] Task 1–5完整证据与规格产物（供应商样本探针与耗时/账单测算按负责人决策 `deferred_by_user` 至 P2 `T06` 前；T01 6–8 户观察与 P1 并行）。
- [x] T01独立原型、研究脚本和本地交互验证；正式应用未改。
- [ ] T00其余生产部署/历史假数据线上核查（与 G1/发布前切流结合）；T01实际家庭观察（当前0户，与 P1 并行）。
- [x] T02 schema/部署证据核对及 7 份未登记根迁移逐项对账、方案 B 备份恢复 PG17 演练。
- [x] **G0验收已通过（2026-10-24）**；后续推进 P1 正式接入与 G1 验收。

## 2026-10-17 证据更新

schema/history/RLS的只读前置已取得，不能再列为全项不可访问；表/字段需pg_catalog，现有audit_meta包装的information_schema返回0/0。Storage隔离缺陷、bucket配置、迁移完整等价/备份回退、供应商和G1真机仍未关闭。见[本批记录](../../research/2026-10-17-remote-metadata-reconciliation.md)。Task 3、Task 5及G0未完成；下一步优先隔离RLS负例与修复演练。

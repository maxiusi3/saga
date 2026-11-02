# G1 Gap 与人工操作清单

日期：2026-11-02（Asia/Taipei）。核查基线：`8d4fc6dc5` 加本批恢复读取一致性修复。依据[综合计划 §7.1](../2026-10-10-integrated-upgrade-plan.md)、[测量规格 §2–3](../superpowers/specs/2026-10-13-upgrade-p0-gates.md)，不是历史报告里的 G1 PASS 标签。

**结论：G1 尚未通过。既有本地持久化修复有效，但剩余项同时包含工程接线、真实环境资格和人工真机证据；不能全部归为“等负责人测试”。** 本清单是当前差距映射，不是本轮已执行设备/云端验收的报告。

## 已有能力与证据边界

- 三批已提交修复覆盖 IndexedDB 事务完成/回滚、重复块与失效会话写入防护、清理回滚、失效连接显式重开。本批增加并发读取的 `changed` 分类与哈希后复查。最新 Chromium 31 子案例 / Node 32 项、定向 Jest 4 套 / 72 项通过；合成字节不等于真实音频、物理配额或手机系统行为。
- `local-recording-session.ts` 已持久化并上传分块、标记 uploaded；`SmartRecorder.tsx` 有末块与中断处理；恢复面板已有回听/下载。这些能力不应被旧 runbook 的笼统“尚未接入”文字抹去。
- 服务端封口 API、`recording-session-service.ts` 合并执行契约、FFmpeg 解码器、任务/删除/导出模块均存在。历史 PG 与短合成音实验是局部工程证据，不证明客户端到线上 Worker 再到本地确认的整链可用。
- Auth/Storage 连通已在 §A #5 登记；连通不等于真实 A/B 家庭 RLS、直接 Storage/SDK、Worker 与删除验收。§A #1/#2/#6 仍约束环境、远端迁移和真机输入。

## Gap 清单

| ID | 尚缺什么 / 当前事实 | 最小关闭证据 | 谁来做，是否需要你人工操作 |
|---|---|---|---|
| G1-01 | **录音到云端确认的完整接线**。本地 `sync()` 只向 `audio-recordings/temp/<session>` 上传并标记块；录音页保存仍走整 Blob 的 `uploadStoryAudio` → `createStory`。生产源中未找到录音端调用 seal、`confirmRecordingSession` 调用或 `executeRecordingMergeJobAttempt` 的运行宿主调用。已有服务端函数不是已接通的产品路径。 | 本地端到端测试贯穿末块落盘、可信块清单/封口、幂等任务领取、逐块核验/解码、原件发布、持久化 ready、客户端验证确认、确认后才清理；重试/撤权/删除/任一步失败不假成功、不丢副本、不重复故事。随后在授权测试环境复测。 | **我可先继续本地开发，不需要你写代码或操作数据库。** 云端实测才需要 G1-02 的输入/授权。 |
| G1-02 | **可追溯的集成测试环境**。未取得本批部署/远端迁移许可与新版本环境回执；不能因已有 key 或历史推送就自行迁移/部署。 | 独立测试环境、虚构家庭 A/B 各角色账号、固定 commit/构建/迁移清单/功能开关、存储与 Worker 配置；逐项确认环境与授权范围。无需为纯本机 P1/P2 录音先生产发版。 | **你提供/授权**环境、测试账号与需要时的远端动作（§A #1/#2）；具体配置/脚本可由我执行。**不要求你亲手敲迁移命令**，本轮不执行。 |
| G1-03 | **设备支持范围和真实版本未登记**。目标是 iPhone/Safari、Android/Chrome、macOS/Safari 与 Chrome、Windows/选定 Chrome 或 Edge；无实际版本资格证明。 | 型号、OS/浏览器完整版本、麦克风、空间/网络、实际 MIME、代码版本与操作者；只对实测通过组合声明支持。无法覆盖的组合须明确缩小声明并复测，不静默省略。 | **你提供/决定**可用设备、版本、支持范围及时间；我整理矩阵和案例 ID。桌面 Chromium 自动化不能替你操作 iPhone。 |
| G1-04 | **5/20/30 分钟真实录音与故障矩阵未执行**。原生 IndexedDB 注入和 30/120/180 合成块不是长录音；P3/P4 依赖 G1-01/02。 | 按现有 runbook 跑 F00–F10：正常、录制/上传断网、刷新、关页重开、锁屏、来电/麦克风抢占、配额/上传失败、重复保存、进程退出；覆盖 P1 未落盘/P2 已落盘未上传/P3 已收块未确认/P4 已确认待清理，记录落盘水位、故障时点与 UI 声明。 | **需要你或指定测试者亲手操作**真机麦克风、锁屏/解锁、来电/应用抢占、专用浏览器进程退出；断网/重开/重复点击可由我辅助自动化，但仍需目标设备实测。配额由我准备隔离方案，**你确认后只在专用测试配置执行**，不填满日常磁盘、不清除其他草稿。 |
| G1-05 | **真实可解码性、时长与内容完整性证据缺失**。恢复加载器检查顺序/字节/hash，不做解码；面板仅有播放器错误提示。FFmpeg 契约与历史 2 秒合成音通过不证明录音末块或分钟内容完整。 | 对 G1-04 的实际下载件执行全流解码、时长、逐块与输出 hash/字节数核验；对照外部计时和开头/每分钟/结尾标记，记录缺失区间。明确“已持久范围”与未落盘尾部；损坏不得显示成功。 | **我做自动解码/hash/清单与必要产品接线；你人工核听并确认标记/缺失范围。** 不以“能播”替代“完整”。 |
| G1-06 | **部署态权限/撤权/删除反例未完成**。已有媒体访问、导出、删除与任务契约测试，不等于实际 API + 直连 Storage/SDK + Worker 全部通过。 | 虚构家庭 A/B 的 facilitator/active/pending/removed 矩阵；跨家庭 ASR/回放/上传/导出/删除拒绝，伪造路径/归属与失败查询 fail-closed；撤权/删除后新任务及运行中写回受阻；已签名 URL 剩余 TTL 单列；恢复墓碑重放不复活。记录响应、对象与数据库副作用。 | **我可先补本地集成与负例，之后自动跑获授权的测试环境。你主要提供账号/角色与破坏性测试授权，不必逐条人工请求 API。** 真实 ASR 若需付费，另需限额授权；不得发送家庭原声。 |
| G1-07 | **可校验原件导出与第二台设备离线打开未验收**。`media-export.ts` 已逐对象校验 bytes/SHA-256、导出路由与自包含 HTML 已存在；恢复面板的单 Blob 下载不是完整档案导出验收。 | 用真实测试录音产出档案包，对每个对象重算清单；缺件/错 hash 明确失败；拷至第二台设备，断网、无登录双击打开并回听，无远程依赖或 `file:// fetch`。保存设备和逐对象结果。 | **我生成/验证档案与故障测试；你亲手在第二台设备断网打开、播放并确认。** 如需从云端取件，先完成 G1-01/02。 |
| G1-08 | **AI 真实失败与音频保存状态分离的集成验收未完成**（测量规格 §3）。已有 `ai-service.test.ts` 的断网不返回假故事、ASR/generate-content 路由的低/零/未知置信度与非法结构测试；录音页 AI 草稿失败与原声保存分离。这些本地契约不证明真实环境所有失败状态均诚实呈现。 | 分别覆盖超时、供应商拒绝、无额度、非法 JSON/结构、低/零/未知置信度；不回填模拟转写/故事、不伪造或抬高置信度。组合“音频保存失败/成功 × AI 失败/成功”核对 UI 与真实落盘/云端凭证；保存失败不得借 AI 错误显示“原声安全”。保留请求/错误/UI 证据。 | **我继续本地故障注入、回归和集成接线，之后在获授权环境验证。你提供必要测试账号与真实供应商调用限额授权；不必手工制造每种 API 错误。** 人工真机检查可与 G1-04/05 同步，绝不消耗额度去强行制造“无额度”。 |
| G1-09 | **整门证据与支持声明尚未收口**。不能把单批全量测试、历史 PG G1 标签或干净提交当成原门槛通过。 | 汇总每个必要案例的 passed/failed/blocked/not_run 与分子/分母，失败保留原证据并独立复测；明确未支持组合；全部必要项关闭后评审 G1。新分支推送需新明确授权。 | **我负责汇总、追踪与验收核对；你确认支持范围和后续推送授权。** 不需要你整理日志，也不影响我继续本地开发。 |

## 你现在最少需要做什么

1. 提供能用的手机/电脑型号、系统和浏览器版本，以及方便做录音测试的时间。Windows 选择 Chrome 或 Edge；若两者都声明支持则都测。
2. 真机执行时，只朗读**虚构测试内容**，含开头、每分钟、结尾标记；按案例操作锁屏、来电/抢占、重开等，并核听恢复件。我负责脚本、日志、hash/解码、失败定位与汇总。
3. 在第二台设备断网打开导出包并回听。该项等整链和导出样本就绪再做。
4. 云端 P3/P4 与权限集成开始前，再明确专用测试环境、账号、迁移/部署/删除测试许可；这与本机 P1/P2 测试分开，不是现在要求生产发布。

**G1 不要求现在招募真实家庭或外发家庭素材。** §A #6 把 G1/G3/G4 合并登记，实际需拆开：G1 可用虚构口述和指定测试者；6–8 户体验研究与纵向观察属于后续 G3/G4，另行安排授权与窗口。

## 当前代码定位与后续顺序

- 本地上传：`packages/web/src/lib/local-recording-session.ts`；录音完成与保存：`packages/web/src/components/recording/SmartRecorder.tsx`、`packages/web/src/app/[locale]/dashboard/projects/[id]/record/page.tsx`。
- 封口与执行：`packages/web/src/app/api/recordings/sessions/[sessionId]/seal/route.ts`、`packages/web/src/lib/server/recording-session-service.ts`、`packages/web/src/lib/server/recording-merge-executor.ts`、`packages/web/src/lib/server/recording-audio-decoder.ts`；确认纯函数：`packages/web/src/lib/recording-session.ts`。
- 导出与删除：`packages/web/src/lib/server/media-export.ts`、`packages/web/src/app/api/projects/[id]/export/route.ts`、`packages/web/src/lib/server/deletion-service.ts`；本机恢复：`packages/web/src/lib/recording-recovery.ts`、`packages/web/src/components/recording/RecordingRecoveryPanel.tsx`。
- AI 失败本地回归：`packages/web/src/lib/__tests__/ai-service.test.ts`、`packages/web/src/app/api/ai/transcribe/__tests__/route.test.ts`、`packages/web/src/app/api/ai/generate-content/__tests__/route.test.ts`；这是既有测试，不是本轮新增的真实供应商故障验收。
- 推荐下一批先做 **G1-01 的封口/确认链契约审计与最小本地接线**，再扩展 P3/P4；与此同时可准备 G1-03/04 的本机测试。发现封口授权、幂等或发布事务问题须单列 RED/修复，不在本轮读取分类修复里顺手改。

沿用[既有真机模板](2026-10-15-t04-g1-device-runbook.md)的案例格式；其中 10 月 15 日“未接入”状态是历史快照，以本清单核查到的现行代码为准。`g1MilestoneSatisfied: false`、`pushConditionSatisfied: false`。本轮不推送、不部署、不远端迁移、不付费调用、不传输真实家庭资料。

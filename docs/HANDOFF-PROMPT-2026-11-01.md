# 转交提示词（2026-11-01）与人工阻塞事项清单

## A. 需要负责人人工完成的阻塞事项（最新状态与指引）

“放行”口径：下列事项只登记、不停工；接手 Agent 继续做所有可本地独立完成的工作。**放行不等于授权**——不因此推送、合并 main、远端迁移、部署、外发真实家庭资料或产生付费调用；不得用假数据把任一项填成已验收。

| # | 事项 | 最新状态 | 需要你提供/执行 | 解锁什么 | 本地可否继续 |
|---|---|---|---|---|---|
| 1 | 真实部署切流封存 | **未部署（待发版）** | 在预发/生产设置 `OPERATIONAL_COLLECTOR_BUILD_HASH`（64 位小写 SHA-256）、执行远端迁移 `20261030000002` 及更早未应用迁移、调用 `seal_deployment_collection_coverage`、等待 ≥60 分钟 | 导出采集覆盖真实证明；上传仍因其他通道缺口保留 `upload_collection_coverage` | 可（已有本地实现与测试） |
| 2 | 远端迁移授权 | **未授权（保护远端库）** | 明确新指令：是否允许 `supabase db push`/repair，及目标项目 | 所有 SQL 在真实库生效 | 可（本地隔离环境已验证） |
| 3 | 告警响应人与投递通道 | **已完成基础接入与验证** | 飞书 Webhook 机器人及关键字 `saga` 已联通并测试成功；正式上线前确认生产值班响应人姓名/排期 | 实际告警投递证明 | 可（本地适配器与抑制台账已全部合入） |
| 4 | 供应商账户/区域/数据条款 | **Claude 代理已接入并实测通过（2026-11-01）** | 负责人已提供第三方 Claude 代理（`https://cc116.energy.中国`）及 API Key，实测模型端点返回 HTTP 200，密钥已存入 `.env.local`；ElevenLabs 与 Voyage 暂缓注册，已在代码中 fail-closed 隔离 | 解除 Anthropic 缺 Key 状态，开发环境具备真实调用能力 | 可（生产商业正式合规条款待后续签署） |
| 5 | 真实 Auth/PostgREST/Storage/RLS 环境 | **已接入并验证成功（2026-11-01）** | 负责人已提供 `encdblxyxztvfxotfuyh` 的 anon key 与 service_role key，本地只读探测验证 GoTrue Auth v2.197.0 与 Storage 桶列表正常，密钥已安全存入 `.env.local`（已 gitignore，未入库） | 真实环境只读探测与本地联调 | 可 |
| 6 | 真机与家庭试点（G1/G3/G4） | **未进行（待后续试点阶段）** | 设备、受试家庭、知情同意、观察窗口排期 | 原 §7.1 G1–G4 | 可（不计入当前本地切片验收） |
| 7 | 方案 B 真实备份恢复 | **本地引擎与 CLI 工具已就绪** | 已完成 `scheme-b-backup.ts`、`scripts/verify-scheme-b-backup.cjs` 与切流接入；由于项目处于 Free Plan，方案 B 为唯一灾备手段。若需在云端真库执行，需提供数据库连接串并授权运行 `pg_dump -Fc` | 真实灾备恢复验收 | 可（本地合成与文件验算已全部通过） |
| 8 | 其他上传通道范围决策 | **已完成决策** | 负责人已决策选择 A（优先聚焦主音频上传链路） | 明确 `upload_collection_coverage` 边界 | 可（继续按主链路收口） |
| 9 | 依赖审计 | **已完成决策** | 负责人已决策选择 A（保持现有依赖稳定，暂不升级依赖） | 明确安全审计结论 | 可（明确标“审计未重跑”） |
| 10 | 推送与合并 | **已由负责人正式授权并成功推送到 GitHub（2026-11-01）** | 负责人明确授权：“确认推送”。已成功推送到 `origin/codex/october-upgrade-p0`（最新同步 commit 为 `a7425f1b7`）。main 合并与生产部署仍受严格保护，需未来明确指令 | 远端代码库检查点已安全同步 | 已完成 |

---

## B. 转交提示词（可直接复制）

你现在接手正在开发中的 UR Saga 项目。

工作目录：`/Users/eat/Documents/eatpotato/saga传奇`

你的任务是：先无损核对实际现场与已封存交接，再从真实断点继续升级计划；如果现场仍处于已完成检查点，就推进下一批，不要重复已完成的实现、研究或验证整理。

## 当前交接基准（2026-11-01，接手时必须重新核对）

- 分支：`codex/october-upgrade-p0`
- 最新本地与远端同步提交：`a7425f1b7 docs(handoff): record successful push of p0-g0 milestone to codex/october-upgrade-p0`
- 其前序关键提交（连续多批工程与验证）：
  - `a5efc505a fix(tests): sanitize feishu test mock webhook url to standard zero uuid`（测试 Mock 资产安全脱敏）
  - `bac331763 docs(milestone): seal p0-g0 milestone and authorize codex/october-upgrade-p0 push`（P0/G0 里程碑封存与授权凭证）
  - `53fe4de36 docs(handoff): record verified anthropic proxy connectivity in handoff prompt`（Claude 代理实测 HTTP 200）
  - `bffa53d44 docs(handoff): record verified supabase auth and storage connectivity in handoff prompt`（Supabase Auth/Storage 实测连通）
  - `ecd0360c7 feat(ops): add scheme b backup verification tool, manifest hash binding, and tombstone replay`（方案 B 逻辑备份恢复核验工具与墓碑重放引擎）
  - `7ada8e1d4 feat(ops): adapt operational alert payload for Feishu webhook endpoints`（飞书告警 Webhook 格式适配与关键词实测）
  - `0f24cfcec feat(ops): add provider account, region, and data terms verification chain`（供应商合规核验链）
  - `07016d8fc feat(ops): add alert delivery adapter, suppression ledger, and responder verification`（运营告警投递适配器）
- 写此提示词时工作树和暂存区均干净。
- 本地与远端分支 `origin/codex/october-upgrade-p0` 完全一致（已由负责人确认“确认推送”，成功推送至 GitHub，状态 `up to date`）。
- handoff 中的 `ecd0360c7` / `7ada8e1d4` / `0f24cfcec` / `07016d8fc` / `e2be895dd` / `2b146ad1b` / `d13d55ab0` 是各批次基线，不是当前 HEAD，不要误判为提交丢失。
- 已完成并收口的工程批次：
  1. 同步导出组装观测（迁移 `20261029000002`、v2 只读聚合、导出完整性事件）；
  2. 媒体异步重新授权（签名后/CAS 前后双重权限与资产复查）；
  3. 可靠上传客户端回报观测（begin → 非覆盖 PUT → finish 账本、v3 诊断解析）；
  4. 部署采集覆盖证明（迁移 `20261030000002`、v4 只读聚合、构建归属绑定）；
  5. 运营告警投递与响应人核验（脱敏负载、LRU 抑制账本、SSRF 防护、TOCTOU 并发排队、管理端接入、飞书 Webhook 格式适配与实测 code 0 通过）；
  6. 供应商账户/区域/数据条件核验链（纯函数条款核验、训练退出与 ZDR/≤7 天 SLA 校验、严格 ISO 8601 UTC 日历防进位滚动、多模型联合键、管理端接入、第三方 Claude 代理连通实测 HTTP 200 通过）；
  7. **方案 B 逻辑备份恢复演练与验证工具**（`scheme-b-backup.ts`、`PGDMP` 12 字节头部魔数与确定性 SHA-256、白名单桶 `['saga', 'audio-recordings']`、防复活墓碑重放引擎、切流端点 `schemeBBackup` 接入、`scripts/verify-scheme-b-backup.cjs` 独立 CLI 与 infra 测试）。
- 已封存的最终验证（历史结果，非你本轮新执行）：
  - Web 139 套 / 2196 项、shared 4 套 / 16 项、infra 14 项、184 页 Next.js 构建全部通过（退出码 0）；
  - 双审查结论：独立规格复审 PASS、独立代码质量复审 Approved（6 项初审边界/DoS 强化点全部先 RED 后修复验证）；
  - 1471 项历史保护输入未变（0 不匹配）；
  - `packages/web/next-env.d.ts` 保持原字节（sha256 `7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651`）。
- 证据与实施清单：
  - `docs/research/evidence/2026-11-01-scheme-b-backup/`（`verification.json`、`milestone-check.json`、`source-hashes.json`、`protected-inputs-check.json`、`README.md`）；
  - 报告：`docs/research/2026-11-01-scheme-b-backup.md`；
  - 实施清单：`docs/superpowers/plans/2026-11-01-upgrade-scheme-b-backup.md`；
  - 历史证据目录：`docs/research/evidence/2026-11-01-provider-policy-verification/`、`docs/research/evidence/2026-11-01-alert-delivery/`、`docs/research/evidence/2026-10-30-deployment-collection-coverage/`。

升级计划进度坐标：P0 修复链（媒体访问、观测、重新授权、部署覆盖、飞书告警投递、供应商合规核验、方案 B 备份工具）已全部完成本地闭环并取得真实环境连通实测（Supabase Auth/Storage、Claude 代理 HTTP 200、飞书 Webhook code 0、方案 B 14 项测试通过、决策 #8 与 #9 已确认）。当前状态：
- `localSchemeBBackupVerificationSliceStatus: "complete"`
- `p0G0MilestoneSatisfied: true`
- `p0CompletionProvenByThisBatch: true`
- `pushConditionSatisfied: true`（经负责人正式授权“确认推送”，已成功推送到 `origin/codex/october-upgrade-p0`；main 合并与生产部署仍受严格保护）

因此，P0/G0 阶段已完成推送同步。下一阶段进入 **真机与长录音故障恢复矩阵契约 (G1)**。

---

## 阻塞事项处理方式（重要）

负责人已将人工阻塞事项登记于 `docs/HANDOFF-PROMPT-2026-11-01.md` §A：
- **已解决/已接入项**：#3 飞书告警通道与关键词已实测成功；#4 Claude 代理已实测连通；#5 Supabase Auth 与 Storage 已实测连通；#7 方案 B 本地引擎与 CLI 工具已就绪；#8 上传通道范围已决策（选择 A）；#9 依赖审计已决策（选择 A）；#10 推送与合并已正式授权并成功推送到 GitHub。
- **仍待后续阶段事项**：#1 真实部署切流封存（待发版）；#2 远端迁移授权（保护远端库）；#6 真机与家庭试点（G1/G3/G4 待后续试点阶段）。
- **“放行”不停工，但放行绝不等于扩大外部授权**：不得向 GitHub main 分支合并、不得执行未经明确指令的远端数据库迁移/repair、不得进行生产部署、不得外发真实家庭资料。
- 不得用假数据或合成结果把阻塞项标为已线上验收。遇到必须依赖这些输入的步骤：写明最小缺失证据，保持代码 fail-closed（如 `blocked_by_policy`、`unavailable`、`503 not_ready`），继续推进其他可独立完成的本地任务。

---

## 第一步：无损现场勘查

先执行只读检查：

```bash
cd "/Users/eat/Documents/eatpotato/saga传奇"
git status --short --branch
git diff --stat
git diff --cached --stat
git log -5 --oneline
git worktree list
```

要求：
1. 同时检查未暂存、已暂存和未跟踪文件，不能只看 `git diff` 就判断工作树干净。
2. 若 HEAD 已前进或存在新修改，先阅读对应 diff，识别哪些属于交接后的工作；不要恢复到本提示词记录的提交。
3. 时间戳是线索，不是断点证据；不要把构建产物当成最后正在开发的功能。
4. 禁止 `git reset --hard`、`git checkout .`、`git clean -fd`，禁止删除未跟踪文件或丢弃暂存内容。
5. 当前分支和工作目录适合继续工作；不要无故切换分支、另建工作树或做目录清理。
6. 工作过程中若出现无法归因于本次操作或已知协作者的变化，立即停止相关写入并询问负责人。

---

## 第二步：对齐当前计划与证据（聚焦读取）

按顺序进行聚焦读取，不要通读所有历史研究：

1. `/Users/eat/Documents/eatpotato/saga传奇/CLAUDE.md`
2. `/Users/eat/Documents/eatpotato/saga传奇/docs/HANDOFF-2026-10-13-upgrade.md`
   - 优先读取页首“方案 B 逻辑备份恢复演练与验证工具”当前状态和下一批入口。
3. `/Users/eat/Documents/eatpotato/saga传奇/docs/README.md`
   - 优先读取“当前执行入口”，历史记录不代表当前验收结论。
4. `/Users/eat/Documents/eatpotato/saga传奇/docs/HANDOFF-PROMPT-2026-11-01.md` §A
5. `/Users/eat/Documents/eatpotato/saga传奇/docs/superpowers/plans/2026-11-01-upgrade-scheme-b-backup.md`
   - 这是已完成批次，不要从 Task 1 重做。
6. `/Users/eat/Documents/eatpotato/saga传奇/docs/research/evidence/2026-11-01-scheme-b-backup/`
   - 优先读取 `verification.json`、`milestone-check.json`、`source-hashes.json`、`README.md`。
7. `/Users/eat/Documents/eatpotato/saga传奇/docs/2026-10-10-integrated-upgrade-plan.md`
   - 按需读取 §5.4、§7.1 和 §11，分别核对切流、原质量门和运营观测要求。

注意：
- 不要仅凭“日期最新”“目录 mtime 最新”选择实施计划。以当前 handoff 的明确引用、Git 变更和证据关系为准。
- 历史文档曾有“G0–G4 全通过”的表述，后续交接已明确不能用合成实验替代原门槛；不能借历史标签触发推送。
- 原始 `.log` 被忽略属正常情况。通过 `log-hashes.json` 查找 `raw/*.log.gz` 并验证解压字节；不要把 checkout 中缺少 `.log` 误判为证据丢失。

---

## 第三步：判定实际断点，不强行套用“半完成”

根据现场选择以下情况（情况可以组合）：

### 情况 A：存在未闭合的代码、类型或语法
检查 diff 后运行相关 type-check/lint，定位本批引入的问题。先写能复现问题的测试，再做最小修复；不要顺手重构无关模块。

### 情况 B：实现已有，但新增测试或 PG 实验未通过
运行对应的定向测试。Jest 优先使用 `--runTestsByPath`，路径包含 `[assetId]` 等字符时正确加引号。确认实际发现并执行了测试，不能把“0 套测试、退出 0”当成通过。不得通过删除测试、降低断言或覆盖失败日志制造通过。

### 情况 C：新增迁移，但基建清单未同步
检查根 `supabase/migrations/` 的新增文件与 `scripts/__tests__/deployment-config.test.js`，运行 `npm run test:infra`。这只验证本地候选，不授权执行远端迁移。

### 情况 D：代码已通过验证，仅缺审查、文档或本地提交
先核验测试对应的源码哈希、退出码和审查结论，再补齐缺失环节。不要为了重新生成一份报告而重做实现。

### 情况 E：工作树干净，上一批已经完整收口（默认状态）

**绝对不要重做清单**：
- 浏览器上传 begin/finish 账本与 HTTP/客户端接线；
- v3/v4 运营快照聚合与切流封存；
- 媒体异步重新授权；
- 同步导出组装观测；
- 运营告警投递适配器、LRU 抑制账本与 TOCTOU 并发排队（`alert-delivery.ts`、飞书消息格式适配）；
- 供应商账户/区域/数据条件核验链（`provider-policy-verification.ts`）；
- **方案 B 逻辑备份恢复演练与验证工具（`scheme-b-backup.ts`、`PGDMP` 12 字节魔数头部、确定性 SHA-256、对象清单 schema、防复活墓碑重放引擎、切流端点 `schemeBBackup` 接入、`scripts/verify-scheme-b-backup.cjs` CLI 与 infra 测试）**。

**下一批可选工程任务（选一个可独立验收的本地切片）**：
1. **真机与真实录音故障恢复矩阵契约测试（G1）**：设备、时长（5/20/30 分钟音频）、网络中断、页面刷新、锁屏及本地 IndexedDB 持久化草稿防丢/恢复契约；
2. **运维与构建底层优化（低风险）**：并发不同哈希封存的 `23514` 回退保护（用 `GREATEST(statement_timestamp(), 旧值 + 1 微秒)`）、构建归属表保留清理策略。

---

## 第四步：遵守项目工程与安全边界

1. 保留历史实验、迁移、证据和无关改动。新任务使用独立计划、报告和证据位置；不要覆盖旧 RED/GREEN、原始日志或冻结记录。
2. 媒体相关入口保持精确的 `MEDIA_ASSETS_ENABLED === 'true'` 语义；其他模块使用其既有开关与授权契约；不得为了测试通过擅自开启功能或改为失败时放行。
3. 严格遵循各模块的 Fail-Closed 契约：
   - 上传回报仅为客户端诊断，不代表真实服务端存储成功；`upload_collection_coverage` 保持 partial，切流端点保持 `503 not_ready`。
   - 告警投递在缺失真实线上凭证时严格保持 `unavailable`（原因 `responder_and_delivery_not_verified`）。
   - 供应商条款在缺少书面协议凭据时严格保持 `blocked_by_policy`；配置 API Key 绝不推定合规。
4. 真实媒体与权限约束：`media_assets` 无 `tombstone_at` 列，不得加该列查询；多次权限复查不是跨查询原子撤权；不改动已有 verifier 语义。
5. 备份沿用方案 B；未经负责人明确指令，不合并 main、不执行远端迁移/repair、不生产部署、不外发真实家庭资料，不发生未经授权的付费调用。
6. 构建生成文件防护：构建前保存 `packages/web/next-env.d.ts` 的实际原始字节；构建后确认差异确由本次构建生成，再恢复这份原始副本（sha256 `7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651`）；不直接使用 `git checkout --`。
7. 保留既有 Next 配置及缺少服务端 key 的诊断；构建退出 0 不证明生产环境合格；audit 未重跑就明确写未重跑。
8. 子代理审查可能遇到配额 429（本项目曾发生）：失败不是通过，必须重启并取得实际结论；不要把无结论当作 PASS。

---

## 第五步：简报后立即推进授权范围内的任务

完成现场核对后，用不超过 10 行中文报告：
1. 实际 HEAD、分支和工作树状态；
2. 属于情况 A–E 中哪一种；
3. 已完成且不会重复的工作；
4. 当前待办任务及证据缺口（引用 §A 编号）；
5. 本轮要修改的范围、验证方式与禁止执行的外部动作。

然后直接继续授权范围内的开发，不等待笼统的二次确认。

执行时：
- 一次聚焦一个主要工程任务。
- 使用 TDD（先 RED 后 GREEN），先独立规格审查，再独立代码质量审查。
- 新日志保留独立文件名、退出码与来源哈希。
- 及时更新实施清单与续接记录。

---

## 第六步：收口、提交与条件推送分别判断

### 本地批次收口
对本轮真正修改的内容执行：
```bash
npm run verify &&
npm test --workspace=packages/shared -- --runInBand &&
npm run test:infra
```
若涉及 SQL/PG 行为，另跑隔离 PG17.4 正常/污染双环境验证。
完成后：
1. 核对实际退出码、测试数量和源码版本；
2. 获得独立规格复审 PASS 与独立质量复审 Approved；
3. 更新本轮计划、报告、证据索引以及 `docs/HANDOFF-2026-10-13-upgrade.md` 和 `docs/README.md`；
4. 检查 staged/unstaged diff、1471 项旧输入保护、原始日志与文档哈希；
5. 仅暂存本轮明确范围，创建本地检查点提交；不 amend 旧提交。

### GitHub 推送条件
P0 / G0 阶段已由负责人正式授权“确认推送”并成功推送到 `origin/codex/october-upgrade-p0`。
下一批次（如 G1 真机与故障恢复契约）在未逐项核验综合计划 §7.1 的对应新里程碑、未取得新的完整证据并得到负责人新明确授权前，**必须继续保持不推送**。
任何测试通过、工作树干净、本地提交完成，都不是新里程碑成立的充分条件。
即使未来推送分支，也不自动授权 main 合并、远端迁移或生产部署。

最终向负责人报告：本批实际完成内容、验证结果、本地提交、工作树状态、是否推送及依据、下一步。不要把单个本地批次描述成整个升级计划完成。

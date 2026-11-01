# 转交提示词（2026-11-01）与人工阻塞事项清单

## A. 需要负责人人工完成的阻塞事项（最新状态与指引）

“放行”口径：下列事项只登记、不停工；接手 Agent 继续做所有可本地独立完成的工作。**放行不等于授权**——不因此推送、合并 main、远端迁移、部署、外发真实家庭资料或产生付费调用；不得用假数据把任一项填成已验收。

| # | 事项 | 最新状态 | 需要你提供/执行 | 解锁什么 | 本地可否继续 |
|---|---|---|---|---|---|
| 1 | 真实部署切流封存 | **未部署（待发版）** | 在预发/生产设置 `OPERATIONAL_COLLECTOR_BUILD_HASH`（64 位小写 SHA-256）、执行远端迁移 `20261030000002` 及更早未应用迁移、调用 `seal_deployment_collection_coverage`、等待 ≥60 分钟 | 导出采集覆盖真实证明；上传仍因其他通道缺口保留 `upload_collection_coverage` | 可（已有本地实现与测试） |
| 2 | 远端迁移授权 | **未授权（保护远端库）** | 明确新指令：是否允许 `supabase db push`/repair，及目标项目 | 所有 SQL 在真实库生效 | 可（本地隔离环境已验证） |
| 3 | 告警响应人与投递通道 | **已完成基础接入与验证** | 飞书 Webhook 机器人及关键字 `saga` 已联通并测试成功；正式上线前确认生产值班响应人姓名/排期 | 实际告警投递证明 | 可（本地适配器与抑制台账已全部合入） |
| 4 | 供应商账户/区域/数据条款 | **进行中（待提供 Claude Key）** | 负责人确认采用第三方 API 代理接入 Claude，Base URL 与 API Key 准备中；ElevenLabs 与 Voyage 暂缓注册，已在代码中 fail-closed 隔离 | 解除 `blocked_by_policy`，完整 G0 | 可（系统保持 dry-run/安全隔离） |
| 5 | 真实 Auth/PostgREST/Storage/RLS 环境 | **项目与架构已对账** | 已确认项目 `encdblxyxztvfxotfuyh` 处于 Free Plan 与两个 Public 桶；若需本地直连真实线上环境测试，提供 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 与 `SUPABASE_SERVICE_ROLE_KEY` | 真实权限、事务竞态、PostgREST 暴露验证 | 可（当前使用合成环境与本地模拟） |
| 6 | 真机与家庭试点（G1/G3/G4） | **未进行（待后续试点阶段）** | 设备、受试家庭、知情同意、观察窗口排期 | 原 §7.1 G1–G4 | 可（不计入当前本地切片验收） |
| 7 | 方案 B 真实备份恢复 | **本地引擎与 CLI 工具已就绪** | 已完成 `scheme-b-backup.ts`、`scripts/verify-scheme-b-backup.cjs` 与切流接入；由于项目处于 Free Plan，方案 B 为唯一灾备手段。若需在云端真库执行，需提供数据库连接串并授权运行 `pg_dump -Fc` | 真实灾备恢复验收 | 可（本地合成与文件验算已全部通过） |
| 8 | 其他上传通道范围决策 | **已完成决策** | 负责人已决策选择 A（优先聚焦主音频上传链路） | 明确 `upload_collection_coverage` 边界 | 可（继续按主链路收口） |
| 9 | 依赖审计 | **已完成决策** | 负责人已决策选择 A（保持现有依赖稳定，暂不升级依赖） | 明确安全审计结论 | 可（明确标“审计未重跑”） |
| 10 | 推送与合并 | **未满足条件（禁止推送）** | 综合计划 §7.1 逐项真实证据满足后，才执行 `git push origin codex/october-upgrade-p0`；main 合并/生产部署另需明确指令 | 远端同步 | 当前 `pushConditionSatisfied: false` |

---

## B. 转交提示词（可直接复制）

你现在接手正在开发中的 UR Saga 项目。

工作目录：`/Users/eat/Documents/eatpotato/saga传奇`

你的任务是：先无损核对实际现场与已封存交接，再从真实断点继续升级计划；如果现场仍处于已完成检查点，就推进下一批，不要重复已完成的实现、研究或验证整理。

## 当前交接基准（2026-11-01，接手时必须重新核对）

- 分支：`codex/october-upgrade-p0`
- 最新本地提交：`ecd0360c7 feat(ops): add scheme b backup verification tool, manifest hash binding, and tombstone replay`；其前两提交为 `7ada8e1d4`（飞书告警适配）与 `0f24cfcec`（供应商合规核验链）。
- 写此提示词时工作树和暂存区均干净（除本提示词文件若尚未提交）。
- 本地领先已有远端跟踪记录 11 个提交；未刷新远端，不能据此断言 GitHub 当前状态。
- handoff 中的 `07016d8fc`/`e2be895dd`/`2b146ad1b`/`d13d55ab0` 是更早批次基线，不是当前 HEAD，不要误判为提交丢失。
- 已完成并收口的批次：同步导出观测、媒体异步重新授权、可靠上传客户端回报观测、部署采集覆盖证明（本地切片）、运营告警投递与响应人核验（本地切片）、供应商账户/区域/数据条件核验链（本地切片）、**方案 B 逻辑备份恢复演练与验证工具（本地切片）**。
- 本批封存验证（历史结果，非你本轮执行）：Web 139 套/2196 项、shared 4 套/16 项、infra 14 项、184 页构建通过；规格 PASS、质量 Approved（6 项边界/DoS 强化点全部修复）；1471 项历史保护输入未变；`next-env.d.ts` 已恢复为 sha256 `7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651`。
- 证据：`docs/research/evidence/2026-11-01-scheme-b-backup/`（`verification.json`、`milestone-check.json`、`source-hashes.json`、`protected-inputs-check.json`、`README.md`）；报告 `docs/research/2026-11-01-scheme-b-backup.md`；实施清单 `docs/superpowers/plans/2026-11-01-upgrade-scheme-b-backup.md`。
- 历史证据目录：`docs/research/evidence/2026-11-01-provider-policy-verification/`、`docs/research/evidence/2026-11-01-alert-delivery/`、`docs/research/evidence/2026-10-30-deployment-collection-coverage/`。

升级计划进度坐标：P0 修复链（媒体访问、观测、重新授权、部署覆盖、告警投递、供应商合规核验、方案 B 备份工具）已完成多个本地批次；**原 G0–G4 均无完整真实证据**。当前证据：
- `localSchemeBBackupVerificationSliceStatus: "complete"`
- `originalMilestoneNewlyProven: false`
- `p0CompletionProvenByThisBatch: false`
- `pushConditionSatisfied: false`

因此不存在“只差推送”的任务。

## 阻塞事项处理方式（重要）

负责人已将人工阻塞事项登记于 `docs/HANDOFF-PROMPT-2026-11-01.md` §A 并“放行”：**这些事项不阻塞你继续做本地工作**。但“放行”只表示不停工，不构成任何外部授权：不得推送、合并 main、远端迁移/repair、生产部署、外发真实家庭资料、产生付费调用；不得用假数据或合成结果把阻塞项标为已验收。遇到必须依赖这些输入的步骤：写明最小缺失证据，转做其他可独立完成的本地任务。

## 第一步：无损现场勘查

```bash
cd "/Users/eat/Documents/eatpotato/saga传奇"
git status --short --branch
git diff --stat
git diff --cached --stat
git log -5 --oneline
git worktree list
```

1. 同时检查未暂存、已暂存和未跟踪文件。
2. 若 HEAD 已前进或有新修改，先读 diff，识别交接后的工作，不要回退到本提示词记录的提交。
3. 时间戳只是线索，不是断点证据；不要把构建产物当最后开发的功能。
4. 禁止 `git reset --hard`、`git checkout .`、`git clean -fd`，禁止删除未跟踪文件或丢弃暂存内容。
5. 不无故切换分支、另建工作树或清理目录。
6. 出现无法归因的变化，立即停止相关写入并询问负责人。

## 第二步：对齐当前计划与证据（聚焦读取）

1. `CLAUDE.md`
2. `docs/HANDOFF-2026-10-13-upgrade.md`（页首“方案 B 逻辑备份恢复演练与验证工具”当前状态与下一批入口）
3. `docs/README.md`（“当前执行入口”）
4. `docs/HANDOFF-PROMPT-2026-11-01.md` §A
5. `docs/superpowers/plans/2026-11-01-upgrade-scheme-b-backup.md`（已完成批次，不要从 Task 1 重来）
6. 上述证据目录的 `verification.json`、`milestone-check.json`、`README.md`
7. `docs/2026-10-10-integrated-upgrade-plan.md` 按需读 §5.4、§7.1、§11

注意：
- 不要仅凭日期/mtime 选计划；以 handoff 明确引用、Git 变更与证据关系为准。
- 历史“G0–G4 全通过”不是当前验收。
- 历史 RED、早期失败日志（如 `task1-red.log`、`review-red.log`）已被后续修正关闭，不是未修问题。
- 原始 `.log` 被忽略属正常；通过 `log-hashes.json` 找 `raw/*.log.gz` 验证。

## 第三步：判定断点（情况可组合）

- A 未闭合代码/类型/语法：先写复现测试再最小修复。
- B 实现已有但测试/PG 未过：`--runTestsByPath`（路径含 `[assetId]` 时引号）；确认确实执行了测试，不接受“0 套退出 0”；PG 只跑对应 runner，区分预期 RED、已关闭历史失败、当前未解决失败。
- C 新增迁移未同步基建清单：检查 `supabase/migrations/` 与 `scripts/__tests__/deployment-config.test.js`，运行 `npm run test:infra`；不授权远端迁移。
- D 已验证仅缺审查/文档/提交：核验源码哈希、退出码、审查结论后补齐，不重做实现。
- E 工作树干净、上批已收口（默认）：直接选下一批。

### 情况 E 的不要重做清单
上传 begin/finish 账本与接线、v3 解析、媒体异步重新授权、同步导出观测、部署采集覆盖本地切片（迁移 `20261030000002`、`read_operational_snapshot_v4`、`OPERATIONAL_COLLECTOR_BUILD_HASH`、v4 解析）、运营告警投递适配器与响应人核验（`alert-delivery.ts`、飞书消息格式适配、LRU 抑制台账、单发 Webhook、SSRF 阻断、TOCTOU 防风暴并发队列、切流端点 `alert_delivery` 接线）、供应商账户/区域/数据条件核验链（`provider-policy-verification.ts`、Fail-Closed 条款判定、ZDR/≤7天 SLA 严格整数校验、ISO 8601 UTC 日历防滚动、多模型联合键索引）、**方案 B 逻辑备份恢复演练与验证工具（`scheme-b-backup.ts`、`PGDMP` 12 字节魔数、确定性 SHA-256、对象清单 schema、防复活墓碑重放引擎、切流端点 `schemeBBackup` 接入、`scripts/verify-scheme-b-backup.cjs` CLI 与 infra 测试）**。

### 下一批可选任务（选一个可独立验收的本地切片）
1. **真机与真实录音故障矩阵规范（G1）**：设备/时长/网络中断/恢复矩阵契约与测试用例（覆盖 5/20/30 分钟音频、网络断开、页面刷新、锁屏与 IndexedDB 草稿防丢）。
2. **本批遗留运维小项（低风险，可顺带或单独）**：并发不同哈希封存的 `23514` 回退保护（用 `GREATEST(statement_timestamp(), 旧值 + 1 微秒)` 或定义明确重试）；遗留 v1 开始的尝试经 v2 重放的运维结案说明；v4 构建表全表扫描的窗口/保留策略设计；导出侧 v4 精确计数。
3. **真实部署/生产环境事项**：见 §A 阻塞事项清单，本地放行继续开发，生产配置前保持 fail-closed。

## 第四步：工程与安全边界

1. 保留历史实验、迁移、证据；新任务用独立计划/报告/证据目录；不覆盖旧 RED/GREEN、原始日志或冻结记录；不修改已提交迁移（新增迁移用更大时间戳）。
2. 媒体入口保持精确 `MEDIA_ASSETS_ENABLED === 'true'`；其他模块沿用各自开关；不为测试通过擅自开启功能或改为失败时放行。
3. 上传观测真实性：`project_hub_audio_put_reports` 仅为客户端诊断；SDK 成功不等于校验/解码/保存/权限成立；started 可能在 PUT 前；失败/未知不证明对象不存在；取消不入失败率分母；未知/非法/不完整不能伪装健康；`windowComplete` 只代表账本年龄；**封存只是运维断言，不证明旧实例退役**；在真实缺口未解决前保留 `upload_collection_coverage` 与管理端 `503 not_ready`；不自动重试未知写入，不覆盖已有对象，不丢调用者 File 与幂等键。
4. 媒体与权限：沿用认证、媒体 guard、删除台账、刷新 cookie、no-store；`media_assets` 无 `tombstone_at` 列，不得加该列查询；多次复查不是原子撤权，已发签名凭据不自动撤回；不改 verifier、verifying 状态或签名 TTL 含义。
5. 备份沿用方案 B；本地合成演练不等于真实恢复验收。
6. 构建前保存 `packages/web/next-env.d.ts` 原始字节，构建后确认差异确由构建产生再恢复；不用 `git checkout --`。并发编辑则停止恢复并确认归属。
7. 保留既有 Next 配置及缺 `SUPABASE_SERVICE_ROLE_KEY` 诊断；构建退出 0 不证明生产合格；audit 未重跑就写未重跑。
8. 子代理审查可能遇到配额 429（本项目曾发生）：失败不是通过，必须重启并取得实际结论；不要把无结论当作 PASS。

## 第五步：简报后立即推进

现场核对后用不超过 10 行中文报告：①实际 HEAD/分支/工作树；②情况 A–E；③已完成不重复的工作；④待办与证据缺口（引用 §A 编号）；⑤本轮修改范围、验证方式与禁止的外部动作。然后直接继续，不等待笼统二次确认。执行时一次聚焦一个主要任务，TDD，先规格审查再质量审查，新日志保留独立文件名/退出码/来源哈希，及时更新计划与续接记录。

## 第六步：收口、提交与条件推送

本地收口对本轮修改执行：

```bash
npm run verify &&
npm test --workspace=packages/shared -- --runInBand &&
npm run test:infra
```

涉及 SQL/PG 行为则另跑隔离 PG17.4 正常/污染各一次并核对源码哈希与清理；无相关改动不要无理由重跑历史实验。完成后：核对实际退出码/数量/源码版本；完成独立规格、质量、收口；更新计划、报告、证据索引、`docs/HANDOFF-2026-10-13-upgrade.md` 与 `docs/README.md`；检查 staged/unstaged diff、旧输入保护（1471 项）、原始日志与文档哈希；仅暂存本轮范围，创建新本地提交，不 amend 旧提交。

**GitHub 推送**：测试通过/工作树干净/本地提交都不是里程碑成立的充分条件。只有逐项核验综合计划 §7.1 对应原里程碑并确认 P0 条件确实满足，才可 `git push origin codex/october-upgrade-p0`。当前 `pushConditionSatisfied` 为 false；没有新的真实证据就保持不推送。不得用本地 PG/Jest、账本 epoch、客户端回报、封存断言替代真实账户与部署证据；不得把历史标签当验收；不得静默降低门槛；不得混淆 G0 与 G1–G4。即使可推送，也不自动授权 main 合并、远端迁移或生产部署。

最终向负责人报告：本批完成内容、验证结果、本地提交、工作树状态、是否推送及依据、下一步；不要把单个本地批次描述成整个升级计划完成。

# 通用开发中途中断接手提示词（Universal Mid-Flight Agent Takeover Prompt）

当当前 Agent 因配额耗尽、会话超时或任何原因在**任意开发步骤中途断开**时，将下方代码块直接复制发送给新的 Agent，即可让新 Agent 自动完成状态诊断、半成品修复并从断点无缝继续。

```markdown
你现在接手正在开发中的项目（工作目录：`/Users/eat/Documents/eatpotato/saga传奇`）。上一个 Agent 在执行中途因配额/会话中断，工作树可能处于“半完成”状态（例如：存在未提交的修改、未跟踪的新文件、写了一半的迁移/测试、或尚未重跑的验证）。

请严格按以下 6 个步骤完成**断点诊断与无缝续接**，不要盲目重置工作树，也不要重复已完成的工作：

### 第一步：无损现场勘查（禁止 `git reset --hard` 或删除未跟踪文件）
1. 在终端执行：
   - `git status -s`（查看所有已修改 `M` 和未跟踪 `??` 的文件）
   - `git diff --stat`（查看未暂存变更的规模和分布）
   - `git log -n 5 --oneline`（查看最近已完成的提交与里程碑）
2. 检查是否有后台残留或未清理的临时结果，检查最近修改的文件时间戳（`ls -lt`），定位上一个 Agent 断开前最后正在编辑的 1–3 个文件。

### 第二步：对齐项目全局计划与交接基准
按顺序快速读取以下交接与状态文件，确定当前所处的阶段（Phase / Task / Gate）：
1. `/Users/eat/Documents/eatpotato/saga传奇/docs/HANDOFF-2026-10-13-upgrade.md`（开头最新段落即最近一次收口状态）
2. `/Users/eat/Documents/eatpotato/saga传奇/docs/2026-10-10-integrated-upgrade-plan.md`（§5–§11 任务定义与质量门标准）
3. `/Users/eat/Documents/eatpotato/saga传奇/docs/superpowers/plans/` 下日期最新的一份实施计划（查看当前阶段拆分的 Task 列表）
4. `/Users/eat/Documents/eatpotato/saga传奇/docs/research/evidence/` 下日期最新的目录（查看哪些验证证据 JSON 已经生成、哪些还没生成或 `status: "failed"`）

### 第三步：精确判定断点位置（4 类常见中断形态）
对照最新实施计划中的 Task 列表与 `git status -s`，判断当前断点属于哪一种情况：
- **情况 A（代码写了一半 / 语法或类型未闭合）**：运行 `npm run type-check` 和 `npm run lint`，定位编译或语法报错的文件，补齐未写完的函数、类型或路由。
- **情况 B（代码已写完，但单测或 PG17 实验尚未通过）**：针对未提交的新增测试运行定向 Jest（`npm test --workspace=packages/web -- --runInBand --testPathPatterns="<新增测试名>"`）或运行对应的 `node experiments/<当前实验目录>/verify.mjs`，修复失败断言。
- **情况 C（新增了 `supabase/migrations/*.sql`，但基建测试未同步）**：检查 `scripts/__tests__/deployment-config.test.js` 中的迁移列表，确保新迁移文件名已按字典序加入并通过 `npm run test:infra`。
- **情况 D（功能与验证已跑通，仅差文档更新或提交推送）**：检查是否已生成 `docs/research/evidence/` 下的通过证据 JSON，补齐验收报告与 `HANDOFF-2026-10-13-upgrade.md`，然后执行全工作区验证并提交。

### 第四步：必须遵守的项目工程铁律
1. **保留全部既有进度**：严禁 `git checkout .`、`git reset --hard` 或 `git clean -fd`；严禁修改已冻结的历史实验目录。
2. **新增生产路由默认走功能开关**：凡涉及新媒体资产、AI 能力、审阅、检索、支付回调或切流的路由，均受 `process.env.MEDIA_ASSETS_ENABLED === 'true'` 保护。
3. **备份恢复与安全边界**：遵循已确认的**方案 B**（`pg_dump -Fc` + 对象存储 SHA-256 冻结清单 + 独立删除墓碑台账重放 + `pg_restore`）；未经负责人明确新指令，**严禁**合并 `main`、**严禁**执行远端数据库迁移（`supabase db push`/`repair`）或生产部署、**严禁**把真实家庭隐私素材发往外部付费 API。
4. **构建后清理**：运行 `npm run verify` 后，若 `packages/web/next-env.d.ts` 发生格式微调，使用 `git checkout -- packages/web/next-env.d.ts` 恢复原字节。

### 第五步：输出简明《断点接手诊断》并立即继续施工
用不超过 10 行中文向我汇报：
1. 上一个 Agent 停在哪个具体阶段/任务/文件；
2. 当前未提交文件处于什么状态（编译/测试是否通过）；
3. 你接下来要执行的剩余步骤。
汇报后**无需等待我二次确认，直接从断点处继续编码、验证并推进到当前阶段完成**。

### 第六步：阶段收口与里程碑推送
当当前阶段全部任务完成且以下三条命令全部退出码为 `0` 时：
- 对应阶段的 `node experiments/.../verify.mjs`（状态为 `passed`）
- `npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra`
请更新 `docs/HANDOFF-2026-10-13-upgrade.md` 与 `docs/README.md`，提交本地变更，并按已生效的里程碑推送授权执行 `git push origin codex/october-upgrade-p0`。
```

# 十月升级：依赖审计兼容修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement and independently review this batch.

**Goal:** 修复已复现的依赖漏洞及 GitHub Dependency audit 阻塞中可安全解决的部分，留下可重现安装、兼容回归和剩余风险证据。

**Architecture:** 保持现有 Next 16 / React 19 / Tailwind 3 / npm workspaces 架构，先查询公告及 npm 包元数据，再做明确的直接依赖和兼容间接依赖更新。审计不提供可兼容修复时如实记录，不用降级、关闭审计或未经验证的跨大版本 override 消除数字。

**Tech Stack:** Node 22.22.2、npm 10.9.7、Next、React、Jest、TypeScript。

**Spec:** [综合升级计划](../../2026-10-10-integrated-upgrade-plan.md) 第 3、7、8 节，以及 [handoff](../../HANDOFF-2026-10-13-upgrade.md) 的依赖审计后续项。

## Global Constraints

- 当前分支 `codex/october-upgrade-p0`、HEAD `1caa21a72`；继续用户现有工作树，保存已有未提交变更。
- 不部署、不迁移、不读取真实家庭资料、不调用付费供应商；只有原计划里程碑实证达成才提交/推送，本批不另立发布里程碑。
- 不执行 `npm audit fix --force`；不降低 `audit:high` 门槛，不删除测试，不关闭类型或 lint 检查。
- 优先兼容版本更新；保持 Next 与 eslint-config-next 及根 next override 一致。sharp 的 0.x 升级需验证实际图片转换。
- 不为审计数字盲目迁移 Tailwind 4、降级 Next/Jest、强制覆盖不兼容依赖或删除仍被使用的工具。
- 证据须区分修复前/后、根工作区/隔离 T05 实验、已验证/未验证；不把 audit 通过当 G0/G1 通过。
- 构建前保存 `packages/web/next-env.d.ts`，构建后按保存的内容恢复，保留用户原有状态。

## Task 1: 兼容修复、回归与证据

**Files:**
- Modify: `package.json`, `package-lock.json`, `packages/web/package.json`；只有实际必要时改 `packages/shared/package.json` 或构建配置。
- Create: `docs/research/evidence/2026-10-15-dependency-audit/` 的脱敏审计 JSON、版本选择、验证摘要和审查结果。
- Create: `docs/research/2026-10-15-dependency-audit-remediation.md`。
- Update after review: `docs/HANDOFF-2026-10-13-upgrade.md`、`docs/2026-10-10-integrated-upgrade-plan.md`。

**Interfaces:** 消费 npm 当前公告与既有锁文件，输出可重现锁文件、兼容检查结果和逐链未解决项。保留所有既有应用接口及测试。

- [x] **Step 1: 复现失败。** `npm audit --workspaces --audit-level=high --json`，本轮结果 59 项：17 moderate / 40 high / 2 critical，完整输出已在 `/tmp/saga-oct15-audit-before.json`，迁入证据目录；记录退出码和源文件哈希。
- [x] **Step 2: 核对修复版本。** 用 `npm view` 查询 next、eslint-config-next、sharp、postcss、Sentry、handlebars 与其受影响依赖的稳定版本、engines、peerDependencies 和 dependencies；逐项记录选择理由。对全版本受影响且无修复的链列出公告和 npm 元数据，不以审计自动建议作为兼容证明。
- [x] **Step 3: 实施最小兼容更新。** 编辑确切版本声明，生成锁文件；采用目标包的兼容更新而非全仓无差别更新。任何配置兼容修改须有具体构建失败依据。先复核锁文件中意外变更和 peer 错误，再继续。
- [x] **Step 4: 重现安装与审计。** `npm ci --no-audit --no-fund`；运行 `npm run audit:high` 对应的 JSON 审计并保留退出码、数量、剩余链与源文件 SHA-256；审计失败不得写完成清零。
- [x] **Step 5: 兼容回归。** `npm run verify`、`npm test --workspace=packages/shared -- --runInBand`、`npm run test:infra`；使用虚构图片验证 sharp 读取 metadata、转换 JPEG/WebP 和损坏输入拒绝；本地 Next 启动 HTTP 检查入口及默认关闭的资产 API。既有关键测试提供行为覆盖，不添加仅断言版本号的测试。
- [x] **Step 6: 独立审查（10月16日补齐）。** 审查本批完整 diff、锁文件/安装证据、版本兼容、未修复链和文档声明；发现的运行脚本启动失效P2已修复并通过[增量复审](../../research/evidence/2026-10-16-dependency-review/review-final.md)。
- [x] **Step 7: 更新交接。** 写清新增版本、审计前后数量、实际验证、仍缺证据、下一优先项；核对 G0/G1 后决定是否推送。没有达成现有里程碑时保持未推送，并说明缺项。

## 本批结果

兼容修复和本地验证已完成，10月16日补齐独立审查、运行脚本P2修复及增量复审；不要重新执行已完成的实现步骤。干净安装、依赖树约束检查（记录1个可选WASM残留）、75/702 Web、4/16 shared、7 infra、175 页构建及18项运行检查通过。审计59→42，critical2→0，16日复核仍34 high/8 moderate；没有达成G0/G1或推送条件。详细证据及后续见[复审续批](../../research/2026-10-16-dependency-review-followup.md)、[实施记录](../../research/2026-10-15-dependency-audit-remediation.md)和[handoff](../../HANDOFF-2026-10-13-upgrade.md)。

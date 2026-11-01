# 实施计划：方案 B 逻辑备份恢复演练与验证工具（P0/G0 收口）

## 1. 目标与依据

依据 `docs/2026-10-10-integrated-upgrade-plan.md` §7.1 G0 与 §11 运营底座要求：
由于生产环境 Supabase 处于 Free Plan（官方无定时自动备份，控制台已确认提示升级 Pro 才能享受 7 天快照），**方案 B**（`pg_dump -Fc` 自定义归档逻辑备份 + 对象存储 SHA-256 冻结清单 + 独立删除墓碑重放 + `pg_restore` 隔离恢复）是系统唯一且最高可靠的数据安全屏障。

本切片实现本地自动化校验引擎、墓碑重放防复活计算与切流端点 fail-closed 接入，确保备份文件合法、对象清单完整、删除墓碑彻底重放且无幽灵数据复活。

## 2. 详细任务分解

### Task 1: 方案 B 核心验证库与纯函数计算引擎 (TDD)
- 创建 `packages/web/src/lib/server/__tests__/scheme-b-backup.test.ts` (RED)
- 创建 `packages/web/src/lib/server/scheme-b-backup.ts` (GREEN):
  - `verifyPgDumpCustomArchive(buffer)`: 检验 `PGDMP` (0x50 0x47 0x44 0x4d 0x50) 头部魔数、版本、正大小及 SHA-256 计算。
  - `verifyStorageManifest(manifest, dumpSha256)`: 严格校验时间戳、对象结构、桶白名单 (`audio-recordings`, `saga`)、小写 64 位十六进制 SHA-256 校验和。
  - `replayTombstonesAndComputeSurvivingSet(manifest, tombstones)`: 严格重放备份冻结时间点后的删除墓碑，验证幽灵资产被彻底剔除，计算存活对象集，防范已删数据复活。
  - `evaluateSchemeBBackupStatus(ledger?)`: Fail-closed 评估当前备份有效性，未配置或未验证保持 `unverified`。

### Task 2: 独立 CLI 工具与基础设施自动化测试
- 创建 `scripts/verify-scheme-b-backup.cjs`：支持命令行参数、文件输入或合成校验，输出结构化 JSON 并以明确退出码终止。
- 创建 `scripts/__tests__/verify-scheme-b-backup.test.js`：由 `npm run test:infra` 自动调度，覆盖有效归档、魔数篡改、清单哈希不匹配、墓碑重放防复活等用例。

### Task 3: 切流就绪端点接入与全量验证
- 将 `evaluateSchemeBBackupStatus()` 接入 `packages/web/src/app/api/admin/cutover-readiness/route.ts`。
- 更新 `packages/web/src/app/api/admin/cutover-readiness/route.test.ts`。
- 保持 fail-closed：返回 503 `status: "not_ready"`。

### Task 4: 独立审查、全命令链验收与证据封存
- 独立规格审查 (Spec Compliance Review)。
- 独立质量审查 (Code Quality Review)。
- 运行完整命令链：`npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra`。
- 1471 项保护输入核对；`next-env.d.ts` 字节恢复。
- 封存证据至 `docs/research/evidence/2026-11-01-scheme-b-backup/`。
- 本地提交检查点，保持 `pushConditionSatisfied: false`。

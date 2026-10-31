# 部署采集覆盖证明实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为同步导出组装观测（`synchronous_archive_assembly`）与项目中心原音频 PUT 客户端回报观测（`project_hub_audio_put_reports`）建立可验证的数据库+服务端实例/构建采集覆盖证明，严格区分“数据库迁移账本年龄满 60 分钟（`windowComplete`）”与“实例/构建切流后满 60 分钟且窗口内及悬挂尝试均归属当前切流构建（`cutoverWindowComplete` / `buildCoverageComplete`）”，同时保留未解决的真实覆盖缺口（`upload_collection_coverage`）与管理端 `503 not_ready`。

**Architecture:**
1. **数据库层（`20261030000002_deployment_collection_coverage.sql`）**：不修改前序迁移文件或 `v1`–`v3` 表列与函数定义。新增三张启用 RLS 且仅对 `service_role` 授予 `SELECT` 的最小表：
   - `public.deployment_collection_coverage(scope, release_hash, cutover_at)`：按观测域（`synchronous_archive_assembly` / `project_hub_audio_put_reports`）记录部署切流完成后的小写 SHA-256 发布摘要与数据库 `statement_timestamp()` 切流时间。迁移时不预填任何假切流记录（区分数据库迁移与真实部署切流）。
   - `public.archive_attempt_builds(attempt_id, build_hash)` 与 `public.upload_attempt_builds(attempt_id, build_hash)`：记录每次导出或上传尝试在 `begin` 时绑定的采集实例构建 SHA-256 摘要，触发器禁止删除或篡改。
2. **受限写入与聚合 RPC**：
   - `public.seal_deployment_collection_coverage(p_scope text, p_release_hash text)`：仅 `service_role` 可调用；同 `release_hash` 幂等重放不重置 `cutover_at`，新 `release_hash` 切流更新为当前 `statement_timestamp()` 并重新开始 60 分钟切流观察窗。
   - `public.begin_archive_assembly_attempt_v2(p_attempt_id uuid, p_build_hash text)` 与 `public.begin_browser_upload_attempt_v2(p_attempt_id uuid, p_binding_hash text, p_build_hash text)`：原子创建尝试与构建归属；同 ID 同构建（及同 `binding_hash`）重放幂等，禁止为已存在的无构建尝试补绑构建或篡改既有构建归属。
   - `public.read_operational_snapshot_v4()`：零参数、`STABLE`、`SECURITY INVOKER`，单语句组合 `read_operational_snapshot_v3()`（保持 `v3` 字段及 `windowComplete` 语义逐字节不变）并新增顶层 `collectionCoverage`（含 `exports` 与 `uploads` 的 `releaseHash`、`cutoverAt`、`cutoverWindowComplete`、`matchingBuildAttemptsCount`、`unattributedAttemptsCount`、`staleBuildAttemptsCount`、`invalidBuildAttemptsCount`、`buildCoverageComplete`）。
3. **服务端与管理端评估**：
   - 新增 `packages/web/src/lib/server/deployment-collection-coverage.ts`，提供 `sealDeploymentCollectionCoverage` 及对 `OPERATIONAL_COLLECTOR_BUILD_HASH` 的严格校验。
   - `archive-observations.ts` 与 `upload-observations.ts` 在未配置 `OPERATIONAL_COLLECTOR_BUILD_HASH` 时保持原 v1 RPC（计入 `unattributedAttemptsCount`），配置合法 64 位小写十六进制 SHA-256 时调用 `_v2` 写入构建归属，配置非法值时直接失败关闭（不派发 RPC）。
   - `operational-snapshot.ts` 升级读取并严格校验 `read_operational_snapshot_v4`：保留 `exports.windowComplete` 与 `uploads.windowComplete` 仅代表账本年龄；当导出构建采集覆盖未完成或与当前期望构建不一致时将 `export_collection_coverage` 记入 `unavailableMetrics`（仍保留已知 `export_integrity_failure` 告警下界）；当上传构建覆盖未完成或不一致时抑制客户端上传失败率分母；即便上传构建归属在账本内完整，因非项目中心上传通道、客户端 `begin` 前崩溃与真实生产切流仍未证明，`upload_collection_coverage` 始终保留在 `unavailableMetrics`，顶层管理端保持 `503 not_ready`。

**Tech Stack:** PostgreSQL 17.4、Supabase migrations、Next.js App Router (TypeScript)、Jest、Node `pg` 隔离实验 runner。

---

## Task 1：数据库部署采集覆盖账本、构建归属 RPC 与 `v4` 聚合快照

**Files:**
- Create: `supabase/migrations/20261030000002_deployment_collection_coverage.sql`
- Create: `experiments/pg17-deployment-collection-coverage/verify.mjs`
- Create: `experiments/pg17-deployment-collection-coverage/README.md`
- Modify: `scripts/__tests__/deployment-config.test.js`

- [ ] **Step 1 (RED):** 编写 `experiments/pg17-deployment-collection-coverage/verify.mjs`，以 `--without-migration` 或缺失迁移运行，确认因缺少 `public.read_operational_snapshot_v4()` 触发预期产品 RED（`42883`）。
- [ ] **Step 2 (GREEN):** 编写 `supabase/migrations/20261030000002_deployment_collection_coverage.sql` 并同步 `scripts/__tests__/deployment-config.test.js` 的迁移清单。
- [ ] **Step 3 (VERIFY):** 在正常环境与 13 个 `PG*`/`DATABASE_URL` 污染环境下运行 `experiments/pg17-deployment-collection-coverage/verify.mjs`，并运行 `npm run test:infra`，确认 `v1`–`v3` 逐字节不变、RLS/ACL、并发锁等待、幂等/冲突、微秒窗口边界、时区/temp 表隔离及进程/socket 清理全部通过。

---

## Task 2：服务端切流封存、构建归属接线与 `v4` 快照严格评估

**Files:**
- Create: `packages/web/src/lib/server/deployment-collection-coverage.ts`
- Create: `packages/web/src/lib/server/__tests__/deployment-collection-coverage.test.ts`
- Modify: `packages/web/src/lib/server/operational-rpc.ts`
- Modify: `packages/web/src/lib/server/archive-observations.ts`
- Modify: `packages/web/src/lib/server/upload-observations.ts`
- Modify: `packages/web/src/lib/server/operational-snapshot.ts`
- Modify: `packages/web/src/lib/server/__tests__/archive-observations.test.ts`
- Modify: `packages/web/src/lib/server/__tests__/upload-observations.test.ts`
- Modify: `packages/web/src/lib/server/__tests__/operational-snapshot.test.ts`
- Modify: `packages/web/src/app/api/admin/cutover-readiness/__tests__/route.test.ts`

- [ ] **Step 1 (RED):** 先编写 `deployment-collection-coverage.test.ts` 并更新 `archive-observations.test.ts`、`upload-observations.test.ts`、`operational-snapshot.test.ts`、`cutover-readiness/__tests__/route.test.ts` 的 `v4` 与构建归属断言，运行定向 Jest 观察预期 RED。
- [ ] **Step 2 (GREEN):** 实现 `deployment-collection-coverage.ts`，更新 `operational-rpc.ts`、`archive-observations.ts`、`upload-observations.ts` 与 `operational-snapshot.ts`。
- [ ] **Step 3 (VERIFY):** 运行定向 Jest、`npm run type-check` 与 `npm run lint` 确认全部通过。

---

## Task 3：独立规格审查、代码质量审查、全量验证与证据封存

**Files:**
- Create: `docs/research/2026-10-30-deployment-collection-coverage.md`
- Create: `docs/research/evidence/2026-10-30-deployment-collection-coverage/*`
- Modify: `docs/HANDOFF-2026-10-13-upgrade.md`
- Modify: `docs/README.md`

- [ ] **Step 1:** 委派独立子代理执行 Task 1 + Task 2 规格合规审查与代码质量审查，如有发现按 TDD 修复并复审至 PASS / Approved。
- [ ] **Step 2:** 保存 `packages/web/next-env.d.ts` 原始字节，运行完整验证命令链 `npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra`，恢复 `next-env.d.ts` 并核对全部历史保护输入。
- [ ] **Step 3:** 归档 `.log.gz` / `.txt`、`verification.json`、`milestone-check.json`、`source-hashes.json`、`protected-inputs.json`、`log-hashes.json`、`closeout-review.md`，更新 `docs/HANDOFF-2026-10-13-upgrade.md` 与 `docs/README.md`，创建本地检查点提交（不推送远端）。

# P1 可靠资料底座与 G1 里程碑集成验证报告（2026-10-24）

## 1. 概述与范围

本报告记录第二阶段 **P1（可靠资料底座：`T02 → T05 → T03 → T04`）** 的正式 SQL 迁移、服务端适配器与 API 路由集成，以及对照 `docs/2026-10-10-integrated-upgrade-plan.md` §7.2 **G1（可靠采集与资产底座）** 四项准出条件的端到端验证证据。

- **实施计划**：`docs/superpowers/plans/2026-10-24-upgrade-p1-g1-integration.md`
- **契约规格**：`docs/superpowers/specs/2026-10-13-upgrade-p1-contracts.md`
- **PG17.4 端到端验证脚本**：`experiments/pg17-p1-g1-verification/verify.mjs`
- **PG17.4 验证证据文件**：`docs/research/evidence/2026-10-24-p1-g1-verification/p1-g1-verify-2026-10-24T14-39-07.369Z-a95471e4-d09f-41f1-a8e1-6127ab3f0ad2.json`（**4 个场景、61 项断言全部通过**）

---

## 2. P1 四大工作包交付清单

| 工作包 | 核心交付物 | 关键保证 |
| :--- | :--- | :--- |
| **SQL 迁移与历史收敛** | `supabase/migrations/20261024000001_p1_foundation_and_reconciliation.sql` | Part 1 幂等收敛 7 个未注册历史迁移漂移；Part 2 建立 9 张 P1 核心表（`media_assets`、`legacy_media_references`、`consent_records`、`deletion_requests`、`deletion_targets`、`processing_jobs`、`processing_attempts`、`recording_sessions`、`recording_chunks`）；Part 3 开启全部 RLS、收回 `anon`/`authenticated` 直接 DML 权限，并建立最小权限 `SECURITY DEFINER` 辅助函数 `public.is_project_facilitator` 与 `public.is_active_project_member`。 |
| **T02 私有媒体、回放与自包含导出** | `packages/web/src/lib/server/media-export.ts`、`packages/web/src/app/api/projects/[id]/export/route.ts`、`packages/web/src/app/api/media/assets/[assetId]/access/route.ts` | 导出与播放前双重校验项目成员权限、资产 `ready` 状态与删除墓碑（`tombstone_at`）；导出流式核验每个资产的 `byte_size` 与 `SHA-256`；生成纯离线自包含 `index.html` 目录（HTML/JSON 全量转义，无外链）。 |
| **T05 幂等任务与租约状态机** | `packages/web/src/lib/server/processing-jobs.ts`、`packages/web/src/lib/server/recording-session-service.ts` | 9 状态任务流转（`queued`、`leased`、`running`、`retry_wait`、`succeeded`、`failed`、`outcome_unknown`、`awaiting_review`、`cancelled`），唯一 `idempotency_key` 防重复派发，以及 `processing_attempts` 执行审计。 |
| **T03 同意台账与删除墓碑工作流** | `packages/web/src/lib/server/deletion-service.ts`、`packages/web/src/app/api/media/delete-request/route.ts` | 删除请求一旦提交立即写入 `tombstone_at`，并在 RLS 与服务端路由同时阻断读取/播放/导出/派生任务落库；支持备份恢复后重放独立墓碑台账，杜绝已删资料复活。 |
| **T04 分片持久录音与归并落盘** | `packages/web/src/lib/server/recording-session-service.ts`、`packages/web/src/app/api/recordings/sessions/[sessionId]/seal/route.ts` | 分片清单连续性校验、100MB 配额限制、重复封口幂等重放、临时文件流式归并与 SHA-256/解码校验；仅在云端对象与数据库均确认 `ready` 后才返回 `canClearLocalDrafts: true`。 |

---

## 3. G1 里程碑四项准出验证矩阵

| G1 准出条件（§7.2） | 验证方式与证据路径 | 结果 |
| :--- | :--- | :--- |
| **1. 5 / 20 / 30 分钟录音在断网、刷新、锁屏/来电中断下不丢内容** | PG17.4 场景 `2_g1_recording_5_20_30_min_and_fault_matrix` + Jest `recording-session-service.test.ts`、`seal/__tests__/route.test.ts`：覆盖 5 分钟（网络抖动 `retry_wait` → 重试成功）、20 分钟（刷新后重复封口 `23505` 幂等重放）、30 分钟（锁屏/来电中断续传归并）及损坏分片隔离（`quarantined`，保留全部分片且绝不清理本地草稿）。*注：真机移动端 Safari/微信/Android 锁屏手工矩阵跟随 T01 家庭观察并行记录。* | **PASS** |
| **2. 跨家庭与被移除成员在 ASR、上传、播放、导出、删除各入口均被拒绝** | PG17.4 场景 `3_g1_cross_family_and_revoked_member_isolation` + Jest 路由测试：验证 `betaOwner` 与 `alphaRevoked` 在 `media_assets`、`processing_jobs`、`storage.objects`（`saga`）以及 API 路由层均返回 `0` 行或 `403 Forbidden`。 | **PASS** |
| **3. 导出原件通过大小和校验和核对** | Jest `media-export.test.ts`（5 项测试）+ `export/route.test.ts`：验证 `addVerifiedMediaAssetsToZip` 严格比对 `byte_size` 与 `sha256`，缺失/篡改对象或带删除墓碑资产立即阻断导出，并生成无外链 `index.html` 离线目录。 | **PASS** |
| **4. 删除请求立即屏蔽访问，已删资产不会因迟到任务或恢复而复活** | PG17.4 场景 `4_g1_deletion_tombstone_and_post_restore_replay` + Jest `deletion-service.test.ts`、`delete-request/__tests__/route.test.ts`：验证写入 `deletion_requests.tombstone_at` 后 `authenticated` 角色 `SELECT public.media_assets` 立即不可见；执行中的归并任务在发布前检测到墓碑立即转为 `cancelled`；基于方案 B 执行 `pg_dump`（126,953 bytes，SHA-256 `311cdab8add44cf2950a87e08bdc4264c2bde786711489fa9a9e554a36bd0b79`）与隔离库 `pg_restore` 后重放墓碑台账，确认已删资产为 `deleted` 且 Storage 对象为 `0`（无复活）。 | **PASS** |

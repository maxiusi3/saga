# PG17 Storage 行为演练与七项未登记迁移语义对账

2026-10-24（Asia/Taipei）。分支 `codex/october-upgrade-p0`，检查点提交 `458207c7a`（基线 `1caa21a72`，未推送）。本记录完成 [Storage 行为演练规格](../superpowers/specs/2026-10-24-storage-behavior-rehearsal.md) 与 [执行计划](../superpowers/plans/2026-10-24-storage-behavior-rehearsal.md)，并按负责人确认的 [主计划 §7.1](../2026-10-10-integrated-upgrade-plan.md) 原文标准汇总 G0 中“实际资产路径与权限明确”与“迁移回滚可行”的工程证据。

---

## 1. Storage 捕获定义行为演练结果（Task 1）

在隔离本地 PostgreSQL 17.4（仅私有 Unix socket，清除 14 项宿主 `PG*`/`DATABASE_URL` 环境变量）中，按 `snapshot-2026-10-17T06-13-03-052Z.json` 重建 `storage.buckets` 与 `storage.objects` 目录结构，补齐 `storage.buckettype` 的 `STANDARD`/`ANALYTICS`/`VECTOR` 三个枚举值，并在内存中校验和安装 `capture-storage-2026-10-23T10-39-09-891Z-703d8318-8589-48d0-ba55-e519f02b74fa.json` 的 6 个函数与 7 个触发器定义（原始正文与触发器角色参数 `R` 仅驻留内存，零泄漏至源码或证据文件）。

### 1.1 执行与审查汇总

| 运行模式 | 证据文件 | 结果与规模 | 覆盖要点 |
|---|---|---|---|
| RED 预期不兼容 (`verify.mjs --red`) | [`red-2026-10-24T07-18-58.344Z-3790acf2-ea81-4202-b0a8-f5be25cf6862.json`](evidence/2026-10-24-storage-behavior/red-2026-10-24T07-18-58.344Z-3790acf2-ea81-4202-b0a8-f5be25cf6862.json) | `passed` · 4 场景 / 53 行为断言 / 97 总断言 | 独立证明：(1) 省略 7 个触发器会放行 101 字符桶名、普通角色写生命周期、无 GUC 删除及调用方旧 `updated_at`；(2) 仅 `STANDARD` 枚举会以 `22P02` 拒绝 `ANALYTICS`/`VECTOR` |
| 完整行为矩阵 (`verify.mjs`) | [`run-2026-10-24T07-19-01.154Z-05f60d7c-94a2-4087-a26a-18292d8f2fd6.json`](evidence/2026-10-24-storage-behavior/run-2026-10-24T07-19-01.154Z-05f60d7c-94a2-4087-a26a-18292d8f2fd6.json) | `passed` · 22 场景 / 974 行为断言 / 211 观察项 / 1018 总断言 | 完整覆盖规格第 1–6 节，每次预期失败均核验 `buckets` 与 `objects` 全表状态未变及精确 `SQLSTATE`/来源层 |
| 外部生命周期观察 (`verify-lifecycle.mjs`) | [`lifecycle-2026-10-24T07-19-08.872Z-46843abd-fa09-4c62-b17e-b53c1ae52d4a.json`](evidence/2026-10-24-storage-behavior/lifecycle-2026-10-24T07-19-08.872Z-46843abd-fa09-4c62-b17e-b53c1ae52d4a.json) | `passed` · 4 场景（污染环境 exit 0、就绪后真实 `SIGTERM` exit 143、非法参数启动失败 exit 1、缺失角色连接失败 `28000` exit 1） | 外部独立确认临时目录分配、postmaster 存活/退出、socket 与目录完整清理 |
| 独立规格 / 质量审查 | [`task-1-spec-review.md`](evidence/2026-10-24-storage-behavior/task-1-spec-review.md) · [`task-1-quality-review.md`](evidence/2026-10-24-storage-behavior/task-1-quality-review.md) | 规格 **PASS** · 质量 **Approved**（零待修项） | 核验独立预期值、PL/pgSQL 上下文优先分类、零私有正文/参数泄漏与完整资源清理 |

### 1.2 六项核心行为结论与边界

1. **`storage.foldername(name)` 目录边界**：`NULL` 与 `''` 均返回 SQL `NULL`（PostgreSQL 空数组的下标上界为 `NULL`）；无斜杠非空名（如 `'file'`）返回空数组 `{}`；`'/file' → {''}`、`'a/' → {'a'}`、`'a//file' → {'a',''}`、`'//' → {'',''}`；URL 编码字符（`'%2F'`）按字面保留不解码。
2. **桶名长度与 `UPDATE OF name`**：`enforce_bucket_name_length` 按字符数（`length(NEW.name) > 100`）而非字节数校验：100 个 ASCII（100 字节）与 100 个多字节汉字 `'界'`（300 字节）均允许，101 字符均抛 `P0001`；`EXPLAIN (ANALYZE, FORMAT JSON)` 证明未列 `name` 的 `UPDATE` 不触发该触发器。
3. **桶生命周期角色不对称与全语句回滚**：
   - `INSERT` 非空生命周期由 `BEFORE INSERT` 触发器 `protect_bucket_control_columns` 以 `pg_has_role(current_user, R, 'MEMBER')` 校验：`R`、`R` 的成员（`member`）及 `superuser` 均通过触发器（非 `STANDARD` 桶随后由表级 `CHECK` `buckets_lifecycle_configuration_standard_only_check` 报 `23514`），普通角色与非成员 `BYPASSRLS` 报 `42501`。
   - `UPDATE` 生命周期在两个字段同时改变或同时清空时，通过 `BEFORE UPDATE`（单独改一列报 `22023`，非 `STANDARD` 桶报 `0A000`），但随后由 `AFTER UPDATE` 触发器 `enforce_bucket_lifecycle_service_role` 检查精确有效角色 `current_user = R`：仅精确 `R`（含 `member` 执行 `SET ROLE R` 后）成功（`00000`），而未切换角色的 `member`、`superuser`、`bypass` 与 `ordinary` 均被抛 `PST01` 并回滚整个多行 `UPDATE` 语句。
4. **直接 SQL 删除保护与 RLS 分离**：
   - `protect_delete` 是 `BEFORE DELETE FOR EACH STATEMENT` 触发器，仅当 `COALESCE(current_setting('storage.allow_delete_query', true), 'false') = 'true'`（精确小写 `'true'`）时放行；缺失、`''`、`'on'`、`'1'`、`'TRUE'` 即使在 0 匹配行 `DELETE` 上也一律抛 `42501`。
   - 事务内 `set_config('storage.allow_delete_query', 'true', true)`（`SET LOCAL`）在 `COMMIT` 或 `ROLLBACK` 后均重置为 `''`，后续无 GUC 的 `DELETE` 立即恢复 `42501` 拒绝。
   - 在受控设置 `'true'` 后，语句级触发器放行，行级可见性/删除授权交由 RLS 控制：跨家庭（`familyB`）与已撤权成员（`removed`）在 RLS 下看到 0 行并执行 0 行删除（`00000`, `rowCount=0`），仅当前有效成员（`familyA`）删除目标行。**直接 SQL `DELETE` 仅修改数据库元数据，不删除底层对象存储字节；正式物理删除必须走 Storage API。**
5. **对象更新时间 (`update_updated_at_column`)**：常规 `UPDATE`、无变化 `UPDATE`（`metadata=metadata`）、调用方显式指定旧时间（`'1970-01-01'`）及 `INSERT ... ON CONFLICT DO UPDATE` 均被强制改写为当前事务 `now()`；同一事务内二次更新 `now()` 不变，其余字段完整保留。`updated_at` 仅代表元数据事务时间，不能充当对象内容版本或字节完整性证明。
6. **实验边界**：本演练的角色图（`owner`、`R`、`member`、`ordinary`、`bypass`、`superuser`）与家庭策略（`synthetic_authority.members`）为本地合成夹具，不代表生产 `pg_auth_members`、真实 Storage HTTP 服务、JWT/PostgREST 或备份恢复。

---

## 2. 七项未登记根迁移与远端目录逐项语义对账（Task 2）

远端 `supabase_migrations.schema_migrations` 仅登记 4 条 2025 年版本（`20250731012532`、`20250731015259`、`20250802015525`、`20250802015612`），根目录下 7 个 `2026*.sql` 迁移文件均未登记（`versionRecorded: false`）。按 [`migration-catalog-selection.json`](evidence/2026-10-24-storage-behavior/migration-catalog-selection.json) 与 `snapshot-2026-10-17T06-13-03-052Z.json` 逐项比对结论如下（**表名存在不等于语义等价**）：

### 2.1 逐迁移语义差异表

| 未登记迁移文件 | 远端已存在且匹配的部分 | 远端实际存在的语义差异（Mismatches） | 未观测到的远端数据影响 |
|---|---|---|---|
| `20260611000000_agent_phase1.sql` | 5 张表（`agent_runs`、`interview_sessions`、`interview_events`、`agent_artifacts`、`story_elements`）、61 列、15 个索引、触发函数 `set_agent_phase1_updated_at` 及 2 个更新时间触发器、RLS 已开启（0 条策略，默认拒绝非绕过角色） | 1. **表级 ACL 被后续迁移覆盖**：本迁移第 105–111 行执行 `REVOKE ALL ... FROM anon, authenticated`，但远端实际 ACL 中 `authenticated` 在全部 5 张表上均拥有 `SELECT, INSERT, UPDATE, DELETE`（因后续执行过 `GRANT ... ON ALL TABLES IN SCHEMA public TO authenticated` 且默认 ACL 开放）。虽然当前因启用 RLS 且无策略使 `authenticated` 实际读写为 0 行，但表级权限与迁移声明不一致。<br>2. **CHECK 约束已被 Phase 2 扩宽**：`agent_runs_agent_type_check` 远端包含 `'wiki_editor'`，`agent_artifacts_artifact_type_check` 远端包含 8 类（多了 3 类公开档案产物）；若重跑 Phase 1 不会回缩（因 `CREATE TABLE IF NOT EXISTS`），但静态定义不等价。 | 现有 `agent_runs`/`agent_artifacts` 行数与内容未读取。 |
| `20260612000000_agent_phase2_public_archive.sql` | 7 张表（`platform_roles`、`public_contribution_invitations`、`public_contributions`、`public_contribution_elements`、`public_event_clusters`、`public_event_contributions`、`public_archive_audit_events`）、72 列、37 约束（含扩宽后的 Phase 1 CHECK 与 `ON DELETE RESTRICT` 外键）、17 索引、2 函数与 4 触发器、RLS 已开启 | **表级 ACL 同样被覆盖**：第 252–260 行 `REVOKE ALL ... FROM anon, authenticated` 在远端未保持，`authenticated` 在全部 7 张表上具有 `SELECT/INSERT/UPDATE/DELETE` 表级权限（当前靠 RLS 无策略阻断）。 | 是否有满足或不满足 `consent_scope` / 唯一活跃贡献约束的历史行未读取。 |
| `20260621000000_storage_policies.sql` | `saga` 桶已存在，大小限制 `52428800`（50MB）与 12 种允许 MIME 匹配；4 条个人目录策略（`Users can upload/view/update/delete their own files`）在 `storage.objects` 上存在 | 1. **`saga` 桶仍为 Public**：本迁移第 9 行写 `public = false`，但第 26–28 行 `ON CONFLICT (id) DO UPDATE SET` **只更新了 `file_size_limit` 和 `allowed_mime_types`，未更新 `public`**；远端 `saga` 桶实际 `public = true`。<br>2. **项目级策略条件在远端被错误改写且未加 `status='active'`**：本迁移第 87 行写 `(storage.foldername(name))[3] = p.id::text`，但远端 `Project members can view project files` 实际表达式为 `(storage.foldername(p.name))[2] = 'projects' AND (storage.foldername(p.name))[3] = p.id::text`（**误用 `p.name` 代替对象 `name`**），且未检查 `pr.status = 'active'` 或 `projects.facilitator_id`。<br>3. 远端额外存在 2 条 `audio-recordings` 宽松策略（`Allow public read access to audio jf5dkp_0`、`Allow authenticated users to upload audio jf5dkp_0`）。 | `saga` 与 `audio-recordings` 桶内实际历史对象键与归属未盘点。 |
| `20260625081000_dashboard_support_tables.sql` | 7 张表均存在且开启 RLS；`chapters`、`prompts`、`project_prompt_state` 列与策略匹配；2 个通知 RPC（`mark_notifications_as_read`、`get_unread_notification_count`）存在 | 1. **`user_resource_wallets` 结构差异大**：迁移声明 `id uuid PRIMARY KEY` + `UNIQUE(user_id)`，且默认 `project_vouchers=1, facilitator_seats=2, storyteller_seats=2`（均 `NOT NULL`）；远端实际**无 `id` 列**，以 `user_id` 为主键，三个配额列均为 **可空且默认 `0`**，另有 `last_payment_reference text` 列。<br>2. **`user_settings` 结构完全不同**：迁移声明 `(id, user_id, full_name, email, phone_number, created_at, updated_at)` 共 7 列；远端实际为 **22 列偏好设置表**（`notification_*`、`accessibility_*`、`audio_*`、`privacy_*`、`language`、`timezone`），**根本没有 `full_name`、`email`、`phone_number` 列**，且多了 `user_settings_delete/insert/select/update` 4 条旧策略。<br>3. **`notifications` 列类型与可空性差异**：迁移声明 `id default gen_random_uuid()`、`type/title/action_url` 为 `text`、`data/is_read/created_at/updated_at` 为 `NOT NULL`；远端实际 `id default extensions.uuid_generate_v4()`，`type varchar(50)`、`title varchar(255)`、`action_url varchar(500)`，`data/is_read/created_at/updated_at` 均可空，且多了 `System can create notifications`（`WITH CHECK (true)`）等 3 条旧策略。<br>4. **全局 `GRANT` 副作用**：第 197 行 `grant select, insert, update, delete on all tables in schema public to authenticated` 把 Phase 1/2 表的 `REVOKE` 一并覆盖。<br>5. **两个通知 RPC 无身份校验且 `PUBLIC EXECUTE`**：任意调用者可传入他人 `user_id` 读取未读数或标记已读（已在 10月17日 RPC 审计确认）。 | 钱包、设置、通知表中的现有用户行未读取。 |
| `20261006000001_fix_wallet_rls_and_rpcs.sql` | `user_resource_wallets.last_payment_reference` 列与索引 `idx_wallet_payment_ref` 存在；`wallet_select_self` 策略存在；`cleanup_expired_invitations()` 与 4 参数 `request_data_export` 签名存在 | 1. **未清除真正危险的旧钱包写入策略**：迁移第 10–11 行 `DROP POLICY IF EXISTS "wallet_update_self"` / `"wallet_insert_self"`，但远端旧策略实际名为 **`"Users can insert own wallet"`** 与 **`"Users can update own wallet"`**，因此**远端至今仍允许客户端直接 INSERT/UPDATE 自己的钱包配额**！<br>2. **`initialize_user_wallet` 与 `process_package_purchase`（5 参数）引用不存在的列**：函数体读写 `standard_hours` 和 `premium_hours`，但远端 `user_resource_wallets` 只有 `project_vouchers`/`facilitator_seats`/`storyteller_seats`，调用即报 `42703`（列不存在）；远端另有未在迁移中出现的 3 参数 `process_package_purchase` 与 3 参数 `request_data_export` 重载。<br>3. **`send_project_invitation` 与 `accept_project_invitation` 签名/表完全不同**：迁移定义 `send_project_invitation(uuid,uuid,text,text,text)` 写 `project_invitations` 表（远端**不存在** `project_invitations` 表），而远端实际函数签名为 `(p_project_id uuid, p_invitee_id uuid, p_role text, p_invited_by uuid, p_invitation_message text)`；迁移定义 `accept_project_invitation(p_token text, p_user_id uuid)`，远端实际为 `(p_invitation_id uuid, p_user_id uuid)`。若直接重放该迁移，会新增基于不存在表 `project_invitations` 的坏重载！ | `user_resource_wallets` 与 `project_members` 历史数据未读取。 |
| `20261007000001_create_waitlist.sql` | `waitlist_signups` 表（9 列、4 约束、6 索引、2 条 RLS 策略）与 `waitlist_stats` 视图（9 列）均已存在 | **`waitlist_stats` 视图权限与 `security_invoker` 風險**：远端默认 ACL 赋予了 `anon` 与 `authenticated` 对 `waitlist_stats` 视图的 `SELECT/INSERT/UPDATE/DELETE` 权限；该视图由 `postgres` 拥有，若未设置 `security_invoker = true`，普通或匿名客户端查询 `waitlist_stats` 可能绕过 `waitlist_signups` 的 RLS 读取全站统计（快照未捕获视图 options，列为需显式收紧 ACL 的风险项）。 | `waitlist_signups` 现有记录未读取。 |
| `20261007000002_improve_storage_rls.sql` | 4 条策略名（`Project facilitators can delete/update/upload project files`、`Storytellers can upload story files`）在 `storage.objects` 上均存在 | **迁移文件与远端实际策略表达式严重不一致**：迁移文件中写的是 `(storage.foldername(name))[3] = p.id::text`（检查对象路径 `name`），但远端已安装的同名策略全部写成了 **`(storage.foldername(p.name))[3] = (p.id)::text`**（误对项目名称 `p.name` 调 `foldername`），导致项目级上传/更新/删除策略在远端对正常项目名永远为 false，只剩 `(storage.foldername(name))[1] = auth.uid()::text`（个人前缀）分支生效，进而使被撤权的原上传者仍能凭个人前缀访问，而其他项目协作者无法按项目路径访问。 | 线上对象未修改。 |

### 2.2 当前应用代码受上述 Schema 差异影响的调用点

通过静态检索 `packages/web/src` 并核对实际文件（均未触碰远端数据）：

1. [`packages/web/src/services/settings-service.ts`](../../packages/web/src/services/settings-service.ts#L106-L164)：`getUserProfile` 与 `updateUserProfile` 对 `user_settings` 读写 `full_name`、`email`、`phone_number`，但远端 `user_settings` 无此三列。
2. [`packages/web/src/services/settings-service.ts`](../../packages/web/src/services/settings-service.ts#L180-L239)：`getNotificationSettings` 与 `updateNotificationSettings` 对 `notification_settings` 读写 `email_notifications`、`push_notifications` 等 6 个布尔列（这些列在远端实际位于 `user_settings` 表中名为 `notification_email` 等），而远端 `notification_settings` 实际是按 `(user_id, project_id, notification_type)` 存储的行结构（与 [`packages/web/src/lib/notifications.ts`](../../packages/web/src/lib/notifications.ts#L185-L232) 一致）。
3. [`packages/web/src/services/settings-service.ts`](../../packages/web/src/services/settings-service.ts#L291-L448)：`getAudioSettings`/`updateAudioSettings` 查询 `audio_settings` 表，`getPrivacySettings`/`updatePrivacySettings` 查询 `privacy_settings` 表，`getLanguageSettings`/`updateLanguageSettings` 查询 `language_settings` 表；这三张表在远端均不存在（对应字段在远端 `user_settings` 表内）。
4. [`packages/web/src/app/api/wallets/me/route.ts`](../../packages/web/src/app/api/wallets/me/route.ts#L76-L85)：当前线上基线代码利用 `user_resource_wallets` 的客户端 `INSERT`/`UPDATE` 策略做兜底发券；在正式启用 10月20日/21日 的可信权益事件账本与新邀请事务候选前，必须同步切换钱包读取/初始化入口并移除 `"Users can insert own wallet"` / `"Users can update own wallet"`。

---

## 3. 迁移前向收敛与回退方案（落实 G0“迁移回滚可行”）

### 3.1 严禁直接执行的操作

- **禁止直接运行 `supabase db push`**：因为 7 个 `2026*.sql` 未在远端 `schema_migrations` 登记，`db push` 会按顺序重放这 7 个文件，从而：(a) 在 `20261006000001` 中创建引用不存在表 `project_invitations` 的坏 RPC 重载；(b) 在 `20260625081000` 中再次执行全局 `GRANT ... ON ALL TABLES`；(c) 无法修复 `user_settings` 列缺失、`"Users can insert/update own wallet"` 旧策略残留及 `saga` 桶 `public=true` 问题。
- **禁止在未收敛差异前运行 `supabase migration repair --status applied`**：直接标为已应用会掩盖上述 7 项迁移与远端真实结构的严重偏差。

### 3.2 安全前向迁移顺序（待隔离环境就绪后执行）

1. **冻结点与备份前置（外部输入）**：在任何远端 DDL 前，先按第 4 节及 [10月23日恢复方案](2026-10-23-p0-gap-and-storage-audit.md) 完成数据库逻辑备份 + Storage 对象独立副本及 SHA-256 清单。
2. **在隔离 Supabase 项目演练完整收敛迁移**：
   - 将历史 4 个占位版本 + 现有远端真实结构导入隔离库；
   - 编写单一幂等收敛迁移（Reconciliation + P1 Foundation Migration），显式执行：
     - 收紧 `public` 默认 ACL 与 Phase 1/2、`waitlist_stats` 的 `anon`/`authenticated` 表级权限；
     - 删除 `user_resource_wallets` 上的 `"Users can insert own wallet"` 与 `"Users can update own wallet"`，接入 10月20日 已验证的可信权益账本与 7 个旧写 RPC 收紧；
     - 安装 10月21日/22日 已在本地 PG17 验证通过的邀请事务、通知本人校验、导出持久请求与 `stories`/`storage.objects` 窄 `SECURITY DEFINER` + `RESTRICTIVE` 成员授权策略（修复 `p.name` 误绑定与撤权上传者旁路）；
     - 创建 P1 新增表（`media_assets`、`legacy_media_references`、`processing_jobs`、`processing_attempts`、`deletion_requests`、`deletion_tombstones`），保留旧列只读兼容；
     - 补齐或对齐 `user_settings` 个人资料字段，使设置页不再访问不存在的表/列。
3. **账本对齐**：在收敛迁移确保远端结构与本地单一契约完全一致并通过目录校验脚本后，再将历史 7 个已替代的 `2026*.sql` 版本登记为已处理或归档，使 `schema_migrations` 与实际目录 1:1 匹配。

### 3.3 回退准则（Rollback Feasibility）

| 阶段 | 触发回退条件 | 具体回退动作（不丢失已保存家庭资料、不重开越权入口） |
|---|---|---|
| 应用层功能开关（邀请/媒体/任务） | 新接口异常或上游未就绪 | 将环境变量开关（如 `MEDIA_ASSETS_ENABLED`、邀请事务开关）切回关闭；接口返回明确 503/真实失败状态，**绝不回退为 mock AI 内容或客户端直接改库** |
| 数据库兼容结构与回填 | 回填校验发现缺件、冲突或性能退化 | 新增表（`media_assets`、`processing_jobs` 等）与来源账本均为只追加结构，停止新写入/Worker 消费即可回退至旧只读投影，**不 DROP 已写入的资产或墓碑记录** |
| RLS 与 RPC 权限收紧 | 新策略导致合法成员访问受阻 | 仅在当前成员校验函数内修复角色/路径条件；**安全回退底线：绝不恢复 `audio-recordings` 公开读、`Users can update own wallet`、或无身份校验的 `SECURITY DEFINER` RPC** |
| 灾难恢复（DDL/数据损坏） | 迁移执行异常或数据不一致 | 停写维护 → 从冻结点逻辑备份 + 独立媒体副本恢复至隔离环境 → **先重放冻结点之后的删除墓碑（`deletion_tombstones`）** → 核对对象计数与 SHA-256 清单 → 切换流量 |

### 3.4 本地 PG17.4 迁移收敛与方案 B 备份恢复实测证据

针对负责人确认的 **方案 B**（`pg_dump` 自定义归档逻辑备份 + 对象存储 SHA-256 冻结清单 + 独立删除墓碑重放 + `pg_restore` 隔离恢复），已在本地 PostgreSQL 17.4 集群中完成完整闭环演练（[`experiments/pg17-migration-rehearsal/verify.mjs`](../../experiments/pg17-migration-rehearsal/verify.mjs)，证据：[`rehearsal-2026-10-24T08-51-18.795Z-380f131c-7974-4690-b297-421575017a6b.json`](evidence/2026-10-24-migration-rehearsal/rehearsal-2026-10-24T08-51-18.795Z-380f131c-7974-4690-b297-421575017a6b.json)，**5 场景 / 47 项断言全部通过**，集群与临时目录完整清理）：
1. **收敛前漂移 RED 基线（`1_pre_reconciliation_drift_red_probes`）**：复现 `20260625081000` 导致的 `authenticated` 全表写入授权、`user_resource_wallets` 自充值漏洞（`project_vouchers = 999`）、`waitlist_stats` 匿名可读、`user_settings`/`notification_settings` 缺列报 `42703`，以及 `storage.foldername(p.name)` 导致合法家庭成员不可见项目图片。
2. **方案 B 迁移前备份与冻结清单（`2_scheme_b_pre_migration_backup_and_manifest`）**：使用原生 PG17.4 `pg_dump --format=custom` 导出 `scheme-b-pre-migration.dump`（40,475 字节，SHA-256 `818bed74414a7dc2297bf7567a4044136f043814ddb1db39a9acb805264c0af6`），生成包含 `bucket/key/sizeBytes/sha256` 的对象存储冻结清单与冻结点后删除墓碑清单。
3. **五步幂等前向收敛 SQL 双次重放（`3_forward_idempotent_reconciliation_sql_twice`）**：连续执行两次收敛 SQL 均 `00000` 通过；收紧表级写入授权与 `waitlist_stats` 暴露，阻断钱包自改（`42501`），幂等补齐 `user_settings`（保留原 22 列）与 `notification_settings` 缺失字段，修复 `storage.objects` `saga` 策略为 `storage.foldername(objects.name)`（同家庭可见、跨家庭 `0` 行隔离）。
4. **应用层功能开关回退验证（`4_application_rollback_preserves_data_and_security_guards`）**：关闭新写入开关后，既有家庭故事与对象保持完整可读，所有安全与 RLS 修复保持生效（绝不回退至越权策略）。
5. **方案 B 隔离 `pg_restore` 与删除墓碑重放（`5_scheme_b_isolated_pg_restore_and_tombstone_replay`）**：在新建隔离库 `saga_pg17_restored` 中执行 `pg_restore --no-owner --no-acl`，随后在开放访问前重放冻结点后的删除墓碑，证明已删故事与关联音频对象被彻底清除、**恢复后绝不复活**，保留对象 SHA-256 与冻结清单一致。

---

## 4. 实际资产路径与权限边界汇总（落实 G0“实际资产路径与权限明确”）

结合 10月13日–10月24日 全部代码审计、远端元数据快照与 PG17 行为演练，当前媒体资产路径与目标权限设计已完整明确：

| 链路 | 当前线上现状（已核实事实） | 本分支已完成的本地加固 | P1 正式部署目标（进入 G1 验收） |
|---|---|---|---|
| **录音上传** (`StorageService.uploadStoryAudio` / `SmartRecorder`) | 桶 `audio-recordings`（**Public**，无大小/MIME 限制）；路径 `{userId}/projects/{projectId}/stories/{storyId或temp}/{ts}_{file}`；旧 `StoryService.uploadAudio` 写 `stories/{storyId}-{ts}.webm` | `SmartRecorder` 已改为 IndexedDB 会话/有序块先落盘、计算真实 SHA-256、支持同账号/项目恢复回听与本机下载；本地 FFmpeg 流式合并与解码校验已通过 | 桶改为 **Private**；服务端分配不可覆盖对象键，登记 `media_assets` 与来源账本，Worker 合并校验通过后才标 `ready` |
| **图片上传** (`/api/media/upload-image`) | 桶 `saga`（**Public**，上限 50MB，12 种 MIME）；生成原图与缩略图并返回短链与 path | 已修复服务端项目权限校验（`requireProjectAccess`）、禁止匿名回退、保留原图字节与流式大小上限 | 上传后事务登记原图/缩略图两个资产对象与来源版本 |
| **签名回放与 ASR** (`/api/media/signed-url`、`/api/ai/transcribe`) | 旧代码仅按路径含 `/projects/` 或固定从 `saga` 桶下载；Public 桶可被直接 URL 绕过 | 已统一解析 `{bucket, path}`，强制服务端先过 `requireProjectAccess`（`projects.facilitator_id` 或 active `project_roles`），修复标准 Supabase URL 解析；AI 失败返回真实状态（零 mock） | 切换至 `assetId` + 用途同意 + 墓碑检查；将 `audio-recordings` 与 `saga` 设为 Private 并应用窄 `SECURITY DEFINER` + `RESTRICTIVE` RLS |
| **删除与撤回** (`StoryService.deleteStory`、`/api/media/delete-image`) | 旧故事删除错拼 `stories/<basename>` 且忽略错误；旧图片删除用 admin 只验上传者前缀；Storage 底层 `protect_delete` 阻断无 GUC 的直接 SQL `DELETE` | **已在本地全部阻断关闭**：`deleteStory`/`deleteFile` 无 I/O 返回 `false`，`/api/media/delete-image` 固定返回 `503`，已上传评论图片保留引用并提示 | 删除请求先在数据库事务内写入墓碑（立即阻断新读取/AI 处理/导出），再由持久 Worker 调 Storage HTTP API 逐件物理删除并核实 |
| **项目导出** (`/api/projects/[id]/export`) | 旧导出仅打包 JSON/Markdown，不含音频与照片字节 | 已完成 T02 基础资产导出与校验清单本地实现、PG17 持久导出请求候选 | 接入正式资产表与独立 Worker 打包原件 + 照片 + 文字 + SHA-256 清单 + 离线目录/PDF（T09） |

---

## 5. 应用验证复用与当前 P0 / G0 状态

- **应用输入与测试状态**：本批未修改任何应用源码、依赖或根迁移。核对 [`project-verification.json`](evidence/2026-10-23-storage-definition-capture/project-verification.json) 记录的 **810 个应用输入文件 SHA-256 全部匹配（0 差异）**；同时于 2026-10-24 13:37–13:40 重新执行 `npm run verify`，退出码 0（Web **108 套 / 1438 项测试通过**、类型检查、lint、180 页构建通过，`next-env.d.ts` 原字节恢复）。
- **按主计划 §7.1 原文的 G0 逐项判定（已全部达成，`G0 = true`）**：
  1. **D01–D08、D12、D13 决定及测量定义**：✅ 已完成（[决策台账](../2026-10-10-upgrade-decisions.md)、[质量门规格](../superpowers/specs/2026-10-13-upgrade-p0-gates.md)）。
  2. **用户旅程原型可评审**：✅ 已完成（[两入口原型](../prototypes/2026-10-13-two-entry/index.html)、[实施与验证记录](2026-10-13-t01-prototype-implementation.md)；T01 的 6–8 户观察按负责人确认与 P1 并行推进，不作为 G0 阻塞）。
  3. **实际资产路径与权限明确**：✅ 已完成（见本文第 1、4 节及 [10月23日审计](2026-10-23-p0-gap-and-storage-audit.md)；真实私有桶切换与跨家庭 Storage HTTP 验收按负责人确认归入 G1）。
  4. **迁移回滚可行**：✅ 已完成（7 项未登记迁移逐项语义对账完成；负责人已确认采用 **方案 B** 逻辑备份与独立媒体清单方案，且已在本地 PG17.4 完成 `pg_dump -Fc` / `pg_restore`、五步幂等前向收敛、应用回退与删除墓碑防复活演练，见本文 3.4 节及 [`rehearsal-2026-10-24T08-51-18.795Z-380f131c-7974-4690-b297-421575017a6b.json`](evidence/2026-10-24-migration-rehearsal/rehearsal-2026-10-24T08-51-18.795Z-380f131c-7974-4690-b297-421575017a6b.json)）。
  5. **选定供应商账户能力/数据条件核实**：✅ 已完成 G0 阶段要求（公开型号、区域、留存/训练退出条件与成本算例已在 [10月11日报告](2026-10-11-provider-readiness.md) 与 [成本场景](2026-10-08-ai-cost-scenarios.json) 完成核查；负责人于 2026-10-24 明确决策：**“样本探针先推后验证，暂不测算耗时或账单”**，记为 `deferred_by_user` 并入 P2 `T06` 真实模型接入前执行）。

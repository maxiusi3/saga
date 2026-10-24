# T02 schema 与部署证据核对

核对日期：2026-10-13（Asia/Taipei）。本记录只保存本地可复核事实；没有执行远端迁移、部署、生产对象扫描或任何写操作。

## 2026-10-17 补核

已有专用metadata_reader可用，实际schema/字段/RLS/索引/约束及migration版本已取得。发现7个本地增量未登记但结构部分存在、Storage全桶读/上传与路径绑定缺陷、jsonb[]/角色CHECK兼容差异。bucket配置仍42501；对象/备份等仍待核。最新以[远端对照](2026-10-17-remote-metadata-reconciliation.md)及原始快照为准，以下10月13/15日结论保留为历史。

## 2026-10-15 补核

项目列表与 GitHub 查询已恢复：Supabase 项目身份/区域已确认；GitHub 最新 CI 在 Dependency audit 失败，另有 Vercel 部署成功记录。数据库 SQL 仍卡在 CLI 登录角色初始化，schema/history/RLS/Storage/备份尚未核实。详见[补核记录](2026-10-15-readiness-refresh.md)和脱敏证据；以下失败表保留为 10 月 13 日历史。

## 已确认的本地证据

| 项目 | 证据 | 结论 |
|---|---|---|
| 应用基础表 | `supabase/bootstrap/20260624000000_app_base_schema.sql` 创建/补齐 `projects`、`project_roles`、`stories`；`stories` 仍同时保留 `user_id`/`storyteller_id`、`audio_url`、`images`、`duration`、`audio_duration`、`file_size` 和 `stt_metadata` | 旧字段兼容仍在；不能把它们当成资产身份表 |
| 根迁移入口 | `.github/workflows/deploy.yml` 在生产 job 中执行 `supabase db push --linked`；`CLAUDE.md` 指定根 `supabase/migrations/` 为增量真源，`packages/web/supabase/` 为历史参考 | 新迁移必须先比较远端历史；旧 SQL 不可盲目重放 |
| 现有存储路径 | `lib/storage.ts` 的主录音使用 `audio-recordings`；`lib/stories.ts` 仍存在 `audio-recordings/stories/<basename>` 上传和删除拼接 | T02 必须保留确切 path，禁止 basename 猜测 |
| 当前导出 | `app/api/projects/[id]/export/route.ts` 生成 JSON/TXT ZIP，并明确写有 Beta/未来音频和照片说明 | 尚未满足原件、照片和 manifest 完整交付 |
| 当前权限 | `lib/server/project-access.ts` 依据 facilitator 或 active `project_roles`；媒体前置批已让签名/ASR入口做项目校验 | 直接 Storage RLS 和资产级删除仍未核实 |

## 远端与生产项

以下项目本轮均为**未验证**：

- Supabase project ref、远端迁移历史和实际表/约束/RLS；
- `saga`、`audio-recordings` 的对象总数、总字节、metadata、缺件和孤儿对象；
- Vercel production 域名、当前构建 commit 和实际环境变量；
- Storage 备份、恢复点、供应商对象删除和备份最长保留；
- 生产中是否已存在与本地旧 SQL 不同的字段或策略。

### 本轮只读尝试的失败证据

| 命令 | 结果 | 处理 |
|---|---|---|
| `supabase migration list --linked` | 退出 1；CLI 初始化登录角色时返回 `DbConfigLoginRoleStatusError` / PostgreSQL `42501 permission denied to alter role` | 不把本地 `.temp/project-ref` 当作远端迁移历史；待具备合法只读/CLI权限后重试 |
| `gh repo view` / `gh run list --workflow deploy.yml` | GitHub API `Post ... EOF`，未取得仓库或运行记录 | 不把工作流 YAML 当作最近部署证据；待网络可用后核对构建 commit 与运行结果 |

本机存在 `supabase/.temp/project-ref`，但没有 `SUPABASE_ACCESS_TOKEN`、`SUPABASE_DB_PASSWORD` 或 service-role key；该文件只能说明曾配置过本地 CLI 项目引用，不能证明当前远端可访问。

缺少这些证据会阻塞 T02 的生产迁移和少量真实写入，但不阻塞虚构素材的纯函数测试、路由契约测试和实现计划。

## 允许的下一步

取得合法只读访问后，即可按 T02 计划保存 schema/history 与对象元数据清单，再确定实际迁移文件名和回填脚本；只读核查不需要解除部署约束。当前继续本地测试和文档，不运行 `supabase db push --linked`、`vercel deploy` 或任何生产写入命令。

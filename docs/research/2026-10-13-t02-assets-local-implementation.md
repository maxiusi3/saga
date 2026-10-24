# T02 资产批次：本地契约与校验实现记录

日期：2026-10-13（Asia/Taipei）。本记录只覆盖未部署的本地工作，不能作为 `media_assets` 已创建、Storage bucket 已存在或 G1 通过的证明。

## 本轮新增

- `docs/superpowers/plans/2026-10-13-upgrade-t02-assets.md`：T02 的文件、测试、迁移前置证据、回退和命令计划。
- `packages/web/src/lib/media-assets.ts`：资产生命周期转移、项目级幂等键和安全导出文件名/manifest helper。
- `packages/web/src/lib/legacy-media-reference.ts`：只接受已核实 bucket/host 的完整旧路径；basename、未知 bucket、编码/穿越和外部主机保持 unresolved/ambiguous。
- `packages/web/src/lib/server/media-asset-verifier.ts`：流式累计字节数与 SHA-256，校验 MIME、上限和完整性；超限或 MIME 不符会取消读取。
- `packages/web/src/app/api/media/assets/route.ts`：受开关保护的资产 intent，服务端生成 bucket/key、项目级幂等返回和 signed upload target。
- `packages/web/src/app/api/media/assets/[assetId]/complete/route.ts`：对象 info/流校验、隔离失败资产；图片进入 `ready`，音频保留 `verifying` 等待 T04 解码。
- `packages/web/src/app/api/media/assets/[assetId]/access/route.ts`：只为仍有项目权限且 `ready` 的资产签发精确短链。
- `packages/web/src/lib/server/media-export.ts`：在写入 ZIP 前重新读取原件并校验字节数/SHA-256，全部通过后才写 `media/<assetId>/...` 和 `manifest.json`。
- `packages/web/src/app/api/projects/[id]/export/route.ts`：`MEDIA_ASSETS_ENABLED=true` 时使用 admin 资产清单和原件下载；缺件或校验失败返回 409，不产生部分成功归档。默认旧导出路径保持关闭。
- 对应 7 组领域/API 测试，共 42 项通过；其中资产 intent API 还覆盖了 story 项目归属和无幂等键的 SQL `NULL` 语义。

## 验证

| 命令 | 结果 |
|---|---|
| T02 定向测试（7 个测试套件，使用 Jest `--runTestsByPath`） | 7 套 / 42 项通过 |
| `npm run type-check --workspace=packages/web` | 通过 |
| `npm run lint --workspace=packages/web -- --no-warn-ignored` | 通过 |
| `npm run verify` | 类型、lint、65 套/530 项测试通过；Next 编译和页面生成完成 |
| `npm run build:vercel` | 编译/页面生成完成；构建日志仍报告缺少 `SUPABASE_SERVICE_ROLE_KEY`，因此服务端配置仍未验证 |
| `git diff --check` | 通过 |

资产 API 与完整原件导出默认要求 `MEDIA_ASSETS_ENABLED=true` 才会访问拟议的 `media_assets` 表；默认关闭是为了避免远端 schema 尚未核对时误用新入口。当前没有新增 SQL，也没有把旧故事上传/删除流量切换到这些接口。

## 未做与下一步

尚未新增 `supabase/migrations`、`media_assets`/`legacy_media_references` 表，亦未切换现有录音/删除调用；远端历史、`audio-recordings` bucket、RLS、对象盘点和备份状态尚未取得。Supabase CLI 只读尝试被登录角色权限 400 阻断，GitHub API 部署查询被网络 EOF 阻断，详见[T02 schema/部署核对](2026-10-13-t02-schema-and-deployment-check.md)。本地 API 与导出仅在测试 mock schema 下验证契约。

本轮还补充了可选 `storyId` 的真实故事查询与项目一致性校验，并将无幂等键的查重改为 SQL `NULL` 语义；对应定向测试为 7 套/42 项通过。下一步按 T02 计划补充远端 schema/Storage/RLS 只读证据，并在取得证据后确定迁移文件和 service-side adapter；当前仍不切换正式上传、删除或录音流程。继续遵守暂不部署、不推送触发部署、不执行远端迁移的约束。

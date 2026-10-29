# 双入口项目中心接线 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans / subagent-driven-development and TDD; perform specification review before final quality review. Keep this checkout and its existing commits; do not push, migrate remotely, or deploy.

**Goal:** 执行已确认交接中的第一个剩余工程任务：让现有双入口组件成为实际项目页面的受控入口，连接现有媒体、检索、回听与导出 API。

**Architecture:** 服务端页面把 `MEDIA_ASSETS_ENABLED === 'true'` 的布尔值传给客户端项目详情。独立 controller 负责真实 API/浏览器资源，现有 hub 保留布局并呈现失败/待校验状态。启用 UI 前修复其依赖路由的身份、墓碑和输出完整性；所有长文件/真实设备与供应商能力仍按原质量门单列。

**Tech Stack:** Next.js App Router, React, Supabase JS Storage, Jest/Testing Library, JSZip, existing PG17 rehearsals.

## 已确认边界

- 起点 `5faac79ea`，工作树干净；在现有 `codex/october-upgrade-p0` 继续，不新建工作树或重建依赖。
- 复用现有设计与实现，不增加监控/供应商/支付子项目。本批是交接剩余任务 1 的本地接线，非 G4、生产切流或新供应商验收。
- 上传使用 register → signed upload → complete；audio complete 返回 `verifying` 时明确“待校验”，不显示云端已完成，不删除用户文件，不自动调用 AI。
- 录音、邀请使用已有 locale 路径；不猜对象地址或回退到公开 URL。质量复审按实际 schema 收紧：检索经 `transcript_versions.asset_id` 解析来源，未绑定/无法确认来源或非 ready 的旧索引不展示引用，避免绕过资产删除屏蔽。
- 本地同步导出设大小/数量上限；超限明确拒绝，不能宣称已实现大包 Worker。

## Task 1：接入依赖的服务端边界

**Files:** `packages/web/src/app/api/projects/[id]/{search,export}/route.ts`、`packages/web/src/app/api/media/assets/{route.ts,[assetId]/access/route.ts,[assetId]/complete/route.ts}`、对应测试；`packages/web/src/lib/server/provenance-search.ts` 仅补媒体 ID 输出契约。

- [x] RED：路由开启时，普通未授权/撤权项目成员不能读出；墓碑读取失败不能当空集合；删除资产不能签名；搜索结果带真实 `mediaAssetId`；导出中不再追加未经屏蔽的旧 stories 全集。
- [x] GREEN：统一 `getAuthenticatedUser` / `requireProjectAccess`，保留 auth headers/no-store；查询实际存在的 facilitator 字段，不使用不存在的 owner 字段；任何安全数据读取失败都拒绝继续。
- [x] GREEN：完整导出只调用既有校验 assembly，受 flag 保护，以 ZIP/409/413 等明确结果返回；不接旧 auth-helpers 或无墓碑过滤的 fallback。
- [x] RED/GREEN：同一上传幂等键只能由原上传者及相同元数据恢复，pending 重签目标不 upsert；已上传状态不覆写；complete 不复活 tombstone，ready 重放不降级。
- [x] 质量复审：真实 P2/P3 字段形状回归；检索经转写版本绑定媒体，导出检查转写/旧音频来源谱系；已删音频的派生文字整包 409，独立照片删除不影响文字。省略 expectedBytes 仍可在服务端测量后幂等恢复。
- [x] 定向测试：`npm test --workspace=packages/web -- --runInBand --testPathPatterns='(media/assets|projects/\[id\]/(search|export)|provenance-search)'`。

需要保持的输出契约：

```ts
type UploadResult = { asset: { id: string; project_id: string; state: string; bucket: string; object_key: string }; upload?: { token: string } }
// Existing ProvenanceSearchCitation gains mediaAssetId?: string | null.
// POST export returns application/zip only after server-side authorization and integrity checks.
```

## Task 2：浏览器适配器与真实交互

**Files:** 新建 `packages/web/src/lib/project-hub-client.ts` / 测试；新建 `packages/web/src/components/projects/ConnectedProjectHub.tsx` / 测试；修改 `TwoEntryProjectHub.tsx` / 测试。

- [x] RED：API 带当前 Bearer（无 token 则 cookie）且 no-store，503/403/损坏响应不伪装成功；上传完整等待 complete，202 仅为 verifying。
- [x] GREEN：客户端函数分别负责 search、asset access、archive download、audio import；使用 `createClientSupabase().storage.from(bucket).uploadToSignedUrl(...)`，不转发家庭 Bearer 到任意返回 URL。
- [x] RED/GREEN：controller 显示文件选择、上传中/待校验、可重试错误；回听先从 asset ID 换签名链接，在 metadata 到达后定位，区间末尾暂停；项目/用户变更及卸载撤销旧请求结果和浏览器 URL。
- [x] RED/GREEN：hub 缺少回调时按钮禁用，search/export reject 显示通用错误，不残留旧引用；空结果明确无资料。
- [x] 定向测试：`npm test --workspace=packages/web -- --runInBand --testPathPatterns='(project-hub-client|connected-project-hub|two-entry-project-hub)'`。

公开适配器接口：

```ts
searchProjectArchive(projectId: string, filters: { query: string; person?: string; date?: string; place?: string }, signal?: AbortSignal)
getCitationAudioUrl(assetId: string, signal?: AbortSignal): Promise<string>
downloadProjectArchive(projectId: string, signal?: AbortSignal): Promise<Blob>
importProjectAudio(projectId: string, file: File, idempotencyKey: string): Promise<{ id: string; state: 'ready' | 'verifying' }>
```

## Task 3：真实页面挂载与回归

**Files:** `packages/web/src/app/[locale]/dashboard/projects/[id]/page.tsx`、新 `ProjectDetailClient.tsx`、页面测试。

- [x] RED/GREEN：page 保留 URL，成为同步 server wrapper（`dynamic = 'force-dynamic'`），默认关闭，显式 true 才传入 enabled。
- [x] 移动原客户端详情实现，不改旧列表功能；在已加载真实项目后挂载 keyed controller，传递 locale/项目/当前用户角色；去掉该页项目加载失败时的模拟项目回退及家庭正文调试日志。
- [x] 新 hub 未开启时不请求新 API。启用时上传/录音按现有角色权限，邀请仅组织者可用；实际服务端仍重新鉴权，不把 UI 角色当安全边界。
- [x] 页面和已有 user-flow / complete-user-journey 测试回归。

```tsx
export const dynamic = 'force-dynamic'
export default function ProjectDetailPage() {
  return <ProjectDetailClient mediaAssetsEnabled={process.env.MEDIA_ASSETS_ENABLED === 'true'} />
}
```

## Task 4：验收与交接

- [x] 独立规格审查，修复后独立质量审查；质量发现修复后两轴增量复审均通过，独立定向 4 套/114 项通过。
- [x] 定向测试 + `npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra`，将本轮输出保存为可提交文本证据。
- [x] 原样运行对应 PG17 切流/P3 验证，新结果移到本轮证据目录；不改变冻结脚本。
- [x] 恢复 `next-env.d.ts` 原字节，`git diff --check`，更新 handoff/索引/本计划，保留本地检查点。明确真实 Storage HTTP、解码 Worker、大包导出、真机和业务质量门的剩余边界。

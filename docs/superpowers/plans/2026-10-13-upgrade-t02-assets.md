# T02 资产身份与完整交付实施计划

日期：2026-10-13（Asia/Taipei）。本计划承接[P1契约 v0.1](../specs/2026-10-13-upgrade-p1-contracts.md)，只覆盖 T02 资产批次。它是本地实现与验证计划，不批准部署、远端迁移或正式素材导入。

## 目标与出口

把当前分散的 `audio_url`、`images`、Storage 路径和故事导出，收敛到可追溯的媒体资产身份。每个资产必须保留项目归属、确切 bucket/key、原始元数据、校验状态和旧地址映射；缺件、归属不明、哈希/字节数不符的对象不得显示为完整交付。

T02 只有在下列证据齐备后才进入少量新写入：

1. 远端迁移历史、基础表字段和 Storage 策略已取得只读证据，并与本地 bootstrap/根迁移逐项对照。
2. 现有对象按 bucket、key、字节数和校验值完成清单；缺件、同 basename 歧义、未知 bucket 和无项目归属单列。
3. 两个不同项目的同名对象、缺件、损坏对象和导出哈希反例有自动化测试。
4. 迁移回退、旧映射保留和暂停新写入的操作记录已写入演练表。

在这些条件满足前，本地测试只能使用虚构对象和测试项目；不能运行生产 SQL，也不能将现有 `stories.audio_url` 解释成已经完成的 `media_assets`。

## 文件边界

### 先写测试

| 行为 | 测试文件 | 首个失败应证明 |
|---|---|---|
| 资产状态、身份和导出 manifest 的纯函数约束 | `packages/web/src/lib/__tests__/media-assets.test.ts` | 同项目唯一性、父子项目一致、`pending/uploaded/verifying/ready/quarantined/deleting/deleted` 转移和安全文件名规则尚不存在 |
| 创建资产、幂等键和项目归属 | `packages/web/src/app/api/media/assets/__tests__/route.test.ts` | 未认证、无项目权限、客户端伪造 bucket/state/hash、重复幂等键均被拒绝 |
| 完整确认与服务端校验 | `packages/web/src/app/api/media/assets/[assetId]/complete/__tests__/route.test.ts` | 缺件、字节数不符、哈希不符、不可解码音频不能进入 `ready` |
| 受控访问 | `packages/web/src/app/api/media/assets/[assetId]/access/__tests__/route.test.ts` | 项目撤权、故事跨项目、已删除/隔离资产和错误 bucket 不产生签名 URL |
| 基础导出资产清单 | `packages/web/src/app/api/projects/[id]/export/__tests__/route.test.ts` | 导出包含 manifest、原始 MIME/字节数/SHA256；缺件时整体失败，不显示 Beta 完整档案 |

测试只 mock Supabase 查询、Storage 元数据和流读取边界；不把 `getSupabaseAdmin` 的 mock 调用次数当作业务结果。每个测试先单独运行确认 RED，再写最小实现。

### 实现文件（schema 确认后）

| 产物 | 文件 | 责任 |
|---|---|---|
| 资产领域 helper | `packages/web/src/lib/media-assets.ts` | 状态转移、幂等键、manifest 条目、原始文件名安全映射；不接受客户端写入的 bucket/state/hash |
| 创建/列出资产 | `packages/web/src/app/api/media/assets/route.ts` | 认证、`requireProjectAccess`、项目绑定、受限上传目标、pending 记录 |
| 完整确认 | `packages/web/src/app/api/media/assets/[assetId]/complete/route.ts` | 重新读取 Storage 元数据、流式 hash/字节数限制、音频可解码检查入口、ready/quarantined 结果 |
| 访问目标 | `packages/web/src/app/api/media/assets/[assetId]/access/route.ts` | 资产真实归属检查后签发短链；删除墓碑和撤权优先 |
| 导出演进 | `packages/web/src/app/api/projects/[id]/export/route.ts` | 读取固定版本的资产清单，加入原件、文本、照片和 manifest；缺件硬失败 |
| 旧地址映射 | `packages/web/src/lib/legacy-media-reference.ts` | 解析已核实 Supabase 主机/桶的旧值；未知、歧义和无时间戳只记录 unresolved |
| 迁移（远端核对后命名） | `supabase/migrations/<next-confirmed-media-assets-migration>.sql` | `media_assets`、`legacy_media_references`、约束、索引和 RLS；不得先于远端历史比较创建 |

## 数据与接口约束

`media_assets` 的最小字段沿用契约：`id`、`project_id`、`created_by`、可选 `story_id`、`bucket`、`object_key`、`kind`、可选 `parent_asset_id`、`mime_type`、`byte_size`、`sha256`、可选 `duration_ms`、`state`、`version`、`original_filename`、时间戳。bucket/key 的组合在确认后不可改写；同一 hash 不能成为跨项目去重或存在性侧信道。

`legacy_media_references` 保存来源表/行/字段、旧字符串、映射状态、asset_id 和核查时间。旧 `stories.audio_url`、`images` JSON、`stories/<basename>` 以及 anonymous 图片必须逐条映射；不能通过 basename 猜测目录，不能把完整 URL 当作可下载授权。

创建接口只接受项目、用途/类型和客户端预期元数据，返回服务端生成的 `assetId` 与受限上传目标。完成接口不接受客户端声称的 state/hash；服务端重新读取对象并确认。访问接口只接受 `assetId`，不再接受任意 bucket/key 作为授权输入。

## 分步执行

1. **只读 schema 对照。** 保存根 bootstrap、根 migrations、生成类型和部署文档的字段/策略表；取得远端历史前不创建迁移文件。若没有凭据，登记为 blocked-by-evidence，不以本地 SQL 代替。
2. **只读对象盘点。** 只记录 bucket、key、大小、更新时间、metadata、哈希和可推断的项目/故事 ID；不读家庭正文。输出总对象数、总字节、缺件和歧义清单。
3. **RED。** 新增上述五组测试，运行：

   ```bash
   npm test --workspace=packages/web -- --runInBand \
     src/lib/__tests__/media-assets.test.ts \
     'src/app/api/media/assets/**/__tests__/*.test.ts' \
     'src/app/api/projects/[id]/export/__tests__/route.test.ts'
   ```

   预期失败原因必须是模块/接口尚未实现，而不是路径或测试配置错误。

4. **GREEN：纯 helper 与路由。** 先实现不依赖新表的验证、manifest 和错误映射；再在 schema 证据通过后加入查询/Storage 实现。资产确认和导出使用固定版本清单，不能 fallback 到 basename 或跨桶搜索。
5. **影子读取。** 在测试项目上同时读取旧字段和资产清单，对比对象数、字节数和 SHA256；只记录差异，不改变故事的批准文本或原件。
6. **少量新写入。** 只使用虚构素材和内部测试项目；先写 `pending`，完成确认后才建立故事关联。任何失败都保留 asset/映射记录，进入 `quarantined` 或 `unresolved`。
7. **回归与出口。** 运行定向测试、`npm run verify`，再运行跨项目隔离、导出哈希和缺件反例。将证据写入 `docs/research/evidence/2026-10-13-t02-assets/`，并更新 P0 计划状态；不部署、不 push、不执行远端迁移。

## 回退与风险

回退顺序固定为：停止新资产创建和新处理 → 保留新增资产及旧映射 → 恢复旧只读故事读取 → 继续拒绝越权访问。不得删除新增原件，不得恢复“上传者前缀即可访问”的旧逻辑，不得把部分迁移回退成无权限校验的路径。

T02 不负责持久 Worker、删除墓碑、录音会话恢复或家庭观察；这些分别由 T05、T03、T04 和 P0 研究完成。T02 的 `ready` 只表示对象完整且归属可核查，不表示 ASR、故事真实性或 G1 通过。

## 验证命令

```bash
npm test --workspace=packages/web -- --runInBand <targeted-files>
npm run type-check
npm run lint
npm run build:vercel
npm run verify
git diff --check
```

完成标准是测试和构建通过、差异清单可解释、导出 manifest 能在另一设备校验原件哈希，并且文档明确区分本地实现、远端 schema 证据和质量门状态。

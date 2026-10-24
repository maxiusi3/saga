# T02 旧媒体来源与 schema 兼容实施计划

> **For agentic workers:** Use superpowers:executing-plans to continue the existing authorized plan, with superpowers:test-driven-development and requesting-code-review for verification. Preserve the current dirty branch; commits/pushes remain conditional on original milestones.

**Goal:** 将实际 stories 旧字段转换成可审阅、逐来源保留的定位候选，修复标准 Supabase URL 解析，并在本地 PostgreSQL 验证 jsonb[]/必填/角色约束兼容。

**Architecture:** 保留现有 resolver 接口，严格解析已核实主机的 Storage URL，原始路径先验证再使用。新增无 I/O 的 stories 投影器，按字段与 JSON pointer 保存每个来源，原件/缩略图/派生音频分开；同一图片的 URL/path 冲突不选边。隔离实验加载实际快照中的相关列类型与约束，使用虚构数据验证读出与映射，不修改远端或自动迁移入口。

**Tech Stack:** TypeScript/Jest，既有 Node22/PostgreSQL14.17/pg8.16.3；不新增依赖。

**Spec:** [P1契约](../specs/2026-10-13-upgrade-p1-contracts.md)、[远端差异](../../research/2026-10-17-remote-metadata-reconciliation.md)、[handoff](../../HANDOFF-2026-10-13-upgrade.md)。

## 约束

- `mapped` 仅表示确切 bucket/key 定位，不能证明存在、归属、hash、可访问或资产 ready；不生成 assetId。
- 没有逐字段 bucket 证据时不推定原始 key 的 bucket；完整URL仅允许已核实主机的标准 Storage 路径。
- 不 trim/decode/归一化路径，不按 basename/跨桶搜索；不抓取 URL，不写 Storage 或旧 stories 行。
- `images` 的 PostgreSQL jsonb[] 与历史 jsonb 包裹数组在驱动层可能都表现为数组；保持元素次序和异常位置，不猜测反序列化字符串。输入 shape 由 schema 证据约束。
- 仅做 stories 媒体字段投影；不扫描正文、metadata 或 interactions 表。旧 images 内保留已知 url/path、thumbUrl/thumbPath，未知形状明确待核。
- 增量草案留在研究文档；完整函数/触发器/ACL、bucket、备份回退及PG17尚缺，不生成可自动部署的根迁移。
- 前批 RLS 复核独立进行，不把其待补状态记为通过。

## Task 1 — 严格地址解析与逐来源投影

Files: 修改 `packages/web/src/lib/legacy-media-reference.ts` 和原测试；新增 `legacy-story-media.ts` 与对应测试。

- [x] 标准 public/sign/authenticated URL、原始key保留与归一化攻击反例先RED。
- [x] 修复 resolver，明确验证host/bucket冲突；签名query不进入返回定位。
- [x] 为多字段、数组顺序/空洞/异常、同图URL/path冲突、缩略图缺原件、重复同名来源写失败测试。
- [x] 实现投影器，逐条保留sourceField/sourcePath/rawValue与定位结果；不修改输入。
- [x] 定向Jest通过，核对现有调用兼容。

## Task 2 — schema fixture 与增量草案

Files: 新增 `experiments/t02-legacy-mapping/verify.cjs` 与 README；证据写入独立日期目录。

- [x] 固定实际快照hash，投影相关列类型/NOT NULL、角色CHECK和双唯一索引到临时Unix socket数据库。
- [x] 实际读取jsonb[]/text[]与兼容历史jsonb，交给真实TS模块，验证原始列未改；title/storyteller缺失、非法角色/状态、重复项目用户应拒绝。
- [x] 保存源码/fixture/运行时指纹、正常与中断清理证据。
- [x] 基于实测写只增不覆盖的映射账本/回填/回退草案，明确证据前置和未实施步骤。

## Task 3 — 审查、完整检查和交接

- [x] T02初审P2已修复实测；10月17日后续[独立增量复核PASS](../../research/evidence/2026-10-17-t02-compatibility/review-followup.md)。原限流状态与初审保留；RLS独立增量复核PASS。
- [x] `npm run verify`、shared、infra；保留并恢复next-env原字节。
- [x] 依赖未改时沿用前批audit证据且说明未重跑；G0/G1缺口保持。
- [x] 更新本批记录、主计划、docs索引与handoff，核对已有文件保留、源码hash、链接和`git diff --check`。
- [x] 仅当原计划里程碑实际达成才推送，本地候选或fixture完成不计新里程碑。

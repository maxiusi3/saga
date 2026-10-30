# 媒体异步边界重新授权 Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development / executing-plans and TDD. Review specification before quality. Preserve the current checkout and frozen experiments, evidence and migrations. Do not push, merge main, migrate remotely or deploy.

**Goal:** 优先修复已有媒体入口在 Storage 等待期间撤权、删除或资产变化后仍返回凭据/确认结果的安全缺口；不是新增产品设计或宣告 P0/G0 已完成。

**Architecture:** 复用现有 `requireProjectAccess` 与真实资产/删除台账，在异步外部操作后重新验证当前授权和资产身份；校验提交前及返回结果前分别检查。共用小型服务器 guard，错误默认拒绝，保持原 HTTP、媒体开关和 no-store 契约。

**Tech Stack:** Next.js route handlers, Supabase JS, TypeScript, Jest.

**Spec:** [P1 已确认契约 §2–5](../specs/2026-10-13-upgrade-p1-contracts.md)与[综合计划 §7.1](../../2026-10-10-integrated-upgrade-plan.md)。延续既定“上传者身份不等于永久访问权”“删除提交阻止新访问/处理”“迟到结果不可重新发布”的要求。

## Global Constraints

- 基线 `f654e8631`，分支 `codex/october-upgrade-p0`，初始工作树干净；沿用当前 checkout，禁止修改既有实验、证据、SQL 迁移或依赖。
- 仅补现有入口的异步检查缺口，不新建上传遥测、代理存储、数据库锁协议或角色产品规则。
- 精确 `MEDIA_ASSETS_ENABLED === 'true'`、身份验证、刷新 cookie 和所有响应 no-store 保持。
- 凭据仅在最终 guard 成功后返回；guard 最后一次删除检查之后不得再 await Storage、日志或其他服务。
- 返回前重检无法撤回已经发给客户端的 signed URL，也不是数据库与 Storage 之间的原子事务；TTL、最后检查后的并发窗口、角色动作权限/直接 Storage RLS 均须诚实列为独立待办，不声称即时全局撤销已证明。
- 校验失败、撤权、墓碑、资产消失或变化、查询失败均不得返回 signedUrl/upload token 或成功资产；错误不得暴露供应商私密错误文本。
- 不操作远端、不处理真实家庭数据、不改变 G0–G4 验收结论；无新里程碑推送条件。

## Task 1: 三个媒体入口的回归与修复

**Files:** 新建 `packages/web/src/lib/server/media-asset-guard.ts` 及相邻测试（若适用）；修改 `packages/web/src/app/api/media/assets/route.ts`、`packages/web/src/app/api/media/assets/[assetId]/access/route.ts`、`packages/web/src/app/api/media/assets/[assetId]/complete/route.ts` 及三份现有 route 测试。

- [x] RED：用 deferred Storage Promise/可变数据库夹具证明签名等待期间撤权、资产/故事删除、资产身份变化与查询失败；涵盖新登记、pending 幂等重放、ready/verifying 无 Storage 重放、回放签名、校验成功与隔离写入。
- [x] 将 RED 原始日志保存到本批新证据目录，确认失败来自仍返回凭据/成功或仍发起写入，而不是夹具/语法错误。
- [x] 实现共享 guard：重新调用项目权限校验；加载当前资产并匹配预期 id/project/story/bucket/object_key/kind/state/version；拒绝墓碑/不可用状态；最后查询资产与故事删除台账，查询失败也拒绝。已执行 CAS 的结果作为返回阶段的新预期记录，不拿初始版本误伤合法更新。
- [x] access：Storage 签名完成后执行最终 guard，拒绝丢弃尚未发布的签名；返回前不增加异步工作。
- [x] registration：新建行后/签名后、pending replay 签名后、无需签名的 replay 返回前均使用当前状态验证；保持幂等契约、非覆盖上传、既有资产不删除和未知失败可重试。最终 guard 之后直接同步响应。
- [x] complete：在 `info` 大小不符分支和真实 stream 验证完成之后、任何 CAS 更新之前重检；CAS 仍带 state/version，并绑定可用身份字段。正式 `media_assets` 表没有 `tombstone_at` 列，禁止添加针对不存在列的过滤；`select('*')` 如返回可选墓碑仍拒绝，权威墓碑检查使用 `deletion_requests`。更新返回后再次检验权限/资产/台账，再返回真实结果。保留原有音频 verifying、图片 ready、失败 quarantined 和状态码；不伪造回滚。
- [x] GREEN：通过全部相关路由/guard、真实 stream verifier、project-hub-client 回归；新测试覆盖合法路径、早期拒绝零 Storage、终检拒绝不泄露 token、查询异常 fail-closed、CAS 冲突、response no-store/cookie。
- [x] 执行 type-check/lint；完成独立规格与质量审查，修复问题并回归。

Run: `npm test --workspace=packages/web -- --runInBand --testPathPatterns='(api/media/assets/|media-asset-guard|media-asset-verifier|project-hub-client)'`。RED 预期非零；GREEN 预期退出 0。

## Task 2: 完整验证与可续接记录

- [x] 执行 `npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra`，保存退出码、原始日志、哈希和实际测试数量；本批没有 SQL 改动，不复跑/覆盖冻结 PG 实验。
- [x] 如构建改变 `packages/web/next-env.d.ts`，只恢复本批运行前保存的原始字节。核对历史保护文件、依赖与 SQL 未变；`git diff --check` 通过。
- [x] 更新报告、新证据索引、handoff、docs/README 和本计划；明确测试为合成 HTTP/Storage 夹具，不证明真实 JWT/RLS/Storage 和原质量门。
- [x] 独立核查实现及本批证据；按本地检查点授权仅提交本批，原里程碑条件推送授权未触发。

## 本批后续

可靠上传尝试采集、部署覆盖证明、实际告警响应人/投递与供应商核验继续独立推进；已签发链接撤回及授权/墓碑的跨事务原子化须单独设计与验收。本批不重做上一批同步导出观测。

# 导出完整性事件 Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development / executing-plans and TDD. Review specification before quality. Preserve the current checkout and all frozen experiments, evidence and migrations. Local checkpoint only; no remote migration, main merge, deployment or unqualified milestone push.

**Goal:** 继续 §11 的导出观测切片：把同步档案组装中的真实完整性失败持久记录，并接入管理告警；不假装已经观测浏览器直传失败或客户端收包结果。

**Architecture:** 服务端在实际组装前持久 start，在组装/压缩后持久终态；记录失败则不继续组装或不返回 ZIP，未知结果保留在数据库供诊断。新增独立表、受限写 RPC 和 v2 只读聚合；保留旧 v1 函数及历史实验。所有写入完成后再执行现有成员/墓碑终检，终检之后不增加 await。

**Tech Stack:** PostgreSQL 17, Supabase JS RPC, Next.js route handler, existing JSZip assembler, Jest, isolated PG17 runtime.

## 范围与取舍

- 基线 `a605fbf1e`，工作树干净。沿用用户无需二次确认、从交接继续实现的授权；不重做已完成数据库观测。
- 选择持久 start/finish，而不是 best-effort 日志（故障时丢失）或资产状态反推（不代表尝试/完整性）。先完成现有同步导出这一独立来源，不同时扩张直传协议、Worker、自动通知或供应商账户操作。
- 观测 scope 固定 `synchronous_archive_assembly`。`verified` 仅证明服务端媒体校验与组装/压缩完成，不证明最终授权仍有效、HTTP 到达或客户端 ZIP 校验成功。现有权限、删除、容量及来源预检拒绝不属于组装尝试。
- start 在全部预检通过之后、读取 Storage/组装之前；finish 在组装/压缩之后、最终成员/墓碑检查之前。finish 网络失败/未知时返回 503，不发 ZIP；数据库里的 started 或已提交终态保持真实。绝不在最终墓碑检查后 await 观测写入。
- 只记录随机服务端 attempt UUID、有限状态及数据库时间，不存项目/用户 ID、对象路径、标题、正文、错误消息或 ZIP。无客户端提交的事件时间或成功声明。事件不承诺覆盖旧客户端/其他导出通道。
- SHA-256/实际字节数不符为 `integrity_failed`；限额、取消、Storage/代码/压缩异常分别记录 `limit_exceeded` / `cancelled` / `failed`，不得全部算完整性损坏。
- 60 分钟按终态时间统计完整性失败；所有尚未终态的事件计 unsettled，包括跨窗悬挂。首小时覆盖不足与未终态均显式 incomplete；仍可按已知损坏下界报警。坏事件使导出组不可用，不将坏数据转零。
- 上传事件源、告警实际响应人/投递、供应商资格仍未接通，顶层始终 503/not_ready。没有新原 G0–G4 验收证明。

## Task 1：持久账本、RPC 与 PG17

**Files:** 新建 `supabase/migrations/20261029000002_export_observations.sql`、`experiments/pg17-export-observations/{verify.mjs,README.md}`；更新 `scripts/__tests__/deployment-config.test.js`。

- [x] RED：新独立 PG17 实验先证明缺 RPC，保存 JSON 和原始终端日志。使用旧 P1 精确 CREATE TABLE 块、旧 v1 迁移和合成前置表；不编辑旧文件。
- [x] 新建 `archive_assembly_attempts`：id UUID、state、started_at、finished_at；状态为 started/verified/integrity_failed/failed/cancelled/limit_exceeded。非空与时间/状态组合约束，防止删除、改 ID/开始时间、重写终态。开启 RLS，客户端及 service_role 无直接 DML，service_role 可 SELECT。
- [x] 新建单行 coverage epoch，首次迁移记录数据库 statement_timestamp，重复迁移不重置；只读对 service_role，禁止客户端访问。
- [x] `begin_archive_assembly_attempt(p_attempt_id uuid)` 和 `finish_archive_assembly_attempt(p_attempt_id uuid,p_outcome text)`：固定 search_path、SECURITY DEFINER，PUBLIC/anon/authenticated EXECUTE 撤销，只授 service_role。开始与相同终态可幂等重放；不同终态、无 start 的 finish、非法 ID/状态均拒绝。实际行锁保证竞争只产生一个终态；不信任 role claim。
- [x] 写回执精确 `{schemaVersion:1,attemptId:string,state:string}`；时间均来自 DB；begin 已结束 ID 返回真实终态，不重开。SQL 不接收任何私密文本/家庭标识。
- [x] `read_operational_snapshot_v2()`：SQL STABLE / SECURITY INVOKER / 固定 search_path，无参数；在单条语句组合旧 v1 + 新 exports 字段，覆盖 schemaVersion=2。v1 保持原形状和权限。

```ts
exports: {
  scope: 'synchronous_archive_assembly'; windowMinutes: 60
  coverageStartedAt: string; windowComplete: boolean
  integrityFailuresCount: number; unsettledAttemptsCount: number; invalidAttemptsCount: number
}
```

- [x] 精确窗口规则：`finished_at >= observedAt - interval '60 minutes'`（包含边界），坏/未来/非有限/倒序时间和非法状态计 invalid；started 全局计 unsettled；epoch 缺失/坏时间不能生成有效快照。`windowComplete` 仅当 epoch 至少 60 分钟，重复迁移/时区不改变覆盖。
- [x] PG 覆盖正常/污染环境、真实角色+伪造 claim、直接 DML 拒绝、真实并发幂等/冲突、旧 v1 兼容、只读/快照与时间窗、未知/坏数据、无正文输出、恢复清理。`await h.cleanup()` 不覆盖报告字段。infra 清单排序且测试通过。

## Task 2：受限 RPC 适配与 v2 告警

**Files:** 新建 `lib/server/operational-rpc.ts`、`archive-observations.ts` 与测试；修改 `operational-snapshot.ts`、相关测试和 `cutover-readiness.ts` 的 unavailable 指标类型。所有 lib 路径均位于 `packages/web/src/`。

- [x] RED：写回执额外键、错 ID/状态、错误/异常、超时、取消不得假成功；每次单 RPC 且禁自动重试。迁移缺失不得 fallback 直接写表。
- [x] 提取已有 5 秒 deadline/AbortSignal/固定错误分类至小型共享 RPC helper，保留原 loader 测试。start 使用 caller signal，finish 不继承已取消的 HTTP signal，以有界独立请求记录结果。
- [x] loader 改为单次 v2 RPC；严格白名单校验新增字段，schemaVersion=2、scope/window 固定、epoch 为 UTC/offset 时间且不晚于 observedAt，windowComplete 与真实时间差一致。保留原安全整数、新鲜度、隐私及无重试约束。
- [x] `failedExportsCount` 取实际 integrityFailuresCount；invalid>0 时导出组 unavailable；未满窗口/未终态加 `export_observation_window` / `export_outcome_completeness`，保留已知损坏告警。上传仍 null、顶层 not_ready，来源范围在 snapshot 中明确。
- [x] 管理路由测试改用 v2 并覆盖真实导出告警/不完整窗口；供应商和鉴权不变。

## Task 3：导出路径可靠埋点

**Files:** `packages/web/src/lib/server/media-export.ts` 及测试，`packages/web/src/app/api/projects/[id]/export/{route.ts,__tests__/route.test.ts}`。

- [x] RED：start 失败零 Storage 读取；finish 失败不返回 ZIP；真实校验不符与普通错误区分；禁止开关/权限预检失败写事件；并发取消/等待 finish 时删除或撤权仍阻断 ZIP。
- [x] 媒体校验抛有限类型 `MediaExportIntegrityError`，仅实际大小/SHA 不符触发；流式超出预期字节也用同类。禁止用错误文案模糊匹配分类。
- [x] 预检后 server randomUUID/start；组装与压缩后按真实结果 finish；有界写失败均 503。保持既有容量/来源/权限/墓碑边界，不做额外家庭数据传输。
- [x] `verified` 写完后重新检查成员与墓碑；最后墓碑检查后无 await。响应前再次检查取消，但不新增异步事件；事件代表组装不是交付。
- [x] 既有真实 assembler/ZIP 与 source-safe 导出测试全部回归，不以纯 mock 替代媒体校验。

## Task 4：审查、证据与本地收口

- [x] 独立规格审查，然后质量审查；发现先 RED 再修复并复审。
- [x] 正常/污染 PG17 与主流程复跑 passed，执行 `npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra`，原始日志先落盘再保留 gzip/哈希。
- [x] 按授权恢复 next-env；所有旧实验/迁移/证据/依赖字节不变，staged 与 unstaged diff check 通过。
- [x] 更新 handoff、docs/README、结果报告与本计划；证据独立核验后仅本地提交。明确上传事件、投递/资格和真实验收仍待完成，不触发里程碑推送。

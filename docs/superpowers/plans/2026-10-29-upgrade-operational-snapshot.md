# 数据库运营指标接入 Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development / executing-plans and TDD. Review specification before quality; preserve this checkout and all frozen experiments. No remote migration, deployment, main merge or conditional milestone push.

**Goal:** 执行 handoff 下一个工程项的数据库部分：把已有 P1 任务、成本、删除台账的实际聚合接入 §11 管理诊断，停止只有固定 unavailable 的占位响应。

**Architecture:** 一个只读、service_role 专用、单语句快照 RPC 在数据库内聚合，不把家庭正文、对象地址或项目列表送入应用。TypeScript 适配器验证版本、时间和数值并设置请求截止；现有管理接口展示部分指标及告警，缺失的覆盖项仍不可用，整体仍 not_ready。

**Tech Stack:** PostgreSQL 17, Supabase JS RPC, Next.js route handler, Jest, existing isolated PG17 runtime.

## 已确认范围与取舍

- 基线 `287b32c5a`，工作树干净。沿用主计划 §5.3 / §11 和 handoff 指定的顺序，不重做双入口。
- 先交付一个可独立验收的数据库观测切片，不把供应商核验、告警投递、上传/导出事件采集一并扩张为大子项目。相比逐页拉取业务行，聚合 RPC 无分页截断、跨查询时差和隐私正文传输。
- 只新增本地迁移与新实验目录，不改任何旧迁移/实验。infra 迁移清单同步。未执行远端迁移时该 RPC 不存在，路由保持明确 unavailable。
- 任务指标包含到期可运行 queued/retry_wait 的积压年龄，leased/running 缺少或过期租约及 outcome_unknown 的停滞数；跨天 awaiting_review 不当故障，未来 not_before 不算当前积压。
- 成本是持久台账“已知敞口”，不是供应商账单证明：终态尝试取 settled，running/outcome_unknown 取 reserved 与 settled 的较大值，包含失败/取消的已结算费用，不双加同一次尝试。缺失/负数/NaN/Infinity 的应有金额计 unknown，不转成零证据；按项目累计后向上取整到分，再取全项目最大值。不返回项目 ID。
- 删除只统计 requested/processing/failed 且 requested_at 超过 7 天，completed 不计。异常时间/状态使对应组不可用，不用无数据制造 healthy。
- 上传失败率和导出完整性失败计数没有可靠事件源，本批仍 unavailable，不能由媒体资产状态推算尝试分母。供应商探针保持 blocked_by_policy，告警响应人未确认仍 unavailable；不新增外部调用或自动通知。

## Task 1：只读聚合 RPC 与真实 PG17 回归

**Files:** 新建 `supabase/migrations/20261029000001_operational_snapshot.sql`、`experiments/pg17-operational-snapshot/{verify.mjs,README.md}`；修改 `scripts/__tests__/deployment-config.test.js`。

- [x] RED：先在独立 PG17 写测试，缺迁移/RPC 应失败并保存证据。基于正式 P1 表结构验证真实 SELECT，而不是 JS 重写算法。
- [x] GREEN：新增 `public.read_operational_snapshot()`，SQL STABLE / SECURITY INVOKER / 固定 search_path，只读聚合；撤销 PUBLIC/anon/authenticated EXECUTE，只授予 service_role，不依赖客户端 role claim。
- [x] RPC 契约固定为以下形状；时间由数据库 statement_timestamp 生成，不接受客户端伪造观测时间：

```ts
type Snapshot = {
  schemaVersion: 1; observedAt: string
  processing: { stalledJobsCount: number; maxRunnableBacklogAgeSeconds: number; invalidJobCount: number }
  costs: { maxProjectKnownExposureCents: number; unknownAttemptCostsCount: number }
  deletions: { overdueRequestsCount: number; invalidRequestCount: number }
}
```

- [x] PG 场景：空表真实零值、到期/延迟任务、过期/无租约/outcome_unknown、人工等待不误报；多项目/失败费用/未知费用/微额向上取整；删除 7 天边界；无正文输出；真实 anon/authenticated（包括伪造 service role claim）拒绝；service_role 可读；迁移二次应用与固定权限；坏时间/金额失败关闭。
- [x] 保留 runner cleanup 结果（只 `await h.cleanup()`，不把 undefined 赋回报告），核对 socket/PID/目录清理；正常和宿主 PG 环境污染各一次。
- [x] 按字典序加入新迁移文件名并运行 `npm run test:infra`。

## Task 2：严格适配器与部分覆盖告警

**Files:** 新建 `packages/web/src/lib/server/operational-snapshot.ts` 与 `__tests__/operational-snapshot.test.ts`；修改 `cutover-readiness.ts` / 对应测试，仅支持明确不可用的指标。

- [x] RED：缺 schema 版本、额外正文键、空值/负数/非有限数/不安全整数、过期或未来 observedAt、超时/中止/RPC错误不能变成 healthy；合法快照可见实际数值。
- [x] GREEN：单次 `rpc('read_operational_snapshot')`，使用 AbortSignal 与 5 秒应用截止，不自动重试；错误只返回固定分类，缺配置/迁移/权限时 unavailable，不回退读取业务全集。
- [x] 严格 allowlist 重建输出；快照只接受最近 60 秒、未来偏差最多 5 秒，所有计数/金额为非负安全整数。DB 数据错误时整份 unavailable。
- [x] 运营报告明确 `coverage: partial`；已有告警阈值按可用指标评估，缺失上传/导出指标不传虚构零值。成本预算从服务器 `OPERATIONAL_PROJECT_COST_CAP_CENTS` 读取，未配置时成本告警不可用，不凭空指定业务预算。
- [x] 已知敞口可显示，但 unknown 成本计数大于零时不声称成本完整；异常任务/删除时间对所属指标组失败关闭，其他有效组仍可报警。

## Task 3：管理路由接线

**Files:** `packages/web/src/app/api/admin/cutover-readiness/{route.ts,__tests__/route.test.ts}`。

- [x] RED/GREEN：精确 `MEDIA_ASSETS_ENABLED === 'true'` 与服务器 `ADMIN_CRON_SECRET` 检查在 RPC 前；无授权/缺配置/关闭均零 DB 请求，所有响应 no-store。
- [x] 通过授权后调用适配器；合法快照输出部分实测告警而不是全零 healthy。顶层始终 `status: not_ready` / HTTP 503，并列明缺失覆盖项与告警投递/响应人未确认。
- [x] 保留现有供应商阻断，配置 key 不改变 policy；不把有效 SQL 数据等同生产切流批准。

## Task 4：验证、证据与本地检查点

- [x] 独立规格、质量审查，发现先 RED 后修复并复审。
- [x] 执行 `node experiments/pg17-operational-snapshot/verify.mjs`，将正常/污染结果放入 `docs/research/evidence/2026-10-29-operational-snapshot/`。
- [x] 执行 `npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra`，保存原始日志/哈希；恢复 next-env 原字节，包含新增文件的 staged diff check 必须通过。
- [x] 更新 handoff、docs/README、结果报告和本计划；本地提交，明确剩余上传/导出采集、实际响应人/投递和供应商资格链，原 G0–G4 未获新证明，不推送/部署/远端迁移。

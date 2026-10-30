# 浏览器音频上传观测 Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development / executing-plans and TDD; specification review before quality. Keep current checkout. Preserve all older experiments, evidence, migrations and dependencies. Local checkpoint only unless the original milestone is actually proven; no remote migration, main merge or deployment.

**Goal:** 实施综合升级计划 §11 及当前 handoff 的可靠上传观测：在现有项目中心音频 PUT 前登记、客户端得到结果后持久回报，保留未知状态，接入有明确来源范围的运营指标。

**Architecture:** 增量不可改终态账本 + service_role RPC；经现有身份/媒体 guard 的 begin/finish HTTP；浏览器先 begin、再非覆盖 PUT、再独立限时 finish、最后沿用服务端 complete。单个 ledger 仅保存随机 ID、报告凭证绑定 hash、有限状态和数据库时间，不存家庭/用户/资产标识或正文。v3 只读快照组合旧 v2。

**Tech Stack:** PostgreSQL 17.4, Supabase JS, Next.js route handlers, TypeScript, Jest, existing isolated PG harness.

**Spec:** [已确认综合计划 §11](../../2026-10-10-integrated-upgrade-plan.md)、[P1 资产/权限契约 §2–5](../specs/2026-10-13-upgrade-p1-contracts.md)、[当前 handoff](../../HANDOFF-2026-10-13-upgrade.md)。继续既定观测任务，不扩张产品路线。

## Global Constraints / 数据契约

- 基线 `d13d55ab0`，初始工作树干净；分支 `codex/october-upgrade-p0`。不改旧迁移、旧实验、旧证据、依赖、功能开关语义或资产校验标准。
- 仅覆盖 `importProjectAudio` 的 `pending_upload` 非覆盖 PUT；ready/verifying/uploaded 跳过 PUT 的重放不捏造新尝试。没有全站/旧客户端/录音分块覆盖证明。
- scope 固定 `project_hub_audio_put_reports`。结果为 `client_succeeded`、`client_failed`、`client_conflict`、`client_cancelled`；只是客户端观察，不证明存储接收、hash/解码、最终权限或保存成功。错误响应可能在实际已上传后发生，不推断对象不存在。
- begin 发生在 PUT 前，开始回执未知时绝不 PUT；begin 与 PUT 之间崩溃只能记为 unsettled，不能算实际已发 PUT。finish 确认后才继续原 complete；失败/未知保留 File 和幂等键供显式重试，不把观测故障吞掉或改变资产状态。
- 客户端回报不可信且仅属诊断，不能授权、修改资产或通过 G0–G4。取消不污染正常失败率；409/明确旧重复错误为 conflict，不当成新对象成功。没有观测时不得用资产状态反推上传尝试。
- 报告凭证：server `randomUUID()` + `randomBytes(32).toString('base64url')`；凭证只随 begin 返回且只在内存持有。server 计算 `sha256(JSON.stringify([loadedAsset.id, auth.user.id, reportToken]))` 存储为 `binding_hash`；finish 重新计算校验，不能跨用户/资产使用。token 必须是 43 字符 base64url，hash 为 64 字符小写 hex。不写入日志/localStorage，不新增环境密钥，也不向数据库存原始 token/身份/路径。
- 所有 DB writer 回执精确 `{schemaVersion:1,attemptId,state}`；begin 只能确认 started，finish 只能确认所请求终态；拒绝多键/错 ID/错状态/异常/超时。每次单 RPC，复用 5 秒截止且禁重试；未知写入不自动重放。
- 新 HTTP 路由保持精确媒体开关、服务端身份、当前项目权限/资产/墓碑 guard、刷新 cookie 与 no-store。媒体读取使用真实已实现 schema，禁止假设资产有 tombstone_at 列。不增强为跨查询原子撤权，签名 TTL 仍不在本批解决。
- begin/finish HTTP 响应仅有限结构，错误不反射提供方信息。finish 只是持久回报，不替代原 complete。实际告警投递/响应人、供应商条件和部署覆盖仍 unavailable，管理顶层继续 `503 not_ready`。

## Task 1: 持久账本、v3 聚合与独立 PG 验证

**Files:** 新建 `supabase/migrations/20261030000001_upload_observations.sql`、`experiments/pg17-upload-observations/{verify.mjs,README.md}`；更新 `scripts/__tests__/deployment-config.test.js` 中排序迁移清单。

- [x] RED：新 runner 先在没有新迁移的 PG17 上验证缺少新 RPC，保存非零退出及 JSON。复用旧 harness/精确 P1 四表 DDL + 已有 v1/v2 迁移，不改旧文件，不宣称完整迁移链。
- [x] 创建 `browser_upload_attempts(id uuid PK,binding_hash text,state text,started_at timestamptz,finished_at timestamptz)`；状态含 started 与四种 client_* 终态，有限/顺序时间检查。防止改 id/hash/started_at、删除和终态覆盖。RLS 开启，客户端和 service_role 无直接 DML，service_role 只读；创建幂等 `upload_observation_coverage` singleton epoch。
- [x] `begin_browser_upload_attempt(p_attempt_id uuid,p_binding_hash text)`：相同 id/hash 幂等；不同 hash 拒绝；返回真实状态不重开终态。`finish_browser_upload_attempt(p_attempt_id uuid,p_binding_hash text,p_outcome text)`：行锁串行，匹配 hash 才可写；相同终态幂等，不同终态/无 start/非法输入拒绝。两函数 SECURITY DEFINER/固定 search_path，只授 service_role EXECUTE，PUBLIC/anon/authenticated 撤销。
- [x] `read_operational_snapshot_v3()`：STABLE/SECURITY INVOKER/固定 search_path，无参数；同一 statement_timestamp 组合 v2 及下列 uploads。旧函数形状/权限不改；无标识/token/hash/家庭正文输出。

```ts
uploads: {
  scope: 'project_hub_audio_put_reports'; windowMinutes: 60;
  coverageStartedAt: string; windowComplete: boolean;
  evaluatedAttemptsCount: number; reportedFailuresCount: number;
  reportedCancellationsCount: number; unsettledAttemptsCount: number;
  invalidAttemptsCount: number;
}
```

- [x] 60 分钟按 finished_at（包含精确边界）统计；evaluated 为 succeeded/failed/conflict，不含 cancelled；failures 仅 failed；cancelled 单列；所有有效 started 全局计 unsettled。坏/未来/无穷/倒序时间、非法状态/hash 计 invalid，不伪造零。epoch 缺失/非法不能生成有效覆盖；重复迁移不重置 epoch；窗口满仅证明账本年龄。
- [x] PG 覆盖真实登录角色/伪造 claim、直接写拒绝、回执/数据最小化、并发幂等与冲突、绑定错误、旧 v1/v2 兼容、边界与污染数据、只读、epoch 重放、清理。正常与 PG*/DATABASE_URL 污染环境均跑；临时 socket/PID/目录全部清理并核对。保存 runner/迁移来源 hash 和原始日志。
- [x] infra 通过；独立规格审查再质量审查，无未处理阻断项。

## Task 2: HTTP/客户端闭环与 v3 运营接线

**Files:** 新建 `packages/web/src/lib/server/upload-observations.ts` 与测试、`packages/web/src/app/api/media/assets/[assetId]/upload-attempts/route.ts` 与测试；修改 `lib/server/operational-rpc.ts`、`operational-snapshot.ts`、`cutover-readiness.ts`、`lib/project-hub-client.ts` 及对应测试与 admin route 测试。全部 lib 路径相对 `packages/web/src/`；小型浏览器观测 helper 可独立为 `lib/upload-observation-client.ts` 并测试，避免复制认证逻辑。

- [x] RED：RPC 严格回执/未知/截止/无重试；HTTP 授权/绑定/数据白名单；真实客户端调用顺序、begin 失败零 PUT、finish 失败零 complete、异常/取消/冲突、重试与同一文件/key；v3 解析及告警来源/不完整性。
- [x] adapter 使用真实 SQL 参数。HTTP `POST /api/media/assets/[assetId]/upload-attempts` 仅两种精确请求：`{action:'begin'}` 或 `{action:'finish',attemptId,reportToken,outcome}`，不接收用户/资产/时间/路径/错误文本；只处理 original_audio。begin 仅 pending_upload；finish 可在 pending_upload/uploaded/verifying/ready/quarantined 状态回报，但删除/无权限拒绝。
- [x] HTTP 真实 auth→加载资产→媒体 guard→一次 RPC→最终媒体 guard→同步响应；begin 用 request.signal，finish RPC 独立截止以保留已取消回报。begin 200 `{schemaVersion:1,attemptId,reportToken,state:'started'}`；finish 200 精确写回执。非法 JSON/结构 400、禁用 404、无权沿用 guard、数据库/未知回执 503。不修改媒体表，也不返回签名 URL。
- [x] 客户端 begin/finish JSON 严格校验（UUID、43 字符凭证、schema/精确键/回执 ID/状态）。观测 HTTP 整体含 token获取/fetch/body 有 20 秒 deadline（并处理忽略 abort 的 Promise）；begin 继承 caller abort，finish 独立信号。无重试、late rejection 不泄漏。
- [x] pending PUT 顺序：begin 确认→检查取消→SDK 非覆盖上传→记录实际 SDK 结果→独立 finish→再次检查 caller abort→原 complete。begin 后 PUT 前取消报 client_cancelled；SDK 正常/明确重复/失败对应 succeeded/conflict/failed，SDK 抛 AbortError 为 cancelled。若 caller 在不可取消 SDK PUT 中取消但 SDK 成功，仍报 client_succeeded，之后取消业务后续；不得凭 caller abort 把已成功 SDK 响应改作失败。已知 SDK 错误只能在 finish 确认后传播；回执未知优先返回安全观测失败。跳过 PUT 的资产不写观测。
- [x] v3 loader 保留 v2 exports 验证，严格上传字段、整数、failures<=evaluated、时间/微秒/新鲜度/epoch 一致性；无 fallback。invalid/窗口未满/unsettled 时上传率 unavailable，不把局部完成分母冒充全部结果；取消单列不进入分母。有效窗口使用现有告警阈值，文案明确 `Client-reported` 来源。
- [x] 始终加入 `upload_collection_coverage` 缺口，因为没有部署覆盖证明；按情况补 `upload_observation_window` / `upload_outcome_completeness`，重算 coverage/status（保留真实告警优先级），避免向 unavailableMetrics 追加后仍称 healthy/complete。admin 仍 503/not_ready；供应商/实际投递不变。
- [x] 定向 Jest、type-check/lint，通过独立规格与质量审查。前批媒体重新授权、导出和项目中心组件回归保留。

## Task 3: 验证、交接与里程碑判定

- [x] 主流程复跑新 PG runner，确认源码 hash 和清理；执行 `npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra`，保留完整原始日志与退出码。
- [x] 恢复构建产生的 next-env 原字节；核对所有旧实验/迁移/证据/依赖不变；staged/unstaged diff check 通过。
- [x] 更新本计划、研究报告、证据索引、docs/README、handoff；保存源码/原始日志 hash 和独立审查结果。
- [x] 按综合计划 §7.1 原 G0–G4 逐项判断，不把合成 PG/Jest、账本 epoch 或本地修复当成真实账户/迁移/用户验收；如满足用户本轮“里程碑完成 P0 修复”条件才 push origin codex/october-upgrade-p0，否则只本地提交并明确缺口。禁止 main 合并、远端迁移/部署或外发真实家庭资料。

## 执行结果

2026-10-30 本地批次完成。Task 1 原始实现与审查保留，runner 仅修正一个多余 EOF 换行并重跑正常/污染 PG 各 14/631；Task 2 唯一规格 P2 已修正，规格复审 PASS、质量 Approved；独立整批收口 PASS。最终 Web 135/2065、shared 4/16、infra 7、184 页通过，1471 项历史保护输入未变。原始 RED、初次冻结与修正版分开留存，详见[验证汇总](../../research/evidence/2026-10-30-upload-observations/verification.json)。原 G0–G4/P0 完成未新增完整证明，仅本地检查点，不触发条件推送。

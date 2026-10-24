# 邀请 HTTP 身份、接受与状态恢复适配

2026-10-18（Asia/Taipei）。两个旧接受 HTTP 入口、只读状态入口及 facade 接受调用已完成本地实现。Task 1 初审的 Jest fixture 发现问题 I1 已修复并独立复核为 **Spec PASS / Approved**；本批完整项目验证通过。Task 2 独立审查及整批复审已通过，M1措辞修正经限定复核确认；本批本地实现、验证、审查与最终完整性收尾已完成。见[实施计划](../superpowers/plans/2026-10-18-upgrade-invitation-http-adapter.md)、[绑定规格](../superpowers/specs/2026-10-18-invitation-http-adapter.md)和[证据汇总](evidence/2026-10-18-invitation-http-adapter/verification.json)。

## 当前行为与兼容影响

| 入口 | 本地实现 |
| --- | --- |
| `POST /api/invitations/accept` | 严格 JSON 输入，共享接受适配层 |
| `POST /api/invitations/[token]/accept` | 使用 Next 已解码一次的 path token，共享接受适配层，不消费 body 身份 |
| `POST /api/invitations/status` | 严格 JSON 输入，只读状态，不执行 accept/send/release |
| `api-supabase.ts` 的 `invitations.accept` | 取得当前 session access token，经共享 HTTP helper 接受；保留 ApiClient 的 data 包装和成功结果中的 `project_id` / `role` |

只有 `INVITATION_TRANSACTIONS_ENABLED` 的精确值 `true` 启用流程；默认及其他值均返回安全 JSON **503**，在读取认证配置、创建 client、网络或数据库调用之前退出。两个旧 HTTP handler 已被替换，关闭时不会退回原接受写路径。本批未启用生产开关，也未修改环境或配置文件。

启用后的调用必须显式携带有效 Bearer，并使用规范 `v1_` 加 32 位小写十六进制 token；不 trim、改大小写、二次解码或尝试其他 token。历史 opaque token 与 Cookie-only 接受不可用；同时带 Cookie 也只采用 Bearer，Bearer 失败不切换身份。JSON body 仅允许 token 及可选 UUID `user_id`，后者只与已验证身份比较，不授予权限。发送、旧 GET/verify/check-pending、其他直接 RPC/表路径及历史成员映射仍需后续处理，不能将本批当作全部旧客户端兼容或生产权限关闭。

每请求独立的 Supabase JS 2.105.3 client 只使用公开 URL / anon key，关闭 session 持久化、自动刷新及 URL session 检测。先调用 `auth.getUser(bearer)`，只接受提供方顶层的 UUID、有效邮箱与确认时间，metadata/self-asserted 邮箱无效。相同 client 和 Authorization 随后执行 `invitation_candidate.status({ p_token })`，验证恰一行及 token、项目、角色、状态、成员/身份字段后，最多执行一次 `invitation_candidate.accept({ token })`。

status 预读只建立返回一致性期望。即使预读已 accepted，也必须取得最终 `already_accepted` 结果；只有完整、有效且与预读及已验证身份一致的最终 accept 行可返回成功，不借预读补字段。响应仅复制允许字段，不回传 token、Bearer、邮箱、原始提供方错误或私有定义；所有响应设置 `Cache-Control: no-store` 与 `Vary: Authorization`。

一个十秒截止及 caller abort 覆盖认证、RPC 响应头与 body 读取，RPC 显式 `retry(false)`，所有退出清理计时器和监听。已识别 SQL 拒绝映射安全 400/403/409；尚未发出 accept 的失败不会冒称写入未知。accept 发出后丢响应、超时、未知错误或返回结构不符均为非 2xx、`outcome=unknown`。客户端 helper 拒绝畸形 2xx，不自动重试或自动恢复；后续由调用方显式调用独立 status helper。该查询只读，pending/declined/expired 不代表接受成功。

## 实际验证与失败保留

Task 1 先对两个真实旧 handler 留下业务 RED：开关缺省时预期 503/零外调，实际各返回 401 并调用一次 Cookie Auth 边界。该 RED 仅替代外部认证边界，不称为 SDK 运输验证；见[旧入口 RED](evidence/2026-10-18-invitation-http-adapter/task-1-old-handler-red.json)。解析器/实现 stub、fixture 关闭时序及合成提供方响应头等中间失败保留在[RED/GREEN 账本](evidence/2026-10-18-invitation-http-adapter/task-1-red-green-ledger.json)。

真实 handler 与实际 Supabase SDK 通过本地 loopback HTTP fixture 验证了认证→status→accept 顺序、相同 Bearer、anon apikey、schema profile、精确参数与调用次数，以及拒绝、丢连接、abort、跨阶段截止和清理。fixture 返回合成 Auth/REST 数据；这证明本地 SDK 到 HTTP 的交互，**不证明真实 Auth/JWT、PostgREST schema 暴露、PG17 事务集成或生产授权**。此前 PG17 事务实验是独立证据，不能与本批合成为已完成的端到端集成。

首次完整 `npm run verify` 真实失败：960 项断言通过，但 fixture 位于 `__tests__`，被 Jest 作为空测试套件收集，流程在构建/shared/infra 前停止。[失败执行](evidence/2026-10-18-invitation-http-adapter/project-checks-20261018T133506.json)及[初审 Spec FAIL / Needs fixes](evidence/2026-10-18-invitation-http-adapter/task-1-review.md)原样保留。Fix 1 将 fixture 移至 `packages/web/src/lib/server/test-support/invitation-fixture.ts`，仅改三处测试 import；fixture 内容、七份生产文件、断言和依赖未改。

| 最终检查 | 执行者与结果 |
| --- | --- |
| 三套定向 Jest，含 open-handle 检查 | Task 1 实现子代理：77 protocol + 29 client/facade + 88 handler = **194/194**；无 open-handle warning |
| Jest discovery、web type-check、11 文件 scoped lint | Task 1 实现子代理：均退出 0；fixture 不再被收集，三套测试仍被收集 |
| `npm run verify` | 控制器：退出 0，Web **80 套 / 960 项**，类型/lint及 **176 页**构建通过 |
| shared / infra | 控制器：分别 **4 套 / 16 项**、**7 项**，均退出 0 |

最终 11 文件源摘要为 `690149536961419859643d1e5348866856edec38311e6a4844688d997481fa9e`，以[Fix 1 manifest](evidence/2026-10-18-invitation-http-adapter/task-1-fix-1-source-manifest.json)为准；较早 manifest 是不可改写的历史输入。[定向证据](evidence/2026-10-18-invitation-http-adapter/task-1-fix-1-focused-checks.json)记录命令、执行归属、时间和私有原始输出摘要。控制器于 **21:42:20—21:44:30 Asia/Taipei** 重新执行完整项目矩阵，715 个应用输入未变，next-env 恢复起点字节；[canonical project-checks](evidence/2026-10-18-invitation-http-adapter/project-checks.json)同时绑定成功执行及失败前件，本批未复用旧 707 输入的运行当通过。

[Fix 1 独立复审](evidence/2026-10-18-invitation-http-adapter/task-1-fix-1-review.md)判定 **I1 ADDRESSED / Task 1 Spec PASS / Approved**，无新增发现。应用 source/logs 与旧实验的完整性预检通过：1,604 个起点文件、715 应用输入、838 项旧 PG 实验/依赖/运行时/证据、11 个最终 Task 1 文件、10 个不可变 Task 1 证据及 18 个 mode 0600 原始日志引用；详见[文档前预检](evidence/2026-10-18-invitation-http-adapter/integrity-pre-docs.json)。这是写文档前的检查，文件数和链接数会随文档变化，不能当最终完整性收尾。旧 PG 矩阵未重跑，仅核对冻结哈希。

构建仍提示缺少 `SUPABASE_SERVICE_ROLE_KEY` 和旧 Next `eslint` / `images.domains` 配置；退出 0 不代表生产配置可用。依赖未改，audit 未重跑，原 **42 项（34 high / 8 moderate / 0 critical）**仍未解决。

## 后续与里程碑

本批收尾已完成，下一步推进可信服务端权益事件/来源的供给、撤销和持久去重；处理发送、旧读取、直接 RPC/表授权旁路及历史 token/member 的可信映射、前向迁移和回退。生产候选 schema/PostgREST 暴露、Auth/RLS/ACL、正式恢复 UI 与集成仍需单独验收。

原 G0/G1 还要求迁移历史等价、bucket 配置、备份恢复/回退、供应商账户条件、正式资产/Storage/删除/Worker adapter、跨家庭反例及真机 5/20/30 分钟矩阵；[质量门判定](evidence/2026-10-18-invitation-http-adapter/milestone-check.json)仍为未达成。本地 HTTP 批不是原计划里程碑，D01–D16 与商品决策保持。保留 `codex/october-upgrade-p0`、HEAD `1caa21a72` 的未提交工作和忽略恢复数据；没有提交、推送、合并、远端认证/付款/邮件/家庭数据调用、迁移或部署。

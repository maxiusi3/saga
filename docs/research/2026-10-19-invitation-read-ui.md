# 邀请只读兼容与接受恢复页面

2026-10-19（Asia/Taipei）。本批已完成本地实现、I1 修复及 Task 1 独立复审，固定源码后的完整项目验证通过；**Task 2文档独立审查、整批独立审查及最终完整性均已通过**。以[验证汇总](evidence/2026-10-19-invitation-read-ui/verification.json)、[实施计划](../superpowers/plans/2026-10-19-upgrade-invitation-read-ui.md)和[绑定规格](../superpowers/specs/2026-10-19-invitation-read-ui.md)为准。G0/G1 仍未达到，生产开关保持关闭，无提交或推送。

## 已实现的兼容与恢复行为

| 入口 | 当前本地行为 |
| --- | --- |
| `GET /api/invitations/[token]`、`GET /api/invitations/verify?token=...` | 复用原只读 status adapter；仅精确开关 `true` 启用，其余值在配置/client/网络前返回安全 503。启用后同一实际 SDK client 验证 Bearer，再执行一次只读 status RPC |
| `GET /api/invitations/check-pending` | 所有开关值均为 503、`success:false,outcome:not_attempted`；不创建 client，不伪造空邀请列表 |
| `/{locale}/invite/{token}`、`/{locale}/accept-invitation?token=...` | 共用 recipient 组件；缺失/非法 token 提示重新打开原链接，未登录只给现有 signin 的登录或创建账号动作；已登录通过原 HTTP helper 读取和接受 |
| 首页 invite 回跳 | 导向缺 token 的原链接提示，不查询 pending 或猜测第一条邀请；原 magiclink 分支未改 |

路径 token 只消费 Next 已完成的一次解码；verify 和 query 页面必须恰有一个 token。仅接受原规范 `v1_` 加 32 位小写十六进制，不 trim、二次解码或尝试变体。GET 不更新 expired，不读写表，不使用 service-role、Cookie 身份回退或多 token 查找；沿用安全字段、`no-store`、`Vary: Authorization`、严格 TABLE 验证和原十秒总截止/取消清理。原 POST 接受算法、HTTP helper、协议和 SDK fixture 保持。

浏览器 session 仅提供 Bearer；资格不从本地邮箱、`type`、metadata、注册结果或时钟推断。UI 只显示安全角色/状态；pending 且数据库 `is_expired=false` 才能接受。一次点击同步锁定写请求，完整成功结果必须与当前邀请、项目、角色和已登录用户一致才导航。unknown 留在当前页面并锁住再次接受；用户显式查询 status 后，只有确认 accepted 且属于当前用户才显示“进入项目”。pending 复查不解锁写入，无自动接受、重试或轮询。

同账号凭据刷新保留未决写锁。真实身份离开/返回会同步更新身份代次，旧请求即使在同一 React batch 内返回，也不能更新界面、启用动作或导航；未决写入的返回账号只能显式查询恢复。token 改变、卸载和迟到 session 结果同样受约束。当前共享提示为英文，locale 路径及本地 signin `next` 保持规范。

## 实际失败、修复与验证

原始输出索引见[证据目录](evidence/2026-10-19-invitation-read-ui/README.md)。早期 `.log` 捕获已按原字节改名为 `.txt`，避开仓库忽略规则；未改写失败或原审查。

| 阶段 | 本批实际结果与证据 |
| --- | --- |
| 旧读取入口 RED | [3 failed / 15 skipped](evidence/2026-10-19-invitation-read-ui/red-read-routes.txt)：关闭开关时 path 返回 200、verify 返回 500、pending 返回 200，npm 退出 1。外层打印日志的 shell 退出 0 不代表测试通过 |
| 读取 GREEN | [18 passed](evidence/2026-10-19-invitation-read-ui/green-read-routes.txt)，实际 handler＋Supabase SDK 对接合成 loopback Auth/REST |
| 页面行为 RED/GREEN | [初步 fixture 失败](evidence/2026-10-19-invitation-read-ui/red-recipient-ui.txt)保留；正式业务 [RED 36 failed](evidence/2026-10-19-invitation-read-ui/red-recipient-behaviors.txt)挂载真实旧页面，随后 [GREEN 36 passed](evidence/2026-10-19-invitation-read-ui/green-recipient-ui-initial.txt)。未用缺模块冒充业务失败 |
| 自审账号返回缺陷 | [RED 1 failed / 1 passed / 36 skipped](evidence/2026-10-19-invitation-read-ui/red-account-return-count.txt)证明未决写入后返回账号会自动读；修复后初次定向 [250 passed](evidence/2026-10-19-invitation-read-ui/focused-tests.txt) |
| Task 1 初审 I1 | [Spec 问题 / Needs fixes](evidence/2026-10-19-invitation-read-ui/task-1-review.md)：同一 batch 离开并返回同用户未使旧请求失效，旧接受可导航、旧 accepted 读取可启用继续动作。初次 250 项与全量 1016 项通过均未覆盖此缺陷 |
| I1 修复 | [RED 2 failed / 1 passed / 38 skipped](evidence/2026-10-19-invitation-read-ui/fix-1-red.txt)后增加同步身份代次；同命令 [GREEN 3 passed / 38 skipped](evidence/2026-10-19-invitation-read-ui/fix-1-green.txt)。[独立限定复审](evidence/2026-10-19-invitation-read-ui/task-1-fix-1-review.md)确认 I1 ADDRESSED、规格与质量 Approved，无新增阻塞发现 |
| 最终定向回归 | 实现者执行 [5 套 / 253 项通过](evidence/2026-10-19-invitation-read-ui/fix-1-focused-tests.txt)：**18 项新读取路由 SDK 测试＋41 项 React 行为测试＋194 项既有回归**。后者为 77 protocol、29 client/facade、88 acceptance handler；本次确实重跑，不将全部 253 项归为 SDK 或真实提供方验证 |
| 最终类型/lint | 实现者 web [type-check](evidence/2026-10-19-invitation-read-ui/fix-1-type-check.txt)、两处修复文件 [scoped lint](evidence/2026-10-19-invitation-read-ui/fix-1-lint.txt)与 [diff-check](evidence/2026-10-19-invitation-read-ui/fix-1-diff-check.txt)均报告退出 0；后两项空原始输出属正常 |

React 测试挂载真实页面/组件，使用实际 HTTP helper 与 parser，在 fetch/auth/router 边界提供合成数据；不是完整浏览器或提供方端到端测试。18 项新路由测试覆盖精确开关、单次读取/参数、认证失败、畸形结果、debug、取消/截止与连接/监听清理。旧 PG17 事务矩阵本批未重跑；[前批 HTTP 引用指纹核对](evidence/2026-10-19-invitation-read-ui/prior-evidence-check.json)仅验证历史引用，不能与这些测试合成为生产集成证据。

控制器在 **10:38:22—10:40:45 Asia/Taipei** 对 I1 修复后源码重新执行[完整项目矩阵](evidence/2026-10-19-invitation-read-ui/project-verification-20261019T023821Z.json)：`npm run verify`、`npm test --workspace=packages/shared -- --runInBand`、`npm run test:infra` 均退出 0，Web **82 套 / 1019 项**、shared **4 套 / 16 项**、infra **7 项**及 **176 页**构建通过，751 个输入未变，next-env 恢复起点字节。[02:27:11Z 初次运行](evidence/2026-10-19-invitation-read-ui/project-verification-20261019T022711Z.json)虽通过，但在 I1 修复前，只作历史记录。最终 18 文件输入由 [Fix 1 manifest](evidence/2026-10-19-invitation-read-ui/fix-1-source-sha256.json)及[控制器复核](evidence/2026-10-19-invitation-read-ui/controller-fix-1-source-check.json)绑定；原 manifest 不覆盖。

全量输出仍有缺少 `SUPABASE_SERVICE_ROLE_KEY` 诊断及旧 Next `eslint` / `images.domains` 配置警告，初审 M1 保留为独立清理项；退出 0 不等于无警告或生产配置可用。依赖未改、audit 未重跑，历史 **42 项（34 high / 8 moderate）**仍未解决。[当前汇总](evidence/2026-10-19-invitation-read-ui/verification.json)记录不可变证据 SHA-256；最终完整性已由控制器在文档与实际审查收尾后更新并通过，较早预检仅作当时记录。

## 保留的发布阻塞与下一步

- 现有 signin 记录完整 URL/next 并在 localStorage 保存 `auth_next`；callback 记录认证信息和原始提供方错误。本批未改这些认证文件，其日志与持久化是**独立发布阻塞**。新增 recipient 无日志/凭据持久化不代表端到端认证隐私已完成。
- pending discovery 暂不可用，可信最小预览尚缺；当前无项目/邀请者名、邮箱或问题/消息正文。“谁邀请、想问什么、谁能听”的原目标体验未完成；仅显示角色/状态不证明可听范围。历史 opaque token、历史成员绑定仍不自动映射或收养，不提供旧写入回退。
- 本批文档审查、整批审查与最终完整性均已通过；下一步首先修复 signin/callback 的 URL/next/原始认证日志和 `auth_next` 生命周期，再落实可信服务端权益 source/event 的供给、撤销和持久去重以及发送/release/直接 RPC 与表 ACL。可信 pending/最小预览和历史映射保持独立工作。直接 RPC/表 ACL、真实 Auth/JWT/PostgREST/RLS、历史 token/member 可信映射、前向迁移及回退需分别验收。
- 原 G0/G1 仍缺迁移历史等价、bucket 配置、备份恢复/回退、供应商账户条件、正式资产/Storage/删除/Worker adapter、跨家庭反例及真机 5/20/30 分钟矩阵；[里程碑判定](evidence/2026-10-19-invitation-read-ui/milestone-check.json)继续 **G0=false、G1=false**。本地批不是新增里程碑，不降低 D01–D16 或质量门。

保留 `codex/october-upgrade-p0`、HEAD `1caa21a72` 的未提交工作和忽略恢复数据。本批无真实家庭资料、远端 Auth/付款/邮件调用、迁移、部署、提交、推送或合并。

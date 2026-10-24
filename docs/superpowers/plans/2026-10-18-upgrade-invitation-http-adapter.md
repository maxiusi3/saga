# 邀请可信身份与 HTTP 接受适配实施计划

> 使用 superpowers:subagent-driven-development，逐任务独立规格/质量审查，最后整批复审。已获继续升级授权；原里程碑未达成前不提交/推送，不部署。

**Goal:** 将现有接受入口和 facade 统一到可信 Bearer 身份、精确候选 RPC、严格成功结果与显式状态恢复。

**Architecture:** 每请求独立且凭据固定的 Supabase client；status 只提供返回一致性期望，accept 数据库事务仍是唯一成功依据。默认关闭，旧写路径无回退。支付权益供给和生产迁移单独验收。

**Tech Stack:** 现有 Next.js/TypeScript、Supabase SDK 2.105.3、Jest、Node HTTP fixture；不新增依赖。

**Spec:** [绑定规格](../specs/2026-10-18-invitation-http-adapter.md)。

**当前状态（2026-10-18，Asia/Taipei）：** Task 1初审I1（fixture被Jest收集为空套件）已修复，[复审PASS/Approved](../../research/evidence/2026-10-18-invitation-http-adapter/task-1-fix-1-review.md)。定向194项及控制器本批完整矩阵通过；初始失败/原manifest保留。Task 2文档独立审查PASS/Approved，最终完整性及整批复审已通过，M1已修正并复核，见[验证汇总](../../research/evidence/2026-10-18-invitation-http-adapter/verification.json)。

## Global Constraints

- 仅修改两个旧 accept route、api-supabase.ts 的 invitations.accept、五份授权交接文档；新增本批模块/状态入口/测试/文档/证据。所有旧实验/运行时/根迁移/依赖/历史证据及其他应用行为保持。
- 开关 INVITATION_TRANSACTIONS_ENABLED 仅 true 启用，默认关闭即 503 且零外调。显式 Bearer，不回退 Cookie/service/直表/旧 RPC/多 token；不启用生产开关。
- 精确 invitation_candidate.status({ p_token }) → accept({ token })；同一认证 client，10 秒截止及 caller abort，RPC retry(false)。status 只读，accept 最多一次；未知结果非 2xx，无自动写重试。
- token/Bearer/邮箱/原始错误和私有定义不进入响应、日志或公开证据。合成本地 HTTP fixture 不证明真实 JWT/支付/PostgREST/PG17 集成。
- 原分支 codex/october-upgrade-p0、HEAD 1caa21a72；保留未提交及忽略恢复数据。原 G0/G1 未达成不提交/推送，无远端认证/支付/邮件/家庭数据、迁移或部署。

## Task 1 — 协议、可信身份、接受/状态与客户端衔接

**Files:** 新 packages/web/src/lib/invitation-acceptance-protocol.ts、lib/invitation-acceptance-client.ts、lib/server/invitation-acceptance.ts、app/api/invitations/status/route.ts；改 app/api/invitations/accept/route.ts、app/api/invitations/[token]/accept/route.ts、lib/api-supabase.ts 的 invitations.accept。测试放 lib/__tests__/invitation-acceptance-{protocol,client}.test.ts、lib/server/__tests__/invitation-acceptance.test.ts 和 `lib/server/test-support/invitation-fixture.ts` 中的必要 fixture；证据目录 docs/research/evidence/2026-10-18-invitation-http-adapter/。

**Interfaces:** consumes 前批 candidate.sql 实际 status(p_token text)/accept(token text) 及 Auth 提供方顶层身份；produces handleInvitationAcceptance(request, tokenFromPath?)、handleInvitationStatus(request)、acceptInvitationOverHttp(token, accessToken)、getInvitationStatusOverHttp(token, accessToken) 及严格类型/解析 helper。可在这些明确职责间拆小文件，新增路径须在报告列明；不能扩展旧源文件修改范围。

- [x] 保存有意义的旧入口 RED：关闭开关请求应 503 且零认证/RPC；旧入口不满足。保留原始私有日志及安全公开摘要。

~~~ts
delete process.env.INVITATION_TRANSACTIONS_ENABLED
const response = await POST(new NextRequest('http://localhost/api/invitations/accept', {
  method: 'POST', body: JSON.stringify({token: 'v1_0123456789abcdef0123456789abcdef'})
}))
expect(response.status).toBe(503)
expect(externalRequests).toHaveLength(0)
~~~

- [x] 实现严格协议，使用字段类型/完整身份对照，只复制已批准的响应字段；参数键 status=p_token、accept=token 不可互换。
- [x] 实现默认关闭、独立 Bearer getUser 验证、同 client RPC、提供方确认邮箱、截止/abort 和安全结果分类；请求中 user_id 仅比较，不授权。
- [x] 替换两个旧接受 handler；新 status handler 只读。预读 accepted 不得提前成功，缺/错返回不得借预读补字段。
- [x] facade 接受改用 HTTP helper，附 session Bearer；helper 遇未知/畸形 2xx 抛安全可识别错误，无自动恢复或写重试。
- [x] 对照独立固定 fixture 完成协议/handler/client 测试；实际 Supabase SDK 与 loopback HTTP 验证 profile、身份、参数、次数、异常和清理。

~~~ts
expect(captured.map(r => [r.path, r.body])).toEqual([
  ['/auth/v1/user', null],
  ['/rest/v1/rpc/status', {p_token: fixtureToken}],
  ['/rest/v1/rpc/accept', {token: fixtureToken}],
])
expect(response.status).toBe(200)
expect((await response.json()).project_id).toBe(fixtureProject)
// Drop the accept response, then explicitly call status: accept count stays one.
~~~

- [x] 运行定向 Jest、type-check/lint 所需修正，仅保存最终源指纹与准确执行归属。完整项目矩阵由控制器在源码冻结后一次执行；实现报告不要冒称已完成。
- [x] 写 Task 1 报告、真实 RED/GREEN 证据、无额外文件改变的自查，交独立规格/代码审查。

## Task 2 — 项目验证、完整性与交接

**Files:** 新 docs/research/2026-10-18-invitation-http-adapter.md 与本批 evidence README/verification/project-checks/milestone/final-checks；更新 handoff、主计划、docs 索引、P0/P1、本计划状态。控制器执行验证，文档任务消费其结果；旧证据不改。

**Interfaces:** consumes Task 1 最终输入/日志及实际审查、完整项目执行与起点文件 manifest；produces 精确可追溯的实现/兼容影响/生产门槛和下一步。

- [x] 源码冻结后运行 npm run verify、shared、infra 并保存真实退出/日志/输入哈希；恢复 next-env 原字节。依赖 audit42 项未解决；旧 PG17 源码/运行时/证据仅校验其冻结哈希。
- [x] 起点文件对比仅允许八个明确旧文件变化；扫描新文件范围、链接/空白、token/凭据/私有定义，核对测试 fixture 清理与所有最终引用。文档前预检与文档/审查后的最终完整性均已通过。
- [x] 写清 Bearer-only 与旧 token 拒绝、默认关闭替代旧 HTTP 接受写路径、仍有发送/旧读取/直接 RPC/表权限等旁路、生产 PostgREST/schema/可信权益未部署、无真实认证证明。下一步按真实 source/event provisioning、旧入口整体关闭与迁移兼容推进。
- [x] Task 2 及整批独立审查通过后回填最终状态/完整性；原 G0/G1 未达成则保留本地分支及恢复目录，无提交/推送/部署。

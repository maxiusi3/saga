# 可信来源选择与邀请管理

2026-10-21（Asia/Taipei）。执行既有升级计划及当前 handoff 的下一本地实施项。沿用已完成的 send/release/lookup，不启用生产功能，不修改前批 SQL、依赖或根迁移。

## 数据边界

在独立 `experiments/pg17-invitation-management` 组合已冻结权益事件候选，新增 `invitation_candidate.available_sources(p_project_id uuid,p_role text)` 和 `invitation_candidate.management_list(p_project_id uuid,p_after uuid DEFAULT NULL)`。两者 SECURITY DEFINER、空 search_path、限定 authenticated EXECUTE、无直接表权限；安装须本地数据库名及独立 marker，通过真实 PG17 低权限连接验证。旧实验及证据不改。

available_sources 只允许已确认邮箱的当前项目 facilitator、active 项目和两种席位角色；只返回 actor 自己、角色匹配、verified、未 revoked、remaining>0、存在已入账 grant 的来源；钱包镜像正数只是附加必要条件，不能产生来源。storyteller 已有 active/pending 成员或 reserved 绑定时为空。返回 `source_id,project_id,role,remaining`，最多100项按 source UUID 排序。读取是当前快照，send 仍原子重新授权，不承诺预留。

management_list 只允许已确认身份的当前项目 facilitator；允许 inactive/转移项目及撤销来源的清理。只列当前项目已登记 bindings，绝不采用历史 opaque token 或无绑定 invitations。返回 `invitation_id,project_id,invitee_email,role,status,expires_at,created_at,request_id`；request_id 仅当前 actor 的原请求，否则 null。不得返回 token、正文、provider/event/source_key 或其他用户数据。按 invitation UUID keyset，每次最多50项，p_after 只能规范 UUID；UI以最后ID翻页，满页保留下一页选项。绑定与 invitation/审计状态不一致则拒绝，不能把损坏记录当有效邀请；accepted 的历史成员可已停用/删除，列表不冒称成员仍有效。释放仍走原全局入口，无 lookup 前置。

## HTTP / 客户端

新增独立默认关闭 `INVITATION_MANAGEMENT_ENABLED`，必须与 `INVITATION_TRANSACTIONS_ENABLED` 均精确 true 才读取。POST `/api/invitations/sources` body `{project_id,role}`，POST `/api/invitations/manage` body `{project_id,after?}`。严格字段/UUID/角色、Bearer-only 提供方 getUser，逐请求 anon client、同 Authorization 调对应 RPC、10秒共享截止/abort、无 Cookie/service 回退/自动重试、no-store。关闭时先拒绝零 I/O。成功 `{success:true,items:[...]}` 仅由严格匹配/唯一/排序/最大长度的行解析生成；畸形/外部错误安全失败，不输出上游内容。旧 GET/DELETE/cleanup 继续关闭。读取错误不说明先前写入未提交。

## 管理界面与恢复

真实 dashboard 邀请页与嵌入 InvitationManager 共享一个管理组件。组件使用 auth-store 会话 Bearer，读取来源及管理列表；只允许选返回的 source_id；一次点击生成一个 crypto.randomUUID request_id，经原严格 sender client 发送。成功表示邀请登记，用户复制显式确认返回的链接，不能称邮件已发送。列表无 token，原发送者点击恢复链接才 lookup。pending 行允许 cancelled，已过期用 expired；返回须匹配当前项目/invitation。

发出写入前在 sessionStorage 保存单个版本化恢复票据，仅 `{version:1,actor_id,project_id,request_id,role}`，不保存 token、Bearer、email、message、source_id。无法保存则不发出，防止刷新丢失未知请求。恢复票据不是凭据，服务端仍验证；按账号/项目隔离且严格读取字段。刷新只显示“查询上次邀请”，不自动写入/查询；unknown/rejected lookup 保留票据并阻止新发送，显式查询确认后才允许新邀请。送出后不按来源刷新失败推断未提交。明确 not_attempted/rejected 的原发送可清票据；unknown 必须保留。双击、切换角色/项目/账号、卸载、过期响应均不能重复发送或覆盖新上下文；清除旧上下文内存中的 token。请求中禁用动作；支持 AbortController 与世代隔离。

## 验证与交付

先验证旧页面无法选来源/恢复的真实 RED；SQL在真实PG17验证访问、来源筛选/撤销、旧余额、角色冲突、列表历史/转移/损坏、分页、ACL、无写入及清理。实际 SDK + loopback HTTP 验证参数/认证/畸形/超时及零旁路；React测试验证实际发送、unknown刷新恢复、同账号隔离/迟到及取消。运行项目 verify、shared、infra，保存结果，恢复 next-env。独立规格/质量审查后更新研究记录、handoff、主计划、docs索引和P0/P1状态。原P0/G0–G4依据原质量门判定；本地合成通过不构成真实供应商/Auth/PostgREST/迁移/设备验收。

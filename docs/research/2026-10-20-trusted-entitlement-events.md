# 可信权益事件与邀请权限：本地实现

2026-10-21续接（Asia/Taipei）。10月20日本地实现、冻结测试及项目验证已完成；**独立规格 PASS／质量 Approved，无待修项；文档独立审查 PASS／Approved、整批独立审查 PASS，本批本地收尾完成**。本次新核对812个源码/依赖/PG哈希、773应用输入和完整运行时清单；原始运行结果保持10月20日归属，没有重跑未变化的成功矩阵。状态以[汇总](evidence/2026-10-20-trusted-entitlement-events/verification.json)为准。

## 已实现

依据[绑定规格](../superpowers/specs/2026-10-20-trusted-entitlement-events.md)和[实施计划](../superpowers/plans/2026-10-20-upgrade-trusted-entitlement-events.md)，新增[PG17 权益实验](../../experiments/pg17-entitlement-events/README.md)，复用已审邀请事务、导出候选和固定结构；旧应用、实验、依赖、根迁移与历史证据未改。

| 范围 | 本批行为 |
| --- | --- |
| 事件供给 | 独立低权限 `entitlement_writer` 只可调用事件入账与查询。固定 provider/event/source、付款人、席位类型、数量；客户端角色文字不能取得事件权限 |
| 持久去重 | 相同事件重投不写入；改 payload 拒绝；不同事件重复授予同一来源只登记新事件，不重复增加余额 |
| 乱序与恢复 | 撤销先到建立终态墓碑，后到授予被抑制；真实提交后丢弃返回，从新连接查询持久结果 |
| 邀请与撤销 | 新来源可供 send/accept/release 使用。撤销阻断新发送、接受与重复确认；已接受来源仅停用精确映射成员，不删除历史、不恢复失效成员、不取消独立所有者资格 |
| 并发 | 项目排序锁→钱包→来源/绑定→成员。持钱包锁后发现新项目绑定，返回 40001 并完整回滚；重试覆盖新增映射 |
| 权限旁路 | 关闭七个未经来源核查的旧写 RPC、敏感表及列级直写权限；两导出候选保留 authenticated。仅靠已撤销成员资格的用户不能登记新导出 |

钱包保持旧系统兼容总量，撤销不会猜测应扣除多少已消费或已预留余额。取消/到期仍返还原来源和镜像，但不解除 revoked；可用权益必须同时检查受保护来源。因此这套组合不能直接开启旧应用。被关闭的精确签名及兼容影响见[实验 README](../../experiments/pg17-entitlement-events/README.md)。既有来源若没有账本关联，安装拒绝自动收养；本批 SQL 不是历史数据迁移。

writer 表示“上游已核实”的服务端输入。真实供应商签名、账户、商品映射和凭据部署未接入，合成事件不证明付款。已有导出任务、已签发 URL、Storage 与交付 Worker 撤权仍需单独实现再授权。

## 验证

原始路径与哈希见[证据索引](evidence/2026-10-20-trusted-entitlement-events/README.md)及[实现报告](evidence/2026-10-20-trusted-entitlement-events/task-1-report.md)。

- 正常 PG17 和污染环境各 **95 场景／3,211 断言**，包含 **20 组实际并发顺序**，观察 `pg_locks` 与阻塞 PID。
- **13 类写入阶段故障**及调用者显式 rollback 比较全部 14 张相关表，检查事务无中间写入。
- 生命周期 **4/4**：污染环境、fixture 就绪后的 SIGTERM、真实启动失败、真实连接失败；子进程预期退出码分别为 0／143／1／1，后面三项不代表业务测试成功。观察器确认集群、连接和临时目录均清理，无 rescue。
- 10月20日执行 `npm run verify`、shared、infra 全部退出 0：**Web 96 套／1,278 项，shared 4 套／16 项，infra 7 项，176 页构建**。773 个应用输入不变，next-env 原字节已恢复。
- 25 个直接输入、44 个 CommonJS/package 文件、743 个 PG 运行时文件与 manifest 一致。Node v22.22.2、pg 8.16.3、PG17.4；macOS 内核与共享库是未逐字节固定的环境依赖。

初始 RED 在候选 SQL 出现前保留：缺事件入口返回 42883；人为授予的宽松表/列/RLS 夹具实际允许钱包增量，随后验证候选会拒绝。后者是合成反例，不能推断生产已有同一列级权限。开发中无钱包墓碑、未来函数默认 PUBLIC EXECUTE 和 writer 对旧 RPC 的权限问题均有失败记录及最终覆盖；中间结果不冒充最终证据。

旧 Next 配置和缺服务端配置的构建诊断仍存在。依赖未变，本批未重跑 audit；此前 **42 项（34 high／8 moderate）**仍未解决。

## 下一批已核对的应用入口

10月21日只读调用点核对，以下仍是待实施的兼容缺口，不属于本批已交付功能：

- [Supabase facade](../../packages/web/src/lib/api-supabase.ts) 的 `invitations.send` 和[项目邀请 POST](../../packages/web/src/app/api/projects/[id]/invitations/route.ts) 仍调用旧 `send_project_invitation`，生成旧 token；POST 另使用 admin 查询钱包/邀请并尝试发邮件。下一批须接受限事务入口与可信来源引用，明确“邀请已登记”和邮件送达分别确认。
- [管理页](../../packages/web/src/app/[locale]/dashboard/projects/[id]/invitations/page.tsx) 取消请求为 `DELETE /api/projects/{id}/invitations/{invitationId}`，当前该目录只有集合 `route.ts`；现有 DELETE 实际接受集合路径的 `?invitation_id=`。集合 DELETE 分开更新邀请和钱包，且没有检查返席写入错误。适配批需修正实际调用链，改用原子 `release`，不能仅新增一个未被 UI 使用的 handler。
- [过期清理 GET/POST](../../packages/web/src/app/api/admin/cleanup-invitations/route.ts) 仍调用已在本地组合停用的旧 cleanup RPC；GET 还会触发写入。正式入口关闭/替换必须列入兼容核查，不能把本地 ACL 收紧当作应用已切换。
- [固定 SQL](../../experiments/pg17-invitation-transactions/candidate.sql) 的参数是 `send(p_project_id,p_request_id,p_invitee_email,p_role,p_source_id,p_message)`、`release(p_invitation_id,p_reason)`、`lookup(request_id)`。原请求 ID 用于发送结果恢复；未知提交后不得换键或自动重发，lookup 的拒绝也不能当作“确定未发送”。受保护 source 引用必须由 SQL 核对付款人、席位种类、remaining 和 revoked，不能凭客户端余额或来源 ID 宣称已授权。

## 审查与续接

10月21日[独立规格审查](evidence/2026-10-20-trusted-entitlement-events/task-1-spec-review-2026-10-21.md)已 PASS，无待修项。[独立质量审查](evidence/2026-10-20-trusted-entitlement-events/task-1-quality-review-2026-10-21.md)为 Approved，无待修项；文档独立审查 PASS／Approved、整批独立审查 PASS，本批本地收尾完成。[续接完整性](evidence/2026-10-20-trusted-entitlement-events/resume-integrity-2026-10-21.json)和[运行时清单](evidence/2026-10-20-trusted-entitlement-events/resume-runtime-2026-10-21.json)均通过，原始测试与实现输入不变。

10月20日的[控制器复核](evidence/2026-10-20-trusted-entitlement-events/controller-review.md)及当时模型服务错误保留为历史，不充当独立批准。恢复台账位于 `.superpowers/sdd/2026-10-20-upgrade-trusted-entitlement-events/progress.md`，原 brief/report/diff 均保留。

1. 本批待办已关闭；[文档独立审查](evidence/2026-10-20-trusted-entitlement-events/task-2-doc-review-2026-10-21.md) PASS／Approved，[整批独立审查](evidence/2026-10-20-trusted-entitlement-events/batch-final-review-2026-10-21.md) PASS。保留原始输出与执行时间。
2. 下一本地实施接默认关闭的 send/release HTTP 适配及发送者查询恢复，沿用严格结果解包和 unknown 提交规则；不自动重试写入，不把预读当作发送/释放成功。可信事件验证与正式数据库角色/凭据接入另验。
3. 正式 Google/SMTP、JWT/PostgREST/RLS/Storage、七个未登记迁移的语义对账、bucket/对象/回填/回退/备份、供应商条件和 G1 真机矩阵仍缺。

[原里程碑判定](evidence/2026-10-20-trusted-entitlement-events/milestone-check-2026-10-21.json)：G0/G1 未通过，G2–G4 未通过。本批未提交、推送、合并、迁移或部署；保留现有分支、全部未提交内容和恢复资料。

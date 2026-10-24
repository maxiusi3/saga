# 邀请发送、释放与发送者恢复 HTTP

2026-10-21（Asia/Taipei）。继续[可信权益事件批](2026-10-20-trusted-entitlement-events.md)后续工作。本地实现及冻结验证完成，独立规格PASS；质量Approved，文档独立审查PASS／Approved，整批审查PASS，本批本地收尾完成。最终结果以[验证汇总](evidence/2026-10-21-invitation-sender-http/verification.json)为准。本批仅完成本地传输层，不构成原计划里程碑。

## 范围与行为

绑定[规格](../superpowers/specs/2026-10-21-invitation-sender-http.md)和[实施计划](../superpowers/plans/2026-10-21-upgrade-invitation-sender-http.md)。本批只接应用传输层与关闭旧旁路，使用既有 SQL；SQL、依赖、根迁移、前批原始证据均保持起点内容。

| 入口 | 契约 |
| --- | --- |
| 项目邀请 POST | 调用方显式提供 request_id/source_id，规范化邮箱、角色与正文，一次 send RPC |
| 全局 invitations/release POST | invitation_id 与 cancelled/expired；一次 release RPC，无 lookup 前置 |
| invitations/lookup POST | 原发送者凭 request_id 查询，只读恢复并验证项目/角色 |
| 旧项目 GET/DELETE、admin cleanup GET/POST | 始终 503/not_attempted，零认证和业务 I/O |

新操作只有 `INVITATION_TRANSACTIONS_ENABLED` 精确为 `true` 才进入验证；默认先拒绝，无 body/config/client 读取。Bearer 必须由提供方 getUser 核实，逐请求匿名 key SDK 使用相同 Authorization 调 RPC，Cookie 和 service key 不回退。认证与操作共享十秒截止和 caller abort；响应体有界，写操作单次调用，不自动重试。

release 故意使用全局 invitation ID。SQL release 在当前项目 facilitator 权限下允许处理撤销来源、非活动或已转移项目；sender lookup 的权限规则会拒绝其中一些情况，因此不能把 lookup 成功当作 release 的前置条件。页面只确认与当前 invitation/project 一致的释放结果。

仅恰一行且字段、身份、状态一致的返回确认成功；畸形 2xx、断连、超时和不确定写入保持 unknown。显式 lookup 不追加写操作，也不把查询失败解释为原写入未提交。accepted 的 user_id 是收件人，无须等于发送者。token 只出现在确认 send/lookup 结果，不写日志、错误或浏览器存储。send 成功只表示持久登记，不表示邮件送达。

稳定 facade 保留 data 包装；旧三参数 send 与缺来源/request ID 的 generateInvitation 明确不可用，不生成来源、恢复旧 RPC 或直接用钱包余额。列表不再读取旧邀请 token。来源选择、完整发送管理 UI/历史和刷新后的发送草稿恢复仍是后续任务，当前旧表单不能正常发新邀请。

## 验证状态

[实现报告](evidence/2026-10-21-invitation-sender-http/task-1-report.md)和[20个文件清单](evidence/2026-10-21-invitation-sender-http/task-1-scope.json)已冻结。最终定向17套/521项、类型检查与范围lint通过；独立规格[PASS](evidence/2026-10-21-invitation-sender-http/task-1-spec-review.md)。run 01提供7项真实旧入口拒绝断言RED；02是缺模块scaffolding，05含UI定位/新API缺失，06含旧组件畸形响应渲染失败，08为已消费Response的fixture问题，均不单独充当本批旧行为RED。11邮箱Unicode大小写和14提供方UUID边界经RED/GREEN修复，16路由可选Request类型失败已修复。全部原始输出在ignored raw-logs原样保留，公开副本脱敏且有[20次运行对应清单](evidence/2026-10-21-invitation-sender-http/task-1-run-manifest.json)，[40个日志哈希核查](evidence/2026-10-21-invitation-sender-http/task-1-log-integrity.json)一致。服务端使用实际 Supabase SDK 与合成本机 HTTP fixture；组件测试通过模拟 fetch 检查用户行为，不能据此声称真实 Auth/PostgREST/JWT/PG17 端到端通过。

前批指纹已独立重核：[先前输入完整性](evidence/2026-10-21-invitation-sender-http/previous-input-integrity.json)覆盖 813 个源码/依赖/Node/PG 运行时指纹、129 个直接保护输入及 975 个既有实验/原始证据/依赖文件，均无变化。本批不重跑未变 SQL 矩阵；这些检查不是本批应用测试或生产资格证明。

控制器于2026-10-21 10:25:37—10:29:36 Asia/Taipei在源码冻结后、独立只读审查期间运行[全项目矩阵](evidence/2026-10-21-invitation-sender-http/project-verification-20261021T022537Z-f5820706-f190-44bf-9100-8aa7dfc5b528.json)：verify/shared/infra均exit0，Web101套/1373项、shared4/16、infra7、178页通过；785输入未变、next-env恢复。旧Next eslint/images.domains配置警告和缺SUPABASE_SERVICE_ROLE_KEY诊断仍在，成功build不是生产配置资格。独立质量Approved，文档独立审查PASS／Approved，整批审查PASS，本批本地收尾完成，见[证据索引](evidence/2026-10-21-invitation-sender-http/README.md)。

证据分发补充：仓库规则忽略`*.log`。为保证后续GitHub里程碑包包含可审阅输出，本批新增字节一致的`.log.txt`副本，见[分发映射](evidence/2026-10-21-invitation-sender-http/published-log-manifest.json)。原始raw、审查时`.log`副本、原运行清单及Task1两份独立报告保持原字节；它们所述文件名属于审查时快照，当前链接使用可追踪副本。原始含合成值日志仍仅在忽略恢复目录保存。

## 里程碑与后续

[原质量门判定](evidence/2026-10-21-invitation-sender-http/milestone-check.json)保持 P0/G0–G4 未通过。本地传输层进展不能替代生产 Auth/JWT/PostgREST/RLS/ACL、Storage bucket、迁移历史等价/回填/回退/备份、供应商账户和数据条件；G1 还缺正式 adapter、真机故障矩阵及保存/离线导出/删除恢复证据。依赖未改；42 项历史 audit 失败（34 high、8 moderate）未在本批重跑或解决。

后续先设计和验证受限可信来源选择，接完整 sender UI 与显式恢复；当前取消页与旧列表不可用应一并纳入管理体验验收。真实事件签名/账户/商品映射与 writer 角色资格、历史 token/member 映射、迁移回退和生产配置分别取证。保留当前分支和全部未提交工作；本批无提交、GitHub 推送、远端迁移或部署。

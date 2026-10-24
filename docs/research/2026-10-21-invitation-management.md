# 可信来源选择与邀请管理恢复

2026-10-21实现；2026-10-22恢复文档收尾（Asia/Taipei）。承接[邀请发送 HTTP 批](2026-10-21-invitation-sender-http.md)的下一项。本批本地实现、冻结验证和独立实现规格/质量复审完成；文档/整批独立审查均PASS／Approved，最终完整性通过，本批本地收尾完成，当前状态见[验证汇总](evidence/2026-10-21-invitation-management/verification.json)。绑定[规格](../superpowers/specs/2026-10-21-invitation-management.md)和[实施计划](../superpowers/plans/2026-10-21-upgrade-invitation-management.md)。

## 完成的行为

隔离 PG17 overlay 新增两项只读 RPC，保持既有权益与邀请事务不变。available_sources 仅供已确认身份的当前 active 项目 facilitator，要求 actor/角色匹配、verified/未撤销/正数余额的 source、持久 grant 及匹配 purchase 审计；钱包镜像单独不能授权。storyteller 成员或 reservation 冲突不提供来源。最多100项、UUID排序；读取不预留，send 仍原子重查。

management_list 仅供当前 facilitator，允许非活动、已转移或来源撤销的清理历史；整份已绑定历史先核对 invitation/source/request/member 与审计的一致性，再按 UUID keyset 最多50项返回。未绑定的旧 opaque 邀请不进入列表；已接受成员可已停用或删除。输出不含 token/正文/供应商字段，只有当前原发送者得到 request ID。accepted 不表示成员现在仍有效。

| 应用入口 | 行为 |
| --- | --- |
| POST `/api/invitations/sources` | 严格项目/角色输入，只读可信来源 |
| POST `/api/invitations/manage` | 严格项目/可选 UUID cursor，最小历史投影 |
| dashboard 邀请页与嵌入管理器 | 共用来源选择、发送、显式查询/链接复制、取消/过期释放和分页 |
| 旧 GET/DELETE/cleanup | 保持关闭，无旧 RPC/表写回退 |

新读取要求 `INVITATION_MANAGEMENT_ENABLED` 与 `INVITATION_TRANSACTIONS_ENABLED` 均精确 true，默认关闭。实际逐请求 anon SDK 先 provider getUser，再传同一 Bearer；共享十秒截止/abort、no-store、严格返回解析，无 Cookie/service 回退或自动重试。源/历史读取失败不能判断前次写入未提交。

新发送只选择服务端来源、一次生成一个 request ID，复用前批 send/lookup/release。写前必须存下并回读最小恢复票据，仅 version/actor/project/request/role，不保存邮箱、正文、source、token 或 Bearer。unknown 刷新后阻止新发送，只允许显式查询；被拒/未知查询保留票据，不自动重发。确认链接只在内存中，send 成功表示邀请登记，用户自行分享，不称邮件送达。刷新恢复的是请求票据，不恢复表单正文。

账号/项目和同 batch 离开再返回有身份世代与 abort 防护；未 dispatch 的本次票据在离开时立即 compare-delete，已 dispatch 的 unknown 保留。切角色清旧链接。全局 release 无 sender lookup 前置，确认时严格匹配当前 project/invitation。现有成员状态/删除继续按真实成员记录 ID，移除编造邮箱与误标 Owner。

## 验证和审查

下述业务/项目测试执行于10月21日。10月22日09:18:25的[恢复完整性核验](evidence/2026-10-21-invitation-management/resume-integrity-20261022T011825076698Z.json)只读确认796应用输入、19本批源码、986保护输入、774 SQL/runtime输入、38原始/公开日志、17引用报告/最终日志及Node/清单/next-env匹配；未重跑应用或SQL测试。当前续接只补文档，不改变已冻结实现和证据。

真实 PG17 最终16场景/2448断言、四类生命周期（污染环境、SIGTERM、server启动失败、client连接失败）通过，cluster/client/temp 清理完整；先前 inputs/runtime 指纹一致。RED、两个中间 fixture 失败与后续结果原样保留，详见 [SQL报告](evidence/2026-10-21-invitation-management/task-1-report.md)。未重做不变的前批业务矩阵。

UI/HTTP 最终定向5套54项通过；独立审查两个问题已有真实RED/GREEN和复审 Approved，零待修项，见[应用报告](evidence/2026-10-21-invitation-management/task-2-report.md)及[独立审查](evidence/2026-10-21-invitation-management/implementation-review.md)。冻结后完整 verify/shared/infra/diff-check 均 exit0：Web105套1420项、shared4/16、infra7、180静态页；796应用输入未变，next-env原字节恢复。命令/日志/时间见[项目验证](evidence/2026-10-21-invitation-management/project-verification.json)，分发日志及哈希见[索引](evidence/2026-10-21-invitation-management/README.md)。

这是合成身份/事件的真实 PG17，以及实际 SDK/本机 loopback 与 React fixture 的分层验证；没有真实 Auth/JWT/PostgREST/数据库端到端、真实支付/邮件、生产 ACL/Storage、旧 opaque token/member 回填或迁移资格。构建仍有旧 Next 配置及缺服务端 key 的 configuration-validation 诊断；依赖没改，历史 audit42项（34high/8moderate）未重跑或解决。

## 原质量门和下一步

[原质量门判定](evidence/2026-10-21-invitation-management/milestone-check.json)仍 P0/G0–G4=false；本地管理体验完成不新增里程碑。仍缺实际供应商账户/事件签名与商品映射、writer/生产 Auth/JWT/RLS/ACL/Storage 资格，7个未登记迁移的语义等价/回填/回退与备份恢复；G1 正式 adapter、真机5/20/30分钟故障及保存/导出/删除恢复也未完成。生产开关保持关闭。本批不提交、不推送 GitHub、不远端迁移或部署，保留全部既有工作。

下一独立本地批先将旧 RLS/来源账本矩阵与 PG17 完整依赖组合，再设计正式资产/Storage/删除 adapter 与兼容路径。实际供应商/Auth/部署 cookie、bucket配置/备份与迁移历史另取最小只读证据，不重放 bootstrap 或 repair。邀请当前仅覆盖可信新绑定，旧 opaque token/member 的可信映射和正式迁移仍须专门设计验收；未知写入继续显式查询。

## 10月22日最终收尾

[文档审查](evidence/2026-10-21-invitation-management/task-3-review.md)和[整批审查](evidence/2026-10-21-invitation-management/batch-final-review.md)均PASS／Approved，零待修项。两项由同一位独立于实现及文档作者的审查员完成，是两个审查范围，不是两份独立意见；首次文档审查任务无报告，已中断且不计入结论。[最终完整性](evidence/2026-10-21-invitation-management/final-integrity-20261022T110637+0800.json)记录最终文档/审查报告哈希及新一次冻结输入核验，原质量门定义未改。本次未修改应用/SQL、未重跑业务测试，保留原始证据与恢复资料。下一步直接进入旧RLS/来源账本的PG17完整依赖组合。

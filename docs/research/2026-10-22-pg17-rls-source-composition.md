# PG17 旧 RLS 与来源账本组合验证

计划日期：2026-10-22。恢复执行：2026-10-23（Asia/Taipei）。当前状态：本地实测完成；实现、协作材料、文档和整批独立审查均PASS／Approved，零待修项；最终完整性结果见验证汇总中的封存报告。

本批按[绑定规格](../superpowers/specs/2026-10-22-pg17-rls-source-composition.md)和[实施计划](../superpowers/plans/2026-10-22-upgrade-pg17-rls-source-composition.md)，将旧 RLS、来源账本以及可信权益/邀请管理放入同一原生 PostgreSQL 17.4 临时环境。新增实验与证据；保留已有业务实现、依赖、迁移和原始日志。

## 本批要验证什么

旧 RLS 和来源账本使用过缩减夹具。组合验证使用已取得的完整表结构和已审查公共函数，先记录旧假设失效的直接证据，再对测试 SQL 作精确、可追溯的兼容适配：位置 INSERT 改为列名、真实更新时间触发器的行比较，以及 Storage 部分唯一索引的冲突目标。权限拒绝必须来自权限行为，不能把 SQL 语法或索引推断失败当作隔离通过。

端到端场景在同一数据库中覆盖可信来源授予、邀请接受、本项目 story/object 可读、跨家庭拒绝、来源撤销后成员停用及下一语句读取拒绝，并检查撤权后来源绑定失败。旧写 RPC 和直接表写入旁路继续拒绝。来源账本须保留追加历史、NULL/数组表示、撤权、墓碑、事务锁和未知提交恢复的原有断言。

完整依赖仅指本批实际取得并审查的关系与公共函数。Auth 身份和对象为虚构夹具；未取得的 Storage 触发器函数体、完整 enum 行为、真实 JWT/PostgREST/Storage HTTP 和生产角色继承必须在实验清单中逐项列明。本地组合不构成完整 Supabase 或生产资格证明。

## 最终选定的本地运行

正常/污染环境各72场景、832个行为断言、236项账本检查及18条真实锁证据；六项兼容RED和四类生命周期均通过。997个总断言包含初始化与指纹检查，不能全部解释为业务断言。审查及最终完整性状态见[验证汇总](evidence/2026-10-22-pg17-rls-source-composition/verification.json)。

| 运行 | 结果 |
| --- | --- |
| [正常矩阵](evidence/2026-10-22-pg17-rls-source-composition/run-2026-10-23T01-57-40.064Z-866c69eb-00c2-46b6-9637-5e96f4d4dbd7.json) | 72场景 / 832行为断言；236账本检查、18锁证据 |
| [污染环境](evidence/2026-10-22-pg17-rls-source-composition/run-2026-10-23T01-58-56.841Z-d54c7c7a-53a0-4bc6-bea7-7b1f4217e9d2.json) | 同一完整矩阵通过；14个环境键被清除 |
| [兼容性RED](evidence/2026-10-22-pg17-rls-source-composition/red-2026-10-23T01-58-32.869Z-ccb54d4b-eff2-49c8-8767-ed140e3cba27.json) | 六场景：旧INSERT、必填字段、时间戳和冲突索引假设失效 |
| [生命周期](evidence/2026-10-22-pg17-rls-source-composition/lifecycle-2026-10-23T01-58-56.415Z-ccdd7767-5d65-4dea-89db-4d6656532b4b.json) | 污染环境、fixture就绪后的SIGTERM、真实启动失败及连接失败；均完整清理 |

七张原公共表及13个已审函数的复放不变；新增34列stories、14列buckets、15个存活objects列（保留第13位删除空位），逐项核对13约束、20索引与第四个公共触发器。七个缺少已审函数体的Storage触发器明确省略，buckettype只用STANDARD局部替身。实际anon/authenticated、账本低权限角色与独立writer会话的身份、非超级用户及无RLS绕过均有记录。

历史账本矩阵先在完整PG17结构下运行，再安装RLS候选并执行完整旧RLS矩阵，最后以独立seed把RLS、权益、邀请、管理与账本组合在同一库。[RLS先行的失败](evidence/2026-10-22-pg17-rls-source-composition/run-2026-10-23T01-49-34.634Z-1143fc6b-a88b-4ad9-a3a3-c70b7920cb02.json)已保留：旧账本故意修改故事归属的竞态被RLS身份保护以42501拒绝。没有削弱候选或改写旧账本；不能宣称全部历史归属变更测试在该身份保护下通过。最终组合再次证明归属修改被拒且原行保留，并覆盖授予→接受→可读→跨家庭拒绝→撤销→现有READ COMMITTED连接下一语句拒读→绑定拒绝；七个旧写RPC与钱包/成员旁路保持拒绝。REPEATABLE READ旧快照的限制单独保留。

历史账本阶段为82个观察、8个复核、13个绑定、39个合成资产；最终组合分别为83、8、13、40，未创建或验证真实Storage对象。全部选定运行保留源码/依赖/运行时指纹，集群停止、目录移除、零剩余客户端。早期设置失败与RED调试记录保留，不计入通过数量。PostgreSQL日志仅记录摘要，不公开可能含私有函数正文的错误CONTEXT。

## 独立审查

[实现审查](evidence/2026-10-22-pg17-rls-source-composition/implementation-review.md)与[协作材料审查](evidence/2026-10-22-pg17-rls-source-composition/assistance-review.md)均PASS／Approved。[文档初审](evidence/2026-10-22-pg17-rls-source-composition/documentation-review.md)发现的旧批次入口D1/P2已修复，[限定复审](evidence/2026-10-22-pg17-rls-source-composition/documentation-fix-1-review.md)PASS／Approved，零待修项。协作与文档由同一位独立审查员完成；另一位审查员完成的[整批独立审查](evidence/2026-10-22-pg17-rls-source-composition/batch-final-review.md)亦PASS／Approved，零待修项。[最终完整性](evidence/2026-10-22-pg17-rls-source-composition/final-integrity-5d5d3a4a-93f7-4918-a7cd-e0065d14974d.json)核对冻结输入、旧文件、原质量门和全部最终文件；本批收尾以该报告status=passed及封存后只读指纹一致为准。状态引用采用单向封存，避免报告和汇总互相计算哈希。

## 已核实的恢复基线

10月23日[冻结输入核验](evidence/2026-10-22-pg17-rls-source-composition/preserved-inputs-1c2b6ddf-bdb5-46d1-ad04-0e6d3a614ab2.json)通过：796个应用输入、19个邀请管理源码、986个更早受保护文件、774个 SQL/运行时输入、44个 pg 文件及38份日志保持原字节；Node 与 `next-env.d.ts` 一致。另固定1226个前批实验/证据文件，供本批最终核验。

应用全量结果仍为 **10月21日原执行**：Web105套/1420项、shared4套/16项、infra7项、180页构建；本批未重跑，不将日期改为今天。原构建的配置提示及历史依赖 audit 42项未在本批解决。新组合实验已单独记录实际运行、来源指纹、场景/断言、低权限身份、锁等待和清理结果。

## 协作事项与后续边界

[用户协作清单](2026-10-22-user-action-checklist.md)列出了 bucket/Storage、迁移与媒体备份、模型账户与数据条件、部署与 Auth 的只读步骤及返回格式。[四段只读 SQL](2026-10-22-user-readonly-evidence.sql)仅采集限定配置和目录信息，不读取家庭或对象内容；本地语法核验不能证明远端权限或配置合格。

真机5/20/30分钟故障矩阵按用户要求记为 `deferred_by_user / 未执行`。原 P0/G0–G4仍按[原质量门](../superpowers/specs/2026-10-13-upgrade-p0-gates.md)验收，不能用本地测试数替代生产 Storage、迁移等价/回填/回退/备份恢复、供应商资格和正式 adapter 验收。当前未提交、推送、远端迁移或部署。

下一本地实施顺序是正式媒体/Storage/删除 adapter 与旧删除兼容设计，继而按 T02→T05→T03→T04推进；具体实施须清楚区分可用本地证据与仍待取得的外部条件。最新可恢复状态见[handoff](../HANDOFF-2026-10-13-upgrade.md)，实验结果与审查入口见[证据索引](evidence/2026-10-22-pg17-rls-source-composition/README.md)。

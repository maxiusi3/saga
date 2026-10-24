# G0 / T02 远端元数据补核与迁移差异

2026-10-17（Asia/Taipei）。承接 [P0准备计划](2026-10-11-upgrade-p0-preparation.md) Task 2、[P1契约](../specs/2026-10-13-upgrade-p1-contracts.md) 和 [handoff](../../HANDOFF-2026-10-13-upgrade.md)。已有 metadata_reader 只读通道；本批优先消除正式 adapter 的未知前置条件。

## Global Constraints

- 仅使用已配置的 metadata_reader 查询 schema、RLS、索引、约束、迁移版本和可访问的 bucket 配置；不读业务行、家庭正文、录音或 Storage 对象清单。
- 不创建角色、不改变权限、不重试旧 CLI 初始化角色路径，不执行远端迁移、写入或部署。
- 凭据只在内存中读取，连接验证 TLS；输出、日志和 Git 不含密码、完整连接串、迁移作者邮箱或原始迁移 statements。错误只保存固定阶段与错误代码。
- 元数据查询在有超时的只读事务中进行；取不到的分类记录 denied/error，不把不可见/空结果当成不存在。表/字段需要 pg_catalog 和现有 audit_meta 交叉核对。
- 保存查询、结果、时间、角色、源码哈希和局限。bucket 不可见、RLS函数未审计、对象未盘点或备份未演练均不能推断通过。
- 保留当前 codex/october-upgrade-p0 分支和所有前批未提交内容；只修改本批文件。原计划 G0/G1 门槛不变，达成原里程碑才提交/推送。

## Task 1: 可复查的只读采集

- [x] 固定采集查询与凭据解析，使用现有 pg 运行时，无新增依赖。
- [x] 在已授权只读连接采集 public/storage 的实际表、字段、RLS启用状态、策略、索引、约束、ACL；核对 audit_meta 视图定义及迁移版本；bucket 配置只在角色可读取时查询。
- [x] 验证解析、超时/错误脱敏及权限缺失不报空成功；保存真实远端运行结果。用 has_table_privilege 等元数据函数核对业务权限，不执行 DDL 或业务读取来测试拒绝。
- [ ] 独立审查本批差异，修复阻断问题。子代理因模型不可用/限流未能执行，当前仅完成主代理自查，待补。

## Task 2: 差异分析与交接

- [x] 对照根 migrations、bootstrap、P1契约及当前授权代码，记录历史缺口、字段冲突、RLS风险与 adapter 迁移顺序。
- [x] 为未取得的 bucket/对象/备份/供应商证据写明确的下一步；不生成可被生产流水线自动执行的未验收迁移。
- [x] 运行项目要求的 verify、shared/infra 及实际依赖审计，保存本轮证据；构建后恢复本轮前的 next-env 字节。
- [x] 更新主计划、P0准备计划、P1契约状态与 handoff；核对文档链接、证据哈希和里程碑结论。

本批交付为远端证据、迁移差异与后续实施依据；不等于正式 adapter、备份恢复或 G0/G1 已完成。

## 本轮交付状态

采集器10项测试、项目verify（76/730、175页）、shared4/16、infra7通过；真实远端元数据已采集，bucket配置42501而保持partial。差异分析、主计划/P0/P1状态和handoff已更新；独立审查待服务可用时补做。实际audit仍42项，G0/G1未完成，无提交、推送、迁移或部署。见[本批实施记录](../../research/2026-10-17-remote-metadata-reconciliation.md)。

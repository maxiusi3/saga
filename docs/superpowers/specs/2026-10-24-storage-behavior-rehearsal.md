# PG17 Storage 完整定义行为演练

2026-10-24。承接[10月23日语义审查](../../research/evidence/2026-10-23-storage-definition-capture/semantic-audit.md)与 handoff 已确定的下一项，不改原 P0/G0 门槛。

在已有本地 PostgreSQL 17.4 runtime 中新建 socket-only 临时集群，按固定元数据重建 Storage buckets/objects，使用已验证的六函数和七触发器正文，并把 buckettype 补为 STANDARD、ANALYTICS、VECTOR。私有捕获文件只在内存读取，核对整体、每个定义/参数指纹和受限权限；不复制正文或参数到可提交源码/报告。表所有者和服务角色的本地设置必须明确标为合成角色图，不能声称生产角色继承或服务设置等价。

必需的行为证据：

1. 目录拆分：NULL、空串、无目录、正常目录、首尾/重复斜线、编码路径；独立预期值，不能用被测函数计算预期。
2. 名称：100/101 个 ASCII 和多字节字符，证明字符长度；INSERT、UPDATE OF name 及未列 name 的更新。
3. 生命周期：普通角色、R 的成员、精确 R、超级用户/本地 BYPASSRLS 的不同结果；普通空配置插入、合法成对非空插入、类型和形状约束、无变化、单字段变化、双字段变化、一起清空；STANDARD/ANALYTICS/VECTOR，UPDATE OF 列匹配与 AFTER 异常回滚。每次失败核验行未变化，记录 SQLSTATE 来源层。
4. 删除：GUC 缺失、空、on、1、TRUE、true；零行和有行 DELETE，buckets/objects 都覆盖。受控合成本地会话设置 true 后，分别证明 RLS 可见性/授权与删除保护是不同控制面；跨家庭和撤权仍拒绝/零行，允许者才删到目标。检查事务局部设置在提交/回滚后不泄漏。直接 SQL 删除只改变合成元数据，不是物理删除方案。
5. 更新时间：UPDATE、无变化 UPDATE、调用方旧时间和 upsert 都由捕获触发器改写；同事务 now() 相同，不把时间或行哈希变化说成字节变化。保留其他字段完整性验证。
6. 角色、函数属性、七个触发绑定、完整 enum 与选定列/约束/索引的 catalog 检查。缺失触发器/旧 enum 的预期失败独立留证；通过矩阵不得靠省略触发器、放宽约束或改写捕获正文实现。

采用既有 bounded Harness、冻结输入/运行时指纹、唯一脱敏 JSON 证据和 finally 清理。必须运行正常、污染 PG 环境、真实 SIGTERM、启动失败、连接失败；失败运行也保留报告，集群/临时目录/客户端清理经外部观察确认。使用最小新实验目录，旧实验/旧证据保持不变。

本批不连接远端、不读取业务行或对象、不调用供应商、不改应用/依赖/根迁移、不提交/推送/部署。真实 Storage HTTP/Auth/JWT、生产角色图、对象后端、multipart 全依赖、私有桶、真实备份恢复仍缺；真机 deferred_by_user。原里程碑未达不得推送。

# 同步导出组装观测本地验证报告

日期：2026-10-29（Asia/Taipei）。基线：`a605fbf1e`。范围：综合计划 §11 的导出完整性事件切片，不是完整运营就绪或原 G0–G4 验收。

## 接手与完成范围

本批承接[数据库运营指标接入](2026-10-29-operational-snapshot.md)，执行[导出观测实施清单](../superpowers/plans/2026-10-29-upgrade-export-observations.md)。续接检查确认 Task 1–3 的代码与测试已经完成，断点位于 Task 4 的独立审查、证据和文档收口（情况 D）；不重复前批双入口和数据库指标实现。

- 新增 `20261029000002_export_observations.sql`：仅记录随机 attempt UUID、有限状态及数据库时间，不记录家庭/项目/用户标识、对象路径、原始错误或正文。台账启用 RLS，客户端与 service_role 均无直接 DML；service_role 经受限 SECURITY DEFINER RPC 开始/结束尝试。
- SQL 禁止删除、开始时间/ID 修改与终态改写；同终态重放幂等，冲突终态拒绝并通过真实行锁串行化。新增只读、无参数、SECURITY INVOKER 的 v2 快照，单语句组合原 v1；旧迁移和 v1 保持不变。
- 导出在既有权限、容量与来源预检后、Storage 读取前持久 start；实际组装/压缩后、最终成员与墓碑检查前持久 finish。start 不可确认则不读取 Storage；finish 不可确认则返回 503，不发送 ZIP。最终墓碑检查之后不增加 await。
- SHA-256/实际字节数不符使用 `MediaExportIntegrityError`，与普通失败、取消及总容量上限区分。流读取收到取消会取消 reader；取消记录使用独立的有界 finish RPC。
- RPC 统一 5 秒截止、精确回执校验和禁止自动重试；缺迁移/服务端配置或结果未知时 fail closed。管理端严格校验 v2 数据，包括 PostgreSQL 微秒级窗口边界；真实损坏进入告警，坏事件不转成零。

## 指标口径与覆盖边界

scope 固定为 `synchronous_archive_assembly`。`verified` 仅表示服务端媒体校验与组装/压缩完成，不表示最终授权仍有效、响应已送达或客户端 ZIP/CRC 验证通过。预检拒绝不构成组装尝试。

完整性失败按终态时间统计最近 60 分钟，包含精确窗口边界；所有尚未终态事件（包括跨窗悬挂）计入 unsettled；非法状态、非有限/未来/倒序时间计 invalid。未满窗口或有未终态事件时明确标记 incomplete，但保留已知损坏的告警下界；invalid 使导出组 unavailable。

**`windowComplete` 只证明数据库台账的首次创建 epoch 已满 60 分钟。它不证明滚动部署时所有旧/新实例均已接入埋点；未接入的旧路由、其他导出通道和历史请求均不在覆盖证明内。** 重放迁移不重置 epoch，缺失/坏 epoch 被 loader 拒绝。此字段不能当作部署覆盖或端到端交付资格。

顶层管理响应仍为 `503 not_ready`。上传/浏览器直传事件没有可靠分母；实际告警响应人、投递链和供应商账户/区域/数据条件仍 unavailable，不以配置 key 或合成样本冒充资格。

## 验证与证据

完整索引见[本批证据](evidence/2026-10-29-export-observations/README.md)与[验证汇总](evidence/2026-10-29-export-observations/verification.json)。源文件哈希与成功运行后状态一致，续接不因上下文中断重复已完成的长验证。

| 验证 | 结果 |
|---|---|
| 定向 Jest（writer、v2 loader、管理路由、导出与真实 assembler） | 7 套 / 159 项通过 |
| `npm run type-check`、`npm run lint` | 均退出 0 |
| PG17.4 正常 / 污染环境 | 各 12 场景 / 464 断言通过 |
| 主流程 `node experiments/pg17-export-observations/verify.mjs` | 退出 0，12 场景 / 464 断言 |
| `npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra` | 退出 0；Web 132 套 / 1754 项、shared 4 套 / 16 项、infra 7 项、184 页构建 |

PG 覆盖真实角色 ACL、伪造 claim、直接 DML 拒绝、并发幂等/冲突、v1 兼容、时区与微秒边界、只读/快照、异常事件及清理。夹具引用 P1 四张表的精确 CREATE TABLE 块及合成前置表，不是完整迁移链或真实 PostgREST 验证。所有记录的 Unix socket、父临时目录和服务 PID 均确认已清理。

初始缺 RPC、缺迁移清单、writer/v2 与导出分类的 RED 原样保留，明确区分预期产品失败与最终通过运行。15 份终端日志保留原字节 gzip 与 SHA-256；可读版的格式规范化见索引。没有修改旧实验/迁移/证据/依赖，1398 项保护输入哈希一致，`next-env.d.ts` 已恢复原字节。

独立规格审查 PASS、质量审查 Approved；规格审查另跑 7 套/159 项，质量审查另跑 5 套/153 项均通过，无 actionable findings。最终文档/证据一致性审查单独记录于验证汇总。

## 未验收与下一步

1. 补可靠的上传尝试观测及浏览器直传协议，不从资产状态反推虚假成功率；单独证明滚动部署后的采集覆盖。
2. 连接并验证实际告警响应人/投递，以及供应商账户、区域和数据条款核验链；这些外部资格不能由本地代码宣布通过。
3. 分别推进解码/大包 Worker、真实 PostgREST/长台账性能、真机/家庭/模型和完整观察窗试点。账单完整性和客户端交付仍没有本批证明。

构建保留已有 Next 配置与 `SUPABASE_SERVICE_ROLE_KEY` 缺失提示；本批未重跑 dependency audit。方案 B 的真实备份恢复仍须负责人指令：`pg_dump -Fc`、对象存储 SHA-256 冻结清单、独立删除墓碑台账重放、`pg_restore`。

[里程碑判定](evidence/2026-10-29-export-observations/milestone-check.json)仅认可本地切片，不新增原 G0–G4 完整验收，不触发条件推送。允许验证后的本地检查点；不合并 main、不执行远端迁移/生产部署、不向外部 API 发送真实家庭素材。

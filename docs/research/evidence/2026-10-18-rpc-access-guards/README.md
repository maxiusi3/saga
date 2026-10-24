# RPC权限候选证据索引

2026-10-18。**本地验证、Task 1–3及最终整批独立审查PASS；文档与完整性核验完成。** [汇总](verification.json)记录当前状态，[研究记录](../../2026-10-18-rpc-access-guards.md)说明候选边界，[实验README](../../../../experiments/pg17-access-guards/README.md)说明运行方法。

| 文件 | 用途 |
|---|---|
| [invitation-contract-audit.json](invitation-contract-audit.json) | 五处调用/固定表约束与未来token边界；32源哈希、245行引用、184 Pointer、145元数据值、38链接 |
| [invitation-task-review.md](invitation-task-review.md) | Task 1独立规格/质量PASS |
| [implementation-verification.json](implementation-verification.json) | 初始原定义RED、116/1828及25锁等待/4类清理；冻结为历史，不证明R1修复 |
| [access-task-review.md](access-task-review.md) | 初审两轴CHANGES_REQUIRED；R1改绑到调用者的真实复现 |
| [implementation-verification-fix1.json](implementation-verification-fix1.json) | 最终依据：修复前R1 RED；修复后正常/污染环境各117/1834、26锁等待及4类生命周期；最终来源/依赖/证据哈希 |
| [access-review-fix1.md](access-review-fix1.md) | 最新Task 2独立规格/质量PASS，R1已关闭、无残留发现；前份清单的待审状态以此后续审查为准 |
| [project-checks.json](project-checks.json) | 本会话实际verify/shared/infra退出0及日志哈希，77/766、4/16、7和175页；707输入固定，next-env已恢复 |
| [final-checks.json](final-checks.json) | 最终状态回写后的本地完整性核验；与独立审查分别记录 |
| [batch-final-review.md](batch-final-review.md) | Task 3规格/质量及最终整批独立审查PASS；保留局部候选与原质量门的边界 |
| [milestone-check.json](milestone-check.json) | 原G0/G1未达成，本地批次不是里程碑，未提交/推送/部署 |

最终运行明细由fix1清单精确列出路径及SHA-256：正常运行、生命周期观察器及污染环境/SIGTERM/实际启动失败/连接失败四个子证据。清理预期退出0/143/1/1均通过，未需rescue。R1实际拒绝42501，对照已提交改绑事务后的七表快照，接受调用零写入。

原定义RED、初次GREEN、初审及修复前R1 RED均原样保留。修复清单写入时尚待复审；当前Task 2结论读取access-review-fix1.md，不能改写历史清单来制造当时已审的印象。Task 1审计的原规格/计划哈希也是历史值，verification.json另记两个有意文档更新；其他30个审计输入继续匹配。

候选保留原签名，首次project/user绑定仅提供单次调用一致性，不保证历史不可改绑或ABA检测；更强保证需未来可信版本/映射设计。无幂等键，未提供未知提交去重。正式token/确认邮箱/持久预留、可信钱包/付款来源、生产认证/ACL/RLS/Storage、历史迁移等价、bucket/备份/供应商/真实设备仍缺。依赖audit沿用前批42项失败（34 high、8 moderate），未重跑。

私有采集正文和凭据不在本目录；原始本地运行输入仍按既有受限路径保留，公开报告仅记录摘要、合成场景和安全结果。本批没有远端/auth/邮件/支付调用或生产写入。

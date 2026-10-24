# Invitation sender HTTP evidence — 2026-10-21

实现和冻结验证完成，独立规格PASS；质量Approved，文档独立审查PASS／Approved，整批审查PASS，本批本地收尾完成。以 [verification.json](verification.json) 为当前状态入口。

- [绑定规格](../../../superpowers/specs/2026-10-21-invitation-sender-http.md)、[计划](../../../superpowers/plans/2026-10-21-upgrade-invitation-sender-http.md)、[实施记录](../../2026-10-21-invitation-sender-http.md)。
- [实现报告](task-1-report.md)、[范围清单](task-1-scope.json)、[20个源码/测试指纹](task-1-source-sha256.json)。
- [20次运行清单](task-1-run-manifest.json) 列出命令、退出码、计数、原始/公开日志SHA和脱敏关系。原始日志完整保留在ignored本批恢复目录的raw-logs；公开副本只脱敏固定合成值。run01是实际旧入口RED；scaffolding、harness与中间结果不当最终证明，具体分类见实施记录。run18/19/20绑定当前冻结源码，最终GREEN均无需脱敏。
- [最终定向17套/521项](19-frozen-targeted-green.log.txt)、[类型检查](18-web-typecheck-green.log.txt)、[范围lint](20-frozen-scoped-lint.log.txt)；[独立规格PASS](task-1-spec-review.md)。
- [新项目矩阵](project-verification-20261021T022537Z-f5820706-f190-44bf-9100-8aa7dfc5b528.json)：Web101/1373、shared4/16、infra7、178页，785输入未变、next-env恢复。旧Next配置/缺key诊断保留，不作为生产通过。
- [保护输入](protected-input-sha256.json)、[前批完整性](previous-input-integrity.json)、[源码核查](task-1-fingerprint-verification.json)、[40个日志哈希](task-1-log-integrity.json)；旧SQL不重跑。
- [原质量门判定](milestone-check.json)：P0/G0–G4未达成，历史audit42项未重跑未解决，无commit/push/migration/deploy。

HTTP使用实际SDK与合成loopback；UI使用fixture列表行，仅证明取消接线，真实列表仍不可用。完整来源选择/发送管理/刷新恢复、真实事件及Auth/JWT/PostgREST/PG17 E2E、迁移回退和生产资格仍须后续验收。send成功不是邮件送达。

仓库`*.log`忽略规则不变。上述最终日志链接使用可追踪的`.log.txt`分发副本；[分发清单](published-log-manifest.json)提供全部20个副本与原审查时`.log`的同字节/hash对应。原run-manifest、原始raw/审查时.log和Task1独立报告保持不变；当前分发入口与历史文件名明确区分。

独立收尾：[质量Approved](task-1-quality-review.md)、[文档PASS／Approved](task-2-doc-review.md)、[整批PASS](batch-final-review.md)；[最终完整性](final-integrity.json)绑定完成状态后再核查。

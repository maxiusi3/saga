# 邀请管理批证据

10月21日本地实现、冻结验证与独立实现复审已完成；10月22日恢复补齐文档。文档/整批独立审查均PASS／Approved，最终完整性核验通过，本批本地收尾完成。两项收尾审查由同一位独立审查员完成，不是两份独立意见；无报告的中断尝试不计入结论。当前机器可读状态见 [verification.json](verification.json)。本目录不包含生产凭据或业务内容。

| 证据 | 用途 |
| --- | --- |
| [SQL任务报告](task-1-report.md) | 16场景2448断言、四生命周期、RED/中间失败和限制；报告中的“review in progress”是任务交付时历史状态，当前复审见下行 |
| [应用任务报告](task-2-report.md) | HTTP/UI/recovery、真实RED/GREEN与完整验证 |
| [独立实现审查](implementation-review.md) | 初审问题、修复及最终规格/质量 Approved；初审行号属于格式化前快照 |
| [源码冻结](source-sha256.json) | 14应用/测试文件及5个新SQL实验文件 |
| [项目验证](project-verification.json) | 五命令exit0，54定向、Web105/1420、shared4/16、infra7、180页；796输入与next-env |
| [日志分发](published-log-manifest.json) | 忽略目录原始输出与可入仓`.log.txt`副本、两端哈希和脱敏记录；final-*为冻结验证，其余是历史运行 |
| [前批完整性](previous-input-integrity.json) / [保护清单](protected-input-sha256.json) | 原实验/原始证据/依赖与SQL runtime pins重核；三处有意UI/测试替换独立列出 |
| [10月22日恢复完整性](resume-integrity-20261022T011825076698Z.json) | 09:18:25 Asia/Taipei只读重核输入/运行时/日志/清单/Node/next-env；全部匹配，未重跑应用或SQL测试 |
| [文档审查](task-3-review.md) / [整批审查](batch-final-review.md) | PASS／Approved，零待修项；保留审查时的文档快照哈希 |
| [最终完整性](final-integrity-20261022T110637+0800.json) | 最终文档/审查报告哈希、最新冻结输入与原质量门核验；不重跑业务测试 |
| [原质量门](milestone-check.json) | P0/G0–G4保持false，未提交/推送/迁移/部署 |

SQL最终主运行是 [14:47:16结果](sql-run-2026-10-21T14-47-16.084Z-8e804a59-f438-4c16-b9c8-3559d2bc64af.json)，生命周期是 [14:49:45观察](sql-lifecycle-2026-10-21T14-49-45.910Z-877999de-cb4b-4603-9b9e-9af16843648d.json)。每次运行均有唯一文件名，未覆盖早期证据。实际SDK/PG17的本地分层结果不证明真实供应商/Auth/PostgREST/生产权限、迁移、邮件或设备资格。

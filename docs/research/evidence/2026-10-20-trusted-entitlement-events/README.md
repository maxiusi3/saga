# 本批证据索引

当前状态见 [verification.json](verification.json)：实现和验证完成，10月21日独立规格PASS／质量Approved，文档独立审查 PASS／Approved、整批独立审查 PASS，本批本地收尾完成。数值来自已冻结源码的实际运行，独立审查状态不得由这些数值推断。

| 证据 | 用途 |
| --- | --- |
| [实现报告](task-1-report.md) | 最终文件、精确命令/退出码、输入/运行时哈希、失败记录、兼容限制 |
| [最终 RED](entitlement-red-2026-10-20T01-49-27.230Z-6936367a-ef75-4d8d-a28b-c0a3b887c8fa.json) | 合成宽松 ACL 的实际写入，以及缺入口 42883；预期失败 |
| [最终正常 PG17](entitlement-run-2026-10-20T01-49-29.584Z-84c14462-17c7-4663-8f34-dfd1ff831594.json) | 95 场景／3,211 断言、20 并发顺序、全表状态核对 |
| [最终污染环境](entitlement-run-2026-10-20T01-49-41.146Z-ad34f7f8-7fe7-46ee-b208-893dc59b3e2f.json) | 同样 95／3,211，环境变量清理 |
| [最终生命周期观察](entitlement-lifecycle-2026-10-20T01-49-40.980Z-05dcfebb-69b5-495d-b445-1d1358f52c17.json) | 四个子进程的路径/哈希、预期退出、进程/目录/连接清理 |
| [本次项目验证](project-verification.json) | 三个命令的新日志、退出 0、773 个不变输入和 next-env 恢复 |
| [控制器复核](controller-review.md) | 已检查代码与证据，明确不是独立子代理批准 |
| [10月20日完整性核验](final-integrity.json) | 旧工作保全、812个源码/依赖/运行时哈希、773应用输入、链接与证据引用 |
| [独立规格审查](task-1-spec-review-2026-10-21.md) | 10月21日PASS，无待修项 |
| [整批独立审查](batch-final-review-2026-10-21.md) | 10月21日PASS，本批本地收尾完成 |
| [本次最终完整性](final-integrity-2026-10-21.json) | 本批/续接两层边界、原始证据与实现保全 |
| [文档独立审查](task-2-doc-review-2026-10-21.md) | 10月21日PASS／Approved |
| [独立质量审查](task-1-quality-review-2026-10-21.md) | 10月21日Approved，无待修项 |
| [续接完整性](resume-integrity-2026-10-21.json) / [运行时清单](resume-runtime-2026-10-21.json) | 本次只读重核，未重跑原业务/项目矩阵 |
| [原里程碑判断](milestone-check-2026-10-21.json) | G0/G1 缺项、无推送/迁移/部署 |

所有 `entitlement-*` 文件保留唯一时间戳及 UUID。早期 RED、开发中失败、较早 GREEN 和生命周期结果是历史尝试；只有上表及实现报告指定的最终路径代表冻结版本。来源/运行时哈希在 [input-pins.json](../../../../experiments/pg17-entitlement-events/input-pins.json)，源文件不变时无需重复既有矩阵。

独立任务规格与质量审查已通过；文档独立审查 PASS／Approved、整批独立审查 PASS，本批本地收尾完成。10月20日服务错误保留为历史，已有原始输出字节和执行时间保持不变。

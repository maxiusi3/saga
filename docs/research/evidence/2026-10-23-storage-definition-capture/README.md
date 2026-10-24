# 2026-10-23 Storage 定义与旧删除修复证据

范围：[规格](../../../superpowers/specs/2026-10-23-storage-definition-capture.md)、[计划](../../../superpowers/plans/2026-10-23-storage-definition-capture.md)、[P0差距与实施记录](../../2026-10-23-p0-gap-and-storage-audit.md)。本批不修改生产配置、迁移或既有实验结果。

| 证据 | 含义 |
| --- | --- |
| [公开采集报告](capture-storage-2026-10-23T10-39-09-891Z-703d8318-8589-48d0-ba55-e519f02b74fa.json) | 一次真实metadata_reader只读会话，六函数/七触发器全部匹配；正文仅在受限忽略目录 |
| [语义审查](semantic-audit.md) | 静态读取完整定义、参数与条件，明确角色/GUC/UPDATE OF/旧夹具差异与未捕获依赖 |
| [采集器53项测试](task-1-green-all.tap) | 新17项及旧36项通过；对应各轮red/green日志原样保留 |
| [PG17最终结果](task-1-local-pg17-2026-10-23T10-30-16-139Z.json) | 34断言/4场景；只验证合成目录数据上的采集器，不执行捕获定义 |
| [PG17初次失败](task-1-local-pg17-2026-10-23T10-28-00-731Z.json) | pg_get_expr处理OLD/NEW条件报22023；后续改存原始条件及完整定义 |
| [采集规格审查](spec-review.md) · [采集质量审查](quality-review.md) | 两位独立审查员分别PASS/Approved；对应冻结采集器源码 |
| [删除修复清单](legacy-deletion-files.json) | 五个应用文件、三个测试文件的冻结SHA-256及证据说明 |
| [删除RED](legacy-deletion-red.log) · [删除GREEN](legacy-deletion-green.log) | 有效RED16失败/2通过，最终3套/18通过；red-initial夹具错误单独保留 |
| [删除规格审查](deletion-spec-review.md) · [删除质量审查](deletion-quality-review.md) | 两位独立审查员分别PASS/Approved；不宣称真实Supabase删除或进行中的上传取消通过 |
| [项目验证](project-verification.json) | 本批新执行verify/shared/infra，命令和日志、开始/结束时间、输入指纹与next-env恢复 |
| [起始输入](starting-inputs.json) | 本轮改应用前的805项源码/脚本/依赖/迁移指纹；并非基线commit内容 |

[整批独立审查](batch-final-review.md)PASS/Approved、零待修项。本批本地完成状态见[验证汇总](verification.json)，原质量门见[里程碑判定](milestone-check.json)，最终文件核验见[完整性报告](final-integrity.json)。历史依赖审计未重跑；旧42项失败记录继续有效，不将项目build通过写成audit或生产合格。6–8户观察仍0户，真机仍deferred_by_user。

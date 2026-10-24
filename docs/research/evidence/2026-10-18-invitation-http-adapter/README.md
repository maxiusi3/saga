# 邀请 HTTP 适配证据

2026-10-18（Asia/Taipei）。[实现与兼容边界](../../2026-10-18-invitation-http-adapter.md)；[当前验证状态](verification.json)。本地实现及 Task 1 独立审查通过，控制器完整项目矩阵通过；Task 2独立审查PASS/Approved；最终完整性和整批独立审查已通过，M1已修正并复核。

| 证据 | 用途 |
| --- | --- |
| [最终实现报告副本](task-1-implementation-final.md) | 原报告及追加 Fix 1；最终路径/摘要以 Fix 1 为准，前半段原输入保留追溯 |
| [旧 handler 业务 RED](task-1-old-handler-red.json) · [RED/GREEN 账本](task-1-red-green-ledger.json) | 真实旧入口失败与各类中间失败；原始日志只保留在忽略目录，公开文件仅含安全摘要 |
| [原源 manifest](task-1-source-manifest.json) · [原证据 manifest](task-1-evidence-manifest.json) | 首次候选的不可变历史输入；较早 pre-final/targeted 文件同样保留 |
| [首次完整运行失败](project-checks-20261018T133506.json) · [日志](verify-20261018T133357.log) · [初审](task-1-review.md) | 960 断言通过但 fixture 被发现为空套件；初审 Spec FAIL / Needs fixes，I1 |
| [Fix 1 discovery RED](task-1-fix-1-discovery-red.json) · [最终源 manifest](task-1-fix-1-source-manifest.json) · [定向检查](task-1-fix-1-focused-checks.json) · [证据 manifest](task-1-fix-1-evidence-manifest.json) | fixture 移至 test-support，仅三处 import 调整；194 项、discovery、类型及 lint 通过 |
| [Fix 1 复审](task-1-fix-1-review.md) | I1 ADDRESSED；Task 1 Spec PASS / Approved，无新增发现 |
| [Task 2审查](task-2-review.md) · [整批审查](batch-final-review.md) · [最终措辞修正](batch-final-fix-report.md) · [限定复核](batch-final-fix-review.md) | Task 2/整批PASS；M1已修正并独立确认，无未关闭发现 |
| [Canonical 项目检查](project-checks.json) · [成功执行 manifest](project-checks-20261018T134430.json) | 控制器本批新执行，715 输入；Web 80/960、shared 4/16、infra 7、176 页 |
| [verify](verify-20261018T134220.log) · [shared](shared-20261018T134426.log) · [infra](infra-20261018T134430.log) | 成功执行的公开安全日志，原始输出 SHA-256 由项目检查记录 |
| [旧实验指纹检查](prior-experiment-checks.json) | 24 源码、44 依赖/package、743 运行时文件及 27 原证据，共 838 项；未重跑旧 PG 矩阵 |
| [文档前完整性预检](integrity-pre-docs.json) | 预检通过；不是本批文档加入后的最终收尾 |
| [最终检查文件](final-checks.json) · [原里程碑判定](milestone-check.json) | 控制器已完成审查后的最终完整性检查；历史预检另行保留，G0/G1=false |

当前最终 Task 1 源摘要：`690149536961419859643d1e5348866856edec38311e6a4844688d997481fa9e`。前件失败、原 manifest、原审查不可覆盖；本文未改写其数据。[Task 2 独立审查](task-2-review.md)为PASS/Approved，原记录的测试归属措辞Minor M1已修正；[整批独立审查](batch-final-review.md)为本地PASS，[限定修正复核](batch-final-fix-review.md)确认M1 ADDRESSED，无新增发现。

真实 Supabase SDK 对接的是合成本地 loopback Auth/REST fixture；证据不等于真实 JWT、PostgREST/PG17 集成或生产授权。默认关闭且无旧接受写入回退；生产开关未启用。缺服务端 key/旧 Next 配置提示仍在，audit 42 项未重跑且未解决。可信权益来源、旧入口/直表/RPC 关闭、历史兼容及原 G0/G1 仍待完成；无提交、推送、迁移或部署。

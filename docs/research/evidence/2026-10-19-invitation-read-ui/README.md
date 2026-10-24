# 邀请只读兼容与恢复 UI 证据

2026-10-19（Asia/Taipei）。[行为与边界](../../2026-10-19-invitation-read-ui.md)；[验证汇总与不可变证据 SHA-256](verification.json)。Task 1 的 I1 修复已独立批准，固定代码后的完整项目矩阵通过；**Task 2文档独立审查、整批独立审查及最终完整性均已通过**。

| 证据 | 用途与当前解释 |
| --- | --- |
| [最终实现报告](task-1-implementation-final.md) | 原报告及 Fix 1 追加；前半段 250 项/原源码冻结已被后半段 253 项/修复源码取代 |
| [初次实现报告](task-1-implementation.md) · [初次源码 manifest](task-1-source-sha256.json) · [初次源码核对](controller-source-check.json) | 修复前不可变历史，不作为最终源码证明 |
| [读取 RED](red-read-routes.txt) · [读取 GREEN](green-read-routes.txt) | 旧真实 handler 关闭开关失败 3 项；修复后 18 项实际 SDK＋合成 loopback 读取路由测试通过 |
| [初步 UI RED](red-recipient-ui.txt) · [正式行为 RED](red-recipient-behaviors.txt) · [初始 GREEN](green-recipient-ui-initial.txt) | 初步 fixture 调整有单独记录；正式旧页面 36 failed → 36 passed，非缺模块失败 |
| [自审账号返回 RED](red-account-return-count.txt) · [初次定向通过](focused-tests.txt) · [type-check](type-check.txt) · [lint](lint.txt) | 自动读恢复缺陷修复后的 250 项历史冻结；更早 type/lint 的 initial 捕获也保留 |
| [Task 1 初审](task-1-review.md) | I1：同一 React batch 离开/返回同账号可接纳旧结果；Needs fixes。M1：旧构建警告/缺配置诊断保留为独立清理项 |
| [I1 RED](fix-1-red.txt) · [GREEN](fix-1-green.txt) · [完整定向回归](fix-1-focused-tests.txt) | 2 failed / 1 passed → 3 passed；最终 5 套 / 253 项，新增身份代次与同账号刷新行为覆盖 |
| [最终源码 manifest](fix-1-source-sha256.json) · [控制器核对](controller-fix-1-source-check.json) | 18 个源输入；仅组件与其测试较初次冻结改变，原 manifest 不覆盖 |
| [修复类型检查](fix-1-type-check.txt) · [lint](fix-1-lint.txt) · [diff-check](fix-1-diff-check.txt) | 实现者报告均退出 0；lint/diff-check 是正常空输出 |
| [Task 1 限定复审](task-1-fix-1-review.md) | I1 ADDRESSED，规格/质量 Approved；无新增阻塞，仍要求修复后全量及余下批次审查 |
| [初次项目运行](project-verification-20261019T022711Z.json) | 修复前 Web 82/1016、shared 4/16、infra 7、176 页通过，仅作历史；对应三个原始日志保留 |
| [最终项目运行](project-verification-20261019T023821Z.json) · [verify](project-verify-20261019T023821Z.txt) · [shared](project-shared-20261019T023821Z.txt) · [infra](project-infra-20261019T023821Z.txt) | 控制器修复后新运行：Web 82/1019、shared 4/16、infra 7、176 页；751 输入未变，next-env 恢复 |
| [原证据扫描](task-1-evidence-scan.json) · [修复证据扫描](fix-1-evidence-scan.json) | Task 1 可发布捕获的凭据模式检查；不是读取环境文件或认证隐私验收 |
| [前批引用核对](prior-evidence-check.json) | 前批 HTTP 直接引用指纹一致；旧 PG17 矩阵未重跑 |
| [完整性检查文件](final-integrity.json) · [里程碑判定](milestone-check.json) | 完整性文件已由控制器在审查与最终状态更新后重生成并通过；G0/G1=false，无推送 |

最终 253 项由 **18 项新读取路由 SDK 测试＋41 项 React 行为测试＋194 项既有回归**组成。React 测试在 fetch/auth/router 边界使用合成数据，194 项含 protocol、client/facade、acceptance handler 三种层次；全部 253 项不能统称真实 SDK 或提供方验证。实际 SDK 连接本地合成 Auth/REST，不证明真实 JWT、PostgREST schema、PG17 端到端或生产 RLS/ACL。既有 PG17/HTTP 证据保留原日期与执行归属。

本批 token GET 默认关闭；pending discovery 始终明确 503。可信最小预览、历史 opaque token/member 映射、可信权益 source/event、发送/取消/邮件和直接 RPC/表权限仍待完成。signin/callback 旧日志及 `auth_next` 持久化是独立发布阻塞。构建旧警告/缺配置与 audit 42 项未解决；未提交、推送、远端调用、迁移或部署。

[Task 2 文档独立审查](task-2-review.md)：Spec PASS / Approved，无新增发现；最终整批审查已通过。

[整批最终独立审查](batch-final-review.md)：本地候选 PASS / Approved，无新增 Critical/Important/Minor，既有 M1 与原质量门缺口保留。

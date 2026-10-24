# 认证会话衔接证据索引

当前本地实现完成，Task 1规格复审PASS、质量复审Approved且无新规格问题；最终源码后的项目检查通过。文档独立审查、整批独立审查与最终完整性均已通过。先读[实施记录](../../2026-10-19-auth-session-integration.md)、[验证汇总](verification.json)及[原G0/G1判定](milestone-check.json)。真实提供方/部署资格仍开放，无GitHub推送。

## 最终证据

| 材料 | 内容 |
|---|---|
| [fix2源码冻结](fix2/source-freeze-fix2.json) | 当前21个源码/脚本路径；恢复目录frozen-source.json绑定同一源码与新项目报告 |
| [项目报告](project-verification-20261019T123731Z.json) | 2026-10-19T12:37:31–12:40:22Z；773输入不变，next-env恢复；三命令exit 0 |
| [verify](project-verify-20261019T123731Z.txt) · [shared](project-shared-20261019T123731Z.txt) · [infra](project-infra-20261019T123731Z.txt) | Web96套/1278项、shared4套/16项、infra7项、176页；构建保留configuration-validation与旧Next配置诊断 |
| [最终定向](fix2/focused-final.log.txt) | 28套/605项，含认证、邀请及相关录音回归 |
| [Chromium结果](fix2/browser-results.json) · [日志](fix2/browser-final.log.txt) · [截图](fix2/browser-session.png) · [清理](fix2/browser-cleanup.json) | 14项，真实SDK/导航/cookie与生产facade/store/callback/guard的合成桥；两条预期负例401；listener/socket/browser/temp清理 |
| [typecheck](fix2/typecheck-final.log.txt) · [lint](fix2/lint-final.log.txt) · [fix2执行报告](task-1-fix2-report.md) | 类型与五路径lint exit 0，空lint日志的退出观察由执行报告记录 |
| [规格复审](task-1-spec-fix1-review.md) · [独立定向](spec-fix1-focused-review.log.txt) | 两个P2关闭，PASS；2套/23项；发生于fix1 |
| [质量复审](task-1-quality-fix2-review.md) · [独立定向](quality-fix2-reviewer-focused.log.txt) | 一个P1和两个P2关闭，Approved、无新规格问题；5套/41项；21源哈希和7浏览器输入已核对 |
| [独立连续性探针](quality-fix2-reviewer-event-probe.json) · [独立guard探针](quality-fix2-reviewer-guard-probe.json) | 1 mount/0 unmount、刷新getter返回当前token；暂时故障503不删cookie、恢复成功 |
| [文档独立审查](task-2-review.md) | Spec PASS / Quality Approved；核对原始日志、链接/哈希、原质量门及续接方向 |
| [整批独立审查](batch-final-review.md) | Spec PASS / Quality Approved；[最终完整性](final-integrity.json)通过 |
| [运行时版本](runtime-versions.json) | 实际安装SDK/Next/Node等版本，未更改依赖 |

合成bridge不是完整Next部署、真实Google/SMTP、JWT签名/RLS/PostgREST或真机录音验收。组件行为、刷新/分块/截止及录音回归各有独立层次，不把它们全部计作浏览器检查。

## 保留历史与发布副本

- [最初实现报告](task-1-report.md)、[初始源码冻结](source-freeze.json)、[原35项manifest](evidence-sha256.json)：18套/505项属于原源码，原RED和中间失败不可替代最终结果。
- [初始RED](red.log.txt)、[guard/home RED](red-guard-home.log.txt)、[首个GREEN尝试](green-attempt-1.log.txt)：真实行为失败和缺TextEncoder的测试环境失败分开记录。
- [浏览器尝试1](browser-attempt-1.log.txt)、[尝试2](browser-attempt-2.log.txt)：NextRequest loopback正规化造成的harness失败和清理；[首次14项成功](browser-attempt-3.log.txt)保留。
- [中间focused](focused-final-attempt-1.log.txt)、[bare invite裁定前](focused-before-home-ruling.log.txt)、[guidance RED](red-home-guidance.log.txt)、[token竞态RED](red-token-race.log.txt)：既有邀请断言未弱化，过渡结果不作最终证明。
- [规格初审](task-1-spec-review.md)、[fix1报告](task-1-fix1-report.md)、[fix1确认RED](fix1/red-confirmed.log.txt)、[fix1最终](fix1/focused-final.log.txt)、[fix1 manifest](fix1/evidence-manifest-fix1.json)：两P2修复；19套/515项属于fix1历史。
- [质量初审](task-1-quality-review.md)、[fix2确认RED](fix2/red-confirmed.log.txt)、[fix2初次GREEN](fix2/green-attempt-1.log.txt)、[fix2 manifest](fix2/evidence-manifest-fix2.json)：连续性、成功刷新和故障cookie保留的真实RED/GREEN，原review/probe保持。
- [发布日志别名清单](published-logs.json)：38份`.log.txt`副本与忽略的`.log`原件逐字节一致；公开索引和verification引用可提交的副本。原报告/manifest的`.log`路径仍指本地原件，没有改写日志、历史manifest或`.gitignore`。另外的独立质量复审日志原生使用`.log.txt`。

恢复目录`.superpowers/sdd/2026-10-19-upgrade-auth-session-integration/`保留baseline、before、brief、原始review、计划ledger与控制器源码绑定。报告中的“审查/项目验证待完成”表示作者提交当时状态，最新结论以上表及verification为准。最终完整性由控制器另行记录，不通过循环自哈希引用该可变结果。

# 认证回跳批证据索引

2026-10-19（Asia/Taipei）。[实施记录](../../2026-10-19-auth-return.md) · [绑定规格](../../../superpowers/specs/2026-10-19-auth-return.md) · [实施计划](../../../superpowers/plans/2026-10-19-upgrade-auth-return.md) · [机器可读汇总与 SHA-256](verification.json)。

Task 1 独立 Spec PASS／Quality Approved，M1 文案已修正并独立核验。控制器新项目检查通过；Task 2 文档独立审查、最终完整性与整批独立审查均已通过。开放 RB1 是实际页面前后已观察到的 implicit-fragment 混合错误输入兼容变化；G0/G1=false，不具备发布资格，无提交／推送。

## 当前权威证据

| 产物 | 内容与状态 |
|---|---|
| [最终 v2 九文件清单](final-source-sha256-v2.txt) | 权威源码／测试／fixture SHA-256；替代保留的 provisional manifest |
| [最终 v2 定向与邀请回归](final-v2-focused-and-invitation-regressions.txt) | 8 套／430 项全部通过，exit 0；177 本批＋253 前批回归，无跳过 |
| [最终 v2 类型检查](final-v2-typecheck.txt) · [最终 v2 九文件 lint](final-v2-scoped-lint.txt) | 各 exit 0；lint 无警告／错误 |
| [控制器完整项目报告](project-verification-20261019T033925Z.json) | 11:39:25—11:41:51 Asia/Taipei；757 输入未变，next-env 恢复 |
| [新 verify 原始输出](project-verify-20261019T033925Z.txt) | exit 0；Web 85 套／1,196 项、类型／lint、176 页；旧配置／环境警告仍在 |
| [新 shared 原始输出](project-shared-20261019T033925Z.txt) · [新 infra 原始输出](project-infra-20261019T033925Z.txt) | 各 exit 0；shared 4 套／16 项，infra 7 项 |
| [Task 1 实现报告](task-1-report.md) · [Task 1 独立审查](task-1-review.md) | Spec PASS／Quality Approved；scope approval 不清除 RB1 |
| [M1 文案限定核验](task-1-M1-wording-verification.txt) | 原 RED 只执行 full-URL/error sentinel；code/token_hash 日志来自旧源码检查；两份报告一致，九文件未变 |

## 开放兼容性阻塞

[前后探针原始输出](implicit-fragment-compatibility-probe.txt)与[探针源码副本](implicit-fragment-compatibility-probe-source.txt)记录相同 `error=auth_failed`＋合成 implicit fragment：旧页面 setSession=1、navigation=1；当前均为 0、fragment 清除并显示固定错误。1 个 probe test 通过、exit 0。探针挂载实际旧／新页面，替换 SDK/router；临时测试文件 finally 删除，没有真实 provider/browser redirect 链验证。

共享 plain supabase-js factory 仍用默认 implicit flow／localStorage，server callback 读不到 fragment，错误与凭据混合输入现在安全拒绝。保留 Google/OTP 入口、安全 redirect 请求形成和无错误参数的显式 signin session-return，不证明端到端兼容。**下一实施工作先解决实际 OAuth/OTP 返回路径及 browser/SSR 会话衔接，再做可信 source/event、send/release、直接 RPC／表 ACL。** provider 丢 next 时 dashboard 回退，auth_next 只删不读，无替代缓存。

## 保留的失败与中间结果

| 原始产物 | 归属与解释 |
|---|---|
| [原源码行为 RED](red-existing-behavior.txt) | 2 套／5 项失败，Jest/npm exit 1；外层 shell 后续显示日志而 exit 0，不是测试成功 |
| [原 signin RED 源码](red-existing-signin-test-source.txt) · [原 callback RED 源码](red-existing-callback-test-source.txt) | 对应初始五项实际执行；原应用字节在 recovery before/ |
| [扩展契约 RED](red-contract-tests.txt) | 2 套失败、29 failed／1 passed、exit 1；含缺 helper 导入，不能全作行为 RED |
| [首次实现测试](first-implementation-tests.txt) | 57 failed／77 passed、exit 1；非 configurable SDK export spy 的测试 harness 错误 |
| [fixture 修正运行](callback-fixture-run-2.txt) | 实际 SDK callback 57 项通过，exit 0 |
| [opaque code／长 session RED](red-opaque-and-long-session.txt) | 2 failed／103 passed、exit 1；真实输入字母表与输出长度错误 |
| [定向第 3 次](focused-tests-run-3.txt) · [callback 边界追加](callback-extra-edge-tests.txt) | 158 项与 74 项分别通过，exit 0；均为中间结果 |
| [首轮邀请组合回归](focused-and-invitation-regressions-run-1.txt) | 8 套／411 项通过，exit 0；后续已增加测试并修改源码 |
| [首次类型失败](typecheck-run-1.txt) · [首次 lint](scoped-lint-run-1.txt) | 类型 exit 2（union 推断问题）；lint exit 0 |
| [旧冻结 414 项](final-focused-and-invitation-regressions.txt) · [旧类型](final-typecheck.txt) · [旧 lint](final-scoped-lint.txt) · [旧源码清单](final-source-sha256.txt) | provisional freeze；由 v2 取代，保留为历史，不作为当前源码证明 |
| [原生上下文／输出 token RED](red-native-context-and-session-tokens.txt) · [同组 GREEN](green-native-context-and-session-tokens.txt) | 16 选中项先失败后通过、161 项按 pattern 过滤，exit 1 → 0；最终 v2 无跳过 |
| [Task 1 起点保全核验](baseline-preservation-audit.txt) | 当时 1,696 起点文件仅 3 应用文件变更、1,693 相同、0 缺失；不是 Task 2 后最终核验 |

## 证据可解释范围

React 测试替换 SDK/router/store 边界；callback 真实 SSR/JS SDK 仅对接合成 loopback Auth fixture。实际运输证据包括选定的一次 POST、六类 OTP、PKCE、过期 cookie 值隔离、分块／删除 cookie options、body/十秒截止／abort 与清理。没有真实 Google/邮件、JWT、PostgREST、生产权限、浏览器／SSR 会话一致性或 G1 真机验收。

本批未改依赖、旧实验／运行时、根迁移或前批证据。audit 未重跑，前批 42 项（34 high／8 moderate／0 critical）及 exit 1 仍有效；旧 Next 配置／弃用提示与服务端环境配置错误不因构建成功而解决。最终审查、全批八个既有获准路径完整性和门槛结论已由控制器按实际结果归档，见下列收尾证据。

## 续接收尾证据

| 产物 | 实际结果 |
|---|---|
| [Task 2 独立文档审查](task-2-review.md) | Spec PASS／Quality Approved，无新增文档缺陷；旧构建诊断继续单列 |
| [最终整批独立审查](batch-final-review.md) | 本批范围 PASS／Approved；RB1 与原质量门仍开放 |
| [恢复核验](resume-validation.json) | 757 个项目输入、九个源码指纹及原始通过日志一致；本次未重跑全量测试 |
| [最终完整性](final-integrity.json) | 当前链接、哈希、八个既有获准路径及工作树保全检查通过 |
| [原里程碑判定](milestone-check.json) | G0/G1=false，不提交／推送／迁移／部署 |

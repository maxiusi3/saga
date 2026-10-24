# 固定触发函数采集入口独立审查

结论：**PASS（采集前代码审查门）**。规格与代码质量均未发现需要修复的可操作问题。本结论仅覆盖新增入口、测试及所复用的既有边界，可供主控制器执行计划已经授权的一次固定目标只读采集；不表示远端采集、私有定义语义审核或 Task 1 全部完成。

审查日期：2026-10-18（Asia/Taipei）。审查依据为 [计划 Global Constraints / Task 1](../../../superpowers/plans/2026-10-17-upgrade-pg17-routines.md)、任务 brief、固定 review diff、[实现报告](trigger-implementation.md)及其证据。未执行远端调用、未读取凭据或私有远端定义、未修改代码、未提交，也未重跑未变化的测试。

## 规格核对

- [入口第 18–24 行](../../../../scripts/inspect-supabase-trigger.cjs#L18)先核对完整快照字节 SHA256，再选择唯一的 `public.update_updated_at_column()`，验证零参数、`kind=f`、`return_type=trigger` 与固定 MD5。独立重算快照 SHA256 为 `8b2a4647b017305183e67b2b932be02080a789dba4fc48b23b2f23a97991e66e`；其中唯一目标的 MD5 为 `3bfa5e64985d89e65932564c89520d5b`。
- [第 35–45 行](../../../../scripts/inspect-supabase-trigger.cjs#L35)在凭据读取和客户端创建之前拒绝任何 CLI 参数并完成快照验证。没有增加目标、路径或连接覆盖配置。
- [第 46–53 行](../../../../scripts/inspect-supabase-trigger.cjs#L46)直接复用原 `collect`、`TARGET_SQL`、`validateRows` 和 `savePrivateCapture`。查询仅传递一个精确身份，只读取 catalog 定义，不执行目标函数或查询业务关系。缺失、属性漂移、正文摘要漂移不能报告 `captured`；畸形、重复、意外身份或虚假摘要作为错误处理。
- 共享配置固定 metadata_reader 与项目，保留 TLS CA 和主机名验证。实际使用的 pg 驱动将固定主机名传给 Node TLS 的 `servername`，入口没有覆盖验证函数。共享事务仍为 `REPEATABLE READ READ ONLY`，核验后端 10s/2s/15s 限时，并在异步驱动边界使用 90 秒截止、回滚及关闭/强制清理。
- 私有结果由既有保存器写入 `supabase/.temp/routine-audit/`；新 `capture-trigger-…json` 文件名符合其白名单。保存器验证目录链、0700 目录、0600 普通文件、独占创建与保存后的身份/权限。`git check-ignore` 确认该目录匹配 `.gitignore:41`。公共报告只保留固定身份、哈希、状态和安全验证元数据，正文从公共结果中移除。

## 质量与验证证据

**可操作发现：无。** 新入口保持最小编排，安全查询、结果校验、落盘及连接生命周期继续由既有模块承担，未复制这些实现或引入依赖。

独立检查了 [新增测试](../../../../scripts/__tests__/inspect-supabase-trigger.test.cjs)的虚构输入和 VM 边界：只替换外部 pg、路径、凭据/CA 读取及计时器；目标选择、共享模块、实际临时文件权限和持久化代码继续执行。测试覆盖身份/摘要/缺失/漂移、CLI 与配置拒绝、公开输出不含虚构秘密、TLS/后端身份/权限拒绝、文件模式、卡住的连接/读取/回滚/关闭及关闭失败后的证据保留。固定真实摘要没有被虚构正文冒充；匹配路径在共享 collector 层以虚构目标验证，入口集成路径以真实固定目标验证 drift。

独立解析现有 TAP，计数与 [执行清单](trigger-implementation-verification.json)一致：

| 证据 | 清单记录的退出码 | 通过 / 总数 | 失败 | 跳过 / 取消 |
| --- | --- | --- | --- | --- |
| [RED](trigger-red.tap) | 1 | 0 / 17 | 17 | 0 / 0 |
| [新增 GREEN](trigger-green.tap) | 0 | 17 / 17 | 0 | 0 / 0 |
| [回归 GREEN](trigger-regression-green.tap) | 0 | 69 / 69 | 0 | 0 / 0 |

RED 的 17 个失败均为入口尚不存在的明确断言，与报告描述一致。回归 TAP 包含 52 个原有测试和 17 个新增测试，真实 catalog 用例有通过记录且未跳过。其源码明确要求 PG16，不能作为 PG17 证据。退出码采用保存的执行清单记录，本次未重新执行历史命令。

重新计算并核对了实现报告所列的全部六个 SHA256，以及执行清单内七个既有源码/测试的 SHA256。七个既有文件还与实施前 `baseline.json` 中的值完全一致。两个新增文件与固定 review diff 的新增内容逐字节一致，未发现尾随空白。

| 审查对象 | 已核对 SHA256 |
| --- | --- |
| 入口 | `28550950685ec509a2e20c7e8992caac28be5c690b69ecb65c69332b31eeb7e5` |
| 新增测试 | `71b3fd0909cc94bedb1da93143d00e7c880c6d4b42e3d8728205ce6295f0f1c2` |
| 执行清单 | `7288fce0ea0f2f1063e35f7da18f10eadd6acd4919ebfd7268abe67e9e7beb2c` |
| 固定 review diff | `fc06db0648931405a1d2880f4797aa9620a5342afef976a70d5a37019a0a55e9` |
| 实施前 baseline | `1c8da3032ea4039811e68e9a87403cff2ff688785dcb1f36aded831019325fb4` |

## 本审查不能确认的依赖

- 当前远端凭据、证书链、网络、metadata_reader 权限及目标是否仍匹配快照，必须由主控制器的一次固定目标采集报告确认。本次没有读取凭据，也没有建立远端连接。
- 触发函数真实正文、外部副作用和依赖仍须在私有采集后审核；固定名称和匹配哈希不构成语义安全证明。
- PG17.4 精确重放与 Supabase 差异属于后续实验。本审查中的虚构版本字段及原 PG16 catalog 回归不能代替该证据。

主控制器只应在当前入口及共享源码哈希保持一致时沿用本门结论。若真实采集报告为 drift/error，应保留该证据并按计划处理，不能将其当作已匹配定义投入精确重放。

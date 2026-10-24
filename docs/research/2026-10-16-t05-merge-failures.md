# T05 本地合并：已知错误、原子重试与私有输出保留

2026-10-16（Asia/Taipei）。承接[真实本地文件接入](2026-10-16-t04-t05-local-merge.md)与[本批计划](../superpowers/plans/2026-10-16-upgrade-t05-merge-failures.md)。R1修正后的本地验证与独立复审均已通过；不是 G0/G1 验收或生产 adapter。

## 错误处理变化

此前缺源、坏块与读取超时直接抛错，任务仍为 running，租约恢复后保守进入 outcome_unknown。本批在实际失败处产生结构化错误，仅在 prepare 尚未成功返回、且本次局部资源已正常清理时处理明确的本地失败。

| 情况 | 本批行为 |
|---|---|
| 缺源、非私有 regular file、大小/hash不符 | 固定永久错误 code，持久 failed，不重试坏输入 |
| 进程成功退出但无有效 PCM、实际时长超限 | 子进程退出后记录永久错误；不能显示合并成功 |
| adapter 自己的源读取超时、实际读取边界的 EAGAIN/EINTR/EBUSY/ETIMEDOUT | 原预算内重试，退避1/2/4/5秒，后续封顶5秒，耗尽 maxAttempts 后 failed |
| 普通异常、伪造 code/prototype、FFmpeg 不可用、通用非零退出/诊断、解码 watchdog 超时、诊断溢出、外部进程信号、不明确资源问题 | 不推断为已知失败，维持原保守异常/未知恢复路径 |
| 停止、取消、删除、撤权、失租、输入/attempt变化 | 优先执行现有拒绝与隔离规则，不能因分类而取得重试或发布资格 |
| prepare 已返回后的回读、guard、发布或 COMMIT 错误 | 保持未知结果隔离；私有输出不自动重试、复用或删除 |

错误身份由真实构造、固定 code 和不可变实例共同确定，不匹配 message。即使停止信号的 reason 本身是已知错误实例，也优先取消。attempt 只保存 `{code, disposition, phase: 'prepare'}`，不保存原始路径、诊断或任意错误消息。测试 harness 的详细失败日志只涉及本批虚构本地素材。

失败结算与发布使用相同 job→queue 锁序，核对 owner/attempt、queue ID/retryCount、冻结输入摘要、权限标志/墓碑、数据库时钟和租约。事务同时保存 snapshot、当前 attempt 的失败审计、必要的延迟消息及旧 envelope 确认；提交前再查停止信号及截止时间。任一步失败整笔回滚，不能丢失待处理任务或遗留独立重试消息。新消息只含 jobId，沿用原 expire/heartbeat 限制；startAfter 不早于 notBefore。提前到达的重复消息安全确认，不增加业务 attempt。

终态 failed 不自动重置。输入需要修复时，后续业务 adapter 必须明确新的输入版本和任务身份，不能静默修改冻结清单或清零预算。通用 `processing-jobs.ts` 状态机、runner/supervisor及外部清理观察器逻辑保持本批开始时内容。

## 最终本地验证

| 验证 | 结果 | 证据 |
|---|---|---|
| 已知失败与有界重试 | 42场景 / 371断言，退出0 | [fix1-failure-final.json](evidence/2026-10-16-t05-merge-failures/fix1-failure-final.json) |
| 完整真实合并 | 52场景 / 402断言，退出0 | [fix1-merge-regression-final.json](evidence/2026-10-16-t05-merge-failures/fix1-merge-regression-final.json) |
| 原T05全量回归（R1修复前；执行源码未变） | 39场景 / 307断言，退出0 | [t05-regression-final.json](evidence/2026-10-16-t05-merge-failures/t05-regression-final.json) |
| 定向单元 | 3套 / 69项，退出0 | [fix1-unit-green.log](evidence/2026-10-16-t05-merge-failures/fix1-unit-green.log) |
| 项目verify | Web76套 / 730项、类型/lint、175页构建，退出0 | [fix1-project-checks.json](evidence/2026-10-16-t05-merge-failures/fix1-project-checks.json) |
| shared / infra | 4套16项 / 7项，退出0 | 同上；未受后续TS兼容修复影响的结果保留 |

R1修复后的两份集成报告全部源码指纹匹配当前文件，均确认直属子进程、进程组、runner PID及进程内任务无遗留，临时数据库停止、目录删除、清理错误为零，见[最终运行与清理核验](evidence/2026-10-16-t05-merge-failures/fix1-final-verification.json)。原T05的39/307在本轮R1修复前运行；其实际执行的store/worker/runner/supervisor/verify/supervision/state源码仍与报告哈希相同，未为只改解码器重复运行。原报告附带的README和合并场景哈希已经变化，不能声称其所有指纹仍匹配；这些路径由修复后的两份合并/失败报告覆盖。构建前 next-env 已恢复，根/Web manifest、两个 lockfile 和通用状态机与本批开始时相同。前批结果保留为历史，不再声称其旧指纹代表修改后的源码。

新增覆盖包括修复超时后成功、context重开、预算2与5、退避封顶、过早重复投递、失败状态/attempt/入队/确认回滚、两种行锁等待及最终提交前到期、queue/business attempt/input fencing、撤权/删除/取消、结构化停止reason、cleanup失败，以及 runner 在永久失败后继续处理后续合法任务。完整合并回归保留准备后进程死亡、COMMIT实际提交但回执丢失、实际未提交、真实解码关闭等原场景。

OS错误在真实filesystem调用边界注入固定errno，并非自然故障发生率证据；故障时序中的暂停、逻辑参数和FFmpeg输入节流不替代真机长录音。外部清理观察器的所有权/停止逻辑未改，因此未重复其此前9场景或无关300秒合成soak；本批真实文件与进程关闭路径有上述新运行。

运行时是现有 Node22.22.2、PostgreSQL14.17、pg-boss12.37.1、pg8.16.3和FFmpeg7.1。默认 Homebrew FFmpeg8.0.1 因缺 libvpx.11 不可用，改用前批已存在的7.1，其SHA256仍为 `4a4a968b98859588e98500ae25973d80a5ca5eed0724222b9f76360dcb72a001`；没有安装或修改运行时。该nonfree构建只用于本地验证，生产来源与许可仍需落实。

## 失败证据与修正

[独立初审](evidence/2026-10-16-t05-merge-failures/review-initial.md)确认R1：通用非零退出或短stderr也可能是启动后运行时依赖缺失、资源故障，不能自动解释成永久输入错误。裁定保留这些未知状态，不匹配诊断文字；只保留有明确证据的PCM/时长错误分类。代价是部分损坏音频仍需后续核对。新增实际Node子进程按固定脚本退出127/1/0并输出合成诊断，验证等待close、PID退出及取消监听清理；这不是自然OS故障实测。三项分类断言先RED后GREEN，实际FFmpeg损坏音频也验证先保持running且无失败审计/重试/产物，租约恢复后进入outcome_unknown，额外投递不增加attempt。修复后69项单元、42/371失败场景和52/402完整合并均通过；[独立复审](evidence/2026-10-16-t05-merge-failures/review-final.md)已关闭R1，没有新增Important或Critical问题。

单元RED记录8个缺失行为失败；[缺源RED](evidence/2026-10-16-t05-merge-failures/integration-red-missing-confirmed.json)与[超时RED](evidence/2026-10-16-t05-merge-failures/integration-red-timeout-confirmed.json)均复现未持久分类且完整清理。初次项目verify因当前TS类型库不支持 `Object.hasOwn` 和 `Error cause` 退出2，见[初次结果](evidence/2026-10-16-t05-merge-failures/initial-project-checks.json)；改成兼容调用后重新通过，未改tsconfig或依赖。

中间JSON保留真实failed状态：日期断言丢毫秒、测试池连接包装器丢callback行为、故意销毁流的完成信号、清理夹具误取消其他待投消息等已修正；文件名含green不代表通过。最终以表内文件为准。构建日志仍有watchman recrawl、旧Next eslint配置项和缺少服务端Supabase变量的提示；退出0不代表生产配置齐备。

## 私有输出保留与未来回收契约

已准备输出、崩溃遗留和COMMIT回执未知沿用私有保留策略。输出可读性仍由已提交的受检引用决定，文件存在、文件年龄和任务暂时没有可见引用都不是发布或删除依据。

未来GC必须先增加持久候选身份与发布/回收协调：

- 输出绑定reference、任务、业务attempt、冻结输入摘要、创建/准备状态；源块与输出分开，不按basename猜测来源。
- 有已提交引用、仍可能写入/提交的attempt或提交结果未核对的输出一律保留。查引用与物理删除之间要有持久回收声明；发布事务检查同一声明、争抢同一把锁，避免“查无引用”后又提交新引用。
- 回收前证明旧attempt失效、所有发布路径受同一fence保护，并在数据库核对提交结果。查询失败、未知事务结果、取消或身份失败均停止回收。进程退出和超时不证明COMMIT失败。
- 先保留身份与回收状态，再幂等删除唯一私有对象；区分确认不存在与无法确认。中途退出可重入，不先删唯一定位记录。
- 正式Storage的版本、并发写入和删除语义尚未核实。TTL只能筛候选，不能替代安全证明。

这些是后续实现的验收条件，本批没有自动GC、原块删除或未知输出复用；长期磁盘容量与孤立件运维仍待完成。

## 里程碑与下一步

当前[依赖审计](evidence/2026-10-16-t05-merge-failures/audit-high.json)实际退出1：42项，34high/8moderate/0critical。限定范围的[凭据存在性检查](evidence/2026-10-16-t05-merge-failures/readiness.json)仍未发现此前四类数据库凭据；没有重新尝试被42501拒绝的CLI角色初始化、修改权限或运行远端SQL。该检查不排除其他合法只读通道存在。

G0缺实际migration history/schema/RLS、bucket/资产权限、备份回退及供应商账户条件；G1缺正式会话/Storage/资产adapter、真机5/20/30分钟中断矩阵与正式跨家庭/原件交付验收。见[里程碑核对](evidence/2026-10-16-t05-merge-failures/milestone-check.json)。本批不是原计划里程碑，未提交、推送、部署或远端迁移。

下一步优先取得合法只读证据并对照正式adapter。若仍受阻，可按上述契约在隔离实验中设计持久输出候选与发布/回收互斥，先做未知COMMIT、发布/删除竞争和崩溃重入的负例，再决定是否实现GC；不能直接按文件年龄清理。剩余依赖工具链与G1真机保持独立待办，不重复已完成的本地错误分类。

最终交接已更新，完整证据索引见[verification.json](evidence/2026-10-16-t05-merge-failures/verification.json)。本批实现与增量独立审查完成；G0/G1及原计划里程碑仍未完成。

# T05 私有输出持久登记与发布互斥

2026-10-16（Asia/Taipei）。承接[保留/回收契约](2026-10-16-t05-merge-failures.md#私有输出保留与未来回收契约)，实施范围见[本批计划](../superpowers/plans/2026-10-16-upgrade-t05-output-candidates.md)。实现、本地最终验证及独立审查均已完成；不是正式Storage adapter或G0/G1验收。

## 本批约束

输出文件与PostgreSQL没有共同事务。文件存在不等于发布成功，没有可见引用也不等于可以删除。本批增加持久候选身份与禁止发布的隔离声明，不运行物理GC。

每个reference在文件创建前就绑定job、业务attempt、worker、queue ID/retryCount和冻结输入digest；prepare完成后存输出元数据，进入发布前先单独持久记录publishing意图。最终published状态与artifact引用、业务成功、attempt及队列确认同事务提交。读取前后都核对同一published候选、成功attempt、冻结输入和artifact元数据。真实录音仍不能走synthetic review/reconcile路径。

| 持久状态 | 含义与保留规则 |
|---|---|
| reserved | 已登记，可能尚未开始、正在写或在崩溃中断；保留 |
| prepared | 完整准备后登记的不可变输出；活动任务仍保留 |
| publishing | 已开始发布流程，包括意图/最终COMMIT回执未知；保留，不自动回退 |
| published | 已提交引用；保留，受检读取 |
| cleaned | 已知prepare失败且局部清理成功，身份留作审计 |
| quarantined | 已持久禁止发布；仍保留文件，本批不unlink |

隔离声明与发布路径使用job→queue→candidate锁序。隔离须在锁内验证身份、终态、未知错误和全部引用：只有尚未进入发布、对应尝试已明确停止且无引用的prepared候选才可能进入quarantined。仍有效的active queue也会阻止声明。reserved、publishing、published、活动尝试及未知结果一律不自动隔离。曾进入outcome_unknown后再取消的任务保留原未知错误code，仍拒绝隔离。

新候选事务在取得candidate锁后重新核对停止信号、数据库时间、lease、queue及attempt绑定；可暂停的提交前检查点之后也再次核对。已知prepare失败只在清理成功时将候选改为cleaned，与失败审计、业务状态、延迟消息和旧消息确认原子提交。重试沿原预算，每次attempt登记不同reference；不覆盖旧候选。

这个保守设计会保留部分事实上未发布的输出，包括已写publishing意图但随后回滚的情况。后续应建立独立的结果核对流程和可恢复的物理删除协议，不能靠文件年龄或进程死亡推断安全。

## 验证与审查

| 验证 | 结果 | 最终证据 |
|---|---|---|
| 输出候选生命周期与互斥 | 45场景 / 277断言，退出0 | [candidates-implementation-final.json](evidence/2026-10-16-t05-output-candidates/candidates-implementation-final.json) |
| 完整真实合并回归 | 52 / 402，退出0 | [merge-final.json](evidence/2026-10-16-t05-output-candidates/merge-final.json) |
| 已知错误与重试回归 | 42 / 371，退出0 | [failures-final.json](evidence/2026-10-16-t05-output-candidates/failures-final.json) |
| 原T05全量回归 | 39 / 307，退出0 | [t05-final.json](evidence/2026-10-16-t05-output-candidates/t05-final.json) |
| 项目verify | Web76套 / 730项、类型/lint、175页构建，退出0 | [project-checks.json](evidence/2026-10-16-t05-output-candidates/project-checks.json) |
| shared / infra | 4套16项 / 7项，退出0 | 同上 |

上述验证均在本批执行。四份集成报告的全部源码指纹匹配，所属子进程/进程组/进程内任务无遗留，临时数据库停止、目录删除、清理错误为零。应用TS helpers、通用状态机、runner/supervisor、外部清理观察器和依赖文件保持本批起点内容；构建前next-env原字节已恢复。前批旧指纹仅代表当时源码，本批以[验证汇总](evidence/2026-10-16-t05-output-candidates/verification.json)为准。

新增覆盖包括创建前登记、reservation提交失败/回执丢失、8个进程中断位置、唯一attempt/ref、清理状态与失败结算回滚、有界重试独立候选、元数据/worker漂移、未知prepare、意图及最终COMMIT的两种实际数据库结果、取消后隔离重入、unknown后取消仍保留、两种发布/隔离锁竞争、跨任务引用保护、读前/读后候选校验，以及隔离查询/提交失败与candidate行锁等待后的中止/到期。原始虚构块字节全部保持不变。

RED在“创建前能观察到持久reservation”的行为断言失败，见[candidates-red.json](evidence/2026-10-16-t05-output-candidates/candidates-red.json)，清理完整。中间测试夹具曾遗漏pool.connect回调转发、误取消succeeded任务及使用错误断言；这些中间失败均保留，不当作最终通过。首个调试运行未能写出完整原始报告，独立核对所属PID、PostgreSQL已停止和目录已清理，见[外部清理记录](evidence/2026-10-16-t05-output-candidates/candidates-green-1-external-cleanup.json)。最终专用报告与三组回归均使用修正后的夹具正常收尾。

素材只使用生成音频；检查点暂停、SQL错误及COMMIT回执故障是受控注入，不代表自然故障频率或真机长录音验收。运行时继续使用Node22.22.2、PostgreSQL14.17、pg-boss12.37.1、pg8.16.3及已有FFmpeg7.1，FFmpeg SHA256为 `4a4a968b98859588e98500ae25973d80a5ca5eed0724222b9f76360dcb72a001`；该nonfree构建仅用于本地测试。没有安装运行时或修改依赖。未改的外部观察器9场景及300秒合成soak未重复，历史边界保持原记录。

[独立审查](evidence/2026-10-16-t05-output-candidates/review-initial.md)的规格与质量均为PASS，Critical/Important/Minor均为0；同时覆盖本批完整store/adapter/runner/发布/隔离接线。审查逐项核对真实场景、四份最终报告及源码哈希，没有重复运行整套测试。身份不可变性与跨job引用互斥以受支持API为边界，不声称防止全权SQL绕过协议。

## 里程碑边界

原G0仍缺实际schema/history/RLS、bucket/资产权限、备份回退与供应商账户条件；原G1仍缺正式会话/Storage/资产adapter、真机5/20/30分钟中断矩阵及正式跨家庭/原件交付验收。此前实际依赖审计为42项（34high/8moderate/0critical），本批未改依赖，明确复用[前批实际审计](evidence/2026-10-16-t05-merge-failures/audit-high.json)，没有重复扫描或声称审计通过。见[本批里程碑核对](evidence/2026-10-16-t05-output-candidates/milestone-check.json)。

用户询问“元数据”含义，已解释表结构、RLS、迁移历史和Storage配置；本批尚未收到新的只读访问或导出。没有重试被拒的CLI角色初始化，也未执行远端SQL。

本地候选协议完成不构成新增发布里程碑。推送仍以原升级计划质量门为条件，不执行远端迁移或部署。

下一步优先取得正式adapter所需的只读证据；并可从quarantined之后设计幂等物理删除和失败重入，先验证对象身份、替换/不存在/删除失败以及崩溃中断。未知reserved/publishing及原始块继续保留，不能通过取消或TTL解除保护。handoff和综合计划已同步，本批未提交或推送。

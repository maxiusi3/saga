# G1：删除目标持久化与候选对象备份兼容

本轮承接已完成的录音保存流程，推进删除与备份缺口。删除目标原子捕获和候选备份清单兼容已实现；整批审查发现的封口/删除并发漏捕获（I1）已用新增迁移修正，修复后原生验证与完整门禁通过，[最终限定复审](evidence/2026-11-06-g1-deletion-capture/reviews/final-fix-review.md)规格与质量均 Approved，I1 已关闭，本批本地验收完成。HTTP 202 表示删除申请已持久登记，`physicalDeletionComplete:false`。设计与验收边界见[设计](../superpowers/specs/2026-11-06-g1-deletion-capture-design.md)和[计划](../superpowers/plans/2026-11-06-upgrade-g1-deletion-capture.md)。

## 接手时确认的问题

| 位置 | 当前缺口 | 本批交付目标 |
| --- | --- | --- |
| 删除 API | 读取地址与写墓碑分离，可能错过并发发布后的地址；生成的 targets 没有写入现成的 deletion_targets 表；后续更新错误被忽略 | 一次事务固定墓碑、全部目标与取消请求；失败全部回滚；重复提交读取同一持久清单 |
| 录音对象范围 | 仅按当前 media_asset 生成地址，遗漏原始分块和未发布候选 | 捕获实际绑定的分块、reserved/prepared 候选，已发布候选地址去重 |
| Scheme B 清单 | TS 和 CLI 只允许 saga/audio-recordings，已发布原声所在 recording-candidates 被拒 | 两个验证器接受候选桶，保留原路径/hash/大小约束，候选地址参与墓碑后的存活集合计算 |

## 已实现的删除行为

- `/api/media/delete-request` 经认证和项目权限检查后，只调用一次有时限、禁用重试的服务端 RPC。数据库在锁内重查操作者权限、归属、阻塞项和来源关系，再一起写墓碑、完整目标、资产 deleting 状态及未结束任务的取消请求；任一必要写入失败全部回滚。
- 目标覆盖实际资产、原始分块及 reserved/prepared 候选。已发布候选与资产引用的同一物理地址去重；资产请求不扩大到同故事的其他资产。故事已封存但尚未登记资产/任务时，也能捕获已存在的分块，不伪造尚不存在的对象。
- 重复请求返回同一持久清单；冲突身份、历史不完整申请或目标被篡改时拒绝。请求表只存目标数量与完整行摘要，私有目标表保存路径，避免把候选路径暴露给可读请求表的成员。
- 保留运行中 attempt、终态任务及候选证据；不把取消请求写成已终止或已删除。提交响应丢失时，客户端不能据此断言回滚，重新提交可恢复已有回执。

删除与发布使用相互冲突的数据库锁，等待结束后读取已提交状态。当前保留保守的全局表锁；已将事务内完整行比较收窄到相关行，消除无关正文的 JSON 序列化，但全局锁竞争与关联扫描的规模表现仍需后续验收。

## 删除复审与回归证据

封口竞态修复前的原生 PG17 定向运行通过 **16 组／699 条断言**，保留 **8 次真实锁等待**和 **12 类写入／触发器故障回滚**；定向应用测试 **2 套／45 项**通过。完整前后行、等待锁和合成副本记录见[原生结果](evidence/2026-11-06-g1-deletion-capture/native-1793934773961-cfab3e45-06f7-4191-a5a7-436dae09ca50/results.json)。断言数包含完整行比较，不代表独立用户场景数；修复后的现行验收见下文。

初审的两项 Important 问题均已修复并经[限定复审批准](evidence/2026-11-06-g1-deletion-capture/reviews/task-1-fix-1-review.md)：

1. 允许合法的“seal 已提交、资产/任务登记尚未发生”窗口。实际 seal 路由在墓碑后返回 409，未进入登记流程；无关/错绑 intended asset 仍拒绝。
2. 移除锁内全库完整行序列化。无关正文为 0／8／32 MiB 时，诊断副本的序列化量均约 3.7 KiB、无关正文调用为零。计数来自单独标识的透明探针，实际 RPC 计时调用未修改 SQL；这不是吞吐或 SLA 资格证明。

## 候选清单与墓碑重放

两个生产验证器仅扩展 `recording-candidates` 桶白名单与对应类型，原清单结构、路径/hash/大小/重复地址拒绝及台账语义不变。独立 runner 用实际发布和删除 RPC 取得持久 bucket/key，再传入 TS、CJS 和实际 CLI 文件模式。合成清单包含四个对象：

| 对象 | 捕获后计算出的恢复集合 |
| --- | --- |
| 被删故事的已发布候选 | 排除 |
| 另一故事的原始分块 | 保留原完整条目 |
| 另一故事的 reserved 候选 | 保留原完整条目 |
| 独立旧版对象 | 保留原完整条目 |

被删故事自己的原始分块也被捕获并输入墓碑重放，只是没有放入这个四对象清单子集。测试刻意使用不同逻辑 ID，要求以真实 bucket/key 命中目标。三个入口输出完全相同：排除 1 个，保留 3 个、90 字节；输入与数据库/合成副本完整状态不变。14 类非法条目在两个验证器中得到相同拒绝。

父级冻结源码复验：[删除捕获 16 组／699 断言](evidence/2026-11-06-g1-deletion-capture/native-1793935758219-bdb59613-e1ca-4ed6-93f3-48aca8683817/results.json)、[备份兼容 3 组／82 断言](evidence/2026-11-06-g1-deletion-capture/native-backup-1793935759391-b9e5a10b-441b-4d24-b6bc-16c9624b13f5/results.json)均通过，临时数据库和目录已清理。备份定向 Jest **37 项**、Node **17 项**通过；Node 数量包含 7 项迁移/部署配置检查，新迁移仅做文件顺序登记。

备份 runner 使用合成 `PGDMP` 头部和本地合成字节；验证器检查字段与头部/hash，不下载或验证 Storage 实物，也没有执行 `pg_restore`。CLI 既有 `verified:true` 仅代表这些结构检查通过，本批没有创建合格备份台账。

## 完整工程门禁

`npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra` 退出 0：Web **160 套／3,259 项**、shared **4 套／16 项**、infra **23 项**、**184 页生产构建**。见[完整命令回执](evidence/2026-11-06-g1-deletion-capture/final-gate-01.json)。903 个受测源码起止无漂移；仅恢复已核实的构建生成 next-env 引用，原始字节与接手基线一致。

Task 1 修复复审及[Task 2 独立审查](evidence/2026-11-06-g1-deletion-capture/reviews/task-2-review.md)均通过，无待修项。构建保留既有 Next.js 配置弃用警告；本地构建成功不证明部署配置合格。整批审查发现 I1 并要求修复；该首轮门禁对应修复前源码，修复后的门禁见下文。

## 整批审查发现与最终修复

[整批审查](evidence/2026-11-06-g1-deletion-capture/reviews/whole-change-review.md)只有一项 Important：旧封口函数检查墓碑后等待源表锁，随后可能在 capture 提交后新增 session/chunk，而重复捕获仍保持原清单。实际未修改 SQL 的[原生复现](evidence/2026-11-06-g1-deletion-capture/review-seal-overlap-03/results.json)记录三次锁等待和漏捕获地址，38 条断言，临时资源已清理。

最终修复新增 [20261106000003_recording_seal_deletion_fence.sql](../../supabase/migrations/20261106000003_recording_seal_deletion_fence.sql)，让封口在第一把业务锁前参与删除 SHARE fence，并要求 READ COMMITTED、显式 VOLATILE 和三秒锁等待上限。历史 seal 迁移保持原字节，既有输入、身份、回执及重放契约保留。

续接时先在未修改的历史 SQL 上保存[新 RED](evidence/2026-11-06-g1-deletion-capture/native-seal-fence-red-1793973858990-d070f72a-9e34-4c84-8782-3017e245c38c/results.json)：三次真实等待后，两个分块落在持久清单之外，42 条断言后在安全断言处失败。修复后的[定向 GREEN](evidence/2026-11-06-g1-deletion-capture/native-seal-fence-1793973965719-f972728d-d982-4289-8c72-21012283b37e/results.json)通过 **5 组／87 条断言、4 次真实等待**：

- 封口先获得锁时，删除等待封口提交，随后捕获全部真实分块地址；重复请求保持同一清单。
- 删除先获得锁时，等待中的封口在删除提交后拒绝，不新增会话或分块。
- 已建立快照的 REPEATABLE READ／SERIALIZABLE 事务拒绝执行；真实锁等待超时后整笔回滚、释放锁，同一连接仍可合法封口和重放。
- 实际 anon、authenticated、metadata_reader 调用被拒绝，service_role 调用与既有契约通过。

修复后的默认[删除矩阵](evidence/2026-11-06-g1-deletion-capture/native-1793974055239-4b654280-1389-4ffa-ad49-7a3c272b31dd/results.json)通过 **21 组／759 条断言、12 次真实等待**；[备份兼容](evidence/2026-11-06-g1-deletion-capture/native-backup-1793974055241-c8a4eef0-be31-4cee-835f-b671127bb05d/results.json)通过 **3 组／82 条断言**。新迁移已默认进入两个 runner；定向 Jest **4 套／125 项**、部署清单 **7 项**、根 ESLint 和语法检查通过。初次 ESLint 配置误用的诊断失败保留，正确配置重跑通过。完整记录见[修复报告](evidence/2026-11-06-g1-deletion-capture/reviews/final-fix-report.md)。

父级在七个修复文件冻结后重跑[完整门禁](evidence/2026-11-06-g1-deletion-capture/final-gate-02.json)：**Web 160 套／3,259 项、shared 4 套／16 项、infra 23 项、184 页生产构建**全部通过，906 个受测源码起止无漂移。只移除已核实的构建生成 next-env 引用，恢复原字节；所有临时原生数据库和目录已清理。构建仍有既有 Next.js 配置弃用警告，完整迁移链和真实部署资格仍未授予。[最终限定复审](evidence/2026-11-06-g1-deletion-capture/reviews/final-fix-review.md)规格与质量均 Approved，I1 已关闭，本批本地验收完成。

## 验收如何区分结果

本批最终记录见[验收回执](evidence/2026-11-06-g1-deletion-capture/verification.json)、[源码与归档](evidence/2026-11-06-g1-deletion-capture/final-gate-02-source-lock.json)和[历史工作完整性](evidence/2026-11-06-g1-deletion-capture/final-gate-02-integrity.json)。修复前的门禁、原始失败复现和审查结论均保留，不能代替修复后的验收。

- PostgreSQL 原生验证负责事务、并发、权限和持久目标；失败检查完整行是否回滚，成功检查真实目标集合。
- 应用/路由测试负责严格输入与回执、超时/取消和状态返回；HTTP 202 只表示申请被持久登记。
- 备份验证以真实捕获的 bucket/key 输入两个验证器及实际 CLI，检查存活对象集合一致；此处不执行真实备份恢复或物理删件。
- 全仓测试、构建、源码指纹、独立审查与旧证据完整性负责本批工程交付。

仍需后续实现引用安全 GC、晚到写入对账与物理删除执行；真实对象备份/恢复演练、完整迁移链、云端和真机长录音资格继续开放。G1 和条件推送资格保持 false。未暂存、提交、推送、部署、远端迁移、付费调用或传输家庭资料。

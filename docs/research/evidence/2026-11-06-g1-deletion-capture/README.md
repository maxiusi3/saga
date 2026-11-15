# 删除目标原子捕获与候选备份清单证据

本目录仅收录 2026-11-06 当前批次的新证据。此前 4,680 个证据文件由 `baseline.json` 固定，任何旧结果均不覆盖。完整前后行含合成身份和测试地址，不含家庭内容。

当前阶段：Task 1／2 已通过各自审查；整批审查发现的封口/删除竞态 I1 已修正，修复后原生矩阵与完整门禁通过，[最终限定复审](reviews/final-fix-review.md)规格与质量均 Approved，I1 已关闭，本批本地验收完成。

## 删除捕获

- [Task 1 初始报告](reviews/task-1-report.md)、[初审](reviews/task-1-review.md)、[修复报告](reviews/task-1-fixed-report.md)、[限定复审](reviews/task-1-fix-1-review.md)。I1 合法未登记会话、I2 无关正文序列化两项问题均已解决。
- [修复后原生结果](native-1793934773961-cfab3e45-06f7-4191-a5a7-436dae09ca50/results.json)：16 组／699 条断言，8 次真实锁等待，12 类故障注入完整回滚。保存完整行、原始来源坐标及合成字节；实际 service-role 连接调用 SQL 和编译后的应用适配器。
- [定向 Jest](task1-fix1-focused-final.json)：2 套／45 项；[根 ESLint](task1-fix1-root-eslint-final.json)及[模块语法检查](task1-fix1-syntax-and-whitespace.json)通过。各命令 JSON 包含起止源码指纹及 `.log.gz` 的压缩/原始摘要。
- [未登记会话 RED](native-fix1-red-1793934408307-49608342-392c-4f02-bf36-8f2fa50622b9/results.json)和[GREEN](native-fix1-1793934592700-47203a00-69ac-4817-b249-b6a8c60ffb9c/results.json)均保留。
- [序列化成本 RED](snapshot-cost-red-1793934655909-9152134f-9065-4860-a17f-38c45ec61b5d/results.json)和[GREEN](snapshot-cost-1793934664953-d05261e9-a122-4da1-acbb-abb6c9a1edea/results.json)：0／8／32 MiB 无关正文均不进入修复后的序列化。完整行以 gzip 保存；透明探针与实际 SQL 调用分开记录，不构成吞吐资格。

## 候选备份清单兼容

- [Task 2 报告](reviews/task-2-report.md)、[七文件补丁](reviews/task-2.patch)、[源码摘要](reviews/task-2-hashes.json)。生产仅扩展候选桶类型/白名单，另登记新迁移文件顺序。
- [原生 RED](native-backup-1793935620832-01c63300-6229-4178-bc88-f594ea72d9b1/results.json)、[原生 GREEN](native-backup-1793935677873-38321e13-9544-495d-86a7-10fc7947f578/results.json)：实际删除 RPC 的目标进入两验证器和 CLI。目录保存完整 capture、manifest、tombstones、兼容结果、非法输入结果与逐件摘要。
- [定向 Jest](task2-jest-green-1.json) 37 项、[Node](task2-infra-green-1.json) 17 项通过。Node 包含 7 项部署/迁移清单检查，不能据此认定完整迁移链执行通过。
- 父级冻结源码独立复验：[删除 699 断言](native-1793935758219-bdb59613-e1ca-4ed6-93f3-48aca8683817/results.json)、[备份 82 断言](native-backup-1793935759391-b9e5a10b-441b-4d24-b6bc-16c9624b13f5/results.json)。对应 [capture 命令](final-native-capture-01.json)／[backup 命令](final-native-backup-01.json)均退出 0、源码无漂移、临时资源已清理。

## 完整门禁与审查

- [完整门禁](final-gate-01.json)及其压缩日志：Web 160／3259、shared 4／16、infra 23、184 页构建，exit 0，903 个受测源码起止无漂移。
- [生成文件恢复](next-env-restore.json)：只恢复已知 next-env 引用，恢复后字节与本批接手基线相同。
- [Task 2 独立审查](reviews/task-2-review.md)：规格和质量 Approved，无待修项；完整行、实际 CLI 和全部证据摘要独立核对。
- [整批审查](reviews/whole-change-review.md)：一个 Important I1，旧 seal 等待后能在捕获提交后插入清单外分块。[实际 SQL 复现](review-seal-overlap-03/results.json)保留三次真实等待、完整行和 38 条断言。01/02 为中间诊断失败；03 才是有效复现。修复前 27 个输入已封存到 `whole-change-review-inputs.tar.gz`，首轮门禁保持原样。

## 中断续接后的最终修复

- [修复报告](reviews/final-fix-report.md)、[七文件补丁](reviews/final-fix.patch)、[源码摘要](reviews/final-fix-hashes.json)及[修复验证完整性](reviews/final-fix-integrity.json)。新增前向迁移使 seal 在第一把业务锁前获得删除 SHARE 锁，要求 READ COMMITTED、显式 VOLATILE、三秒锁等待上限；历史迁移原字节保留。七个输入另封存于 `final-fix-inputs.tar.gz`。
- [本次 RED](native-seal-fence-red-1793973858990-d070f72a-9e34-4c84-8782-3017e245c38c/results.json)：42 条断言后预期失败，三个真实等待、两个晚到分块被遗漏；[GREEN](native-seal-fence-1793973965719-f972728d-d982-4289-8c72-21012283b37e/results.json)：5 组／87 断言、四个等待，覆盖两个顺序、旧快照、超时回滚与服务调用权限。
- 最终默认[删除矩阵](native-1793974055239-4b654280-1389-4ffa-ad49-7a3c272b31dd/results.json)：21 组／759 断言、12 次真实等待；[备份兼容](native-backup-1793974055241-c8a4eef0-be31-4cee-835f-b671127bb05d/results.json)：3 组／82 断言。两者均默认应用新迁移，源码摘要与当前文件一致，数据库和临时目录全部清理。
- [定向应用](final-fix-resume-focused01.json)：4 套／125 项；[迁移清单](final-fix-resume-infra01.json)：7 项；[根 ESLint](final-fix-resume-eslint02.json)与[语法／差异检查](final-fix-resume-syntax01.json)通过。错误配置调用 `final-fix-resume-eslint01` 保留为诊断失败，不计入通过证据。
- 父级重新执行[完整门禁](final-gate-02.json)：Web 160／3259、shared 4／16、infra 23、184 页构建，exit 0；906 个受测源码起止无漂移。[next-env 恢复](next-env-restore-02.json)只移除已核实的构建生成引用，字节与接手基线相同。
- [最终限定复审](reviews/final-fix-review.md)规格与质量均 Approved，I1 已关闭，本批本地验收完成；旧审查和失败证据不覆盖，当前批次验收以修复后的源码为准。

## 证据边界

[最终回执](verification.json)汇总当前结果；[源码清单](final-gate-02-source-lock.json)对应完整输入归档，[完整性回执](final-gate-02-integrity.json)记录历史证据、继承源码、HEAD／暂存区和差异检查。续接时另保存的输入清单及核验见 [resume-integrity-01.json](resume-integrity-01.json)。

本地 PG17 fixture 使用实际删除目标 DDL 和录音迁移，基础 auth/project/storage 环境仍为合成构造；应用 SQL transport 替代真实 PostgREST。它不证明完整迁移链、线上权限配置或真机行为。后续备份验证仅证明清单及墓碑存活集合兼容，不授予对象备份/恢复、物理删除或 GC 资格。`g1MilestoneSatisfied` 和 `pushConditionSatisfied` 继续为 false。

# G0 / T02 Storage 与 stories RLS 隔离演练

2026-10-17（Asia/Taipei）。续接 [handoff](../HANDOFF-2026-10-13-upgrade.md) 和[远端元数据对照](2026-10-17-remote-metadata-reconciliation.md)。本批完成本地规则复现、修复候选与回归；独立审查因模型限流未完成。**线上权限未改，G0/G1 仍未通过。**

## 范围与证据层次

新增 [experiments/rls-rehearsal](../../experiments/rls-rehearsal/README.md) 内五个文件：缩减 schema、候选 SQL、场景、运行器和说明。没有修改应用源码、根迁移、已有 T05 实验或依赖。所有查询使用虚构家庭和对象；本批未连接 Supabase、读取凭据、家庭资料或真实 Storage 对象。

运行器固定[最终元数据快照](evidence/2026-10-17-remote-metadata/snapshot-2026-10-17T02-45-52-407Z.json)的 SHA-256，逐字重放五张表的 **32 条策略谓词**：`projects`、`project_roles`、`project_members`、`stories`、`storage.objects`。这是保存规则在缩减 schema 下的实验，并非完整远端还原。列/函数/约束仅覆盖策略所需依赖，未还原全部远端触发器、RPC、ACL 和 Storage HTTP 服务。

实际查询以 `anon` / `authenticated` 执行，逐次确认角色没有 SUPERUSER / BYPASSRLS。JWT GUC 由可信测试控制器设置，不代表鉴权网关已经验收。环境为 Node **22.22.2**、PostgreSQL **14.17**、pg **8.16.3**；远端快照来自 PostgreSQL **17.4**，版本兼容尚待验证。使用既有 T05 的 pg 安装，无新增依赖。

## 复现结果

完整启用所选表的依赖 RLS 后，首次查询得到 **42P17（递归策略）**。为观察各规则的授权结果，诊断阶段显式关闭依赖表 RLS，再分别复现以下行为；候选回归前全部重新开启。

| 诊断观察 | 虚构数据的实际结果 | 根因 |
|---|---|---|
| 匿名读取 audio | 返回 1 行 | 公开 SELECT 策略只检查 bucket |
| 跨项目上传 audio | INSERT 返回 1 行 | authenticated 全桶许可没有绑定用户/项目 |
| 已撤权上传者读取 saga 项目对象 | 返回 1 行 | 首级目录等于当前用户的宽松分支绕过当前成员检查 |
| 项目名称绑定 | 普通项目名下共享对象不可见；路径形项目名使另一项目对象可见 | 子查询的 `name` 绑定 `projects.name`，而非外层对象 key |
| 外部用户创建 stories | INSERT 返回 1 行 | 并行 PERMISSIVE 策略按 OR 合并，作者分支绕过项目角色 |

这些结果保留在[最终运行报告](evidence/2026-10-17-rls-rehearsal/run-1792208657930-45113.json)的 observations 中，并标注依赖隔离模式。不能据此宣称已经在线攻击、发生资料外泄，或线上每条查询都会表现相同。

## 修复候选与兼容边界

[candidate.sql](../../experiments/rls-rehearsal/candidate.sql) 仅允许数据库名 `saga_rls_rehearsal`、禁用 TCP、显式本地标记同时成立时执行；DDL 在单个事务中，文件位于根 migrations 之外。

- 用返回布尔值的窄 SECURITY DEFINER helper 读取当前项目成员，打断 projects/project_roles 的递归 SELECT。固定空 `search_path`、限定对象名、不接受外部 actor、不用动态 SQL，并收紧函数/创建权限。现有项目/角色管理策略保留，其全部业务操作不在本批验收范围。
- 移除已知旧策略，并用 **RESTRICTIVE** 条件约束所有并行 PERMISSIVE 分支；回归包含额外插入宽松策略后仍拒绝越权。不能靠再加一条严格 PERMISSIVE 策略解决问题。
- 项目/故事对象始终检查当前成员；上传者前缀不再覆盖撤权。个人图片/临时块只允许本人，故事图片按真实故事项目授权；非法 key、无法归属的旧路径、未知项目/故事拒绝。INSERT 同时绑定本人前缀；兼容 `owner` / `owner_id` 为空或本人，拒绝冒用他人。
- 已管理 bucket 的 UPDATE、DELETE、改名和覆盖型 upsert 均关闭；普通已授权 INSERT/读取保留，其他 bucket 的自有策略保留。**这会阻止旧客户端直接 `.remove()`，候选不能直接部署。** 需先接不可变资产、删除编排和客户端兼容处理。
- stories 读取需要当前项目权限，写入需要本人 active storyteller；触发器固定故事 ID、项目和创建者，拒绝把已存在故事迁往另一个有权限的项目。原始 DELETE 暂时关闭，等待墓碑/删除 adapter。

本候选只覆盖行授权。用途同意、墓碑、对象版本、物理删除、service-role/owner 绕过后的服务端检查、历史映射和备份恢复都未实现。生产 helper 的部署所有者、权限与完整函数依赖仍须核对。

撤权在 **READ COMMITTED 下一语句**可见；已建立的 **REPEATABLE READ 快照仍看到旧成员状态**，测试明确保留此限制。正式服务需限制事务生命周期并设置访问检查；RLS 不能撤回已返回内容、已下载文件或仍在有效期内的签名链接。

## 验证与清理

| 检查 | 结果 | 证据 |
|---|---|---|
| 初始 RED | 预期失败：匿名音频可见，`1 != 0`；退出 1 | [red](evidence/2026-10-17-rls-rehearsal/red-1792208232974.json)，历史源码 |
| `node experiments/rls-rehearsal/verify.mjs` | **61 场景 / 199 断言**，退出 0 | [最终运行](evidence/2026-10-17-rls-rehearsal/run-1792208657930-45113.json) |
| `--signal-after-setup` | SIGTERM 后退出 **143**，状态 interrupted | [中断运行](evidence/2026-10-17-rls-rehearsal/run-1792208657922-45114.json) |
| `npm run verify` | Web **76 套 / 730 项**，类型/lint、**175 页**构建通过 | [项目检查](evidence/2026-10-17-rls-rehearsal/project-checks.json) |
| shared / infra | **4 套 / 16 项**、**7 项**通过 | 同上 |
| `npm run audit:high -- --json` | 退出 **1**，**42 项：34 high / 8 moderate / 0 critical** | [audit-high.json](evidence/2026-10-17-rls-rehearsal/audit-high.json) |

候选回归还包含错误本地标记拒绝、DDL 中途除零后的完整回滚、重复应用、owner/owner_id、异常/编码/控制字符路径、共享正例与跨家庭反例、故事身份冻结、撤权隔离级别差异。测试数量含本地保护和回滚场景，不代表 61 项线上攻击验收。

正常和 SIGTERM 最终报告绑定相同的五份源码哈希，都确认 `clusterStopped=true`、`tempDirectoryRemoved=true`、`clientsRemaining=0`、`errors=[]`。集群仅监听私有 Unix socket。中途曾因并行运行同毫秒启动覆盖证据文件；运行器已加入 PID 并重新保存两份独立报告，见[碰撞记录](evidence/2026-10-17-rls-rehearsal/intermediate-evidence-collision.md)。旧覆盖报告不能作为中断清理证据。

`next-env.d.ts` 已恢复批次开始的原字节，包清单/锁文件未变。现有缺服务端 Supabase 配置、旧 Next 配置与 Watchman 提示仍存在，不代表生产配置合格。本批没有重跑此前 T05 45/277、52/402、42/371、39/307 或 300 秒 soak；历史证据保留原范围。

## 审查、里程碑与下一步

独立审查已派发，但 `/root/rls_review` 返回模型限流错误，没有产出审查报告。主代理完成自查和证据核对，**不记作独立审查 PASS**。详见[审查状态](evidence/2026-10-17-rls-rehearsal/review-status.md)；前批元数据采集器的独立审查也仍待补。

G0 仍缺生产权限修复、bucket 配置、函数/触发器/ACL及七个未登记迁移的等价对账、兼容迁移/回填与备份回退、供应商账户/数据条件。G1 仍缺正式会话/Storage/资产/同意/删除 adapter、真实设备 5/20/30 分钟故障矩阵和跨家庭/完整原件交付验收。**本地候选通过不构成原计划里程碑，本批未提交或推送 GitHub，也未迁移、改远端权限或部署。** 见[里程碑核对](evidence/2026-10-17-rls-rehearsal/milestone-check.json)。

后续先补本批与元数据采集器的独立审查；并行可推进不依赖审查结论的最小元数据补齐和 schema 兼容 fixture。取得完整差异与备份/回退证据后，继续设计增量草案及正式事务 adapter；不得把本候选直接移入自动部署路径。最新状态、指纹和文档由[验证汇总](evidence/2026-10-17-rls-rehearsal/verification.json)索引。

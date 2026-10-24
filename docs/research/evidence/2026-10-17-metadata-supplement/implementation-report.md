# 元数据采集器补充实现报告

日期：2026-10-17（Asia/Taipei）。实现代理：`/root/metadata_fix`。

结论：独立补审的 P2 已完成本地失败复现与修复；新增限定范围的函数、触发器及 ACL 查询。最终定向测试 **23/23 通过**，新增 SQL 已在仅 Unix socket 的一次性 PostgreSQL 14.17 合成数据库实际执行。**本代理没有运行远端采集，也不宣称远端权限、升级门禁或发布里程碑通过。** 主代理负责独立复核、一次只读远端采集及 handoff。

## 实现边界

仅修改 `scripts/inspect-supabase-metadata.cjs` 和 `scripts/__tests__/inspect-supabase-metadata.test.cjs`；按 brief 新增本报告及 `docs/research/evidence/2026-10-17-metadata-supplement/` 下的本地证据。未修改 `metadata-before/`、历史快照、原审查报告及既有对账结论。

未读取真实凭据、连接既有本地数据库或远端、执行生产 DDL/grant、执行任何 public/storage 业务函数、升级依赖、部署、commit 或 push。SQL 验证只在本代理建立的临时空集群内创建合成 fixture；两次集群均已停止并删除，没有 TCP 监听。

## P2：异步生命周期截止与安全落盘

原问题不仅是 `clearTimeout()` 早于 `client.end()`：原计时器只调用流的 `destroy()`，也不能保证驱动正在等待的 connect/query/end Promise 会结束。

现在 `main()` 的 connect、collect 中每个 query（含保存点与最终 rollback）、end 都与同一个 90,000 ms 拒绝 Promise 竞速；截止后拒绝继续发出新 query。计时器直到关闭正常完成或有界终止后才清除。到期时强制销毁流，记录 `captureDeadline.exceeded`、`connectionClosed: false`、`connectionCleanup.status: forced` 与实际 `streamDestroyed` 状态，并继续用 `wx` 独占创建安全证据。流销毁本身抛错不会阻止落盘。

若此前已发生 TLS/采集失败，保留原始安全 `failure`，同时由 `captureDeadline.exceeded: true` 明确标记后续关闭超时；不会让原错误遮住超时事实。正常关闭记录 `connectionClosed: true` 和 `connectionCleanup.status: closed`。关闭拒绝保存批准过的机器错误码，不输出驱动原始错误或凭据。

覆盖范围是 **connect → collect/rollback → close 的全部异步驱动等待**。VM 回归手动触发真实配置为 90,000 ms 的计时器，不等待实际 90 秒；JavaScript 计时器不能抢占阻塞的事件循环或同步文件 I/O，因此不把此实现夸大成任何操作系统/文件系统故障下的绝对 90 秒进程上限。独立调用导出的 `collect()` 本身仍由调用方管理外层截止，正式 CLI 入口由 `main()` 施加截止。

## 五个新增只读章节

| 章节 | 信息与范围 |
|---|---|
| `functions` | public/storage 常规函数、过程和窗口函数（kind f/p/w，排除 aggregate）；schema/name、无默认值的 identity arguments、返回类型、kind、owner、language、security definer、volatility、strict/leakproof；proconfig 仅输出 search_path；定义只输出服务端 MD5。记录 ACL 是否为 NULL、内置默认 PUBLIC EXECUTE、当前有效 PUBLIC EXECUTE/可转授状态。 |
| `function_privileges` | 同一函数范围，仅 metadata_reader、anon、authenticated、service_role 四角色，通过 catalog 权限函数读取有效 EXECUTE。不会调用待检查函数。 |
| `triggers` | public/storage 关系上的非内部触发器；表/名称、enabled、type/timing bitmask、函数身份、constraint 标记、参数数量、条件存在标记及定义 MD5。不输出 tgargs、WHEN 或完整定义。 |
| `schema_privileges` | public/storage × 上述四角色的有效 USAGE/CREATE。EXECUTE 与 schema USAGE 分别记录，不能只凭 EXECUTE 推断可调用。 |
| `default_privileges` | 两个目标 schema 下 table/sequence/function/type 的显式默认 ACL，同时标出适用的 global 与 schema 级默认。保留空 ACL。排除创建 schema/large object 的全局默认，避免把不属于目标 schema 内对象的默认误关联。 |

`acldefault('f', owner)` 是内置 fallback；`pg_default_acl` 是创建新对象时使用的自定义默认，二者分开记录，不能视为对现有函数权限的追溯修改。MD5 是定义差异指纹，不能证明完整语义或恢复能力；正文和触发器值没有采集。触发器引用范围外函数时仅记录被引用身份，不扩大函数正文采集范围。

已有 TLS 证书/主机校验、metadata_reader 身份约束、REPEATABLE READ READ ONLY 快照、事务内 10s/2s/15s 校验、保存点分类恢复、原固定 bucket 与 audit_meta 读取范围均保留。

## 验证证据

所有以下路径均位于 `docs/research/evidence/2026-10-17-metadata-supplement/`：

| 文件 | 结果 |
|---|---|
| `deadline-red.tap` | 原源码 18 项中 12 通过、6 失败；真实 main 在合成 connect/collect/rollback/close 永不完成时不能落盘，另有关闭拒绝/销毁异常证据缺口。 |
| `deadline-green.tap` | P2 首轮修复后 18/18 通过。 |
| `catalog-red.tap` → `catalog-green.tap` | 新查询/分类测试先有 4 项失败，再达 22/22 通过。 |
| `deadline-state-red.tap` → `final-green.tap` | 原失败后关闭超时的显式状态先失败，再达 23/23 通过。 |
| `default-scope-red.tap` → `scope-final-green.tap` | 默认 ACL 对象类别边界先失败；最终版本 **23/23** 通过，0 skipped。 |
| `local-catalog-postgres14.json` | 临时 PG14.17 的 7 项实际 SQL/结果断言全部通过：限制角色执行、4 个目标函数/16 个权限组合、正文/默认值/proconfig 值排除、PUBLIC fallback/撤销区别、触发器参数与 WHEN 排除、schema USAGE 区别、全局空 ACL/指定 schema ACL。 |
| `local-catalog-final.json` | 最终源码重新建立临时 PG14.17 fixture；五章节全部结果与前述 7 项断言通过的结果逐字段相等，并新增真实创建 schema 默认 ACL 的排除断言。记录最终源码及所有查询 SHA256。 |
| `verification.json` | 最终源码/测试/证据指纹、23/23 测试结果、两个 Node 语法检查及验证范围限制。 |

这些是本地合成/SQL 验证；没有新增真实 TLS 握手或远端 PostgreSQL 17 权限实测。fixture 故意没有 audit_meta/bucket 对象，因此本地 SQL 集成只断言新增五章节，不能把全 collect 的其他章节状态描述为远端结果。没有运行应用构建或整个项目测试，因为修改仅限独立 `.cjs` 采集器及对应定向测试，主代理负责按升级计划统筹更广验证。

## 最终指纹与交接

- `scripts/inspect-supabase-metadata.cjs`：`df6493a88f861f720ba105efdf38aef34cb4e01a0cb3732cdd447f3f95670615`
- `scripts/__tests__/inspect-supabase-metadata.test.cjs`：`53efa031e628a66e376e945350a45ec2df76a91da1e3d2ff589dfee22f517314`
- 原独立审查源码：`2f8330bf74023629b6c862d1fc049c3e1e2d4ac40ac3258ff57bdb906c5b240d`，保留于 `metadata-before/`。

请主代理在该最终指纹上独立复核后再运行只读远端采集；不要用本报告替换历史 02:45 快照的范围或结论。新增权限/结构结果必须使用新快照重新解释，并明确区分结构清单、完整语义审计和远端变更门禁。

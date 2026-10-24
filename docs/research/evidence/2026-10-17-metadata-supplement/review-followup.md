# 元数据采集器增量独立复核

日期：2026-10-17（Asia/Taipei）。审查代理：`/root/metadata_review`。

结论：**本次限定增量审查通过；原 P2 已关闭，新增范围未发现需修复的 P0/P1/P2/P3 问题。** 结论固定于采集器 SHA256 `df6493a88f861f720ba105efdf38aef34cb4e01a0cb3732cdd447f3f95670615` 和测试 SHA256 `53efa031e628a66e376e945350a45ec2df76a91da1e3d2ff589dfee22f517314`。这是只读采集器的实现与本地证据审查，不能解释为远端权限安全、全部历史工作树或 G0/G1/发布里程碑通过。

## 复核范围与证据对应

已读取本次 `metadata-supplement-brief.md`、实现报告、完整 `metadata-review.diff`、`metadata-review-source-hashes.json`、当前采集器与测试，以及 `verification.json` 指向的最终定向测试和两份临时 PostgreSQL 14.17 合成 SQL 证据。

本代理执行了独立的文件/查询指纹及证据结构一致性核对，没有重跑已有 23 项测试或重建数据库。具体复核结果：

- 从完整 diff 重建两个文件的旧、新字节：旧源码/测试分别匹配原独立审查基线 `2f8330…` / `067694…`，新字节与当前文件逐字节一致；没有用 HEAD diff 替代本批基线。
- `metadata-review-source-hashes.json`、`verification.json` 的两个源码指纹及 10 个证据文件指纹均匹配当前磁盘文件。
- 最终 SQL 证据的源码指纹匹配当前源码；全部 **16** 个查询 SHA256 匹配当前 `QUERIES`。历史 02:45 快照中的 **11** 个原查询保持逐字相同。
- 最终临时 PG14 五章节与前份已有七项断言的结果逐字段相等；行数可复算为 functions **4**、function_privileges **16**、triggers **1**、schema_privileges **8**、default_privileges **3**。最终 fixture 还包含创建 schema 的全局默认 ACL，输出中正确排除了此类别。
- `scope-final-green.tap` 记录 **23/23 通过、0 失败、0 skipped**；这是经指纹核对的已有测试证据，不冒称由本代理重新执行。

本代理未读真实凭据、连接远端或任何数据库、执行业务函数、修改实现/旧证据、调用子代理或 commit/push；唯一新增文件为本报告。

## 原 P2 的逐项复核

原发现来源：`docs/research/evidence/2026-10-17-remote-metadata/review-initial.md`，旧源码 `:171–174` 在 `await client.end()` 前撤销总截止，关闭 Promise 永不结束时阻止失败证据落盘。

| 边界 | 当前实现与结论 |
|---|---|
| 共同截止 | 当前采集器 `:216–233` 建立同一 90,000 ms 拒绝 Promise；每个异步驱动操作都与它竞速。到期设置 `expired` 和 `captureDeadline.exceeded`，尝试销毁流，再使等待结束。Promise 不依赖驱动在销毁流后自行 settle。 |
| connect | `:236–237` 通过 `bounded()` 执行 connect；连接永不 settle 时会进入安全失败路径。已有 CLI 合成回归覆盖 connect 等待，不读取真实配置文件。 |
| collect/查询 | `:241–242` 把所有 `collect()` 查询包装成 `bounded()`，因此 BEGIN、SET LOCAL、身份查询、保存点、各节查询和保存点收尾均受同一截止约束。`:217` 在调用操作前检查 `expired`，截止后不会继续发出补偿 SQL。 |
| rollback | `collect():187–188` 的最终 ROLLBACK 使用上述同一个包装客户端；回滚自身卡住不会阻止主流程到达证据写入。截止后不再向已强制中断的连接追加 ROLLBACK；记录强制关闭状态，而非伪称事务正常收尾。 |
| close | `:247–259` 对 `client.end()` 同样使用 `bounded()`，在正常完成或有界失败后才清理计时器。原 P2 所指的提前取消顺序已经消除。 |
| 失败与落盘 | `:205–213` 的强制清理吞掉清理自身的原始异常，记录 `connectionClosed: false` 和实际 `streamDestroyed`；`:244–256` 保存安全失败码、保留先前失败并单独标记截止超时。`:261–267` 随后以 `wx` 保存证据并给出失败退出码。正常关闭明确标记 `closed`；销毁流不被描述成 graceful close。 |

测试文件 `:105–235` 的真实 CLI VM 桩覆盖 connect/BEGIN/最终 rollback/close 永不结束、close 拒绝、强制销毁抛错、正常关闭、TLS 未授权及原失败后 close 超时。测试按原配置 **90,000 ms** 手动触发回调，并核对实际写入、安全失败码和清理状态。代码检查确认该机制覆盖单个查询与保存点路径，测试结果不是仅检查字符串形式的计时器存在。

关闭结论的边界：90 秒保护异步驱动等待；JavaScript 计时器不抢占阻塞事件循环或同步文件 I/O。文件系统无法写入时仍只能使用末尾固定错误信息；流销毁失败会如实记录，不宣称操作系统级资源已释放。独立调用导出的 `collect()` 仍需要调用方提供外层截止，正式 CLI 已提供。实现报告对这些边界的说明准确。

## 新增查询逐项复核

| 新章节 / 当前行号 | 规格、SQL 与输出核对 |
|---|---|
| `functions` `:85–103` | 只读取 public/storage 的 pg_proc、pg_namespace、pg_language，kind 限定 f/p/w，排除不能直接使用 pg_get_functiondef 的 aggregate。identity arguments 不含默认值，结果类型不含实际参数值。输出所有 brief 要求的身份/安全属性；proconfig 仅过滤 `search_path`。函数定义仅在服务端内置函数中生成并立即 MD5，客户端接收 hash，不接收正文、prosrc/probin、参数默认表达式或其他配置值。 |
| PUBLIC ACL `:94–100` | `acl_is_null` 保留默认与显式 ACL 的差别；内置 `acldefault('f', owner)` 单独记录；当前 PUBLIC EXECUTE 从 `COALESCE(proacl, acldefault)` 中 grantee=0 的 EXECUTE 项计算，不把 ACL NULL 当成无权限。显式撤销 PUBLIC 和空 ACL 不被 fallback 覆盖。可转授标志来自同一 ACL 记录，未把四角色权限摘要错称为完整 ACL。 |
| `function_privileges` `:104–110` | 相同 schema/kind 范围，角色严格限定 metadata_reader、anon、authenticated、service_role，使用 pg_catalog.has_function_privilege 读取有效 EXECUTE，包括 PostgreSQL 本身的继承/默认权限判定。没有调用目标函数，也没有以 EXECUTE 单独推断可成功调用。 |
| `triggers` `:111–122` | 关系限定 public/storage、排除内部触发器；输出 enabled、type bitmask、被引用函数身份、constraint 标记、参数个数和条件存在标志。tgargs、WHEN 表达式、pg_get_triggerdef 原文均不输出，定义仅在服务端生成 MD5。若引用其他 schema 的触发器函数，仅带出被引用身份，不扩大函数正文/ACL 清单。 |
| `schema_privileges` `:123–128` | public/storage × 四角色；USAGE 与 CREATE 分别由 pg_catalog.has_schema_privilege 计算。本地证据明确存在 EXECUTE=true 但 schema USAGE=false 的情形，报告正确保留这两个控制面的区别。 |
| `default_privileges` `:129–137` | pg_default_acl 只取两个 schema 的默认记录，以及适用于其中对象的 global 默认；用 default_scope 保留两者区别，保留 owner、对象类别和空 ACL。r/S/f/T 范围符合表、序列、函数和类型，排除了创建 schema/large object 的默认。global 行按目标 schema 展开是适用范围标记，不是多份独立授权；这些创建时默认不会追溯修改现有对象，也不替代 proacl 的内置 fallback。 |

五条查询均为固定 SELECT，关系来源为 pg_catalog，实际使用的函数均显式限定 pg_catalog；无新增 public/storage 业务行读取、目标业务函数调用、DDL/授权或对象枚举。函数和触发器 hash 是差异指纹，不能证明完整语义、恢复能力或抵抗恶意碰撞；brief 和实现报告没有据此做更强承诺。

本地 SQL fixture 为函数正文、默认参数、非 search_path 配置、触发器参数与 WHEN 放置了不同的合成标记；在最终五节 `sections` 中均未出现。这与 SQL 的投影一致。证据文件本身记录合成 fixture SQL 是本地测试说明，不是远端正文采集。

## 保留约束与未验证边界

TLS/主机限制、角色白名单、固定凭据路径、只读事务、10s/2s/15s 事务内限时与校验、保存点失败分类、固定 bucket 查询和 `wx` 证据保留均未被本次增量削弱。原采集/分析证据保持历史含义；新增字段应由新的远端快照承载。

本次没有验证真实 TLS 握手、远端 PostgreSQL 17 对五节 catalog 的权限/性能、bucket 可见性、业务函数执行结果、SECURITY DEFINER 的函数体安全、触发器完整语义、备份恢复、应用/Worker adapter 或生产权限修复。PG14 临时 fixture 支持语法及合成语义核对，不能替代上述远端证据。后续任何一节被拒绝或超时都应保留 `denied/error/partial`，不得转述为完整采集通过。

## 审查输入指纹

| 文件 | SHA256 |
|---|---|
| `scripts/inspect-supabase-metadata.cjs` | `df6493a88f861f720ba105efdf38aef34cb4e01a0cb3732cdd447f3f95670615` |
| `scripts/__tests__/inspect-supabase-metadata.test.cjs` | `53efa031e628a66e376e945350a45ec2df76a91da1e3d2ff589dfee22f517314` |
| `metadata-supplement-brief.md` | `6387c58c36921bf813b3fb8f02a1699d3229db960eea7f60d5acc022cb7463a8` |
| `metadata-supplement-report.md` | `95b21f0b8c06d25555c1ac7384e01ce42b976cb0e742bc2d7ecc19a248da313f` |
| `metadata-review.diff` | `00d6b0fab0ca9ea06fcaec509a3a78d7e8166e585e24c1c99077a07541481328` |
| `metadata-review-source-hashes.json` | `b6df94c153ae01c1ec8532616d561c1d1091befc6f604ca2664067e66f14b40e` |
| `verification.json` | `100340ec094ef5f743e7ba428f533dc5335f104c37de8aa8f7deea08a8b8fab9` |
| `scope-final-green.tap` | `c6125a9fe4b0d54dbc774e44f9d3435af33ca9e0663e2954737c90e8b96da45f` |
| `local-catalog-final.json` | `1c350607b0cfca03707741ceab9046540199f5922e80d639d2deba4f753831ff` |
| `local-catalog-postgres14.json` | `d91a3287fbd7a55dba52f06d4211071cdb43264518114de0593ad98c1660f2c9` |

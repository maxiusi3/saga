# 新远端快照事实复核

2026-10-17（Asia/Taipei）。独立复核：`/root/metadata_review`。仅核对指定命令记录、分析、新旧快照与研究报告；为签名/声明比较读取两份根迁移的有关函数声明。未重新审代码、运行 SQL、连接远端、读取凭据或远端函数正文；未修改原文件。

最终结论：**事实复核通过。** 快照与分析的计数、原 11 节一致性、权限摘要和两条邀请 RPC 的签名差异均可复算成立；初次发现的 1 处 P2 文字事实错误已由主代理更正，本代理已仅对该句补核并关闭。无剩余事实问题；不将此结论扩展为函数体等价、已确认越权、全迁移语义审查或发布门禁通过。

## 初次发现与关闭记录

**P2 — `mark_notifications_as_read` 的远端语言被误写为 sql。** `docs/research/2026-10-17-metadata-supplement.md:36` 写“本地声明 plpgsql、远端为 sql”，但新快照 `sections.functions` 中该函数的 `language`（快照 `:10673`）是 **plpgsql**；根迁移 `supabase/migrations/20260625081000_dashboard_support_tables.sql:206` 同样是 **plpgsql**。该语言差异不存在，应删除这一差异陈述。参数/返回类型与声明语言相同仍不能证明正文语义或权限检查等价；现有“不当作完整等价”的结论应保留。`remote-analysis.json` 没有这条错误语言断言，无需因此推翻其结果。

问题依据固定于下列初稿指纹 `0add4b8d…` 和原始新快照指纹 `8b2a4647…`。主代理随后将研究报告 `:36` 更正为：“`mark_notifications_as_read` 的参数/返回形状及plpgsql语言均相符，仍不能据此确认函数体完整等价。”本代理复读了这一句，与新快照和本地声明一致，**P2 已关闭**；修订后文档 SHA256 为 `ba9063fd3f14140bf3ca1855d0ddaf9a6e4d60a631c4e053c0235e4148487a1e`。本次关闭仅复核此句，没有重跑或扩大审查；源码与 `remote-analysis.json` 未因此改动。

## 已确认

- 命令起止时间差四舍五入为 **28.25 秒**，退出 **2 / partial**；新快照的采集器来源是已经通过增量审查的 `df6493a8…`。TLS authorized/TLSv1.3、PostgreSQL 17.4、metadata_reader、只读可重复读、10s/2s/15s、总截止未触发、`connectionClosed: true` / `connectionCleanup.status: closed` 均与分析一致。
- 逐节按 `rows` 重算，新增结果为 **39** 函数（public 20/storage 19）、**156** 函数权限、**21** 非内部触发器（public 14/storage 7）、**8** schema 权限、**9** 默认 ACL。其他关系/字段/策略/索引/约束/权限数量为 **43/459/79/141/167/172**；bucket 仍为 **denied/42501**。全部 **11** 个旧章节的完整结果与 02:45 快照逐字段相同，包含 bucket 拒绝状态。
- public 20 个函数均有 PUBLIC EXECUTE；其中 **14** 个 SECURITY DEFINER、**12** 个非 trigger 返回函数，**8** 个 SECURITY DEFINER 没有函数级 search_path 配置。四个目标角色对 39 个函数均显示有效 EXECUTE；四角色均无目标 schema CREATE，metadata_reader 有 public USAGE、无 storage USAGE。研究报告正确区分表读取被拒、函数 EXECUTE、schema USAGE 和函数内部授权，未把 PUBLIC EXECUTE/缺少函数级配置写成已证实越权或泄漏。9 条默认 ACL 的实际对象类别是表/序列/函数，属于指定 owner 在指定 schema 创建新对象时的默认，而非现有对象的追溯修复。
- `accept_project_invitation` 的本地声明是 **(text, uuid)**，命名参数为 p_token/p_user_id，返回 project_id/role/success（根迁移 `20261006000001:204–214`）；远端是 **(uuid, uuid)**，p_invitation_id/p_user_id，返回 project_id/user_id/role/status/joined_at。签名与返回形状差异成立。
- `send_project_invitation` 的本地参数类型是 **(uuid, uuid, text, text, text)**（同一根迁移 `:133–148`），远端是 **(uuid, uuid, text, uuid, text)**，且命名参数契约不同。第四个参数类型差异成立；同名不表示相同重载或可安全重放。
- `process_package_purchase` 与 `request_data_export` 各有两个远端重载。分析文件交叉清单中的远端重载身份/返回类型/MD5 以及对应触发器记录均匹配新快照；七个版本仍不在四条迁移账本中。这里仅核对引用的远端元数据，没有扩大为七份迁移正文或 SQL 等价审查。

## 输入指纹

| 文件 | SHA256 |
|---|---|
| `remote-capture.json` | `775e2c9e6c922780f56708f691f9ac09594eabc04414a1ad058900ca7fdc9698` |
| `remote-analysis.json` | `54600eec6323cb0f48f0d9db60dc569459d2059a75b48a1bdad711c9856eae57` |
| 新 `snapshot-2026-10-17T06-13-03-052Z.json` | `8b2a4647b017305183e67b2b932be02080a789dba4fc48b23b2f23a97991e66e` |
| 旧 `snapshot-2026-10-17T02-45-52-407Z.json` | `bb808a1ce050947d21963ca91ec49c3adfa0ab80fe24f24f653f8c18bc6e6a4f` |
| `docs/research/2026-10-17-metadata-supplement.md`（初次读取版本） | `0add4b8dd7d691264b32efbc13795b1f5d3d91082c656a43aea41fda567c36e8` |
| `docs/research/2026-10-17-metadata-supplement.md`（P2 关闭时版本） | `ba9063fd3f14140bf3ca1855d0ddaf9a6e4d60a631c4e053c0235e4148487a1e` |
| `supabase/migrations/20261006000001_fix_wallet_rls_and_rpcs.sql` | `8aa01d232796c63c56e4e6d85bfbf262741d1ff908b2d17c1e95c1332895752b` |
| `supabase/migrations/20260625081000_dashboard_support_tables.sql` | `526130a7fe84dca1327fd3b8cc7546c3445eadf0d6d29b896499ccfcb73a32de` |

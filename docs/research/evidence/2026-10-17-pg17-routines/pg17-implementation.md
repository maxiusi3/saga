# PG17 实验实施与自查

2026-10-18（Asia/Taipei）。Task 2 的本地实现及最终验证通过，独立审查由主控制器另行完成。候选仅位于 `experiments/pg17-routines/`，没有部署或修改根迁移、应用、依赖、旧实验。本次续接没有远端连接、提交、推送或子代理。

最终正常运行与污染环境运行各通过 **141 个场景、874 项断言**；生命周期观察器通过 **4/4**。两次完整运行都精确重放 12 个 RPC 加 1 个触发定义，使用相同最终源码；服务器停止、临时目录删除、连接数归零均成功。操作说明和边界见 [README](../../../../experiments/pg17-routines/README.md)，逐文件 SHA-256、全部基线结果、生命周期子报告、旧证据完整性和核验结果见 [机器可读清单](pg17-implementation-verification.json)。

## 最终证据

| 验证 | 结果 | 证据 / SHA-256 |
| --- | --- | --- |
| `node experiments/pg17-routines/verify.mjs` | exit 0；141 场景 / 874 断言 | [正常运行](pg17-run-2026-10-18T02-25-37.008Z-a5556a7c-71a9-470a-8df3-7658541381df.json)；`3d96c748299e37139c3790bc21aab6cdf16daa8c8881e93cb1121227a149048b` |
| `node experiments/pg17-routines/verify-lifecycle.mjs` | exit 0；4/4；无需救援清理 | [生命周期](pg17-lifecycle-2026-10-18T02-31-48.265Z-52dcf725-6ae7-4eb5-be2b-3028f0f1dbe9.json)；`0a11e668a5289c8aa7a8fa5c68d4f34a8e58ec2078bfa87bd18b72299bd470df` |
| 污染 PG 环境子进程 | exit 0；141 场景 / 874 断言；14 个污染变量被清除 | [污染环境](pg17-run-2026-10-18T02-31-48.447Z-e843ebe6-0786-4fff-b593-90f7f8b62775.json)；`6336e9927648caeb20394ca01461accc09983f11e22cfc2cda02e6d3f89a4bdd` |
| fixture 就绪后真实 SIGTERM | exit 143；interrupted；观察到 postmaster 消失 | [信号清理](pg17-run-2026-10-18T02-31-59.154Z-e2d318d7-a20a-47e5-9123-aac21f4ce21e.json) |
| 实际无效服务器启动 | exit 1；`SUBPROCESS_FAILED`；启动确实被尝试 | [启动失败](pg17-run-2026-10-18T02-32-00.797Z-97c419b8-23d7-4e6c-8a9a-53ae5ef84b8e.json) |
| 不存在的实际连接角色 | exit 1；`28000`；连接失败后完整清理 | [连接失败](pg17-run-2026-10-18T02-32-02.075Z-25a4d827-302b-4851-b4d6-88e2eb0cf5df.json) |
| 7 个 `.mjs` / `.cjs` 语法检查 | `node --check` 全部 exit 0 | 清单中的 `syntaxChecks` |

两个完整运行均含 62 个基线场景（12 × 5 加两个私有套餐分支）、2 个 CHECK 域场景和 12 个真实并发场景；其余 65 个场景覆盖候选、权限、事务、选项和触发器。141 是场景数量，不是 RPC 调用数量。60 个主基线场景都另跑一次显式回滚，核对七张表恢复；两个附加套餐分支核对失败没有部分写入。

## 实现、来源与差异

- `runtime.mjs` 管理固定运行时、独立 Unix socket、真实低权限连接和失败清理。PG17.4 来自 [本地构建记录](runtime-build.json)，官方源码归档 SHA-256 为 `c4605b73fea11963406699f949b966e5d173a7ee0ccaef8938dec0ca8a995fe7`。启动前核对三个可执行文件指纹；postgres 为 `81214d9c55486f6babdc14f772d2d938870f9b985d7b31aa577e66af0ccba36d`，实际版本为 `postgres (PostgreSQL) 17.4`，`plpgsql.variable_conflict=error`。Node 为 v22.22.2，既有 pg 驱动为 8.16.3；没有安装新依赖或系统服务。
- `replay.mjs` 将两份公开采集、对应私有文件、定义 MD5/SHA-256 与固定快照绑定。12-RPC 私有文件 SHA-256 为 `f2f37cf33860c4bc6ba22ccec90e0cc0f6d44f311e6be9c6f2e15707d2a2bedc`；触发私有文件为 `45ec35ec3f9bf45741705d9fd2c7ce09953683e342dbe313fe7e482cb20067e5`；快照为 `8b2a4647b017305183e67b2b932be02080a789dba4fc48b23b2f23a97991e66e`。逐一定义身份、指纹、批准的表依赖见清单；私有正文未复制到公开源码或证据。
- `fixture.sql` / `schema-manifest.json` 对七张相关 public 表建立并核对 **70 列、34 约束、34 索引、3 个触发绑定**。三个绑定的定义 MD5 与快照一致；重放后的 13 个函数规范定义 MD5 也一致。`setup-fixture.cjs` 只针对固定快照和受限选择生成 fixture，普通验证不调用生成器。
- 两个 CHECK 的 PG17 反解析结果从“整个数组转 text[]”变为“逐项转 text”。报告保留实际和预期表达式；仅对 `notifications_type_check`、`project_members_role_check` 做具名比较归一。所有合法值通过，非法值为 `23514`、NOT NULL 为 `23502`；临时去除 NOT NULL 后验证 CHECK 单独允许 NULL，再回滚恢复。这不是任意忽略约束差异。
- `auth.users(id)`、读取 GUC 的 `auth.uid()` 是合成依赖；`extensions.uuid_generate_v4()` 是到内置 UUID 函数的公开说明 shim。所有者为非登录、非 superuser 的 `fixture_owner`。真实 caller 角色无继承、无 superuser/BYPASSRLS。RLS 启用且未强制，但省略生产策略并撤销 caller 表权限，刻意比生产直表边界严格。完整 Supabase、真实 JWT/角色继承/服务绕过、其他 public/auth/storage 对象、扩展钩子、规则及 worker 未还原。

来源语义依据为 [12-RPC 审查](../2026-10-17-routine-audit/semantic-review.md)、[调用点审查](../2026-10-17-routine-audit/callsite-review.md)、[触发审查](trigger-semantic-review.md)。哈希校验绑定已审输入，不是对任意未知 SQL 的语义安全判断。原定义没有为获得通过而改写。

## 全部基线的实际结果

表中顺序为：合法合成参数 / 无身份 claim / 不同 caller / 无效参数 / anon 无 claim。F02 无参数，所谓无效参数行实际再次调用同一无参数身份。除说明外，错误均未留下七表部分写入；主场景显式回滚检查全部通过。

| ID / 函数 | 五个客户端 SQLSTATE | 实际结果或后置条件 |
| --- | --- | --- |
| F01 `accept_project_invitation(uuid,uuid)` | `00000 / 00000 / 00000 / P0001 / 00000` | 有效、无 claim、不同 caller、anon 均把目标 pending 角色改为 active 并写 joined_at；邀请授权缺口在本地可执行。 |
| F02 `cleanup_expired_invitations()` | 全部 `42703` | 缺列分类，无删除；不等于已验证可清理全部邀请。 |
| F03 `create_checkout_session(text,uuid,text)` | 全部 `00000` | JSON 对象两字段，已批准类型为 success:boolean、message:string，success=true；七表无变化；不代表外部结账。私有字符串未输出。 |
| F04 `create_project_with_role(text,text,uuid,text)` | `00000 / 00000 / 00000 / 23502 / 00000` | 无券用户也产生 paid 项目、角色及钱包；无 claim、不同 caller 和 anon 同样可执行。 |
| F05 `get_unread_notification_count(uuid)` | 全部 `00000` | 前三项及 anon 返回合成目标未读数 1；NULL 参数返回 0；无写入。 |
| F06 `initialize_user_wallet(uuid)` | `42703 / 42703 / P0001 / 42703 / 42703` | 不同 caller 被拒绝；无 claim 走到缺列错误。未成功初始化钱包。 |
| F07 `mark_notifications_as_read(uuid,uuid[])` | 全部 `00000` | 有效、无 claim、不同 caller 和 anon 均实际标记目标通知；无效参数返回 0 且不改行。 |
| F08 `process_package_purchase(uuid,text,integer,integer,text)` | 全部 `42703` | 缺列分类，无钱包/交易部分写入；未证明能够任意增减资源。 |
| F09 `process_package_purchase(text,text,uuid)` | 全部 `P0001` | 有效套餐路径（包括另两个私有分支）错误文本只被分类为名称歧义；无效套餐为其他错误分类。没有成功入账，没有 JSON 成功结果。 |
| F10 `request_data_export(uuid,uuid,boolean,boolean)` | `00000 / 00000 / 00000 / P0001 / 00000` | 返回一行真实 UUID 形状、queued 和时间，但 export_requests 行没有增加。 |
| F11 `request_data_export(uuid,uuid,jsonb)` | 全部 `42702` | 实际名称歧义，无持久请求。没有切换 variable_conflict 来掩盖错误。 |
| F12 `send_project_invitation(uuid,uuid,text,uuid,text)` | `42703 / 42703 / 42703 / P0001 / 42703` | 合法路径缺列；无效参数另行拒绝；未产生邀请/成员行。 |

F09 的 **客户端 SQLSTATE 是 P0001，不能写成 42702**。`ambiguous_reference` 只是对私有错误消息的限定模式分类；报告没有暴露内部错误文字、CONTEXT 或查询，也没有取得一个独立的内部 SQLSTATE。F11 才是本次直接观测到的 42702。其余缺列分类同样只结合固定 schema/语义审查说明依赖缺口，不把静态风险当成功利用。

## 导出候选与自查

两重载保留完整参数名、无默认参数及原返回形状。只允许非 NULL 的本人身份，并要求同一项目 facilitator 或 active project_roles。使用空 search_path、限定表/函数名；两个精确签名均撤销 PUBLIC/anon/metadata_reader/service_role EXECUTE，只授予 authenticated，没有 service 回退。目录查询和真实 caller 连接分别检查签名、TABLE 列、UUID 返回类型、所有者和 ACL；伪造 claim 不能获得实际角色的 EXECUTE 或 SET ROLE。

每次成功都插入恰一条 pending 请求；四参返回该行 ID、创建时间及 queued，持久化两个 include 布尔值。三参仅接收四个 include 布尔键，缺失键默认 true，拒绝未知/身份/状态/ID 键与 NULL 或非布尔值。四参 NULL 布尔也被明确拒绝。此选项策略改变了旧函数忽略 flags 或原样接收任意 JSON 的行为，兼容影响已记录。应用的 TABLE 解包问题仍未修改。

项目行先锁，必要时再锁 active 角色行。两个重载 × 成员 UPDATE/DELETE、facilitator UPDATE × 两种先后顺序，共 **12** 个场景都捕获到真实 `pg_locks` 等待及 blocker。请求先完成授权时，撤权必须等待请求事务提交；撤权先提交时，请求等待后重新核对并以 42501 拒绝，只有历史请求保留。已提交请求不会因后续撤权被自动撤销。粗粒度项目行锁会串行化同项目请求；没有吞吐性能证明。

全候选 DDL 内注入 22012 后，两函数定义/ACL 与历史行完整恢复；重复应用状态稳定。实际 23514 插入约束失败和 caller 主动回滚均无残留请求；本地 marker 缺失的 42501 也不改变状态。没有破坏性 down migration。请求返回发生在 caller 事务内，只有 COMMIT 后才持久；COMMIT 后响应丢失仍可能导致重试重复登记，接口没有幂等键。

自查发现并修正两个测试前置数据缺口：

1. 原 `project_members_only` 使用 inactive 行，不能充分证明“仅有 active project_members 也不授权”。现在 seed 为 active，调用前断言该行 active 且不存在同项目 project_roles，再验证两重载都以 42501 拒绝且无状态变化。
2. 原 `deleted_member` 只是从未拥有角色的用户。现在在每个重载对应场景内先真实 INSERT active project_roles 并核对结果，再 DELETE 恰一行，核对已无该成员后调用并验证拒绝。

这两项只修改 `scenarios.mjs`，增加 10 个前置断言，未增加场景，也未修改候选或运行时。相较中断前最终污染环境源码，其他 10 个已有文件的 SHA-256 均相同；另新增 README。中断前 141/864 的正常和污染环境结果保留，但不能代替以上两项更严格的最终 141/874 验证。自查没有发现需要进一步修改候选/运行时的具体缺陷；这不替代独立审查。

## 保留的初始失败

所有 12 份中断前 PG17 报告保留且指纹核对一致，详见清单中的 `historicalEvidence`。

| 阶段 | 原始结果 | 解释及当前处理 |
| --- | --- | --- |
| 16:25:06、16:26:24 的 RED 尝试 | 105 断言后 `42830`，0 场景 | fixture 前置外键失败，不计为导出 RED。当前生成器先建立 PK/UNIQUE 约束，再建立其余约束。 |
| 16:26:49 | 121 断言后 `all70 column shapes actual catalog` 失败，0 场景 | catalog 列比较的前置失败；当前使用固定 `pg_catalog,public` 路径核对规范反解析，70 列全部通过。 |
| 16:28:11、16:28:55 | 122 断言后 `all34 constraints actual catalog` 失败，0 场景 | 两个数组 CHECK 反解析差异；当前具名归一并用真实约束/NULL 测试核验。 |
| [16:29:46 的有效 RED](pg17-red-2026-10-17T16-29-46.233Z-dd51b3a7-8f32-4aa3-bdee-cddbc2a60564.json) | 410 断言；63 场景条目中 62 通过、1 失败 | 在原四参函数的 `returned id identifies one persistent request` 断言真实失败；基线已记录 queued 但没有持久行。SHA-256：`f2853b6fe511a4551be4435b0fb01bc0f68b4422499ccec27e14314361c3e256`。 |

旧有效 RED 的直接失败对象是四参导出；三参 42702 是完整基线的实际失败结果，不将其冒称为另一个独立 RED 命令。续接未重复 RED，最终正常/污染运行再次执行了同样的原定义基线。

## 限制与交接

这是导出函数自身入口的局部修复。F01、F04 等仍可在当前基线绕过真实 caller 建立成员关系或项目/资源；部署前必须一起完成其他权限路径的修复，否则被信任的成员状态可从别处获得。支付真实性、邀请 email/token 契约、生产 JWT 与 PostgREST、实际角色继承和直表权限、Storage/worker 的再授权、任务消费、下载/邮件交付都不属于本地通过范围。管理员改变角色或 schema 也在威胁边界之外。queued 只表示请求登记。

主控制器提供的 [项目验证续接检查](project-checks-resume.json) 已确认 707 个应用输入和 52 个受保护文件匹配此前通过的全量验证：web 77 suites / 766 tests、shared 4 / 16、infra 7、175 pages。此任务没有重跑或更改应用验证；依赖审计既有失败仍沿用。独立审查、主文档交接和原 G0/G1 里程碑判定由主控制器完成；本地实验通过不是提交/推送或部署授权。

# G0 / T02 远端元数据与迁移差异

2026-10-17（Asia/Taipei）。按[本批计划](../superpowers/plans/2026-10-17-upgrade-remote-metadata.md)，使用前置会话配置的 `metadata_reader` 读取真实 Supabase 元数据。本轮没有创建角色、改变权限、执行迁移、读取家庭正文或 Storage 对象、部署或推送。

**已补齐实际表、字段、RLS、索引、约束和迁移版本证据；发现 Storage 隔离规则与迁移账本存在实质差异，G0/G1 仍未通过。** 后续优先处理这些差异，再接正式资产/Worker adapter。

## 1. 采集与证据范围

运行 [inspect-supabase-metadata.cjs](../../scripts/inspect-supabase-metadata.cjs)，使用现有 pg 8.16.3，无新增依赖。凭据从已配置的本地文件读入内存；两份凭据已加精确 Git 忽略规则，未加入索引。报告只保留固定错误代码，不保留密码、连接串、迁移作者或 migration statements。

最终证据是 [snapshot-2026-10-17T02-45-52-407Z.json](evidence/2026-10-17-remote-metadata/snapshot-2026-10-17T02-45-52-407Z.json)，快照为 UTC 时间，源文件哈希、全部采集 SQL 与数据库参数在文件内。比较结果见 [comparison.json](evidence/2026-10-17-remote-metadata/comparison.json)。连接关闭，事务回滚；采集退出 **2 / partial** 是 bucket 配置被拒绝的真实结果，不当作全项成功。

| 项目 | 实际结果 | 解释 |
|---|---|---|
| 项目/连接 | `encdblxyxztvfxotfuyh` 对应的受限 pooler 登录；数据库角色 `metadata_reader`，PostgreSQL **17.4** | 不是此前隔离 PoC 的 PostgreSQL 14.17；正式 adapter 仍需在匹配版本/连接方式下回归 |
| TLS | 证书与主机验证开启，连接 `authorized=true`、TLS 1.3 | 默认信任链首次拒绝后，从 Supabase 公共 CA 地址经验证的 HTTPS 取得证书；未禁用 TLS 验证。见 [CA 来源](evidence/2026-10-17-remote-metadata/tls-ca-source.json) |
| 事务 | `REPEATABLE READ READ ONLY`；statement **10s**、lock **2s**、idle-in-transaction **15s**，外层 **90s**截止 | 连接池没有采用启动 options，首份快照显示 2min/0/0；改为事务内 SET LOCAL 并检查实际值后重新采集 |
| 关系/字段 | **43 / 459** | public 32张表＋3个视图；storage 8张表。40张基础表均启用 RLS；视图不能用表的 RLS 开关判断安全 |
| RLS/索引/约束 | **79 / 141 / 167** | 记录实际定义；RLS enabled 不表示策略符合项目隔离 |
| 表级权限 | **172**条角色/关系组合 | metadata_reader 在这43个关系上没有 SELECT、任意列 SELECT、INSERT、UPDATE、DELETE 权限；未审计所有可执行函数，不能扩写为所有访问路径都已证明拒绝 |
| audit_meta | 6个视图；tables/columns 返回 **0/0** | 这两个视图基于按调用者权限过滤的 information_schema。pg_catalog 实际取得43/459，零结果不能解释成库中没有表或字段 |
| 迁移账本 | **4**个版本 | 显式只读 version/name，排除作者和原始 statements |
| bucket 配置 | **denied / 42501** | 未确认 `saga`/`audio-recordings` 是否存在、public标志、文件上限或MIME；策略提到 bucket 不证明 bucket 存在 |

首份 [02:33 快照](evidence/2026-10-17-remote-metadata/snapshot-2026-10-17T02-33-19-509Z.json)保留为历史，不能用其2min/0/0代表最终超时设置，其脚本哈希也不再代表最终源码。先前 [只读账户配置记录](2026-10-17-supabase-metadata-readonly.md)及其原始JSON保留；本批未重演其中的DDL/业务读取拒绝探测。

## 2. 迁移账本不能直接驱动重放

远端仅登记 `20250731012532`、`20250731015259`、`20250802015525`、`20250802015612`，对应仓库4个 remote-history placeholder。以下 **7个根迁移版本没有登记**，但其中声明的20张public表均已存在；“未登记”不等于“未执行”。

| 根迁移版本 | 当前可确认的状态 | 仍不能据此确认 |
|---|---|---|
| 20260611000000 agent phase1 | 5张表存在、启用RLS | 完整字段、函数、触发器、权限与迁移逐条等价 |
| 20260612000000 public archive | 7张表存在、启用RLS | 同上；不能解释为何/何时创建 |
| 20260621000000 storage policies | saga相关策略已存在 | bucket配置；策略中路径字段实际绑定错误，见下节 |
| 20260625081000 dashboard | 7张支持表存在 | 后续覆盖与函数/触发器状态；不能重建覆盖 |
| 20261006000001 wallet/RPC | wallet表存在 | RPC函数体、EXECUTE权限、调用者身份检查未在本批审计 |
| 20261007000001 waitlist | waitlist_signups表存在 | 完整函数/视图权限与业务语义 |
| 20261007000002 storage RLS | 4条指定管理/上传策略存在 | 项目路径引用、撤权语义仍有差异 |

逐文件版本、SHA256、表名交叉核对见 comparison.json；此对照是表名级覆盖，不是 SQL 等价证明。不要运行 `migration repair`、`db push --linked` 或重放 bootstrap 来“补齐”账本。先补函数/触发器/ACL差异、备份恢复依据，在隔离数据库演练明确的增量修复，再单独审阅历史对账方案。

## 3. 必须先处理的权限差异

下面是实际策略与ACL的静态证据。没有请求真实录音或枚举对象，因此**不能宣称已发生资料外泄或已完成攻击实测**；这些规则本身已足以阻止隔离质量门通过。

| 差异 | 证据与影响 | 后续修复验收 |
|---|---|---|
| audio-recordings 全桶读取 | `Allow public read access to audio jf5dkp_0` 是 PERMISSIVE / SELECT / public，唯一条件 `bucket_id = 'audio-recordings'`；anon/authenticated 均有 storage schema USAGE 与 objects SELECT。若存在对应对象，数据库策略不要求用户或项目成员身份 | 清除全桶放行，统一已授权对象规则；匿名、另一家庭、已撤权上传者都拒绝；先用虚构对象在隔离环境复现 |
| audio-recordings 全桶上传 | `Allow authenticated users to upload audio jf5dkp_0` 只检查 authenticated 和 bucket，未绑定用户路径或项目 | 验证资产/会话与当前项目成员，不能任意选择他人路径；覆盖两家庭交叉上传 |
| saga 项目路径误绑定 | 远端5条项目策略的子查询出现 `storage.foldername(p.name)`，读取的是 `projects.name`；本地SQL使用未限定的 `name`，内层projects恰有同名列 | 用明确的外层 `storage.objects.name` 消除绑定歧义；测试普通项目名和看似路径的项目名，验证都按真实对象路径授权 |
| saga 原上传者分支绕过撤权 | 多条PERMISSIVE策略仅凭对象首级目录等于auth.uid即放行；项目共享文件也会满足，且项目读取策略还缺 active 检查 | 个人文件与项目文件先分路径契约，项目分支始终检查当前成员；单加一条严格策略不能收紧旧PERMISSIVE规则的 OR 结果 |
| stories 存在并行许可路径 | `stories_insert_members` 的首个OR分支只要求 `auth.uid() = COALESCE(user_id, storyteller_id)`；另一条较严insert策略不会抵消它。旧select/update也有storyteller自身分支 | 在T03统一动作规则，验证另一项目插入、撤权后访问/修改；不能仅通过当前requireProjectAccess路由测试证明直接表访问安全 |

现有服务端 `requireProjectAccess` 以 facilitator 或 active project_roles 授权，与这些直接数据库/Storage规则不是同一控制面。本轮记录修复要求，没有改动线上策略；远端修复仍需按既定发布约束另行处理。

## 4. P1 schema / adapter 差异

本次 public catalog 中不存在拟新增的 `media_assets`、`legacy_media_references`、`processing_jobs`、`processing_attempts`、`consent_records`、`deletion_requests`、`deletion_targets`、`recording_sessions`。现有 agent 表不等价于这些结构。

| 实际结构 | 与本地契约/恢复脚本的差异 | 实施要求 |
|---|---|---|
| stories.images = **jsonb[]** | bootstrap与当前资产文档按jsonb描述；photo_urls text[]、photo_url、mastered_audio_url等旧字段并存 | 保留逐来源映射，不直接ALTER覆盖旧值；虚构fixture覆盖数组、旧字段及歧义；新资产使用明确ID/bucket/key |
| stories.title / storyteller_id = **NOT NULL** | bootstrap新表定义允许title为空，当前服务层同时有user_id兼容 | 适配真实必填约束；user_id不能自动替代storyteller_id或变成授权来源 |
| project_roles.role CHECK 仅 **facilitator/storyteller** | 计划动作矩阵还有owner/co_facilitator；status实际允许active/inactive/pending，与bootstrap不同；invited_at不存在 | 定义兼容映射与数据修复证据，禁止用CREATE TABLE IF NOT EXISTS声称已升级CHECK/字段 |
| project_roles同时有项目/用户唯一索引 | 既有三列UNIQUE并不表示可以写多条同项目/用户角色；两条额外唯一索引覆盖project_id/user_id | 保留当前唯一性，不能从单个约束列表推断重复身份；再决定角色模型 |
| profiles.email = NOT NULL/UNIQUE，id→auth.users；user_id另有唯一索引 | 与bootstrap的可空email、身份回填假设不同 | 不重放用户回填；真实资料盘点须单独设计最小字段，当前未读取行 |
| PostgreSQL17.4 / pooler | 现有持久Worker故障证据运行于本地14.17 | 正式事务adapter需要匹配版本与连接语义验证，尤其SET LOCAL、锁、租约、提交未知和取消 |

后续顺序：先用本快照构造隔离的RLS负例并形成修复候选；补bucket配置及函数/触发器/ACL；对照真实schema写增量迁移草案；备份/回退验证后才考虑正式T02影子读取和新写入。T05候选协议与物理GC保持独立；未知publishing/reserved和原始块继续保留。

## 5. 剩余证据与最小补充方式

当前账户不需要业务表 SELECT 权限。bucket缺口可由有权限的负责人导出以下固定字段，或审阅新增同字段只读视图；**本轮未执行授权或创建视图**：

```sql
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id IN ('saga', 'audio-recordings')
ORDER BY id;
```

该查询不含对象名或正文。对象数/字节、缺件/孤儿、实际归属、备份与Storage恢复、当前生产alias/环境变量、供应商账户数据条件、真机5/20/30分钟矩阵仍缺。函数/触发器/视图安全语义也不能由本批表级权限摘要替代。后续不要再次重复已成功的 schema/history 访问配置。

## 6. 验证与里程碑

- 采集器最终定向测试 **10项通过**，覆盖凭据解析、TLS开启、错误脱敏、权限拒绝与空结果区分、回滚失败、角色/只读状态、后端超时校验及只读事务收尾。见 [unit-final.txt](evidence/2026-10-17-remote-metadata/unit-final.txt)。初始缺模块RED和8项初版结果保留，不冒充最终测试。
- 本轮 `npm run verify` **76套/730项**、类型/lint、**175页**构建通过；shared **4套/16项**、infra **7项**通过，见 [project-checks.json](evidence/2026-10-17-remote-metadata/project-checks.json)。应用与依赖未改，未为新增独立采集器重复T05合并/故障集成；那些结果仍属于前批证据。
- 构建前next-env原字节恢复。现有缺服务端Supabase配置、Next旧eslint配置、images.domains弃用与Watchman提示仍在，不当作生产配置验收。
- 实际 `audit:high` 仍退出 **1：42项（34 high / 8 moderate / 0 critical）**；原始命令文本与合法JSON分开保存。
- G0的schema/history证据缺口已有进展，但权限风险、bucket/对象/备份/回退与供应商条件未关闭；G1正式adapter、跨家庭/原件交付和真机验收未完成。见 [milestone-check.json](evidence/2026-10-17-remote-metadata/milestone-check.json)。本批不构成原计划里程碑，未提交、推送、迁移或部署。

最终源码、证据、文档与审查状态由 [verification.json](evidence/2026-10-17-remote-metadata/verification.json) 统一索引。

独立审查因子代理模型不可用及服务限流未能执行；[审查状态](evidence/2026-10-17-remote-metadata/review-status.md)明确区分主代理自查和独立审查。本批采集、分析与交接已完成，独立审查待补，未宣称审查门通过。

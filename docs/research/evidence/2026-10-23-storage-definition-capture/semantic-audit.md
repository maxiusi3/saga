# Storage 精确定义语义审计

2026-10-23。已核验本次捕获的六个函数与七个实际触发器，并完成静态语义审查。所有目标均与固定 10 月 17 日快照匹配。本报告只关闭这十三个目标的定义缺口；没有执行捕获定义、重跑本地组合实验、重新连接远端、调用 Storage HTTP 或读取真实对象。P0/G0、生产权限、媒体私密性及备份恢复仍未通过。

原始函数正文、触发器参数与条件保留在私有文件；本报告只记录语义。两条带参触发器的唯一参数均指定同一个服务数据库角色，下文用 **R** 表示，避免复述私有参数。它是 PostgreSQL 有效角色身份，不是用户 ID、JWT 文本或应用中的管理员标记。

## 证据及完整性

| 输入 | 静态核验结果 |
| --- | --- |
| [公开捕获报告](capture-storage-2026-10-23T10-39-09-891Z-703d8318-8589-48d0-ba55-e519f02b74fa.json) | `status=captured`，六函数/七触发器全部 `matched`；报告 SHA-256：`eb5e76b7d39a8eeff4b1fc59ee37704b4278dd531ee0b287673f38ad8ea024a1` |
| 报告中的 `privateCapture.relativePath` | 先核验整体 SHA-256 `f0574a22dda946436936d65234a07302f8b9100862d431f11535c9074a12cf4f`，再私下解析；本次读取确认文件模式 `0600`；目录 `0700` 与独占创建由原捕获报告记录 |
| 每个目标 | 重新计算全部十三个定义的 SHA-256 与 MD5，逐项匹配公开报告及期望 MD5；七个参数字节哈希全部匹配；七个条件均为 null，与 `condition_present=false` 一致 |
| [固定元数据快照](../2026-10-17-remote-metadata/snapshot-2026-10-17T06-13-03-052Z.json) | SHA-256 重新核验为 `8b2a4647b017305183e67b2b932be02080a789dba4fc48b23b2f23a97991e66e`；本报告引用的列、约束、角色属性属于该历史快照，没有冒充本次重采 |
| [捕获脚本](../../../../scripts/inspect-supabase-storage.cjs)及其两个共享脚本 | 三个当前源码 SHA-256 均与公开报告的 `sourceSha256` 匹配。固定目标查询只覆盖这十三个身份，不证明当前 schema 没有其他新对象 |
| 原捕获会话 | 报告记录 `metadata_reader`、只读 REPEATABLE READ、TLS 已验证、90 秒期限未超、连接关闭；本次审计未另建数据库会话 |

以下指纹列为公开 `definitionSha256` 的前 12 位，完整值及参数/条件哈希均见公开报告。短指纹仅便于人工定位，不作为完整性校验替代。

## 六个函数的行为

六个函数均为 PL/pgSQL、SECURITY INVOKER，所有者为 `supabase_storage_admin`；均非 STRICT、非 LEAKPROOF。`foldername` 标为 IMMUTABLE，其余为 VOLATILE。六个 ACL 均为 null，捕获记录的默认 PUBLIC EXECUTE 为真；这不授予表写入权限，也不使触发函数成为可任意直接调用的普通 RPC。

`enforce_bucket_lifecycle_service_role` 与 `protect_bucket_control_columns` 固定 `search_path=pg_catalog`；另外四个没有函数级 `search_path` 设置。后四个会继承调用环境的搜索路径规则，不能把夹具里额外固定搜索路径后的结果称为属性完全一致。所有者名称本身不会使 invoker 函数提升权限。

| 函数／指纹 | 精确语义及边界 |
| --- | --- |
| `enforce_bucket_lifecycle_service_role` / `1cb7aecc95a2` | 在生命周期 AFTER UPDATE 触发器中，任一生命周期字段发生 NULL 安全的实际变化，且 `current_user` 与 R 不同，就抛出 `PST01`。只认当前有效数据库角色的精确身份，成员关系、SUPERUSER 或 BYPASSRLS 属性都不是本函数的放行分支；无实际变化则不拒绝。返回 null 对 AFTER ROW 触发器不表示跳过更新；异常才使语句失败。 |
| `enforce_bucket_name_length` / `bf9dcf9beab8` | 新 bucket 名的 PostgreSQL 字符长度大于 100 时抛出默认 PL/pgSQL 异常 `P0001`；其余返回新行。检查的是 `name`，不是 `id`，不是字节长度。空名、字符集、路径合法性不由此函数校验；NOT NULL 等规则来自表定义。 |
| `foldername` / `a673a01626cb4` | 用斜线拆分输入，再取首段至倒数第二段，返回目录段数组。保留分隔符造成的空段，不做 URL 解码、路径标准化、UUID 校验或授权。普通无斜线路径没有目录段；NULL 输入依赖实现及 PostgreSQL 数组语义，函数元属性不是 STRICT。重复/首尾斜线、空字符串、NULL 应列入下一轮边界对照，不从函数名推断安全路径。 |
| `protect_bucket_control_columns` / `dac4257ed931` | INSERT 与 UPDATE 分支不同，详见下表。INSERT 只在任一生命周期字段非空时检查 PostgreSQL 对 R 的 `MEMBER` 关系，不通过则 `42501`；随后返回新行。UPDATE 先按实际变化判断，再检查类型、清空或成对变化，可能抛 `0A000` / `22023`。此 BEFORE 函数没有独立的 UPDATE 角色检查，角色约束由另一条 AFTER 触发器补齐。 |
| `protect_delete` / `60b634ed07bf` | 读取自定义 GUC `storage.allow_delete_query`，允许缺失并将缺失按否处理；只接受内容精确等于小写 `true` 的文本。未做布尔类型转换，`on`、`1`、`TRUE`、空值或缺失均不能因此放行。否则抛 `42501`。无当前用户、JWT、RLS、bucket、对象所有者分支，不调用外部删除服务。返回 null 对 STATEMENT 触发器不取消后续合法 DELETE。 |
| `update_updated_at_column` / `5b3d8ac75bea` | 每次被触发的对象行更新都把 `updated_at` 改为 PostgreSQL `now()`，再返回新行，包括其他值未改变、调用方提供旧时间的 UPDATE。`now()` 是事务时间，不是对象内容版本、校验值或保证递增的每次调用时钟。它是 `storage` 中的独立函数，不能用同名 `public` 函数替代证据。 |

生命周期 UPDATE 的分支顺序不可交换：

| 顺序 | BEFORE 控制函数的行为 | AFTER 角色函数的效果 |
| --- | --- | --- |
| 1 | 配置与 generation 都没有实际变化，立即返回 | 同样不要求角色 R；列出相同值的 UPDATE 仍会触发，但不会因这些函数的角色检查被拒绝 |
| 2 | 有变化且新 `type` 不是 STANDARD，先抛 `0A000` | 尚未到角色检查；不能把错误来源记成 RLS |
| 3 | STANDARD 且两字段一起清空，允许通过 BEFORE | 实际清空仍要求当前角色精确为 R，否则 `PST01` |
| 4 | 其余变更必须两字段都非空，且配置、generation 相对旧值各自都发生 NULL 安全的变化；否则 `22023` | 合法的新配置仍要求 R；只换 generation、只换配置均不足 |

generation 的列类型是 UUID，函数没有生成新 UUID、检查大小顺序或单调递增。INSERT 的角色检查通过后不走这套 UPDATE 分支，但表上的成对、形状与 STANDARD 约束仍必须满足。

## 七个实际触发器

全部 `enabled=O`（普通 origin/local 会话启用）、非 constraint trigger、没有 WHEN 条件。`UPDATE OF` 看语句是否列出目标列，不等于该列实际发生变化；随后函数才判断旧/新值。两个参数哈希相同的触发器均有一个参数，其余均零参数；没有推测缺失条件。

| 表／触发器／指纹 | 实际绑定 | 参数及重要效果 |
| --- | --- | --- |
| buckets / `enforce_bucket_name_length_trigger` / `580a7c83d8d3` | BEFORE ROW；INSERT 或 UPDATE OF `name`；调用同名检查函数 | 零参数；只改其他列不触发名称检查 |
| buckets / `protect_bucket_control_insert` / `9c4f45c4c979` | BEFORE ROW INSERT；调用 `protect_bucket_control_columns` | 一个指定角色参数；非空生命周期字段须通过对 R 的成员检查 |
| buckets / `protect_bucket_control_update` / `fff25903becd` | BEFORE ROW UPDATE OF `lifecycle_configuration`, `lifecycle_configuration_generation`；调用 `protect_bucket_control_columns` | 零参数；UPDATE 分支不需要参数，不能凭函数名给它补参数或 INSERT 角色逻辑 |
| buckets / `protect_bucket_control_update_role` / `2fcecce16bd2` | AFTER ROW UPDATE OF 上述两个生命周期字段；调用 `enforce_bucket_lifecycle_service_role` | 一个指定角色参数；实际变化后要求精确有效角色 R，异常回滚语句效果 |
| buckets / `protect_buckets_delete` / `9177b20f0ce9` | BEFORE STATEMENT DELETE；调用 `protect_delete` | 零参数；不依赖匹配行数。进入执行的零行 DELETE 也会检查 GUC |
| objects / `protect_objects_delete` / `b6dfbee7d5d3` | BEFORE STATEMENT DELETE；调用 `protect_delete` | 零参数；与 bucket 相同的语句级检查，不是逐对象权限检查 |
| objects / `update_objects_updated_at` / `95588c397966` | BEFORE ROW UPDATE（所有列）；调用 `storage.update_updated_at_column` | 零参数；只有实际到达该触发器的待更新行才会改时间 |

这些绑定没有 TRUNCATE 事件，也不证明 replica 模式、禁用触发器或其他管理员路径受同样保护；不据此推荐使用这些路径。两条 bucket BEFORE ROW 检查在同一语句适用时还受 PostgreSQL 同类触发器名字顺序影响。角色变化检查在 AFTER 阶段，不能在预检时假定它已经完成。

## 已知依赖与未捕获边界

| 依赖 | 本次可下的结论 | 仍未捕获或未验证 |
| --- | --- | --- |
| PostgreSQL 内置函数及语义 | 涉及 `pg_has_role`、`current_user`、`current_setting`、`length`、`string_to_array`、`array_length`、`now()`、`format`，以及 NULL 安全比较；未发现函数体调用额外的业务函数、Auth helper、动态 SQL 或网络函数 | 精确运行时兼容性尚未用这组定义演练；这不是完整 `pg_depend` 递归闭包采集 |
| R、`supabase_storage_admin`、角色图 | INSERT 使用对 R 的成员检查；UPDATE 使用精确有效角色检查。历史快照列出 `service_role` 为 BYPASSRLS，anon/authenticated 非 BYPASSRLS；这是不同机制 | 当前 `pg_auth_members` 成员图、继承/SET ROLE 能力、所有者完整属性、Storage 服务连接与角色切换均未捕获。不能用 JWT GUC 或改名的夹具 owner 替代 |
| `storage.allow_delete_query` | 是删除语句的额外开关，不是鉴权证明；本函数不读取请求 JWT，也不授予对象权限 | 谁在真实 Storage 请求中设置它、作用域、连接池复用时的重置、参数权限与服务版本均未捕获。未证明实际 HTTP 服务如何满足这个开关 |
| `storage.buckettype` | [用户 B 结果](../2026-10-23-supabase-feedback/user-query-results.json)已经给出顺序 STANDARD、ANALYTICS、VECTOR；不需再让用户重跑。该结果执行时刻/项目 ref 未包含在表中 | 完整 enum 是用户回传证据，不是本次定义采集顺带读取；尚未加入新的完整组合演练 |
| 生命周期列与 CHECK | 历史快照：配置是 jsonb，generation 是 uuid；要求同时空/非空、仅 STANDARD 可带配置，非空配置须为带 1–1000 项 `rules` 数组的对象 | 这些 CHECK 不校验每一条规则的业务有效性；服务层验证与生命周期执行器未捕获。仅改 `type` 不触发生命周期 UPDATE OF，但 CHECK 仍独立执行 |
| 版本字段与 CHECK | 历史快照包含允许状态集合与更强的 `buckets_versioning_dark_check`，后者只允许 DISABLED；用户 A 也报告两桶 DISABLED | 有 enum、版本字段或生命周期字段不等于支持恢复。没有版本副本、备份或恢复成功证据 |
| Storage 表、约束与对象字节 | objects→buckets 外键决定元数据父子顺序；历史快照还显示 multipart uploads/parts 对 buckets 的外键 | `s3_multipart_uploads`、`s3_multipart_uploads_parts` 不在本次七触发器目标及旧组合夹具范围；其运行时、触发器、队列和对象后端关系未捕获，不能宣称仅 buckets/objects 即完整恢复 |
| 授权、读取与真实服务 | 六函数均未实现家庭/项目成员、用途同意、墓碑或对象字节读取授权 | JWT/PostgREST/Storage HTTP、缓存、旧 URL、对象清单/校验值、真实家庭拒绝反例均未验收；已知两桶 Public 的事实不因本次函数匹配而改变 |

## 与旧 PG17 组合实验的差异

[旧 fixture](../../../../experiments/pg17-rls-source-composition/fixture.mjs) SHA-256 为 `636f51fbb2fbf5cb3345f981354965f01170262c2213c618c48299740fe73508`；[兼容适配文件](../../../../experiments/pg17-rls-source-composition/compatibility.mjs)为 `090f25f614deb00ec67ed517d9271fd4190a8ebe22084a2cb7a702c3c0d0ab43`。本次只阅读，两者没有修改或执行。

| 旧夹具处理 | 精确定义带来的差异 | 下一轮要求 |
| --- | --- | --- |
| 明确省略全部七个 Storage 触发器，并断言数量为零 | 原 DELETE 拒绝结果没有这个语句级 GUC 屏障；增加真实触发器后，`42501` 可能先来自删除保护，即使没有目标行，也不能证明 RLS 正确 | 分开测试 GUC 保护与行权限；只有受信本地测试阶段满足 GUC 开关后，才能继续归因 RLS，不可用同一拒绝结果混充两层验收 |
| 无 bucket 插入/更新控制及名称触发器 | 缺少角色成员与精确角色的差异、100 字符限制、成对变化和 AFTER 异常回滚语义 | 覆盖名称 100/101 字符、普通插入、非空配置插入、无变化/只改一个值/同时变化/同时清空、多角色及错误码来源 |
| 无对象更新时间触发器 | 旧对象 UPDATE / upsert 观察不会体现真实 `updated_at` 改写 | 记录对象时间变化；不得把整体行哈希变化当作对象字节改变，也不得静默从所有验证哈希删除该列 |
| `foldername` 是 SQL shim，额外固定空搜索路径 | 目录拆分及截尾算法与捕获函数相同；语言与 `search_path` 属性不相同，之前不是精确函数重放 | 原 SQL shim 结果可作对照，不能据此标注逐字/属性匹配；补边界输入 |
| enum 仅 STANDARD | 无法覆盖 ANALYTICS / VECTOR 及控制字段对不同类型的限制 | 使用已经收到的完整 enum 顺序；显式保留其来源边界 |
| owner 为 fixture_owner；Auth/JWT GUC 为 shim；未重建生产角色图 | 名字/claim 相似不证明有效角色身份或成员检查一致 | 独立表示角色属性、成员关系与有效角色；缺项注明 shim，不宣称生产鉴权等价 |
| 已复现列序、生成列、nullable 字段及部分唯一索引 | 这些证据仍有价值，但不是新增触发器语义的替代；旧 ON CONFLICT 修正仅匹配实际部分索引 | 保留原冻结证据和兼容差异，新增演练另存，不覆盖旧结果或把旧 PASS 升格 |

## HTTP 删除、旧 `.remove()` 与正式 adapter

本地安装的 `@supabase/storage-js` 2.105.3 的 `StorageFileApi.remove` 静态实现向 Storage 对象端点发送 HTTP DELETE，请求体带路径列表；它不是客户端直接执行 `DELETE FROM storage.objects`。已读取的 SDK 文件指纹为 `a8b2d71e4bef45169d0256b1afae24514c8857ab42fa06e9e86e6ac1c5c1c922`（StorageFileApi.ts）与 `30bc085d778e423f5c7e4e49d279ee02c0ba9ec526038a6ffff3ea24b31c9b13`（common/fetch.ts）；只证明本地客户端调用形式，没有发出请求。

直接 SQL DELETE 在正常触发器环境下先受 GUC 保护，随后还受权限、RLS 与外键等规则约束。满足开关也只允许数据库继续执行；六函数没有删除远端对象字节。把开关设为允许再直接删元数据不能成为正式物理删除 adapter，会缺失对象端的删除和结果核实。

反过来，不能因为该 SQL 触发器存在，就断言旧 SDK `.remove()` 已被线上阻断。真实服务可能有设置开关与切换角色的内部路径，本次没有采集该实现。旧本地 RLS 候选关闭 managed buckets 的 authenticated UPDATE/DELETE，也不能证明使用高权限服务身份的 SDK 请求满足项目、用途和墓碑检查。旧删除入口关闭是必要的独立应用防线；本报告不代替实现代理的回归验收。

正式 adapter 应消费数据库事务中已经授权、冻结并持久登记的精确 bucket/key/版本目标。先提交墓碑和禁止新访问/处理，再由持久 Worker 调用 Storage API；每件目标分别记录确认删除、确认缺失、失败或未知。网络超时不得标成成功，未知结果先查询再决定重试，重试不得误删同 key 的新对象。原件、缩略图、其他派生件和引用都必须在目标清单中；只用 basename 或上传者前缀不足以授权。

下一轮演练至少需要：GUC 缺失/非精确真值/允许值与零行删除、普通角色/成员/精确 R 的区别、角色切换后行为、两个生命周期字段的全部分支、非 STANDARD 类型、触发器有无列名匹配、对象 UPDATE/upsert 的时间改写，以及独立的 HTTP 成功/失败/未知结果矩阵。它们是待实施验证项，本次没有执行。

## 备份与恢复顺序

定义捕获不含业务数据和媒体字节，不能当作备份。已知 Free Backups 未开启、音视频无独立副本、没有隔离 Supabase 项目；这些输入不需重问，仍需落实受控副本位置和恢复目标。

1. 取得可说明的一致性切点，保存数据库、对象字节、精确引用/校验清单及独立墓碑记录。当前版本 DISABLED，不能依赖版本字段恢复被删字节。
2. 在隔离目标先核对数据库/Storage 服务版本、角色及成员关系、schema、完整 enum 和所需内置能力，再处理依赖这些对象的表、函数、索引、约束与触发器。必须区分“复原定义”与“复原数据”；不可盲目重放捕获函数或借禁用约束掩盖差异。
3. 元数据父子加载至少先 buckets 后 objects；完整恢复还需纳入历史快照已见的 multipart 依赖。若数据在触发器启用后导入，非空生命周期 INSERT 会有成员检查，后续生命周期 UPDATE 会有精确 R 检查，已有对象 UPDATE 会改时间；恢复计划必须事先决定并验证这些路径，不能把 owner 身份当作自动豁免。
4. 对照冻结清单恢复并逐件核验媒体字节、对象版本/引用与缺件/多件。数据库 dump 或 metadata INSERT 成功不证明音视频已恢复；SQL DELETE 也不证明对象端已清理。
5. 在开放访问、签名及后台处理前，先应用冻结点之后的撤权、用途撤回和删除墓碑，再核对当前权限及对象目标。墓碑应用后仍需通过 Storage API 完成或重新确认物理删除，保留失败/未知状态。
6. 只有隔离环境的可读性、导出完整性、跨家庭拒绝、旧 URL/公开路径边界、删除重试及恢复后拒绝全部有证据，才可形成可执行回退方案。回退保持拒绝与数据，不以重开旧删除入口解决兼容问题。

本次发现的角色图、GUC 服务设置、真实 Storage 服务/对象后端及 multipart 运行时依赖均明确留为未捕获项，没有扩大远端读取范围。完整定义匹配是事实；HTTP、生产授权、私密性和恢复成功仍是待证事项。

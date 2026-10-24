# T02 来源账本与原子绑定本地演练

> 执行既有升级计划与 handoff 的下一批。使用 subagent-driven-development 做实现与独立审查；保留当前未提交分支，不提交或推送，除非原 G0/G1 等里程碑实际达成。

**目标：** 用真实本地 PostgreSQL 和虚构资料验证来源版本摘要、重复观察幂等、变更保留历史，以及来源与已核实资产之间的项目绑定事务。

**依据：** [P1 契约](../specs/2026-10-13-upgrade-p1-contracts.md)第 3/5/7 节、[来源投影及回填草案](../../research/2026-10-17-t02-legacy-mapping.md)、[handoff](../../HANDOFF-2026-10-13-upgrade.md)。本批不改变生产表/API。

## Global Constraints

- 只读已保存元数据；仅向新建本地临时数据库写入虚构数据，不连接远端、不读家庭正文或对象，不新增根 migrations，不部署。
- 保留当前 dirty 工作树、依赖、现有映射/RLS/T05实现。实验复用已有 pg/TypeScript/PostgreSQL，无新增依赖。
- 来源身份包含 project、source_table、source_row_id、source_field、source_path；版本摘要涵盖整个来源字段与实际 PostgreSQL 类型，数组顺序和异常位置有意义。算法须有版本标签，不能把 JS 对象键顺序、basename 或 locator 当来源版本。
- 观察与绑定分开。相同来源/版本重复执行只返回原观察；不同版本追加观察且明确冲突，不覆盖原始值、旧核查结论或旧绑定。mapped 只表示定位候选，不建立 ready 状态。
- 绑定只能消费显式核实的 fixture 资产，精确匹配 project、story 范围、kind、bucket/key、资产版本、大小/hash及对象版本。资产核查为合成测试前置，不声称真实 Storage 验证。
- 绑定事务在提交前重读来源完整字段/项目、当前成员或 facilitator、来源/项目/资产墓碑及资产版本；相关锁须阻止并发来源修改、撤权、删除或重绑定绕过检查。跨项目和旧上传者均无隐式授权。
- 同来源观察的不同资产绑定不得覆盖；并发相同请求至多一个绑定。失败事务不留下半条绑定；COMMIT 结果未知不得推定失败或删除，重新读取持久身份核对。
- 新表/函数/adapter 只放 experiments/t02-source-ledger；禁止普通角色直接读写实验账本，受信实验 adapter 不是生产安全边界。PG14 结果不替代 PG17、完整生产RLS/触发器、Storage HTTP、备份回退或 G1 真机验收。

## Task 1 — 独立审查欠账

- [x] 复核前批 T02 pg.Client 宿主环境隔离修复及最终源码证据；单独保存结果。
- [x] 审查前批元数据采集器及实际快照对账；发现问题先修复/定向验证/增量复核。
- [x] 审查后补充 public/storage 函数签名、安全属性、EXECUTE权限、触发器结构与默认ACL的只读采集；只存函数/触发器定义摘要，不输出函数正文、触发器参数或任意配置值。新证据独立记录；缺定义正文不称完整语义等价。

## Task 2 — 实现并演练来源账本

Files: `experiments/t02-source-ledger/schema.sql`、`ledger.cjs`、`verify.cjs`、`README.md`。必要时将验证场景拆到 `scenarios.cjs`，避免巨大 runner。证据目录 `docs/research/evidence/2026-10-17-t02-source-ledger/`。

- [x] 先写关键行为失败场景并保存 RED；测试使用真实 PG，不以 mock 冒充事务。
- [x] 缩减 fixture 使用实际 images jsonb[]/photo_urls text[]、必填身份和两家庭成员；复用真实投影器，无扫描正文。
- [x] 使用完整字段的确定性、带类型摘要保存逐来源观察，来源身份/版本数据库唯一约束；保留异常/歧义项目。只允许明确字段白名单动态 SQL。
- [x] 追加式绑定与项目/来源/权限/墓碑/资产版本检查，定义统一锁顺序；记录依赖 adapter 的边界。
- [x] 验证相同来源重复/并发幂等、同字段其他数组位置变化、类型差异、不同版本旧结论保持、歧义不绑定、跨项目/角色撤回/墓碑/源变更/资产变更拒绝、并发同/异资产绑定、事务失败和未知 COMMIT 核对；正例必须真实提交。
- [x] 核对原 stories 媒体值未被采集/绑定改写；停止写入不删除观察/资产；完成正常和稳定 fixture SIGTERM 清理。
- [x] 保存运行时/源码/快照指纹、场景断言、各连接与临时集群/目录清理结果。

## Task 3 — 验证与交接

- [x] 提交本批完整文件包供独立规格/质量审查，修复后做增量复核。
- [x] `npm run verify`、shared、infra；恢复 next-env 原字节。未改依赖时沿用失败 audit 证据，明确非本轮重跑。
- [x] 保存项目验证/里程碑核对，更新本批记录、主计划、P1 契约、docs 索引及 handoff。只列本轮改动，旧证据保持。
- [x] 原里程碑未完成则明确未推送；本地演练不另创推送里程碑。

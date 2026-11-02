# G1-01 持久封口清单与上传命名

日期：2026-11-02（Asia/Taipei）。基线 `1ca1e06dd`，分支 `codex/october-upgrade-p0`。沿用负责人“继续推进”的授权，继续 G1-01，不重复前五批恢复及可靠登记修复。

## 本批范围

1. 新增本地候选迁移 `20261102000001_recording_seal_manifest.sql`。在既有 `recording_sessions` / `recording_chunks` 上增加可为空的封口输入字段，由 service-role-only RPC 原子创建会话及完整块清单；相同输入可重放，变化输入、旧记录、损坏记录或状态不一致拒绝，不覆盖或自动认领。
2. RPC 固定项目、本人 active storyteller、可选本人故事、会话及资产身份，检查删除墓碑；限定块顺序、唯一块 ID、MIME、路径、2000 块和 100 MiB 总声明字节。直接写账本的权限收紧到专用 RPC；后续 Worker 变更状态和删除须另建受控入口。
3. `recording-chunk-location.ts` 统一逻辑路径 `projects/<project>/sessions/<session>/<index>` 与实际 Storage 路径 `<user>/<逻辑路径>`。新客户端上传不再使用 `temp/<session>/<index>.<扩展名>`，保留 StorageService 的用户前缀和非覆盖上传；既有 merge verifier 的逻辑路径语义不改。
4. seal HTTP 入口先取得并严格验证持久清单回执，才运行上一批的资产/任务登记。RPC 缺失、失败、超时、取消、冲突或回执不一致时不发布资产/任务；不自动重试未知写入，回执后复查权限和墓碑。保留精确开关、no-store/cookie 和所有封口回执禁止清理的契约。

**“可信”在本批仅指服务器核准的身份、规范输入与不可覆盖的持久绑定，不指客户端声明的内容已经验证。** 本批没有回读对象、校验真实字节或执行解码，没有运行 Worker，更没有最终云端确认。

## 验证记录

计划：[本批实施清单](../superpowers/plans/2026-11-02-upgrade-g1-durable-manifest.md)。证据：[本批目录](evidence/2026-11-02-g1-durable-manifest/README.md)。各次执行独立留存原始/压缩日志、退出码及源码哈希，失败记录不覆盖。

- `web-red`：原生产代码上出现 8 项实际行为失败（新路径 3 项、持久登记 gate 5 项），54 项通过；另外两个新模块尚不存在，其套件导入失败单列，不冒充已执行行为测试。
- `web-green-1`：160 项通过、1 项失败。失败是旧 SmartRecorder 测试仍断言 `0.m4a`；按新命名契约改为无扩展名且增加项目/会话/用户匹配，保留实际 MP4 MIME 断言，不删除或弱化安全断言。
- `web-green-2`：8 套 / 161 项通过。随后 type-check 揭示项目旧 lib 不支持 `Object.hasOwn`；`type-red` 独立保留失败，改用已有兼容写法，不变更 TypeScript 配置。
- `web-green-3`：增加 RPC 后撤权、删除及无效回执反例，8 套 / 164 项通过。
- `web-green-4`：type-check 与最终定向 8 套 / 165 项通过；本次续接核实源码哈希一致。
- 隔离 PG17.4：迁移前真实缺失 RPC `42883` / exit 1；首轮 623 断言通过后，增加会话一致性反例得到 593 断言处失败，修复后普通/污染环境各 15 场景 / 645 断言通过。失败及各轮 runner/migration 快照全部保留。续接再次运行 `pg-resume-normal` / `pg-resume-polluted`，各 15/645、exit 0，验证临时集群、socket、目录、PID 与客户端清理。
- 原 `full-chain.json` 为空且进程已不存在，日志虽有构建输出但缺完整链退出回执，保留为中断记录，不计 PASS。`resume-check.json` 记录原日志哈希、压缩存档及 21 项源码匹配；仅还原已逐字核对的生成式 `next-env` import。
- `full-chain-resume`：重新执行完整链，exit 0 / 296.536 秒；Web **142 套 / 2295 项**、shared **4 套 / 16 项**、infra **14 项**、**184 页构建**通过。type-check/lint 通过，`next-env` 再次核对后恢复原字节。audit 未重跑，既有 Next 配置及可选 provider/监控警告保留。
- 独立规格 **PASS** 后，另派独立质量审查 **Approved**，无待修发现。两位独立检查实现、调用方兼容性、21 项源码指纹和原始/gzip/PG 快照及清理证据，未重跑测试或构建；完整链与续接 PG 由主 Agent 实际执行，不能写成三方重复运行。
- 1471 项历史输入、前五批 140 个证据文件、原中断与失败记录均未改写；本批最终来源/日志/文档/限定暂存载荷见[验证汇总](evidence/2026-11-02-g1-durable-manifest/verification.json)及[最终完整性回执](evidence/2026-11-02-g1-durable-manifest/final-integrity.json)。本地输入层切片完成，提交身份与工作树状态以 Git 为准，不宣称 G1-01 整链完成。

## 原子性与兼容边界

- **只有会话与块清单创建是同一数据库事务。** 清单成功后资产/任务登记仍可能失败；再次显式请求复用相同清单，继续上一批可恢复登记。没有将 Storage PUT、清单、资产、任务合成一个原子事务。
- 数据库许可检查与行锁只稳定本次 RPC 涉及的已有权限行，不是对所有删除/撤权路径的跨流程原子保证。Worker 领取、读取、发布必须另行授权并复查墓碑。
- 新清单保存完整逻辑/物理路径及声明的 hash/字节数，`recording_chunks.object_key` 是真实物理路径；Worker 必须读取固定清单，逐块核验，再执行全流解码及发布，不能仅凭清单存在或 `uploaded` 标记宣布 ready。
- 不搬移、不删除旧 temp 对象，不重写本地旧 uploaded 标记，不认领旧空清单会话或随机资产。旧草稿对账/迁移及缺件恢复另行设计；本地原件保持可恢复。
- 新 RPC 在未获授权部署迁移的环境中不存在时，seal 返回失败而非回落到无账本登记。没有调用远端、读取真实家庭资料或产生付费调用。

## 剩余 Gap 与人工操作

- G1-01 仍 partial：接实际 Worker 读取固定清单、可信存储回读、字节/hash/解码、持久领取及原子发布；再接录音页 seal/status、幂等故事保存、持久确认与确认后清理。
- 本批及上述本地开发无需负责人手动执行数据库命令；远端环境、迁移/部署及破坏性测试仍需单独授权。
- G1-02–09 仍按[前批 9 项 gap 清单](2026-11-02-g1-gap-register.md)追踪。真机阶段需要负责人或指定测试者提供设备版本、执行锁屏/来电/抢占等场景、核听标记并在第二台设备离线打开档案；自动化、解码/hash 和汇总由 Agent 负责。只用虚构测试口述。

`g1Item01Complete: false`、`g1MilestoneSatisfied: false`、`pushConditionSatisfied: false`。只创建新本地检查点；不推送、不合并 main、不远端迁移/repair、不部署、不付费调用、不外发家庭素材。

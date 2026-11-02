# G1-01 封口稳定身份与可恢复登记

日期：2026-11-02（Asia/Taipei）。基线 `665484289e4dc15896073572fd730923f701c7b1`，分支 `codex/october-upgrade-p0`。负责人批准推进 [G1 gap 第 1 项](2026-11-02-g1-gap-register.md)。本批先修复已有 HTTP 封口入口的前置缺陷，**不是完成整个录音到云端确认闭环**。

## 真实断点与改动

1. 原服务先随机生成 asset ID，再把这个 ID 纳入幂等键；同一 HTTP 请求每次重试都会变成新操作。现默认 ID 由带版本命名空间的 SHA-256 actor/project/session 元组派生为 UUIDv8。清单不参与资产 ID，改变内容/MIME/故事关联会与已有登记冲突；旧纯函数调用者显式提供的 ID 保持兼容。
2. 原路由先写资产再写任务，任务写入失败后没有完整恢复。新 `recording-seal-registration.ts` 按稳定资产 ID 查询、逐字段匹配输入，使用 insert 与唯一冲突后的重新查询；verifying 资产缺任务时可在明确重试中补任务。模拟写入前失败和已提交但响应失败均可重试，不覆盖、不删除已有资产或任务。
3. 原接口把 `asset.state === ready` 单字段当作清理许可。现要求资产/任务身份、输入版本、任务类型/处理器、创建者和状态一致；ready 还需 succeeded/result_ref 与已验证音频元数据。**所有封口登记回执均为 `canClearLocalDrafts: false`**；真正的持久会话确认及清理许可留给后续确认流程。
4. 路由不再硬编码请求者为活跃 storyteller；读取实际角色，要求 active storyteller，并验证可选故事属于当前项目和本人。项目/角色/故事/会话删除状态在登记前、任务写入前和响应前检查，复用既有媒体资产 guard，不改其语义。错误查询不是“没有记录”，异常不泄漏数据库细节；no-store 与刷新 cookie 保留。

## 验证与证据

证据：[本批目录](evidence/2026-11-02-g1-seal-registration/README.md)。计划：[实施清单](../superpowers/plans/2026-11-02-upgrade-g1-seal-registration.md)。

| 执行 | 结果 | 说明 |
|---|---|---|
| `seal-red` | exit 1 | 最初新测试缺一个函数闭合括号；路由套件未执行，不作为其行为 RED。原日志保留 |
| `seal-red-behavior` | exit 1；2 套 / 57 项，44 fail、13 pass | 修正测试语法后，以原生产源码复现幂等、半写、角色/归属、查询错误和不安全回执问题 |
| `seal-green` | exit 0；4 套 / 97 项 | 同一行为 RED 测试源码，含路由/封口服务/merge/merge-executor 回归 |
| `full-chain` | exit 0；Web 139 套 / 2251 项、shared 4 套 / 16 项、infra 14 项、184 页构建 | 实际运行完整 verify/shared/infra 链，含 type-check/lint；耗时 354.978 秒 |

原路由两项场景仍覆盖：重复封口和删除拒绝。测试不再无视查询过滤条件；“裸 ready 即允许清理”的旧断言按更严格的契约替换，未降低安全断言。状态化 fake 模拟已存在的主键/幂等唯一约束，支持并发请求和提交结果不确定的注入；它**不是实际 PostgreSQL、Storage 或 Worker 集成证据**。

构建只产生已知 next-env root-params import，逐字节核对后恢复预存原件，SHA-256 `7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651`。保留旧 Next eslint/images 及 Google/Stripe/analytics/Sentry 可选配置警告，audit 未重跑。

独立规格审查 **PASS** 后，独立质量审查 **Approved**，无待修发现。两位审查员分别独立复跑 4 套 / 97 项通过；质量审查员另核对四次执行的原始日志与源码哈希，未独立重跑完整链。详见 [规格回执](evidence/2026-11-02-g1-seal-registration/spec-review.md)和[质量回执](evidence/2026-11-02-g1-seal-registration/quality-review.md)。

1471 项历史输入及前四批 G1 的 115 个证据文件已逐项核对，0 不匹配。来源、原始/压缩日志、验证与里程碑边界分别封存；最终文档哈希与限定暂存载荷由 `document-hashes.json` / `final-integrity.json` 绑定。只创建本批本地检查点，提交身份及提交后的工作树状态以 Git 实测为准，不把基线 HEAD 写成新提交。

## 边界与后续顺序

- 这是**可恢复的两次写入，不是原子事务**。资产可暂时停留 verifying；失败或撤权后的部分记录保留，不用删除“回滚”，也不假称已完成封口。重新授权检查不是跨查询原子撤权，实际 Worker 必须在领取/写回时重新授权。
- 客户端提交的块清单仍是待验证声明。当前本地上传路径 `temp/<session>` 与服务端 `projects/<project>/sessions/<session>/<index>` 不一致；本批未更改这两种命名、未启用前端 seal 调用，也未从客户端 hash 推断真实对象已存储。
- 没有新增 `recording_sessions`/`recording_chunks` 的可信持久清单和唯一会话事务，没有运行 Worker 宿主或原子 ready/succeeded 写回，没有客户端确认/清理接线。因此 G1-01 状态仅为 **partial / 登记边界子切片**，其余 gap 不因此关闭。
- 旧随机 ID 产生的登记不被自动认领、改写或删除；是否存在及如何对账属于后续可信会话账本接入。纯函数显式 ID 路径保留，不宣称把所有历史登记都变成稳定 ID。
- 下一批优先统一可信会话/块清单与上传命名并持久化不可变封口输入，然后连接实际 Worker 领取/核验/发布/确认，最后切换录音页和恢复 UI。必须覆盖重复保存、失败/取消/删除、结果未知和确认后清理；不得跳过可信输入层直接让 Worker 消费本批候选。

## 人工操作边界

- **本批和下一步本地开发：不需要负责人手工操作。** Agent 继续可信账本、命名契约与集成测试；原 G1-01 只推进了登记子切片，G1-02–09 未关闭。
- **云端阶段需负责人提供/授权：**专用测试环境、虚构家庭 A/B 账号及角色、必要远端迁移/部署/删除测试范围（§A #1/#2）。脚本与获授权后的配置执行可由 Agent 完成，不要求负责人亲手操作数据库。
- **真机阶段需负责人或指定测试者亲手完成：**提供设备/版本/排期，执行长录音、锁屏/来电/抢占等案例、核听标记与缺失范围，并在第二台设备断网打开导出包。Agent 负责自动化、日志、hash、解码和汇总；仅使用虚构口述，不外发家庭素材。完整分工沿用[9 项 gap 清单](2026-11-02-g1-gap-register.md)。

无依赖、SQL 或既有 verifier 语义变更；无新增 PG 实验，真实数据库并发资格另验。audit 未重跑。不推送、不 main 合并、不远端迁移/repair、不部署、不付费调用、不外发家庭资料。`g1MilestoneSatisfied: false`、`g1Item01Complete: false`、`pushConditionSatisfied: false`。

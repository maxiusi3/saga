# 邀请 token 与持久席位事务：本地实现与验证

2026-10-18（Asia/Taipei）。本地候选实现和原始最终验证已完成，Task 1 独立规格审查 PASS、质量 Approved，无 Critical/Important/Minor 发现。Task 2 文档与完整性收尾独立审查 PASS/Approved；整批最终独立审查已PASS；本批本地实现、验证与独立审查已完成。当前状态以[验证汇总](evidence/2026-10-18-invitation-transactions/verification.json)、[任务审查](evidence/2026-10-18-invitation-transactions/task-1-review.md)和[实施计划](../superpowers/plans/2026-10-18-upgrade-invitation-transactions.md)为准。

## 实现及适用范围

依据[绑定规格](../superpowers/specs/2026-10-18-invitation-transactions.md)和[邀请兼容核查](2026-10-18-invitation-compatibility.md)，新增隔离实验 [`experiments/pg17-invitation-transactions`](../../experiments/pg17-invitation-transactions/README.md)。复用已审 PG17.4 Harness、固定结构、12 个原 RPC 与更新时间触发函数，补齐实际 invitations 的 12 列、6 约束、9 索引及更新触发器。新候选放在独立 schema/marker 下，空 search_path、私有 owner、精确 authenticated EXECUTE；候选表对普通调用者禁直读写。

| 操作 | 已实现的持久事实和事务边界 |
| --- | --- |
| send | SQL 生成规范 token，固化原始请求与规范化 payload；相同请求/完整相同目标仅复用同一邀请与预留。钱包和合成权益来源各预留一席，日志及邀请同事务；不消费项目券 |
| accept | 锁后确认身份、邮箱、项目、原邀请者、期限、来源与保护绑定；原子写成员映射、accepted/consumed 和零额激活日志，不再次扣席。重复接受核验现存成员，不恢复已删除或撤权成员 |
| release | 当前 facilitator 可取消或处理到期，也可在项目 inactive 或转移后收尾；向原付款人/来源返还一次，撤销来源仍保持 revoked，同原因重试不再返还 |
| status / lookup | 按收件人或原发送人的当前资格读取持久状态，不改资源或日志；真实提交后丢弃 send/accept 返回，再分别经 lookup/status 恢复同一邀请 |
| 协议解包 | 规范 token 与恰一行 TABLE 结果校验，区分 confirmed/rejected/unknown；未知网络结果不以预读制造成功，不触发重建或再次扣席 |

统一锁顺序为 project → auth → invitation → wallet → source/binding → member。auth 行使用 `FOR NO KEY UPDATE`，保留身份变更/删除互斥并避免后续外键 key-share 锁反转；数据库时钟在持锁后读取。拒绝和故障比较完整相关表快照，CHECK 注入及 caller 回滚验证原子性。两个已审导出重载与合法接受组合可登记；非法接受及撤权后拒绝登记，原 public RPC 定义保持。

合成 GUC 身份和受限 `auth.users` 确认邮箱 fixture 不等于真实 JWT 验证。`trusted_seat_sources` 是仅受信 fixture 管理者供给/撤销的合成可信权益端口；普通调用者不能创建来源，钱包余额、自由 JSON、现存付款引用均不作为已验证付款证明。正式身份和支付账本 adapter 尚未接入。

## 证据及时间归属

下表均为中断前 Task 1 的最终实际执行；续接和 Task 2 只重新核对证据及输入字节，没有重跑不变的行为矩阵。精确路径、SHA-256 及原始时间见[实现清单](evidence/2026-10-18-invitation-transactions/implementation-verification.json)、[续接完整性](evidence/2026-10-18-invitation-transactions/resume-integrity.json)和[证据索引](evidence/2026-10-18-invitation-transactions/README.md)。表中以 Asia/Taipei 显示原始执行时间，日期均为 2026-10-18；JSON 证据保留原始 UTC 时间戳。

| 实际执行 | 开始—结束时间（Asia/Taipei） | 结果 |
| --- | --- | --- |
| 正常 PG17 | 15:15:37.554—15:15:56.491 | 158 场景、2,288 Harness 断言、33 实际并发场景、282 完整状态核对；PASS |
| 严格协议 | 15:20:58.565823—15:20:59.083808 | Node 18/18；退出 0、stderr 空 |
| 污染 PG 环境子进程 | 15:23:12.147—15:23:31.357 | 同样 158 / 2,288 / 33 / 282；PASS |
| 生命周期观察器 | 15:23:11.945—15:23:37.336 | 4 类通过；污染环境、fixture 就绪后 SIGTERM、真实启动失败、真实连接失败 |

生命周期子进程退出分别为 0/143/1/1；后三类是预期中断/失败，不能写成子进程业务测试成功。观察器实际确认集群停止、临时目录移除、连接归零、无存活 postmaster，无需 rescue。

最终清单的 24 个直接源码/支持输入、44 个 CommonJS/package 文件、743 个 PG 文件、Node 可执行文件、input pins 及全部 27 份原实现证据已逐项匹配当前 SHA-256。27 份证据及原始实现清单保持原样；清单内“independent review pending”是生成时历史状态，后续 Task 1 审查由独立文件引用，不回写旧清单。macOS 内核和系统共享库仍属环境依赖。

RED 与中间结果分别保留：旧 token 接受签名实际 `42883` 且当时九表零写入，表示缺功能；缺协议模块的 TAP 表示接口未实现。自审发现真实 auth/FK 死锁 `40P01`、失败方零写入，修复后最终三连接回归要求接受与独立有余额的跨项目发送均成功。较早语法/观察顺序/历史断言失败以及修复前成功记录均不是最终结果，分类见[自审](evidence/2026-10-18-invitation-transactions/implementation-self-review.md)。

## 项目验证复用与工作树保全

[本批 project-checks](evidence/2026-10-18-invitation-transactions/project-checks.json)引用的是[前批 RPC 权限项目检查](evidence/2026-10-18-rpc-access-guards/project-checks.json)的实际执行：2026-10-18 **12:24:38.969365—12:26:48.304226 Asia/Taipei**。`npm run verify`、shared、infra 均退出 0：Web 77 套/766 项，shared 4 套/16 项，infra 7 项，类型/lint 与 175 页构建通过。

本批复核 707 个应用输入和 3 份日志字节，均与该次执行相同，`next-env.d.ts` 与本批起点原字节相同。输入和日志相同仅证明该证据可复用，不构成新执行或生产配置验收。缺服务端 Supabase 配置及既有 Next 配置提示仍在。依赖未变，audit 未重跑；此前实际失败仍为 42 项：34 high / 8 moderate / 0 critical，未降低阈值。

[完整性检查](evidence/2026-10-18-invitation-transactions/final-checks.json)对照本批起点 1,551 个文件，允许变更的既有文件仅 handoff、综合计划、docs 索引和 P0/P1；本批实验、文档及证据为新增。它核对旧应用/实验/依赖/根迁移、源码 pins、链接、空白及 `git diff --check`，并检查 13 个私有定义未复制公开、凭据及生成 token 未进入公开证据。最终审查状态回填后由控制器再次执行该检查。历史批次证据、私有恢复目录和未提交工作保留。

## 下一步与原质量门

Task 1、Task 2及整批独立审查均已通过；当前状态、计划复选框与最终完整性记录已回填。复用已有通过且输入未变的矩阵；出现新代码或输入变化时执行受影响验证。

后续正式接入按以下证据出口推进：

1. 明确生产认证的 JWT/确认邮箱与撤销来源，以及服务端付款事件/对账、来源供给/撤销、持久去重及审计。合成来源端口继续作为隔离测试替身。
2. 逐项处理五处旧邀请调用、email/token 与 UUID 成员 ID 的签名、严格 TABLE 返回和 unknown 提交恢复；为旧 opaque token、邀请与成员设计可信版本/映射及兼容/回退，历史行继续拒绝自动收养。原 RPC、直接表和旧 UI/API 入口仍存在生产旁路风险，须纳入权限收紧或受控停用计划，不能只接新入口。
3. 对余额初始化/授予与两个付款重载补可信来源和持久去重；对导出重载核对旧选项/返回兼容、Worker 与交付再授权。支付或 queued 字段不能代替实际付款/文件交付证据。
4. 继续 7 个未登记迁移的语义对账、完整 PG17/Supabase 认证/ACL/RLS/Storage 集成、两 bucket 固定配置、对象核查、前向/回退迁移及备份恢复演练；正式资产/删除/Worker/录音会话 adapter、供应商条件和 G1 真机 5/20/30 分钟矩阵保持待办。

[原质量门判定](evidence/2026-10-18-invitation-transactions/milestone-check.json)维持 **G0=false、G1=false**，G2–G4 亦未达成。D01–D16 和原商品不变；本地候选完成不是新增里程碑。保留 `codex/october-upgrade-p0`、HEAD `1caa21a72` 与全部未提交/恢复内容；本批未提交、推送、合并、远端迁移或部署，也未调用远端认证、邮件、支付或家庭资料。

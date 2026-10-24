# Invitation sender HTTP — independent final batch review

2026-10-21（Asia/Taipei）。**PASS — 本批最终独立审查通过，无可行动的待修发现。** 本结论覆盖本批冻结实现、验证证据和交接的一致性；不等于完整发送管理、真实服务端到端、生产资格或原 P0/G0–G4 通过。

## 范围与已完成审查

按控制器限定，仅审查 `task-1-scoped.patch`、`task-2-docs.patch`、对应冻结清单、1,935 路径 pre-batch baseline 及本批证据；没有使用累计 HEAD diff 作为功能审查范围。读取绑定规格和实施计划，以 Task 1 规格 PASS、质量 Approved 为已完成的独立详细审查，整批检查重点放在跨 Task 语义、验证证明边界、证据分发与原质量门。对实现仅抽查具名的整合风险，没有重做两份 Task 1 详细审查。

正式判定前已收到并读取 Task 2 文档 **PASS / Approved** 报告，SHA-256 `39d127a4cf9fa36bade810f093b954d19d296603709fda8b531d0a932277c6e7`。报告无待修项，且明确只授权机械更新其审查状态。随后独立核对 `pre-final-closure.patch`：仅改变已获批准的文档审查状态、相应说明及“检查原质量门”checkbox；原里程碑 false、待最终审查状态和功能边界均保留。

| 绑定输入 | SHA-256 |
| --- | --- |
| `baseline.json` | `5cdeb150d83a142f83a5bcd39ecb843f848204dff57515a87a587d6c251e4109` |
| 绑定规格 | `2c055e1d1f3034811b9ba10f2bd484bfb878f3c4cbea74299342a41d8603d81d` |
| `task-1-scoped.patch` | `cede3b175c942144a415608d46a1b7e1a2ed390eec184ad4b2e104c919751761` |
| `task-1-source-sha256.json` | `b048e2fb7e96b13d5ad732ba086f1782f06bbb2bc22cf6c748cab28b4f0585f8` |
| `task-2-docs.patch` | `11979acd544ee81470bc2f74197a2818e9aa1f658247d54f141133ed49a071eb` |
| 文档审查时 `task-2-docs-sha256.json` | `70581b32b1d0f2785b0f4e4a5dc7bb446234dd039b04325e5981ec678df57ea0` |
| `pre-final-closure.patch` | `2408621325a8afe96e9eb869f7bd3c387420cdc6ac77b96537b76814a9d1851e` |
| 最终审查时 `pre-final-docs-sha256.json` | `d0db411f48c752977e1ef3b7f93212313901feaaec5ff9f366360774ad67ca89` |

独立在内存逐 hunk 应用 Task 1 和 Task 2 patch，分别重建全部 20 份源码/测试及八份文档；既有原件与 baseline、重建内容与对应冻结快照均无差异。随后从 `reviewed-docs` 的准确已审哈希应用 pre-final closure patch，再次精确重建八份当前文档；没有临时 checkout 或 Git 写操作。

## 跨边界检查

- **全局 release 与 sender lookup 各自的权限成立。** 抽查 `server/invitation-sender.ts:67–75`、`invitation-sender-client.ts:45–47` 和既存 `candidate.sql:124–132,243–284`。HTTP release 直接调用 release，不添加 lookup 前置；SQL 从 invitation 绑定取得项目并核对当前 facilitator，sender lookup 另受原发送者、项目和来源限制。撤销来源、转移或非活动项目后的合法清理不能被发送者恢复资格误拦。交接没有把 lookup 拒绝解释为原写入未提交，也没有将 accepted 收件人误认作发送者。
- **确认与 unknown 的语义贯穿 handler、helper 和页面。** 服务端只从严格解析的最终行构造成功，实际 operation fetch 发出后的不确定响应保持 unknown。客户端 release 同时匹配命令的 invitation 和页面预期 project；管理页只有 helper 返回确认结果才显示成功。未知结果无自动写重试、无后读冒充本次成功。手工提供的 source ID 仍只是引用，授权由原 SQL 决定，不能被当作客户端付款证明。
- **UI 证据没有超出实际可用能力。** 抽查管理页 `page.tsx:57–99` 与实际组件测试 `invitation-sender-ui.test.tsx:18–66`。测试通过 fixture 列表行验证真实取消调用的全局 URL、payload、Bearer 和畸形/不匹配结果拒绝；真实列表 GET 仍关闭。旧发送表单明确不可用，旧三参数 send/list 不恢复旧旁路。handoff、研究及计划正确保留受限可信来源选择、完整发送管理/历史和刷新草稿恢复为后续工作。
- **传输证明与数据库/生产证明分开。** 实际 handlers 和 Supabase SDK 对接的是合成 loopback Auth/REST；React 使用模拟 fetch。释放测试证明没有 lookup 请求，不能独立证明真实 JWT/PostgREST 权限或撤销来源后的数据库事务行为。对应 SQL 与前批 PG17 证据只核指纹，未重跑、未改写为本批 E2E。send 成功只代表持久登记确认，不代表邮件送达。

上述抽查与 Task 1 两份独立报告、Task 2 文档报告及绑定契约一致，没有发现跨 Task 漏接或成功语义扩大。

## 验证与证据完整性

检查保存的最终日志和实际测试断言，没有再次执行测试。run 18 类型检查 exit 0；run 19 为 **17 套 / 521 项**；run 20 为 20 文件范围 lint exit 0。run 01 的七项旧入口拒绝断言是真实业务 RED；scaffolding、fixture 和中间类型错误均有明确归属，没有被用作唯一业务 RED 或最终 GREEN。

控制器新项目矩阵报告 SHA-256 为 `d6eefcd4ef1468b2587dca790ea674ec888e0bb6fe51380234feee638efcd751`，执行于 2026-10-21 10:25:37—10:29:36 Asia/Taipei。三个保存命令 verify/shared/infra 均 exit 0，日志实际给出 **Web 101 套 / 1,373 项、shared 4 套 / 16 项、infra 7 项、178 页构建**。日志哈希与报告匹配。旧 Next 配置及缺服务端 key 诊断仍保留，成功构建没有被解释为生产配置合格；历史 audit 42 项明确未重跑、未解决。

日志分发修复已独立核验：20 份 Git 可见 `.log.txt` 与审查时公开 `.log` 逐字节相同，run 编号、哈希和原路径完整对应。`published-log-manifest.json` SHA-256 为 `ef0d4728b48236dc308a613b7da02fa89303ade1cae5f10cb9f84a5f765ce187`；原 run manifest SHA-256 仍为 `13018698f55522addfe84623b8815d73f2eac2a374e9f0391d85f6e6103bcd2a`。原 raw/.log、Task 1 报告及其审查哈希均未改写。公开日志扫描未发现规范邀请 token、Bearer/JWT 或邮箱模式；原含合成值输出继续仅保存在 ignored 恢复目录。

正式写入本报告前，再次执行只读完整性检查：

- baseline 1,935 路径中 13 份既有修改、55 份 Git 可见新增，全部在允许范围；无越界变更。
- 20 份 Task 1 源码/测试、八份 pre-final 文档、785 项项目验证输入全部匹配冻结值。
- 129 项直接保护输入、813 项源码/依赖/Node/PG 指纹，以及 975 项既有实验/根迁移/原始证据/package 与 lock 文件全部保持原哈希。
- 40 份 raw/原公开日志、20 份分发副本、三个项目日志全部匹配；43 个结构化证据哈希引用、444 个本地 Markdown 链接无错误。
- `next-env.d.ts` 与保存原件逐字节相同，`git diff --check` exit 0。当前分支仍为 `codex/october-upgrade-p0`，HEAD 仍为 `1caa21a72a23d6f5166ed127847ca931374b890a`。

最终审查输入快照：`verification.json` SHA-256 `54af5387d10465186cf0552b46a83eaf26fb34cd585124ad916f0f9069c85675`；`final-integrity.json` SHA-256 `cd279c4dfc4fd1bcf479fd05b6a3e854e10d9e5f19ae990daccfa3727670c755`；`milestone-check.json` SHA-256 `c453124873c819f7fc31d5dbbbbe01bf1184f923e7ae7162cbf145562f16ce48`。这些是本报告写入前的快照，后续机械闭合应保存来源关系并刷新完整性。

## 最终处置

**PASS。无待修发现。** 本批冻结的本地 HTTP 增量可以完成收尾。允许控制器仅机械更新与本次实际 PASS 对应的最终审查状态、checkbox、链接、报告 SHA 和本批完成摘要，再刷新并确认完整性通过。此许可不包含功能、源码、测试、原始日志或历史证据改写；若发生这类变化，须另做相应验证与审查，不能沿用本次 PASS。

原综合升级计划第 7/7.1 节与 P0 契约的 **P0/G0–G4 仍未通过**。生产权限与供应商条件、Storage/bucket、迁移等价/回填/回退/备份、正式 adapter、真机故障矩阵及后续家庭/经济验收仍缺。本地整批 PASS 不能绕过 G0 或满足用户的条件推送授权，不能据此提交、推送、合并、远端迁移、启用生产开关或部署。

本审查仅写入此报告；未修改源码、其他文档、依赖、原始证据或 Git 状态，未运行测试、真实服务或子代理。

# G4 试点台账操作说明

本功能用于运营逐项核对证据后的人工记账，不是自动行为遥测。真实使用前须取得研究同意、确定研究名册与证据保存政策。当前仅验证本地 PostgreSQL 17.4 和安装版 Chrome；真实 20–30 户观察、结算、供应商与生产部署尚未完成。

## 入口与运行

管理接口由 `MEDIA_ASSETS_ENABLED=true` 和服务器 `ADMIN_CRON_SECRET` 保护。普通家庭登录不能访问，不向网页或浏览器存储管理凭证。脚本只从环境变量读取凭证，禁止 HTTP 重定向；远端只允许 HTTPS。

```sh
# 凭证由服务器环境注入，不写进命令、JSON 文件或报告。
export PILOT_ADMIN_ORIGIN=http://127.0.0.1:3000
node scripts/pilot-cohort.mjs record docs/examples/g4-observation.synthetic.json
PILOT_OBSERVATION_KIND=synthetic node scripts/pilot-cohort.mjs report pilot-example /tmp/pilot-report.html
node scripts/pilot-cohort.mjs history 22222222-2222-4222-8222-222222222222 /tmp/pilot-history.json
```

样例的 `projectId` 必须换成存在的本地测试项目；ID 均是合成占位。脚本不会建立项目、招募家庭或执行支付。输出文件以 0600 权限新建，已存在时拒绝覆盖。

- `POST /api/admin/pilot-ledger`：`record` 保存观察版本，`close_cohort` 关闭招募。
- `GET /api/admin/pilot-ledger?householdId=…`：读取该家庭全部版本及证据索引。
- `GET /api/admin/pilot-analytics?cohort=…&kind=observed|synthetic&format=json|html`：单批次报告。默认 observed；不允许隐式汇总所有批次。JSON 含各价格、产品版本、国家、渠道、支持方式及素材入口分组。

数据读取在一个数据库语句快照中完成，不受普通表读取默认 1000 行上限截断。单批次超过 10000 条显式失败，不输出部分报表。管理响应一律 `no-store`；HTML 无脚本，无外部资源，不含每户身份或证据明细。

## 身份、名册与更正

`householdKey` 是跨研究任务复用的随机家庭编号，不使用邮箱、姓名或手机号。`householdId` 是此批观察行编号。同一家庭、项目在同类研究中不能重复报名；原型、AI 保留集、纵向产品试点分别存储，人数不相加冒充独立家庭。

每次写入必须提供 `requestId`、`expectedRevision`、`recordedBy`（运营编号）和 `reason`（原因代码）。首次版本为 0，写入后返回 1；重复相同请求返回原回执，相同请求ID携带不同内容返回409。修改时用新的请求ID及当前版本；并发冲突返回409，先读取历史核对，再决定新版本。身份、项目、批次和 observed/synthetic 来源一经创建不可更换。

所有更正是完整快照，保留上一版及证据引用，不以增量片段默默清空其他字段。关闭招募命令示例：

```json
{
  "action": "close_cohort",
  "requestId": "11111111-1111-4111-8111-111111111119",
  "cohortKey": "pilot-example",
  "observationKind": "synthetic",
  "recordedBy": "operator-01",
  "reason": "recruitment_complete"
}
```

关闭之后可更正已存在家庭，但不能加入新户，也不能重开。`withdrawnAt` 与 `incompleteReason` 记录退出/未完成，仍保留在原队列。对数据的实际删除不同于退出：项目删除或 G1 故事内容清除会删除整项目的试点观察、历次版本及证据引用，仅在批次保留不可反查的删除数量。删除后的项目不能重新录入试点，避免恢复被删除来源；存在样本损失的批次需要负责人复核，不能自动通过。备份恢复必须先回放删除墓碑，再恢复访问。

## 观察与证据字段

`values` 的完整机器定义位于 `packages/web/src/lib/server/pilot-ledger.ts`，未知字段会被拒绝。每个填入的里程碑、测量数值（包括显式零）、质量计数或原因都在 `evidence` 下有同名索引；入组使用 `enrollment`。只保存私有证据仓的短索引，不填写家庭正文、姓名或认证链接。

证据源分为 `system_record`、`operator_record`、`interview_self_report`、`synthetic_fixture`。observed 禁用 synthetic 证据；synthetic 必须全部使用合成证据。`reference` 的存在代表运营已核对，软件并未联网核验外部账单、访谈或真实性。当前 G3 测试订单关联项目不能录入 observed。

| 观察 | 记录与口径 |
|---|---|
| 批次标签 | `cohortType`：prototype_study / ai_eval_holdout / longitudinal_pilot；`pricingTier`：free / half_price / subsidized / paid_59；国家为两字母代码；金额全部为美元分 |
| 双入口 | `materialEntryMode`：new_recording / existing_audio。沿用字段 `firstRecordingSavedAt` 表示首次成功保存的真实素材，两种入口均适用；必须有同意及接受邀请记录 |
| 时序 | `enrolledAt`、`inviteSentAt`、`inviteAcceptedAt`、`consentedAt`、首次保存/批准可下载/完成/交付/回听。未来事件、倒序或退出后行为拒绝写入；同意可以早于入组 |
| 首次成果 | 邀请发出后7天内家人批准且可下载；全部到观察窗的入组家庭进分母。未邀请/未接受/退出/未完成不从分母剔除 |
| 完成与回听 | 28天完成，交付后14天回听。`replayedWithin14dAt` 必须为系统行为证据；`selfReportedReplayAt` 为访谈自报，单列。下载不能代替回听 |
| 工时 | `familyRevisionMinutes` 与 `familyRevisionStoryMinutes` 逐篇之和必须一致；运营为 `opsSupportMinutes`，费率 `opsHourlyRateCents` 显式填写。未知用 null，不填0；0必须有测量依据 |
| 收入/费用 | 实收、退款、支付费、全部AI/重试/存储、CAC、履约、托管准备、固定成本分摊分别录入。paid_59 实收只允许0或5900；退款单列，不用净款改变全价历史 |
| 质量 | `qualityReviewed` 与 `quality` 分别为核对状态、8项计数：reviewedClaims / incorrectClaims / invalidSourceClaims / seededErrors / detectedSeededErrors / negativeClaims / falsePositiveClaims / unresolvedSevereErrors。对应 `quality` 证据索引必须可追到实际质检记录 |
| 推荐 | `npsScore` 为0–10答卷，`wouldRecommend` 是独立布尔答复，`referralsCount` 为实际转介绍人数；缺失答复不视作反对 |

原始收入、退款、支付费、AI/存储金额在 JSON 中是**已记录金额小计**；`status=incomplete` 时即使小计为0，也不代表全批已结清。未知工时不进入分布，未知CAC/履约/托管费用为null，成本总额及贡献亦保持null，不能用于扩大决策。

## 如何读结论

至少20个唯一家庭、招募名册已关闭、全部适用7/28/14天窗口成熟、数据与成本可追账、无严重事故/事实错误和样本删除，才可形成有效的批次建议。扩大还要求至少12户实收5900分、首次成果≥80%、已启动与全部全价付费家庭完成率均≥70%、质量/劳动目标及整批贡献为正。

有批准成果的批次目前保守要求总计200植入错误、200负例及至少一条核听陈述；检出率≥95%、误报≤10%，严重事实错误不得未解决。不同研究类型不能混加。无产出的成熟队列可以记录真实的全零质量计数并报告需求/启动摩擦，不能为凑门槛编造质检样本。这些质量计数由运营核对录入，当前不自动导入 G2 评测结果。

`g4GateReady` 只用于 observed；合成数据永远为 false，满足演练条件时另设 `simulationReady=true`。所有建议均 `requiresOwnerDecision=true`，不会自动投广告、转价、停止项目或修改生产配置。小样本和合成结果不能形成市场成功结论。

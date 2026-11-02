# G1 恢复读取一致性与 Gap 清单

日期：2026-11-02（Asia/Taipei）。基线 `8d4fc6dc540a74ad260ba9689db57b410e0eb059`，分支 `codex/october-upgrade-p0`。前三批 G1 本地检查点不重做、不改写；本批仅修复恢复时并发读取的错误分类，并交付 [G1 gap 与人工操作清单](2026-11-02-g1-gap-register.md)。

## 问题与最小改动

`loadLocalRecording` 分别读取会话和块，在检查空草稿/块数量/hash 后才重读会话。合法追加或清理恰好发生在两次读取之间时，会先将混合版本错误标为 `damaged`。本批抽取原有会话比较为私有 helper，在取块后、分类前复查，并保留 hash 验证后的最终复查。

- 完整保留身份、id、可恢复状态、未确认标记、MIME、startedAt、updatedAt 与落盘水位比较；初始身份检查仍在读取块之前。
- 并发 append/首次落块/clear 返回 `changed`，要求重新选择，不把合法变化当作音频损坏；真实缺块、错序、重复块、字节数/hash 异常继续 `damaged`，稳定空草稿仍 `empty`。
- 不写库、不清理、不自动重试、不自动继续录音，不改数据库 schema、事务 helper、录音队列、UI、云端确认或授权。复查是**乐观一致性检查，不是原子快照或权限保证**；不能检测未触发的 MediaRecorder 尾部事件，也不承诺返回后草稿不再变化。

## TDD 与验证

证据目录：[本批证据](evidence/2026-11-02-g1-recovery-read-consistency/README.md)。每次执行都有独立 JSON（退出码/时间/来源 hash）、原始日志与确定性 gzip 归档，不覆盖前批证据。

| 执行 | 实际结果 | 含义 |
|---|---|---|
| `browser-red` | exit 1；3 个新行为失败，旧 28 子案例通过；Node 28 pass / 4 fail（含父容器） | 实际得到 `damaged` 而非 `changed`，不是加载/类型错误 |
| `unit-red` | exit 1；27 项中 24 pass / 3 fail | 3 类竞态复现；新增 hash 期间变化正例在原实现也通过 |
| `browser-green` | exit 0；31 子案例 / Node 32 项全部通过 | 相同测试源码，原生 Chromium IndexedDB 中排队竞争事务 |
| `focused-jest` | exit 0；4 套 / 72 项通过 | 会话、恢复、录音组件、恢复面板回归；保留 hash 后最终检查 |
| `full-chain` | exit 0；Web 139 套 / 2200 项、shared 4 套 / 16 项、infra 14 项、184 页构建 | 实际执行 `npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra`，包含 type-check/lint |

浏览器使用首次原生 session `get` 成功事件，在生产代码继续前排入原生 readwrite 事务；检查追加后字节/会话保留或清理完成，并在仍有草稿时再次显式恢复成功。这是同页原生事务的确定性竞态注入，不是实测多标签产品交互、手机、长录音、物理配额或真实云端。

完整验证链耗时 230.315 秒。next-env 仅出现已知构建新增的 root-params import，逐字节与预存副本及预期生成内容比对后恢复 SHA-256 `7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651`。保留旧 Next eslint/images 配置、Google/Stripe/analytics/Sentry 可选配置警告；构建成功不证明线上资格，audit 未重跑。

独立规格复审 **PASS**，随后另一位审查员完成质量审查 **Approved**，无待修发现。规格初审曾指出 gap 清单遗漏 §3 的 AI 真实失败矩阵，补 G1-08 后已关闭；初审 FAIL 单独保留，未要求生产代码修改。两位审查员分别独立复跑浏览器 31 子案例 / Node 32、定向 Jest 4/72 并核对日志与来源；未把核对完整链日志说成独立重跑全量。

## 封存与本地检查点

1471 历史输入、前三批 85 个本地证据文件均核对无缺失/不匹配；原始 RED/GREEN/完整链日志及 gzip 字节/hash 已核实。源码、gap 引用输入、日志与最终文档索引分别冻结；暂存白名单与索引字节验证见 `final-integrity.json`。本报告随新本地检查点保存，实际提交号、提交后干净状态由 Git 核对，不将检查点自身 hash 写入自身证据形成循环。

## G1 边界与下一步

本批证明局部恢复分类正确，**不证明 G1 整门通过**。当前仍需录音端 → 封口 → Worker → ready → 客户端确认/清理接线、目标设备真实 5/20/30 分钟故障录音、解码核听、实际权限反例与第二台设备离线导出。具体已实现入口、缺失证据和责任归属见 [gap register](2026-11-02-g1-gap-register.md)。

下一批优先审计并补齐封口/确认链的最小本地契约；负责人可同期提供设备/版本/排期。G1 用虚构口述即可开始，不要求先招募真实家庭。云端步骤继续受 §A #1/#2 约束；现有 key、历史 P0 推送不扩大授权。

`g1MilestoneSatisfied: false`、`pushConditionSatisfied: false`。本批本地切片完成，随验证/双审查/完整性证据新建本地 checkpoint；不 amend、不推送、不 main 合并、不远端迁移/repair、不部署、不付费调用、不外发家庭资料。audit 未重跑；无 SQL 改动，不重复 PG 实验。

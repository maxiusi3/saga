# 邀请事务证据索引

2026-10-18（Asia/Taipei）。本目录分开保留原始执行、后续核对和独立审查。当前 Task 1 规格 PASS、质量 Approved；Task 2 独立审查 PASS/Approved；整批最终独立审查已PASS。统一状态见 [verification.json](verification.json)，实现与下一步见[实施记录](../../2026-10-18-invitation-transactions.md)。

下列人类可读时间均为 Asia/Taipei；原 JSON 证据和文件名保留 UTC 时间戳。

## 原始最终执行（保持不变）

- [implementation-verification.json](implementation-verification.json)：Task 1 最终源码和证据清单，SHA-256 `28a007ff93595ad7746c92e25412234b9f71347c18987c94ddced88032d8b501`；24 个直接输入、44 个加载依赖/package、743 个 PG 文件、Node、pins 及 27 份实现证据。其审查待定字段是原始生成时状态。
- [最终正常运行](invitation-run-2026-10-18T07-15-37.556Z-cec5d717-766d-4c0f-a7d3-f44c3e547941.json)：2026-10-18 15:15:37.554—15:15:56.491 Asia/Taipei，158 场景、2,288 断言、33 并发场景、282 完整状态核对。
- [最终协议报告](protocol-final-2026-10-18T07-20-58.565823+00-00-349202cb-a985-4553-bd7f-f3c9033c9bd9.json)与[原始 TAP](protocol-final-2026-10-18T07-20-58.565823+00-00-349202cb-a985-4553-bd7f-f3c9033c9bd9.tap)：15:20:58.565823—15:20:59.083808 Asia/Taipei，18/18、退出 0、stderr 空。
- [最终生命周期观察](invitation-lifecycle-2026-10-18T07-23-11.943Z-cab3fff6-3760-4728-812c-7359f80a5585.json)：15:23:11.945—15:23:37.336 Asia/Taipei，4 类观察 PASS，子进程退出 0/143/1/1。它链接每个子进程报告及 SHA-256；[污染环境子报告](invitation-run-2026-10-18T07-23-12.149Z-5495bb94-d463-4849-a371-cfa906554bdb.json)为 158/2,288/33/282。所有分配与连接已清理，无需 rescue。

正常与污染报告都记录实际提交后丢弃 send/accept 返回，再通过 lookup/status 只读恢复。并发证据以 `pg_locks`/blocking PID 观察支持，完整状态核对记录拒绝或故障无额外写入；合成身份/来源不证明 JWT 或付款。

## RED、自审与中间执行

- [旧 token 签名 RED](invitation-red-2026-10-18T06-45-06.598Z-85c661e0-483d-4b8d-96df-b496a23d4acb.json)：期望成功，实际 `42883`，当时九表零写入；属于缺功能。
- [协议缺模块 RED](protocol-red-missing-module.tap)：新接口尚不存在；没有声称旧解码器存在漏洞。
- [auth/FK 死锁复现](invitation-run-2026-10-18T07-11-23.863Z-5fc1922b-5f9d-4f46-a5f8-a6a8fcedd67b.json)：实际 `40P01`、失败方零写入；最终输入已修复并重新验证。
- [implementation-self-review.md](implementation-self-review.md)：自审结果及修复范围。其余中间失败、修复前成功/生命周期和 protocol-green TAP 的精确路径/哈希列在原清单 `intermediateEvidence`；均保持原样，不作为当前最终结果。

## 续接、项目复用与审查

- [task-2-review.md](task-2-review.md)：文档与验证汇总独立规格 PASS、质量 Approved，Critical/Important/Minor 均 0。
- [batch-final-review.md](batch-final-review.md)：整批最终独立审查 PASS，Critical/Important/Minor 均 0；本地候选验收通过，生产/里程碑仍未通过。
- [resume-integrity.json](resume-integrity.json)：中断后重新核对实现的所有固定输入和 27 份证据；没有重新执行事务套件。
- [project-checks.json](project-checks.json)：保留本批起点复用记录；源为[前批项目检查](../2026-10-18-rpc-access-guards/project-checks.json)，实际执行 2026-10-18 12:24:38.969365—12:26:48.304226 Asia/Taipei。707 输入、3 日志未变；Web 77/766、shared 4/16、infra 7、175 页通过，应用矩阵本批未重跑。audit 仍 42 项失败。
- [task-1-review.md](task-1-review.md)：实际独立审查，规格 PASS、质量 Approved，Critical/Important/Minor 均 0；该报告只覆盖 Task 1。
- [milestone-check.json](milestone-check.json)：原门槛 G0/G1=false；本地候选不是新里程碑，未提交/推送/迁移/部署。
- [final-checks.json](final-checks.json)：最新文档/工作树完整性检查点；回填审查状态后重新生成。
- [verification.json](verification.json)：聚合上述原执行及后续检查，独立评审待定项明确保留。

Task 2 已取得实际独立 PASS/Approved；整批最终审查报告已实际 PASS；当前汇总引用三份独立审查报告。聚合文件只为不可变证据保存 SHA-256；可更新状态文档和 final-checks 仅引用路径，避免自身或交叉哈希循环。私有定义、凭据、业务行及生成 token 不进入此目录。

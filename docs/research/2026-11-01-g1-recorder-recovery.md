# G1 本地录音持久化故障恢复契约

日期：2026-11-01（Asia/Taipei）。接手基线 `1921766c299575735a404a4746e2484f2dd4a5d3`，分支 `codex/october-upgrade-p0`。本地子切片完成：独立规格 PASS、独立代码质量 Approved，完整验证通过。本报告随本地检查点封存；G1 真机验收未完成，不推送。

## 现场与范围

- 接手时未暂存、已暂存、未跟踪文件均为空，只有当前工作树；`git ls-remote` 实时读取确认远端分支仍为上述基线。
- 前批方案 B 的 6 个源码 SHA-256 与原封存一致；1471 项历史保护输入核验 0 缺失、0 不匹配，未重跑 P0 研究或实现。前批方案 B 目录仅有汇总，无独立原始日志/审查文本，本轮不补造这些历史材料，也不把旧测试结果算作本轮验证。
- 本轮依据主计划 §5.3、§7.1 及既有 [G1 真机模板](2026-10-15-t04-g1-device-runbook.md)，选择可独立验收的 IndexedDB 事务/恢复子切片。没有修改生产媒体授权、上传回报、切流、供应商条款、告警或方案 B 模块。
- [实施清单](../superpowers/plans/2026-11-01-upgrade-g1-recorder-recovery.md) · [证据索引](evidence/2026-11-01-g1-recorder-recovery/README.md)。

## 实际修复

`packages/web/src/lib/recorder-db.ts` 原 `updateSession` 在不同事务中执行读取和写回。另一笔落盘、补丁或清理事务可以在中间提交，导致旧快照覆盖新状态。

原生 IndexedDB 的确定性 RED 记录了：

1. 实际存在两个块，但水位从 1 回退至 0，恢复函数返回 `damaged`。
2. 并发提交的另一个会话字段被旧快照覆盖。
3. 已清除会话被迟到更新重新创建，块却已不存在。
4. 块事务被 abort 后，调用虽然失败，未被消费的 `tx.done` 仍产生浏览器未处理拒绝。
5. 写块后同步抛出模拟 `QuotaExceededError`，旧实现没有主动 abort，块可单独提交而水位未更新。

修复保持 API 和 IndexedDB v2 不变：会话读取/补丁写回共用一笔 readwrite 事务；块写入与会话更新通过私有 `commitRecorderWrite` 等待事务完成，提前观察完成 promise，异常时回滚尚未结束的事务并保留原始错误。没有扩大云端确认、删除或授权语义。

## 本地契约证据

| 验证 | 本轮实际结果 | 能证明什么 |
|---|---|---|
| 首轮 RED | 4 个行为子案例失败；加配额反例后 5 个失败 | 旧实现存在上述竞态及事务错误处理缺口 |
| 核心 GREEN | 5 个子案例通过 | 对应最小修复有效 |
| 浏览器矩阵 | 11 个子案例通过；Node 报告 12 项含父容器，0 跳过 | 真实桌面 Chromium 147.0.7727.15 IndexedDB 的事务、离线落盘、刷新和关页重开契约 |
| 既有录音/恢复 Jest | 4 套 / 68 项通过 | 会话纯函数、恢复校验、SmartRecorder 与恢复面板回归 |

新增命令：

```bash
node --test scripts/browser-tests/recorder-recovery.test.cjs
```

使用项目既有 Playwright/Chromium，不新增依赖；该命令独立于 `test:infra`，避免让现有无浏览器的 CI 隐式依赖 Chromium。浏览器未安装时明确失败，不跳过伪装通过。测试仅监听随机 loopback 端口，并阻断非本地请求；各案例独立 BrowserContext，结束关闭，不接触用户浏览器或真实数据库。

**时长口径：** 5/20/30 分钟分别建模为每 10 秒一块的 30/120/180 个合成字节块。测试覆盖离线写入、联网后实际刷新、实际关页再开、逐块 hash 校验、拼接 hash/总字节、数字序号及账号/项目拒绝。它不是相应时长的音频、没有麦克风输入、没有实际解码，也不是压力/吞吐测试。这里的账号/项目拒绝只验证本地恢复函数，不替代服务端跨家庭权限验收。

配额案例是原生事务上的错误注入，不是耗尽真实磁盘；锁屏、来电、浏览器强杀、本地数据被系统清理、真实设备资源压力、P3/P4 云端阶段均未验证。恢复 helper 仍只证明已持久化块，无法判断尚未收到的末次 MediaRecorder 事件，也不等于完整音频确认。

## 全量验证与文件保护

本轮完整命令链退出 0：`npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra`。Web 139 套 / 2196 项、shared 4 套 / 16 项、infra 14 项通过；Next.js 16.4.1 构建生成 184 页。新增浏览器契约另外执行，不包含在 Web/infra 数量中。全程来源版本见 `full-chain.json`，不是引用前批结果。

构建仍报告旧 Next `eslint` 配置无效、`images.domains` 已弃用，以及 Google Client ID / Stripe / analytics / Sentry 等可选配置缺失。保留现有配置校验与诊断逻辑；成功构建不证明生产资格。audit 未重跑，依赖与 lockfile 未改。

构建前备份 `next-env.d.ts`，初始保护脚本对新增加的 root-params import 拒绝自动恢复并保留现场；检查 Next `writeAppTypeDeclarations.js` 的生成逻辑且核对只有这一行后，恢复保存的原始字节。恢复后 SHA-256 为 `7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651`，见 `next-env-check.json`。未使用 checkout 或丢弃其他修改。

1471 项旧输入在修复前后均 0 不匹配，前批方案 B 六项源码未变。本轮不改 SQL，未运行 PG 正常/污染实验。独立规格审查 PASS 后进行了独立质量审查，结论 Approved；两位审查者均自行重跑 11 浏览器子案例与 4/68 定向 Jest 并核对源码/日志指纹，回执见 `spec-review.md`、`quality-review.md`。无待修审查项。最终哈希索引和完整性检查见 `source-hashes.json`、`log-hashes.json`、`document-hashes.json`、`final-integrity.json`。

## G1 真机缺口与下一步

| 目标组合 | 5 / 20 / 30 分钟真实录音 | 当前状态 |
|---|---|---|
| iPhone / Safari | 均未执行 | 缺实际硬件、OS/浏览器版本、麦克风与故障核听记录 |
| Android / Chrome | 均未执行 | 同上 |
| macOS / Safari | 均未执行 | 同上 |
| macOS / Chrome | 均未执行 | 桌面合成块测试不能计入 |
| Windows / 声明支持的 Chrome 或 Edge | 均未执行 | 尚须固定支持浏览器；若两者都声明，分别测试 |

继续使用旧真机模板 F00–F10、P1–P4，不缩小原门槛。首先落实 §A #6 的设备/操作人/测试素材/观察排期，用虚构口述记录真实起止/每分钟标记、最后落盘序号、恢复范围、可解码时长和文件 hash。需要云端阶段时仍受 #1 部署与 #2 远端迁移授权限制；真实方案 B 恢复、书面供应商合规另行验收。

本地测试素材可继续推进；珍贵家庭素材仍须原 G1 完整验收。`g1MilestoneSatisfied: false`，`pushConditionSatisfied: false`。此前 P0/G0 已授权推送不延伸到本批。未执行 audit（按 #9 保持依赖稳定）、GitHub 推送、main 合并、远端迁移/repair、生产部署或付费调用。

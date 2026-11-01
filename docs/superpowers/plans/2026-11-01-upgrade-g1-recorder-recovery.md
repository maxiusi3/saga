# G1 录音持久化故障恢复契约实施计划

> **For agentic workers:** 使用 executing-plans 逐项执行；本轮负责人已要求核对后直接开发、原分支续接、仅本地提交。审查使用独立子代理，先规格后质量。

**Goal:** 为现有 IndexedDB 录音恢复实现增加可重复的故障契约，并修复会话更新与末块落盘竞态，不把本地合成用例当作 G1 真机通过。

**Architecture:** 保留 `recorderDB` / `loadLocalRecording` 接口、数据库 v2 和现有 UI。在真实桌面 Chromium 的专用 BrowserContext 中运行生产模块，以原生事务事件控制并发顺序。`updateSession` 的读取和补丁写回改为同一 readwrite 事务；事务失败不能误报完成或留下未处理拒绝。

**Tech Stack:** TypeScript、idb 8.0.3、Node test runner、既有 Playwright/Chromium；不新增依赖，不改 CI 的 infra 浏览器安装要求。

## 范围与设计依据

- 基线：`1921766c2`，分支 `codex/october-upgrade-p0`，接手时完全干净；前批六项源码指纹匹配。
- 依据：综合计划 §5.3、§7.1 G1；`docs/superpowers/specs/2026-10-13-upgrade-p0-gates.md` §2；`docs/research/2026-10-15-t04-g1-device-runbook.md`。旧操作模板保留，不重新研究。
- 选择真实 IndexedDB 故障测试而非只 mock `recorderDB`：后者无法检出事务间的丢失更新。暂不扩展生产验收状态机或云端 adapter，避免把没有真实证据的状态自动提升。
- 5/20/30 分钟仅转换为每 10 秒一块的 30/120/180 块合成字节负载；不生成或冒称 30 分钟可解码音频。锁屏、来电、强杀、真实磁盘配额、实际音频时长/核听仍属 #6 未执行。
- 本轮不涉及 SQL，因此不运行 PG 重放；不启用功能开关、不改变媒体 verifier/切流/供应商/告警语义，不执行外部动作。

## Task 1：先建立 RED

文件：新增 `scripts/browser-tests/recorder-recovery.test.cjs`。

- [x] 测试从 loopback 载入当前 `recorder-db.ts`、`recording-recovery.ts` 和已安装 idb；禁止非本机网络，各案例使用独立浏览器上下文。
- [x] 在会话 get 的原生 success 事件内排入另一个原生 readwrite 事务，插入下一块和新水位；再让 `updateSession({ state: 'interrupted' })` 继续。断言最终水位、块字节与恢复结果一致，旧实现必须失败。
- [x] 同样交错两个会话补丁、删除与迟到更新，断言不丢补丁、不复活已清除会话。
- [x] 注入原生事务 abort，断言调用失败、原块/水位不变、没有 unhandled rejection；错误注入必须在 finally 恢复。

```bash
node --test scripts/browser-tests/recorder-recovery.test.cjs
```

预期 RED 是具体行为断言失败，不是浏览器缺失或测试未发现。保存独立日志、退出码及测试/生产来源 SHA-256。

## Task 2：最小修复与契约矩阵

文件：修改 `packages/web/src/lib/recorder-db.ts`；续写上述浏览器测试。

- [x] `updateSession` 在一个 `db.transaction('sessions', 'readwrite')` 内执行 `get`、合并补丁和 `put`，返回值须等待 `tx.done`。不存在的会话返回 undefined，不能重新创建。
- [x] 对实际 RED 暴露的事务失败路径观察并消费 `tx.done` 拒绝；同步写入异常时 abort 未提交事务并等待其结束，不吞掉原始错误。
- [x] 每个 30/120/180 块负载：实际落盘，离线继续写，刷新与关页重开后校验块数、顺序、总字节和 SHA-256；上传仍 pending，云端确认仍 null；错误账号/项目不得导出。
- [x] 缺块与 hash 损坏必须拒绝且保留原草稿；重复中断不新建会话。使用既有恢复/组件测试检查 UI 不误报安全保存。
- [x] 重跑浏览器契约及定向 Jest，保存 GREEN 证据。

```bash
node --test scripts/browser-tests/recorder-recovery.test.cjs
npm test --workspace=packages/web -- --runInBand --runTestsByPath \
  src/lib/__tests__/recording-session.test.ts \
  src/lib/__tests__/recording-recovery.test.ts \
  src/components/recording/__tests__/smart-recorder-session.test.tsx \
  src/components/recording/__tests__/recording-recovery-panel.test.tsx
```

## Task 3：独立审查、完整验证与本地收口

- [x] 独立规格审查 PASS 后才请求独立代码质量审查 Approved；发现问题先增加 RED，修复后复审。审查范围包含源码、测试和证据表述。
- [x] 构建前保存 next-env 原始字节；执行完整命令链，恢复且校验本轮构建生成的 next-env（不 checkout）。
- [x] 验证 1471 历史输入；缺 `.log` 时根据归档索引解压核验，不更改旧证据；前批源码哈希单独检查。
- [x] 创建独立报告/证据 `docs/research/2026-11-01-g1-recorder-recovery.md`、`docs/research/evidence/2026-11-01-g1-recorder-recovery/`；记录真实设备矩阵仍 0、`g1MilestoneSatisfied: false`、`pushConditionSatisfied: false`、audit 未重跑。
- [x] 更新 handoff 和 docs 索引当前入口；核对 staged/unstaged、仅暂存本批文件，创建本地 checkpoint，不 amend、不推送。

```bash
npm run verify &&
npm test --workspace=packages/shared -- --runInBand &&
npm run test:infra
git diff --check
```

## 续接状态

- Task 1/2 已完成：旧实现 5 项行为 RED；修复后浏览器 11 子案例（Node 总计 12，含父容器）通过，定向 Jest 4 套 / 68 项通过；证据见本批 task1/task2 日志。
- Task 3：独立规格 PASS、独立质量 Approved，均重新执行 11 浏览器子案例和 4/68 定向 Jest。全量命令链退出 0（Web 139/2196、shared 4/16、infra 14、184 页），1471 历史输入 0 差异。Next 自动增加 root-params import，核对生成器与精确 diff 后已恢复原字节；本计划及全部证据随本地 checkpoint 封存，提交号以包含本文件的 Git 检查点为准，不推送。
- 原 P0/G0 已授权推送的历史结论不由本轮重算；G1 仅为本地子切片。
- 本批没有新的远端操作授权。#1/#2/#6 及 #7 真实灾备、#4 书面合规等后续证据按原边界保持开放。

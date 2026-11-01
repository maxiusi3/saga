# G1 录音草稿写入边界实施计划

> **For agentic workers:** 逐项 TDD 执行；当前用户要求继续下一步，沿用原分支/本地提交授权，不建新工作树。先独立规格审查，再独立质量审查。

**Goal:** 防止重复块覆盖已保存原件、已清理/已确认会话被迟到块写入，以及清理失败部分删除。

**Architecture:** 在现有 IndexedDB v2 的同一 readwrite 事务内先检查会话可写状态，再以 `add` 而不是 `put` 写入块；复用上一批 `commitRecorderWrite` 完成上传标记/清理事务。正常录制与 interrupted 会话都允许末块落盘；不新增自动重试、数据库迁移或云端确认逻辑。

**Tech Stack:** TypeScript、idb、既有 Playwright/Chromium 原生 IndexedDB 测试；不新增依赖。

## 基线与范围

- 接手 HEAD `686599f61`，分支 `codex/october-upgrade-p0`，工作树及暂存区干净，领先远端 1 个本地提交。
- 上一批恢复契约已完成，不重做其实现、研究或证据。原综合计划 §5.3 保存契约、§7.1 G1 重复保存/故障恢复、`recording-session.ts` 已有重复序号/confirmed 拒绝规则是依据。
- 只改 `packages/web/src/lib/recorder-db.ts` 和 `scripts/browser-tests/recorder-recovery.test.cjs`，新增本批报告/证据并更新两处当前续接索引。
- 非目标：`saveSession` 的创建/更新语义、直接原生 IndexedDB 篡改、显式 `deleteChunk` 后重新插入、服务端授权、云端/完整资产确认、物理磁盘配额或真机录音。此 API 防护不是安全沙箱，也不是全数据库不可变保证。

## Task 1：原生浏览器 RED

- [x] 在已有浏览器套件添加同字节/异字节重复序号、并发同序号竞争用例：必须拒绝冲突，原字节/hash/上传状态/会话水位不变；重复调用不是幂等成功，与纯函数重复序号规则一致。
- [x] 添加 missing / confirmed / 未知状态 / 非空 cloudConfirmedAssetId / 清理后迟到块用例，全部 fail-closed，不新增块或推进水位。
- [x] 为 `markChunkUploaded` 和 `clearSession` 注入原生 abort，并对清理的最后 session delete 注入同步异常；必须拒绝且保留整个草稿，无未处理拒绝。
- [x] 保留旧 11 案例：块写入 abort hook 同时拦截原生 put/add，避免测试绑定具体写入方法；损坏 fixture 改用显式原生事务篡改，恢复拒绝与保留原件断言不变。
- [x] 执行并封存实际 RED：行为失败而非基础设施错误；按运行保存源码/测试指纹、退出码、原始压缩日志。

```bash
node --test scripts/browser-tests/recorder-recovery.test.cjs
```

## Task 2：最小 GREEN

- [x] `saveChunk` 同一事务内先读 session，仅允许 `recording` / `interrupted` 且 cloudConfirmedAssetId 为 null；不存在/不匹配则抛固定错误，不写块。
- [x] 使用 `tx.objectStore('chunks').add(record)` 原生唯一键拒绝重复序号；成功后更新原水位，所有异常由已有 `commitRecorderWrite` 回滚/收尾。
- [x] `markChunkUploaded` 和 `clearSession` 的原事务整体放进已有 `commitRecorderWrite`；不修改上传/清理调用许可，不创建新会话，不把上传标记当云端确认。
- [x] 正例：interrupted 会话可收末块，重复上传标记保持 uploaded，cloudConfirmedAssetId 仍 null。
- [x] 浏览器套件全部通过，再运行既有录音/恢复定向 Jest。

```bash
npm test --workspace=packages/web -- --runInBand --runTestsByPath \
  src/lib/__tests__/recording-session.test.ts \
  src/lib/__tests__/recording-recovery.test.ts \
  src/components/recording/__tests__/smart-recorder-session.test.tsx \
  src/components/recording/__tests__/recording-recovery-panel.test.tsx
```

## Task 3：双审查、全量验证、本地封存

- [x] 独立规格 PASS 后独立质量 Approved；若发现问题先 RED 后修复并复审。
- [x] 备份 next-env 原始字节并跑完整命令链；核对本次生成差异后恢复原字节，保留旧 Next 配置和诊断。
- [x] 核验 1471 历史输入、前批证据目录原字节、本批来源和原始/压缩日志；本批允许变更的源码与当前 handoff/索引不算历史冻结材料。
- [x] 新报告 `docs/research/2026-11-01-g1-recorder-write-guards.md`；新证据目录 `docs/research/evidence/2026-11-01-g1-recorder-write-guards/`；更新 handoff、docs 索引及本清单。
- [x] 仅暂存本批明确范围并随本清单创建本地 checkpoint，不 amend、不推送，不执行远端迁移/repair、main 合并或部署；提交身份及提交后工作树以 Git 核实。

```bash
npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra
git diff --check
```

## 真实证据边界

§A #6 的设备版本、真实 5/20/30 分钟录音、锁屏/来电/系统清理/真实配额与解码核听仍未取得；#1/#2 仍限制云端阶段。只用本地合成字节，不进行付费调用或外发家庭素材。`g1MilestoneSatisfied: false`、`pushConditionSatisfied: false`；audit 未重跑。没有 SQL 改动时不重复 PG 实验。

## 续接状态

Task 1/2 完成：新增 11 项行为 RED（旧 11 与新正例通过），同测试指纹修复后浏览器 23 子案例 / Node 24 项通过；定向 Jest 4 套 / 68 项通过。Task 3 首轮完整验证与规格审查因会话中断未得到结论；已保留部分原始日志和空的未完成回执，退出码为 null，绝不作 PASS。续跑 `full-chain-resumed` 实际退出 0：Web 139/2196、shared 4/16、infra 14、184 页；next-env 已核对生成差异并恢复。独立规格 PASS 后独立质量 Approved，无待修发现；1471 历史输入与前批 31 文件未变，最终证据随本地检查点封存，不推送。下一批按真机模板补 §A #6，或另选尚未覆盖的本地子切片，不重做本批。

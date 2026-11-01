# G1 录音草稿写入边界与清理回滚

日期：2026-11-01（Asia/Taipei）。基线 `686599f61`，分支 `codex/october-upgrade-p0`；接手时工作树/暂存区干净，已有 1 个未推送本地检查点。本批本地实现、定向和完整验证完成，独立规格 PASS、独立质量 Approved；随新本地检查点封存，不推送。

[实施清单](../superpowers/plans/2026-11-01-upgrade-g1-recorder-write-guards.md) · [证据索引](evidence/2026-11-01-g1-recorder-write-guards/README.md)

## 本轮实际修改

依据综合计划 §5.3 保存契约、§7.1 G1 重复保存/故障恢复要求和既有 `recording-session.ts` 规则，补齐 `recorderDB` 持久化层边界。上一批原子会话更新已完成，未重新实现。

- `saveChunk` 在同一 readwrite 事务内检查会话存在、状态为 recording/interrupted 且 cloudConfirmedAssetId 为 null，再执行唯一键 `add`。同序号无论字节是否相同都拒绝，原块/hash/上传状态/会话水位保持；不把重复调用包装成幂等成功，不自动重试。
- missing、已清理、confirmed、未知状态或带确认标记的会话不能被追加块；迟到回调不会借 `saveChunk` 留下新孤立块。interrupted 状态仍允许新序号的末块落盘。
- `markChunkUploaded` 和 `clearSession` 复用既有 `commitRecorderWrite`，提前观察事务完成，异常时回滚并保留原始错误，成功须等提交。
- 上传标记仍是本地状态，重复标记保持 uploaded，但不会设置 cloudConfirmedAssetId、删除副本或宣称云端完整确认。

**保护范围是 API 局部契约，不是整个 IndexedDB 不可变或授权沙箱。** 本批不改 `saveSession` 的创建/更新语义、不禁止显式 `deleteChunk` 后再插入，也不能阻止同源原生 IndexedDB 篡改。云端封口、服务端权限与清理许可未扩张。

## RED / GREEN

原生 Chromium IndexedDB 套件在原源码上新增 **11 项行为 RED**：重复写入两例、confirmed/未知状态/非空确认标记三例、missing/清理后迟到两例、同序号并发一例、上传标记 abort 一例、清理 abort/同步异常两例。原 11 例与新 interrupted 末块正例均通过。

最关键的清理反例：在块删除后、session delete 之前注入同步错误，旧实现返回失败但所有原块已被删除；修复后整笔事务回滚，目标草稿和其他草稿字节保持。

| 本轮运行 | 结果 | 证据 |
|---|---|---|
| 写入边界 RED | 11 个子案例失败，Node 12 个失败含父容器；退出 1 | `write-guards-red.json` |
| 修复后浏览器 | 23 子案例 / Node 24 项通过，0 跳过；退出 0 | `write-guards-green.json` |
| 既有录音/恢复 Jest | 4 套 / 68 项通过；退出 0 | `focused-jest.json` |
| 续跑完整命令链 | Web 139 套 / 2196 项、shared 4/16、infra 14、184 页构建通过；退出 0 | `full-chain-resumed.json` |

RED 与 GREEN 使用同一测试源码 hash。旧 abort 测试改为同时 hook put/add，继续断言真实 abort 和原件保留；旧 hash 损坏 fixture 改由显式原生 IndexedDB 注入，不再借正常 `saveChunk` 覆盖原件。恢复拒绝与保留副本断言没有降低。上述 fixture 适配在 RED 前完成，旧 11 案例仍通过。

```bash
node --test scripts/browser-tests/recorder-recovery.test.cjs
```

沿用独立 loopback 服务与每例独立 BrowserContext，不接触用户浏览器，不连接远端。此命令仍独立于 Web/infra，未增加 CI 隐式浏览器安装要求。原生错误注入不是实际磁盘耗尽；30/120/180 个合成块不是实际 5/20/30 分钟音频，也不是性能或解码证明。

## 中断续接记录

首轮完整命令链在 Web Jest 开始后中断，没有测试总结、退出码或完整回执；原规格审查代理也未返回正式结论。续接时原执行进程/日志句柄均已不存在，源码仍匹配已完成定向验证的 11 项指纹，next-env 原字节未变。保留 `full-chain-interrupted.json`、部分日志归档及空的 pending 回执，不将中断记为通过；完整链以新文件名 `full-chain-resumed` 重新执行，独立规格审查重新启动。

1471 项历史输入与前批证据目录的 31 个本地文件均无差异，旧 RED/GREEN 和报告没有覆盖。最终以本批 `verification.json`、`protected-inputs-final.json` 与 `final-integrity.json` 为准。

## 完整验证与审查

续跑完整命令链实际退出 0，包含 type-check、lint、Web 全量、共享包测试和 infra；构建使用 Next.js 16.4.1，184 页生成完成。11 项来源在运行前与 GREEN 一致，运行后仅 next-env 出现已知的 `root-params.d.ts` import；核对后恢复备份原字节，SHA256 为 `7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651`。

```bash
npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra
```

旧 Next `eslint` 配置警告、`images.domains` 弃用警告及可选配置缺失诊断保留，成功 build 不等于生产环境合格。没有修改配置或依赖来消除警告。

独立规格审查 `/root/g1_write_spec_resume` 实际返回 PASS，并独立复跑浏览器 23 子案例 / Node 24 项、定向 Jest 4/68，均退出 0。收到规格结论后才启动独立质量审查 `/root/g1_write_quality`，实际返回 Approved、无待修发现，并再次独立复跑相同浏览器与 Jest 命令，均退出 0。两次审查前后生产与测试指纹一致；审查回执注明子代理来源，不冒充主执行原始日志。

`source-hashes.json` 绑定 11 项运行来源；`log-hashes.json` 绑定 5 次原始/压缩执行日志，其中中断运行退出码仍为 null。`document-hashes.json` 绑定最终文档与回执；`final-integrity.json` 核对暂存区字节、无未暂存遗漏和历史保护，排除自身避免循环 hash。提交身份与提交后洁净状态另以 Git 核实，不在证据内自引用提交 hash。

## 后续与禁止动作

§A #6 仍缺实际设备版本、虚构口述的真实 5/20/30 分钟录音、故障时点、锁屏/来电/强杀/系统清理与实际配额、解码时长和核听证据。继续使用既有 [G1 真机模板](2026-10-15-t04-g1-device-runbook.md)，不以本批测试填写真机通过。云端阶段依然受 #1 部署和 #2 迁移授权限制。

本轮只创建本地检查点，不推送、不合并 main、不远端迁移/repair、不生产部署、不付费调用、不外发家庭资料。未新增依赖、未重跑 audit；没有 SQL 修改，不重复 PG 实验。G1 完整里程碑与新推送条件都保持 false。

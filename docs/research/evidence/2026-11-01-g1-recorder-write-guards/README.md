# G1 录音草稿写入边界证据

基线 `686599f61`。仅本地子切片，真机/G1 仍未通过，不推送。

- `write-guards-red.json`：原实现 11 个行为子案例失败；记录命令、退出码、执行前后来源 hash。
- `write-guards-green.json`：同测试源码修复后 23 子案例通过，Node 24 项含父容器。
- `focused-jest.json`：4 套 / 68 项录音/恢复回归通过。
- `prior-evidence-hashes.json`：接手时前批证据目录全部 31 个本地文件指纹；原报告/日志/归档不覆盖。历史源码 hash 是当时快照，本批有意变更的源码另列，不要求它继续匹配旧快照。
- 各执行 JSON 的 `archive` 指向 `raw/*.log.gz`，`rawSha256` / `rawBytes` 校验解压后的原字节；被忽略的 `.log` 不入库，不代表证据缺失。

- `full-chain-interrupted.json`：首轮完整链被中断，退出码 null，不能计为通过；部分日志为 `raw/full-chain-interrupted.log.gz`。
- `raw/full-chain.pending-json`：原 `full-chain.json` 空回执的原字节保留，不是有效 JSON/通过凭证。
- `protected-inputs-check.json`：1471 项旧输入、前批证据 31 文件均一致。

`full-chain-resumed.json`：完整链退出 0，Web 139/2196、shared 4/16、infra 14、184 页构建；不覆盖中断日志。`next-env-check.json` 记录本次生成差异和恢复后的原字节。

`spec-review.md`：独立规格 PASS 回执；其后启动的 `quality-review.md` 实际 Approved，无待修发现。两位审查员各自复跑浏览器 23 子案例 / Node 24 项及 Jest 4/68，均退出 0；审查回执与主执行原始日志明确分开。

## 最终封存

- `verification.json`：本批验证总表；`milestone-check.json`：仅本地切片完成，G1 与推送条件均 false。
- `source-hashes.json`：11 项最终来源；与 GREEN/Jest/完整链对应，完整链生成的 next-env 差异由独立回执核对并恢复。
- `log-hashes.json`：5 次执行的原始/压缩日志 hash，包含退出码 null 的中断运行；解压 bytes/hash 可独立复核。
- `protected-inputs-final.json`：最终复查 1471 历史输入与前批 31 个本地证据文件，保留较早的 `protected-inputs-check.json` 续接检查。
- `document-hashes.json`：最终报告、计划、当前 handoff/索引与证据回执；排除自身及最终完整性回执，避免循环 hash。
- `final-integrity.json`：提交前核验来源、文档、日志、历史保护与暂存区字节；随新本地检查点提交。实际提交身份/提交后状态由 Git 核实。

复现命令：`node --test scripts/browser-tests/recorder-recovery.test.cjs`。独立浏览器临时上下文与 loopback，仅本地合成数据，不读取家庭素材，不提供设备/实际时长/解码/云端资格证明。

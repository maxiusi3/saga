# G1 本地录音持久化故障恢复证据

基线 `1921766c2`。本目录仅对应本地子切片，不能作为 G1 真机或长录音通过凭证。

- `task1-red.json`、`task1-quota-red.json`：旧实现的实际失败、命令、退出码和前后来源指纹。
- `task1-green.json`：5 个原生 IndexedDB 回归子案例通过。
- `task2-browser-green.json`：扩展后 11 子案例 / Node 12 项（含父容器）通过，0 跳过；块数模型不是音频时长。
- `task2-jest-green.json`：既有 4 套 / 68 项录音/恢复回归。
- `protected-inputs-before.json`：1471 项旧输入在修改前核验无差异，记录来源清单的 hash。
- 每条执行记录的 `archive` 指向 `raw/*.log.gz`；解压字节的 SHA-256 必须与 `rawSha256` 一致。运行时 `.log` 被 gitignore，不是丢失证据。

## 最终封存

- `verification.json`：本轮命令、数量、双审查、来源绑定及安全边界汇总；本地子切片完成。
- `milestone-check.json`：G1 真机未通过，本批不推送；不重算前批 P0/G0。
- `full-chain.json` / `raw/full-chain.log.gz`：本轮完整链退出 0，Web 139/2196、shared 4/16、infra 14、184 页。
- `spec-review.md` / `quality-review.md`：按先规格后质量执行的独立回执，PASS / Approved。两位审查者另行重跑定向测试；回执不是命令原始日志。
- `next-env-check.json`：构建新增 root-params import 的保护拒绝、生成器归因与保存原字节恢复；最终 hash 与接手一致。
- `protected-inputs-check.json`：1471 旧输入在修复后仍全部一致。
- `source-hashes.json`：11 项源码/测试/依赖输入，与完整链执行前一致。
- `log-hashes.json`：6 份执行日志原文与 gzip 压缩文件指纹、退出码。
- `document-hashes.json`：本批计划/报告/交接及证据文档指纹；不包含该索引自身及其后生成的 `final-integrity.json`，避免循环哈希。
- `final-integrity.json`：提交前源码、文档、日志、旧输入及 staged/unstaged 检查结果。

保留每次失败原文，不用后来成功日志覆盖 RED。本批随本地检查点封存；本目录不记录自指提交号，以 Git 历史为准。

## 复现

```bash
node --test scripts/browser-tests/recorder-recovery.test.cjs
npm test --workspace=packages/web -- --runInBand --runTestsByPath \
  src/lib/__tests__/recording-session.test.ts \
  src/lib/__tests__/recording-recovery.test.ts \
  src/components/recording/__tests__/smart-recorder-session.test.tsx \
  src/components/recording/__tests__/recording-recovery-panel.test.tsx
```

浏览器使用独立临时上下文与 loopback 源，退出即关闭；没有生成或外发真实家庭音频。主计划的设备版本、真实 5/20/30 分钟、锁屏/来电/强杀/真实配额、云端完整确认、原件导出与跨家庭权限矩阵仍须另行执行。

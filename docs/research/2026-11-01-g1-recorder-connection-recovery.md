# G1 录音草稿连接失效与显式恢复

日期：2026-11-01（Asia/Taipei）。基线 `f59e8f863`，分支 `codex/october-upgrade-p0`；接手时工作树/暂存区干净，领先远端跟踪基线 `1921766c2` 两个本地提交。前两批事务恢复和写入防护已完成，本批不重做。

[实施清单](../superpowers/plans/2026-11-01-upgrade-g1-recorder-connection-recovery.md) · [证据索引](evidence/2026-11-01-g1-recorder-connection-recovery/README.md)

## 根因与本地修复

`getDB` 原先永久缓存第一次 `openDB` 的 Promise：若第一次打开失败，之后所有显式调用仍拿到同一个失败；若连接已关闭，之后的读取拿到失效句柄。旧连接也没有 versionchange 释放处理，阻塞另一个连接升级。

本批只修改连接获取层：

- 一次打开仍由并发调用者共享；打开失败原样拒绝本次操作，观察清理 Promise 后移除该次缓存。下一次显式调用才重新打开，无后台重试。
- 收到 versionchange 时关闭本连接并移除对应缓存，让外部连接完成升级或回滚；不删除数据，不改变 DB_VERSION/schema。
- 收到异常关闭通知时失效该缓存；以 Promise 身份比较保护新连接，不允许旧句柄迟到事件清除新缓存。
- 外部升级成功到更高版本时，旧客户端仍按版本 2 打开并明确拒绝 VersionError，绝不擅自降级、删库重建或承诺兼容；升级回滚时可再次显式打开原版本恢复。

没有修改事务 helper、已有增删改 API 语义、录音队列、云端确认、权限、UI、SQL 或依赖。不自动继续受影响的录音，也不重放未知结果的写入。

参考：[idb openDB 生命周期](https://github.com/jakearchibald/idb#opendb)，并核对实际安装的 idb 8.0.3 实现。`terminated` 对应异常 close 事件，普通 `db.close()` 本身不会触发该回调。

## TDD 与证据范围

原生 Chromium 新增 5 个行为反例：

1. 已存草稿保持不变，冷打开首个请求注入低版本，产生真实 VersionError；三个并发调用均失败、只打开一次、无隐式重试。下一轮显式读取应共用一次新打开并恢复原件，之前失败的状态补丁不得被重放。
2. 独立原生连接升级到版本 3，旧连接须主动释放而不是阻塞；旧代码随后 fail-closed，版本 3 数据仍可由原生读取校验。
3. 独立原生升级被主动 abort，旧版本数据保留；下一次显式恢复无需刷新即可重开版本 2。
4. 捕获的原生句柄被关闭后，显式注入异常 close 通知，后续读取重开并恢复原件。
5. 新连接已经建立后，再投递旧句柄的 close 通知，不得触发第三次打开。

RED：原实现 5 子案例行为失败，原 23 子案例全部通过；Node 汇总 6 失败含父容器，退出 1。GREEN 使用相同测试源码，28 子案例 / Node 29 项通过，0 跳过，退出 0。既有录音/恢复定向 Jest 4 套 / 68 项通过，退出 0。

**边界：** 低版本请求是受控故障注入，不是物理配额耗尽；两个升级案例使用同页独立原生连接，不代表完整多标签页产品验收。最后两个案例主动 close 后手动投递事件，仅验证异常关闭信号处理，不证明真实浏览器强制终止。旧 30/120/180 合成块只代表数量模型，不是真实 5/20/30 分钟音频。

```bash
node --test scripts/browser-tests/recorder-recovery.test.cjs
npm test --workspace=packages/web -- --runInBand --runTestsByPath \
  src/lib/__tests__/recording-session.test.ts \
  src/lib/__tests__/recording-recovery.test.ts \
  src/components/recording/__tests__/smart-recorder-session.test.tsx \
  src/components/recording/__tests__/recording-recovery-panel.test.tsx
```

## 最终验证与收口

本地实现、定向及完整验证完成：本次 verify/shared/infra 实际退出 0，Web 139 套 / 2196 项、shared 4 套 / 16 项、infra 14 项、Next.js 16.4.1 构建 184 页全部通过。独立规格 `/root/g1_connection_spec` 实际 PASS 后，独立质量 `/root/g1_connection_quality` 实际 Approved，无待修发现。两位审查员各自复跑浏览器 28 子案例 / Node 29 项与定向 Jest 4/68，均退出 0，源码与测试指纹未变。

next-env 本次只增加已知的 `root-params.d.ts` import，核对后从事先备份恢复原字节，SHA256 为 `7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651`。旧 Next `eslint` 配置与 `images.domains` 警告、可选 Google/Stripe/analytics/Sentry 配置缺失诊断保留；build 成功不是生产环境合格证明。最终日志、来源、文档及历史保护以本批证据为准，不复用历史运行充当本次验证。

接手及收口均核验 1471 历史输入、前两批 G1 全部 60 个本地证据文件，无缺失或变更。`source-hashes.json` 绑定 11 项来源，`log-hashes.json` 绑定 4 次原始/压缩运行；`document-hashes.json` 与 `final-integrity.json` 核对最终文档、暂存区及历史保护。原始 `.log` 被忽略，`raw/*.log.gz` 与独立回执一并入库。没有 SQL 变更，不重复 PG 实验；audit 未重跑。

本报告、实施清单与最终证据随一个新本地检查点封存；提交身份与提交后洁净状态另由 Git 验证，不在证据内自引用提交 hash。审查回执明确是子代理结果，不冒充主执行原始日志。

## 下一步与禁止动作

按[真机模板](2026-10-15-t04-g1-device-runbook.md)补 §A #6 的设备版本、真实 5/20/30 分钟虚构口述、断网/锁屏/来电/强杀/系统清理/实际配额及解码核听证据；云端阶段仍受 #1 部署与 #2 迁移授权约束。输入未就绪时可继续尚未覆盖的独立本地切片，不重做本批连接恢复。

`g1MilestoneSatisfied: false`、`pushConditionSatisfied: false`。本批只允许新本地检查点，不推送、不合并 main、不远端迁移/repair、不生产部署、不付费调用、不外发家庭资料。

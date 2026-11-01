# 方案 B 逻辑备份恢复演练与验证工具实施与验证报告

- 日期：2026-11-01
- 基线提交：`7ada8e1d4`（飞书告警投递适配检查点）
- 工作分支：`codex/october-upgrade-p0`
- 状态：**本地切片完成并收口；未满足远端推送条件（`pushConditionSatisfied: false`）**

---

## 1. 目标与背景

用户现场确认其 Supabase 生产项目处于 **Free Plan**（云端无自动备份，控制台明确提示升级 Pro 才能享受 7 天快照）。
根据主计划 `docs/2026-10-10-integrated-upgrade-plan.md` §7.1 G0 与 §11 运营底座要求：
由于无云端自动化快照，**方案 B**（`pg_dump -Fc` 自定义归档逻辑备份 + 对象存储 SHA-256 冻结清单 + 独立删除墓碑重放 + `pg_restore` 隔离恢复）是系统最核心的数据安全底座。

本工程切片将方案 B 标准化为强类型服务端核心库与独立 CLI 工具，并在生产切流端点完成 fail-closed 接入。

---

## 2. 核心实现与安全设计

1. **自定义归档格式与哈希校验 (`verifyPgDumpCustomArchive`)**:
   - 严格要求 PostgreSQL 自定义归档头部魔数 `PGDMP`（0x50 0x47 0x44 0x4d 0x50）。
   - 强制 12 字节头部下界（5 字节魔数 + 3 字节版本 + 1 字节整数长度 + 1 字节 offset 长度 + 1 字节格式 + 1 字节标志位），彻底阻断空文件或截断归档。
   - 确定性计算归档文件的 SHA-256 哈希。

2. **存储对象清单白名单与边界防御 (`verifyStorageManifest`)**:
   - 桶白名单严格锁定为 `['saga', 'audio-recordings']`。
   - 严格 ISO 8601 UTC 时间戳与日历合法性校验（防范 2 月 30 日等滚动穿透）。
   - 对象 ID 限长 128 字符，严格清洗控制字符与路径遍历符号 (`..`)。
   - 对象 Key 限长 512 字符，禁止反斜杠 `\\`、前导斜杠 `/`、相对前缀 `./`、路径遍历 `..` 及空字符 `\0`。
   - 对象清单长度硬上限 `MAX_MANIFEST_OBJECTS = 100_000`，总字节数受 `Number.isSafeInteger` 溢出防御保护。
   - 强制清单中的 `dumpSha256` 必须与归档文件的实际 SHA-256 严格匹配。

3. **冻结时间点后删除墓碑重放与防复活引擎 (`replayTombstonesAndComputeSurvivingSet`)**:
   - 解析备份冻结时间戳 `freezeTimestamp`，过滤并重放之后产生的删除墓碑。
   - 墓碑时间戳严格解析，格式错误直接抛出异常 fail-closed，杜绝因静默丢弃导致敏感资产在恢复后复活。
   - 多维度匹配待清除资产（`storageObjectId`、`targetId`、`${bucket}::${key}`），从存活对象集彻底剔除。
   - 验证存活总字节与对象数严格收敛。

4. **切流就绪端点接入 (`evaluateSchemeBBackupStatus`)**:
   - 服务端纯函数与环境变量 `SCHEME_B_BACKUP_LEDGER_JSON` 对齐。
   - 无台账时保持 `unverified`（原因 `scheme_b_backup_not_rehearsed_or_verified`）。
   - 检测到数据库/存储漂移 (`driftDetected === true`) 时保持 `unverified`（原因 `storage_or_database_drift_detected`）。
   - 时钟漂移保护：未来时间戳超过 5 分钟直接判定为非法台账。
   - 接入 `/api/admin/cutover-readiness`，端点始终保持 HTTP 503 `status: 'not_ready'`。

5. **独立 CLI 工具 (`scripts/verify-scheme-b-backup.cjs`)**:
   - 支持 `--dry-run` 自检协议规范。
   - 支持 `--dump <path> --manifest <path> --tombstones <path>` 对磁盘真实备份文件进行全流程验算。
   - 严格结构化 JSON 输出与进程退出码。

---

## 3. 审查与全量验证记录

1. **独立规格合规审查**:
   - 结论：**PASS**
   - 验证点：`PGDMP` 12 字节头部、白名单桶、dump 哈希绑定、墓碑重放防复活、端点 fail-closed、零远程外呼、零客户内容泄露。

2. **独立代码质量审查**:
   - 结论：**Approved**（初审提出 6 项强化点并给出具体 diff，修复后复审全量通过）。
   - 解决项：头部截断检查、强制 `expectedDumpSha256`、ID/Key 严格清洗与字符集控制、集合上限与整数溢出防御、墓碑时间戳严格解析、磁盘文件端到端 CLI 测试。

3. **命令链与保护验证**:
   - Web Jest: 139 套 / 2196 项通过
   - Shared Jest: 4 套 / 16 项通过
   - Infra Node: 14 项通过
   - 构建验证: 184 页静态/动态路由全部构建通过
   - 历史受保护输入: 1471 项文件哈希无一变化
   - `packages/web/next-env.d.ts` 恢复为原字节：`7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651`

---

## 4. 边界与当前断点

- 本地切片完成，不等于已在生产环境执行了真实备份或恢复（人工阻塞清单 #7）。
- 外部依赖与环境仍受限：未推送远端、未合并 main、未应用远端迁移。
- `pushConditionSatisfied: false`。

# 元数据采集器独立补审

审查日期：2026-10-17（Asia/Taipei）。独立审查代理：`/root/metadata_review`。

结论：**原限定范围已完成独立审查，发现 1 项 P2，暂不给出无问题 PASS。** 最终 02:45 快照与当前采集 SQL、源码指纹及对账摘要一致；下面的关闭超时问题不否定该次已经关闭连接的快照。本结论不覆盖历史工作树，也不表示 G0/G1、远端修复或发布里程碑通过。

## 范围与方法

按 `review-status.md` 确认待补审查背景，并按本次委派限制审查：采集器、定向测试、`.gitignore` 两条 metadata-reader 精确忽略项、研究报告、`comparison.json`、`verification.json` 及最终 `snapshot-2026-10-17T02-45-52-407Z.json`。

执行了源码静态审查、上述文件 SHA256 复算、快照与对账的本地一致性断言，以及关闭卡住的合成 Client 复现。未读取真实凭据、连接远端、调用业务函数、重跑既有测试、修改实现/旧证据或 commit/push。`verification.json` 记录的 10 项测试通过作为已有证据引用，不冒称本代理重新执行。项目构建、全部历史文档、根迁移文件与其源码哈希不在本次独立复验范围内。

## 发现

### P2 — 总截止在连接关闭前撤销，关闭卡住时不再有时间上限

- 位置：`scripts/inspect-supabase-metadata.cjs:171–174`；总截止建立于 `:158`，报告落盘在 `:177–183`；相关文字为研究报告 `:17` 的“外层 90s 截止”。
- 来源指纹：采集器 SHA256 `2f8330bf74023629b6c862d1fc049c3e1e2d4ac40ac3258ff57bdb906c5b240d`。
- 原因：`finally` 先执行 `clearTimeout(timer)`，再 `await client.end()`。因此总截止不能覆盖连接关闭。如果关闭承诺一直 pending（例如结束连接期间传输层不再完成关闭），执行会停在这里，既没有强制断开，也到不了后面的证据写入与退出码赋值。
- 影响：采集器不满足完整流程的 90 秒有界约束；已有 `collect()` 单元测试验证的是事务回滚，没有覆盖 `main()` 的异步关闭边界。当前快照明确记录 `connectionClosed: true`，因此该次成功收尾的事实仍有效。
- 建议：让连接清理有独立或剩余的截止时间；截止到期应强制销毁流、明确记录超时/关闭状态，并继续保存安全的失败证据。最终只在清理已完成或已被有界终止后清除计时器；不能仅把 `clearTimeout` 向后移动而遗漏超时后的状态和证据落盘。

本地合成复现：用 Node VM 执行同一源文件，`fs` 的凭据与 CA 读取、`pg.Client` 全部替换成内存桩；查询返回合法只读身份及空元数据；`Client.end()` 永不 resolve。仅把 90,000 ms 计时器缩放为 20 ms，在 60 ms 的本地观察点得到：

```json
{
  "endStarted": true,
  "destroyed": false,
  "snapshotWritten": false,
  "outputLines": 0,
  "calls": [
    "deadline 90000 created (scaled to 20 ms)",
    "deadline cleared",
    "end waiting"
  ]
}
```

该复现只证明关闭阶段缺少截止保护，没有模拟或操作真实连接。

## 已核对的行为与证据

| 项目 | 独立结论与位置 |
|---|---|
| 只读与访问范围 | `collect():113–135` 先进入 `REPEATABLE READ READ ONLY`，设置并校验后端限时后才读取元数据，成功/失败均进入回滚；`readSection():98–109` 用保存点保留 `denied` 与成功空结果的区别。`:49–96` 的固定查询以 catalog 为主，仅额外读取 audit 视图的统计、迁移 version/name、两个固定 bucket 的配置，不枚举业务行或对象键。 |
| TLS 与主机 | `parseCredentials():21–24` 限定项目账号、数据库、Supabase pooler DNS 主机及端口；`clientConfig():29–36` 显式要求 CA 验证、`rejectUnauthorized: true`，没有覆盖/禁用 pg/Node 默认主机校验；`:160–163` 再检查 TLS authorized。最终快照 `:24–37` 为 authorized、TLSv1.3、正确只读角色及 10s/2s/15s。这里是实现及既有快照审查，没有新增握手或主机不匹配实测。 |
| 凭据与输出 | `:12–26` 只接受五个固定配置键、限制角色/项目；`:39–44`、`:167–169`、`:181–187` 只输出固定错误码与安全摘要，不序列化原始错误、客户端配置或密码。迁移查询显式只选择 version/name；audit view 定义中的 `statements/created_by` 是字段名，快照未收集这些列的值。 |
| Git 忽略 | `.gitignore:39–40` 是根目录锚定的两个精确路径；本地 `git check-ignore -v` 命中这两条，限定路径的 `git ls-files --stage` 无输出。本代理未打开这两个文件，不能把本次结论描述成真实密码值比对。 |
| 目录与证据保留 | `:177–180` 只建立固定证据目录并使用 `wx` 独占创建新快照，不删除目录、覆盖旧快照或执行清理命令。没有发现超出证据目录的写入或广域删除。连接关闭的有界性问题见 P2。 |
| 快照与 SQL | 本地导入采集器导出值（未运行 `main()`），逐项比较 `QUERIES` 与最终快照 SQL 完全相同；脚本 SHA256 同时匹配快照和 `verification.json`。最终快照、对账文件及研究报告指纹匹配 verification 中的对应条目。 |
| 数量与状态 | 逐节重算行数均与 `rowCount`、comparison 一致：43 关系、459 字段、79 策略、141 索引、167 约束、172 权限组合、4 角色、6 audit views、2 visibility 统计、4 迁移；bucket 为 `denied/42501`，无行数。public 32 基础表＋3 视图、storage 8 基础表，40 基础表均启用 RLS；metadata_reader 的 43 个关系权限组合均无采集范围内的数据操作授权。 |
| 迁移与计划表对账 | comparison 中的四个已登记版本与快照一致；七个未登记版本、所列 20 张已存在 public 表、八张拟新增表缺席的集合关系均可由快照复算。未把表名存在当作完整 SQL 等价或迁移已执行的证据；本次没有重新解析根迁移正文。 |
| 风险结论 | 研究报告 `:49–53` 的 audio-recordings 全桶读/上传、五条 saga 项目策略中 `storage.foldername(p.name)`、首级目录上传者放行及 stories 的并行 OR 许可，均有最终策略和 ACL 支持（快照策略段约 `:6016`、`:6268–6396`，权限段 `:8595` 起）。真实对象存在、数据外泄、bucket 配置和攻击实测仍未确认；报告没有将这些缺口误报为完成。 |
| 结构结论 | 研究报告 `:63–68` 中的远端事实可在快照核对：stories.images 为 jsonb[]、title/storyteller_id 非空；project_roles 的 role/status CHECK、invited_at 缺席和两个项目/用户唯一索引；profiles.email 非空/唯一、id→auth.users、user_id 唯一索引；PostgreSQL 17.4。与范围外 bootstrap/应用源码的比较部分只按既有记录保留。 |

## 审查输入指纹

以下为本代理读取时的 SHA256，供后续修复审查固定基线。历史 `review-status.md` / `verification.json` 的“独立审查待补”是本次补审之前的状态，本代理未改写它们；由主代理在后续批次引用本报告并更新交接。

| 文件 | SHA256 |
|---|---|
| `scripts/inspect-supabase-metadata.cjs` | `2f8330bf74023629b6c862d1fc049c3e1e2d4ac40ac3258ff57bdb906c5b240d` |
| `scripts/__tests__/inspect-supabase-metadata.test.cjs` | `067694696c04363fffa0a11620bb6128595ccf6f4c0216a5aef19a93956384e2` |
| `.gitignore`（指纹为全文件；审查仅 39–40 行） | `1824aac1eaabcc8b2e3bbe2f518178792fa447b247b8c94bb2915df5f8019eb5` |
| `docs/research/2026-10-17-remote-metadata-reconciliation.md` | `3c839b2f182e31288f83ad3d0c09b97d87561b774a0e589782d31ee818d5e719` |
| `review-status.md` | `afdb2f2d4a2a4651f6fa1c6b51e4341e8eaf9abef22c5a14f5370365f9bfb17d` |
| `comparison.json` | `0cf54bbba49872eaf9101bfe7b96d06bf7b0a05b24be1d5a6d6d992f413b7218` |
| `verification.json` | `d995e838cc1243eca65e35f3286b930151801d85e721e0146a6fa8fc7d12cb62` |
| `snapshot-2026-10-17T02-45-52-407Z.json` | `bb808a1ce050947d21963ca91ec49c3adfa0ab80fe24f24f653f8c18bc6e6a4f` |

# 邀请 token 与持久席位事务实施计划

> 使用superpowers:subagent-driven-development执行，逐任务独立规格/质量审查，最后整批复审。已有继续升级授权涵盖本地实现与验证；原质量门达成前不提交/推送。

**Goal:** 将已核查的token/确认邮箱/席位预留/成员映射及取消过期边界实现为可运行的隔离事务候选。

**Architecture:** 新实验复用已审PG17 Harness/replay，在固定invitations结构上添加保护的来源端口、binding和request表，以及新schema RPC和严格协议模块。所有真实身份/权益均由合成fixture供给，生产适配仍独立待验收。

**Tech Stack:** PostgreSQL17.4、Node.js、node:test、现有pg驱动；无新依赖。

**Spec:** [本批契约](../specs/2026-10-18-invitation-transactions.md)。

## Global Constraints

- 仅新 `experiments/pg17-invitation-transactions/`、本批文档/证据；应用、依赖、旧实验/运行时、根迁移和历史证据原样保留。
- 独立本地marker；合成身份/可信权益端口不得宣传为真实JWT/付款证明；无远端/认证/邮件/支付/家庭资料调用或部署。
- 空search_path、精确authenticated EXECUTE、候选表禁直写；project→auth→invitation→wallet→source/binding→member统一顺序，锁后clock_timestamp；所有状态/资源/日志同事务。
- 原分支 `codex/october-upgrade-p0`、HEAD `1caa21a72`；保留未提交工作与忽略恢复目录；G0/G1未达成不提交/推送。

当前证据：[实现与验证记录](../../research/2026-10-18-invitation-transactions.md)、[Task 1独立审查](../../research/evidence/2026-10-18-invitation-transactions/task-1-review.md)、[汇总与最终状态](../../research/evidence/2026-10-18-invitation-transactions/verification.json)。Task 1已PASS/Approved；Task 2文档与完整性收尾独立审查PASS/Approved；整批最终独立审查已PASS。

## Task 1 — 协议与数据库事务候选

**Files:** 新实验 `protocol.mjs`、`protocol.test.mjs`、`fixture.sql`、`candidate.sql`、`scenarios.mjs`、`concurrency.mjs`、`verify.mjs`、`verify-lifecycle.mjs`、`input-pins.json`、`README.md`；证据 `docs/research/evidence/2026-10-18-invitation-transactions/`。

**Interfaces:** 消费旧 `pg17-routines/runtime.mjs` 的Harness/root/bin/digest/failure和 `replay.mjs` 的loadReviewed/replay；旧文件只读。产出spec中的send/accept/release/status/lookup原子RPC、新token/严格TABLE解析协议与真实数据库证据。

- [x] 在实现前持久保存协议RED和旧token签名真实42883 RED，确认相关表零变化。

```js
const old = await h.actor('authenticated', confirmedUser,
  'SELECT * FROM public.accept_project_invitation($1::text,$2::uuid)', [legacyToken, confirmedUser])
h.eq(old.sqlstate, '00000', 'token acceptance contract is available') // RED: actual 42883
// token and complete rows stay in memory; public evidence records only safe outcomes/hashes.
```

- [x] 根据固定metadata实现invitations补充fixture和受限合成身份/来源端口，独立schema/marker/ACL；写出与生产差异和无自动历史adoption边界。
- [x] 实现新token规范及恰一行TABLE解包；明确rejected/unknown/confirmed；未知返回不得触发重写或service回退。

```js
// Protocol result is explicit, never a pre-read fallback.
assert.equal(decodeAcceptResult({data: [], error: null}, expected).kind, 'unknown')
assert.equal(isCanonicalToken(' v1_0123456789abcdef0123456789abcdef'), false)
```

- [x] 实现完整send/accept/release/status/lookup契约，保护binding/请求别名及来源/钱包/日志一致性；锁后重验身份、资格、时钟和字段。
- [x] 真实正反例与全部写入故障/显式回滚、重复应用、未知提交恢复、两原导出组合；拒绝/故障使用完整表快照验证零写入。
- [x] 真实并发观察blocking_pids/pg_locks，覆盖spec竞争矩阵；身份/来源撤销和项目/成员变更的两种先后顺序均需明确结果。
- [x] 固定依赖指纹；最终正常/污染环境和四类生命周期验证，所有连接/集群/临时目录清理有观察证据；保留RED和中间失败记录。
- [x] README、实现报告、精确最终输入/证据哈希清单；独立规格/代码审查，发现问题先复现修复再 scoped re-review。

## Task 2 — 验证汇总与交接

**Files:** 新 `docs/research/2026-10-18-invitation-transactions.md` 与本批证据README/verification/milestone/final-checks；更新handoff、主计划、docs索引、P0/P1及本计划状态。

**Interfaces:** 消费Task 1最终证据/审查和前批project-checks.json；产出准确当前边界、下一步和原质量门判断。不改前批验证汇总或其历史哈希。

- [x] 核对前批707应用输入/3日志、next-env原字节；未变时标明复用的执行时间/归属，不重跑成功矩阵；依赖audit42项继续未解决。
- [x] 与本批起点manifest比较，全部旧文件除五份授权交接文档外保持；验证新实验/依赖/证据哈希、链接、空白、私有内容和token不进公开材料。
- [x] 记录原G0/G1判定及未实现的生产认证/可信支付来源/正式入口/迁移回退/备份/真机，更新handoff下一步。
- [x] Task 2与整批独立审查均已PASS；最后状态已更新并完成最终完整性核对。未达原门槛则保留本地分支及恢复目录。

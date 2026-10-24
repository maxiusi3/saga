# RPC 邀请/项目权限与资源事务实施计划

> 使用superpowers:subagent-driven-development执行；独立审查每项可交付物。保留当前未提交分支，原质量门达成前不提交/推送。

**Goal:** 收紧既有邀请接受/项目创建入口，验证资源事务，明确邀请令牌未来适配真源。

**Architecture:** 固定已审输入，在新实验中复用PG17隔离Harness/replay，以两个原签名的候选修复数据库入口；应用和根迁移不变。

**Tech Stack:** PostgreSQL17.4、Node.js、现有pg驱动、PL/pgSQL、现有npm验证。

**Spec:** [本批契约](../specs/2026-10-18-rpc-access-guards.md)、[P1契约](../specs/2026-10-13-upgrade-p1-contracts.md)、[G0/G1](../specs/2026-10-13-upgrade-p0-gates.md)。

**2026-10-18状态：** Task 1、Task 2及其独立规格/质量审查完成；Task 2初审R1已先RED、修复并复审PASS。Task 3项目验证与文档/完整性核验完成，[最终整批独立审查](../../research/evidence/2026-10-18-rpc-access-guards/batch-final-review.md)通过。最终正常/污染环境各117场景/1834断言、26次实际锁等待、4类生命周期验证，见[本批记录](../../research/2026-10-18-rpc-access-guards.md)与[汇总](../../research/evidence/2026-10-18-rpc-access-guards/verification.json)。G0/G1未达成，本地批次不构成新里程碑，未提交/推送/部署。

## Global Constraints

- 不新增根迁移、正式UI/API、依赖、远端查询、生产写入、邮件/支付调用或部署。保持旧实验源码/证据，保留全部未提交变更。
- 仅新`experiments/pg17-access-guards/`运行虚构数据；复用已审PG17.4运行时与固定快照/13定义，记录全部实际依赖SHA256。私有正文/凭据/错误CONTEXT不进入公开报告。
- 本人检查NULL安全；同项目当前facilitator邀请者；项目→目标成员锁顺序；项目创建锁既有钱包再消费，项目/角色/两个amount=-1消费日志同事务。
- 两个原签名/默认/返回保持，固定空search_path，仅authenticated EXECUTE，无service回退。创建payment_status明确unverified，不把余额当付款证明。
- 候选只在本地marker下应用；正常/污染环境及SIGTERM/启动/连接失败完整清理。停止未确认前保留集群目录。
- D01–D16全部A；旧券/席位只是兼容入口，不重新定义商品。原G0/G1未达成不提交/推送；不自动授权合并main、远端迁移或部署。

## Task 1 — 邀请调用/真源兼容核查

**Files:** `docs/research/2026-10-18-invitation-compatibility.md`、`docs/research/evidence/2026-10-18-rpc-access-guards/invitation-contract-audit.json`。

**Interfaces:** 消费本批契约、前批调用点报告及实际源码/固定快照；产出带文件行号/哈希的现状与未来适配边界，不改变Task2的原签名。

- [x] 重查五处邀请RPC参数及实际UI调用链，区分用户JWT、admin/service调用和TABLE解包；列实际相关输入输出，不把预读fallback当RPC成功。
- [x] 核对invitations的12列/约束/唯一token与project_roles实际类型/状态，明确不存在的project_invitations和无映射ID；检查邀请取消/过期席位逻辑及授予余额的旁路。
- [x] 记录未来适配原子边界：可信身份/邮箱→token事实→当前邀请者→预留→绑定/状态；未注册邮箱、重复/取消/过期、未知提交和回退逐项给出处理规则。
- [x] 独立审查事实、范围和引用，文档不宣称正式适配已实现。

## Task 2 — 原签名权限候选与PG17演练

**Files:** 新`experiments/pg17-access-guards/`中的candidate.sql、verify.mjs、scenarios.mjs、concurrency.mjs、verify-lifecycle.mjs、README.md；证据`docs/research/evidence/2026-10-18-rpc-access-guards/`。

**Interfaces:** 导入旧`runtime.mjs`的Harness、root、bin、digest；旧`replay.mjs`的loadReviewed/replay；旧fixture保持不变。新runner管理自己的输出和marker。原签名由固定私有定义与实际catalog核验，不复制原正文到公开文件。

- [x] 写原定义上的两个真实RED，用实际低权限caller，无claim/他人claim调用接受应被拒绝；零券创建应不产生项目/角色。先保存失败证据，再写candidate。

```js
const outcome = await h.actor('authenticated', null,
  'SELECT * FROM public.accept_project_invitation($1::uuid,$2::uuid)', [invitationId, inviteeId])
h.eq(outcome.sqlstate, '42501', 'missing caller cannot activate invitation')
```

- [x] 实现本人/角色/名称校验和精确ACL收紧；接受按项目→成员持锁后重查，创建按钱包持锁后检查并同事务消费/建项目/记账。资格拒绝不修改历史。保持默认参数和返回形状。

```sql
IF auth.uid() IS NULL OR $2 IS DISTINCT FROM auth.uid() THEN
  RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='access denied';
END IF;
-- 接受用上述第2参；创建应核对第3参，不混用位置。
-- 创建显式payment_status='unverified'，不依赖表默认paid。
```

- [x] 按规格覆盖正反例，校验每次错误前后项目/角色/钱包/交易；两种合法角色、NULL/不足/缺失钱包、缺券/缺对应席位、其他余额不变、两个consume日志及受限返回均实际核对。
- [x] 注入插入/消费日志约束失败、显式caller回滚、候选DDL回滚、重复应用；每次验证无中间状态和历史保留。无幂等键时两个有资源请求均成功并单独消费，报告未知提交限制。
- [x] 实际并发核验接受/撤销/删除/改绑/项目转移及资源竞争；记录pg_locks。与前批导出候选组合验证本人合法接受可登记、伪造接受不增成员、撤权后拒绝。
- [x] 新runner正常与污染环境通过，真实SIGTERM/启动/连接失败退出和清理有观察器证据；未改旧源码。写README、实现报告和最终指纹清单。
- [x] 独立规格/代码审查，发现问题先复现再修复并增量复核。

## Task 3 — 项目验证与交接

- [x] `npm run verify`、shared、infra保存退出码、日志及输入指纹；恢复本批next-env原字节，依赖未变则沿用audit42项失败。
- [x] 更新主计划、P1/质量门、索引、研究记录和handoff；精确区分本批候选、未来token适配及生产权限/支付来源/备份/真机缺口。
- [x] 核对工作树保留、来源/证据/链接、私有输入未公开、`git diff --check`；按原里程碑判定，G0/G1未达成，不提交/推送。
- [x] 最终整批独立审查。独立reviewer完成Task 3规格/质量及整批复核，结论见[审查报告](../../research/evidence/2026-10-18-rpc-access-guards/batch-final-review.md)；Task 1/2审查与自查证据单独保留。

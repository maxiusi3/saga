# G0/T02 PG17 依赖核查与导出请求候选

> 使用 superpowers:subagent-driven-development 执行并独立审查。继续用户指定的未提交工作树，原计划里程碑达成前不提交或推送。

**Goal:** 补齐已审RPC的唯一已知更新时间触发函数，在PG17.4隔离环境确认实际运行路径，并让两个导出候选只在持久请求存在时报告排队。

**Architecture:** 复用固定catalog查询、私有定义保存和只读生命周期；新增独立实验，精确重放受审定义及相关schema，全部使用虚构数据。候选只存在实验中。

**Tech Stack:** Node.js、现有pg驱动、官方源码构建PostgreSQL17.4、PL/pgSQL。

**Spec:** [P1契约](../specs/2026-10-13-upgrade-p1-contracts.md)、[质量门](../specs/2026-10-13-upgrade-p0-gates.md)、[RPC语义审查](../../research/evidence/2026-10-17-routine-audit/semantic-review.md)。

## Global Constraints

- 远端只读固定 `public.update_updated_at_column()` catalog定义，绑定06:13快照SHA256及函数MD5；不得调用远端RPC、读取业务行/对象、修改权限、迁移或部署。
- 复用TLS证书/主机验证、metadata_reader、REPEATABLE READ READ ONLY、10s/2s/15s后端限时及90秒异步截止。定义仅存已有忽略目录0700/0600，公开结果只含安全身份/哈希/状态。
- 本地仅使用独立Unix socket、禁TCP、虚构数据。运行时构建留在忽略目录，不安装或启动系统服务；运行版本和编译来源均记录，不能把原生PG17.4等同Supabase完整环境。
- 新实验可读取已审12定义和新增触发定义，逐一审核外部副作用及依赖后才重放；以固定快照核对相关列/约束/索引/触发器。未知Supabase身份、角色继承、扩展/规则和配置不能宣称已还原。
- 导出候选保留两个完整签名与返回形状，用NULL安全的本人检查和active project_roles/facilitator授权、固定search_path、精确EXECUTE收紧；两重载均INSERT真实export_requests记录。返回queued表示请求已登记，不代表worker/交付完成。无service身份回退；重试不承诺幂等，接口没有幂等键。
- 不改根迁移、正式UI/API、依赖或旧实验源码。全部现有未提交变更保留；历史失败证据不覆盖。候选不进入自动部署路径。
- 全量验证、更新handoff/主计划/规格/索引，按原G0/G1核验推送条件；本地批次不是新增里程碑。

## Task 1 — 固定触发函数采集

Files: 新增 `scripts/inspect-supabase-trigger.cjs`、对应node:test；复用 `inspect-supabase-routines.cjs` 的 TARGET_SQL/validateRows/savePrivateCapture 及共享runtime，不改旧查询。

- [x] 绑定固定快照，精确选择public零参数trigger函数及预期MD5 `3bfa5e64985d89e65932564c89520d5b`；拒绝CLI配置和目标漂移。
- [x] 先测试错误身份/摘要、缺失/漂移、安全报告与权限/生命周期，再实现最小入口。
- [x] 运行新增测试与已有52项相关回归，独立审查通过后主控制器只运行一次真实只读采集。
- [x] 审核新增私有定义、记录安全摘要/依赖，不能公开原文或将命名当安全证明。

## Task 2 — PG17行为与持久导出候选

Files: 新增 `experiments/pg17-routines/`（runner、fixture/场景、candidate.sql、README），证据 `docs/research/evidence/2026-10-17-pg17-routines/`。

- [x] 固定PG17.4来源/运行时/私有定义及快照哈希；独立集群清除宿主PG环境，所有连接固定socket/角色/ssl:false/超时，异常和signal完整清理。
- [x] 对12RPC涉及表建立相关完整列/约束/默认/索引与已确认触发器；auth.users/身份层仅合成。将实际覆盖和有意简化写入机器可读差异表。
- [x] 精确重放全部12RPC与已审触发函数，按完整重载记录合法/缺身份/伪造身份、缺列/名称歧义、付款与导出占位的实际结果；每次失败核对事务未留下部分写入。不得修改原定义掩盖失败。
- [x] 在实际PG17建立导出RED：四参queued但无持久行、三参歧义或越权不得算正确；再编写只在实验运行的两个导出候选。
- [x] GREEN覆盖两个签名及返回形状、本人active成员/facilitator、无身份/NULL/匿名/伪造用户/跨项目/removed/pending、metadata/service角色拒绝、选项持久化、约束失败原子回滚、DDL回滚/重复应用、历史记录保留；项目→成员锁顺序及撤权两种先后次序用实际阻塞证据验证。JSON选项只接受明确的布尔白名单，不接纳身份/状态/未知字段。固定fixture不允许真实外部作用。
- [x] 正常与污染环境运行、真实SIGTERM和启动失败清理；独立审查、修复及定向复核。

## Task 3 — 验证与交接

验证中新增已复现的维护项：旧解码取消测试两次在到达PCM事件前先触发1000ms期限，编译结束后仍复现。允许仅修正该测试的启动/期限竞争并保留实际取消、关闭、PID和监听器断言，生产解码代码与实际超时测试不变；单独审查后全量复验。

- [x] `npm run verify`、shared、infra，保存退出码和摘要；恢复next-env原字节，依赖未变沿用audit失败证据。
- [x] 更新本批研究记录、主计划、P1/质量门适用段、docs索引与handoff，指明PG17已实测范围和邀请/支付/生产认证等剩余缺口。
- [x] 核对链接、来源/证据哈希、私有材料未公开、既有文件保留、`git diff --check` 与原里程碑。符合原条件才提交/推送。

完成：2026-10-18。最终正常/污染环境各141场景874断言、12组锁证据、4类生命周期验证；Task2规格/代码与整批独立复核均PASS。应用完整执行77套766项、shared4/16、infra7、175页在中断前通过，续接707个输入一致。详见[验证汇总](../../research/evidence/2026-10-17-pg17-routines/verification.json)。原G0/G1未达成，保持未提交/未推送/未部署；运行时及交接工作树保留。

# T02 来源账本与绑定事务

2026-10-17（Asia/Taipei）。继续[本批计划](../superpowers/plans/2026-10-17-upgrade-t02-source-ledger.md)，以[前批来源投影](2026-10-17-t02-legacy-mapping.md)为输入。已完成本地实现、实验和独立复核；初审R1/P2经修复后关闭，无新增问题。

## 范围

新的 `experiments/t02-source-ledger/` 只使用本地临时 PostgreSQL 和虚构两家庭资料。来源观察、资产核查与绑定分别保存；定位候选不能作为资产存在、归属或 ready 的证明。没有修改生产表/API、Storage、根 migrations 或旧 stories 数据。

来源版本基于整个来源字段及其数据库类型，保留数组顺序和每个来源位置。同来源/版本幂等，不同版本追加并保留旧核查；绑定阶段重新检查当前来源、项目权限、墓碑和资产版本。事务竞争和结果未知需要实际实验报告，不能由接口声明推断通过。

## 记录与事务

[实验说明](../../experiments/t02-source-ledger/README.md)定义受信任的本地 adapter：`observeStory`、`bind`、`reconcileBinding`。它只接受固定请求字段，在事务内读取白名单媒体列，调用实际 TypeScript 投影器，禁止调用者自行提交 locator、来源路径或摘要。实验使用专用空闲 owner 连接；不接入 Web 或 Supabase 正式入口。

`source_observations`、`source_reviews`、`source_bindings`分别保存观察、核查结论与绑定。观察按项目/表/行/字段/位置/算法/摘要唯一；同内容版本返回原 ID，不同版本新增并标记冲突。观察、核查、核实证据与绑定拒绝 UPDATE/DELETE/TRUNCATE，普通角色无直接访问权限；数据库 owner 仍可改 schema，这些约束不冒充针对 owner 的安全隔离。

摘要算法 `saga-pg-jsonb-media-v1` 对 PostgreSQL 确定性 jsonb envelope 的 UTF-8 字节计算 SHA-256，包含实际类型、完整字段 JSON 和 PostgreSQL 字段文本。后者保留 SQL NULL / JSON null、数组下界等 JSON 投影会丢失的区别。位置、顺序、同字段其他项、类型都参与版本；不假设 PostgreSQL 跨大版本表示稳定。

绑定仅消费显式标记 `synthetic_fixture_only` 的核实记录，对项目/故事范围、kind、bucket/key、资产版本、对象版本、大小和 SHA-256逐项比较。事务按 project → story → 当前 membership → asset → observation 加锁，READ COMMITTED 下等待后读当前值，持锁至 COMMIT。项目粗粒度串行化用于这次正确性实验，未验证生产吞吐。

COMMIT 回执丢失的测试先让 PostgreSQL 真正提交，再由传输包装器抛错。adapter 返回 `commit_outcome_unknown`，不回滚或删除已提交数据；新连接按持久身份核对。核对历史绑定不代表重新授权使用资产。该注入不是真实网络代理故障，也不证明真实 Storage 写入的原子性。

## 本地实验结果

正常和合成宿主 PG 环境最终运行各 **290项检查通过**，各有 **18条 PostgreSQL 实际阻塞链证据**；稳定 fixture SIGTERM 退出 **143**。三份报告均确认连接数归零、集群停止、临时目录删除，且当前实验/投影器源码哈希一致。每次正常运行保存82条观察、8条核查、13条绑定和39个模拟资产，之后按约定销毁临时数据库。

覆盖重复/并发采集、字段完整版本变化、旧人工结论保留、歧义、跨项目、成员撤回、三个层级墓碑、阻塞后源/资产变更、同/异资产竞争、四类锁持有至提交、真实 SQL 回滚、后端连接终止及回执丢失核对。关键场景有真正 RED；中途夹具/阻塞观察器失败及修正过程独立保留，不当作最终通过证据。原 stories 媒体值在采集/绑定前后保持一致，故障场景的有意修改有还原核对。

初审提出一项P2：清空字段或移除数组/对象属性后缺少显式后继观察。已先复现再补齐100项回归，为历史中存在但当前投影缺失的路径追加 `source reference removed` / unresolved 记录，使用当前完整字段版本并保留旧核查/绑定；重复采集幂等，移除记录不可绑定，旧projector不变。修复前190项证据与初审原文保留，最终以fix1报告为准。

当前运行于 PostgreSQL **14.17**，使用已保存的 **17.4** 元数据快照对照选定字段；未运行 PG17。[最终独立增量复核PASS](evidence/2026-10-17-t02-source-ledger/review-fix1.md)，R1/P2关闭；源码/证据及项目检查见[验证汇总](evidence/2026-10-17-t02-source-ledger/verification.json)。

## 前批审查续接

T02 pg.Client 宿主环境隔离的初审 P2 已经[独立增量复核通过](evidence/2026-10-17-t02-compatibility/review-followup.md)，未发现修复引入新问题。复核确认此前 normal、合成 PG 环境、SIGTERM 与 RLS 报告的源码哈希；没有重复执行此前测试。旧初审及 verification.json 保留为当时的状态。

[元数据采集器补核](2026-10-17-metadata-supplement.md)完成P2修复与23项验证、独立复核及一次真实只读采集；函数/触发器/ACL结构已取得，bucket仍被拒。其证据和里程碑边界独立记录。

## 应用回归

本轮 `npm run verify` 退出 0：Web **77套/765项**、类型/lint及 **175页**构建通过；shared **4套/16项**、infra **7项**通过。详见[项目检查](evidence/2026-10-17-t02-source-ledger/project-checks.json)。next-env 原字节已恢复，受保护依赖文件未变。实验独立于应用测试入口，另行运行并记录。

依赖未变，本轮未重跑 audit；前批实际 **42项（34 high / 8 moderate）**仍使 audit:high 失败。构建中的缺服务端 Supabase 配置与旧 Next 配置提示仍属未解决限制，不是部署验证。

## 里程碑边界

G0 仍需要生产路径/权限、迁移对账与备份回退、供应商账户/数据条件。G1 仍需要正式资产/Storage/会话/删除 adapter、原件交付和真机 5/20/30 分钟故障矩阵。本地事务或审查通过不构成原计划里程碑；本轮不据此提交、推送、迁移或部署。

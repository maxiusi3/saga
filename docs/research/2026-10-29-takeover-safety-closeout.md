# 断点接手诊断与管理接口安全修复

- 日期：2026-10-29（Asia/Taipei）
- 基线：`5bdb915bc`，`codex/october-upgrade-p0`
- [本轮实施清单](../superpowers/plans/2026-10-29-upgrade-takeover-safety-closeout.md)
- [本轮证据](evidence/2026-10-29-takeover-safety/)

## 1. 现场与断点

`git status -s` 和 `git diff --stat` 均为空；最近五个提交已包括 P2、P3、P4、切流服务及双入口组件。`ls -lt` 指向 `next-env.d.ts`（构建后已恢复）、`docs/README.md` 和 handoff，而不是未写完的代码。远端只读 `git ls-remote` 确认同名分支也在 `5bdb915bc`。

最新实施计划的迁移、分析服务和 PG 实验文件都存在；15 份根迁移在 infra 测试中已按字典序登记。最新 10 月 25 日证据目录有一个 passed PG JSON，没有该批完整工作区验收汇总。因此现场接近情况 D，但进一步核查发现现有测试未覆盖的管理接口安全缺口；不重复已完成的迁移与实验开发。

## 2. 修复与边界

| 问题 | 修复 | 仍不代表什么 |
| --- | --- | --- |
| 两个管理接口只检查家庭登录，`pilot-analytics` 随后以 admin 客户端读取跨家庭台账 | 使用现有 `requireCronSecret`，要求服务器侧 `ADMIN_CRON_SECRET` 对应的 `x-cron-secret`；在读取数据库前拒绝缺失/错误密钥 | 不是给家庭用户开放管理员界面，不接受客户端自报 `service_role` |
| 切流接口把固定全零指标评估为 healthy | 返回 HTTP 503，`status: not_ready`，`operationalHealth.status: unavailable`，原因 `operational_metrics_not_connected` | §11 实际指标源与告警投递尚未接通 |
| API key 存在时，硬编码的训练退出/零留存 true 使供应商就绪 | 未核实条款保持 false，结果为 `blocked_by_policy` / `dry_run_contract_check` | 没有真实供应商调用、资格核验、账单或质量评测 |

两接口保留 `MEDIA_ASSETS_ENABLED === 'true'` 的独立前置门。成功读取的试点诊断与切流未就绪响应设置 `Cache-Control: no-store`。不新增 SQL，不修改依赖、旧实验、业务分析算法或 UI 行为。

## 3. 本轮验证

- 初始 type-check / lint：均退出 0。
- RED：新增管理路由测试 2 套/20 项，11 项预期失败、9 项通过，复现越权、假健康和假政策确认。
- GREEN：相关路由、评估函数与双入口组件定向 5 套/27 项通过。
- PG17.4 切流：3 场景/23 断言通过；P4：2 场景/22 断言通过，均为原脚本的新执行结果。
- 运行时只监听独立 Unix socket，使用合成家庭夹具；没有连接远端数据库。脚本的 `finally` 会将 `Harness.cleanup()` 写入报告的 cleanup 属性覆盖为 undefined，故另行检查本轮 scratch 路径及 PG PID 均不存在，并保存到 `pg17-reruns.json`；没有为了修复报告格式去改冻结实验。
- 全工作区验证：`npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra` 整条命令退出 0；Web 126 套/1503 项、shared 4 套/16 项、infra 7 项及 184 页构建通过。`git diff --check` 通过，`next-env.d.ts` 已按要求恢复原字节。汇总见 [verification.json](evidence/2026-10-29-takeover-safety/verification.json)。
- 构建仍提示缺少 `SUPABASE_SERVICE_ROLE_KEY`、旧 Next `eslint` 配置及 `images.domains` 弃用；构建退出 0 不证明服务端部署已配置。本轮未重跑依赖 audit，不宣称审计通过。
- 独立代码审查：无本批新增阻断问题。非空 pilot 台账的路由映射测试仍是既有覆盖缺口，不把空台账路由测试当作真实运营验收。

## 4. 质量门纠偏

历史报告的 `G0–G4 = true` 不能直接沿用为当前原计划 §7.1 的完整质量门结论。尤其 P4 脚本显式插入四户固定日期的测试数据，只证明本地 SQL 约束、RLS 与队列聚合，不是 20–30 户真实纵向试点或成熟观察窗证据；实际分析算法另外由 Jest 测试验证。

`TwoEntryProjectHub` 在生产源码中没有导入/挂载位置，其按钮通过可选回调工作。已有组件和测试保留，但本轮不把它称为已接通的产品闭环。切流评估函数也不等于实际监控采集系统。

历史报告和证据全部保留；本轮 handoff 顶部及索引明确覆盖旧的整体通过声明。原 G1/G2/G3 所需真机、授权模型评测、家庭体验，以及 G4 真实试点与负责人决策尚不能从当前证据证明；未降低门槛，也未改写任何旧 JSON 为新结论。

## 5. 提交、推送与下一步

本批只收口本地安全修复检查点，不声明原计划阶段全部完成。因此原有“达到原计划里程碑才推送”的条件未满足，保留本地提交，不执行 `git push`。这不是因测试失败而推迟，而是本地测试不足以证明业务质量门达成。

后续从本轮实施清单的剩余工程与真实验收继续，不重新创建已经存在的迁移或组件。仍遵循方案 B（`pg_dump -Fc` + 对象存储 SHA-256 冻结清单 + 独立删除墓碑重放 + `pg_restore`）；不合并 main、不远端迁移、不部署、不向外部付费 API 发送真实家庭素材。

# Saga 十月升级独立审计 — 2026-11-13

结论：**不能确认整体升级完成，当前质量不满足最终验收。** 已实现大量本地工程能力，现有测试与G3/G4合成场景均可复现通过，但存在两个可复现的可靠性缺陷、未通过的依赖安全门，以及三项原计划功能缺口。handoff的“100%”限定为当批本地工程范围，不能扩展为T00–T13全部需求或G0–G4真实质量门完成。

## 范围与依据

- 已读取用户引用聊天 `01a1cef8-5623-7222-8b94-df55d849951e`。聊天没有送达最终审计结论，不能把其中检查过程当作已验收。
- 当前分支 `codex/october-upgrade-p0`，HEAD `c0669e8058343f91deba8e468b03e4bf817b1ca5`。对比固定点 `1caa21a72a23d6f5166ed127847ca931374b890a`，并把当前未提交及未跟踪实现纳入审计。
- 需求优先级：`CLAUDE.md`所指的10月决策、整合升级计划，以及现行handoff和G1/G2/G3后补清单。
- 本次重新核对11月11日G4源码清单中的1,274个输入文件，全部匹配；没有文件缺失。故障出现在同一份已归档源码中。
- 两条审查轴分别检查代码规则与需求完成度；下列转写缺陷同时违反任务契约，仅计一次。

## 代码质量发现

### Q1 · P1 · 完成响应丢失后，归档Worker删除已经确认就绪的ZIP

位置：[publication-delivery-worker.ts:132](/Users/eat/Documents/eatpotato/saga传奇/packages/web/src/lib/server/publication-delivery-worker.ts:132)，尤其异常分支137–138。

触发过程：文件生成完成，`finish` RPC已经提交数据库`ready`，但返回响应丢失。Worker随后尝试`fail`；SQL只允许`running`且租约匹配的任务失败，该请求被拒绝并吞错，随后仍无条件删除整个产物目录。成功后的临时文件清理失败也进入同一危险分支。

相关SQL：[租约约束:93](/Users/eat/Documents/eatpotato/saga传奇/supabase/migrations/20261111000001_publication_delivery.sql:93)、[ready提交:119](/Users/eat/Documents/eatpotato/saga传奇/supabase/migrations/20261111000001_publication_delivery.sql:119)。`retry`只重新排队failed任务；同一来源指纹再次prepare仍返回原ready任务。

影响：数据库持续显示已就绪，ZIP文件已被删除，下载返回503，常规重试不能恢复。没有观察到原始媒体被删除；丢失的是已生成的归档成品。

最小复现已由主审重新运行：`dbStatus=ready`、`artifactBeforeCommit=true`、`artifactAfterCatch=false`，Worker返回failed。它运行实际生产Worker，数据库与PDF等IO边界为受控替身，SQL拒绝条件由现行迁移源码核对；不把此复现描述为真实网络故障或原生数据库故障注入。

修复方向：最终提交结果未知时先对账；将提交、失败登记和临时清理分开，只有确认当前尝试没有发布且不再被引用时才删除文件。

### Q2 · P1 · 一次确定未出站的Storage故障永久阻塞转写

位置：[story-transcription.ts:216](/Users/eat/Documents/eatpotato/saga传奇/packages/web/src/lib/server/story-transcription.ts:216)、[异常处理:246](/Users/eat/Documents/eatpotato/saga传奇/packages/web/src/lib/server/story-transcription.ts:246)。

代码先持久预留请求，再从Storage读取音频。如果读取返回503，供应商尚未被调用，异常分支仍不释放或终结预留。SQL的每故事唯一pending约束和读取逻辑拒绝后续请求；现有实现没有失败释放、取消或对账恢复操作。

主审复现：首次Storage失败，恢复Storage后重试仍为`transcription_pending`，总Storage请求1次，供应商请求0次。它运行实际`transcribeStory`并使用现有受控IO夹具，SQL持久约束另行核对。

这超出了后补清单承认的“供应商调用结果未知”：本场景能确定供应商根本未被调用。违反[任务契约](/Users/eat/Documents/eatpotato/saga传奇/docs/2026-10-10-integrated-upgrade-plan.md:258)的恢复要求。

修复方向：持久区分供应商调用前和调用后的状态；对确定未出站失败提供幂等、受控的恢复机制，对未知外部结果继续保持保守对账。

### Q3 · P1 · 依赖安全门失败

本次联网执行`npm run audit:high -- --json`退出1：**3 high / 26 moderate / 3 low / 0 critical，共32个受影响包条目**。high包括`follow-redirects@1.16.0`、`zod@3.25.76`，以及经zod传播的`openai@5.23.2`。这不是三条相互独立且已证实可利用的产品漏洞。

锁文件位置：[follow-redirects](/Users/eat/Documents/eatpotato/saga传奇/package-lock.json:10658)、[openai](/Users/eat/Documents/eatpotato/saga传奇/package-lock.json:14432)、[zod](/Users/eat/Documents/eatpotato/saga传奇/package-lock.json:18316)。[部署CI:57](/Users/eat/Documents/eatpotato/saga传奇/.github/workflows/deploy.yml:57)明确执行此门禁；`npm run verify`通过不包含该安全门通过。

公告证据：[重定向自定义凭证泄露](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p)、[Zod集合校验内存耗尽](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)。未执行自动依赖升级，也未证明这些公告路径在本产品中均可被利用。

## 需求完成度发现

### S1 · P1 · 正式AI提取、编辑和模型事实复核尚未接通

[主计划:280](/Users/eat/Documents/eatpotato/saga传奇/docs/2026-10-10-integrated-upgrade-plan.md:280)及T06–T08要求提取、编辑、证据复核基准和实际审阅链。

新建稿路径[SQL:394](/Users/eat/Documents/eatpotato/saga传奇/supabase/migrations/20261110000001_story_review_workflow.sql:394)把每段转写复制为`quote`，拼接正文、截取摘要。旧[Editor路由:81](/Users/eat/Documents/eatpotato/saga传奇/packages/web/src/app/api/agents/editor/process-story/route.ts:81)仍为`deterministic-editor-agent`，实际函数是trim、正则提取、文本截断。`provenance-editor`的执行调用出现在eval，未接入正式审阅生成流程。

已有转写、逐段审阅、署名和批准快照确实存在；这些不能替代原计划中的模型提取/编辑与模型复核。此项需要软件接线与契约实现，不能只列为真人评测或供应商账号后补。

### S2 · P2 · T10语义检索仍缺失

[T10要求:376](/Users/eat/Documents/eatpotato/saga传奇/docs/2026-10-10-integrated-upgrade-plan.md:376)包含全文和语义检索；当前[authoritative-search.ts:72](/Users/eat/Documents/eatpotato/saga传奇/packages/web/src/lib/server/authoritative-search.ts:72)固定返回`searchMode=literal`、`semanticSearch=unavailable_unmeasured`。字面检索、来源权限和原声定位已有实现，但不能将语义部分记为完成。

### S3 · P2 · D12到期提醒只有配置和日期

[D12:192](/Users/eat/Documents/eatpotato/saga传奇/docs/2026-10-10-upgrade-decisions.md:192)选择到期前90/30天提醒。当前[catalog.ts:34](/Users/eat/Documents/eatpotato/saga传奇/packages/web/src/lib/payments/catalog.ts:34)保存提醒数组，订单持久化起止时间；未找到消费这些日期的调度、提醒投递、幂等回执及重试链。需要补工程，不只是人工确认“是否收到提醒”。

T13人工录入账本符合计划允许的脚本入口；没有证据要求它必须自动遥测，因此不列缺陷。未发现值得单列的范围扩张或代码气味。

## 本轮重新执行的验证

| 检查 | 结果 |
|---|---|
| `npm run verify` | 退出0；类型与lint通过；181套/3,717项Web测试；187页构建 |
| shared测试 | 4套/16项通过 |
| infra测试 | 28项通过 |
| G3完整迁移＋Chrome | 672项断言通过，37个bootstrap/迁移文件，受测源码无漂移 |
| G4＋Chrome＋备份恢复 | 667项断言通过，37个bootstrap/迁移文件，受测源码无漂移 |
| 归档和转写故障注入 | 两个缺陷复现，见Q1/Q2 |
| npm依赖安全门 | 退出1，3 high |
| 11月11日源码清单 | 1,274文件全部匹配，无缺失 |
| `git diff --check` | 通过 |

首次沙箱内测试被Watchman权限、原生PG被共享内存权限、npm审计被网络权限阻止。随后经工具权限流程在沙箱外重新执行并取得上述结果；没有把这些环境限制列为产品缺陷。PG17.4运行时在本地重建，临时数据库均已关闭且连接清理完成。

本轮G3/G4仍采用合成身份、受控Auth/PostgREST/Storage/支付HTTP边界；这不证明真实托管平台、支付SCA、真人音频质量或手机行为。构建还存在旧Next配置及可选环境配置警告，成功构建不等于生产配置完整。

## 验收判断

- **本地基础设施和多数流程：已有实质交付，现有回归结果可信。** 不能概括为只做了计划或空壳。
- **整体升级：未完成。** S1–S3仍是原计划内的软件工作；没有依据给出可信的整体完成百分比。
- **当前质量：不通过最终验收。** Q1/Q2可在正常故障条件下损坏交付或阻断处理，Q3阻断现有安全门。
- **正式上线与公开收费：没有足够验收证据。** 人工项已有`waived_by_user`记录，可继续本地工程，但真实G2模型质量、G3真实设备/支付/托管及G4完整20–30户观察尚未通过。豁免不等于实测成功。

建议优先处理Q1/Q2并增加对应故障回归，修复依赖安全门；再补齐S1–S3或取得明确范围调整，更新handoff完成口径。真实家庭、设备、供应商及托管验证按既有后补清单继续，不重复请求已经给出的人工放行。

## 证据与工作区状态

- [全部验证日志](/tmp/saga-upgrade-audit-20261113/verify-escalated.log)
- [依赖审计原始结果](/tmp/saga-upgrade-audit-20261113/audit-escalated.json)
- [主审重跑的故障复现结果](/tmp/saga-upgrade-audit-20261113/failure-repro.log)
- [最小复现脚本](/tmp/saga-standards-proof.mjs)
- [源码指纹对照](/tmp/saga-upgrade-audit-20261113/source-comparison.json)
- [本轮G3回执](/Users/eat/Documents/eatpotato/saga传奇/docs/research/evidence/2026-11-11-g3-delivery/migrations-1794550131588-1361a7ed-42a5-4e01-873c-52fce1f98110/results.json)
- [本轮G4回执](/Users/eat/Documents/eatpotato/saga传奇/docs/research/evidence/2026-11-11-g4-pilot/migrations-1794550390727-3e62609d-e1bc-4907-be85-2284edd7978c/results.json)

没有修改产品源码、测试源码、依赖或现有交接文档。构建生成的`next-env.d.ts`已恢复本轮开始时的原始字节；既有未提交状态全部保留。测试脚本新建51个证据文件；本报告及额外日志在`/tmp`。没有暂存、提交、推送、远端迁移或部署。

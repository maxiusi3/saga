# G1：录音保存与恢复的可操作流程

本轮承接“继续推进 G1 下一步”。录音、重开恢复、继续保存、后台处理、确认唯一故事、播放及显式清理已在本地隔离环境贯通。修复后的完整仓库门禁与三套原生集成通过；整批审查及最后 SQL 校验修复的独立复审均已通过。**G1 整门尚未通过，正式关闭仍为 0/9。**

## 现在可直接看到的进展

| 用户操作 | 接手时 | 本轮已实现并实测 |
| --- | --- | --- |
| 中断后重开 | 草稿只能预览、下载 | 每条草稿可以“继续保存”，沿用原会话和已提交内容 |
| 保存录音 | 整文件上传、普通新建故事 | 分块核验、固定清单、后台处理、最终确认串联 |
| 查看进度 | 笼统的 Saving | 检查本地、上传核验、处理中、确认、已保存或可重试错误 |
| 响应丢失、重复保存 | 缺少故事幂等关联 | 同一会话只产生一个故事；预留、封口、确认三处丢失响应后均可重开恢复 |
| 运行后台处理 | 有 Worker 函数，缺启动入口 | `npm run worker:recordings` 自动领取任务，支持单次执行、连续运行和安全停止 |
| 回放已保存原声 | 新资产未接故事保存 | 故事使用稳定且受权限检查的回放地址，页面播放器实际播放通过 |
| 清理本机录音 | 没有完整确认与安全清理入口 | 故事确认后单独点击清理；删除事务失败完整回滚，重试才删除本机副本 |

[桌面保存结果](evidence/2026-11-05-g1-recording-flow/integrated-browser-1793929758961-97783f87-95d8-42ed-a730-278bccd1166d/saved-desktop.png) · [375px 手机宽度结果](evidence/2026-11-05-g1-recording-flow/integrated-browser-1793929758961-97783f87-95d8-42ed-a730-278bccd1166d/saved-mobile.png)。截图来自真实录音页面，合成麦克风输入；手机宽度截图不是 iPhone 真机验收。

在配置完成的应用中，操作顺序是：录音并完成，或重开后找到“本机录音” → 预览并继续保存 → 等待故事确认 → 播放已保存原声 → 按需清理本机副本。处理未完成时显示可继续检查的状态，不提供清理许可。登录账号或项目改变会取消旧范围内的保存操作。

## 如何运行与复现

Web 应用与 Worker 是两个进程。命令不会随网页自动启动，也不会自动读取 `.env`。需要明确配置服务地址、服务凭证、Worker 标识和 FFmpeg 路径；运行环境、变量、`--check`、`--once` 与停止行为见 [Worker 操作文档](../recording-worker.md)。`--check` 只验证本地配置、编译加载与 FFmpeg，不访问网络，也不证明云端凭证或数据库已就绪。

不连接真实服务即可复现本轮集成：

```sh
node experiments/recording-flow-browser/verify-server.mjs
node experiments/recording-flow-browser/verify-browser.mjs
node experiments/recording-flow-browser/verify-browser.mjs --interruptions
```

依赖现有本机 PostgreSQL17、Playwright Chromium、工作区依赖和 FFmpeg，具体边界见[夹具说明](../../experiments/recording-flow-browser/README.md)。它执行实际 Next 路由、Supabase JS、SQL、生产队列宿主、FFmpeg 和页面代码；登录、PostgREST/Storage HTTP 与麦克风是隔离适配器。没有云端部署、远端迁移、付费调用或家庭资料传输。

## 最终冻结源码的验证

| 验证 | 结果与原始证据 |
| --- | --- |
| 完整仓库门禁 | `npm run verify`、shared 测试、infra 测试全部退出 0；Web **159 套 / 3204 项**、shared **4 套 / 16 项**、infra **20 项**、**184 页构建**；[命令与 903 个源码指纹](evidence/2026-11-05-g1-recording-flow/final-gate-02.json)，[完整压缩日志](evidence/2026-11-05-g1-recording-flow/final-gate-02.log.gz)，无源码漂移 |
| 正常录音页面 | **310 条断言**：录完、刷新、找回、保存、实际播放、清理失败回滚与重试、手机宽度；[结果](evidence/2026-11-05-g1-recording-flow/integrated-browser-1793929758961-97783f87-95d8-42ed-a730-278bccd1166d/results.json) |
| 中断及响应丢失 | **341 条断言**：录制中刷新、断网、认证等待时切换账号、预留/封口/确认提交后截断响应、每次重开、重复保存、播放及清理；[结果](evidence/2026-11-05-g1-recording-flow/interrupted-browser-1793929758962-7260df22-824e-4ab0-98f1-b5fb43391537/results.json) |
| 实际服务端与 Worker | **723 条断言**：一故事确认与回放字节、数据库时钟上的租约过期、未派发可重试/已派发结果未知不重试、坏任务游标跳过、未来任务排除；[结果](evidence/2026-11-05-g1-recording-flow/integrated-server-1793929757727-7a493cbd-7e64-4219-95f3-d0aa3719e36a/results.json) |
| 确认 SQL 与应用校验一致性 | **1091 条原生断言**：88 个异常链案例全部在写入前拒绝、无清理回执且完整 story/intent 行不变；真实两次/三次尝试与幂等确认通过；[结果](evidence/2026-11-05-g1-recording-flow/native-1793929246225-f153d6c1-189c-460b-b827-6fb505ec038d/results.json) · [独立复审 Approved](evidence/2026-11-05-g1-recording-flow/reviews/final-fix-review.md) |
| 原生本机数据库与性能 | **15 个场景**，原生保存的 4/8/16 分块分别为 24/48/96 次摘要计算；三种晚到字节篡改拒绝，确认写入及清理失败回滚、跨标签页互斥通过；[验证源码归档](evidence/2026-11-05-g1-recording-flow/task-3-native-source/source-lock.json) |

三套最终集成运行均无源码漂移，浏览器无未处理页面错误及外部网络请求；临时浏览器、HTTP、PostgreSQL 与目录全部清理。构建仍有既有配置提示，不能据此声明生产配置合格。构建生成的已知 `next-env.d.ts` 引用已恢复，见[回执](evidence/2026-11-05-g1-recording-flow/next-env-restoration-02.json)。

独立审查发现并修复：数据库在拒绝损坏身份前写入 ready；每个分块反复整段哈希导致平方级字节工作量；375px 下长按钮溢出和清理后的错误保留文案；原生确认写入故障未准确命中目标。最终整批审查还发现历史尝试字段、编号、时间顺序及时间域校验遗漏；保存旧 SQL 的 RED 在 88 例中复现 35 个先提交后报错，修复后 88 例全部在写入前拒绝。完整权限、幂等、字节校验与事务回滚继续有效，失败日志未删除。

[最终回执](evidence/2026-11-05-g1-recording-flow/verification.json)关联新版 `02` 门禁、集成和源码归档；[原始整批审查](evidence/2026-11-05-g1-recording-flow/reviews/final-review.md)及[修复复审](evidence/2026-11-05-g1-recording-flow/reviews/final-fix-review.md)均保留。旧归档仍对应修复前源码，不计为最终 SQL 的通过证据。

## G1 仍有哪些 gap

[九项 gap](2026-11-02-g1-gap-register.md)是验收分组，不是九个等量开发任务，G1-01 的现状及下一步已同步更新。正式 0/9 只表示尚无整个验收分组关闭；本轮已完成上表的本地产品流程，尚未通过整门环境和设备验收。

- **G1-01：** 本地录音保存接线已贯通，仍需在可追溯测试环境复验。删除目标原子捕获、引用安全 GC、候选产物的备份/删除覆盖与完整迁移链还要继续工程验证。
- **G1-02：** 尚未部署或应用本轮远端迁移，需要专用测试环境、虚构家庭账号及对应授权。已有密钥或本地构建不代表环境验收完成。
- **G1-03–05：** 目标设备版本、5/20/30 分钟真实录音与故障矩阵、时长/分钟标记/末尾内容核听仍缺。这里的短合成音和原生 `requestData()` 后刷新只证明已落盘范围的恢复。
- **G1-06：** 部署态跨家庭权限、撤权和删除反例未收口；本地 SQL 与接口拒绝测试继续有效，但不能替代真实 Storage/SDK/运行中 Worker 的环境验证。
- **G1-07：** 完整原件档案及第二台设备断网打开、回听尚未验收。
- **G1-08：** 本轮证明 AI/访谈不可用时仍能保存原声；真实供应商失败组合、置信度及音频保存状态的组合验收仍缺。
- **G1-09：** 需要把上述必要案例和支持范围汇总并完成整门审查。

下一步可继续本地补录音候选产物的删除/备份覆盖与完整迁移链，不能把这些工程工作全部归为等待人工测试。真机麦克风、锁屏/来电、人工核听和第二设备操作，以及后续云端动作，按既有验收与授权范围分别推进。当前 `g1MilestoneSatisfied:false`、`pushConditionSatisfied:false`；未暂存、提交、推送或部署。

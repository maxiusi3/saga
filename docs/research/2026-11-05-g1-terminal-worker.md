# G1-01 Worker 接入原子终态

日期：2026-11-05（Asia/Taipei）。基线 HEAD
`c0669e8058343f91deba8e468b03e4bf817b1ca5`，分支
`codex/october-upgrade-p0`。续接聊天「33」明确的下一步。

## 状态

本地切片已完成。实现、定向验证、原生整链和完整仓库门禁均通过；Worker、
原生验证及整批最终独立审查均为规格 **Approved**、质量 **Approved**，无待修
发现。见[最终审查](evidence/2026-11-05-g1-terminal-worker/final-review.md)和
[最终回执](evidence/2026-11-05-g1-terminal-worker/verification.json)。
G1-01 仍为 partial，G1 未通过。

## 接线边界

新的单次 Worker 入口复用现有领取、输入核验、音频合并、候选上传和租约
监督，等所有本地清理、复查与心跳请求结束后，才调用原子发布接口。
发布成功直接返回严格终态回执，不再用“活跃租约检查”判断已结束的任务。

永久失败只允许已知处理错误在候选消费开始前产生，并且清理已结束、
最终租约检查通过。候选注册以后发生的错误、失租、取消、网络故障、
响应丢失均不转换成永久失败，不自动重试或删除副本。

## 本轮验证

- 新增 46 项终态行为测试，连同相关回归为 **7 套 / 303 项通过**。真实
  supervisor 和 finalizer 配合受控异步边界，检查清理、心跳排空、最后
  租约、取消和六种已知永久错误。缺少入口时的 RED 是模块解析失败、
  零测试执行；两次后续 fixture 导出 spy 错误已修正并保留原记录。
- 新原生整链最终 **8 场景 / 11,391 断言通过**，使用实际 Supabase JS、
  本地原生 HTTP、隔离 PG17.4、磁盘对象与 FFmpeg。成功、源 hash 损坏、
  解码时长超限、候选回读损坏、提交后响应丢失／坏回执、清理期间取消、
  发布前撤权均检查了实际任务／资产／attempt／会话元组与源副本保留。
- 最终原生运行捕获 **112 份源码、17 份编译模块**和 8 份音频／PG 日志
  产物。主代理已校验源码及压缩快照摘要；无源码／运行时漂移，HTTP 处理器、
  连接、文件、流、解码进程、PG 客户端／集群／socket 目录均已清理。
- 原生首轮撤权夹具注入过早，保留失败记录；修正时机后先定向通过再跑
  整链。macOS `/tmp` 与 `/private/tmp` 别名导致编译模块未归档的中间
  运行也保留；最终运行修复路径归一并实际归档了上述 17 份模块。
- 完整命令 `npm run verify && npm test --workspace=packages/shared -- --runInBand
  && npm run test:infra` 退出 0：Web **151 套 / 2,875 项**、shared
  **4 套 / 16 项**、infra **14 项**、**184 页构建**；类型和规范 lint 通过。
  两套历史 Worker 编译图通过，717 个受测源码摘要一致，next-env 恢复
  原字节。额外直接 workspace ESLint 调用在开始检查前报工具错误，已单独
  保留；规范 lint 成功，构建仍含既有配置提示，不声称无警告，未重跑 audit。

本地 HTTP 是 PostgREST 形状的替代实现，Storage 是磁盘与合成表组成的
测试夹具。以上结果证明本地真实字节／进程／事务接线，不能替代真实云端
Storage、认证／TLS、完整迁移链、长录音、真机中断和核听验收。

## 接手核验

- 上批封存的 717 个源码／文档摘要与接手时文件一致。
- 2,744 个既有证据文件摘要全部保持不变；旧实验未重复写入旧目录。
- 3,800 个接手路径无缺失，继承文件只修改候选准备入口、当前交接文档和
  文档索引。新增代码、测试、夹具、文档与证据另列。完整受测源码和最终
  原生快照一致，HEAD 未移动、暂存区为空，空白／冲突检查通过。
- 本轮继续使用包含前批未提交实现的现有专用分支；没有创建新检查点提交。

## 后续 G1 工作

- 专门的只读终态查询与响应丢失对账；客户端确认、幂等故事保存与本地
  副本清理仍需接线。终态会话继续不能通过旧 seal 重放来确认。
- 删除目标必须在建立墓碑后原子捕获；实际删除与候选 GC 需要完整引用
  检查。prepared 状态不表示候选可以被删除。
- 候选 bucket 的备份覆盖、完整迁移链、部署隔离、表级锁争用和大清单
  性能仍待验收。
- 真正 PostgREST／Storage、跨家庭权限、5/20/30 分钟真机录音、中断恢复、
  尾部核听与第二设备离线导出仍按原 G1 门槛收集证据。

所有回执保持 `canClearLocalDrafts:false`。不暂存、提交、推送、远端迁移、
部署、付费调用或外发家庭资料。

## 依据

- [设计](../superpowers/specs/2026-11-05-g1-terminal-worker-design.md)
- [实施清单](../superpowers/plans/2026-11-05-upgrade-g1-terminal-worker.md)
- [原子终态原语与前批验证](2026-11-04-g1-recording-finalization.md)
- [原 G1 Gap 清单](2026-11-02-g1-gap-register.md)
- 本轮通过 Context7 核对 Supabase JS 的 AbortSignal 传递与取消／重试
  选项；实际接线复用已测试的严格 finalizer，没有新增请求 API。
  [官方源码](https://github.com/supabase/supabase-js/blob/master/packages/core/postgrest-js/src/PostgrestTransformBuilder.ts)

# G1-01 原子发布与永久失败边界

开始于 2026-11-04，续行至 2026-11-05（Asia/Taipei）。基线 HEAD
`c0669e8058343f91deba8e468b03e4bf817b1ca5`，分支
`codex/october-upgrade-p0`。本报告只记录本地开发和隔离验证。

## 当前状态

本地切片已完成：数据库原语、严格调用端与候选指针读取兼容均已实现，
完整仓库门禁通过。数据库、应用层与整批独立审查均为规格 **PASS**、
质量 **APPROVED**，无待修发现。见[实施清单](../superpowers/plans/2026-11-04-upgrade-g1-recording-finalization.md)、
[最终审查](evidence/2026-11-04-g1-recording-finalization/final-review.md)及
[最终验证回执](evidence/2026-11-04-g1-recording-finalization/verification.json)。
G1-01 仍为 partial，整个 G1 尚未通过。

## 本批改变

`finalize_recording_job` 以一份活跃租约、固定输入和已准备候选为依据，
在同一数据库事务内发布资产、任务、尝试和会话。资产原地指向私有候选
对象，避免再进行一次可能结果不明的 Storage 写入。候选记录与原分块保留。

永久失败分支只接受现有处理错误类型中的六个确定代码，并要求整个 job
没有候选记录。通用异常、暂时故障、取消和结果不明不能记为永久失败。
更新影响行数和完整落库元组均须符合预期；等待和写入后的租约过期均回滚。

函数先取得删除请求表 SHARE 锁，再进入既有租约锁顺序。该锁与旧删除
写入自动持有的 ROW EXCLUSIVE 锁冲突，因此也能协调尚不存在的墓碑。
要求 READ COMMITTED，锁等待限制三秒。旧路径反向取锁可能导致安全的
死锁回滚；不能把超时或未知回执当作自动重试许可。

已发布候选通过共享谱系校验后才可用于回放和导出。读取要求候选、资产、
项目、会话、对象位置及内容元数据一致，并在签名/下载前后检查项目及会话
删除墓碑。旧 URL 解析和终态 seal 冲突规则保持原行为。

## 已执行验证

- 接手基线：6 套、377 项 Jest 通过，无受测源码漂移。
- 原生缺失函数 RED：实际 service-role 调用返回 42883。
- 原生 SQL GREEN：15 场景、492 断言；166 次完整元组比对、20 次原生锁
  等待，覆盖原子回滚、候选校验、删改并发、撤权、过期、权限和 seal 冲突。
- 应用最终定向：16 套、677 项 Jest 通过；Web 类型检查与旧 Worker 编译
  依赖图兼容检查通过。
- 原生 Supabase JS + 本地 HTTP + PostgreSQL：8 场景、278 断言、13 请求，
  覆盖发布、六类永久失败、提交后坏回执/响应丢失、提交前后取消、超时回滚
  与候选存在时拒绝永久失败。每次调用只发送一次请求。
- 完整链 `npm run verify && npm test --workspace=packages/shared -- --runInBand
  && npm run test:infra` 退出 0：Web **150 套 / 2,829 项**、shared **4 套 /
  16 项**、infra **14 项**、生产构建 **184 页**；类型检查、lint 通过。
- SQL 21 份、HTTP 25 份源码及压缩快照已由主代理重新验 hash；临时数据库、
  HTTP 处理器/连接、目录、socket、PID 全部清理。完整门禁受测源码无漂移，
  构建产生的 next-env 单行新增已按接手原字节恢复。
- 2,542 个既有证据文件、1,471 个历史保护输入 hash 未变；688 个受测源码
  hash 与最终门禁一致。HEAD 未移动，暂存区为空；新源码与文档均通过
  空白/冲突标记检查，最终完整性及源码锁定清单随验证回执封存。

时区观测夹具、JSON 参数夹具的中间失败与触发器篡改 RED 均保留；不覆盖
旧日志或将失败改写为通过。构建沿用现有配置/key 提示，未重跑 audit。
本批 HTTP 是 PostgREST 形状的本地替代实现，没有读取 Storage 音频字节。
详见[证据目录](evidence/2026-11-04-g1-recording-finalization/README.md)。

## 必须继续的工作

- Worker 必须在 verifier 清理、复查和心跳排空后调用终态接口；当前旧
  回调之后还有活跃租约检查，不能直接在回调内发布。下一批从
  `prepareLeasedRecordingJobCandidate` / `withRecordingJobLease` 的返回交接
  入手，分别设计成功发布与确定永久失败的编排；结果不明仍保留副本。
- 已发布会话不能再次 seal；需要专门的只读终态查询、响应丢失对账、
  客户端确认与幂等故事保存，才能考虑安全清理本地副本。
- 旧删除路由在墓碑前捕获对象路径，可能落后于指针发布；需原子捕获
  权威删除目标，完成实际执行与引用安全的 GC。不能仅凭 prepared 状态删候选。
- Scheme-B 备份 allowlist 尚未包含候选 bucket；迁移/恢复、备份/删除与部署
  必须一起验收。表级锁的跨项目争用及大清单性能尚未压测。
- 原生 PG 测试使用合成身份与 Storage 表，不是云端 Storage、真实
  PostgREST、完整迁移链、真机长录音或内容核听资格。

所有终态回执继续 `canClearLocalDrafts:false`。`g1Item01Complete:false`、
`g1MilestoneSatisfied:false`、`pushConditionSatisfied:false`。未暂存、提交、
推送、远端迁移、部署、付费调用或外发家庭资料。

## 文档依据

- [本批设计](../superpowers/specs/2026-11-04-g1-recording-finalization-design.md)
- [PostgreSQL LOCK 与 READ COMMITTED](https://www.postgresql.org/docs/17/sql-lock.html)
- [PostgreSQL 锁冲突表](https://www.postgresql.org/docs/17/explicit-locking.html)
- [Supabase JS 重试行为](https://supabase.com/docs/guides/api/automatic-retries-in-supabase-js)

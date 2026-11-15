# G1-01 Worker 私有候选音频持久化

开始日期：2026-11-03，续接验证：2026-11-04（Asia/Taipei）。基线 HEAD：`c0669e805`，承接未提交的输入核验与租约实现。
负责人已在聊天「31」确认候选持久化边界，本次继续实现；不扩大为 ready 发布或客户端清理。

## 实现边界

- 正式 `recording_output_candidates` 账本按 job/attempt 唯一，固定 worker、输入摘要、候选地址和完整输出元数据。专用 RPC 在同一事务调用原 lease check，只有有效 running fence 可以 reserve/prepare；直接写权限不开放给 service role 或客户端。
- 私有 `recording-candidates` bucket 与客户端 restrictive policies；服务端生成 UUID 地址。上传前先登记，POST 禁止覆盖，完整回读比对字节数与 SHA-256 后才登记 prepared。不采信上传响应正文的地址，也不覆盖预登记原件地址。
- 新 `recording-candidate-worker.ts` 复用租约监督器；合并文件只在 scoped consumer 内存在。上传、回读、准备和最终复查期间续租，失租/取消/超时中止并等待本地流、解码器及临时资源清理。
- 未知登记、上传或 prepare 回执不自动重试、不删除或复用候选。候选身份在父记录删除后仍保留，等待将来明确的对账与删除策略。
- **prepared 不是云端最终确认**：job 仍 running，asset 仍 verifying，session 仍 sealing；`canClearLocalDrafts:false`。本批没有 ready、成功/失败终态、常驻调度器、客户端接口或草稿清理接线。

## 验证与修复

- RPC、流式 Storage 和 scoped worker 均保留先 RED 后 GREEN 的回执。应用初次扩大定向 6 套 / 374 项通过；类型检查发现的 TS2366 控制流问题已修正。
- 独立规格审查发现 PostgreSQL 微秒时间被 `Date.parse` 截断，能接受不足一毫秒的倒序 preparedAt。回归 RED 明确复现，现使用整数微秒比较；修复后原编译探针、6 套 / 376 项、类型检查与 lint 通过。
- 自查发现新候选依赖会破坏原 Worker 实验的固定编译列表，已保留 MODULE_NOT_FOUND RED；候选入口拆为独立模块，旧只读入口的依赖图恢复，未改写旧实验或旧证据。
- SQL 初次 14 场景 / 395 断言通过，但独立审查又发现跨 job 同候选 ID 的未提交唯一索引等待能越过租期。真实 `transactionid` 等待 RED 已保留；写入后再次检查数据库时钟，过期抛错回滚，修复后 **15 场景 / 426 断言**，包含未过期回滚后成功、提交后冲突等对照；审查员独立复现修复后的拒绝与零写入。
- 原生 HTTP 集成发现 POST 成功后的 unread ack 被先 abort 再 cancel，导致无法开始回读。已补真实 loopback HTTP Jest RED，改为先取消响应体、再在 finally 中终止 scope/关闭本地流。最终定向 **6 套 / 377 项**通过，独立规格复跑受影响 4 套 / 130 项。
- 最终真实本地 PostgreSQL / 原生 HTTP / FFmpeg 集成 **31 场景 / 21,697 断言**通过，包括 16 个应用场景、两次实际 SIGKILL。健康路径 26 次心跳跨越最初 1 秒租约；完整 bytes/hash、丢失回执、损坏回读、撤权/取消和资源清理均核对。31 项源码快照与当前文件一致；强杀遗留文件由隔离实验父进程清理，不冒充线上自动清理。
- 完整门禁 exit 0：Web **148 套 / 2672 项**、shared **4 套 / 16 项**、infra **14 项**、构建 **184 页**。兼容探针、类型检查和 lint 通过；源码前后无漂移，`next-env.d.ts` 仅已知生成 import 恢复原字节。audit 未重跑，既有可选配置警告保留。
- 独立规格审查 **PASS** 后独立质量审查 **Approved**，无待修阻塞。质量审查员独立复跑定向 **6/377** 和完整原生集成 **31 场景 / 21,682 断言**，并重核两轮源码/日志与清理（断言数随真实心跳变化，场景不减少）。2,285 个既有证据与 1,471 项历史输入未变；详见[证据索引](evidence/2026-11-03-g1-worker-candidates/README.md)，中间失败全部保留。

## 未完成边界

不存在 tombstone 的读取仍不是原子发布屏障；Storage 与 PostgreSQL 不是一个事务。取消 HTTP 不证明远端提交被撤销；进程强杀不会执行 finally，隔离实验的父进程清理不能冒充线上自动恢复。

真实 Supabase Storage/RLS/TLS、完整远端迁移链、新 bucket 的备份/删除覆盖、真机长录音与尾部核听、FFmpeg 部署隔离、大清单复查开销均未验收。历史备份清单与旧观测不因新 bucket 被重新解释为完整。

下一步仍为候选到原件的原子发布和失败终态，并统一撤权/删除屏障；随后才接客户端 seal/status、持久确认与安全清理。

`g1Item01Complete:false`、`g1MilestoneSatisfied:false`、`pushConditionSatisfied:false`。
本批不暂存、提交、推送、合并 main、远端迁移、部署、付费调用或外发家庭资料。

本地候选持久化切片已完成；不能将本地切片、完整测试门禁或独立审查通过冒充 G1 通过。

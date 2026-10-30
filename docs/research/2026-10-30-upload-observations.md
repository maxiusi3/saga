# 可靠上传客户端回报观测

日期：2026-10-30（Asia/Taipei）。基线：`d13d55ab0`，分支：`codex/october-upgrade-p0`；接手时本地领先已有远端跟踪记录 5 个提交，本批未刷新远端。范围是综合计划 §11 的项目中心音频 PUT 诊断切片，不是全部上传通道、生产部署覆盖或原 G0–G4 验收。

**状态：本批完成，规格 PASS、质量 Approved、独立收口 PASS，验证汇总见 [verification.json](evidence/2026-10-30-upload-observations/verification.json) 为准。** Task 1 独立规格/质量 PASS 已核对；Task 2 唯一规格问题已修复，前后媒体 guard 基础设施故障统一脱敏为 503，合法权限/状态拒绝保持。规格复审 PASS、质量 Approved，修正后完整验证通过；首轮与修正版证据分开保留。

## 断点续接

中断时 Task 1 的新迁移、隔离 PG runner、infra 清单与独立审查已完成，Task 2 尚未落代码。本轮核对继承的来源/日志哈希和保护输入，从 HTTP、客户端与 v3 接线继续，没有重做 SQL 或覆盖旧证据。

接手完整性见 [resume-integrity.json](evidence/2026-10-30-upload-observations/resume-integrity.json)；继承的 Task 1 实测见 [sql-verification.json](evidence/2026-10-30-upload-observations/sql-verification.json) 和 [task1-review.md](evidence/2026-10-30-upload-observations/task1-review.md)。新复跑使用同一冻结 SQL/runner，而不是将历史结果改写为本轮运行。

首次暂存检查发现本批新 runner 末尾多一个空行，仅删除一个换行字节，未改变可执行文本或 SQL。原始 runner 字节、前后哈希见 `task1-format-correction.json`；修正后再次运行正常/污染环境，各 14 场景/631 断言通过，见 [final-pg-verification.json](evidence/2026-10-30-upload-observations/final-pg-verification.json)。此前来源冻结和实测均保留不改写，最终来源以 `source-hashes.json` 为准。

## 本地实现

### 持久账本与受限回报

- 新增本地迁移 `20261030000001_upload_observations.sql`，账本仅有随机 attempt UUID、`binding_hash`、有限状态与数据库起止时间；终态不可覆盖、记录不可删除。RLS/ACL 阻止应用角色直接写，service_role 通过受限 RPC 登记/完成，幂等与并发冲突分别处理。
- begin/finish RPC 只接受固定参数，回执严格匹配 `{schemaVersion,attemptId,state}`；每次单 RPC、5 秒截止且禁重试。异常、错回执或无法确认结果均保留未知，不自动重放写入。
- 新 `POST /api/media/assets/[assetId]/upload-attempts` 沿用精确媒体开关、服务端身份、已加载原音频资产和当前媒体 guard，在 RPC 前后核对权限/资产/删除台账；保留 no-store 与刷新 cookie。begin 仅适用于 `pending_upload`；finish 不修改媒体状态，不签发 Storage 凭据，也不代替 complete。
- 服务端产生随机 UUID 和 32 字节报告 token，按已加载资产 ID、已认证用户 ID 与 token 的 JSON 数组计算 SHA-256；只有 hash 入账。原始 token 仅供客户端内存回报，不写日志/localStorage；不能用其他用户或资产完成该报告。

### 客户端闭环与取消

`importProjectAudio` 仅在确实需要 `pending_upload` 非覆盖 PUT 时创建尝试；跳过 PUT 的 uploaded/verifying/ready 幂等重放不捏造观测。

顺序为：严格确认 begin → 检查取消 → SDK 非覆盖 PUT → 按实际 SDK 结果记录 outcome → 独立限时确认 finish → 检查调用者取消 → 原 complete。观测 HTTP 的认证 token 获取、fetch 与 body 合计受 20 秒截止保护，包括忽略 abort 的 Promise；begin 继承调用者取消，finish 使用独立截止。

开始回执未知则零 PUT，完成回执未知则零 complete；不会把观测失败吞掉或自动重试未知写入。调用者继续持有原 File 和幂等键供显式重试。PUT 前取消可报 `client_cancelled`；SDK 已成功时，即使调用者同时取消，也仍报 `client_succeeded` 后停止业务后续。明确重复对象错误记 conflict，不冒充新对象成功；已知 SDK 失败须先确认 finish 才传播，未知回执优先返回安全观测失败。

### v3 指标与覆盖

- 无参数只读 invoker v3 组合旧 v2，不修改旧迁移/函数；解析保留旧导出验证，严格检查版本、精确键、安全整数、时间/微秒边界、新鲜度和计数关系，无 fallback。
- scope 固定 `project_hub_audio_put_reports`。60 分钟完成窗中 evaluated 为 succeeded/failed/conflict，failures 仅 failed；cancelled 单列并排除于分母。有效 started 全局计 unsettled，畸形数据单列 invalid。
- 窗口不足、unsettled 或 invalid 时上传率不可用，不把局部完成的分母当成全部尝试。可计算时仍用既有阈值，告警文案明确 `Client-reported`；状态重算保留实际告警优先级。
- `windowComplete` 只说明台账 epoch 已满 60 分钟，不证明滚动部署或旧客户端覆盖；始终保留 `upload_collection_coverage` 缺口和 partial 覆盖，按情况补窗口/结果完整性缺口。管理端仍 `503 not_ready`，实际告警投递/响应人和供应商资格仍不可用。

## 验证与证据

| 验证 | 已取得结果与适用快照 |
| --- | --- |
| 继承 Task 1 | SQL 初始缺 RPC RED 与 epoch 边界 RED 保留；最终 PG 14 场景/631 断言和 infra 7 项通过，独立规格/质量 PASS；本轮核对来源与日志哈希 |
| 本轮 PG17.4 正常/污染复跑 | 各 14 场景/631 断言、退出 0；来源 hash 一致，socket/目录/PID 退出后清理核对通过，污染的 13 个 PG*/DATABASE_URL 环境键被清除 |
| Task 2 RED | RPC/新路由缺件、客户端顺序/取消/截止、HTTP 200 与时间边界等失败保留；详见实现报告，不把早期失败删除或包装成通过 |
| Task 2 首轮定向 | 审查修正前 20 套/599 项，web type-check/lint 均退出 0 |
| 首轮完整命令链 | 审查修正前 `npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra` 退出 0；Web 135 套/2017 项、shared 4 套/16 项、infra 7 项、184 页 |
| 保护输入 | 1471 项旧证据/实验/迁移/依赖等输入未变；构建产生的 `next-env.d.ts` 恢复继承的原始字节 |
| 规格修正 RED/GREEN | guard 故障映射 RED 为 32 失败/71 通过；修正后 6 套/316 项、web type-check/lint 通过；独立规格复审 6 套/312 项通过，唯一 P2 关闭 |
| 修正后完整命令链 | 同一 verify/shared/infra 命令链退出 0；Web 135 套/2065 项、shared 4 套/16 项、infra 7 项、184 页；来源 hash 与 next-env/1471 保护输入再次核对通过 |
| 独立质量 | Approved；独立 13 套/510 项及 14/14 SDK/迟到结果探针通过，无待修发现；独立收口 PASS |

证据入口为 [README](evidence/2026-10-30-upload-observations/README.md)、[resume-pg-verification.json](evidence/2026-10-30-upload-observations/resume-pg-verification.json) 和 [Task 2 初次冻结报告](evidence/2026-10-30-upload-observations/task2-implementation-report.md)。原始/修正后的 Task 2 冻结分别记录在 `task2-source-freeze.json` / `task2-source-freeze-revised.json`，最终实现范围按 `source-hashes.json` 核对。规格复审、质量及收口记录已封存，初次冻结报告的 pending 与计数仅代表其生成时点。

原始输出通过 `log-hashes.json` 的 `raw/*.log.gz` 映射保留，`.txt` 统一换行、移除行末空白及首尾空行，非空文本补一个末尾换行，以便阅读。未压缩 `.log` 是被忽略的本地原件；历史 `sql-verification.json` 中的文件名/哈希保持原样，提交后按日志映射定位可验证的原始字节，不要求 checkout 含 `.log`。

## 限制、里程碑与下一步

客户端回报不可信，只用于诊断：started 可能是 begin 后、PUT 前崩溃；失败/未知不能证明对象不存在；成功也不证明真实 Storage 接收、hash/解码、最终保存或权限成立。它既不授权、不改变资产校验标准，也不代替现有 verifier。

PG 使用合成四表 DDL 和真实本地 PG17.4；Jest 使用合成 Auth/Supabase/Storage 边界。两者不证明完整远端迁移链、PostgREST、真实存储/设备、规模性能或账单；全局 unsettled/invalid 历史扫描的生产增长与保留策略仍未验证。现有 guard 是跨查询重新授权而非原子撤权，已签发链接/token 与原 TTL 不变。

构建保留 Next 旧 `eslint` / `images.domains` 配置提示及缺少 `SUPABASE_SERVICE_ROLE_KEY` 诊断；退出 0 不等于生产环境合格。audit 本轮未重跑。

原门槛逐项依据见 [milestone-basis.md](evidence/2026-10-30-upload-observations/milestone-basis.md) 和 [milestone-check.json](evidence/2026-10-30-upload-observations/milestone-check.json)。供应商账户能力、区域和数据条件未核实，单此缺口已足以阻止新增完整 G0 结论；不把 G1 真机、G3 家庭体验或 G4 成熟纵向样本擅自加进 G0。原 G0–G4 各自仍缺完整证据，本地上传切片不触发用户的里程碑条件推送。

本批实施、验证与独立收口均已通过，只创建本地检查点。下一批直接推进部署采集覆盖证明、实际告警投递/响应人和供应商核验链，不重做上传诊断或 Task 1 SQL。解码音频/持久大包 Worker、真实设备/家庭/模型及成熟纵向试点分别推进。保持不合并 main、不执行远端迁移/部署、不外发真实家庭资料；真实方案 B 备份恢复仍须负责人明确指令。

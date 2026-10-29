# 数据库运营指标接入记录

基线：`287b32c5a`，分支 `codex/october-upgrade-p0`。范围为主计划 §5.3 / §11 的数据库观测切片；[实施清单](../superpowers/plans/2026-10-29-upgrade-operational-snapshot.md)与[验证汇总](evidence/2026-10-29-operational-snapshot/verification.json)为续接入口。

## 断点与交付

双入口集成已提交，本批从新增适配器测试 RED 继续，未重复旧接线。初始 type-check/lint 通过不代表新测试通过：新模块缺失，原告警函数把 null 当零并返回 healthy。先保留失败，再实现严格适配器、部分覆盖告警与管理路由。新 SQL 同步 infra 迁移清单。

`read_operational_snapshot()` 是零参数 SQL/STABLE/SECURITY INVOKER 函数，固定 search_path，只给 service_role EXECUTE。单语句从正式 P1 表聚合、数据库生成 UTC 观测时间；输出只含版本、时间、计数/金额，不含家庭正文或业务 ID。完整算法、真实角色与异常注入边界见[实验说明](../../experiments/pg17-operational-snapshot/README.md)。

- 任务：到期 queued/retry_wait 按创建与可运行时间的较大值计算积压；缺失/到期租约、未知执行结果记停滞；人工核对等待与未来排期不误报。
- 成本：终态取已结算值，活跃态取预留/已结算较大值，包含失败/取消费用；按项目累计后向上取整到分，再取最大值。未知应有费用单独计数，已知值只是下界，不是供应商完整账单。
- 删除：未完成请求严格超过 168 小时才超期，完成请求排除；无效状态/时间单独计数。DST 测试先失败，再把日历 7 天改为实际 168 小时。
- 适配器：单 RPC、禁重试、5 秒截止和调用者取消；严格 allowlist、非负安全整数、时间最长 60 秒/未来容忍 5 秒。格式不符、过期、缺配置/迁移/权限或请求中断都失败关闭，错误不透传。
- 管理接口：媒体精确开关与 cron secret 在 DB 前，所有响应 no-store。有效组可报警，无效组不可用；成本预算仅取 `OPERATIONAL_PROJECT_COST_CAP_CENTS`，非负整数美分，缺省不发成本超限判断。未知成本仍可按已知超限下界报警，但不声称完整。

## 验证与证据

定向 Jest 3 套/62 项、type-check/lint 通过。PG17.4 正常/污染各 15 场景/251 断言，主流程独立重跑同样通过；源/报告哈希一致，实际 socket、临时目录与 PID 已确认不存在。使用四张正式 P1 CREATE TABLE 块和最小合成前置表，非完整迁移链或真实 PostgREST 验收。

最终完整验证执行 `npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra`，退出码 0：Web 131/1706、shared 4/16、infra 7、184 页构建。独立规格与质量审查均 PASS，无待修项；各自重跑定向 62 项通过。最终命令日志、审查记录与完整性封存见验证汇总。

保留初始缺 RPC、适配器、路由、宽松日期解析与 DST 的真实失败证据，失败文件不是未修复结论。infra 首次因预期迁移文件尚不存在而失败，仅有执行时工具记录、无独立日志；归档的 infra 日志是 GREEN。`--without-migration` 是故意跳过迁移的可重复 RED，必须退出 1。已归档终端日志以 gzip 保存并记录 SHA-256；可读副本只规范行尾/尾空格。源码、历史保护输入与证据各自有哈希清单。

构建仍提示旧 Next 配置以及缺 `SUPABASE_SERVICE_ROLE_KEY`；本轮未补真实密钥、未部署，audit 未重跑。构建生成的 next-env 按授权恢复原字节。

## 就绪度与下一步

顶层始终 HTTP 503 / `not_ready`。上传失败率、导出损坏事件无可靠源，继续不可用；告警角色只是名义角色，实际响应人/投递未核实。供应商仍 blocked_by_policy，配置 API key 不证明账户/区域/保留/训练退出资格。空数据库返回真实零台账，但健康报告不变成完整 healthy。

本批只完成本地数据库观测工程检查点。下一步是上传尝试与导出完整性事件的可靠持久采集、告警责任人/投递验证及供应商资格链；并按既定顺序推进解码/大包 Worker 与真实设备/家庭/模型/纵向试点。生产规模下查询延迟、PostgREST 暴露/授权和外部账单完整性尚未验证。

不宣称原 G0–G4 新增通过，不触发原计划条件推送；不合并 main、不远端迁移/部署、不外发真实家庭资料。方案 B 真实备份恢复仍需负责人指令。

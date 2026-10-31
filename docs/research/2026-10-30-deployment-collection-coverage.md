# 部署采集覆盖证明（本地切片）

日期：2026-10-30/31。基线 `2b146ad1b`。范围：把“台账年龄”与“采集构建覆盖”分开记录，是本地可验证切片，不是真实部署覆盖证明或 G0–G4 验收。

## 实现
- 迁移 `20261030000002_deployment_collection_coverage.sql`：`deployment_collection_coverage`（按域封存发布哈希与数据库切流时间）、`archive_attempt_builds`、`upload_attempt_builds`（不可变构建归属）；`seal_deployment_collection_coverage`、`begin_archive_assembly_attempt_v2`、`begin_browser_upload_attempt_v2`、只读 `read_operational_snapshot_v4`（组合原 v3，`windowComplete` 语义不变）。RLS、service_role 仅 SELECT/EXECUTE。迁移不预填任何切流记录。
- 服务端：`OPERATIONAL_COLLECTOR_BUILD_HASH` 未设置沿用旧 v1 写入（计入未归属）；非法值直接失败关闭；设置合法值走 v2 归属。`sealDeploymentCollectionCoverage` 单次有界 RPC、不重试。
- 解析：严格 v4，拒绝自相矛盾载荷（未封存却有匹配、切流标志过期、完整标志与缺口不符、归属总数与台账不符），不回退 v3/v2。
- 健康：导出归属不完整或读取端无/不同构建身份时记 `export_collection_coverage`；上传同条件抑制失败率分母；`upload_collection_coverage` 始终保留，管理端仍 `503 not_ready`。

## 评审修正
质量审查指出未配置构建身份的读取端会被当成匹配，已先写 RED 再修为必须已配置且与封存哈希一致。

## 验证
见 [verification.json](evidence/2026-10-30-deployment-collection-coverage/verification.json)：PG17.4 正常/污染各 12 场景/717 断言；Web 136 套/2103 项、shared 4/16、infra 7、构建通过。

## 未证明
- 封存只是运维断言，不证明旧实例已退役；未做真实切流封存，生产无任何封存记录。
- 仅覆盖 begin 之后的项目中心音频 PUT 与同步导出；其他上传通道、begin 前崩溃未覆盖。
- 已知小项：并发不同哈希封存可能因触发器回退保护返回 23514（失败关闭，可重试）；遗留 v1 开始的尝试经 v2 重放会永久不匹配，需运维结案；v4 对全构建表全表扫描，规模未验证。
- 生产要让导出/上传显示覆盖，需先设置 `OPERATIONAL_COLLECTOR_BUILD_HASH` 并由负责人封存——未执行。
- 告警投递/响应人、供应商账户/区域/数据条件、真机/家庭、audit 未重跑，均仍未验收。不合并 main、不远端迁移/部署、不推送。

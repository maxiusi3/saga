# T03 续批：动作权限、用途同意与删除墓碑

日期：2026-10-14（Asia/Taipei）。承接 [P1 契约](../specs/2026-10-13-upgrade-p1-contracts.md) 第 5 节。

本批只固定可独立验证的纯函数，不创建 `consent_records`、`deletion_requests` 或 `deletion_targets` 迁移，不接入正式路由、Storage RLS、远端数据库、供应商或真实家庭资料。远端 schema 与权限仍需只读证据后才能设计 adapter。

## 允许范围

- 项目动作按 active membership、角色、项目 owner 和故事归属判断；未知角色、失效成员和缺省条件全部拒绝。
- 用途同意按 grantor、subject、purpose、policy、provider/region 和生效时间精确匹配；撤回时间到达后立即失效。
- 删除请求创建即产生墓碑并阻断新访问/处理；目标只有明确 `deleted` 或 `not_found` 才能完成。
- 删除失败保留墓碑并可重试；备份恢复后可重新应用墓碑，不能因恢复数据而重新开放访问或处理。

## 不在本批

- 数据库原子更新、RLS、已签发 URL 即时撤销、供应商删除确认、备份保留和物理对象删除。
- 正式路由切换、现有故事/图片删除入口改造、用途同意 UI 或生产文案。
- 任何把本地 helper 解释为远端表已部署或 G1/G0 已通过的结论。

## 出口

- [x] 先写并观察权限、同意、删除状态和输入快照测试 RED。
- [x] 实现最小纯函数并通过定向测试。
- [ ] 运行类型、lint、全量 verify，恢复生成文件并检查差异。
- [x] 更新 T03 记录、综合计划、handoff 和文档索引，写清数据库/RLS/供应商边界。

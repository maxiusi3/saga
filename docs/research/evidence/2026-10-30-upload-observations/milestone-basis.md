# 原里程碑判定依据

本轮用户授权：继续升级计划，完成后更新 handoff；**达成计划里程碑并完成 P0 修复时才推送 GitHub**。本文件固定判定依据，不把新增本地切片自行命名为新的原计划里程碑。

判定标准是 `docs/2026-10-10-integrated-upgrade-plan.md` §7.1，当前执行口径以 `docs/HANDOFF-2026-10-13-upgrade.md` 页首为准。10 月 24 日历史“G0–G4 全通过”记录已在后续 handoff 纠正，不能用历史标签代替本轮证据。

| 原 G0 条件 | 已有证据及边界 | 本批是否补齐 |
| --- | --- | --- |
| 实际资产路径与权限明确 | 已有真实元数据/路径对账及本地 PG/媒体 API 修复；真实 Storage 私密读取、JWT/RLS 等仍未验收。10 月 23 日用户回传的 Public 桶信息是历史快照，本批没有刷新远端状态 | 上传诊断账本不能证明真实媒体私密性 |
| 迁移回滚可行 | 已有本地方案 B 演练；真实环境备份/恢复执行仍须负责人指令 | 新迁移仅本地候选，不能新增真实恢复证明 |
| D01–D08 前置项、D12 数据边界、D13 验收定义已决定 | D01–D16 全 A 及契约/质量门定义已记录 | 保持既有决定，不新增或降低门槛 |
| 选定供应商账户能力/数据条件核实 | 已有公开文档与候选配置不等于账户资格；当前管理路由仍明确 trainingOptOutConfirmed/zeroDataRetentionConfirmed=false，provider probe 被策略阻断 | 本批没有账户/区域/保留与训练条件的新实证，因此不能确认此条件完成 |
| 用户旅程原型可评审 | 已有双入口原型/接线及合成浏览器证据 | 保留已完成部分，不把它当成真实家庭观察 |

仅供应商账户/数据条件未确认，就足以阻止宣布本轮已新增完整 G0 证据；不需要把 G1 真机、G3 家庭体验或 G4 成熟纵向样本擅自加入 G0。G1–G4 各自仍按原门槛验收，本批上传客户端回报不替代其中任何实测。

参考：`docs/research/2026-10-11-provider-readiness.md`（有日期的历史候选核查）、`docs/research/2026-10-23-supabase-user-feedback.md`（历史真实回传）、当前 `packages/web/src/app/api/admin/cutover-readiness/route.ts`、`docs/research/evidence/2026-10-30-media-revalidation/milestone-check.json`。没有在本批登录供应商、查询真实家庭资料、执行远端迁移或部署。

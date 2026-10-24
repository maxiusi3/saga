# 10 月 15 日远端只读证据补核

本轮补核 GitHub 与 Supabase 项目元数据，未执行远端迁移、部署、对象盘点或家庭正文读取。脱敏原始结果位于 [evidence/2026-10-15-readiness-refresh](evidence/2026-10-15-readiness-refresh/summary.json)。

| 项目 | 本次结果 | 可以支持的结论 |
|---|---|---|
| GitHub 仓库 | `maxiusi3/saga`，远端 `https://github.com/maxiusi3/saga.git` | GitHub 只读查询恢复可用；此前 EOF 是历史失败 |
| 最新工作流 | [37647995510](https://github.com/maxiusi3/saga/actions/runs/37647995510)，commit `1caa21a72a23d6f5166ed127847ca931374b890a` | CI 在 Dependency audit 失败；工作流内迁移与生产 Web job 跳过，不能称完整流水线通过 |
| Vercel 单独部署记录 | GitHub deployment `6914532226` 为 success，指向 `https://saga-5xypp8kxj-fangzero-3350s-projects.vercel.app` | 已取得该次部署状态；没有核验当前 production alias、项目设置、环境变量或本地未提交代码部署 |
| Supabase 项目 | 已有 CLI 会话成功返回 `encdblxyxztvfxotfuyh` / `saga` / `us-east-2` / `ACTIVE_HEALTHY` | 项目身份与区域已有实际 API 证据；不能据此推定表、RLS 或 bucket |
| 数据库查询 | 只读 SQL 尚未执行，CLI 先初始化登录角色，返回 PostgreSQL `42501` 权限错误 | schema/history/RLS 仍未取得；停止重复该路径，不修改角色或权限 |

`SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_ACCESS_TOKEN`、`SUPABASE_DB_PASSWORD`、`DATABASE_URL` 在本次检查范围均未配置。已有 CLI 项目会话可用与这些变量缺失并不矛盾。没有保存任何凭据；CLI 原始错误含临时密码校验材料，证据只保留错误分类和 SQL 未执行的事实。

本地可执行 Node 22.22.2、PostgreSQL/psql 14.17，Docker 不可用。可用本次专属 Unix socket 临时集群验证 T05 持久任务，不需要借用已有数据库或猜测生产 schema。实验与远端资格分别记录。

后续先取得合法的 schema/history/RLS 只读访问路径，再对照根 migrations、Storage bucket/权限和备份恢复证据。GitHub 的 Dependency audit 失败也须在里程碑推送前定位到具体依赖并处理。G0/G1 尚未通过，本次没有提交、推送、生产迁移或部署。

补读该次 CI 失败日志：10月7日 audit 步骤报告 **58 项（17 moderate / 40 high / 1 critical）**，涉及 Next、PostCSS、sharp 等。此为历史锁文件/公告下的报告，并非10月15日当前依赖重新扫描；抽样和来源见[audit摘要](evidence/2026-10-15-readiness-refresh/github-audit-summary.json)。后续依赖维护先刷新审计、逐项选兼容修复，不直接执行 `npm audit fix --force`。

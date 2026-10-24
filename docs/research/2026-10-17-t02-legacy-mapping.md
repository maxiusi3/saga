# T02 旧媒体来源投影与 schema 兼容

2026-10-17（Asia/Taipei）。按[本批计划](../superpowers/plans/2026-10-17-upgrade-t02-compatibility.md)继续 P1 的“旧地址映射 → 归属/原件核对 → 影子读取”前置工作。本批实现定位候选和本地兼容验证，没有回填生产数据、创建正式资产表或切换上传/删除入口。

## 实现与实际缺陷

原 [resolver](../../packages/web/src/lib/legacy-media-reference.ts) 将标准 `/storage/v1/object/public|sign|authenticated/<bucket>/<key>` 中的访问模式当成 bucket，因此拒绝了有效旧链接；同时 `trim()` 和 URL 路径归一化会掩盖歧义。新增失败回归后修复：只接受已核实主机的标准 HTTPS Storage URL，从**原始字符串**提取 bucket/key，再检查空段、点段、编码、控制字符等；不通过 URL.pathname 获取可能被归一化的 key。

显式 bucket 证据与 URL 冲突时拒绝。签名 query 不进入返回定位；完整已核实 URL 的根目录 key 可以确切定位，单独 basename 仍为 ambiguous。此处不请求 URL、不验证签名、不跨桶寻找同名文件；`mapped` 只代表地址解析，不代表对象存在、归属正确或 asset ready。

新增 [legacy-story-media.ts](../../packages/web/src/lib/legacy-story-media.ts)，只处理指定的 stories 媒体投影：

| 来源 | 提取方式 | 保留边界 |
|---|---|---|
| audio_url | 单值 original_audio | 不拿 mastered_audio_url 补缺失原声 |
| mastered_audio_url | 单值 derived_audio | 派生件单列，不视为原件 |
| photo_url / photo_urls | 单值 / 逐数组项 original_image | 重复值、同名不同路径都保留来源 |
| images jsonb[] | 字符串项，或已知 url/path、thumbUrl/thumbPath 属性 | 每项保留 JSON pointer；原件与缩略图分组 |

每条记录带 sourceTable、sourceRowId、projectId、sourceField、sourcePath、rawValue、kind 和 locator。数组 null/非法项/未知对象形状不静默删除；同一图片的 URL/path 不一致或其中一个无法定位时，整组标为 ambiguous，不选一个覆盖另一个。缺原件的缩略图记录会同时留下原件 unresolved 项。

所需 id/project_id/storyteller_id/title 不兼容时，不生成 mapped 候选；不会拿 user_id 替代必填 storyteller_id。字段级 bucket 证据必须显式传入。该投影器不读取正文/metadata/interactions，不修改调用者或数据库行，不生成 assetId，也不承担权限检查。

rawValue 保留旧引用可能包含的签名 query，未来真实清单必须保存在受限账本并从公共日志/报告排除；当前全部 fixture 为虚构值。

## 实际数据库兼容验证

[本地 runner](../../experiments/t02-legacy-mapping/README.md)固定10月17日远端快照哈希，选取实际列类型、NOT NULL、角色 CHECK、相关外键和两个项目/用户唯一索引，放入独立 Unix socket PostgreSQL **14.17** 临时集群。使用真实 pg **8.16.3** 读出后交给真实 TypeScript 模块。

19项检查覆盖：jsonb[] 元素与 null 的位置、text[] 空项、同 basename 不串档、历史 jsonb 数组兼容（明确独立标注）、title/storyteller 必填、角色/状态 CHECK、同项目用户不同角色仍冲突、投影前后原行摘要相同、局部事务回滚、没有建立 media_assets，以及两次实际连接不继承宿主SSL/密码参数。

这是缩减 schema 的数据兼容证据。SQL null 与 JSON null 到 JS 后可能同为 null，本批保留位置而不推断其语义；jsonb[] 与 jsonb 包裹数组的不同存储类型仍由元数据界定。没有还原全部列默认值、触发器、函数、RLS、Storage HTTP 或远端 PostgreSQL17，局部事务回滚也不是备份恢复验收。

## 增量与回填草案（未执行）

先增加独立、受项目权限保护的来源账本，不 ALTER/drop stories 的旧列，也不把 jsonb[] 直接改成 jsonb。建议来源身份包含 `source_table + source_row_id + source_field + source_path`，同时保存完整来源字段的版本摘要、采集批次和原始类型证据；不能只用旧字符串或 basename 当唯一键。

| 阶段 | 进入条件 / 操作 | 阻断与回退 |
|---|---|---|
| 0. 完整 schema 对账 | 补 functions/triggers/ACL、bucket配置、七个未登记版本的等价差异；在匹配PG17与连接方式下演练 | 不重放bootstrap，不靠migration repair消除未知差异 |
| 1. 受限来源清单 | 用已核准最小投影、固定快照生成来源记录；重复执行同来源/版本应幂等 | 来源版本改变则保留旧观察并重新核查，不用ON CONFLICT覆盖旧人工结论 |
| 2. 精确定位 | 记录 locator候选、歧义/未知类型和冲突；保留所有来源 | 只有候选时 asset_id 仍为NULL；不因同路径或同hash跨家庭去重 |
| 3. 归属与原件核对 | 精确bucket/key查询、当前项目/故事关系、对象版本/大小/SHA-256、原件与派生关系核对 | 明确不存在与无权限/查询失败分开；缺件或未核实归属禁止ready |
| 4. 原子绑定 | 来源版本、项目、资产版本、当前权限/墓碑在提交前重查；候选与目标资产同项目约束 | 迟到结果/版本变化保留为待审，不覆盖原件；并发与未知提交单独演练 |
| 5. 影子读取/少量新写入 | 原件总数/字节/hash对账及备份恢复/回退通过，完成正式adapter与旧删除兼容 | 停新写入/新处理，保留新资产和来源账本，使用经授权旧只读入口；不恢复越权旧规则 |

正式表类型/唯一索引、RLS、来源快照摘要算法和冲突处理 SQL 需随完整 schema/回退证据另行演练。本批没有实现持久来源账本、真实对象盘点、asset绑定事务、影子读取或回填；草案不能直接放入根 migrations 自动执行。

## 验证与出口

定向测试 **2套/40项**通过，含标准URL、归一化反例、字段冲突、位置保留、必填身份和不修改输入。真实PostgreSQL **19项**及稳定fixture SIGTERM退出 **143** 清理通过。初始 resolver/projection/root-key RED 文本保留；中间报告不冒充最终源码验证。

独立初审发现一个P2：shell子进程过滤PG环境变量并不阻止进程内pg.Client读取宿主配置。已用合成PGSSLMODE=require复现失败，在T02和RLS runner显式配置ssl:false及非空惰性密码后，同环境实跑通过。最终增量复核因模型限流待补，初审报告不改写成PASS。

项目 `npm run verify` **77套/765项**、类型/lint和**175页**构建通过，shared **4套/16项**、infra **7项**通过。next-env恢复原字节。依赖未改且本批未重跑audit，沿用前批实际 **42项（34 high / 8 moderate）**失败证据。现有构建配置提示仍在，不是生产环境验收。

最终项目检查、独立审查、源码/证据哈希和里程碑结论见[验证汇总](evidence/2026-10-17-t02-compatibility/verification.json)。同时完成前批[RLS审查修复](2026-10-17-rls-review-followup.md)，单独记录结果，不把它与映射测试合计成生产验收。

G0/G1仍需生产权限修复、bucket/完整schema与迁移/备份回退、供应商条件、正式会话/资产/Storage/删除adapter和真机5/20/30分钟矩阵。本地兼容批不是原计划里程碑，未提交、推送、迁移或部署。

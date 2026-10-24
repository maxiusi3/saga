# Storage 完整定义采集与媒体兼容边界

2026-10-23（Asia/Taipei）。承接 handoff 的精确 Storage 定义采集，不变更原 G0/G1 门槛。用户已授权继续升级计划；沿用当前未提交分支，不另建丢失前批内容的 checkout，不提交或推送未达里程碑的批次。

## 目标与边界

取得 10 月 17 日已固定的六个 Storage 函数、七个触发器的正文、参数和条件，验证身份及指纹后审查实际语义。A/B/C/D 用户结果已收到，不重复请求桶配置或读取家庭记录、对象键、对象正文、凭据值。只用既有 metadata_reader、验证 TLS、限时只读事务；禁止创建角色、改权限、执行所采集函数或远端迁移。

固定输入为 `docs/research/evidence/2026-10-17-remote-metadata/snapshot-2026-10-17T06-13-03-052Z.json`，SHA-256 `8b2a4647b017305183e67b2b932be02080a789dba4fc48b23b2f23a97991e66e`。六函数是七个 Storage 触发器引用的五个不同函数及 `storage.foldername(name text)`。固定七个触发器位于 storage.buckets/objects；不扩大到全部函数正文或业务表。

## 采集器

新增独立 CLI，复用已测的凭据解析、TLS、只读事务/超时/连接清理和私有落盘模块。拒绝 CLI 配置覆盖。参数化 pg_catalog 查询只选择精确身份；缺失、重复、意外身份、属性/定义漂移分别拒绝或标记 drift，不能当成功。函数 MD5 与正文重新计算一致，完整属性比较复用已有验证器。

触发器除旧快照全部字段外采集 `pg_get_triggerdef(oid)`、`encode(tgargs,'hex')`、`tgqual::text`；正文 MD5 必须与快照一致。`tgqual::text` 是私有 pg_node_tree 表示，不是可执行SQL；完整 trigger definition 中的 WHEN 是可读条件依据。验证参数字节的 NUL 分隔、数量、十六进制与条件存在性，明确区分空参数和无参数。将正文、参数、条件仅写入既有忽略目录 `supabase/.temp/routine-audit/`（目录0700、文件0600、独占创建）。公开报告仅白名单身份、指纹、匹配状态、差异字段、执行与清理结果，不包含原始正文、参数、数据库错误文本或连接配置。

本地 PG17 实测同时引用 OLD/NEW 的条件会令原拟用的 `pg_get_expr(tgqual,tgrelid)` 返回22023，故改用上述原始表示加完整定义，保留失败证据。这不省略条件，也不扩大采集范围；当前七个固定触发器的旧快照均无WHEN。

## 验证与交付

先做失败回归，再实现：固定目标、过宽身份拒绝、缺失/重复/漂移、参数/条件校验、传输额外字段不外泄、只读回滚与连接清理。复用旧测试覆盖公共模块，新本地 PG17 夹具确认真实 SQL 和带参数/条件触发器可采集；本地合成夹具不冒充远端事实。独立规格、质量审查通过后才执行一次既有只读账户采集；被拒则保留安全错误码，不提权或重复绕过。

结合结果审查 `StorageService.deleteFile`、`StoriesService.deleteStory` 和其他 `.remove()`：明确数据库删除与 Storage HTTP 删除的边界，形成正式媒体读取/旧删除/备份恢复的实施顺序。没有对象盘点、版本冻结和正式事务时不开放破坏性删除、不将本批写成正式 adapter 已完成。

更新本批研究记录、P0 差距表、主计划入口与 handoff。正式权限、供应商资格、备份恢复、真实登录及原型观察分别判定；P1 的完整 adapter/真机不偷换为 G0 新门槛。仅原计划里程碑实际达到才推送。

## 旧删除入口的本地阻断修复

本轮调用审查确认：`StoryService.deleteStory` 截取 basename 后拼回 `audio-recordings/stories/`，忽略 Storage 删除错误并继续删除故事；`/api/media/delete-image` 使用管理员权限且只检查上传者前缀；图片 UI 在结果未知/失败前已经移除已上传引用。这些入口不能承载现有删除契约。

在正式资产/墓碑/删除任务事务完成前，将上述破坏性入口固定关闭，不提供绕过开关。已认证图片删除返回 503、稳定 `MEDIA_DELETION_UNAVAILABLE` 代码、通用消息和 no-store，保留认证响应头；不解析或回显 paths、不创建 admin 或调用 Storage。未认证沿用认证拒绝并设 no-store。`StoryService.deleteStory` 和 `StorageService.deleteFile` 保留布尔接口、返回 false，禁止数据库/Storage 操作。故事页面明确提示暂不可删除、保留故事。

进一步调用审查：故事页面的旧删除handler当前没有渲染按钮或props调用。只更新该handler的失败消息，不为它新增按钮或常显banner；不把死代码的单元调用写成用户交互证据。故事记录保留和零I/O由实际服务回归证明，已上传评论图片则用真实组件交互测试。

已上传评论图片的单项移除及 Clear images 在不可用时保留已上传引用、持久化记录与本地预览，并提示暂不可移除；不发起不受支持的删除请求。纯本地未上传预览仍可移除和清空。现有 API facade 的故事 DELETE 指向没有处理器的 `/api/stories/[id]`，维持失败，不新增成功的兼容路径。

这些是可回退的本地调用关闭，不能撤销生产 Public URL，不能证明直接 Storage/SQL 已被阻断，也不能宣称已经完成物理删除、正式删除 adapter 或 P0。定向回归需证明零 I/O、匿名/认证响应和 headers、故事保留及两种图片操作保留状态；再执行完整 verify/shared/infra。

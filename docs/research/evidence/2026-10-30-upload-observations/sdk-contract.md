# SDK 契约核对

2026-10-30 通过 Context7 查询 Supabase 官方文档库 `/supabase/supabase`，用于现有 `uploadToSignedUrl` 调用的观测分类，不据此更换依赖或认定本项目账户配置。

- 成功示例返回 `{data:{path,fullPath},error:null}`；失败返回 StorageError。SDK 成功回执不等于本应用 hash/解码校验通过。
- 官方 Studio 错误分流区分 409 已有对象，以及 400 无效对象键/签名 token；不能把所有 400 当作重复上传。保留项目现有明确旧重复错误兼容判断。
- 签名上传凭证来自 `createSignedUploadUrl`；本批保留既有非覆盖设置，不新增有效期承诺，不记录原始签名或文件内容。

来源：[官方 JavaScript 参考快照](https://github.com/supabase/supabase/blob/master/apps/docs/scripts/__snapshots__/build-reference-content.v2.json)、[Studio Storage 错误处理](https://github.com/supabase/supabase/blob/master/apps/studio/state/storage-explorer.tsx)。示例中的日志代码不作为本项目实现要求；家庭内容、token 和原始提供方错误不得写入诊断账本。

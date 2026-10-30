# 2026-10-30 断点与安全缺口诊断

- 引用聊天 `26` 最新完成项为导出组装观测，当前代码基线 `f654e8631` 一致；不是恢复半写代码。初始工作树干净，分支 `codex/october-upgrade-p0` 比本地记录的 origin 分支领先 4 个提交；未联网验证远端状态。
- 本批按用户“P0级任务”优先处理已有媒体入口的权限/删除安全缺口；可靠上传尝试观测仍是随后独立任务，不把运营切片当作原 P0/G0 完整验收。
- `assets/route.ts` 在登记/幂等重放后等待签名，未在签名完成后重新验证项目权限与当前资产。
- `[assetId]/access/route.ts` 在签名之前检查成员与墓碑，签名等待期间的撤权/删除未阻止凭据返回。
- `[assetId]/complete/route.ts` 在 Storage info/下载完成后没有重新验证成员；原 state/version CAS 之后也没有返回前复查。迟到结果可能继续写回或返回成功。
- `task1-red.txt` 使用 deferred Promise 和可变数据库夹具：5 套/150 项，49 项失败、101 项通过，退出码 1。失败断言为错误的 200/202 结果或仍调用 update，不是语法或未定义 mock。主流程已核对原始输出。
- 正式 `media_assets` DDL 没有 `tombstone_at` 字段，因此不能凭拟议模型添加该列的 PostgREST 过滤；真实删除依据是 `deletion_requests`，可选返回字段仅额外防御。
- 验证范围为 Jest 中真实路由及 stream verifier 搭配合成认证/DB/Storage；不构成真实云服务、JWT/RLS、跨事务线性化或设备证据。
- 已签发 URL 的 TTL 与最终检查后的竞态仍存在；本批不实现代理下载/上传，也不伪造数据库与对象存储的原子性。

# 媒体异步边界重新授权

日期：2026-10-30（Asia/Taipei）。基线：`f654e8631`，分支：`codex/october-upgrade-p0`。本批优先修复既有媒体入口的安全缺口，不等于原 P0/G0 或整个可靠上传观测已完成。

## 实施结果

- 共享 `requireCurrentMediaAsset` 重新检查项目权限、当前资产身份/state/version、可选资产墓碑与权威删除台账。错误、缺件、变化与无法确认均拒绝，失败响应不带凭据或资产记录。
- 上传登记在插入后、签名后检查；pending 幂等重放签名后检查；uploaded/verifying/ready 重放返回前检查。保留现有幂等键、非覆盖上传和失败后可重试的登记，不补偿删除原件。
- 回放签名完成后检查，未通过时丢弃尚未交给客户端的签名；原 300 秒 TTL 不变。
- 完成校验在 Storage info 大小不符或真实 stream 验证结束后、CAS 写入之前检查，并在提交结果返回之后再次检查。CAS 钉住项目、故事、bucket/key/kind/state/version；返回阶段以已更新记录为准，不拿旧版本误伤合法更新。
- 音频仍为 `verifying`，图片仍为 `ready`，校验失败仍为 `quarantined`。终检失败不伪造已提交写入的回滚，也不返回成功资产。
- 最终 guard 的最后操作是删除台账查询；成功后直接同步构造响应，不再等待 Storage、日志或其他服务。复用已有 `withMediaHeaders`，保留每条刷新 cookie 和 no-store。

正式 `media_assets` 表没有 `tombstone_at` 列。本批没有添加对不存在列的查询过滤或 SQL 迁移；可选字段通过 `select('*')` 防御性读取，权威依据仍为 `deletion_requests`。

## 验证

| 验证 | 实际结果 |
| --- | --- |
| 原实现竞态 RED | 5 套/150 项；49 失败、101 通过，退出 1 |
| guard 畸形身份 RED | 6 套/174 项；9 失败、165 通过，退出 1 |
| 定向 GREEN | 6 套/215 项全部通过，退出 0 |
| 独立规格/质量审查 | PASS / Approved；无待修发现 |
| `npm run verify` | type-check、lint、Web 133 套/1877 项、184 页构建通过 |
| shared / infra | shared 4 套/16 项，infra 7 项，命令链退出 0 |

证据：[诊断](evidence/2026-10-30-media-revalidation/diagnosis.md)、[原始日志索引](evidence/2026-10-30-media-revalidation/README.md)、[独立审查](evidence/2026-10-30-media-revalidation/task1-review.md)、[验证汇总](evidence/2026-10-30-media-revalidation/verification.json)。本批未修改历史实验、证据、SQL 或依赖；没有复跑/覆盖旧 PG 实验。`next-env.d.ts` 已恢复运行前原字节。

## 仍需完成

1. **不是原子撤权。** 权限、资产、删除台账和 CAS 分属独立查询，最终检查后的并发窗口仍存在；更强保证需要独立的事务/访问层设计和真实并发验收。
2. **不能撤回已发链接。** 已签发 URL 和上传 token 的有效期不因本批检查而消失；即时撤销、直接 Storage RLS 和细分动作权限仍须另行验证。
3. **不是云端资格证明。** Jest 使用真实路由和 stream verifier，但认证、数据库与 Storage 是合成边界，不证明真实 JWT/PostgREST/RLS、生产规模或真机行为。
4. **后续工程未扩张。** 可靠上传尝试采集、部署覆盖证明、实际告警响应人/投递、供应商账户/区域/数据条件核验继续独立推进；前批同步导出观测不重做。
5. **环境提示保留。** 构建仍报告已有 Next 配置 `eslint` 选项及缺少 `SUPABASE_SERVICE_ROLE_KEY`；构建退出 0 不代表运行环境已配置。audit 未重跑。

原 G0–G4 完整验收未新增证明。本批只允许本地检查点，不触发条件推送，不合并 main、不执行远端迁移或部署、不外发真实家庭资料。发布前真实方案 B 备份恢复仍需负责人指令。

# Supabase 用户回传与 SQL 复制修复

日期：2026-10-23（Asia/Taipei）。来源为本轮用户消息及 [Storage 截图](evidence/2026-10-23-supabase-feedback/storage-dashboard.png)；未重新连接生产后台。截图没有项目 ref，沿用 Saga 项目上下文，但不能单凭截图重新核验项目身份。

**最新状态：A/B/C 成功结果已由用户回传；A/B/C/D 均无需重跑。** [结构化结果](evidence/2026-10-23-supabase-feedback/user-query-results.json)保存原字段、null 和指纹，[对账结果](evidence/2026-10-23-supabase-feedback/metadata-reconciliation.json)记录与旧快照的比较。执行时刻和项目 ref 未包含在结果表中，记录为未知，不将本地测试或本轮接收日期冒充远端执行时间。

## 已收到的现状

| 项目 | 用户提供的结果 | 仍待确认 |
| --- | --- | --- |
| `audio-recordings` | A 确认 `public=true`、`file_size_limit=null`、`allowed_mime_types=null`；截图 Policies 2 | 桶级大小/MIME 限制未设置；不代表不受全局限制。实际 Storage HTTP 和授权仍待验收 |
| `saga` | A 确认 `public=true`、`file_size_limit=52428800`（50 MiB；Dashboard 显示 50 MB）；截图 Policies 9 | 实际 Storage HTTP 和授权仍待验收 |
| `saga` MIME | `audio/mpeg`, `audio/mp3`, `audio/wav`, `audio/m4a`, `audio/aac`, `audio/ogg`, `audio/webm`, `image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `image/gif` | 实际 Storage HTTP 行为 |
| 两桶版本与生命周期 | A 确认均为 `STANDARD`、`versioning_status=DISABLED`、`lifecycle_configured=false`、`lifecycle_rule_count=null` | 不提供版本恢复/备份成功证据；生命周期未配置不等于没有其他删除路径 |
| Storage enum | B 确认依次为 `STANDARD`、`ANALYTICS`、`VECTOR` | 标签信息已补齐；未重新执行包含完整 enum 的组合实验 |
| Storage 函数指纹 | C 的六个函数签名、返回类型、language、security_definer、owner、MD5 均与 10 月 17 日快照一致 | 正文和语义审查仍缺；MD5 相同不证明权限安全 |
| 迁移登记（D） | `20250731012532`, `20250731015259`, `20250802015525`, `20250802015612` | 与 10 月 17 日登记记录一致；七个未登记本地迁移仍需语义对账，不能由登记状态判断 SQL 是否执行过 |
| 数据库备份 | 用户报告 Free 账户，Backups 未开启 | 最近备份、保留/恢复能力及 PITR 未另行核验；当前没有恢复成功证据 |
| 媒体独立副本 | 用户后续明确：音视频没有独立副本 | 音视频备份与恢复方案尚未建立；图片副本未单独确认 |
| 隔离恢复环境 | 用户确认没有隔离测试 Supabase 项目 | 恢复环境安排及测试预算待确定 |
| 部署与 Auth | 用户回传 `maxiusi.dpdns.org`、commit `1caa21a`、10 月 7 日、九个变量条目；Google/SMTP enabled 且配置齐全 | [部署对账](2026-10-23-deployment-config-user-feedback.md)已保存；Site URL、Redirect URLs、APP URL 值、Needs Attention 详情和真实登录仍待核对 |
| 其他协作项 | 已知旧环境有 SiliconFlow/OpenRouter 变量 | 供应商实际账户/模型/数据条件及预算仍未提供 |

Public 桶的公开对象读取不依赖应用签名接口的项目授权；现有 API/RLS 本地测试不能据此证明媒体私密性。Policies 数量也不是隔离验收。需要把私有桶、受控读取、历史 URL 兼容与撤权反例纳入正式媒体方案；本轮没有更改桶配置，也没有取得任何真实对象或公开 URL。截图不证明已经发生内容泄露。

对账显示：旧快照中的七个 Storage 触发器绑定引用五个不同函数，加上 `foldername(name text)`，恰好对应 C 的六行。两个函数各被两个触发器共用，不是 C 少返回一行。这个比较没有重新采集当前触发器绑定；旧 `protect_bucket_control_insert` 与 `protect_bucket_control_update_role` 各有一个参数，后续精确采集仍须覆盖参数及可能的条件，不能仅凭函数名猜测行为。`storage.update_updated_at_column()` 也不能用已审的 `public.update_updated_at_column()` 替代。

下一步由代理准备六个函数及七个触发器的限定定义采集/审查，结合正式私有媒体读取与历史兼容方案推进。无隔离项目的现状已确认；备份恢复安排/预算、供应商账户条件及真实登录资格继续开放，部署/变量/Google/SMTP状态已回传但网址和提示详情待核对。A/B/C/D 信息项已完成，这些结果不改变 P0/G0 未通过的结论。

## SQL 问题与修正版

用户实际提交的 A 出现 `lifecycle_rule_countFROM`、`bucketsWHERE`，B 出现 `enumlabelFROM`、`tJOIN`，C 出现 `definition_md5FROM`、`sJOIN`。换行被删除且没有补空格，使 SQL token 粘连；具体在哪个复制环节丢失换行尚未核实。A/B 用户报错为 `42601`；C 只提供了失败 SQL，没有提供错误码。本地将原文件的换行删除，三段均复现 `42601`。

第二次回传中，三段 SQL 分别从 `bucket settings`、`storage enum labels`、`referenced function fingerprints` 开始；前面的 `/* A:`、`/* B:`、`/* C:` 丢失，结尾 `*/` 仍在，说明文字被当成 SQL。用户三段均报告 `42601`。这是另一处复制边界问题；此前把说明放在 SQL 行内增加了误选机会。

**当前使用无注释独立文件：[A：桶配置](2026-10-23-supabase-sql/A-buckets.sql)、[B：Storage enum](2026-10-23-supabase-sql/B-storage-enum.sql)、[C：函数指纹](2026-10-23-supabase-sql/C-function-fingerprints.sql)。** 每份文件全部内容就是一段可执行 SQL，首词为 `BEGIN`，末尾为 `ROLLBACK;`，不含标题或注释。查询字段、筛选、只读事务和超时不变。原[带注释单行版](2026-10-23-user-readonly-evidence.sql)、[10 月 22 日原 SQL](2026-10-22-user-readonly-evidence.sql) 及其历史验证字节保留，仅作为历史版本。

历史操作步骤（已成功完成，当前无需重跑）：

1. 在现有 Saga 项目的 SQL Editor 新建查询，清空编辑器，复制 A 文件全部内容（或本轮回复中 A 代码块的全部内容），运行并保存结果。
2. 清空编辑器，分别复制 B、C 文件全部内容运行并保存；每次一段，避免界面只显示最后一个结果集。每次粘贴后首词应为 `BEGIN`，结尾为 `ROLLBACK;`。D 已收到，无需重跑。
3. 如果出现 `25P02`，先单独运行 `ROLLBACK;`，再粘贴完整单行；其他错误保留完整错误码即可。
4. 随结果注明执行日期和项目 ref。音视频无独立副本已收到，无需重复确认；其他后台配置可随后收集。

## 本轮验证与边界

第二次[本地核验](evidence/2026-10-23-supabase-feedback/sql-comment-free-verification.json)在相同虚构 PG17.4 夹具上重现缺注释开头的三处 `42601`；无注释 A/B/C 全部成功，结果与完整带注释版本相同，临时集群与连接已清理。该轮只证明本地语法与筛选不变；随后用户回传的真实结果现已另存为上述结构化结果，不与虚构夹具混用。

[本地验证结果](evidence/2026-10-23-supabase-feedback/sql-verification.json)：PostgreSQL 17.4，虚构夹具。先重现旧 A/B/C 删除换行后的失败，再验证新 A–D 成功且与保留换行的原查询逐项返回相同字段/结果；整文件删除换行后仍可解析。检查了两桶限定、触发函数去重、跨 schema 触发绑定和排除无关重载，确认事务只读及超时设置。临时集群停止、目录删除、连接归零。合成 enum/函数/桶行不是生产采集结果，不能用本地结果补填 B/C。

核对 909 个既有应用、脚本、迁移、实验和配置文件哈希未变；没有修改应用行为或重跑整套应用测试。本轮早期验证脚本的相对 import 多一级，启动时即报 `ERR_MODULE_NOT_FOUND`；修正后才启动本地集群，以上通过结果来自后一次实际执行。原实现批的冻结证据继续保留；本轮无独立代理审查，不继承前批的审查结论。

P0/G0 仍未通过：Storage 完整依赖/真实权限、迁移等价与回填回退、可验证的备份恢复、实际供应商账户条件等仍缺。正式媒体/Storage/删除 adapter 和 G1 真机属于继续实施/验收项，真机仍为 `deferred_by_user`。Free 未开启托管备份不等于必须立即升级套餐；可继续评估逻辑备份与媒体独立副本方案，但需要真实恢复验证才能关闭缺口。本轮没有提交、推送、远端迁移或部署。

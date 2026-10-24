# 函数、触发器与 ACL 补核

2026-10-17（Asia/Taipei）。本批先补前批采集器独立审查、修复关闭超时 P2，再补充限定范围的远端元数据。没有读取家庭正文、对象清单、函数正文、触发器参数或任意配置值，也没有调用业务函数、修改权限或执行迁移。

## 采集器修复和验证

[原独立审查](evidence/2026-10-17-remote-metadata/review-initial.md)发现 `main()` 在 `client.end()` 前取消总截止；关闭永久等待时不再落盘。修复将 connect、每次 query（包括 rollback）和 end 纳入同一90秒截止，到期强制断开并保留明确的失败/清理状态。已有失败后又出现关闭超时，两项事实分别保存。同步文件系统/阻塞事件循环不由 JS 定时器抢占，因此不能称为任何系统故障下的绝对90秒进程上限。

定向 **23/23** 通过，保留真实 main + 合成传输的 RED/GREEN；新增SQL在临时 Unix socket PostgreSQL **14.17** 执行并验证字段/ACL语义及敏感值排除。详见[本地验证](evidence/2026-10-17-metadata-supplement/verification.json)。[独立增量复核](evidence/2026-10-17-metadata-supplement/review-followup.md)已关闭 P2，新增五节未发现需修复问题；旧初审与02:45快照保持原样。

## 实际远端证据

审查通过后仅运行一次 `node scripts/inspect-supabase-metadata.cjs`，用已有 metadata_reader 取得[06:13 UTC快照](evidence/2026-10-17-remote-metadata/snapshot-2026-10-17T06-13-03-052Z.json)，即台北 **14:13**。实际耗时28.25秒；退出 **2 / partial**，因为bucket仍被拒。见[命令结果](evidence/2026-10-17-metadata-supplement/remote-capture.json)与[逐项分析](evidence/2026-10-17-metadata-supplement/remote-analysis.json)。

角色metadata_reader、PostgreSQL **17.4**、TLS1.3/authorized、REPEATABLE READ READ ONLY、10s/2s/15s后端限时均实际确认；总截止未触发，连接正常关闭。前批原有11节的完整结果与02:45快照一致，未把重新读取称为远端状态改变。

| 新章节 | 实际结果 | 解释 |
|---|---|---|
| 函数结构 | **39**：public 20、storage 19 | 签名/返回类型/owner/安全属性/search_path及定义MD5；不含函数正文或参数默认值 |
| 函数有效EXECUTE | **156** | 39函数×4角色；metadata_reader/anon/authenticated/service_role均显示EXECUTE，但还须结合schema USAGE与函数自身语义 |
| 非内部触发器 | **21**：public 14、storage 7 | 开关、类型位、函数身份、参数数量、条件存在与定义MD5；不含参数/WHEN正文 |
| schema权限 | **8** | 四角色均不能CREATE；metadata_reader有public USAGE、没有storage USAGE |
| 自定义默认ACL | **9** | 对目标schema中新建表/序列/函数的创建时授权；不能当成现有对象权限或追溯修复 |

public的20个函数均有效授予PUBLIC EXECUTE；其中14个SECURITY DEFINER（12个非trigger返回函数），8个没有函数级search_path配置。metadata_reader的表/列SELECT仍未授予，但具有public USAGE及函数EXECUTE，因此**不能由表读取被拒推导全部函数访问路径都已隔离**。本次没有取得函数体或调用函数；这些是必须补查的授权/配置事实，不是已证实越权利用或资料泄露。trigger返回函数也不能当普通RPC直接调用。

## 迁移签名差异

七个未登记根迁移仍未登记。新交叉清单保留每个文件SHA-256、声明函数参数和对应远端重载、声明触发器对应结构，名称存在不等于语义等价。两处确切不兼容已可由签名直接确认：

| 函数 | 根迁移 `20261006000001` | 当前远端 |
|---|---|---|
| accept_project_invitation | `(p_token text, p_user_id uuid)`，返回project_id/role/success | `(p_invitation_id uuid, p_user_id uuid)`，返回project_id/user_id/role/status/joined_at |
| send_project_invitation | `(p_project_id uuid, p_inviter_id uuid, p_invitee_email text, p_role text, p_token text)` | `(p_project_id uuid, p_invitee_id uuid, p_role text, p_invited_by uuid, p_invitation_message text)` |

`process_package_purchase` 和 `request_data_export` 另各有两个重载；不能只按函数名判断修复覆盖。`mark_notifications_as_read` 的参数/返回形状及plpgsql语言均相符，仍不能据此确认函数体完整等价。函数MD5只是精确变更指纹，不验证正文语义、跨版本恢复或安全性。

## 后续与里程碑

下一步优先审阅上述public非trigger SECURITY DEFINER函数的受限定义/本地对应版本，验证调用者身份、对象范围、付款依据、搜索路径及EXECUTE授权，再把明确差异放入完整依赖的本地PG17演练。已补结构/ACL清单，不重复配置metadata_reader；完整函数体/触发器语义、七迁移等价与回退仍未完成。

bucket配置仍42501；对象盘点需另按最小字段范围授权，备份恢复、正式adapter、供应商数据条件及真机验收仍缺。不得直接重放bootstrap、migration repair或db push。G0/G1未达成，未提交、推送、修改远端权限、迁移或部署。

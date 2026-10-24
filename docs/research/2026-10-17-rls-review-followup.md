# RLS 独立审查与初始化清理修复

2026-10-17（Asia/Taipei）。接续[前批RLS隔离演练](2026-10-17-rls-rehearsal.md)。独立审查本次恢复并产出[两项P2](evidence/2026-10-17-rls-rehearsal/review-followup.md)；随后修复任务因模型限流中断，保留已写回归，由主代理接着复现和修复。独立审查与实现者职责分开，最终增量复核状态见本批验证索引。

## 两项修复

R1：SQL手工btrim字符表没有完整覆盖JavaScript `trim()`。新增回归在U+1680首尾空白处真实失败：Storage INSERT意外返回1行。补齐完整ECMAScript WhiteSpace/LineTerminator集合；25个字符分别覆盖前/后边界，普通内部Unicode文件名仍可用。代码拒绝非规范key，不修改原key。

R2：原signal handler与初始化同时清理；`await mkdtemp`尚未把路径交回调用者时，清理看不到新目录。新增IPC控制器在真实目录创建后、返回前发SIGTERM，实际复现退出后目录仍存在。该RED的外部控制器仅救援自身记录的临时目录并另行留证，不算被测脚本清理成功。

现在signal/deadline只请求取消；有界初始化/查询完成后经checkpoint终止主路径，finally统一清理并写一次最终状态。真实分配的目录即使在测试控制器返回前异常也有清理归属。取消后不继续启动PostgreSQL；稳定fixture信号路径保留。

增量静态反馈还指出两个P3：第一次保存报告后缺少checkpoint，以及“未启动PG”断言依赖的标记未写入。已补checkpoint与真实启动标记，并在稳定fixture用true正例验证该标记，避免空断言。另由T02初审发现并复现两个runner共同受PGSSLMODE影响，现都显式配置本地ssl:false和惰性密码；合成环境复测通过。

[最终独立增量复核](evidence/2026-10-17-rls-rehearsal/review-fixes.md)为范围内PASS，关闭R1/R2及两项P3，并核对RLS的pg环境修复与最终源码哈希。该结论不扩展到T02；T02自身增量复核限流待补。

## 验证范围

- RLS正常回归 **63场景/351断言**；前批32条快照策略的完整依赖与诊断隔离模式保持。
- [shutdown runner](../../experiments/rls-rehearsal/verify-shutdown.mjs) **6类检查**：分配中SIGTERM、SIGINT、deadline；fixture就绪SIGTERM；分配后异常；fixture后异常。最终各子进程自行清理，外部救援无需执行。
- 证据记录源码/运行时、子进程退出、目录是否存在、是否尝试启动PG、子报告清理结果。分配时机由显式测试hook控制，使用真实目录和本地PG，不是模拟文件系统，也不代表任意SIGKILL可执行清理。

历史61/199及原SIGTERM报告保持原样，属于修复前源码；最终运行与复核另见[本次验证](evidence/2026-10-17-t02-compatibility/verification.json)。生产权限、PG17、完整Storage/函数/触发器/ACL、备份、用途同意/墓碑和旧客户端删除仍未接通，原候选的限制继续有效。

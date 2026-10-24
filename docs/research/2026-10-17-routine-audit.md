# G0/T02：受限 RPC 定义、调用契约与本地权限核查

2026-10-17（Asia/Taipei）。执行[本批计划](../superpowers/plans/2026-10-17-upgrade-routine-audit.md)，承接[函数/触发器/ACL元数据](2026-10-17-metadata-supplement.md)。本批实现、验证与独立审查完成；最终状态见[验证汇总](evidence/2026-10-17-routine-audit/verification.json)。原始定义仅保存在被忽略的本地私有目录，不能复制到公开证据。

## 调用契约

[独立调用点核对](evidence/2026-10-17-routine-audit/callsite-review.md)覆盖12个完整重载和13处字面RPC调用。5处邀请调用的参数不能匹配前批捕获的远端签名，涉及实际发送邀请页面与两个接受邀请页面；部分TABLE结果还被当作单个对象使用。该结论是当前工作树与真实catalog签名的静态对照，不是生产HTTP失败记录。

发送UI使用email/token，而远端签名使用invitee UUID；接受UI使用token，而远端签名使用invitation UUID。正式兼容需要先确定邀请表/成员表真源、未注册邮箱方案及token受控解析，再选择兼容包装或切换调用方；仅重命名参数或重放根迁移无法完成转换。TABLE返回需解包并检查恰一行及业务成功，RPC后的查询失败也不能当成事务已经回滚。

浏览器用户RPC与使用service key的API/cron必须分别设计授权。统一加`auth.uid() = 参数`会中断不携带终端用户JWT的service调用；授予authenticated也不会自动撤销PUBLIC。购买和导出均有两个重载，不能只修根迁移里的一版。详细身份来源、返回/失败路径、缺少依赖和指纹见调用点报告。

## 采集实现与审查

新入口固定前批快照的12个public非trigger SECURITY DEFINER签名和MD5，校验快照SHA256后用参数化catalog查询读取定义。共享只读生命周期保留metadata_reader角色/主机限制、TLS证书验证、只读一致性事务、10s/2s/15s后端限时与90秒异步截止；原16条元数据查询不变。

原始定义只写`supabase/.temp/routine-audit/`：0700目录、0600文件、排斥符号链接、独占创建及读后权限/身份校验。公开报告仅含固定查询、目标签名、摘要、状态和清理信息。漂移或失败不能记作与原快照匹配。90秒限制覆盖异步驱动等待，不宣称能抢占同步文件I/O或阻塞事件循环。

原23项回归保留。初次43项通过后，[规格审查](evidence/2026-10-17-routine-audit/capture-spec-review.md)发现本地SQL测试继承宿主PG环境的P2；实际合成环境先复现SSL失败，随后隔离整个worker与子进程环境、固定本地SSL和无效密码，45项通过，[增量复核PASS](evidence/2026-10-17-routine-audit/capture-spec-review-fix1.md)。[质量审查](evidence/2026-10-17-routine-audit/capture-quality-review.md)再发现启动失败可能漏清理目录/监听器的P2；7类真实测试源码配合合成进程结果的回归先RED再GREEN，删除前确认数据库已停止，未知状态保留目录。最终污染环境 **52/52通过**，含真实PG16.11 catalog测试，[最终质量复核PASS](evidence/2026-10-17-routine-audit/capture-quality-review-fix2.md)。两次修复均只改本地测试，生产采集源码不变；旧失败证据保留，详见[最终采集器验证](evidence/2026-10-17-routine-audit/capture-fix2-verification.json)。PG16 catalog测试不能替代PG17业务验收。

## 实际只读采集

审查通过后单次运行，取得[13:06 UTC公开采集报告](evidence/2026-10-17-routine-audit/capture-2026-10-17T13-06-48-036Z-944080d1-0721-4174-a482-dd4e812eab1e.json)：12/12目标的身份、属性和MD5均与前批快照匹配，退出0。TLS1.3已授权、metadata_reader、postgres数据库、REPEATABLE READ READ ONLY及10s/2s/15s限时确认，90秒异步截止未触发，连接正常关闭。版本摘要与前批17.4相同。

控制器另核对私有文件SHA256、12个定义的MD5、0700/0600权限、gitignore生效且未入索引，见[采集复核](evidence/2026-10-17-routine-audit/remote-capture-check.json)。仅读取catalog，没有调用远端目标RPC或读写业务行。该匹配只覆盖指定12个身份，不是新增重载/其他函数的完整清单刷新。

公开采集报告SHA256：`feb2b22a900d372f6bcc24a912e1636789de16208d0c5975ece5d77998041c8f`。私有定义JSON的SHA256：`f2f37cf33860c4bc6ba22ccec90e0cc0f6d44f311e6be9c6f2e15707d2a2bedc`。私有文件路径在公开报告中保存，原文不能纳入GitHub。

## 12 个真实定义的语义

[独立逐函数审阅](evidence/2026-10-17-routine-audit/semantic-review.md)已完成。它重新核对12个定义摘要，区分正文事实、固定schema依赖及尚未执行的运行路径；未用根迁移的同名正文替代远端事实。

| 范围 | 静态确认 | 本批边界 |
|---|---|---|
| 通知计数与已读标记 | 只按传入接收者过滤，无调用者绑定；PUBLIC EXECUTE可到达，owner权限绕过通知表未强制的RLS | 选为本批隔离重放目标；仅读数量、改已读状态，不是完整通知/家庭素材读取证明 |
| 创建项目与三参购买 | 传入用户未绑定身份；项目直接设paid，券不足不拒绝；购买缺少支付成功/金额/归属依据，交易查后写没有唯一去重约束 | 钱包更新触发器正文和参数/列解析尚需验证；未执行这些函数或实际支付 |
| 邀请、初始化与五参购买 | 邀请信任传入成员/记录；初始化的`!=`身份检查漏NULL；清理/发送引用缺失invited_at，钱包小时/payment_reference字段也有缺口 | 缺列或歧义可能先使调用失败，不能把授权缺口扩写成已成功入账/授予权限 |
| 结账与两个导出重载 | 结账仅静态JSON；四参导出只返回UUID/queued，没有持久记录；三参导出确实INSERT请求，但参数/列同名有解析风险 | 返回success/queued不等于外部动作完成；三参导出写请求也不证明worker消费或交付 |

12个函数均无明确service-only分支；仅初始化钱包出现`auth.uid()`且检查不完整。8个未固定search_path的函数有未限定表名。未据此声称已经发生路径劫持：可写schema/TEMP权限、调用时路径及实际PG17运行结果未核实。通知之外涉及的更新时间触发函数不在这12个目标中，其名字不能充当无副作用证明。

表结构来自06:13 UTC快照，定义采集在13:06 UTC；定义/属性匹配不等于期间所有表结构未变。正式处理必须补完整依赖、真实身份入口、重载/调用方转换和可回滚迁移。其余函数未因本批只修通知候选而被判定安全。

## 通知权限隔离演练

新增[实验与边界说明](../../experiments/routine-notifications/README.md)，精确重放F05/F07的私有定义。4个调用角色均通过独立连接确认非superuser/NOBYPASSRLS；本地非登录table owner持有函数与表，以表所有权重现SECURITY DEFINER绕过未强制RLS的相关行为。虚构的两家庭仅用于验证不同接收者隔离，不增加通知表不存在的家庭成员授权规则。

[真实RED](evidence/2026-10-17-routine-audit/notification-red-2026-10-17T13-14-57.248Z-ce36af05-db0b-4216-8972-9f1c5248e599.json)发生在candidate.sql创建之前：匿名读取另一接收者的未读数为2，伪造目标身份实际改变1条他人通知，metadata_reader即使没有表权限仍能通过旧函数取得计数；随后“应返回42501”的断言真实失败。原始正文没有被写进公开fixture或报告。

[本地候选](../../experiments/routine-notifications/candidate.sql)保留函数身份、整数返回、可选数组和已有时间语义，以NULL安全的本人检查加固定search_path，并撤销PUBLIC/anon/metadata_reader/service_role对两个完整签名的EXECUTE，只显式授予authenticated。没有service身份回退。普通用户传入别人的接收者ID被拒；本人请求夹带别人的通知ID不会改变他人记录。

[正常GREEN](evidence/2026-10-17-routine-audit/notification-run-2026-10-17T13-15-47.425Z-9da2b4d3-6fcb-4e2e-bb0c-7607ba09e06e.json)及[污染环境GREEN](evidence/2026-10-17-routine-audit/notification-run-2026-10-17T13-16-27.531Z-bce20147-a75d-47b4-bc90-8778523ffd36.json)各 **19场景／181断言**通过，包括真实角色/权限、匿名/缺身份/NULL/伪造目标/metadata伪造claim/service拒绝、合法本人和空收件箱、默认/空/重复/混合数组、已读和NULL标志、跨接收者记录/时间保持、临时表与search_path干扰、DDL原子回滚和重复应用。[生命周期验证](evidence/2026-10-17-routine-audit/notification-lifecycle-2026-10-17T13-16-27.362Z-0912edf2-a2bb-467f-99e3-bf1d623136da.json)3项通过：污染环境退出0、实际SIGTERM退出143、实际无效启动参数退出1；三者数据库停止、目录移除、连接归零，外部观察未执行补救。

运行时为PG16.11，PG17未执行。fixture仅保留5个相关通知列及虚构用户，表ACL比远端更严格，未重放所有约束/默认值/策略；所以这是精确定义在缩减依赖下的行为证据。测试auth.uid使用可变GUC，模拟可信PostgREST验证后的身份适配层，不证明JWT验证正确。metadata角色可伪造GUC，因此其拒绝必须来自真实EXECUTE权限；不能把本人判断单独当认证边界。authenticated数据库凭据不可按该模型交给终端用户。

候选只留在experiment目录。当前仓库未发现两个RPC消费者，不代表旧版或外部调用不受影响；生产仍需单独核对角色继承、owner权限、直接表路径、认证入口及兼容转换。本轮不修改远端权限或根迁移，候选的本地数据库名/标记只是误操作防护。

通知实验的[独立规格审查](evidence/2026-10-17-routine-audit/notification-spec-review.md)和[代码质量审查](evidence/2026-10-17-routine-audit/notification-quality-review.md)均PASS，无需修改。审查重新核对6个源码、运行/私有定义/证据指纹以及临时目录消失；读取已保存的真实运行结果，没有把未重跑说成新执行。

## 项目验证与文件保留

[本批项目检查](evidence/2026-10-17-routine-audit/project-checks.json)记录`npm run verify`退出0：Web **77套／765项**、类型/lint及 **175页**构建通过；shared **4套／16项**、infra **7项**通过。检查后应用和依赖未再变化；独立采集器与通知实验使用各自上述定向证据。next-env恢复本批开始原字节。初始1,383文件保留，无缺失或超出范围的改动；旧应用、来源账本、RLS/T05、根迁移及依赖保持。链接、源码/证据指纹和diff空白检查通过，详见最终验证汇总。

## 原计划里程碑

本批是G0/T02证据与兼容准备，不是新增里程碑。bucket配置、完整依赖/触发器与迁移等价、生产权限及兼容迁移、备份恢复/回退、供应商条件仍需证据；G1还需正式资产/Storage/会话/删除adapter和真实设备5/20/30分钟故障矩阵。依赖未改，未重跑audit，沿用前批42项（34high/8moderate）失败证据。

[原里程碑核对](evidence/2026-10-17-routine-audit/milestone-check.json)为G0/G1未达成；没有提交、推送、远端迁移、权限变更或部署。下一步补相关触发器正文与PG17完整依赖演练，确定邀请真源/参数/返回转换、可信支付事件和持久导出契约，再接正式资产事务；不重复本批12定义采集和已完成的通知演练。

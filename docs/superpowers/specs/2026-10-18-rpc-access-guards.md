# RPC 邀请接受与项目创建：本地权限候选

2026-10-18。承接[PG17实际运行](../../research/2026-10-18-pg17-routines.md)和[handoff下一步](../../HANDOFF-2026-10-13-upgrade.md)。本批是既有RPC的权限/事务修复及邀请兼容核查，不改变D01–D16、不引入新商品，也不部署。

## 范围与不变量

- 原生PostgreSQL17.4、固定快照、12个已审RPC和更新时间触发函数沿用前批；旧实验源码和证据保持原样。新实验可导入旧Harness/loadReviewed/replay，必须记录并核对全部实际依赖指纹。
- 新候选仅位于`experiments/pg17-access-guards/`，保持两个完整RPC签名、默认参数及返回形状。候选事务带独立本地marker检查；不新增根迁移、正式UI/API、远端查询或生产写入。
- 实际低权限caller、无service回退，NULL安全本人检查，空search_path及限定对象，精确撤销PUBLIC/anon/metadata_reader/service_role EXECUTE，仅授予authenticated。
- 所有失败必须核对项目、角色、钱包和交易完整回滚；SQL异常、显式ROLLBACK及DDL回滚分别验证。现存历史行保留；重复应用不重放业务，不提供破坏性down migration。
- 真实认证、角色继承、生产RLS/表ACL、钱包可信授予/支付来源和完整邀请令牌路径仍待集成。本地权限候选不是完整数据库边界。

## 接受成员记录ID的兼容候选

保留`accept_project_invitation(p_invitation_id uuid,p_user_id uuid)`及TABLE(project_id,user_id,role,status,joined_at)。这里的ID确实是`project_roles.id`，不能把email token转换或猜测成它。

身份必须非NULL且等于p_user_id。首次按目标成员ID读取`(project_id,user_id)`作为本次调用的绑定一致性基准并定位项目，再锁项目，随后锁同一项目的目标角色；持锁后当前绑定必须与首次观察的基准一致，并重验目标用户等于本人、pending状态、合法角色和invited_by。项目须为active；invited_by必须等于项目当前facilitator_id，缺失/旧邀请者拒绝。所有比较NULL安全，拒绝不相关用户、项目已转移/停用、已active/inactive/删除及锁后绑定与本次基准不一致的记录。只把该记录从pending改为active并设置joined_at，返回一行真实更新值；不写新成员、不改角色、不授券或扣席位。

项目→目标成员锁顺序与导出候选一致。等待其他事务后必须重验锁后当前行，首次无锁读取只作为绑定比较基准，不能用旧状态作授权。首次读取前已提交且符合当前资格的绑定按当前事实判断；本签名和现有表不证明记录历史上从未改绑，也不证明两次读取间从未变更后恢复同一绑定。并发两次接受只有一次成功；另一次明确拒绝，不能覆盖joined_at。接受已提交但响应丢失时须查询已绑定成员状态，不能自动重建邀请。

这是已绑定用户的旧成员记录入口。它没有token、expires_at或可信席位预留证据；不声称已修复邮件邀请。对NULL/不再具有权限的invited_by拒绝是明确兼容收紧，历史记录不能静默补值。未来令牌适配必须验证真实认证邮箱、有效期、状态、当前邀请者权限和持久席位预留，再原子绑定到项目成员。

## 创建项目的兼容候选

保留`create_project_with_role(project_name text,project_description text,facilitator_id uuid,creator_role text)`、原默认参数和UUID返回。调用者必须非NULL且等于facilitator_id；creator_role仅允许facilitator或storyteller，显式NULL/其他值拒绝，省略参数遵守原默认值。名称NULL或普通空白拒绝；描述保持原空串转NULL行为。

先锁该用户已有钱包，缺失钱包、NULL/不足1的券或对应角色席位全部拒绝，不隐式创建钱包/赠送额度。事务内扣1项目券及1对应席位，其他余额和last_payment_reference不变；创建本人拥有的active项目及对应active角色；写两条`seat_transactions`，transaction_type=consume、resource_type为project_voucher及对应seat、amount=-1、同一project_id。消费记录不是可信付款凭证。

显式设置`payment_status='unverified'`。快照是无枚举CHECK的text列，当前应用未发现该字段消费者；本批不把旧钱包余额、赠券或资源扣减冒称已付款。正式接入前需确认旧/外部消费者及统一权益/支付账本，不沿用默认paid。D09的有限数字项目商品方向保持不变，旧券/席位仅为兼容入口的受控消费。

同一钱包只有1券/1席位时并发创建只允许一个提交；有两份完整资源时两个请求可各消费一份，接口没有幂等键，不承诺重试去重。钱包与项目/角色/消费日志任一写入失败均原子回滚；不保留“项目已建但资源未扣”的中间状态。可信钱包来源、直接改钱包、付款两重载及余额初始化另列阻塞，不能由本函数局部修复推出完整计费安全。

## 邀请真源与未来适配

本批逐项对照现有UI/API、public.invitations、缺失的project_invitations、project_roles和远端两邀请签名。产出具体调用矩阵、实际表约束/角色、TABLE结果处理、未注册邮箱、令牌解析、权限/席位事务、取消/过期/重复接受和回退规则；不写邮件、不调用真实认证/支付或远端RPC。

未来适配以`public.invitations`为邀请事实，`project_roles`为访问事实；原始token不用于日志，不把用户提交邮箱当已验证邮箱，不从邮箱推断已有用户。仅持有链接不足以接受指定邮箱邀请。定义文档须区分本批局部已实现和未来适配未实现，不能把兼容草案当上线功能。

## 验收与边界

先在原定义上保存本人缺失/伪造接受以及零券创建的真实RED，再用候选验证所有正反例。实际并发至少覆盖两个接受竞争、成员撤销/删除/改绑和项目转移先后次序，以及券/席位竞争与充足资源。观察pg_locks和阻塞者，不能只用延时推定发生等待。测试正常、污染PG环境、fixture就绪后的SIGTERM、实际启动失败和连接失败清理。

与前批导出候选组合：旧匿名/伪造接受不能再制造成员状态后获导出；本人合法接受后可登记本项目请求，撤权后再拒绝。不能声称其他未修RPC、直表权限或Storage已安全。全量项目验证、独立规格/质量/批次审查、来源与链接核验、handoff更新后，按原G0/G1判定推送，不能新增“本地实验完成即里程碑”。

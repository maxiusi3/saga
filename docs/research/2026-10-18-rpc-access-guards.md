# RPC邀请接受与项目创建：本地权限候选记录

2026-10-18（Asia/Taipei）。承接[PG17依赖与导出候选](2026-10-18-pg17-routines.md)，按[本批规格](../superpowers/specs/2026-10-18-rpc-access-guards.md)及[实施计划](../superpowers/plans/2026-10-18-upgrade-rpc-access-guards.md)完成两原签名候选和邀请兼容核查。**本地验证、Task 1–3及最终整批独立审查通过；交接与完整性核验完成。** 当前结论以[验证汇总](evidence/2026-10-18-rpc-access-guards/verification.json)为准。

## 本批实现与契约

候选仅在[隔离实验目录](../../experiments/pg17-access-guards/README.md)，复用固定快照、已审私有定义和原生PostgreSQL 17.4；没有修改应用、旧实验、依赖、根迁移或生产环境。两个入口保持完整签名、默认参数和返回形状，空search_path、对象限定、NULL安全本人检查；撤销PUBLIC/anon/metadata_reader/service_role执行权，仅授予authenticated。

| 入口 | 本地候选行为 | 仍不具备的保证 |
|---|---|---|
| `accept_project_invitation(p_invitation_id uuid,p_user_id uuid)` | ID是project_roles.id。读取初始project/user绑定，按项目→成员持锁，重验同一绑定及当前本人、pending/角色、active项目和当前facilitator邀请者；只激活已有目标成员并返回一行更新值 | token/确认邮箱/期限/席位预留；历史或ABA不可改绑；已active重试成功 |
| `create_project_with_role(project_name text,project_description text,facilitator_id uuid,creator_role text)` | 锁本人既有钱包；同事务扣1券及1对应席位、建active项目/角色并记两条amount=-1的consume；payment_status显式unverified | 可信余额授予/付款证明、其他钱包入口安全、请求幂等/未知提交去重 |

绑定裁定保持原签名：首次读取的`(project_id,user_id)`仅为本次调用一致性基准，授权仍依赖锁后当前状态。首次读取前已提交的合法绑定按当前事实判断；不能证明历史从未改绑或两次读取间未变更后恢复同一绑定（ABA）。更强历史保证需要另行设计可信版本/映射及迁移，不在本兼容批内。两次有完整资源的创建可各提交一次；响应丢失后应核对结果，不能盲目重试。

[邀请兼容核查](2026-10-18-invitation-compatibility.md)重扫五处调用及真实UI链，区分用户JWT、admin验证、service RPC、TABLE返回和预读fallback。固定invitations的12列/约束/唯一token与project_roles实际CHECK/独立唯一索引已核对；project_invitations缺失，两种ID没有映射。取消路由、非原子返席、过期/cleanup及赠送余额旁路仍存在。未来token适配须以invitations为邀请事实、project_roles为访问事实，完成可信身份/确认邮箱→token状态/期限→当前邀请者→持久预留→原子绑定/状态；本批未实现正式适配。

## 实际验证与独立审查

| 证据 | 结果与归属 |
|---|---|
| [Task 1审计](evidence/2026-10-18-rpc-access-guards/invitation-contract-audit.json) | 作者核对5处调用、32源哈希、245行范围、184 JSON Pointer、145元数据值及38链接；[独立规格/质量审查](evidence/2026-10-18-rpc-access-guards/invitation-task-review.md)PASS |
| [原定义RED与初始实现](evidence/2026-10-18-rpc-access-guards/implementation-verification.json) | 无claim/伪造调用可激活，零券仍创建；真实RED先保存。初始116场景/1828断言/25锁等待仅为历史结果 |
| [初审](evidence/2026-10-18-rpc-access-guards/access-task-review.md) | 两轴CHANGES_REQUIRED：P2 R1，等待期间同项目改绑到调用者仍可激活；原报告保留 |
| [修复验证](evidence/2026-10-18-rpc-access-guards/implementation-verification-fix1.json) | R1先在旧候选真实RED（退出1、发生激活），再保留initial_user并比较；最终正常/污染环境各117场景/1834断言、26次实际锁等待；R1为42501且七表零写入 |
| [修复复审](evidence/2026-10-18-rpc-access-guards/access-review-fix1.md) | 独立规格PASS、质量PASS，R1已关闭、无残留发现；最终生命周期4类通过，预期退出0/143/1/1，清理完整且无rescue |
| [本批项目检查](evidence/2026-10-18-rpc-access-guards/project-checks.json) | 控制器本会话执行verify/shared/infra，均退出0：Web77套766项、shared4套16项、infra7项、175页构建；Task 3只复核707输入/3日志哈希与next-env原字节，未重跑 |
| [Task 3完整性检查](evidence/2026-10-18-rpc-access-guards/final-checks.json) | 工作树保留、799实验依赖及Node指纹、链接/空白、私有正文与凭据模式未公开；具体计数见报告。 |
| [最终整批独立审查](evidence/2026-10-18-rpc-access-guards/batch-final-review.md) | Task 3规格/质量及整批复核PASS；生产质量门仍未通过 |

初始实现/修复清单中的“待审查”是写入时状态；后续Task 2审查结论来自独立复审，未回写旧证据。Task 1审计的原规格和原计划哈希同样保留：Task 2仅澄清规格两段绑定边界，Task 3更新计划状态/勾选及证据链接，汇总另记新旧哈希；其他30个源哈希继续匹配。

依赖未改，未重跑audit，前批[42项失败](evidence/2026-10-17-rls-rehearsal/audit-high.json)仍有效（34 high、8 moderate、0 critical）。构建仍有缺Supabase服务配置与旧Next配置提示，不能作为生产配置通过证明。

## 后续与质量门

1. 完成token/可信确认邮箱/持久席位预留及TABLE处理、取消/过期/重复/未知提交适配；历史绑定需要更强保证时另做版本/映射设计。
2. 审查钱包初始化/赠送/直表旁路及两个付款重载的可信服务端支付来源和持久去重；unverified与消费日志不构成付款凭据。
3. 补生产认证/角色继承/ACL/RLS/Storage与旧RLS/来源矩阵的PG17集成、七个未登记迁移的历史等价及回退、bucket/对象/备份恢复、供应商资格、正式资产/删除/Worker/会话adapter和G1真机5/20/30分钟矩阵。

[原质量门判定](evidence/2026-10-18-rpc-access-guards/milestone-check.json)：G0/G1均未达成。本批不是新里程碑；未提交、未推送GitHub、未合并、未远端迁移或部署。D01–D16全部A及原产品范围保持。

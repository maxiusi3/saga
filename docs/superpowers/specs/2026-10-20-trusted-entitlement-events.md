# 可信权益事件与邀请权限：本地候选规格

2026-10-20。承接 [handoff](../../HANDOFF-2026-10-13-upgrade.md) 的下一项及 [邀请事务契约](2026-10-18-invitation-transactions.md)。本批补齐可运行的事件入账、持久去重、撤销及邀请组合验证；不是生产支付集成。

## 约束

- 只新增 `experiments/pg17-entitlement-events/` 本地候选、测试和本批文档。复用已有 PostgreSQL 17.4 Harness、已审固定快照和邀请候选，旧源码/证据不改写；现有应用、依赖、根迁移保持不变。
- 保留 `codex/october-upgrade-p0` 当前未提交工作。无远端查询、真实身份/邮件/支付/家庭资料、迁移、部署、commit 或 push。原 G0/G1 未通过；仅原升级里程碑达成才推送，不新设本地里程碑。
- SQL 仅在现有合成数据库且独立 marker 存在时可安装。空 search_path、限定对象、无 PUBLIC 默认函数权限。真实低权限连接验证权限，GUC 中的角色文字不能充当可信事件身份。
- 权益事件来源是独立数据库角色 `entitlement_writer`，仅能执行事件入口/结果查询，无直接表写权限，不向 anon/authenticated/service_role/metadata_reader 授予该角色。它代表上游已经核实的服务端事件；签名、供应商账户、商品映射及生产凭据部署另验，不把合成输入叫作真实付款。

## 事件与来源

`entitlement_candidate.apply_event(provider text,event_id text,source_key text,kind text,payer_id uuid,resource_type text,quantity integer)` 返回一行 `source_id uuid,outcome text,revoked boolean`。kind 仅 grant/revoke，resource_type 仅 facilitator_seat/storyteller_seat，quantity 为正整数。provider/event_id/source_key 是有界、非空、大小写敏感的 ASCII 标识；具体字符集/长度须在 README 明示并测试边界。拒绝 NULL、空白和非法值。event_id 在 provider 内唯一；source_key 在 provider 内唯一。

- 事件固定完整类型化 payload，禁止同事件键改 kind/payer/resource/quantity/source。相同 payload 重投返回原 source；不重复授予、撤销或记账。不同事件键引用同 source 的重复 grant 也不得重复发券。source 的 payer/resource/quantity 首次固化，后续不得改绑。
- 首次 grant 原子创建来源、事件/来源关联和审计事实，并在既有或新建零余额钱包增加对应数量。新钱包其他余额为零；不能调用旧赠券初始化。保留旧余额、付款引用、项目 payment_status 及历史日志，不把余额当付款证明。钱包存在 NULL 或算术溢出时拒绝并全回滚。
- revoke 为不可逆的来源终态。revoke 先于 grant 时创建撤销墓碑，后到 grant 不得授予。重复事件、不同 revoke 事件均不重复副作用；没有重新激活入口，新的权益需独立 source_key。
- 授予来源复用 invitation_candidate.trusted_seat_sources，由保护账本绑定至事件；普通调用者无法制造或修改来源。安装遇到没有账本关联的旧来源/绑定应拒绝，不默认为可信或自动收养历史；这是空环境组合候选，不是数据迁移脚本。重复安装不重放业务。
- 持久查询 `entitlement_candidate.lookup_event(provider text,event_id text)` 仅 writer 可用，返回对应 source_id/outcome/revoked 当前事实；不存在返回零行。必须实际提交后丢弃 apply 返回，再从新连接恢复，明确未知提交不能凭预读制造成功。

## 邀请组合、撤销与锁

复用 send/accept/release/status/lookup 的已实现契约。grant 后可以发送、接受、取消和到期释放；同键/同目标重试不重复预留，跨项目同钱包不能超额。撤销来源必须阻断新 send、pending accept、已接受邀请的再次确认；reserved 邀请仍可取消/到期释放且恰好返还一次，返还不解除 revoked。

本批钱包是保留兼容的总量镜像，撤销不把已消费/预留的席位猜测成可减余额；release 仍返还原镜像和原来源。**实际可用权益必须同时满足账本来源未撤销和 remaining，不能凭镜像消费。**因此本批必须停用所有未经来源校验的旧 public 写 RPC，包括旧创建项目、余额初始化/授予、两付款重载、旧邀请写入口；保留原定义字节，仅撤销 ACL。两个已审导出候选只保留 authenticated 入口。README 列出精确签名与兼容影响；正式应用尚不能开启这些候选。

撤销 consumed 来源时，仅将本来源持久映射且当前 project/user/role 仍匹配的 active 成员置 inactive，保留成员/邀请/绑定/历史，不自动删除或恢复；已经 inactive/已删不重建，绑定发生不匹配拒绝并全回滚。已有合法无关成员不变。仅靠该成员映射获得访问的人，撤销后不能通过两个导出候选获得新导出资格；独立的项目所有者资格不因席位来源撤销而消失。已提交的导出任务、现有 URL 和 Storage 撤权仍需正式 Worker/交付再授权。

撤销必须遵守现有 project → wallet → source/binding → member 的相对锁序，多项目按 UUID 排序；初始发现仅用于定位，持锁后重读，不能漏掉扫描后新增的绑定。若无法在不倒置锁序的前提下覆盖新增项目，可明确抛 40001 并全回滚供可信调用者重试。并发实验必须观察实际 pg_locks/blocking_pids，不以延时推断等待。覆盖 revoke 与 send/accept/release 先后顺序、同源/不同源事件竞争及共享钱包。

## 权限与验收

候选安装显式撤销敏感 public 表的直接写入和列级写权限（projects/project_roles/project_members/user_resource_wallets/seat_transactions/invitations），及候选表所有普通角色权限；防范 PUBLIC、显式列级授予、旧 SECURITY DEFINER RPC 旁路。测试夹具先授予模拟表/列/RPC 权限，再验证安装实际收紧。writer 不能伪造 auth 成员或直接写钱包，也不能 SET ROLE 到 owner。此实验不声称复现全部生产角色继承/RLS。

验收需保留真实 RED（缺事件入口、旧 RPC/列权限仍能写或绕过的预期失败）、最终 GREEN、完整相关表快照的拒绝/故障零写入、各类写入故障与 caller rollback、重复安装/DDL rollback。真 PG17 包括两角色席位、事件冲突、来源冲突、撤销先到、未知提交恢复、历史不变、越权和并发；保留正常及污染环境运行、SIGTERM/启动失败/连接失败清理。来源/运行时输入有 SHA-256 记录，公开输出不得泄漏捕获的私有函数正文、凭据或生成的邀请 token。

本批独立实现/审查后运行 `npm run verify`、shared 和 infra，恢复 next-env 原字节。更新 handoff、总计划、docs 索引、P0/P1 状态及本批证据，独立复核结果和原质量门判断。仍缺真实 provider/部署、Storage、迁移历史/回退/备份、供应商条件及真机证据，G0/G1 保持开放。

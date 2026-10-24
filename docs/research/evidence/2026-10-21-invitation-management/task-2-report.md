# Task 2：邀请管理 HTTP、共享 UI 与恢复

2026-10-21。按绑定规格完成本地应用实现。14个应用/测试文件与5个新SQL实验文件的最终内容见 [source-sha256.json](source-sha256.json)。旧实验、依赖、根迁移与先前原始证据保持不变；未提交、推送、远端迁移、部署或调用实际供应商。

两个新 POST 读取入口要求 management 和 transaction 开关均精确 true；关闭时先拒绝且零 body/config/认证/业务 I/O。输入严格限制项目、角色或 UUID cursor。逐请求匿名 key 的实际 Supabase SDK 先 provider getUser、再用同一 Bearer 调用受限 RPC，认证/正文/数据库读取共用十秒截止和 caller abort。无 Cookie/service 回退、无自动重试，失败不回显上游正文，也不判断先前写入是否提交。行解析拒绝越界、乱序、重复、外项目/角色及畸形状态，构造最小投影并去除多余属性。旧 GET/DELETE/cleanup 仍关闭。

dashboard 邀请页与嵌入 InvitationManager 使用同一组件，从 auth-store 获取会话，只能选择读端口返回的 source ID；send/lookup/release 复用前批客户端和事务。当前成员仍显示角色/状态并按成员记录 ID 删除，不编造邮箱或 Owner 身份。send 成功只称邀请登记，链接仅由确认结果产生且只留内存；列表不含 token。当前项目的 pending/过期邀请直接走全局 release，不把 sender lookup 作为前置；历史恢复显式 lookup 并核对 invitation ID。UUID keyset 支持下一页/首页。

发送前必须成功写入并回读一个 sessionStorage 票据，仅 version/actor/project/request/role；不保存内容、邮箱、source、token 或 Bearer。unknown 后阻止新发送，刷新/重挂载后仅显示显式查询，lookup 被拒或未知保留票据，不自动重发。账号/项目切换与同 batch 退出再返回通过身份世代、abort、当前上下文检查和同步动作锁隔离。角色切换清除旧链接。保存失败不发出；确知未 dispatch 的本次票据在 departure 时立即精确删除，即使取 token 永不完成；已 dispatch 的未知票据保持。

## RED、修复和复审

- 最初 UI 测试中，缺少 seat source 选项的真实失败见 [ui-red-final.log.txt](ui-red-final.log.txt)。更早两个 ui-red 输出含 mock/harness 问题，不能单独证明产品旧行为失败。
- 新 HTTP/recovery 早期缺模块与测试 fixture 失败、回归定位修正均保留在 [运行分发清单](published-log-manifest.json)；没有覆盖原始输出。
- 独立审查提出一个 Important（取 token 期间离开留下不存在请求的永久票据）和一个 Minor（角色切换保留旧链接）。[review-fix-red.log.txt](review-fix-red.log.txt) 的三个真实回归先失败，再修复；[review-fix-green.log.txt](review-fix-green.log.txt) 两套22项通过。
- 状态类型原先 String coercion 已收紧为实际 string，并新增数组状态拒绝；同 batch 身份 ABA 已有回归。独立复审重读 SQL/HTTP/UI，并独立运行5套54项，规格/质量 Approved，零未修项，见 [implementation-review.md](implementation-review.md)。报告中的初审行号属于格式化前快照，最终附录记录冻结哈希。

## 最终验证

控制器冻结格式化后的源码后，于 2026-10-21 23:01:19—23:04:58（Asia/Taipei）运行：定向5套54项；完整 verify 内 Web105套1420项、typecheck、lint、180静态页构建；shared4套16项；infra7项；git diff --check。五命令均 exit0，796应用输入无变化，next-env恢复原字节。命令、时间、退出码、原始与公开日志哈希见 [project-verification.json](project-verification.json)。公开日志使用 `.log.txt`，原始输出留在忽略的恢复目录，分发映射保留两端哈希及脱敏标记。

验证限制：实际 SDK 对接合成本机 loopback，React 测试使用合成 fetch/store fixture；SQL 使用真实隔离 PG17 和合成身份/事件，不是真实 Supabase Auth/JWT/PostgREST 全链或支付/邮件送达证明。成功 build 仍输出旧 Next 配置与缺服务端 key 的 configuration-validation 诊断，不能证明生产配置完整。依赖不变，历史 audit42项（34high/8moderate）未重跑、未解决。

# 认证返回与浏览器／服务器会话衔接实施记录

2026-10-19（Asia/Taipei）。当前本地实现已完成，Task 1独立规格复审PASS、质量复审Approved且无新规格问题；固定源码后的全项目检查通过。文档独立审查、整批独立审查与最终完整性均已通过，当前状态见[验证汇总](evidence/2026-10-19-auth-session-integration/verification.json)。本批不构成原G0/G1里程碑，无提交、GitHub推送、迁移或部署。

## 原因与最终行为

[前批认证回跳加固](2026-10-19-auth-return.md)保留了严格signin和服务端callback，但浏览器共享client仍使用plain supabase-js的implicit/localStorage默认值，服务端只能消费code或token_hash并写SSR cookie。fragment不会送达服务器；旧持久化auth-store还可能恢复过期UI身份，OTP曾把error=null当成功。前批混合error/fragment探针及其后续建议保留为日期历史，本批没有把安全拒绝改回成功。

共享`createClientSupabase()`现使用已安装`@supabase/ssr`的浏览器PKCE/cookie实现，保留SDK编码、分块和浏览器单例；`detectSessionInUrl=false`，SDK不能绕开页面验证自动兑换URL。既有有界callback负责自动code兑换，干净显式signin session-return继续走前批严格parser。服务端无请求上下文的匿名client不持久化、不自动刷新、不检测URL，不共享浏览器身份；缺配置的预览auth stub明确失败，包含OTP/setSession，不制造成功。

旧localStorage仅尽力删除三个精确key：`auth-store`、`sb-<Supabase URL hostname首段>-auth-token`及其`-code-verifier`。不读取或导入旧凭据、不枚举清空storage，不动录音IndexedDB、草稿和业务数据。已有cookie由SDK恢复后经provider核实；仅有旧localStorage会话的用户需要重新登录。

Store不再持久化认证身份。初始化与监听幂等，先监听再核对现有session，身份验证在SDK回调外进行。当前完整session必须与provider `getUser`匹配才能发布认证身份；退出、缺会话、拒绝或换账号使旧结果失效。已经核实的同一用户在焦点恢复或token刷新时保留dashboard子树，避免正常刷新触发录音组件卸载；并发token读取及getter自身引发的成功刷新会等待当前核实，返回当前token。A→B→A和退出后同用户重登仍使旧读取失效。

`getAuthenticatedUser`使用公开URL/anon key核实Bearer或请求cookie，无需service-role才能验证身份。显式Authorization无效时不借用另一个cookie身份；cookie user声明本身不授予身份。SDK `getAll/setAll`支持任意分块、options和删除，十秒总截止含caller abort，最多一次refresh和一次user读取。暂时网络/服务故障返回安全503，并阻止用于限制重试的合成错误删除可恢复cookie；真实拒绝仍传播删除，成功刷新已取得的cookie写入在随后user查询故障时仍保留。浏览器Auth错误边界清除原始provider诊断，保留安全SDK日志和正常重试/成功语义，不全局静音console。

数值OTP须得到完整session/user才返回安全next，重发使用同一callback目标；重复提交、卸载、query/URL变化使晚到结果失效。首页不再把fragment凭据复制到query；误落首页的认证输入清理后进入固定错误重新登录。只有精确单一裸`?type=invite`、无fragment或额外query时保留`router.push('/<locale>/accept-invitation')`原链接指引，该分支不读session、不fetch、不认证或猜测邀请。middleware删除硬编码畸形域名修补，正常locale路由与规范PKCE callback保留。旧fragment-only、畸形callback不恢复为成功。

前批strict signin/callback、一次选定POST、verifier隔离、保留cookie的303、固定错误、deadline、安全next与八语言规则继续有效；provider丢next时回dashboard，无auth_next或替代持久缓存兜底。

## 最终证据与审查

[最终21路径源码冻结](evidence/2026-10-19-auth-session-integration/fix2/source-freeze-fix2.json)由恢复目录`frozen-source.json`绑定到[控制器新项目报告](evidence/2026-10-19-auth-session-integration/project-verification-20261019T123731Z.json)。当前结果直接取自各原始日志，不由前批数量推算。

| 检查 | 实际结果 | 证据 |
|---|---|---|
| 最终认证／邀请／相关录音定向 | 28套、605项通过 | [fix2 focused](evidence/2026-10-19-auth-session-integration/fix2/focused-final.log.txt) |
| 实际Chromium合成链 | 14项通过 | [结果](evidence/2026-10-19-auth-session-integration/fix2/browser-results.json)、[日志](evidence/2026-10-19-auth-session-integration/fix2/browser-final.log.txt) |
| 最终Web typecheck／五路径lint | 进程exit 0；lint无输出 | [typecheck](evidence/2026-10-19-auth-session-integration/fix2/typecheck-final.log.txt)、[lint](evidence/2026-10-19-auth-session-integration/fix2/lint-final.log.txt)、[实现者执行报告](evidence/2026-10-19-auth-session-integration/task-1-fix2-report.md) |
| 控制器新`npm run verify` | exit 0；Web96套/1278项、176页构建 | [完整日志](evidence/2026-10-19-auth-session-integration/project-verify-20261019T123731Z.txt) |
| 新shared／infra | exit 0；shared4套/16项、infra7项 | [shared](evidence/2026-10-19-auth-session-integration/project-shared-20261019T123731Z.txt)、[infra](evidence/2026-10-19-auth-session-integration/project-infra-20261019T123731Z.txt) |
| 独立规格复审 | 两个P2关闭，PASS；独立2套/23项 | [报告](evidence/2026-10-19-auth-session-integration/task-1-spec-fix1-review.md) |
| 独立质量复审 | 一个P1、两个P2关闭，Approved，无新规格问题；独立5套/41项 | [报告](evidence/2026-10-19-auth-session-integration/task-1-quality-fix2-review.md) |

新项目矩阵执行于2026-10-19T12:37:31–12:40:22Z（台北20:37:31–20:40:22），773输入无变化，next-env恢复起点字节，SHA-256为`7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651`。构建仍有旧Next `eslint`配置、`images.domains`弃用及缺少`SUPABASE_SERVICE_ROLE_KEY`的configuration-validation诊断；成功构建不证明生产配置合格。现有lint规则较宽松，不能代替语义审查。

## 浏览器覆盖及明确边界

Chromium147.0.7727.15实际加载生产facade/store及安装的SDK，使用真实导航/cookie；本地HTTP桥调用生产callback和guard。fixture核对S256 challenge/verifier、单次消费code并验证合成token，不无条件接受请求。链路覆盖OAuth→callback→安全locale目标→新页面恢复同一已核实身份，邮件PKCE code、token_hash、数值OTP，SSR cookie/Bearer一致，缺verifier、混合输入、无效Bearer与退出后SSR拒绝。请求仅允许精确loopback origin，service worker关闭，最终无被阻止外联。

这是一页合成HTML桥，**不是完整Next页面部署验收**；OTP/home/signin/邀请页面另由组件回归覆盖。刷新、超过五块cookie、删除、伪造身份、异常及十秒deadline由实际SDK定向测试覆盖，不能全部归到14项Chromium。独立DashboardLayout探针确认同用户事件前中后1次mount/0次unmount；它没有使用真实麦克风。真实Google授权、SMTP投递、Supabase JWT签名/RLS/PostgREST、生产域名/redirect/cookie配置及G1真机仍未验证。

[浏览器结果](evidence/2026-10-19-auth-session-integration/fix2/browser-results.json)保留两条预期401资源console消息，分别来自无效Bearer及退出后请求；不是隐藏的成功路径故障。[清理记录](evidence/2026-10-19-auth-session-integration/fix2/browser-cleanup.json)确认fixture不再监听、socket为0、所属浏览器关闭、所属临时目录删除，只清理本次资源。

## 保留的失败与修复

初始[RED](evidence/2026-10-19-auth-session-integration/red.log.txt)实际12失败/1通过，复现无PKCE/cookie、旧缓存身份和OTP假成功；[guard/home RED](evidence/2026-10-19-auth-session-integration/red-guard-home.log.txt)6失败/2通过。初次GREEN因jsdom缺TextEncoder退为plain challenge，随后补测试环境；前两次浏览器桥因NextRequest把127.0.0.1正规化为localhost被精确origin限制拒绝，调整仅在harness；middleware ESM加载及裸invite原断言失败均保存，后者按规格保留且未弱化既有邀请断言。晚到token读取、缺session和provider拒绝竞态的RED也保留。

[规格初审](evidence/2026-10-19-auth-session-integration/task-1-spec-review.md)发现原始SDK诊断外泄和合法并发读取互相失效，fix1真实RED/GREEN后独立PASS。[质量初审](evidence/2026-10-19-auth-session-integration/task-1-quality-review.md)发现同用户刷新卸载dashboard、getter自身刷新返回null、暂时故障删除可恢复cookie，fix2真实RED/GREEN后独立Approved。初始18套/505项和fix1的19套/515项属于历史源码，当前以fix2的28套/605项为准；所有原始报告、失败、freeze和manifest保留，不覆盖原结论。

仓库忽略`*.log`，公开引用使用[38份逐字节相同的`.log.txt`及别名清单](evidence/2026-10-19-auth-session-integration/published-logs.json)。不改原日志或ignore规则；不可变实现者报告/manifest中的`.log`是本地原件，公开副本可按清单核对同一SHA-256。[证据索引](evidence/2026-10-19-auth-session-integration/README.md)列出最终与历史材料。

## 续接与原质量门

RB1本地code/cookie根因修复及合成集成已完成，不再作为下一本地实现重做。真实提供方/部署资格仍开放；独立下一任务可推进可信权益source/event供给、撤销与持久去重、send/release及直接RPC/表ACL。可信pending/最小预览、历史opaque token/member映射及前向/回退另行验收。

按[原G0/G1条件](../superpowers/specs/2026-10-13-upgrade-p0-gates.md)，正式权限/adapter、Storage/bucket、迁移历史等价/回填/回退/备份、供应商条件和设备故障/保存恢复/离线导出证据仍缺，[里程碑判定](evidence/2026-10-19-auth-session-integration/milestone-check.json)保持false。历史audit42项（34high/8moderate）未重跑未修复；生产开关未启用。本批未调用真实Auth/邮件/付款、访问家庭资料或更改依赖与根迁移；没有GitHub推送。

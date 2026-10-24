# 认证回跳：安全目标、日志与旧状态清理

2026-10-19（Asia/Taipei）。分支 `codex/october-upgrade-p0`，HEAD `1caa21a72a23d6f5166ed127847ca931374b890a`；基于本批开始时的工作树，保留此前所有未提交工作。依据[绑定规格](../superpowers/specs/2026-10-19-auth-return.md)与[实施计划](../superpowers/plans/2026-10-19-upgrade-auth-return.md)。

本地实现、Task 1 独立规格／质量审查及控制器新执行的完整项目验证已通过；**实际 OAuth/OTP 返回路径与浏览器／SSR 会话衔接仍有开放发布阻塞**。Task 2 独立文档审查、整批独立审查与最终完整性核验均已通过，本批本地收尾完成。当前状态及产物 SHA-256 见[验证汇总](evidence/2026-10-19-auth-return/verification.json)，原始输出索引见[证据目录](evidence/2026-10-19-auth-return/README.md)。G0/G1 仍为 false，没有提交、推送、迁移或部署。

## 已实现的边界

只修改三个既有应用文件：signin 页面、callback route、AuthProvider；新增共享 `auth-return` helper、服务端 callback adapter、三份测试与一个合成 loopback fixture。原邀请协议、页面与测试、共享浏览器 Supabase factory、auth store/session 持久化、依赖、旧实验／运行时、根迁移和旧证据保持不变。

`next` 只读取当前 URL 中的显式值，经 URLSearchParams 解码一次后验证，不 trim、不再 decode。长度最多 2,048；缺失、重复或非法时回当前合法 locale 的 dashboard，非法 locale 回 en。支持完整八语言 `en`、`zh-CN`、`zh-TW`、`ja`、`ko`、`es`、`fr`、`pt`；目标本身已有合法 locale 时保留。

| 允许的目标 | 约束 |
|---|---|
| `/dashboard` 及子路径 | 每段为非空 ASCII 字母、数字、下划线或连字符；不带 query/fragment |
| `/invite/<token>` | token 必须为 `v1_` 加 32 位小写十六进制 |
| `/accept-invitation?token=<token>` | 恰一个同契约 token，没有额外 query/fragment |
| 上述三类的 locale 前缀形式 | 只支持现有八语言，不能重复前缀 |

任意其他站内路由、绝对 URL、双斜线、反斜线、点段、空白／控制字符、引号／HTML、百分号残留、尾斜线、fragment、嵌套 next 或认证参数均不成为目标。非法原值不进入日志、固定错误或 provider redirect URL。规范邀请 token 仍可作为必要路由参数出现在安全 next/Location；它本身不授予成员访问权。

Signin 和 AuthProvider 挂载时只 best-effort 删除 `localStorage.auth_next`，不先读值、不写回、不新增 TTL/key 或替代缓存，也不清除其他 session/storage key。storage getter 或 removeItem 抛错不会中断流程。**provider 若丢失显式 next，返回 dashboard，不恢复旧邀请**；这是清除持久化兜底带来的明确兼容变化。

Signin 移除完整 URL/search/next 和原始认证错误日志，以固定文案处理失败。显式且无错误参数的 query/fragment session-return 由 SDK `setSession` 验证；只有完整、未过期 session 与一致的 UUID user 才通过，不解码 JWT 制造用户，也不把 `error:null` 或空 session 当成功。重复／混合／畸形输入失败，URL 认证字段尽力清到规范 next。页面用 replace 导航，同一上下文重复 effect 复用页面自己的 session 尝试；卸载、渲染上下文改变，或真实 pathname/search/hash 已先于 React 改变时，旧结果不更新 UI 或导航。

Google 仍由现有登录入口发起，但使用 SDK `skipBrowserRedirect: true`；页面校验返回 URL 为配置的 authorize 端点、单一 google provider 与精确安全 callback URL，仅在原流程仍有效时导航。邮件仍形成安全的 emailRedirectTo 请求。**入口与请求形成、干净显式 session-return 的测试，不证明 Google/OTP 端到端登录兼容。**

## Callback 的实际 SDK 与响应行为

Callback 先验证输入，再创建实际 `@supabase/ssr` client。只接受一个非空 code，或一对 token_hash/type，两模式互斥。重复身份字段、缺半边、未知 type、空白／控制字符、超长字段及任意 error 参数均固定失败；被拒输入不创建 client。code/token_hash 视为 opaque 输入，最多 4,096，不再次解码。type 只接受 email、magiclink、invite、signup、recovery、email_change。

本地已安装并实际执行 `@supabase/ssr` 0.10.2、`@supabase/supabase-js`／`auth-js` 2.105.3。adapter 仅使用公开 URL/anon key；同一 client 只进行选定的 exchangeCodeForSession 或 verifyOtp。运输层只放行本次模式对应端点的一次 POST，拒绝其他端点、重入与 HTTP redirect；无重试、模式回退、service key、额外 getSession/getUser 或凭据重放。

该请求的 cookie 在 callback 内局部隔离：仅向 SDK 提供本次 PKCE verifier 的值，旧 session cookie 只保留名称供分块删除。实际 SDK 即使关闭 autoRefreshToken，INITIAL_SESSION 仍可能刷新过期 cookie；隔离避免旧 session 触发隐式 refresh 或成为兑换兜底，不改变共享浏览器会话策略。一个十秒总截止覆盖 operation、fetch 和 response body，并响应 caller abort；完成后清除 timer/listener。传输与 body 错误先转换为安全合成错误，避免 SDK 内部打印原始异常。

成功须有完整、未过期 session 和匹配的提供方 user；返回 token 的格式独立验证，不错误套用 4,096 的 URL 输入上限，测试覆盖 8,000 字符输出。通过标准 HTTP 303 到当前 origin 的安全目标，保留 SDK 写出的 cookie 分块、删除项及各自 options。失败固定重定向 signin，保留安全 next，不能输出新 session cookie，只能保留明确删除 cookie；配置、cookie 读取／序列化异常也安全失败。所有 callback 响应均有 `Cache-Control: no-store`、`Referrer-Policy: no-referrer`，没有 HTML／内联脚本回跳或原始错误回显。

这些响应头和 replaceState 清理只约束本次处理，不能证明上游访问日志、已写入浏览器历史、外部 SDK 自动行为或全站认证遥测已清除敏感值。

## 具体兼容变化：仍阻塞发布

共享 factory 仍是默认 implicit flow 的 plain supabase-js，并保留原 browser localStorage/session store。若提供方把 access/refresh token 放在 callback 的 fragment，服务端读不到 fragment；缺 code/token_hash 时会返回固定 `error=auth_failed`。当 fragment 随重定向继承到 signin，当前页面对“错误＋session 凭据”的混合输入安全拒绝；旧页面曾忽略错误并接受 session。此容错没有继续保留。

单独的前后探针直接编译 recovery 中不可变的旧 signin 字节，与当前页面挂载到同一合成 URL，并替换 SDK/router 边界：

| 同一个 `error=auth_failed`＋合成 implicit fragment | `setSession` 调用 | 导航 | 当前可见结果 |
|---|---:|---:|---|
| 本批前页面 | 1 | 1 | 旧页面继续 session 路径 |
| 当前页面 | 0 | 0 | 固定安全错误，fragment 清除 |

[原始探针输出](evidence/2026-10-19-auth-return/implicit-fragment-compatibility-probe.txt)与[可复现源码](evidence/2026-10-19-auth-return/implicit-fragment-compatibility-probe-source.txt)保留，1 个 probe test 通过，exit 0。临时测试副本在 finally 删除；没有替换当前应用文件。这证明**真实页面实现的范围内兼容变化**，不是仅仅“未测提供方”，也不是已运行真实浏览器／provider redirect 链。RB1 保持 OPEN，Task 1 Approved 不消除该阻塞。

## 运行证据与历史失败

| 证据阶段 | 实际结果 | 可支持的结论 |
|---|---|---|
| 原源码 RED | 2 套／5 项失败，Jest/npm exit 1 | 旧 key 未删、原始错误与完整 callback URL 披露、push 导航、307 与缺少隐私头；不声称执行了 code-sentinel 披露 |
| 扩展契约与首次实现 | 缺 helper 的导入失败；随后 57 failed／77 passed，exit 1 | 包含测试 harness 错误，不全算旧行为 RED；SDK 非 configurable export spy 后改为观察真实构造器 |
| opaque 输入／长输出 RED | 2 failed／103 passed，exit 1 | 修复过窄 code 字母表及把输出 token 混用输入长度上限 |
| 后续完整定向中间结果 | 411，随后 414 项通过，exit 0 | 保留为历史；414 和 `final-source-sha256.txt` 已由 v2 替代 |
| 原类型检查 | exit 2 | callback input union 推断修复；不隐藏失败输出 |
| 原生 URL／输出 token RED → GREEN | 3 套，16 选中项先失败后通过；161 项由 pattern 过滤；exit 1 → 0 | 先复现再修复晚到结果与畸形 session token |
| 最终 v2 定向＋邀请回归 | 8 套／430 项全部通过，无跳过，exit 0 | 177 项本批测试＋253 项本次重跑的前批邀请回归 |
| 最终 v2 类型／九文件 lint | 各 exit 0，lint 无警告／错误 | 绑定同一最终九文件源码指纹 |

初始 RED 原始输出是 npm exit 1；当时 shell 随后显示日志，外层 shell exit 0 不能当作测试成功。M1 文案曾把执行过的 full-URL/error RED 与旧源码中 code/token_hash 日志混在一起；控制器已仅修正报告句子，[独立核验](evidence/2026-10-19-auth-return/task-1-M1-wording-verification.txt)确认两份当前报告一致、九个源码 hash 未变。[Task 1 最终独立审查](evidence/2026-10-19-auth-return/task-1-review.md)结论 Spec PASS／Quality Approved，无开放 Critical、Important 或 Minor。

权威源码清单为 [final-source-sha256-v2.txt](evidence/2026-10-19-auth-return/final-source-sha256-v2.txt)。此前清单与所有中间失败／通过输出原样保留，命令、退出码、结果计数和 SHA-256 分别登记在[机器可读汇总](evidence/2026-10-19-auth-return/verification.json)。

控制器在 **2026-10-19 11:39:25—11:41:51 Asia/Taipei** 冻结源码后新执行[完整项目验证](evidence/2026-10-19-auth-return/project-verification-20261019T033925Z.json)：

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `npm run verify` | 0 | 类型、lint、Web 85 套／1,196 项、176 页构建通过 |
| `npm test --workspace=packages/shared -- --runInBand` | 0 | 4 套／16 项通过 |
| `npm run test:infra` | 0 | 7 项通过 |

757 个验证输入在运行前后相同，next-env 已恢复本批起点字节。这是本批新运行，未重复旧 PG 实验。React 测试挂载实际 signin/AuthProvider，但替换 SDK/router/store；callback 使用实际 route/SSR/JS SDK，只连接合成 loopback Auth fixture。两者均不证明真实提供方、JWT、PostgREST、生产 cookie/localStorage 或远端权限集成。

构建仍输出旧 next.config.js 的 eslint 配置提示、images.domains 弃用提示及缺少 SUPABASE_SERVICE_ROLE_KEY 的配置错误；完整命令 exit 0 不代表生产配置验收。依赖没有改变，本批未重跑 audit；[前批真实审计](evidence/2026-10-17-rls-rehearsal/audit-high.json)仍为 42 项（34 high／8 moderate／0 critical）、exit 1，未解决。

## 完整性、审核与后续

Task 1 的独立核验基于 1,696 个本批起点文件，确认只改三个获准应用文件，其他 1,693 相同、无缺失。Task 2 仅新增本文与本批证据索引／汇总，更新 handoff、综合计划、docs 索引、P0 门定义、P1 契约五份既有文档。最终完整性确认恰为八个获准既有路径有变化；控制器在实际独立审查与文档收尾后重新核验通过。Task 1 的早期三文件检查仍保留为该阶段的历史结果。原 before 字节、源码／运行时、根依赖与迁移、历史证据及恢复目录继续保留。

1. Task 2 文档审查、整批独立审查及最终完整性已通过，计划状态已关闭；本批无需重做。
2. 下一实施批首先处理实际 OAuth/OTP 返回路由及浏览器／SSR 会话衔接，覆盖上述 mixed-error/implicit-fragment 阻塞，再验证合法 next、缺失 next、provider 错误和真实账号结果。共享 factory/store、verify、首页/middleware 的历史 implicit 兼容、全站日志／遥测仍需分别核查；不得凭本批测试宣称认证全链通过。
3. 然后推进可信权益 source/event 的供给、撤销、持久去重，发送／release 与直接 RPC／表 ACL；可信 pending／最小预览、历史 opaque token/member 的可信映射及前向／回退兼容仍单列。
4. 正式 PostgREST/Auth/RLS/Storage、七个未登记迁移语义对账、bucket／对象／备份恢复、供应商账户及 G1 真机仍按原质量门验收。保持生产开关关闭，G0/G1=false；达原里程碑才推送，不以本批本地通过另立里程碑。

本批未调用远端 Auth/数据库、真实家庭资料、邮件或付费 API；无 commit/push/merge/deploy/migrate。继续保留本地分支、未提交内容与恢复材料。

续接收尾：中断停在 Task 2 文档审查；现已取得[独立文档审查](evidence/2026-10-19-auth-return/task-2-review.md)及[整批独立审查](evidence/2026-10-19-auth-return/batch-final-review.md)，本批范围均 PASS／Approved，无新增缺陷。见[恢复核验](evidence/2026-10-19-auth-return/resume-validation.json)、[最终完整性](evidence/2026-10-19-auth-return/final-integrity.json)与[原里程碑判定](evidence/2026-10-19-auth-return/milestone-check.json)。本次只续接审查与文档；757 个项目输入及九个源码指纹仍与上午成功运行一致，复核了原始日志及哈希，没有重跑全量测试，也未把旧执行时间改写为本次。RB1、既有构建／依赖问题与 G0/G1 缺口仍保留。

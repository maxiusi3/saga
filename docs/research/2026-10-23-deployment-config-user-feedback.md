# Vercel、Auth 与隔离环境回传

2026-10-23（Asia/Taipei）。来源为用户在聊天「24」及其续接聊天提供的后台信息；本轮未登录后台、未读取密钥、未发起登录/邮件/AI 请求，也未部署或改配置。[首轮结构化记录](evidence/2026-10-23-supabase-feedback/deployment-user-report.json)与[首轮代码对账](evidence/2026-10-23-supabase-feedback/deployment-code-reconciliation.json)作为历史快照保留；其中待补 URL/提示的状态已由本轮[补充报告](evidence/2026-10-23-supabase-feedback/auth-url-user-report.json)及[静态核对](evidence/2026-10-23-supabase-feedback/auth-url-reconciliation.json)更新。

## 已确认的用户报告

- 没有隔离测试 Supabase 项目。测试预算尚未提供。
- Vercel 域名为 `maxiusi.dpdns.org`，报告的部署 commit 为 `1caa21a`，日期为“10月7日”。部署 ID、状态和域名绑定未在本轮独立核验。
- Supabase Google、SMTP 均启用，用户报告配置齐全。Site URL、Redirect URLs 与应用 URL 已补充；实际后台保存值、登录/投递、SMTP 发件域验证细节仍未独立核验。
- 环境变量已提供名称、范围、遮罩、日期及非秘密的 `NEXT_PUBLIC_APP_URL` 网址，未提供任何秘密值。下表的日期按界面原文保留，不擅自解释 `11/7/25` 的月日顺序或补齐 `Jun 24` 的年份。

| 变量 | 用户报告范围 | 界面 Needs Attention | 界面变更日期 |
| --- | --- | --- | --- |
| `ADMIN_CRON_SECRET` | Production | 有 | Added Jun 24 |
| `SUPABASE_SERVICE_ROLE_KEY` | All Environments | 有 | Updated Jun 24 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All Environments | 未报告此提示 | Updated Jun 24 |
| `NEXT_PUBLIC_SUPABASE_URL` | All Environments | 未报告此提示 | Updated Jun 24 |
| `SILICONFLOW_API_KEY` | All Environments | 有 | Updated 11/7/25 |
| `OPENROUTER_API_KEY` | All Environments | 有 | Updated 11/7/25 |
| `NEXT_PUBLIC_APP_URL` | All Environments | 未报告此提示 | Updated 11/7/25 |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | All Environments | 未报告此提示 | Added 8/15/25 |
| `NODE_ENV` | All Environments | 未报告此提示 | Added 8/14/25 |

遮罩只证明用户看到变量条目，不证明 key 当前有效、有额度或已进入那次部署。`SUPABASE_SERVICE_ROLE_KEY` 的具体提示现已收到，含义见下文；其余三项提示原文仍未知，不能将同一原因自动套用。本轮未改任何变量。

## 与本地代码的对账

1. 短 SHA `1caa21a` 在本地解析为 `1caa21a72a23d6f5166ed127847ca931374b890a`，与当前升级分支的基线 HEAD 一致，提交日期为 2026-10-07。后续未提交修复不包含在这个 commit 中。用户报告的线上版本因此仍指向升级前基线，不能用其配置存在性替代新版部署验收。
2. 三个 Supabase 变量均显示 All Environments，分支覆盖规则未知；又没有隔离项目，当前没有证据证明 Preview 数据库隔离。Vercel Preview 只提供应用预览，不自动建立独立 Supabase 数据库。恢复/迁移演练须先确定隔离目标及凭据范围，不能把 Preview 名称当作数据隔离证据。
3. 所给列表没有出现 `INVITATION_TRANSACTIONS_ENABLED` 或 `INVITATION_MANAGEMENT_ENABLED`；当前工作树只接受精确字符串 `true`，未设置时保持关闭。此判断只针对本地候选代码，不用来推定线上旧路由行为；本轮不新增或开启开关。
4. [文本配置](../../packages/web/src/lib/server/text-ai-config.ts)在报告 commit 与工作树的内容相同：优先 `TEXT_API_KEY`，其次 `OPENROUTER_API_KEY`；缺少 `TEXT_MODEL` 时默认 `openai/gpt-oss-20b:free`。所给列表未出现 `TEXT_API_KEY`、`TEXT_API_BASE_URL`、`TEXT_MODEL`。若没有其他未列出的覆盖且 key 有效，该路径选择旧 OpenRouter 默认配置；这不能证明升级计划中的 SOTA 账户资格或模型接入已经完成。
5. 当前工作树的[转写路由](../../packages/web/src/app/api/ai/transcribe/route.ts)使用 `SILICONFLOW_API_KEY`，未设 `SILICONFLOW_MODEL` 时默认 `FunAudioLLM/SenseVoiceSmall`。本轮没有测试提供方、余额、模型权限或数据条件。
6. 当前登录页面/认证 store 根据页面 origin 构造带语言路径与 `next` 查询参数的 `/auth/callback`，服务端 callback 继续处理 PKCE/OTP 并使用请求 origin 回跳。`NEXT_PUBLIC_APP_URL` 不控制这些登录回调。报告的旧 commit 中，登录页面也可附带 `next`，store 则只使用回调路径；仅 Google/SMTP enabled 不证明回跳、cookie 或邮件往返已通过。

## 本轮 URL 核对与具体调整

| 配置 | 用户原值 / 静态结果 | 建议与验收边界 |
| --- | --- | --- |
| Site URL | `maxiusi.dpdns.org`，原文未含协议 | 后台应为 `https://maxiusi.dpdns.org`。若用户只在聊天省略了协议，后台无需改动；当前不把粘贴简写当作已确认的后台错误 |
| Redirect URLs | 17 条：生产域名 8 条、`saga-web-livid.vercel.app` 8 条、localhost 1 条 | 两个线上域名均覆盖 `en / zh-CN / zh-TW / ja / ko / es / fr / pt`，路径与代码一致；本轮消息中的对象替换符和末尾标点作为粘贴分隔符处理，后台应逐条保存 URL |
| `NEXT_PUBLIC_APP_URL` | `https://maxiusi.dpdns.org/` | 生产 origin 一致。建议去掉末尾 `/`，设为 `https://maxiusi.dpdns.org`：报告的旧 commit 邀请邮件直接拼接 `${baseUrl}/${defaultLocale}/invite/...`，原值会产生 `//en/invite/...`。这是旧邀请链接的静态发现，未证明线上邮件已受影响；当前工作树已不在 `src` 中读取此变量 |
| localhost | `https://localhost:3000/en/auth/callback` | 仓库默认 `next dev` 使用 HTTP；将来本地登录测试应配置实际使用的 HTTP 地址及所需语言。只有显式启用本地 TLS 时才匹配当前 HTTPS 项；生产回调不受该项影响 |

依据 [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)，Site URL 是未指定 `redirectTo` 时的默认回跳，需填写完整生产 URL。当前[公开 Auth 实现](https://github.com/supabase/auth/blob/master/internal/utilities/request.go)允许与有效 Site URL 同协议、主机、端口的回跳，因此生产域名上的 `?next=...` 与完整 Site URL 一致；该公开源码不证明托管项目运行的版本。旧 Vercel 域名是另一 origin，精确路径列表本身不能证明带 `next` 的 URL 已获允许；后续若使用该域名或受控预览，须单独核对完整回调及查询参数，不能将路径覆盖率写成端到端登录通过。

## Needs Attention：可读 Config 与 Secret

用户回传原文：

> SUPABASE_SERVICE_ROLE_KEY looks like a secret, but its value is visible to anyone with access. Consider rotating at the source and saving as Secret.

[Vercel 当前文档](https://vercel.com/docs/environment-variables/sensitive-environment-variables)区分 Config 与 Secret：Config 可由有权限的成员回读，Secret 保存后只写不可读；旧 Sensitive 类型继续作为 Secret 工作。提示证明需要检查密钥的存储类型，不能单凭该提示断言密钥失效、被外部窃取或已暴露在浏览器中。

具体处理是将服务端密钥保存为 **Secret**，保留变量名 `SUPABASE_SERVICE_ROLE_KEY`；`ADMIN_CRON_SECRET`、`SILICONFLOW_API_KEY`、`OPENROUTER_API_KEY` 也应检查是否按 Secret 存储。公开网址和 `NEXT_PUBLIC_*` 公共配置不因本提示而改成服务端秘密。保存类型不会撤销此前已复制的密钥。

若安排轮换，先确认真实密钥类型与所有消费者，再在 Supabase 源头准备替代凭据、更新应用配置，在约定的部署窗口验证后撤销旧凭据。变量名不能证明其值一定是 legacy JWT。按 [Supabase API keys](https://supabase.com/docs/guides/api/api-keys)，新 secret key 与旧 `service_role` 可并存，创建新 key 不会自动撤销旧 key；替换兼容性和消费者切换仍需验证。本轮未查看 key，也未轮换或安排生产发布。

## 后续状态

本轮曾询问的三项网址与一条提示详情已收到，无需再次索要。当前最小配置动作是检查 Site URL 是否包含 `https://`、规范应用 URL 末尾斜杠，并处理服务端密钥的 Secret 存储；均为待实施/核验项，不登记为已修改。环境变量新值用于新部署，不能以 Dashboard 保存代替现有部署验证。

隔离恢复方案/预算、备份恢复、供应商账户与数据条件、真实登录验证继续待完成。已有 SiliconFlow/OpenRouter 变量只补齐旧环境的配置条目，不能填作新供应商的账户探测结果。

本次只新增非秘密证据、静态对账和交接说明，未改应用、依赖或迁移；验证覆盖 URL 数量/语言/路径、旧邀请链接拼接、源码与历史证据完整性及文档链接，未运行应用测试或真实登录请求。P0/G0 状态不变，没有提交、推送、部署、新建项目或恢复操作。

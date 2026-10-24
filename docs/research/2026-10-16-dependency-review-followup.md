# 依赖修复独立复审与运行证据加固

2026-10-16（Asia/Taipei），承接[10月15日依赖修复](2026-10-15-dependency-audit-remediation.md)。本轮没有更改应用依赖或锁文件。

## 复审与修复

[独立审查](evidence/2026-10-15-dependency-audit/independent-review-2026-10-16.md)重新核对了批次前快照、193项锁文件变化、依赖树、六项源码指纹及审计传导链，没有发现依赖兼容性阻断问题；发现一项 P2：`runtime-smoke.cjs` 在使旧结果失效之前加载 sharp/playwright，加载失败可能留下旧的 `passed` JSON。

本轮把依赖加载移入先写 `running` 后执行的受保护路径；失败写出 `failed` 并非零退出。版本元数据读取失败不会覆盖先前的运行错误。脚本新增可选输出路径，本轮结果写到新目录；历史 `runtime-smoke.json` 和 `verification.json` 保持原样。浏览器检查的描述限定为页面文本、CSS与未捕获pageerror，不声称完整hydration或交互验收。

4项子进程故障回归在修复前全部失败，修复后全部通过，覆盖sharp、playwright、Next元数据与自定义输出路径。没有改写已安装依赖、连接远端服务或使用真实家庭资料。实际合成图片/本地HTTP/Chromium检查18项通过，见[执行指纹与退出码](evidence/2026-10-16-dependency-review/runtime-smoke-execution.json)及[新结果](evidence/2026-10-16-dependency-review/runtime-smoke.json)。

原10月15日 `verification.json` 中的脚本哈希对应[保留的旧脚本](evidence/2026-10-16-dependency-review/runtime-smoke-before.cjs)；新脚本和测试哈希由本轮执行记录绑定，不能用历史哈希判断当前脚本没有变化。

[独立增量复审](evidence/2026-10-16-dependency-review/review-final.md)确认该P2已关闭，本批范围内无遗留发现；审查者另行运行4项回归及4项内存故障核对，核实历史文件和当前执行指纹。结论仅覆盖依赖批及运行验证脚本，不覆盖同期T05或全部历史工作树。

重放命令：

```bash
node --test docs/research/evidence/2026-10-16-dependency-review/runtime-smoke-startup.test.cjs
node docs/research/evidence/2026-10-15-dependency-audit/runtime-smoke.cjs docs/research/evidence/2026-10-16-dependency-review/runtime-smoke.json
```

## 当前审计与验证

实际 `npm run audit:high` 和JSON审计均退出1，仍为 **42项：34 high、8 moderate、0 critical**，见[审计摘要](evidence/2026-10-16-dependency-review/audit-summary.json)。首轮调用90秒超时，未取得可信退出码；重试仅对该进程设置官方registry直连、20秒请求超时和零重试，没有改全局网络或TLS设置。

[官方registry重新查询](evidence/2026-10-16-dependency-review/registry-current.json)确认 braces 最新仍为3.0.3、micromatch仍依赖它；sprintf-js最新仍1.1.3；selector-parser修复版本7.1.6与旧工具链6系列路径存在兼容评估要求。没有降级、强制override、关闭审计或为了数字迁移整个工具链。

项目 `npm run verify` 本轮退出0（Web75套/702项、类型/lint、175页构建），shared4套/16项、infra7项通过，见[T05同轮项目证据](evidence/2026-10-16-t05-supervision/project-checks.json)。构建前的`next-env.d.ts`已恢复。构建缺少服务端Supabase配置和既有Next配置警告仍在。

两次指定模型的审查派发分别因工具解密和模型不可用而失败；继承会话配置的审查代理随后成功执行。失败派发不计为审查。本轮仍未取得新的远端schema/RLS/Storage/备份、供应商账户或真机证据；G0/G1及审计门槛未通过，本轮不推送或部署。

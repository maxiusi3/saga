# 依赖审计修复独立审查

日期：2026-10-16（Asia/Taipei）。独立审查由继承运行配置的审查代理完成；此前代理平台错误不作为审查结果。

结论：发现 1 项 P2 运行验证脚本问题；未发现本批依赖选择、锁文件或已记录成功验证的兼容性阻塞。修复该问题前，不应声称验证脚本能在所有启动失败情况下使旧成功结果失效。当前 audit 仍失败，G0/G1 均未达到。

## 范围和比较基线

- 本批实施计划、修复记录、根/Web manifest、根 lockfile，以及本目录的依赖审计和验证证据。
- 批次比较基线为 `.superpowers/sdd/2026-10-15-upgrade-dependency-audit/before/`。`1caa21a72` 只标识当时 HEAD，不将早于本批的未提交变更归入本次审查。
- 未审查当前 T05 修改，也未重新验证远端系统、供应商、真机或全部既有应用代码。
- 除本报告外未修改文件；没有安装、构建、运行本地产品服务、查询凭据、提交或推送。独立重放只包括只读依赖树检查和隔离的脚本启动故障注入。

## 发现

### [P2] 在依赖加载前使旧运行报告失效

位置：`runtime-smoke.cjs:13–14`，以及 `runtime-smoke.cjs:126–128`。

`sharp` 和 `playwright` 在模块顶层加载，而将 `runtime-smoke.json` 写为 `running` 的操作位于稍后调用的 `run()`。如果安装不完整，或本次重点验证的 sharp 原生模块无法加载，脚本会在进入 `run()` 前抛出异常，保留上次 `status: "passed"` 的文件。这与修复记录“脚本每次启动使旧结果失效”的保证不符，也可能让后续仅查看 JSON 的证据收集误用旧成功结果。进程仍会非零退出；本问题不推翻现有成功运行的历史证据。

独立复现：将原脚本放入 `node:vm`，仅将 `createRequire()` 返回的加载器替换为抛出 `simulated failure loading sharp`，将 `writeFileSync` 替换为内存计数器。结果为 `resultWritesBeforeFailure: 0`，没有启动服务或写入真实文件。

建议：先计算结果路径并使旧报告失效，再在受 `try/catch/finally` 保护的执行路径内加载 sharp/playwright；依赖加载失败也应写出 `failed` 结果，并容许最终报告中的版本信息缺失。针对 sharp 和 playwright 启动失败分别验证不会留下旧 `passed` 文件，再重放实际运行检查。

## 核对结果

- 根 manifest 仅更新 Next override；Web 仅更新 Next、eslint-config-next、Sentry、PostCSS、sharp。审计阈值及构建、类型、lint、测试命令均未改变。
- Next 与 eslint-config-next、根 override 均为 16.4.1；Next 和 sharp 分别只有 16.4.1、0.35.5。记录的 Node 22.22.2 符合这些包的 engine 要求，Sentry 的 Next peer 接受 16 系列；既有根 ESLint 8 / Web 内嵌 ESLint 安排没有新增变化。
- 从批次前后锁文件重新计算的 193 个版本/路径变化与 `lockfile-changes.json` 完全一致。92 个保留或新增的变化条目均使用 `registry.npmjs.org` 且有 integrity；相同路径、相同版本的既有包没有 resolved/integrity 被重写。
- 独立运行 `npm ls --package-lock-only --all --json`：退出 0，无 problems。独立运行 `npm ls --all --json`：退出 0，仅有已披露的 `@emnapi/runtime@1.11.3` extraneous 条目，与记录一致。
- `verification.json` 中的全部 6 项源码 SHA-256 均与当前文件匹配：根 manifest、根 lockfile、Web manifest、shared manifest、Next 配置、运行验证脚本。
- shared manifest、shared/Web tsconfig、`next-env.d.ts`、Next 配置与本批开始快照逐字节一致。
- 审计 JSON 确认 59 → 42（critical 2 → 0、high 40 → 34、moderate 17 → 8）。重新遍历 `via` 得到的根因链与 `remaining-chains.json` 完全一致；全部 34 个 high 条目均可追溯至 braces，所有审计依赖路径均存在于当前锁文件。
- 已保存安装日志记录 1416 个包；verify 日志及退出码记录支持 75 套 / 702 项 Web 测试及 175 页构建；shared 为 4 套 / 16 项，infra 为 7 项。构建中的缺少服务端环境变量及既有 Next 配置警告已被修复记录披露。
- 18 项成功运行结果与脚本检查项一致，包含虚构图片编码、缩略图处理、解码、损坏输入拒绝及本地 HTTP/Chromium 检查。脚本绑定 loopback，阻断浏览器外部请求，并清理自建进程。以上为历史运行证据审查，本次未重新运行该脚本。

## 证据和阶段门边界

浏览器断言具体覆盖页面文本、已加载 CSS 和未捕获的 pageerror；没有单独断言客户端交互或完整 hydration，也没有证明真实供应商、Storage、Sentry 上传或设备矩阵可用。源码哈希只绑定记录中的六个文件，不代表当前全部应用代码再次通过了历史测试。

`npm run audit:high` 的已记录退出码仍为 1，42 个受影响包条目尚未清零。本次独立审查不改变 G0/G1：远端 schema/history/RLS/Storage/备份、供应商账户资格、正式 adapter 和真机故障矩阵的缺项仍须分别解决，不构成提交、推送或部署许可。

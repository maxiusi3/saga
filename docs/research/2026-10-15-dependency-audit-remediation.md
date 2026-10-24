# 十月升级依赖审计兼容修复

日期：2026-10-15（Asia/Taipei）。分支：`codex/october-upgrade-p0`；基线：`1caa21a72`。

**10月16日续接：** 已完成本批独立审查，并修复验证脚本启动失败留下旧成功JSON的P2；增量复审关闭该问题。当前脚本、新运行证据与42项审计复核见[复审续批记录](2026-10-16-dependency-review-followup.md)。以下数量及源码指纹保留为10月15日历史记录；旧verification的脚本哈希对应续批保存的旧脚本，不再与已修复脚本逐字节相同。

本批落实 [handoff](../HANDOFF-2026-10-13-upgrade.md) 中“推送前处理 Dependency audit 失败”的可兼容部分，执行计划见 [实施计划](../superpowers/plans/2026-10-15-upgrade-dependency-audit.md)。保留现有应用架构和已有未提交工作；不部署、不迁移、不读取家庭资料、不调用付费供应商。

## 版本与依赖树

| 依赖 | 修复前安装版本 | 本批版本 / 声明 | 原因 |
|---|---|---|---|
| Next | 16.2.6 | 16.4.1，根 override 与 Web 声明保持一致 | 修复当前公告覆盖的 Next 问题，并移除其旧 PostCSS/sharp 副本 |
| eslint-config-next | 16.2.6 | 16.4.1 | 与 Next 对齐；其 glob 链仍有未解决项 |
| sharp | Web 0.33.5、Next 0.34.5 | 统一 0.35.5 | 修复 libvips、libheif、librsvg 相关公告；验证真实图像处理 |
| @sentry/nextjs | 10.51.0 | 10.76.2，声明 `^10.76.2` | 在 10 系列内更新受影响的 OpenTelemetry 依赖 |
| PostCSS | 根 8.5.29、Next 8.4.31 | 根 8.5.29；Web/Next 8.5.23；Web 下限 `^8.5.23` | 所有保留版本高于受影响上限 8.5.22 |
| Handlebars | 4.7.9 | 4.7.10 | 兼容补丁修复 critical 模板注入公告 |

npm 初次生成锁文件仍保留了 Vercel/next-intl peer 使用的旧 Next 16.2.6；`npm ls` 报 `ELSPROBLEMS` 后，通过定向 `npm update next --package-lock-only` 清除了旧副本。最终锁文件只保留 Next 16.4.1 和 sharp 0.35.5，完整依赖树检查退出 0、无 problems，见 [依赖树检查](evidence/2026-10-15-dependency-audit/dependency-tree-check.json)。

没有执行 `npm audit fix --force`、降级框架、修改审计阈值或添加跨大版本 override。React、Tailwind 3、Web Jest 30、shared Jest 29 和根 ESLint 8 的既有架构保留。版本与依赖路径变化见 [lockfile-changes.json](evidence/2026-10-15-dependency-audit/lockfile-changes.json)；193 个版本/路径条目发生变化，主要为 Next 原生包、sharp 及 Sentry/OpenTelemetry 子树的更新、移除或移动。

## 审计结果

| npm 受影响包条目 | 修复前 | 修复后 |
|---|---:|---:|
| critical | 2 | 0 |
| high | 40 | 34 |
| moderate | 17 | 8 |
| 合计 | 59 | 42 |

这些数值包含依赖传导，不是独立漏洞数量。修复后的审计仍退出 1；不能称为通过 GitHub Dependency audit。原始证据为 [audit-before.json](evidence/2026-10-15-dependency-audit/audit-before.json)、[audit-after.json](evidence/2026-10-15-dependency-audit/audit-after.json)和[完整命令/退出码](evidence/2026-10-15-dependency-audit/audit-command.json)。审计使用当前公告服务与锁文件；`--prefer-offline` 用于包元数据缓存，不关闭漏洞查询。

剩余根因：

- **braces：high**，公告 [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) 覆盖 `<=3.0.3`。本轮 registry 的最新稳定版仍为 3.0.3，micromatch 4.0.8 仍依赖它；34 个 high 条目均由该链传导，涉及 Tailwind、Jest 与 eslint-config-next。不能靠兼容补丁修复，不能把 npm 自动建议的降级当作可接受方案。
- **postcss-selector-parser：moderate**，修复起点为 7.1.6，Tailwind 3、postcss-nested 和 typography 的现有路径使用 6 系列；需单独评估上游升级或经过兼容验证的替换。
- **sprintf-js：moderate**，最新 1.1.3 仍在受影响范围；来自 shared Jest 相关的旧 js-yaml/argparse 链。需上游修复或受控工具链迁移。

查询的包元数据和选择理由见 [registry-metadata.json](evidence/2026-10-15-dependency-audit/registry-metadata.json)、[version-decisions.json](evidence/2026-10-15-dependency-audit/version-decisions.json)。未把构建/开发依赖条目直接等同于生产可被利用，但也未从审计门槛中排除它们。

## 验证状态

本轮实际验证：

| 检查 | 结果 | 证据 |
|---|---|---|
| 干净 `npm ci` | 退出 0，安装 1416 个包 | [npm-ci.log](evidence/2026-10-15-dependency-audit/npm-ci.log) |
| 锁文件及完整安装树 | 均退出 0；锁文件无 problems，安装树有1个可选包残留，见下文 | [锁文件](evidence/2026-10-15-dependency-audit/dependency-tree-check.json)、[安装树](evidence/2026-10-15-dependency-audit/installed-tree-check.json) |
| `npm run verify` | 退出 0；类型/lint、75 套 / 702 项 Web 测试及 175 页构建通过 | [verify.log](evidence/2026-10-15-dependency-audit/verify.log) |
| shared Jest | 退出 0；4 套 / 16 项 | [shared-tests.log](evidence/2026-10-15-dependency-audit/shared-tests.log) |
| `npm run test:infra` | 退出 0；7 项 | [infra-tests.log](evidence/2026-10-15-dependency-audit/infra-tests.log) |
| 真实图片 + 本地 HTTP / Chromium | 退出 0；18 项 | [runtime-smoke.json](evidence/2026-10-15-dependency-audit/runtime-smoke.json) |
| 实际 `npm run audit:high` | 退出 1；42 项（8 moderate / 34 high） | [audit-high.log](evidence/2026-10-15-dependency-audit/audit-high.log) |

汇总与源码 SHA-256 见 [verification.json](evidence/2026-10-15-dependency-audit/verification.json)。Node 22.22.2、npm 10.9.7、Chromium 147.0.7727.15；sharp 运行时原生库版本也记录在结果中。

安装树中 `@emnapi/runtime@1.11.3` 被 npm 标为 extraneous。它在锁文件中是可选 WASM 辅助包；macOS x64 未安装对应的其他平台消费者，干净安装后仍留下此包。`npm ls` 退出 0，没有 missing/invalid 依赖或 peer 错误；实际 Next/sharp 运行验证通过。保留并记录这一现象，没有通过安装后手动删除来掩盖可重现安装的表现。

图片检查使用虚构像素生成 JPEG/PNG/GIF/WebP，执行与上传缩略图相同的 resize/toFormat/toBuffer，再解码核对尺寸和像素长度，并拒绝损坏输入。浏览器检查 `/en`、`/zh-CN`、`/zh-TW`、登录页、CSS 与页面错误；HTTP 验证 locale 跳转、无缓存的 AI 配置响应和未登录资产创建拒绝。浏览器外部请求全部阻断，未发送家庭资料或调用真实 AI/Storage。

运行验证可在构建后从仓库根目录重放：

```bash
node docs/research/evidence/2026-10-15-dependency-audit/runtime-smoke.cjs
```

最初的 CSS 检查只取第一份样式表（64 条规则），实际应用另有包含 1596 条规则的 CSS；诊断后改为统计全部 Next CSS chunks，重跑 18 项通过。这是验证脚本误报，未修改产品代码。脚本每次启动使旧结果失效，并在浏览器/服务进程清理完成后写出结果。

网络下载的早期安装未完成，终止后重新执行了单独的干净安装；最终仅对该进程设置 `npm_config_noproxy=registry.npmjs.org`，使用官方 registry 直连及缓存，未改机器代理、registry 或 TLS 校验。最终通过的安装和验证才作为证据。

构建仍报告缺少 `SUPABASE_SERVICE_ROLE_KEY`、Next 的既有 `eslint` / `images.domains` 配置警告；另有 Watchman recrawl 提示。构建退出 0不代表生产环境已核实。构建前的 `next-env.d.ts` 已恢复；tsconfig、shared manifest 和独立 T05 lockfile 与本轮前一致。T05 原有证据的五份源码哈希匹配，本轮未重跑 T05 / FFmpeg 实验或执行 G1 真机矩阵。

## 审查与发布边界

10月15日独立实现/审查代理均在执行前遇到工具平台错误（加密签名、模型不可用或资源不匹配），没有返回有效审查意见，当日仅主会话[自查](evidence/2026-10-15-dependency-audit/self-review.md)，具体故障见[execution-notes.json](evidence/2026-10-15-dependency-audit/execution-notes.json)。10月16日已另行完成[独立审查](evidence/2026-10-15-dependency-audit/independent-review-2026-10-16.md)、P2修复及[增量复审](evidence/2026-10-16-dependency-review/review-final.md)；不能将后来的独立结论倒记为15日已经通过。

G0/G1 仍未达到：远端 schema/history/RLS/Storage/备份、供应商账户资格、正式 adapter 与真机故障矩阵仍缺。本批不是原计划中的独立发布里程碑，未提交、未推送 GitHub。依赖批独立复审现已补齐；后续按既有顺序补只读远端证据与 T05 自动监督/本地合并边界，并单独评估剩余工具链问题。

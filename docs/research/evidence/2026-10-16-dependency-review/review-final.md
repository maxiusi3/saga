# 依赖运行证据 P2 独立复审

日期：2026-10-16（Asia/Taipei）。本次由原独立审查代理复审其他代理实施的修复。

结论：原 P2「在依赖加载前使旧运行报告失效」已解决（addressed）；本次范围内无未关闭发现或新增启动回归。该结论不改变依赖 audit 失败及 G0/G1 未达到的状态。

## 复审范围

仅复审 `2026-10-15-dependency-audit/runtime-smoke.cjs` 的修复、当前目录的 `runtime-smoke-startup.test.cjs`、修改前脚本、红绿回归记录、已完成的真实 smoke 输出，以及实施代理的 `runtime-fix-report.md`。没有复审当前 T05，也未重跑 audit、安装、构建或真实 smoke；除本报告外没有写入文件。

## 原发现关闭依据

- `runtime-smoke.cjs:127–135` 在加载 sharp/playwright 之前将所选输出写为 `running`；两个外部依赖都在捕获错误的执行路径内加载。顶层只保留内置模块和路径/加载器创建。
- `runtime-smoke.cjs:152–171` 分别保护 Next/sharp 元数据读取，缺失字段可省略，读取异常写入 `metadataErrors`。`failure ??= error` 保留更早的主错误；最终仍写出 `failed` 并非零退出。
- `runtime-smoke.cjs:128–130` 的可选输出参数只选择本次结果路径；无参数时保持原默认路径。历史文件不因使用新输出参数而被覆盖。
- 主体图像、HTTP、浏览器和清理逻辑未改变。浏览器检查标签已收窄为实际断言的页面文本/CSS，不再将这些断言表述为 hydration 验证。

## 验证和证据核对

| 检查 | 独立核对结果 |
| --- | --- |
| 保存的修改前脚本 | SHA-256 与初次审查及历史 verification 中的脚本哈希一致 |
| 红色回归 | 日志确认 4 项按预期失败：旧成功结果残留、Next 元数据异常遮蔽主错误、自定义结果路径未得到失败报告；记录退出 1 |
| 绿色回归 | 日志确认 4/4 通过，退出 0；测试检查最终状态、非零子进程退出、加载时状态、主错误和历史默认文件保留，而非仅匹配实现文本 |
| 独立故障注入 | 使用原脚本和内存文件替身的 `node:vm` 检查 4 个场景，全部通过，无真实文件写入、依赖加载或服务启动 |
| 已完成的实际 smoke | 2026-10-16T02:39:17.711Z 至 02:39:24.880Z，记录退出 0、18 项通过；JSON、日志和执行记录一致 |
| 历史证据 | 原目录的 `runtime-smoke.json` 与 `verification.json` 当前哈希均等于执行记录中的修改前/后哈希 |

独立内存故障注入覆盖：sharp 加载失败同时 Next 元数据失败；playwright 加载失败且 sharp 元数据可用；playwright 主错误同时 sharp 元数据 getter 失败；显式输出路径下 sharp 加载失败。每项都观察到 `running → failed`、外部加载前状态为 `running`、退出码 1、主错误未丢失且无成功日志；显式路径场景保留默认历史文件。

已重新计算并匹配执行证据中的哈希：

| 文件 | SHA-256 |
| --- | --- |
| 修改前脚本 `runtime-smoke-before.cjs` | `e6c4cd62839bbe9d9dec5dbbb58f8ba0a8649bb92de526c21c9daed7fd072809` |
| 当前运行脚本 | `78fbea29b72f67392a78015356ccbe3ecc156336cda9d93879bf6c00e053d386` |
| `runtime-smoke-startup.test.cjs` | `0f9d72549ee29f8ffec059c70c21edece52d434a6943ae8b9dca96c99cde943d` |
| 本次 `runtime-smoke.json` | `a850dba2659a75ad6e1473c9ad7fa254d7a695525ca9c496fe236c1a65979de4` |
| 原目录 `runtime-smoke.json` | `b2dbbf62613b8faf4d32f1b45fadf0b56f9f19f9b1c81e925ebd8ef39a71fc2d` |
| 原目录 `verification.json` | `820b009b3e709dd35f6dbbf747d9df258cf09668d7073fcaf7e608f3ea77fc38` |

历史 verification 保留旧脚本哈希是有意保存历史证据；它通过保存的修改前脚本仍可核对。当前脚本应使用本目录的新执行记录验证，不能套用旧 verification 的脚本哈希。

## 边界

实际 smoke 覆盖 Node 22.22.2、Next 16.4.1、sharp 0.35.5、Chromium 147.0.7727.15 下的合成图像、匿名本地 HTTP、页面文本/CSS 和未捕获 pageerror。它未证明完整 hydration、客户端交互、真实供应商、Storage 或 G1 真机矩阵可用，也没有覆盖操作系统强制终止或结果文件不可写的情况。

原独立审查中的 P2 以本报告关闭；依赖 audit 仍未通过，G0/G1 的远端、供应商及真机证据缺项仍须分别处理。本次没有重新评估发布阶段门。

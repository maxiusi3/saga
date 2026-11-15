# G2 审阅与转写验收证据

实现及原始验收：2026-11-10；中断续接、当前验证与归档：2026-11-11（Asia/Taipei）。本目录补齐聊天「37」未写入的最终材料，保留此前所有失败、修复和通过日志。

- [汇总回执](verification.json)：本地验收结论、当前与历史运行、源码指纹及未实测边界。
- [续接回执](../2026-11-11-g2-resume/verification.json)：本次执行命令、退出码、清理结果与无源码变更核对。
- [交付报告](../../2026-11-10-g2-review-and-transcription.md)与[人工后补](../../2026-11-10-g2-manual-follow-up.md)。
- [源码清单](source-manifest.json)与[源码快照](source.tar.gz)：1,204 个 packages、supabase、scripts、experiments 及根配置文件；逐文件验证 SHA-256，压缩包已回读核对。只包含被版本控制或未被忽略的文件，环境文件仅为示例配置。

## 当前执行与既有证据

| 项目 | 运行时间 | 结果与入口 |
| --- | --- | --- |
| G2 完整数据库与 Chrome | 11 月 11 日 | 543 条断言、33 份 schema 文件；[命令日志](../2026-11-11-g2-resume/chrome.log) |
| 类型、lint、Web 测试、构建 | 11 月 11 日 | 173 套／3,567 项、184 页；[完整日志](../2026-11-11-g2-resume/verify.log) |
| shared / infra | 11 月 11 日 | 4 套／16 项、25 项；[shared](../2026-11-11-g2-resume/shared.log)、[infra](../2026-11-11-g2-resume/infra.log) |
| G1 整故事删除 Chrome | 11 月 10 日 | 244 条断言；[运行入口](g1-deletion-final.log)，本次核对受测源码一致，未复跑 |
| 完整备份恢复 | 11 月 10 日 | 493 条断言；[运行入口](backup-final.log)，本次核对受测源码一致，未复跑 |
| 独立原生复审 | 11 月 10 日 | 486 条断言；[回执](supplement-origin-independent-green-results.json)，本次核对受测源码一致，未复跑 |
| 独立 helper 复审 | 11 月 10 日 | 43 项；[回执](helper-independent-recheck.json)，本次核对六个受测文件一致，未重新独立复审 |

11 月 10 日 G2 首轮最终结果为 542，保存在 [原日志](chrome-final.log)。当前 Chrome 157.0.8103.39，原为 156.0.8078.80；两次源码与 8 项审阅、10 项转写场景清单一致，见[比较记录](../2026-11-11-g2-resume/chrome-comparison.json)。计数包含每次数据库连接的角色校验，不等于独立用例数。

## 复审与截图

[规格复审](spec-review.md)、[质量复审](quality-review.md)、[helper 独立复核](helper-independent-review.md)保留发现、反例与修复后的结论。它们来自 11 月 10 日，不冒充本次新派发复审。原生回执、日志、截图及这些报告的路径和哈希已纳入汇总回执；复审中引用的早期 507 条浏览器结果仍为历史，由最终 542 和本次 543 条运行覆盖后续代码。

当前截图见以下链接；桌面及 390px 已实际查看，窄屏无横向溢出。

- [审阅与批准前文稿](../2026-11-07-g1-chrome/migrations-1794364891571-cedd9673-da19-4b76-a02e-646ce1b04c65/chrome-review-before-approval.png)
- [390px 审阅布局](../2026-11-07-g1-chrome/migrations-1794364891571-cedd9673-da19-4b76-a02e-646ce1b04c65/chrome-review-mobile.png)
- [转写成功及来源](../2026-11-07-g1-chrome/migrations-1794364891571-cedd9673-da19-4b76-a02e-646ce1b04c65/chrome-transcription-after.png)
- [转写授权](../2026-11-07-g1-chrome/migrations-1794364891571-cedd9673-da19-4b76-a02e-646ce1b04c65/chrome-transcription-before.png)
- [未知结果保留](../2026-11-07-g1-chrome/migrations-1794364891571-cedd9673-da19-4b76-a02e-646ce1b04c65/chrome-transcription-error.png)

## 范围

Chrome 执行生产审阅／转写组件、实际 route、Supabase SDK 和完整本地 PostgreSQL 17.4。登录、导航、Auth/PostgREST/Storage HTTP 为测试替身；这不是托管 Next 应用登录验收。实际播放 WAV 为合成声音，三次 multipart 转写仅发送到受控本地 HTTP，不证明真实语音质量。真人家庭、手机、真实供应商账户及托管环境保持后补；未知 ASR 结果的运营对账界面尚未实现。

构建通过且仍报告既有 Next 配置弃用及可选环境变量警告。当前源码无变化，生成的 next-env 声明已恢复。未暂存、提交、推送、远端迁移或部署；后续从 G3 现有实现及缺口继续。

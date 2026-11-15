# G3 验证证据

当前结论见 [G3 报告](../../2026-11-11-g3-delivery.md) 与 [最终回执](verification.json)。本目录保留行为 RED、环境失败、修复过程及最终通过材料；旧日志不覆盖最终记录。

| 验证 | 结果 | 最终证据 |
| --- | --- | --- |
| G3 综合原生与 Chrome | 672 断言，36 迁移文件，源码无漂移 | [results.json](migrations-1794374099956-aee45ac1-02df-4b2c-a66a-0bc0384c1f54/results.json) |
| 数据库与归档卷恢复 | 556 断言，36 迁移文件，源码无漂移 | [results.json](../2026-11-07-g1-chrome/migrations-1794373550000-bf3774a5-5916-49de-855c-d5443cb367d6/results.json) |
| G2 回归 | 543 断言，36 迁移文件，源码无漂移 | [results.json](../2026-11-07-g1-chrome/migrations-1794374995096-61627978-36c7-4932-97e0-67daa3d2724d/results.json) |
| G1 删除回归 | 250 断言，36 迁移文件，源码无漂移 | [results.json](../2026-11-07-g1-chrome/migrations-1794374995096-df1adb3a-1f62-4282-850a-ddb33f4e8d04/results.json) |
| 全仓 verify | Web179/3609、类型、lint、186页构建 | [日志](verify-final.log) |
| shared / infra | 16 / 28 项 | [shared](shared-final.log) · [infra](infra-final-config.log) |

## 实际浏览器与 PDF

- [已批准来源与原声播放](migrations-1794374099956-aee45ac1-02df-4b2c-a66a-0bc0384c1f54/chrome-delivery/chrome-approved-source-seek.png)
- [离线原声实际播放](migrations-1794374099956-aee45ac1-02df-4b2c-a66a-0bc0384c1f54/chrome-delivery/chrome-offline-audio.png)
- [390px归档状态与下载](migrations-1794374099956-aee45ac1-02df-4b2c-a66a-0bc0384c1f54/chrome-delivery/chrome-mobile-delivery.png)
- [支付成功与项目分配](migrations-1794374099956-aee45ac1-02df-4b2c-a66a-0bc0384c1f54/payment-chrome-paid.png)
- [退款后状态与窄屏](migrations-1794374099956-aee45ac1-02df-4b2c-a66a-0bc0384c1f54/payment-chrome-refunded-mobile.png)
- [Chrome所批准中文文稿PDF](migrations-1794374099956-aee45ac1-02df-4b2c-a66a-0bc0384c1f54/chrome-delivery/offline/biography-booklet.pdf)
- [28页完整中文PDF](migrations-1794374099956-aee45ac1-02df-4b2c-a66a-0bc0384c1f54/archive/booklet.pdf)

## 复审与失败记录

- [最终独立文档／证据核验](document-review.md)：无未关闭P0/P1/P2，回执和日志哈希匹配。

- [支付、搜索和父集成独立复核](payment-final-review.md) · [支付回执](payment-final-receipt.json) · [归档回执](archive-receipt.json) · [搜索交付](search-delivery.md)。
- [归档独立复核脚本](archive-review-recheck.mjs) 与 [原生复核日志](archive-independent-recheck.log) 确认批准来源变化和旧成员撤权绕过已关闭；运行时修复已存在，没有声称旧版 RED。
- [新界面行为 RED](integration-ui-red.log) 和 [针对性 GREEN](integration-ui-green.log)；[Worker CLI 验证](publication-cli-green.log)。首轮 CLI/模块缺失属于准备失败，不冒称已执行行为。
- [全仓首轮失败](verify-first.log) 后 [针对性复跑](verify-fix-focused.log) 与最终全仓通过分别保留。
- [字体断点续传](font-download.log)；第一次浏览器 PDF 因 pdftotext 不在 PATH 失败，最终指定现有 Poppler 运行时。

## 源码与边界

- [1265份源码清单](source-manifest.json) · [相对G3起点的变更](source-changes.json) · [逐成员核过SHA-256的源码归档](source.tar.gz)。不含实际 .env 凭证。
- [人工后补](../../2026-11-11-g3-manual-follow-up.md)：本地使用合成账号／Auth/PostgREST/Storage／Stripe HTTP。真实外网支付、Stripe.js／SCA、托管、手机和家庭质量未测。离线文件和已签发短期音频 URL 有明确撤回边界。
- 三份新迁移均通过完整bootstrap链。备份比较可信来源两个schema和公共支付／出版记录，独立卷实际恢复／清理。
- 所有最终原生运行停止集群、移除临时目录且无残留客户端；HEAD保持c0669e805，未暂存、提交、推送或部署。

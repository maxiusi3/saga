# T01本地流程原型证据

2026-10-13，分支codex/october-upgrade-p0，基准HEAD 1caa21a72。对应[实施记录](../../2026-10-13-t01-prototype-implementation.md)与[原型](../../../prototypes/2026-10-13-two-entry/index.html)。本批未提交、推送、部署或执行远端迁移；没有真实家庭/模型调用。

## 可复核文件

| 文件 | 内容 |
|---|---|
| [browser-walkthroughs.json](browser-walkthroughs.json) | 六情景85步的实际按钮、反馈与可见状态；7次预期拒绝 |
| [browser-additional-checks.json](browser-additional-checks.json) | 转义文本、键盘焦点、320/390布局、暂停/继续与缺件失败的补充观察 |
| [browser-diagnostics.json](browser-diagnostics.json) | console error/warn空、DOM无外部资源/媒体/文件输入、CSP；不是网络抓包 |
| [demo-receipt.json](demo-receipt.json) | 由浏览器实际下载，标记虚构且不含声音、不构成完整媒体档案 |
| [desktop-initial.jpg](desktop-initial.jpg) | 1440×1050桌面初始界面 |
| [mobile-initial.jpg](mobile-initial.jpg) / [mobile-320.jpg](mobile-320.jpg) | 390×844、320×844视口截图，非真机录音测试 |
| [spec-review.md](spec-review.md) / [quality-review.md](quality-review.md) | 独立审查及已修正问题，最终质量结论PASS |
| [local-checks.log](local-checks.log) | JavaScript语法、链接、空白、轨迹/收据与源码指纹检查 |
| [verification-manifest.json](verification-manifest.json) | 原型、文档、证据及保留生产源码的SHA256；不含自身哈希 |

## 验证范围

原型为单文件HTML，状态只在内存；六情景使用虚构Alex/Sam、first-home-01问题。浏览器轨迹为导入13、邀请13、中断18、上传10、文字失败11、分歧/缺件20步。七次拒绝均符合预期，拒绝不改变可见状态；没有把这些操作计算成Jest用例或家庭成功率。

全量浏览器轨迹对应SHA256 964e3723ad9fc15a9ed3f15da83e831065de8bdc44ada27de3d6e5777f6809bd。最后只把暂停状态的“使用Save a segment”说明改为“Resume…”；最终HTML为10a7eeb62f24af7537275617fcb70ae6afa1d272c6b8dcdc2a162efb052958a1。差异已独立复核，暂停/继续重新在浏览器验证。规格报告保留其审查时的版本，质量报告包含最终增量审查。

浏览器通过只监听127.0.0.1且仅返回该HTML的临时预览操作。内置浏览器不支持本次file URL，因此双击打开未实测，不以HTTP检查冒充file协议验证。没有外网资源DOM，CSP禁止连接与媒体；源码检查未发现网络/麦克风/持久化调用，不宣称完成网络抓包。

17份正式源码/测试与[媒体批manifest](../2026-10-13-media-access/verification-manifest.json)一致。上批verify 58套/488项为历史生产代码检查，本批未重复无关应用构建。旧manifest原样保留，其文档哈希代表当时版本，本批文档更新由新manifest记录。

真实研究0户；尚不证明生产保存/恢复、真实ASR、完整原件档案、远端隔离、供应商条件或G0–G4通过。暂不部署，里程碑后再统一安排。

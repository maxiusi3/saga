# 本轮证据索引

[verification.json](verification.json) 列出全部运行、日志哈希、受测源码哈希、通过的 5/20/30 分钟录音、导出与音频分析。完整说明见 [验收报告](../../2026-11-07-g1-chrome-acceptance.md)。

- `integrated-browser-*`：Google Chrome 实际页面录音、分钟分块、保存与 Worker、回放、清理。成功目录保留原始分块、发布对象和截图。前一版脚本只等待自动成功、未点击“继续保存”，导致 5/20/30 分钟三次失败；它们不算通过。后续报告明确通过页面动作完成保存。
- `interrupted-browser-*`：真实分钟块中途刷新后恢复，推进到离线／账号变化／reserve/seal 响应丢失／处理中保留，随后 Worker 无法发布。不算通过。原始报告中的逐步检查不等于整个中断矩阵通过。
- `export-*`：前三次为本地夹具设置／状态断言修正，第四次完成实际导出、角色反例、坏件／缺件、撤权／墓碑、ZIP hash、离线 Chrome 回放。最终目录内 `archive.zip` 和 `offline/index.html` 可检查。
- `audio-*`：每个完整录音的逐对象哈希、按序拼接相等、严格 FFmpeg 全流解码、时长和整秒合成音连续性。另保留第一分钟单块的容器提前结束诊断作为中断问题证据。
- `migrations-*`：实际 PG17.4、真实 pgcrypto/uuid-ossp、完整 bootstrap 和按序根迁移，在 P1 缺失表失败。它是完整链失败证据。
- `raw/`：本轮命令日志、完整门禁、RED/GREEN、编译扩展日志、已恢复的 next-env 生成版本。

`gap-register-before.md` 保存更新口径前的完整旧清单。成功运行均清理自己的数据库、浏览器及临时目录；扩展运行时保留在 `/tmp/saga-g1-runtime` 便于复跑。Auth/PostgREST/Storage 服务适配器、物理第二设备、手机系统行为和真实语音语义边界详见报告。整体 G1 不因本批正常流程通过而标记成功。

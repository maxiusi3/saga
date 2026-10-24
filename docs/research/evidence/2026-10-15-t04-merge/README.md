# T04 本地合并/解码证据

`results.json` 由 `scripts/verify-recording-merge.cjs` 生成。56 项检查覆盖五种虚构音频 fixture 及八类拒绝案例，附源码、脚本、运行时、fixture 指纹。

复跑需要显式指定可用的 `SAGA_FFMPEG_PATH`。这是本地真实 FFmpeg 和生产处理模块的集成证据；对象读取使用本机虚构块流，没有远端 Storage、数据库、队列、权限、云端完整确认或真机 G1 验收。

细节与限制见[本轮实施记录](../../2026-10-15-t04-local-merge-execution.md)。

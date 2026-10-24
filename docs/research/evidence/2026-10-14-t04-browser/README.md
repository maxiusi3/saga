# T04 原生 IndexedDB 浏览器回归

日期：2026-10-14（Asia/Taipei）。脚本从当前工作树读取并转译 `packages/web/src/lib/recorder-db.ts`，连同已安装的 `idb` 在仅监听 `127.0.0.1` 的临时服务中执行。浏览器使用隔离 context，不使用日常浏览器资料、Supabase 或真实家庭录音。

## 复现

仓库根目录执行：

```bash
node scripts/verify-recorder-db.cjs
```

使用现有 `@playwright/test`、TypeScript 及本机已安装的 Chromium；没有新增依赖。缺少浏览器或任何断言失败均返回非零。结果写入本目录的 `results.json`，记录实际浏览器、OS、时间、被测源文件 SHA-256 及通过的检查。

## 检查边界

- 原生 IndexedDB v1→v2 升级保留旧 Blob，补齐大小、时间、pending 与空 hash 默认值。
- 用生产 adapter 保存会话和乱序块，关闭页面，在同 context 的新页面读回。
- 验证数字索引排序、最大持久化索引、字节与 SHA-256 保留。
- 恢复列表同时过滤项目、账号和 confirmed 状态；recording/interrupted 均保留，按更新时间降序。
- 上传标记不删除 Blob；不存在的块不能标为上传成功。
- 显式清理仅删除指定虚构会话及其块，其他会话和旧块仍在。
- 新 context 不读取前一个 context 的数据。

这些断言没有使用 IndexedDB mock。音频类型 Blob 内是人工构造的非音频字节，因此不证明可解码、可回听、时长准确或原件完整。没有测试浏览器进程退出、强杀、配额耗尽、iPhone/Android、麦克风、锁屏、来电、跨设备或云端确认。项目/账号过滤是本地列表行为，不是服务端权限或 RLS 证明。

## 检测能力

以下命令只在内存中改变被服务的源代码，生产文件不会被改写；预期返回 1：

```bash
node scripts/verify-recorder-db.cjs --mutation=user-filter
node scripts/verify-recorder-db.cjs --mutation=numeric-sort
```

`mutation-user-filter.json` 记录取消用户过滤后，另一账号草稿进入列表时的断言失败；`mutation-numeric-sort.json` 记录字典序将 10 排在 2 前面时的断言失败。它们是故意引入错误的检测证据，不是正常实现失败。

# 解码器取消测试的就绪竞争修复

仅修改 [recording-audio-decoder.test.ts](../../../../packages/web/src/lib/server/__tests__/recording-audio-decoder.test.ts)。完整文件 **38/38 通过，无跳过，Jest 总时间 21.804 秒**；生产解码器保持原字节。本批前两次失败、这次受控 RED 和测量结果均保留。

## 诊断

[首次全量失败](verify-initial-failed.txt) 与 [原生构建结束后复现](decoder-after-build.txt) 都在“PCM 输出后取消”收到 `Recording decoder timed out`，预期为同一个 `worker lease expired` Error 对象。因此不能把问题仅归因于 PG 构建并发。

生产代码在 `spawn` 返回后启动 watchdog；测试却要等到子进程 stdout 的 `data` 才调用 `abort(reason)`。该测试使用 1000 ms watchdog，而同文件需要子进程实际执行的其他行为测试使用 10000 ms。若真实 Node 子进程尚未就绪，watchdog 先杀进程，测试未到达指定取消场景。

独立边界测量使用相同 shebang Node、真实可执行文件、禁 shell 和管道 stdout，每次读到 3200 个虚构 PCM 字节后杀死并等待 close，5/5 的 PID 均已不存在：

| 实验 | spawn 返回 | 首个 PCM | 证据 |
| --- | --- | --- | --- |
| 同一脚本执行 5 次 | 1.96–6.43 ms | 首次 859.16 ms；后续 134.13–165.92 ms | [测量](decoder-startup-measurements.json)、[探针](decoder-startup-probe.cjs) |
| 每次新写脚本，匹配测试 fixture 边界 | 1.89–7.16 ms | 564.12–603.64 ms | [测量](decoder-startup-fresh-measurements.json)、[探针](decoder-startup-fresh-probe.cjs) |

这些数据表明 spawn 返回不等于脚本已经输出 PCM，也展示了真实启动时间波动；它们不证明具体 OS/Jest 调度来源。更直接的 [受控 RED](decoder-controlled-red.txt) 在保留 1000 ms watchdog 时，使原 PCM 场景再次超时，新增 1500 ms 就绪延迟场景稳定落入同样错误。

RED 还揭露原 `process exit` 场景的假通过：watchdog 杀死子进程也会触发 `exit`，它随后调用 abort，原先只比较取消原因会通过。新增完整 PCM 断言发现当时实际收到 **0 字节**。这不是生产解码器错误；是测试没有确认已到达它声称测试的正常退出事件。

## 最小改动

- 取消场景的 watchdog 改为 10000 ms，与同文件其他真实子进程行为测试一致；Jest 的 15000 ms 外层上限保留。
- 增加一个真实子进程场景，在输出前等待 1500 ms，证明取消测试允许就绪耗时超过旧 1 秒预算。
- 三个取消场景都要求收到完整 3200 字节 PCM。`process exit` 额外要求退出码 0、无退出信号，避免在 watchdog 诱发的退出上产生假通过。
- 原 Error 对象身份、等待 close、真实 PID 不存在、运行期 listener 数量和 caller listener 保留断言全部保留。所有 150 ms 真正超时场景及生产 timeout 行为未改。

[逐行差异](decoder-test-change.patch) 对照 [修改前测试](decoder-test-before.txt)。除此指定测试文件，新增内容全部为本目录诊断/验证证据；没有依赖、迁移、远端调用或提交。

## 验证

| 运行 | 结果 | 时间 |
| --- | --- | --- |
| 加入就绪回归与完整 PCM 断言，仍用 1000 ms | 3 失败，35 未选择；退出 1 | 5.814 s |
| 完整文件，取消场景改为 10000 ms | 38 通过，0 失败，0 跳过；退出 0 | Jest 21.804 s；测试 suite 21.349 s |
| 指定测试文件 ESLint | 无输出；退出 0 | — |

GREEN 命令：

```sh
npm test --workspace=packages/web -- --runInBand \
  src/lib/server/__tests__/recording-audio-decoder.test.ts \
  --json --outputFile=../../docs/research/evidence/2026-10-17-pg17-routines/decoder-focused-green.json
```

[控制台结果](decoder-focused-green.txt) 与 [Jest JSON](decoder-focused-green.json) 保存逐场景时间：正常 PCM 后取消 708 ms；正常退出后取消 691 ms；1500 ms 延迟后的取消 2167 ms。四个原超时场景分别为 158、174、157、158 ms，全部通过。目标 ESLint 的输出为 [空成功日志](decoder-eslint.txt)。

自查确认变化仅在取消场景的参数化 fixture、就绪预算与成功到达事件的断言。`git diff --no-index --check` 未报告空白错误（退出 1 表示文件有差异）。全库 verify 与独立审查由主控制器继续执行。

## SHA256

| 文件 | SHA256 |
| --- | --- |
| 生产 `recording-audio-decoder.ts`（修改前后相同） | `3eea74f88074b37539dfb175e9256e3fe27c359ab711c7a8211bfa7a68e03c03` |
| 修改后 `recording-audio-decoder.test.ts` | `f22c497b38c718da04378fb4491a9cf2d8e63da1327d262adc21267a9c022562` |
| [机器核验与证据摘要](decoder-implementation-verification.json) | `e979d6e8f300372e5c1ee4e4ddeb1af579e28d9d6e984ba7e34b96b37c12ae10` |

修改前哈希保存在 [baseline](decoder-baseline-hashes.json)，机器核验记录各探针、测量、RED、GREEN 和差异文件的 SHA256。10 秒是测试的有界就绪预算；极端系统停顿仍可能触及上限，此修复不调整生产时限，也不宣称消除所有宿主环境资源问题。

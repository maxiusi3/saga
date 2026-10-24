# 解码器取消测试独立审查

**结论：通过。未发现需要修改的 P0–P3 问题。** 审查只覆盖本次 `recording-audio-decoder.test.ts` 的差异及相关诊断、验证证据，不代表全库 `verify` 已完成。

审查依据为 `.superpowers/sdd/2026-10-17-upgrade-pg17-routines/decoder-brief.md`、仓库 `CLAUDE.md`、[实现说明](decoder-implementation.md)、[修改前副本](decoder-test-before.txt)及[补丁](decoder-test-change.patch)。采用 code-review 技能的规范、规格两个检查维度；按本次任务要求未启动子代理。

## 规范检查

无发现。变更局限于既有取消测试的参数化、真实子进程就绪预算和断言；未加入依赖、生产逻辑或新的测试抽象。10000 ms 与同文件其他真实子进程行为测试保持一致，15000 ms Jest 外层时限未变。独立执行 `git diff --no-index --check` 无空白诊断，退出 1 仅表示两文件有差异。

## 规格检查

无发现。逐项核对如下，行号均针对本次审查时的代码。

| 要求 | 审查结果与位置 |
| --- | --- |
| 原取消语义保留 | `packages/web/src/lib/server/__tests__/recording-audio-decoder.test.ts:145` 仍分别在 stdout `data` 和子进程 `exit` 事件中取消；`:151` 仍用 `toBe(reason)` 校验同一个 Error 对象，不能把有效 PCM 当作成功。 |
| close、PID、listener 断言保留 | 同文件 `:143` 观察真实 close；`:157` 检查运行期间两个 abort listener，随后确认 close 已发生、PID 为正且进程已不存在、仅保留 caller listener。与修改前副本相比，这些断言没有弱化。 |
| 正常进程退出成为必须条件 | 同文件 `:144` 累计 PCM；`:152` 要求完整 3200 字节；`:153` 要求 exit code 为 0 且 signal 为 null。watchdog 杀进程后触发 exit 并取消的路径，不能再冒充正常退出场景。 |
| 慢子进程回归有实际区分能力 | 同文件 `:123`、`:126` 让真实 Node 子进程先等待 1500 ms 再输出，超过旧 1000 ms 预算；没有 mock 时钟、spawn 或解码结果。[受控 RED](decoder-controlled-red.txt) 的延迟场景实际收到 timeout，修改后的[完整 GREEN](decoder-focused-green.json) 中该场景通过，耗时 2167 ms。 |
| 真正 timeout 覆盖保留 | 同文件 `:62`、`:72`、`:171`、`:198` 的四个 150 ms timeout 场景未改，保存的 GREEN 全部通过，分别耗时 158、174、157、158 ms。预取消、错误分类及其他场景也未改。 |
| 生产行为保持原样 | `packages/web/src/lib/server/recording-audio-decoder.ts` 当前 SHA256 与 baseline 完全相同；`:59` 的 watchdog、`:72` 的 close 处理及取消优先规则没有变化。 |
| 诊断没有把宿主原因当成定论 | [实现说明](decoder-implementation.md) 第 7、18、59 行明确区分观察与推测。两次原始失败及构建结束后复现有保存；测量证明 spawn 返回和 PCM 就绪不同步，但本身不证明具体 OS/Jest 调度原因。受控延迟提供了竞争路径的直接验证。 |

## 证据核验与边界

独立计算并核对了 baseline、当前测试、当前生产文件，以及实现核验 JSON 所列全部 9 个证据文件的 SHA256，全部一致。重新生成的 `git diff --no-index` 与保存补丁逐字节一致，变更范围仅为取消测试这一处 hunk。

- 修改前测试：`e3f8178348672604d13b8988a0655b799acef8d77cb478bd3a926f1d05032cb8`
- 当前测试：`f22c497b38c718da04378fb4491a9cf2d8e63da1327d262adc21267a9c022562`
- 未改变的生产解码器：`3eea74f88074b37539dfb175e9256e3fe27c359ab711c7a8211bfa7a68e03c03`

已读取原始失败日志、两个 startup 探针及其测量、RED 日志、GREEN 日志与 Jest JSON。GREEN JSON 确认 38 通过、0 失败、0 pending，suite 21349 ms；控制台记录 Jest 总时间 21.804 s。没有重复执行这 38 个已成功测试，也没有重新运行探针。本审查未修改代码、依赖或其他证据，未执行远端操作或提交；全库验证由主控制器独立完成。

规范问题 0；规格问题 0；无可行动的文件:行号严重性发现。

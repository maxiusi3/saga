# T04 / G1 真机执行与证据模板

日期：2026-10-15（Asia/Taipei）。依据 [P0 质量门第 2–3 节](../superpowers/specs/2026-10-13-upgrade-p0-gates.md)。本文件是操作准备，**真机矩阵尚未执行，G1 未通过**。

## 执行前条件

只用虚构口述，避免珍贵原声。先登记实际硬件、OS/浏览器完整版本、麦克风、剩余空间、电源和网络条件。保存代码 commit、工作树指纹、测试环境代号、部署 ID/迁移版本；本地测试没有部署 ID 时填“本地，无部署”。

当前可测试本机落盘、重开恢复、回听/下载；云端封口、块对账、T05 Worker、完整资产确认和撤权后写回尚未接入。相关案例登记 `blocked`，不能用恢复预览或本地解码脚本代替。未核实的 Storage/RLS、恢复备份与远端授权不能填写通过。

## 组合与案例编号

| 组合 ID | 硬件/浏览器目标 | 时长 | 当前状态 |
|---|---|---|---|
| IOS-SAF | iPhone / Safari | 5、20、30 分钟 | 未执行 |
| AND-CHR | Android / Chrome | 5、20、30 分钟 | 未执行 |
| MAC-SAF | macOS / Safari | 5、20、30 分钟 | 未执行 |
| MAC-CHR | macOS / Chrome | 5、20、30 分钟 | 未执行；此前短 Chromium 合成音不替代本项 |
| WIN-BRW | Windows / 实际声明支持的 Chrome 或 Edge | 5、20、30 分钟 | 未执行；选择后固定浏览器，均声明则分别执行 |

每个时长依次执行下表；案例 ID 使用 `组合-分钟数-故障-阶段-序号`，例如 `IOS-SAF-20-F04-P2-01`。独立录音为独立 session，不拼接不同录音容器。

| 故障 | 操作 | 必须观察的结果 |
|---|---|---|
| F00 正常结束 | 录到结尾标记后停止，等待持久化 | 起止标记、顺序、时长、末块与文件 SHA-256；不得仅凭按钮状态判断 |
| F01 录制中断网 | 开始后关闭网络，持续口述一分钟，再联网 | 本机持久化和待上传分开；补传不删除恢复副本 |
| F02 上传中断网 | 已有待上传块时断网，稍后恢复 | 原块不丢；重复上传不覆盖另一会话；云端项当前 blocked |
| F03 刷新 | 在指定阶段刷新同一页面 | 重新登录后只列当前账号/项目草稿，原 session 可恢复 |
| F04 关页重开 | 关闭录音页，重新进入项目 | 连续块校验后回听/下载；缺损明确失败并保留草稿 |
| F05 锁屏 | 录制中锁屏一分钟再解锁 | 记录实际中断点；不要求浏览器后台持续录制，不显示未经证实的保存承诺 |
| F06 来电/抢占 | 真机来电或另一应用占用麦克风 | 恢复、中断、错误提示与实际音频一致；记录是否丢失结尾 |
| F07 配额失败 | 在受控浏览器配置中制造 IndexedDB 写入失败 | 未落盘部分不得显示本机已保存；已有块保留；不得损坏其它应用数据 |
| F08 上传失败 | 测试存储拒绝或中断请求 | 显示真实失败和重试出口；本机副本保留；新 adapter 项当前 blocked |
| F09 重复保存 | 快速重复停止/保存，重开再操作 | 不产生重复会话/故事，不串账号/项目；数据库幂等项当前 blocked |
| F10 进程退出 | 在虚构录音中终止浏览器进程，重启 | 与关页区别记录，测实际已持久范围，不推断未落盘尾部存在 |

中断阶段：P1 尚未落盘；P2 已落盘未上传；P3 云端已收块未完整确认；P4 完整确认后清理前。每个组合/时长覆盖四阶段；P3/P4 在新 adapter 与测试环境准备前保持 blocked。系统强杀、锁屏和网络操作必须在专用测试环境完成，不中断用户其它工作。

## 一次案例的操作顺序

1. 清点测试账号 A/B、项目 A/B 与旧恢复草稿；记录数量，禁止整体清除 IndexedDB 充当重置。
2. 录音开头说“synthetic test，案例 ID，start”；每分钟说分钟编号，结束前说“end，案例 ID”。用外部计时器记录实际起止时间。若做播放参考输入，另存参考文件时长及 SHA-256，记录麦克风是否真实接收。
3. 按故障表和指定阶段操作，记录故障时刻、最后成功落盘序号、上传序号和 UI 提示；截图与日志用案例 ID 命名。
4. 回到同账号/项目；恢复并下载本机副本。核听开头、每分钟和结尾，记录已恢复范围和缺失部分；重算下载文件 SHA-256，保留完整清单。
5. 切换账号 B/项目 B，验证原草稿不可误列；退出后预览/下载入口消失。撤权后的本地本人导出、云端阻断需要专门集成用例，不从账号切换推断。
6. 云端路径准备后：对照冻结的服务端块清单和实际对象字节，记录验证结果、资产 ID/版本、原件 hash/时长；执行另设备离线导出、删除/墓碑和恢复重放案例。
7. 失败保留证据与副本，写修复编号，再以新案例 ID 复测；原失败记录不得覆盖。只有必要案例全部通过才申请该组合的支持声明。

## 单案例记录模板

```yaml
case_id: IOS-SAF-20-F04-P2-01
status: not_run # not_run / blocked / failed / passed
executed_at: null # ISO 8601，含时区
operator: null
code_commit: null
working_tree_sha256: null
environment: null
deployment_id: null
migration_version: null
device_model: null
os_version: null
browser_version: null
microphone: null
free_space_bytes: null
network: null
actual_mime_type: null
session_id: null
target_duration_ms: 1200000
fault_at_ms: null
last_persisted_index: null
last_uploaded_index: null
expected_chunks: null
recovered_chunks: null
decoded_duration_ms: null
output_byte_size: null
output_sha256: null
start_marker_heard: null
minute_markers_heard: []
end_marker_heard: null
missing_range: null
cloud_asset_id_version: null
ui_claims_match_evidence: null
evidence_paths: []
failure_or_blocker: null
retest_case_id: null
```

`null` 代表未测/未知，不能改成 0 或 false 来凑齐数据。测试结果只覆盖具体设备/版本；桌面视口宽度测试不等于手机，短合成音解码不等于长录音完整恢复。

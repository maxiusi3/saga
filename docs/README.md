# UR Saga 项目文档索引

更新：2026-11-14（Asia/Taipei）。当前决策为负责人“D03=A，其他按照推荐”：**D01–D16全部A，一名主要开发者，高质量优先，约24–34周。** 决策已确认；产品实施和G0–G4验收分别跟踪。

## 当前执行入口

- **11 月 14 日六项审计修复已验收**：[关闭报告](research/2026-11-14-audit-repair.md) · [汇总回执](research/evidence/2026-11-13-audit-repair/resume-2026-11-14/verification.json) · [当前 handoff](HANDOFF-2026-10-13-upgrade.md) · [处理恢复](processing-recovery.md) · [AI 编辑复核](story-ai-edit.md) · [语义检索](semantic-search.md) · [托管提醒](hosting-reminders.md)。Web3798/shared16/infra30及安全门通过；完整41文件迁移下，联合Chrome2479、G4 188、提醒228、备份恢复597项通过，源码无漂移，独立复审无本批剩余P1/P2。真实质量与生产放行仍列后补；此前“整体本地工程100%”估算已撤回。

- **11 月 11 日 G3 本地验收完成**：[报告](research/2026-11-11-g3-delivery.md) · [回执](research/evidence/2026-11-11-g3-delivery/verification.json) · [证据](research/evidence/2026-11-11-g3-delivery/README.md) · [后补](research/2026-11-11-g3-manual-follow-up.md) · [归档 Worker](publication-worker.md)。已批准正文的完整中文 PDF／持久归档、权威来源检索／当前原声验证、US$59 测试订单与来源退款闭环；综合 Chrome672、备份556、G2 543、G1删除250、Web3609/shared16/infra28、186页通过。人工继续放行；真实收费、托管和家庭质量未实测。下一步可推进 G4 实现复核与试点准备。

- **11 月 11 日 G2 中断续接已收尾**：[续接回执](research/evidence/2026-11-11-g2-resume/verification.json) · [完整证据索引](research/evidence/2026-11-10-g2-review/README.md)。补齐聊天「37」中断前未生成的汇总回执与源码快照；复跑 G2 原生／Chrome 543、Web 3,567、shared 16、infra 25、184 页构建通过，1,204 个源码及配置文件无变化。G1 删除、备份及独立复审沿用下列 11 月 10 日回执，已核对其源码指纹。下一阶段为 G3。

- **11 月 10 日 G2 本地验收完成**：[报告](research/2026-11-10-g2-review-and-transcription.md) · [回执](research/evidence/2026-11-10-g2-review/verification.json) · [人工后补](research/2026-11-10-g2-manual-follow-up.md)。故事审阅、原声定位、配置式转写、多成员署名与不可变批准已接通；G2原生/Chrome542、G1删除244、备份493、Web3567/shared16/infra25及184页构建通过。独立复审无剩余阻断项。旧 G2=true 来自合成/常量评测的历史声明不作真实质量证据；真人、真实供应商与托管测试后补。

- **11 月 10 日 G1 中断续接已收尾**：[复核报告](research/2026-11-10-g1-resume-verification.md) · [新运行回执](research/evidence/2026-11-10-g1-resume/verification.json)。重建缺失的本地 PG17.4 运行时后，Chrome 241、备份恢复 493、Web 3,421、shared 16、infra 25、184 页构建再次通过；未修改产品代码。此为 G2 开始前的 G1 复核基线；当前进展见上项。

- **G1本地Chrome验收已完成**：[整故事删除报告](research/2026-11-09-g1-story-deletion.md) · [最终回执](research/evidence/2026-11-09-g1-story-deletion/verification.json) · [人工后补清单](research/2026-11-09-g1-manual-follow-up.md)。实际项目页202删除/刷新隐藏/正文派生清除/Worker磁盘删除，原生Chrome241、备份493断言；Web3421/shared16/infra25、184页通过，独立复审无余项。人工门禁已放行，未执行项不作实测；历史未映射媒体/访谈、托管和手机列后补。本地通过不等于全项目发布资格。

- **前批 G1 在线媒体删除**：[报告](research/2026-11-09-g1-deletion-execution.md) · [回执](research/evidence/2026-11-09-g1-deletion-execution/verification.json) · [人工后补清单](research/2026-11-09-g1-manual-follow-up.md) · [运行说明](media-deletion-worker.md)。永久引用阻断、真实删除、持久结果、API可见迟到复查通过；原生/Chrome184、完整迁移/备份491断言，Web3398/shared16/infra25及184页构建通过。人工门禁已全部放行。整故事入口/数据库内容擦除与供应商底层证明未混同为本批通过。

- **前批 G1 修复与恢复验收**：[报告](research/2026-11-07-g1-fixes-and-recovery.md) · [证据](research/evidence/2026-11-07-g1-fixes/README.md) · [回执](research/evidence/2026-11-07-g1-fixes/verification.json)。中断 WebM 与完整迁移修复；Chrome 中断／AI 9 组、真实 dump/restore 与对象／墓碑重放通过；Web3382/shared16/infra24、184页构建通过。G1 剩余在线引用安全删除、晚到写入和物理结果持久化；手机后补不阻塞本轮。
- **前批 G1 Chrome 首轮 验收**：[报告](research/2026-11-07-g1-chrome-acceptance.md) · [回执](research/evidence/2026-11-07-g1-chrome/verification.json) · [本地复跑](../experiments/g1-local/README.md)。原生 5／20／30 分钟录音、按序原件 hash/解码、修复后的新录音导出、权限反例和独立离线 Chrome 回放通过；Web3352／shared16／infra23、184页构建通过。中断 WebM、空环境迁移链和既有物理删除／备份恢复仍未完成，G1 false。用户授权本地环境／账号由 Agent 搭建，手机手测延期；按[新差距清单](research/2026-11-02-g1-gap-register.md)继续。

- **前批 G1 持久删除租约（本地完成）**：[报告](research/2026-11-06-g1-deletion-leases.md) · [规格](superpowers/specs/2026-11-06-g1-deletion-leases-design.md) · [计划](superpowers/plans/2026-11-06-upgrade-g1-deletion-leases.md) · [最终回执](research/evidence/2026-11-06-g1-deletion-leases/verification.json)。独立账本保存领取／尝试／恢复，原捕获清单不变；未开始可限次重试，已开始未知结果不自动重放。SQL14／578、最终适配器3／281、Jest85与完整门禁Web3344／shared16／infra23、184页通过；整批M1修复和限定复审通过。无物理删除能力，历史关闭数0/9以新清单为准。

- **前批 G1 删除目标与候选备份兼容（本地完成）**：[本批报告](research/2026-11-06-g1-deletion-capture.md) · [证据](research/evidence/2026-11-06-g1-deletion-capture/README.md) · [当前 gap](research/2026-11-02-g1-gap-register.md)。原子持久捕获墓碑、资产/分块/候选目标和取消请求；合法未登记会话可删除，重复请求稳定，事务错误回滚。TS/CJS/CLI 候选清单与真实捕获墓碑重放一致。整批发现的封口/删除竞态 I1 已用前向迁移修复，限定复审规格／质量 Approved；最终原生删除21组／759断言、备份3组／82断言与完整 Web160／3259、shared4／16、infra23、184 页构建通过，本批本地验收完成；物理删除、引用安全 GC、真实备份恢复和完整迁移链仍开放，G1 仍 0/9。

- **前批 G1 录音保存与恢复流程（本地完成）**：[用户操作进展与 gap](research/2026-11-06-g1-recording-flow.md) · [Worker 运行说明](recording-worker.md) · [手机宽度截图](research/evidence/2026-11-05-g1-recording-flow/integrated-browser-1793929758961-97783f87-95d8-42ed-a730-278bccd1166d/saved-mobile.png)。录音、重开、继续保存、实际 Worker、唯一故事、播放及显式清理已本地贯通；断网、账号切换和三处提交后响应丢失可恢复。完整 Web159/3204、shared4/16、infra20、184页通过，真实浏览器310/341与原生宿主723断言通过；整批审查及最终修复复审通过，新增88例异常链拒绝时完整状态不变。G1正式关闭仍0/9；删除/GC/候选备份、完整迁移链及环境/真机验收继续推进。

- **前批 G1-01 只读终态查询与显式对账（本地切片完成）**：[报告](research/2026-11-05-g1-recording-status.md) · [实施清单](superpowers/plans/2026-11-05-upgrade-g1-recording-status.md) · [最终回执](research/evidence/2026-11-05-g1-recording-status/verification.json)。STABLE 授权快照、完整终态校验及认证 GET，发布响应丢失后单次查询确认；处理中返回 unresolved，无写入或清理许可。定向5/564（新增225）、原生SQL5/191、实际SDK/本地HTTP4/585、完整Web153/3100、shared4/16、infra14、184页通过；724受测源码与189原生压缩档案核验，3393旧证据保护。两项分项及整批独立规格/质量Approved，收口见最终回执；客户端确认/幂等故事保存、安全清理、删除/GC/备份及云端真机继续开放，G1=false。

- **前批 G1-01 Worker 终态接线（本地切片完成）**：[报告](research/2026-11-05-g1-terminal-worker.md) · [实施清单](superpowers/plans/2026-11-05-upgrade-g1-terminal-worker.md) · [最终回执](research/evidence/2026-11-05-g1-terminal-worker/verification.json)。清理/复查/心跳排空后调用原子发布或确定失败，保留旧候选入口。定向7/303（新增46）、两套旧编译图、原生整链8/11391、完整Web151/2875、shared4/16、infra14、184页通过；分项及整批独立规格/质量Approved，717受测源码与137原生归档已核对，2744旧证据未变。状态对账/客户端确认、删除/GC/备份和云端真机仍待接续，G1=false。

- **前批 G1-01 原子终态边界（本地切片完成）**：[报告](research/2026-11-04-g1-recording-finalization.md) · [实施清单](superpowers/plans/2026-11-04-upgrade-g1-recording-finalization.md) · [最终回执](research/evidence/2026-11-04-g1-recording-finalization/verification.json)。原子发布/确定永久失败、删除互斥、严格回执和候选回放/导出谱系检查已实现。定向16/677，原生SQL 15/492、SDK+本地HTTP/PG 8/278，完整Web150/2829、shared4/16、infra14、184页通过。独立规格PASS/质量APPROVED；当批未接Worker/客户端，不授权清理，G1=false。

- **前批 G1-01 Worker 私有候选产物**：[报告](research/2026-11-03-g1-worker-candidates.md) · [实施清单](superpowers/plans/2026-11-03-upgrade-g1-worker-candidates.md) · [证据](research/evidence/2026-11-03-g1-worker-candidates/README.md)。先登记、不可覆盖上传、全量回读、prepared 与全过程租约监督已本地收口；修复微秒回执、唯一索引等待越过租期和原生 POST ack 清理问题。定向 6/377，原生 PG/HTTP/FFmpeg 31/21,697，独立复跑 31/21,682；完整 Web 148/2672、shared 4/16、infra 14、184 页通过。规格 PASS 后质量 Approved，既有2,285证据及1,471历史输入未变。prepared 不等于 ready/清理授权；原子发布、客户端确认及云端/真机/新 bucket 备份删除覆盖仍缺，G1=false，不暂存/提交/推送或部署。
- **前批 G1-01 Worker 持久领取与租约监督**：[报告](research/2026-11-03-g1-worker-lease.md) · [实施清单](superpowers/plans/2026-11-03-upgrade-g1-worker-lease.md) · [证据](research/evidence/2026-11-03-g1-worker-lease/README.md)。正式五动作 RPC 原子维护 attempt/数据库时钟 fence；Worker 串行续租、取消并等待实际输入核验清理、最终检查。真实 PG/进程/FFmpeg 17 场景/1943 断言，独立复跑 17/1933；扩大定向 6/362，冻结 Web 146/2588、shared 4/16、infra 14、184 页全部通过；规格 PASS、质量 Approved。保留272既有证据与1471历史输入。成功仍 running/input_verified、不可清理；候选上传/原子发布/失败终态/客户端确认及真实云端/真机、大清单性能仍待推进。G1=false，不暂存/提交/推送或部署。
- **前批 G1-01 Worker 可信输入核验**：[报告](research/2026-11-03-g1-worker-input.md) · [证据](research/evidence/2026-11-03-g1-worker-input/README.md)。基线 `c0669e805`；job ID 可信账本回读、私有物理路径流式 bytes/hash/全流解码，修复 scope 超时后遗留数据库复查。最终定向 4/295、真实本地 HTTP/FFmpeg 21 场景/250 检查、Web 144/2521、shared 4/16、infra 14、184 页通过；规格 PASS、质量 Approved。只读且无清理许可，当时尚未接持久领取/心跳/原子发布；当前租约进展见页首，前批证据不变。G1-01 partial，不推送或部署。
- **前批 G1-01 持久封口清单与统一上传路径**：[报告](research/2026-11-02-g1-durable-manifest.md) · [实施清单](superpowers/plans/2026-11-02-upgrade-g1-durable-manifest.md) · [证据](research/evidence/2026-11-02-g1-durable-manifest/README.md)。基线 `1ca1e06dd`；service-role-only RPC 原子固定会话/块输入、精确重放和冲突拒绝，新上传统一逻辑/真实物理路径，HTTP 先取得持久回执再登记资产/任务。源码与定向 8/165 匹配；续接 Web 142/2295、shared 4/16、infra 14、184 页，PG17.4 普通/污染各 15/645 通过；原中断日志不计 PASS，next-env 已恢复。独立规格 PASS 后质量 Approved（独立核验证据，非重跑测试），1471 历史输入与前五批 140 证据文件未变；文档/限定暂存载荷随本地检查点封存。仅可信输入身份/持久绑定，不证明音频内容；下一步 Worker 回读/核验/领取/发布，再接客户端确认/清理。G1-01 仍 partial，不推送或远端部署。
- **前批 G1-01 稳定封口身份与可恢复登记**：[报告](research/2026-11-02-g1-seal-registration.md) · [实施清单](superpowers/plans/2026-11-02-upgrade-g1-seal-registration.md) · [证据](research/evidence/2026-11-02-g1-seal-registration/README.md)。基线 `665484289`；同一 actor/project/session 默认稳定资产 ID，insert/23505 重查、缺任务补写和严格输入/角色/状态验证；封口回执从不授予清理许可。真实 RED 44 fail/13 pass，GREEN 4/97、Web 139/2251、shared 4/16、infra 14、184 页通过；规格 PASS 后质量 Approved，两位独立复跑 4/97；1471 历史输入与前四批 115 证据文件不变，完整性随新本地检查点封存。登记子切片完成但 G1-01 仍 partial；下一批接可信 session/chunk 清单与统一上传命名，本地开发无需负责人手工操作；不是原子事务、Worker 或客户端整链完成，不推送。
- **前批 G1 恢复读取一致性与 Gap 清单**：[报告](research/2026-11-02-g1-recovery-read-consistency.md) · [人工操作/工程差距](research/2026-11-02-g1-gap-register.md) · [实施清单](superpowers/plans/2026-11-02-upgrade-g1-recovery-read-consistency.md) · [证据](research/evidence/2026-11-02-g1-recovery-read-consistency/README.md)。基线 `8d4fc6dc5`；并发取块先复查会话，append/首次落块/清理返回 changed，保留 hash 后终检；无写库/重试/schema 扩张。3 类行为 RED；GREEN Chromium 31 子案例 / Node 32、定向 4/72、Web 139/2200、shared 4/16、infra 14、184 页。规格文档遗漏已修复并复审 PASS，随后独立质量 Approved；1471 历史输入与 85 前批证据未变，next-env 恢复，本地切片封存。G1 仍 false，9 项 gap 区分工程接线、环境授权与人工真机/核听/第二设备离线操作；不推送。
- **前批 G1 录音草稿连接失效与显式恢复**：[报告](research/2026-11-01-g1-recorder-connection-recovery.md) · [实施清单](superpowers/plans/2026-11-01-upgrade-g1-recorder-connection-recovery.md) · [证据](research/evidence/2026-11-01-g1-recorder-connection-recovery/README.md) · [handoff](HANDOFF-2026-10-13-upgrade.md)。基线 `f59e8f863`；清除失败/失效连接缓存，versionchange 主动释放，旧通知不逐出新连接；只有下一次显式调用重开，不自动重试写入或修改 schema。5 项新行为 RED，Chromium 28 子案例 / Node 29 项、定向 4/68、Web 139/2196、shared 4/16、infra 14、184 页通过；独立规格 PASS 后独立质量 Approved。1471 历史输入和前两批 60 证据文件未变，next-env 已恢复。close 是事件注入，不是真实强杀/真机验收；G1=false，只本地 checkpoint，不推送。
- **前批 G1 录音草稿写入边界与清理回滚**：[报告](research/2026-11-01-g1-recorder-write-guards.md) · [实施清单](superpowers/plans/2026-11-01-upgrade-g1-recorder-write-guards.md) · [证据](research/evidence/2026-11-01-g1-recorder-write-guards/README.md) · [handoff](HANDOFF-2026-10-13-upgrade.md)。基线 `686599f61`；同事务拒绝重复块覆盖及已清理/已确认会话的迟到写入，上传标记/清理失败整体回滚，interrupted 仍接受末块。11 项新增行为 RED，Chromium 23 子案例 / Node 24 项、定向 4/68、Web 139/2196、shared 4/16、infra 14、184 页通过；规格 PASS 后质量 Approved。首轮中断日志保留不计通过，1471 历史输入及前批 31 证据文件未变，next-env 原字节恢复。仅 API 局部契约，不是全库不可变或真机验收；G1=false，只本地 checkpoint，不推送。
- **前批 G1 本地录音持久化故障恢复契约**：[报告](research/2026-11-01-g1-recorder-recovery.md) · [实施清单](superpowers/plans/2026-11-01-upgrade-g1-recorder-recovery.md) · [证据](research/evidence/2026-11-01-g1-recorder-recovery/README.md) · [handoff](HANDOFF-2026-10-13-upgrade.md)。修复 IndexedDB 会话读改写竞态与块事务异常部分提交；5 项原行为 RED，原生 Chromium 11 子案例通过，定向 4/68、Web 139/2196、shared 4/16、infra 14、184 页构建通过。规格 PASS，质量 Approved。30/120/180 合成块只代表块数量模型，真机长录音仍 0，G1=false；本批只本地 checkpoint，不推送。
- **前批方案 B 备份恢复演练与验证工具（本地切片）**：[报告](research/2026-11-01-scheme-b-backup.md) · [实施清单](superpowers/plans/2026-11-01-upgrade-scheme-b-backup.md) · [证据](research/evidence/2026-11-01-scheme-b-backup/README.md) · [handoff](HANDOFF-2026-10-13-upgrade.md)。纯函数归档与清单核验（`PGDMP` 12 字节头部魔数与确定性 SHA-256、白名单桶 `['saga', 'audio-recordings']`、对象 ID/Key 严格清洗与 DoS 防御、集合上限与溢出防护）；冻结后删除墓碑重放防复活引擎；切流端点接入 `schemeBBackup`，无证据 fail-closed 保持 `unverified`；独立 CLI 工具 `scripts/verify-scheme-b-backup.cjs`（`--dry-run` 协议自检与磁盘文件全量验算，纳入 `npm run test:infra` 自动回归）。Web 139 套/2196 项、shared 4/16、infra 14、184 页构建通过；规格 PASS、质量 Approved；本地切片完成，不触发推送。
- **前批供应商账户/区域/数据条件核验链**：[报告](research/2026-11-01-provider-policy-verification.md) · [实施清单](superpowers/plans/2026-11-01-upgrade-provider-policy-verification.md) · [证据](research/evidence/2026-11-01-provider-policy-verification/README.md)。纯函数合规核验、Fail-Closed 条款判定（训练退出、ZDR/≤7天 SLA、区域白名单、严格 ISO 8601 UTC 日历防滚动、DoS 长度防御与多模型联合键）；API Key 严格解耦；无证据全量 `blocked_by_policy`，切流端点仍 `503 not_ready`。Web 138 套/2168 项、shared 4/16、infra 7、184 页构建通过；规格 PASS、质量 Approved；本地切片完成，不触发推送。
- **前批运营告警投递与响应人核验**：[报告](research/2026-11-01-alert-delivery.md) · [实施清单](superpowers/plans/2026-11-01-upgrade-alert-delivery.md) · [证据](research/evidence/2026-11-01-alert-delivery/README.md)。纯函数告警脱敏载荷、LRU 抑制台账、严防 SSRF、TOCTOU 并发排队与单发 Webhook 投递；未配置外部 Webhook 或未核实响应人时 fail-closed 保持 `unavailable`，切流端点仍 `503 not_ready`。Web 137 套/2139 项、shared 4/16、infra 7、184 页构建通过；规格 PASS、质量 Approved；本地切片完成，不触发推送。
- **前批部署采集覆盖证明**：[报告](research/2026-10-30-deployment-collection-coverage.md) · [实施清单](superpowers/plans/2026-10-30-upgrade-deployment-collection-coverage.md) · [证据](research/evidence/2026-10-30-deployment-collection-coverage/README.md)。构建归属与 v4 只读聚合；`windowComplete` 仅台账年龄，`upload_collection_coverage` 保留，仍 `503 not_ready`；未做真实封存，不触发推送。
- **最新可靠上传客户端回报观测**：[10 月 30 日报告](research/2026-10-30-upload-observations.md) · [实施清单](superpowers/plans/2026-10-30-upgrade-upload-observations.md) · [证据索引](research/evidence/2026-10-30-upload-observations/README.md) · [handoff 当前状态](HANDOFF-2026-10-13-upgrade.md)。保留中断前 Task 1 SQL/PG，续接 begin → 非覆盖 PUT → 独立 finish → 原 complete 与 v3；只是客户端回报，不证明真实存储成功。PG17.4 正常/污染各 14/631；修正后定向 6/316、规格复审 6/312、Web 135/2065、shared 4/16、infra 7、184 页通过。唯一 guard 故障 503 规格问题已修复；**规格 PASS、质量 Approved、独立收口 PASS，验证汇总见 [verification.json](research/evidence/2026-10-30-upload-observations/verification.json) 为准**。
- **前批媒体异步重新授权**：[10 月 30 日报告](research/2026-10-30-media-revalidation.md) · [实施清单](superpowers/plans/2026-10-30-upgrade-media-revalidation.md) · [验证汇总](research/evidence/2026-10-30-media-revalidation/verification.json) · [handoff 当前状态](HANDOFF-2026-10-13-upgrade.md)。上传/回放签名后、校验 CAS 前后重新验证权限、当前资产与删除台账，拒绝迟到凭据/结果；保留幂等与音频待解码状态。定向 215 项、Web 133/1877、shared 4/16、infra 7、184 页通过，规格 PASS/质量 Approved；不是原子撤权或 G0 完整验收。
- **前批同步导出组装观测**：[10 月 29 日报告](research/2026-10-29-export-observations.md) · [实施清单](superpowers/plans/2026-10-29-upgrade-export-observations.md) · [验证汇总](research/evidence/2026-10-29-export-observations/verification.json)。持久 start/finish、typed 完整性失败与 v2 只读聚合接入真实告警；写入未知不出 ZIP，权限/墓碑终检保留。定向 159 项、PG17 正常/污染及主流程各 464 断言；Web 132/1754、shared 4/16、infra 7、184 页通过，规格 PASS/质量 Approved。
- **前批数据库运营指标接入**：[报告](research/2026-10-29-operational-snapshot.md) · [实施清单](superpowers/plans/2026-10-29-upgrade-operational-snapshot.md) · [验证汇总](research/evidence/2026-10-29-operational-snapshot/verification.json)。service_role 只读 RPC 聚合真实任务、已知成本敞口及删除超期；管理端显示部分观测，仍 `503 not_ready`。该批定向 62 项、PG17 正常/污染各 251 断言；Web 131/1706、shared 4/16、infra 7、184 页通过。
- **前批双入口项目中心接线**：[报告](research/2026-10-29-two-entry-integration.md) · [实施清单](superpowers/plans/2026-10-29-upgrade-two-entry-integration.md) · [验证汇总](research/evidence/2026-10-29-two-entry-integration/verification.json)。真实项目页受 flag 控制挂载上传、录音/邀请导航、检索/回听与有界导出；该批 Web 130/1657、shared 4/16、infra 7、184 页、浏览器 12 项与 PG17 切流 23/P3 51 断言通过。
- **前批安全修复**：[报告](research/2026-10-29-takeover-safety-closeout.md) · [证据](research/evidence/2026-10-29-takeover-safety/)。管理接口要求服务器侧 `ADMIN_CRON_SECRET` / `x-cron-secret`；切流在真实观测未连接时返回 `503 not_ready`，未核实供应商条款不标为通过。
- **当前边界与续接**：G1/G2已按用户Chrome Web口径本地验收，人工门禁放行；当前事实见页首报告。下一阶段从G3现有实现和实际验收缺口继续，历史0/9和环境等待说法不覆盖当前结论。未暂存、提交、推送、远端迁移或部署。

## 历史执行记录（原文保留，以最新核验为准）

- **通用开发中途断点接手提示词模板**：[AGENT-MIDFLIGHT-TAKEOVER-PROMPT.md](AGENT-MIDFLIGHT-TAKEOVER-PROMPT.md)（任意开发步骤中途断开时可直接复制给新 Agent 自动诊断并续接）。
- **生产切流演练、双入口与检索 UI、影子读取与持续运营告警报告**：[2026-10-25-cutover-and-ops-verification.md](research/2026-10-25-cutover-and-ops-verification.md)（含 `TwoEntryProjectHub.tsx`、`cutover-readiness.ts`、`GET /api/admin/cutover-readiness` 与 PG17.4 四阶段迁移全链路切流演练 3 场景/23 断言）。
- 最新：[P4家庭纵向试点与决策分析及G4里程碑验收报告](research/2026-10-24-p4-g4-verification.md) + 生产切流影子读取对账与 §11 运维告警模块（`packages/web/src/lib/server/cutover-readiness.ts`、`GET /api/admin/cutover-readiness`）。完成正式 SQL 迁移 `20261024000004_p4_pilot_cohort_and_g4_analytics.sql`（`public.pilot_households` 台账表 + 队列/价格档约束 + RLS）、T13 纵向试点分析与 G4 决策建议引擎（7d/28d/14d 成熟窗核算、零分母保护、家庭修订/运营支持工时 P50/P90、含未完成与退款家庭的队列单位经济、NPS 与可解释建议），并在本地 PG17.4 完成 G4 端到端验证（2 场景/22 断言通过）。**至此 P0/G0、P1/G1、P2/G2、P3/G3 与 P4/G4 全部五个阶段（`T00–T13`）工程交付均已达成（`G0–G4 = true`）。** 详见[G4里程碑判定](research/evidence/2026-10-24-p4-g4-verification/milestone-check.json)与[handoff](HANDOFF-2026-10-13-upgrade.md)。

同日第四阶段收口：[P3完整产品交付与履约及G3里程碑验收报告](research/2026-10-24-p3-g3-verification.md)。完成正式 SQL 迁移 `20261024000003_p3_archive_search_and_entitlements.sql`（`publication_snapshots`、`search_index_entries`、`entitlement_sources`、`entitlement_events` 四表 + 出版快照防篡改触发器 + 幂等/乱序支付回调 RPC + 检索删除墓碑屏蔽 RLS）、T09 完整档案包导出与标准 PDF 1.4 阅读册（含 12 个月托管与 90/30 天到期提醒时间表）、T10 权限先过滤的带出处检索（无资料不编造、支持索引原子切换与毫秒级原声定位）、T11 US\$59 单一商品/权益/乱序支付回调与全队列单位经济核算，并在本地 PG17.4 完成 G3 端到端验证（4 场景/51 断言通过）。**至此 P0/G0、P1/G1、P2/G2 与 P3/G3 均已达成（`G0 = true`、`G1 = true`、`G2 = true`、`G3 = true`），下一阶段进入 P4（`T13 家庭纵向试点与决策分析` → G4）。** 详见[G3里程碑判定](research/evidence/2026-10-24-p3-g3-verification/milestone-check.json)与[handoff](HANDOFF-2026-10-13-upgrade.md)。

同日第三阶段收口：[P2忠实AI与审阅及G2里程碑验收报告](research/2026-10-24-p2-g2-verification.md)。完成正式 SQL 迁移 `20261024000002_p2_transcript_provenance_and_review.sql`（`transcript_versions`、`transcript_segments`、`story_assertions`、`story_revisions` 四表 + 已确认修订只读触发器 + 删除墓碑屏蔽 RLS）、T06 AI 能力网关与版本化转写、T07 带出处约束与失效传播的故事整编器、T08 家庭审阅工作流（重点核对人名/年份/地点、点击回听原声、争议记忆并列保留），并在本地 PG17.4 完成 G2 端到端验证（4 场景/51 断言通过：10 户留出集 200 处植入错误 100% 检出、Wilson 95% 下界 98.12%；200 段干净负样本 0% 误报、Wilson 95% 上界 1.88%；已确认文稿严重虚构 0 处；100/100 原声回听定位通过）。**至此 P0/G0、P1/G1 与 P2/G2 均已达成（`G0 = true`、`G1 = true`、`G2 = true`），下一阶段进入 P3（`T09 → T10 → T11` → G3）。** 详见[G2里程碑判定](research/evidence/2026-10-24-p2-g2-verification/milestone-check.json)与[handoff](HANDOFF-2026-10-13-upgrade.md)。

同日第二阶段收口：[P1可靠资料底座与G1里程碑集成验证报告](research/2026-10-24-p1-g1-verification.md)。完成正式 SQL 迁移 `20261024000001_p1_foundation_and_reconciliation.sql`（9 张 P1 核心表 + 7 份未登记根迁移幂等收敛 + RLS/最小权限函数）、T02 原件校验与无外链自包含 HTML 导出、T03 删除墓碑与立即访问屏蔽、T04/T05 持久录音封口与幂等归并任务，并在本地 PG17.4 完成 G1 端到端验证（4 场景/61 断言通过：5/20/30 分钟录音故障矩阵、跨家庭与被撤权成员隔离、删除墓碑实时屏蔽与方案 B `pg_restore` 墓碑防复活重放）。**至此 P0/G0 与 P1/G1 均已达成（`G0 = true`、`G1 = true`），下一阶段进入 P2（`T06 → T07 → T08` → G2）。** 详见[G1里程碑判定](research/evidence/2026-10-24-p1-g1-verification/milestone-check.json)与[handoff](HANDOFF-2026-10-13-upgrade.md)。

同日第一阶段收口：[Storage行为预演与7份未登记根迁移对账](research/2026-10-24-storage-behavior-and-migrations.md)。在本地 PG17.4 重放私有捕获的 6 个 `storage` 函数与 7 个触发器（RED 4/53、GREEN 22/974、生命周期 4 例，规格 PASS/质量 Approved），完成 7 份未登记根迁移逐项对账，并在本地 PG17.4 完成负责人确认的 **方案 B**（`pg_dump -Fc` + 对象存储冻结清单 + 独立删除墓碑重放 + `pg_restore`）与五步幂等前向收敛 SQL 演练（5 场景/47 断言通过）；供应商样本探针与耗时/账单测算按负责人决策推迟至 P2 `T06` 前（`deferred_by_user`）。**至此 §7.1 的 G0 里程碑与 P0 修复已全部达成（`G0 = true`、`p0Complete = true`），已按授权推送 `codex/october-upgrade-p0` 至 GitHub。** 详见[本批验证汇总](research/evidence/2026-10-24-storage-behavior/verification.json)、[里程碑判定](research/evidence/2026-10-24-storage-behavior/milestone-check.json)及[handoff](HANDOFF-2026-10-13-upgrade.md)。

前批：[P0差距与Storage/旧删除修复](research/2026-10-23-p0-gap-and-storage-audit.md)。六函数/七触发器真实只读采集及静态语义审查完成，旧删除调用本地关闭；Web108/1438、shared4/16、infra7与180页构建通过。范围、审查和限制见[前批汇总](research/evidence/2026-10-23-storage-definition-capture/verification.json)。

部署安排：2026-10-13负责人明确暂不部署，完成里程碑后再统一部署；2026-10-15授权达到原计划里程碑后推送 GitHub。2026-10-24 负责人授权在本地分支 `codex/october-upgrade-p0` 创建检查点提交（不推送远端）。


| 文档 | 用途 |
|---|---|
| [Storage行为预演与迁移对账报告](research/2026-10-24-storage-behavior-and-migrations.md) · [本批证据索引](research/evidence/2026-10-24-storage-behavior/README.md) | PG17 精确函数/触发器重放（22场景/974断言）、4项极端生命周期清理、7份未登记根迁移逐项对账与回滚方案、G0工程收口 |
| [Storage定义/旧删除本批证据](research/evidence/2026-10-23-storage-definition-capture/README.md) | 精确采集、语义审查、53项采集回归、34项PG17验证、18项删除回归及完整项目检查；真实HTTP/恢复未验收 |
| [PG17旧RLS/来源账本组合](research/2026-10-22-pg17-rls-source-composition.md) | 正常/污染环境各72场景、832个行为断言、236项账本检查及18条真实锁证据；六项兼容RED和四类生命周期均通过；[汇总](research/evidence/2026-10-22-pg17-rls-source-composition/verification.json)记录四项通过审查与最终封存状态 |
| [用户协作清单](research/2026-10-22-user-action-checklist.md) | Storage、迁移/备份、模型账户、部署/Auth只读步骤；真机暂缓 |
| [当前会话交接 Handoff](HANDOFF-2026-10-13-upgrade.md) | 新会话续接入口：当前分支、未提交工作树、已完成批次、验证、阻塞和下一步 |
| [已确认决策台账](2026-10-10-upgrade-decisions.md) | 16项选择、条件和原备选；D03执行A，原推荐B仅供追溯 |
| [综合升级实施计划](2026-10-10-integrated-upgrade-plan.md) | 单人排期、范围、架构、T00–T13、质量门、预算和试点 |
| [P0准备计划](superpowers/plans/2026-10-11-upgrade-p0-preparation.md) | 先建立环境/数据/供应商基线和实现规格，再推进P1 |
| [T00首批实施](superpowers/plans/2026-10-11-upgrade-t00-truthful-ai.md) | 真实AI失败、响应校验、录音审阅状态及旧结果隔离；已落代码 |
| [10月11日基线与核验](research/2026-10-11-upgrade-baseline.md) | T00运行环境、媒体路径和测试证据；后续变化见10月13日实施记录 |
| [10月13日媒体入口实施](research/2026-10-13-media-access-implementation.md) | 签名回放/ASR/图片上传的定位与权限加固，保留T00 |
| [T01两入口本地原型](prototypes/2026-10-13-two-entry/README.md) | 导入/邀请录音、失败恢复、核对与交付的状态演示；研究未执行 |
| [T01观察脚本](research/2026-10-13-t01-study-guide.md) | 6–8户研究准备、任务话术、分母与记录模板；0户已观察 |
| [T01实施与验证](research/2026-10-13-t01-prototype-implementation.md) | 本地原型完成；85步、键盘/窄屏、演示下载及独立审查证据 |
| [T05持久Worker本地验证](research/2026-10-15-t05-durable-worker-poc.md) | 隔离 PostgreSQL/pg-boss、独立进程与事务故障，13场景/125断言；真实供应商/生产 adapter 尚未接入 |
| [10月21日邀请管理／22日恢复收尾](research/2026-10-21-invitation-management.md) | 当前：可信来源、绑定历史、共享管理UI及最小票据恢复已本地实现；原测试PG17 16/2448、四生命周期、定向5/54、Web105/1420、shared4/16、infra7、180页；22日仅完整性核验、未重跑；实现/文档/整批审查Approved，最终完整性通过，本地收尾完成，见[状态](research/evidence/2026-10-21-invitation-management/verification.json) |
| [10月21日邀请发送 HTTP](research/2026-10-21-invitation-sender-http.md) | 前批：默认关闭send/release/lookup、旧入口关闭、取消严格确认；17/521及项目101/1373、shared4/16、infra7、178页通过；规格、质量、文档及整批审查完成；当时的来源选择/管理UI后续由当前批承接 |
| [10月20日可信权益事件](research/2026-10-20-trusted-entitlement-events.md) | 前批：事件/来源去重、终态撤销、邀请成员与RPC/表列ACL本地组合；95/3211、20并发、4类清理及项目96/1278通过。10月21日独立规格PASS／质量Approved，文档独立审查 PASS／Approved、整批独立审查 PASS，本批本地收尾完成；原运行结果与输入保持不变 |
| [10月19日认证会话衔接](research/2026-10-19-auth-session-integration.md) | 前批：本地PKCE/cookie、provider核实store/SSR/Bearer与OTP完成；28套/605项、Chromium14项及项目96/1278通过，Task 1规格复审PASS/质量Approved；文档独立审查、整批独立审查与最终完整性均已通过，真实提供方/部署资格开放 |
| [10月19日认证回跳安全与旧状态清理](research/2026-10-19-auth-return.md) | 历史批：安全next、auth_next只删不读、固定错误/日志与实际SDK callback；430项及项目85/1196通过，Task 1 PASS/Approved；文档/整批审查及最终完整性均已通过，当时会话衔接后续已由当前批本地实现承接 |
| [10月19日邀请只读兼容与恢复UI](research/2026-10-19-invitation-read-ui.md) | 前批：token GET只读兼容、pending暂停、两页面显式unknown恢复；253项及固定代码后项目82/1019通过，I1修复复审Approved；Task 2文档独立审查、整批独立审查及最终完整性均已通过 |
| [10月18日邀请HTTP接受与状态适配](research/2026-10-18-invitation-http-adapter.md) | 前批：默认关闭/Bearer-only、两个接受入口/facade/显式只读恢复；194项与项目80/960通过，Task 1修复复审PASS/Approved；Task 2独立审查PASS/Approved；整批审查及最终完整性已通过，M1已关闭 |
| [10月18日邀请token与持久席位事务](research/2026-10-18-invitation-transactions.md) | 前批：隔离send/accept/release/查询、持久预留与绑定；158/2,288、33并发、协议18/18和4类清理，Task 1独立PASS/Approved；Task 2独立审查PASS/Approved；整批独立审查已PASS |
| [10月18日RPC邀请/项目权限候选](research/2026-10-18-rpc-access-guards.md) | 前批：原签名本人/资源事务候选，修复后117场景1834断言、26锁等待及4类清理；任务及整批独立审查PASS，未部署 |
| [10月18日邀请兼容核查](research/2026-10-18-invitation-compatibility.md) | 五处调用、固定表/约束及未来token/确认邮箱/持久预留边界；独立审查PASS，正式适配未实现 |
| [10月18日PG17依赖与导出请求](research/2026-10-18-pg17-routines.md) | 前批：受限触发采集69项、原生17.4的12原RPC与7表依赖、两重载持久请求候选141场景874断言、4类清理及规格/代码/整批复核PASS，生产未改 |
| [10月17日RPC定义与通知权限](research/2026-10-17-routine-audit.md) | 前批：12个真实定义/13处调用核对，52项采集器验证；通知精确重放及本人授权候选19场景181断言、独立审查PASS，生产未改 |
| [10月17日T02来源账本与绑定](research/2026-10-17-t02-source-ledger.md) | 前批：完整来源版本/移除历史、不可变绑定、290项/18锁证据，初审P2修复与复核PASS；正式adapter未接 |
| [10月17日函数/触发器/ACL补核](research/2026-10-17-metadata-supplement.md) | 采集器P2修复、23项及复核；真实39函数/21触发器，邀请RPC差异/函数授权语义待核，bucket仍拒绝 |
| [10月17日T02来源投影与兼容](research/2026-10-17-t02-legacy-mapping.md) | 前批：旧URL修复、逐字段/数组来源、2套40项和真实DB19项；宿主环境P2复核已补齐 |
| [10月17日RLS审查修复](research/2026-10-17-rls-review-followup.md) | 修复Unicode边界、分配中断竞态及宿主PG环境影响；63场景351断言和6类清理，增量复核见汇总 |
| [10月17日RLS隔离演练](research/2026-10-17-rls-rehearsal.md) | 前批32条策略复现，61场景/199断言；后续审查/修复见上项，线上权限未改 |
| [10月17日远端元数据与迁移差异](research/2026-10-17-remote-metadata-reconciliation.md) | 只读前批：schema/history/RLS已取得；Storage隔离、历史缺口与字段兼容需修复，bucket/备份仍缺 |
| [T05私有输出候选与发布互斥](research/2026-10-16-t05-output-candidates.md) | 创建前持久登记、发布意图与隔离声明，45场景/277断言及独立审查通过；尚无物理GC |
| [T05已知错误与原子重试](research/2026-10-16-t05-merge-failures.md) | 明确prepare失败分类与有界重试；通用FFmpeg错误、准备后与未知提交继续保留 |
| [T04/T05真实本地文件接入](research/2026-10-16-t04-t05-local-merge.md) | 真实合并、FFmpeg、输出回读与受保护发布；正式Storage/会话adapter仍待接入 |
| [10月15日远端只读补核](research/2026-10-15-readiness-refresh.md) | Supabase项目与GitHub记录已取得，schema/RLS/备份仍缺，CI审计失败 |
| [T05任务状态续批计划](superpowers/plans/2026-10-13-upgrade-t05-contract-hardening.md) | 幂等输入、删除/取消阻断、人工复核与未知结果受控重试的本地契约 |
| [T03权限与删除续批计划](superpowers/plans/2026-10-14-upgrade-t03-consent-deletion.md) | 动作权限、用途同意、删除目标与恢复墓碑的本地契约 |
| [T04录音会话计划](superpowers/plans/2026-10-14-upgrade-t04-recording-session.md) | IndexedDB会话/块持久化、MIME选择和完整确认的本地契约 |
| [T04录音入口接入](research/2026-10-14-t04-smart-recorder-local-integration.md) | SmartRecorder先落盘、真实哈希、补传保留副本及生命周期隔离；服务端/真机仍待验收 |
| [T04恢复预览与浏览器证据](research/2026-10-15-t04-recovery-preview-browser.md) | 本地草稿校验、回听/下载、桌面 Chromium IndexedDB 重开与 UI 证据；G1/远端仍待验收 |
| [T04本地合并与实际解码](research/2026-10-15-t04-local-merge-execution.md) | 流式原件校验、受限 FFmpeg 实际解码、56 项本地集成检查；尚未接远端/Worker |
| [T04真机G1执行模板](research/2026-10-15-t04-g1-device-runbook.md) | 设备/时长/故障/阶段组合、核听标记与记录模板；实际矩阵未执行 |
| [T04服务端合并契约](research/2026-10-15-t04-server-merge-contract-local.md) | 有序块清单、合并幂等输入和完整确认门槛的本地纯函数；数据库/Worker 仍待验收，实际本地解码见续批 |
| [P0质量门定义](superpowers/specs/2026-10-13-upgrade-p0-gates.md) | 设备、权限、样本、统计分母和观察窗；尚未验收 |
| [P1数据与迁移契约](superpowers/specs/2026-10-13-upgrade-p1-contracts.md) | 资产/任务/删除/录音字段、状态、回填与回退v0.1 |
| [实施差距核查](research/2026-10-10-implementation-gap-audit.md) | 媒体路径、恢复、模拟降级、权限、导出、删除和支付缺口；2026-10-10静态快照 |
| [既有产物与证据核查](research/2026-10-10-evidence-and-artifact-review.md) | 研究来源、成本工具、旧计划的证据边界 |

执行顺序：P0基线与设计 → G0 → P1资产/任务/权限/录音 → G1 → P2忠实AI/审阅 → G2 → P3完整交付/付费 → G3 → P4成熟家庭试点 → G4。P1单人按T02→T05→T03→T04；测试随阶段执行。

当前决策台账优先于旧计划中的冲突建议；本轮明确采用US$59数字项目价格假设、完整档案/PDF、12个月托管与续存选项。实际账户、费用、商品配额、供应商删除能力和质量门结果必须有证据。

当前G0/G1仍未通过。[认证会话衔接批](research/2026-10-19-auth-session-integration.md)本地实现完成：浏览器PKCE/cookie与provider核实store/SSR/Bearer、完整session OTP、刷新时页面连续性已有证据，旧localStorage-only用户须重新登录，认证key只精确删除不导入。严格signin/callback、安全next、丢next回dashboard及裸`?type=invite`无凭据指引保留，旧fragment-only/畸形callback不恢复。最终28套/605项、Chromium14项与新项目Web96/1278、shared4/16、infra7、176页通过；773输入不变、next-env恢复。Task 1两轮独立审查的五项问题已修复，规格复审PASS、质量复审Approved且无新规格问题；文档独立审查、整批独立审查与最终完整性均已通过，见[当前汇总](research/evidence/2026-10-19-auth-session-integration/verification.json)。

RB1本地根因修复与合成集成完成，真实Google/SMTP、完整Next/域名cookie部署及JWT/RLS/PostgREST仍须独立资格验收。下一独立本地任务推进可信权益source/event、撤销/持久去重、send/release与直接RPC/表ACL；正式权限/Storage/bucket、迁移/回填/回退/备份、供应商和G1真机证据仍缺。前批[认证回跳研究](research/2026-10-19-auth-return.md)及其中的后续指令保留为日期历史。audit42项（34high/8moderate）未重跑未解决；构建仍有旧Next配置与缺服务端key的configuration-validation诊断，成功build不等于生产合格。生产开关未启用，无提交/推送/迁移/部署。

2026-10-19 11:06前批历史状态：G0/G1尚未通过。[只读兼容与恢复UI](research/2026-10-19-invitation-read-ui.md)已替换两旧token GET的直表路径，默认503、启用须Bearer与规范token；check-pending始终503。两接受页面已共用显式接受/unknown只读查询，I1身份代次修复经真实RED/GREEN和独立复审Approved。最终253项由18新读取路由SDK、41 React及194既有回归组成；控制器固定代码后Web82/1019、shared4/16、infra7、176页通过，751输入不变且next-env恢复。Task 2文档独立审查、整批独立审查及最终完整性均已通过，见[当前汇总](research/evidence/2026-10-19-invitation-read-ui/verification.json)。合成loopback/组件测试不证明真实JWT/PostgREST/PG17或生产权限。pending/可信最小预览、历史opaque token仍不可用，signin/callback旧日志及auth_next持久化是独立发布阻塞；可信权益source/event、发送/取消、直接RPC/表ACL与历史兼容迁移回退仍需完成。audit42项与构建旧警告未解决，生产开关未启用；无提交/推送/部署。

前批邀请事务候选本地实现、最终158/2,288、33并发、282完整状态核对、协议18/18和4类生命周期观察已完成，Task 1独立规格PASS、质量Approved；Task 2独立审查PASS/Approved；整批独立审查已PASS，见[前批汇总](research/evidence/2026-10-18-invitation-transactions/verification.json)。本批复用前批RPC权限2026-10-18 12:24:38.969365—12:26:48.304226 Asia/Taipei的项目执行：77/766、shared4/16、infra7、175页；707输入/3日志及next-env原字节一致，未重跑。新候选有token/合成确认邮箱/持久预留，生产JWT/可信付款来源、正式adapter及旧RPC/直接表/旧入口兼容旁路仍待处理；迁移等价/回退、bucket/备份、供应商和真机仍缺。依赖audit未重跑，前批42项失败仍有效；本地批次不是原计划里程碑，未提交/推送/部署。

## 产品、代码与部署

| 文档 | 用途 |
|---|---|
| [基线PRD](../UR%20saga%20v1.8.md) | 原产品规格；开头标明与10月确认决策的优先关系 |
| [代码库约定](../CLAUDE.md) | 目录、命令、架构和工程约定 |
| [部署流程](deployment/github-vercel-supabase.md) | GitHub/Vercel/Supabase配置与发布流程；执行前核对实际环境 |
| [新Supabase项目恢复](deployment/supabase-new-project-restore.md) | 恢复步骤与验证 |
| [此前部署记录](deployment-summary-2026-10-07.md) | 历史证据，不自动证明当前线上状态 |

## 研究依据

研究按日期保存；模型、价格与供应商条件接入时复核。

| 文档 | 主题 |
|---|---|
| [10月11日引用资料补读](research/2026-10-11-reference-review.md) | 全文覆盖、PRD与旧计划冲突、历史社交证据边界 |
| [10月11日供应商准备核查](research/2026-10-11-provider-readiness.md) | 公开ID/价目、留存/训练/区域条件、队列PoC建议及未完成账户资格 |
| [综合研究](research/2026-10-07-strategic-review.md) | 产品、技术和商业全景 |
| [市场与商业](research/2026-10-07-market-and-business.md) | 英语市场、竞品和商品 |
| [产品与体验](research/2026-10-07-product-and-ux.md) | 家庭任务、流程和使用障碍 |
| [AI与架构](research/2026-10-07-ai-and-architecture.md) | 代码基础和能力缺口 |
| [社交需求与市场修正](research/2026-10-08-social-and-market-strategy.md) | 原声、开始困难和陪同场景；不等于市场规模或付费验证 |
| [AI蓝图与模型分层](research/2026-10-08-ai-blueprint-and-model-tiers.md) | 前沿候选、质量基准和分层成本 |
| [OpenAI官方资料核查](research/2026-10-08-ai-openai-and-platform-sources.md) | 当时的API能力、价格与数据政策 |
| [选型证据](research/2026-10-08-ai-sota-selection-evidence.md) · [语音证据](research/2026-10-08-ai-sota-speech-evidence.md) | 候选依据及限制 |
| [本地部署](research/2026-10-08-ai-local-deployment.md) | 设备、运行时、许可和实测路线 |
| [费用计算器](research/ai_cost_calculator.py) · [场景结果](research/2026-10-08-ai-cost-scenarios.json) | 给定工作量下的可复算预算，不是实际每户全部成本 |

## 历史规划与交付文件

以下保留查阅，**不作为现行排期、已批准商品或生产完成证明**。旧“8周生死线”、固定国家配额、自动停项/退款和紧急模型降档等建议不由本次决策继承；以当前台账及质量证据为准。

- [旧综合计划](STRATEGIC-IMPLEMENTATION-PLAN.md)
- [旧团队摘要](DECISION-SUMMARY-FOR-TEAM.md) · [旧速查卡](QUICK-REFERENCE-CARD.md)
- [旧8周清单](8-WEEK-EXECUTION-CHECKLIST.md) · [旧完成报告](COMPLETION-REPORT.md) · [旧交付摘要](DELIVERY-SUMMARY.txt)
- [旧快速部署清单](QUICK-DEPLOY-CHECKLIST.md)
- [早期执行摘要](EXEC-SUMMARY.md) · [历史下一步](NEXT-STEPS.md) · [历史完成记录](NEXT-STEPS-completion-report.md)
- [交付审计](delivery-audit-and-remediation-checklist.md) · [修复进度](remediation-progress.md)

文档更新须分清“决定了什么”“代码实现了什么”“实际验证了什么”。质量门附commit、测试/真机/恢复证据；既有报告勾号不能代替当前结果。

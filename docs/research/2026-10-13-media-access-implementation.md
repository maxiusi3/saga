# 十月升级：媒体入口与P0契约实施记录

2026-10-13（Asia/Taipei）。延续用户“继续执行升级计划”，D01–D16全部A保持有效。分支`codex/october-upgrade-p0`，HEAD仍为`1caa21a72`；开工时10月11日T00的12份源文件/测试SHA256全部匹配原验证清单，保留既有未提交内容。

## 本批范围与开工依据

| 核对位置 | 开工时行为 | 本批处理 |
|---|---|---|
| `api/media/signed-url` | 任何含`/projects/`的path均可通过admin签名；上传者前缀优先放行 | 严格地址解析、真实项目/故事归属与active权限、错误关闭；签名仅使用已验证的完整bucket/key |
| `api/ai/transcribe` | admin固定读取saga，storagePath不查归属；请求发送文件统一名audio.webm；4MiB上限文案写25MB | 与上传默认audio-recordings对齐，旧saga显式传bucket；共享授权先于下载/推理，保留名称/MIME，元数据预检及有界流读取，实际超限取消 |
| `api/media/upload-image` | 无请求认证，admin.auth.getUser失败回退anonymous；folder可指定；JPEG/PNG原件被再编码 | 认证先于解析/处理；项目/故事目标查权限，不再anonymous；原件字节保留，仅处理缩略图 |
| `lib/server/project-access` | 已按facilitator_id或active project_roles校验 | 复用，不由前端owner字段或路径子串授权 |

本批只修复现有服务端入口；不靠未知远端schema实施迁移。执行要求见[媒体入口计划](../superpowers/plans/2026-10-13-upgrade-media-access.md)。

## 已完成的规格工作

- [P0质量门与测量定义](../superpowers/specs/2026-10-13-upgrade-p0-gates.md)：设备/故障矩阵、跨家庭及直接Storage反例、错误/负例分母、保留集、观察窗与经济口径。设备和家庭均未标成已测。
- [P1契约v0.1](../superpowers/specs/2026-10-13-upgrade-p1-contracts.md)：新增媒体资产/任务/同意/删除结构、录音会话、完整确认及四批迁移/回填/回退。新增表/API是拟实施契约，不是已部署schema。
- 实际读取根bootstrap、agent/Storage迁移、类型定义和当前调用，发现基础表存在新旧兼容字段、历史agent产物仍有固定0.8规则值、原始`stories/filename`上传路径、直接Storage所有者前缀策略。将这些纳入迁移清单，未假称清理完成。

## 兼容性与保留条件

新ASR路径默认audio-recordings；原saga对象需要显式storageBucket，缺件不跨桶尝试。URL、百分号编码、穿越或含歧义目录的key拒绝；历史不规范地址须先做显式映射，不能以兼容名义恢复越权。

原样bucket/key仍只是兼容定位，不是MediaAsset已落库。直接Supabase Storage调用及RLS、旧anonymous对象、故事删除错误路径、资产身份/校验、完整离线导出、已签发短链在TTL内的可访问性、持久Worker、真机恢复均不属于本批已完成项。部分上传后续步骤失败留下的孤儿对象仍需资产会话和清理任务。客户端未命名Blob仍沿用recording.webm，真实录音容器和扩展名统一由T04完成；具名File已经保留名称。

复审发现SDK默认download会先将整件读入Blob，现已改用info预检与asStream逐块限流，超过100MiB取消读取。此为单请求累计音频字节边界；后续组装ArrayBuffer/Blob仍有副本开销，不作为进程内存上限或并发容量的证明。

生产域名/部署ID、远端迁移、对象规模、模型账户与地域/留存设置仍未取得新证据；本轮不再次联网更新10月11日供应商报告。没有真实家庭素材、付费推理、生产迁移或部署。

## 验证结果

本批本地实现已验收，保持未提交、未部署。全部日志、复审报告与源文件SHA256见[证据目录](evidence/2026-10-13-media-access/README.md)和[验证清单](evidence/2026-10-13-media-access/verification-manifest.json)。

| 核验 | 实际结果 |
|---|---|
| 实施前媒体回归 | 43失败/3通过，复现越权、错误桶与文件名、anonymous上传和原件重编码 |
| 客户端字段回归 | 3失败/12通过，修复后默认/显式bucket和具名File正确传递 |
| Cookie分块回归 | 1失败/46通过，修复后保留全部刷新cookie |
| 独立审查补例 | 6失败/46通过，复现下载先缓冲、未知扩展命中原型、C1控制符被接受 |
| 最终定向回归 | 退出0，3套/75项通过 |
| 最终npm run verify | 退出0，58套/488项Web测试；类型检查、lint、shared/web构建通过 |
| 独立复审 | 原3项发现全部修复；增量规格/质量复审通过，无新增阻塞 |

本批未修改shared/infra相关逻辑与配置，沿用10月11日的shared 4套/16项、infra 7项结果，并未称其为本日重跑。最终verify已重新覆盖全部Web回归和共享包类型/lint/build。构建仍报告缺少SUPABASE_SERVICE_ROLE_KEY、旧Next配置和多lockfile提示；本地构建通过不代表服务端配置或生产已验收。构建生成的next-env.d.ts路径改动已恢复。

## 下一批的入口

继续[P0准备计划](../superpowers/plans/2026-10-11-upgrade-p0-preparation.md)：完成导入/新录音两入口可交互原型，同时补远端schema、对象清单、供应商账户与备份证据。随后按T02→T05→T03→T04落实资产、Worker、动作权限/删除与录音恢复。G0–G4仍未宣告通过；本批API回归不能替代G1直接Storage及真机验收。

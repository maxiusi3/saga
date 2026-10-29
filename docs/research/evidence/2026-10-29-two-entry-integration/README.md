# 双入口接线本轮证据

当前结果以 [verification.json](verification.json) 为准。原始 RED、旧通过结果和失败的浏览器几何回归均保留；不要以文件名中的 green/final 单独判断当前源码已验证。

| 证据 | 范围 |
| --- | --- |
| `raw/*.txt.gz` / `log-normalization.json` | 原始输出无损压缩保存；可读 txt 仅规范换行、行尾空白和末尾空行，清单提供原始/可读哈希 |
| `full-verify.txt` / `full-verify-result.json` | 最终完整命令链、起止时间与退出码；Web 130/1657、shared 4/16、infra 7、184 页构建 |
| `pre-review-full-verify*` / `pre-quality-full-verify*` | 后续审查修复前的通过运行，不能替代最终链 |
| `*-red.txt` / `*-green.txt` | 实现、规格与质量发现的定向 RED/GREEN；包括 schema 来源、派生文字删除与可选大小重放 |
| `spec-review.md` / `quality-review.md` | 独立两轴审查及修复复审；质量审查者独立运行 4 套/114 项 |
| `pg17-reruns.json` / `*verify-*.json` | 原样 PG17 切流 3/23、P3 4/51；本轮新结果及独立目录/PID清理核对 |
| `browser-*.json` / `hub-*.png` | 合成边界 Chromium 1440/375px：真实组件/适配器、文件字节、定位、失败状态及几何检查 |
| `protected-inputs.json` | 开始验证前冻结的 1236 个历史实验/证据/迁移/依赖哈希，最终全部匹配 |

最终浏览器报告：`browser-2026-10-29T04-17-35.202Z-3beda361-0f5f-4df6-a95f-3084171570fd.json`，12 项通过。此前 `03-44-21` 报告为预期 RED：375px 搜索按钮越过表单边界；修改后的截图与几何断言均通过。

已知证据边界：冻结 PG runner 错误覆盖 cleanup 字段，首个收集 wrapper 因 KeyError 退出；报告原样保留，修正收集逻辑后重跑并独立核对资源消失。`server-search-schema-typecheck.txt` 记录并行导出编辑的临时缺少 `project_id` 类型错误，已补齐类型且最终整链通过。浏览器不是 Next/Supabase 真正端到端，PG 是合成家庭夹具；均不等于 G1/G3/G4 真实资格。

日志无真实家庭素材或付费供应商调用。本批不修改冻结实验、不迁移远端、不部署；原质量门未通过，条件推送未触发。

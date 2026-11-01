# 实施清单：供应商账户/区域/数据条件核验链（2026-11-01）

## 目标与边界
- 落实综合计划 §7.1 G0 与 §11 供应商数据与模型接入条件核验链。
- 建立确定性、fail-closed 的供应商合规条款核验模块（`packages/web/src/lib/server/provider-policy-verification.ts`）。
- 校验三项核心模型能力（ElevenLabs ASR、Anthropic 故事提取/编辑、Voyage 语义检索）的书面证据、训练退出（training opt-out）、零数据留存（ZDR）或 ≤7 天留存 SLA、允许处理区域及证据有效期（≤90 天，且无未来时间伪造）。
- 确保 API Key 的存在**绝不**推定条款合规；条款未核验时始终保持 `blocked_by_policy`。
- 纯虚构短样本探针指纹（`SYNTHETIC_PROBE_ONLY: ...`），严防家庭正文泄露。
- 接入 `/api/admin/cutover-readiness`，支持从环境配置解析已验证证据，默认 fail-closed 保持 `blocked_by_policy` 与切流端点 `503 not_ready`。
- 不执行真实远端 API 调用（不产生付费请求），不向外部发送真实家庭数据，不推送远端。

## 任务拆解

### Task 1: 制定纯函数合规契约与 TDD RED 测试
- 编写测试文件 `packages/web/src/lib/server/__tests__/provider-policy-verification.test.ts`。
- 覆盖：
  1. 默认无配置时：所有能力 fail-closed 为 `blocked_by_policy`。
  2. 训练退出未确认（`trainingOptOutConfirmed !== true`）时拒止。
  3. 零留存或留存 SLA 违背（`zeroDataRetentionConfirmed !== true` 且 `maxRetentionDaysAllowed > 7`）时拒止。
  4. 目标区域不在允许区域列表（如仅限 `us`/`eu`）时拒止。
  5. 证据日期过期（>90 天）或未来伪造时间时拒止。
  6. 恶意/畸形/超长字段与控制字符清洗。
  7. API Key 配置与合规解耦：未合规时即使有 Key 仍是 `blocked_by_policy`；仅当合规但缺 Key 时为 `missing_api_key`；合规且有 Key 时为 `ready_for_live_probe`。
- 运行测试并捕获 RED 日志至 `docs/research/evidence/2026-11-01-provider-policy-verification/task1-red.log`。

### Task 2: 纯函数实现与管理端切流路由集成
- 实现 `packages/web/src/lib/server/provider-policy-verification.ts`：
  - `ProviderPolicyEvidence` 接口与验证器 `verifyProviderPolicyEvidence`。
  - `loadVerifiedProviderProbeTargets`：从 `PROVIDER_POLICY_EVIDENCE_JSON` 解析并结合 `ELEVENLABS_API_KEY`、`ANTHROPIC_API_KEY`、`VOYAGE_API_KEY` 生成探针目标。
  - `buildVerifiedSyntheticProviderProbes`：生成探针结果。
- 在 `/api/admin/cutover-readiness/route.ts` 中接入 `loadVerifiedProviderProbeTargets`。
- 更新路由测试 `packages/web/src/app/api/admin/cutover-readiness/__tests__/route.test.ts`。
- 运行定向测试捕获 GREEN 日志至 `task2-green.log`。
- 运行相邻测试、type-check 和 lint 并捕获至 `task2-adjacent-typecheck-lint.log`。

### Task 3: 独立审查（规格复核与代码质量）
- 启动独立规格复核子代理，确认 7 大边界与 fail-closed 契约。
- 启动独立代码质量复核子代理，重点审查 SSRF/正则 Dos/边界溢出/安全清洗。
- 针对审查意见先 RED 后修复。

### Task 4: 完整验证与证据封存
- 运行 `npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra`。
- 检查 1471 项历史输入保护并恢复 `packages/web/next-env.d.ts` 原字节。
- 压缩原始日志并生成哈希、`verification.json`、`milestone-check.json`、研究报告及证据索引。
- 更新 handoff 文档与 README，本地提交检查点（禁止推送）。

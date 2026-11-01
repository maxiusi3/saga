# 供应商账户/区域/数据条件核验链（本地切片报告）

日期：2026-11-01。基线：`07016d8fc`。分支：`codex/october-upgrade-p0`。  
范围：为综合升级计划 §7.1 G0 与 §11 供应商数据与模型接入条件建立确定性、Fail-Closed 的合规条款核验模块（`packages/web/src/lib/server/provider-policy-verification.ts`），并接入管理端切流路由。属于本地工程切片，不代表真实外部商业条款已取得。

## 1. 实现概述

1. **确定性纯函数合规核验（`verifyProviderPolicyEvidence`）**：
   - 严格白名单校验三项核心模型能力（ElevenLabs ASR、Anthropic 故事提取/整编、Voyage 语义检索）的书面合规条款证据。
   - **训练退出（`trainingOptOutConfirmed`）**：严格要求 boolean `true`，否则报 `training_opt_out_unverified`。
   - **零数据留存与 SLA（`zeroDataRetentionConfirmed` & `maxRetentionDaysAllowed`）**：严格校验布尔类型；若未确认零留存（ZDR），必须显式满足有效非负整数 `maxRetentionDaysAllowed <= 7`，彻底杜绝静默绕过。
   - **区域约束（`allowedRegions`）**：严格检查白名单数组，且必须包含目标能力的默认区域（如 `us`）。
   - **时效与防伪造（`evidenceDate`）**：严格匹配 ISO 8601 UTC 格式与日历日期有效性（防止平年 2 月 30 日跨月进位）；时钟偏斜 > 5 分钟报 `future_evidence_date`；时效 > 90 天报 `evidence_expired`。
   - **输入安全与防 DoS**：过滤 ASCII 控制字符，在执行 `.trim()` 前对各字符串设置上限防御，并对输入证据列表施加 `MAX_RAW_EVIDENCE_ITEMS = 100` 截断保护。
2. **多模型覆盖与联合键索引（`loadVerifiedProviderProbeTargets`）**：
   - 从环境变量 `PROVIDER_POLICY_EVIDENCE_JSON` 解析证据，并使用 `${provider}::${modelId}` 联合键建立索引。
   - 彻底解决同供应商多模型（如 Anthropic `claude-opus-4-20250514` 与 `claude-opus-5-5`）数组先后顺序导致的键覆盖 Bug，保证解析结果完全确定。
3. **API Key 严格解耦**：
   - API Key 的配置**绝对不能**自动推定条款合规；缺少有效条款证据时，即便配置了 API Key，状态必须保持 `blocked_by_policy`。
   - 仅当条款已核验合规且缺少 Key 时，状态为 `missing_api_key`；合规且有 Key 时，状态为 `ready_for_live_probe`。
4. **零家庭隐私泄露**：
   - 探针只使用固定的纯虚构短样本指纹（`SYNTHETIC_PROBE_ONLY: ...`），杜绝任何家庭正文、用户标识或录音素材进入探针契约。
5. **管理切流端点接入（`/api/admin/cutover-readiness`）**：
   - 动态调用 `loadVerifiedProviderProbeTargets()` 评估探针状态；在无有效证据时全量保持 `blocked_by_policy`。
   - 整体路由始终保持 HTTP 503 与 `status: 'not_ready'`（因 `upload_collection_coverage` 仍为 partial 且供应商未全量核准）。

## 2. 审查与修正记录

- **独立规格合规审查**：初审发现 1 项严重 Fail-Open 漏洞（非 ZDR 且无 SLA 时默认值为 0 绕过 7 天校验），判定为 **FAIL**。
  - 按 TDD 模式新增失败测试（`review-red.log`），严格要求布尔与 `<= 7` 整数限制。
  - 复审确认漏洞已彻底修复，所有 7 项硬性准则全部满足，最终结论为 **PASS**。
- **独立代码质量审查**：初审提出两项阻断性缺陷（SLA 绕过漏洞、Map 键碰撞顺序依赖）与四项防御性改进（ISO 8601 日历防滚动、DoS 长度防御、消除二次重复调用等），判定为 **Request Changes**。
  - 完成联合键重构、严格正则校验及 DoS 防御，并在复审中补齐 5 项针对性测试。
  - 最终复审结论为 **Approved**。

## 3. 验证汇总

详见 [verification.json](evidence/2026-11-01-provider-policy-verification/verification.json)：
- 定向测试：`provider-policy-verification.test.ts` 与 `route.test.ts` 共 45 项全部通过（GREEN）。
- 相关套件：6 套相关 Jest 测试共 203 项全部通过，`type-check` 0 错误，`lint` 0 警告。
- 基建测试：`npm run test:infra` 7 项全部通过。
- 全量命令链：`npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra` 退出码 0（Web 138 套/2168 项、Shared 4 套/16 项、Infra 7 项、Next.js 184 页构建通过）。
- 保护输入：1471 项历史输入 0 不匹配。
- `packages/web/next-env.d.ts`：构建后无损恢复为原始哈希 `7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651`。

## 4. 未验收边界与下一步

- 真实外部 ElevenLabs、Anthropic、Voyage 的商业账户条款、书面训练退出确认与真实零留存协议（人工阻塞清单 #4）仍未取得，本地测试放行但线上无证据时保持 `blocked_by_policy`。
- 本批只完成本地工程切片，不声称原 G0–G4 里程碑完成，`pushConditionSatisfied: false`。严禁向 GitHub 推送、合并 main、远端迁移或对外发送真实请求。

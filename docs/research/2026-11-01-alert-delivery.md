# 运营告警投递与响应人核验（本地切片报告）

日期：2026-11-01。基线：`e2be895dd`。分支：`codex/october-upgrade-p0`。  
范围：为综合升级计划 §11 的系统运营告警（`OperationalAlertItem`）建立失败关闭的投递适配器、抑制去重账本与响应人核验链，属于本地工程切片，不代表真实外部告警已验收。

## 1. 实现概述

1. **脱敏告警负载构建（`buildOperationalAlertPayload`）**：
   - 告警负载严格限制为：`schemaVersion`, `code`, `severity`, `responderRole`, `summary`, `fingerprint`, `timestamp` 7 个精确白名单字段。
   - `fingerprint` 为 SHA-256 确定性哈希，杜绝任何家庭正文、用户标识、音频出处或未脱敏数据进入常规告警负载。
2. **告警去重与抑制账本（`AlertSuppressionLedger`）**：
   - 内存有界（默认最大 1000 项、10 分钟窗口），防止告警风暴。
   - 采用 LRU 顺序更新（重新记录现有指纹时删除旧位移至尾部），并在达到容量时先清理过期条目再淘汰最旧条目。
3. **并发 TOCTOU 防御（`inFlightDispatches`）**：
   - 同步登记正在派发的请求 Promise，在高并发故障发生时（如数据库停滞或上传尖刺），后续并发调用直接返回抑制，避免外发雪崩。
4. **SSRF 与 URL 安全防护（`parseValidWebhookUrl`）**：
   - 严格要求 `https:` 协议，拒绝明文 `http:`。
   - 拒绝内嵌凭据（`username` / `password`）。
   - 拒绝包含空白或 ASCII 控制字符的畸形 URL。
   - 严格封禁私有与保留网络：IPv4（环回 `127.0.0.0/8`、私网 `10.0.0.0/8`、`172.16.0.0/12`、`192.168.0.0/16`、云元数据 `169.254.0.0/16`、CGNAT `100.64.0.0/10`）、IPv6（环回 `::1`、链路本地 `fe80::/10`、唯一局部 `fc00::/7`、以及所有 IPv4-mapped IPv6 `::ffff:...`）和内部保留主机名（`localhost`、`*.internal`、`*.local`、`*.lan`）。
5. **有界超时与资源防泄漏**：
   - 严格 5 秒调度超时，支持调用者 `callerSignal` 提前取消。
   - 网络响应 `res.body` 在读取或出错后统一显式取消/排空，防止连接池套接字泄漏。
6. **响应人核验与管理端接入（`evaluateAlertDeliveryStatus`）**：
   - 当 `OPERATIONAL_ALERT_WEBHOOK_URL` 缺失或 `OPERATIONAL_ALERT_RESPONDER_CONFIRMED !== 'true'` 时，严格返回 `{ status: 'unavailable', reason: 'responder_and_delivery_not_verified' }`。
   - 管理端 `/api/admin/cutover-readiness` 动态接入此评估；由于 `upload_collection_coverage` 与供应商条款仍未满足，路由始终保持 HTTP 503 与 `status: 'not_ready'`。

## 2. 审查与修正记录

- **独立规格审查**：PASS，无 P0–P2 缺陷，验证了 7 项硬约束。
- **独立质量审查**：初审提出 7 项改进要求（包括并发 TOCTOU、SSRF/IPv6 覆盖、LRU 淘汰与测试单例清理等）。经 TDD 编写失败测试（`review-red.log`）并完成改进后，复审结论为 **Approved**（`alert-delivery.ts` 测试行覆盖率 97.05%）。

## 3. 验证汇总

详见 [verification.json](evidence/2026-11-01-alert-delivery/verification.json)：
- 定向测试：`alert-delivery.test.ts` 与 `route.test.ts` 共 50 项全部通过。
- 相关套件：9 套相关 Jest 测试共 373 项全部通过，`type-check` 与 `lint` 退出码 0。
- 基建测试：`npm run test:infra` 7 项全部通过。
- 全量命令链：`npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra` 退出码 0（Web 137 套/2139 项、Shared 4 套/16 项、Infra 7 项、Next.js 184 页构建通过）。
- 保护输入：1471 项历史输入 0 不匹配。
- `packages/web/next-env.d.ts`：构建后无损恢复为原始哈希 `7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651`。

## 4. 未验收边界与下一步

- 真实生产告警通道与人类值班响应人的确认（人工阻塞清单 #3）仍未完成，当前仅具备本地适配器与接口防御；真实生产环境下仍报告 `unavailable`。
- 供应商账户/区域/数据条款（人工阻塞清单 #4）仍处于 `blocked_by_policy`。
- 本批只完成本地工程切片，不声称原 G0–G4 里程碑完成，`pushConditionSatisfied: false`。严禁向 GitHub 推送、合并 main、远端迁移或对外真实发信。

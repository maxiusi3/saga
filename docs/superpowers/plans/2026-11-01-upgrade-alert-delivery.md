# 实际告警投递与响应人核验实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 §11 运营告警（`OperationalAlertItem`）建立可独立验收的告警投递适配器、有界调度、脱敏负载构建、告警去重抑制及响应人核验机制（`alert-delivery.ts`），并在管理端 `/api/admin/cutover-readiness` 接入，同时在真实响应人与生产通道未确认前严格保持 `status: 'unavailable', reason: 'responder_and_delivery_not_verified'` 和管理端 `503 not_ready`。

**Architecture:**
1. **脱敏告警负载与指纹构建**：
   - 告警负载严格限制为：`alertCode`, `severity`, `summary`, `responderRole`, `fingerprint`, `timestamp`。
   - 严格禁止任何家庭正文、用户标识或隐私素材进入常规日志或外部投递负载。
   - 提供事件指纹生成（基于告警 code 与核心维度），支持在有界时间窗口内的告警抑制（Alert suppression / throttling），避免告警风暴。
2. **有界调度与传输适配器**：
   - `AlertDeliveryDispatcher` 接口定义，包含 `dispatch(alert, options)` 与 `verifyChannel(options)`。
   - Webhook / HTTP 投递适配器支持：
     - 严格 5 秒超时（AbortSignal 支持），防网络挂起。
     - 错误脱敏（不透传敏感 headers 或完整错误栈）。
     - 单次失败关闭，禁止对未知写入进行无休止重试。
3. **响应人角色与通道核验状态**：
   - 支持读取 `OPERATIONAL_ALERT_WEBHOOK_URL` 与 `OPERATIONAL_ALERT_RESPONDER_CONFIRMED`。
   - 若未配置通道或未获响应人确认（阻塞事项 #3 尚未人工完成），`evaluateAlertDeliveryStatus` 评估返回 `{ status: 'unavailable', reason: 'responder_and_delivery_not_verified' }`。
   - 管理端 `/api/admin/cutover-readiness` 接入该评估，不再使用写死字面量，并保持顶层 `status: 'not_ready'` 和 HTTP 503。

**Tech Stack:** Next.js App Router (TypeScript), Jest.

---

## Tasks

- [ ] **Task 1: 编写告警投递与响应人核验单元测试 (RED)**
  - 创建 `packages/web/src/lib/server/__tests__/alert-delivery.test.ts`
  - 更新 `packages/web/src/app/api/admin/cutover-readiness/__tests__/route.test.ts`
  - 运行 Jest 观察预期失败并记录 RED 日志

- [ ] **Task 2: 实现告警投递与响应人核验模块 (GREEN)**
  - 创建 `packages/web/src/lib/server/alert-delivery.ts`
  - 在 `packages/web/src/app/api/admin/cutover-readiness/route.ts` 接入 `evaluateAlertDeliveryStatus`
  - 运行定向 Jest、type-check、lint 验证 GREEN

- [ ] **Task 3: 独立审查与全量命令链验证**
  - 启动独立规格审查与质量审查子代理，关闭所有发现
  - 保存 `packages/web/next-env.d.ts` 字节，执行 `npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra`
  - 恢复 `packages/web/next-env.d.ts` 并核对 1471 项历史保护输入
  - 封存证据到 `docs/research/evidence/2026-11-01-alert-delivery/`，更新 handoff 与 README
  - 创建本地检查点提交（不推送）

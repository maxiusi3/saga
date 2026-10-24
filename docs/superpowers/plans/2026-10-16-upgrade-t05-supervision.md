# T05 自动监督与持续任务实施计划

> **For agentic workers:** Use superpowers:executing-plans task-by-task; request independent review when the agent runtime is available.

**Goal:** 在既有本地 PostgreSQL/pg-boss 实验中验证自动心跳、队列监督、Worker 重启与持续任务，修复业务租约和队列存活判断分离的问题。

**Architecture:** 继续复用应用状态机。业务行与确切 queue ID/retryCount 的心跳同事务提交；业务 lease 从数据库当前时间计算并受队列硬截止时间约束。独立 supervisor 开启 pg-boss 自动监督，拥有一个持续消费 Worker，并以有上限的退避重启异常退出的进程。合成任务的异步等待仅用于验证持续运行，不能解释为实际音频解码或外部请求。

**Tech Stack:** Node 22.22.2 / PostgreSQL 14.17 / pg-boss 12.37.1 / pg 8.16.3；依赖版本保持不变。

**Spec:** [P1 契约第4节](../specs/2026-10-13-upgrade-p1-contracts.md)、[handoff下一步](../../HANDOFF-2026-10-13-upgrade.md)、[综合计划T05](../../2026-10-10-integrated-upgrade-plan.md)。

## Global Constraints

- 继续现有 `codex/october-upgrade-p0` 工作树；保留所有先前修改，不提交或推送未达原计划里程碑的批次。
- 仅使用 harness 拥有的 `/tmp/saga-t05-*/socket` PostgreSQL；不读写远端、不读家庭资料、不调用供应商、不部署或迁移。
- 默认短任务仍用5秒硬上限；持续任务显式设定10秒队列心跳窗口及有限硬上限。业务lease为5秒，自动心跳间隔1秒；取消、过期和失去queue claim必须拒绝续约与发布。
- `outcome_unknown` 保持隔离，不因 supervisor 重启或重复投递自动再次调用。
- 生产托管、真实长音频、Storage/故事adapter、RLS与G0/G1仍需独立证据。
- 构建后恢复本批开始时的 `next-env.d.ts`。

## Task 1：事务心跳与自动运行

**Files:** 修改 `experiments/t05-durable-worker/store.mjs`、`worker.mjs`、`verify.mjs`；新增 `runner.mjs`、`supervisor.mjs`、`supervision-scenarios.mjs`。

**Interfaces:** `heartbeatJob` 接收 `queueId/retryCount` 并核对业务attempt绑定；`openPoc(config, { supervise })` 默认不启用监督；`enqueueJob` 接收显式 `expireInSeconds/heartbeatSeconds`。supervisor 只运行本实验 runner，IPC用于观测/故障注入，不依赖父进程手工continue或supervise。

- [x] 写真实 PostgreSQL 回归，证明当前心跳不能保持队列claim；保留失败输出与清理状态。
- [x] 为业务attempt保存确切queue claim；锁业务行再锁队列行，使用锁后数据库时间检查双方过期/硬截止；以公开 `boss.touch` 和同一事务更新业务lease，拒绝错误queue/retry/owner/attempt。
- [x] runner 自动消费与单序列心跳；心跳异常停止任务，停止前等待在途心跳；发布前沿用既有guard。不得使用目标job过滤器吞掉其他任务。
- [x] supervisor自动队列监督；串行重启、最多3次连续异常、100/200/400ms退避；SIGTERM/IPC断开时停止拥有的Worker并关闭连接，失败保留非零退出。
- [x] 验证持续任务跨多个lease、leased/provider处SIGKILL、撤权、硬截止、queue重投后的旧心跳、重复消息、重启上限与停止清理。持续5分钟场景使用真实墙钟，不快进时间。

```bash
node experiments/t05-durable-worker/verify.mjs /tmp/saga-supervision-red.json --only-supervision-heartbeat
node experiments/t05-durable-worker/verify.mjs docs/research/evidence/2026-10-16-t05-supervision/results.json
node experiments/t05-durable-worker/verify.mjs docs/research/evidence/2026-10-16-t05-supervision/soak.json --only-supervision-soak
```

## Task 2：验证与交接

- [x] 运行项目 `npm run verify`、shared/infra测试、实际 `npm run audit:high`；保留退出码和日志。
- [x] 独立审查本批；若平台仍不能执行，明确记录未完成，不把主会话自查称为独立通过。
- [x] 更新实验README、实施记录、综合计划、handoff及源码指纹，区分历史19/167证据和本批结果。
- [x] 核对原计划G0/G1缺项；只有真实达成里程碑才推送，维持不部署约束。

本批从既有下一步细化，不增加新产品范围；不补做已完成的依赖升级、短音频解码或纯函数合同。

## 最终结果

39场景/307项断言、真实300018ms合成任务（297次心跳、最大间隔1017ms）及信号/异常清理验证通过；独立初审R1/R2及增量R1b全部关闭。根应用依赖与业务代码未改，verify75/702、shared4/16、infra7及175页构建通过；audit仍42项，G0/G1未达成，因此未提交或推送。详见[本批记录](../../research/2026-10-16-t05-supervision.md)、[最终复审](../../research/evidence/2026-10-16-t05-supervision/review-final.md)和[里程碑核对](../../research/evidence/2026-10-16-t05-supervision/milestone-check.json)。

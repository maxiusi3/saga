# 媒体入口前置批验证证据

日期：2026-10-13（Asia/Taipei）。本批是现有签名回放、ASR、图片上传的服务端定位/授权与原件修复；范围见[执行计划](../../../superpowers/plans/2026-10-13-upgrade-media-access.md)，结果见[实施记录](../../2026-10-13-media-access-implementation.md)。基准commit仍为1caa21a72，工作分支codex/october-upgrade-p0；未提交、未部署。

## 命令与实际结果

| 日志 | 结果 | 说明 |
|---|---|---|
| [red.log](red.log) | 43失败/3通过 | 初始媒体回归；真实复现越权、错误定位、匿名上传和原件重编码 |
| [client-red.log](client-red.log) | 3失败/12通过 | 客户端默认/显式bucket、具名File未正确传递 |
| [cookie-red.log](cookie-red.log) | 1失败/46通过 | 刷新cookie被覆盖；改为逐块append |
| [focused.log](focused.log) | 退出0，3套/70项 | 独立审查前的定向回归 |
| [type-check.log](type-check.log) | 退出0 | 实施中类型检查，最终verify再次执行 |
| [verify.log](verify.log) | 退出0，58套/483项 | 独立审查前完整验证；仍含审查后发现的3处问题 |
| [review-red.log](review-red.log) | 6失败/46通过 | 复现缓冲发生在上限检查前、原型属性成为MIME、C1控制符放行 |
| [focused-final.log](focused-final.log) | 退出0，3套/75项 | 全部审查修复后的定向回归 |
| [verify-final.log](verify-final.log) | 退出0，58套/488项 | 最终类型检查、lint、Web测试与shared/web构建 |

最终定向命令：

```bash
npm test --workspace=packages/web -- --runInBand --runTestsByPath \
  src/app/api/media/__tests__/access.test.ts \
  src/lib/__tests__/ai-service.test.ts \
  src/app/api/ai/transcribe/__tests__/route.test.ts
```

最终完整命令：`npm run verify`。Node v22.22.2，npm 10.9.7。shared/infra相关源代码与配置未变，复用[10月11日证据](../2026-10-11-t00/README.md)的shared 4套/16项和infra 7项，本日没有重复运行这两项。

## 独立审查

[初审](review-initial.md)针对[初始补丁](reviewed-initial.patch)提出三项：SDK默认Blob下载无前置上限、MIME普通对象索引命中原型属性、路径缺C1控制符拒绝。[增量补丁](review-fixes.patch)修正三项后，[复审](review-followup.md)通过，无新增阻塞。审阅者未重跑套件；控制者确认最终verify终端退出0，并读取完整日志。复审文档保留检查当时的执行状态。

测试使用真实媒体解析、项目权限与限流逻辑，替换外部数据库/Storage/Sharp/供应商；新增下载回归使用真实ReadableStream并断言越限取消与无推理调用。它们证明应用入口的行为，不证明远端Storage策略或供应商实际可用性。

## 指纹与边界

[verification-manifest.json](verification-manifest.json)绑定本批9份源码/测试、保留的T00源码、文档、日志及审查/补丁指纹。[implementation.patch](implementation.patch)相对于本批开工快照（已经包含T00），不混入之前的应用变更；它不同于整个工作树相对HEAD的diff。旧T00清单保持原样，以免篡改其历史状态。

存储音频先授权、读取元数据，实际流超过100MiB即取消且不送推理；组装ArrayBuffer/Blob仍有副本开销，不是进程内存或并发容量验收。直接Storage RLS、历史地址/anonymous映射、完整资产ID、删除/孤儿清理、已签链接TTL、持久Worker、真实设备/家庭/供应商与生产验证仍待完成。G0–G4均未通过。

构建成功但仍打印缺少SUPABASE_SERVICE_ROLE_KEY、旧Next配置及多lockfile根目录提示；不能据此认定运行配置就绪。构建生成的next-env.d.ts路径差异已恢复，未作为本批代码交付。

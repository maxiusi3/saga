# T00首批验证证据

日期：2026-10-11（Asia/Taipei）。范围见[T00计划](../../../superpowers/plans/2026-10-11-upgrade-t00-truthful-ai.md)，实施和剩余条件见[基线](../../2026-10-11-upgrade-baseline.md)。基准commit为`1caa21a72`；变更未提交。源文件与日志摘要指纹见[verification-manifest.json](verification-manifest.json)。

## 命令结果

| 日志 | 结果 | 说明 |
|---|---|---|
| [recording-red.log](recording-red.log) | 3项失败、5项通过 | 改动前复现：整理失败不可见、旧转写/AI污染下一录音、旧请求失败改变当前状态 |
| [recording-cleanup-failure.log](recording-cleanup-failure.log) | 3项失败、5项通过 | 第一轮实现后在卸载时失败：浏览器API替身先于组件清理被恢复；不是通过证据，已修正清理顺序 |
| [review-followups-red.log](review-followups-red.log) | 2项失败、16项通过 | 复审补例：null追问被接受、无转写仍显示“尚未可用”；随后修复 |
| [focused-tests.log](focused-tests.log) | 退出0，5套/41项 | 最终定向回归，包含复审修正 |
| [verify.log](verify.log) | 退出0，Web 57套/433项 | `npm run verify`：类型检查、lint、Web测试、shared/web构建 |
| [shared.log](shared.log) | 退出0，4套/16项 | `npm test --workspace=packages/shared -- --runInBand` |
| [infra.log](infra.log) | 退出0，7项 | `npm run test:infra` |

早期AI回归曾观察到22项失败/9项通过，修复后31项通过；该批临时日志在续接时未保留，因此只作为过程记录，不作为持久红测附件。当前最终日志已覆盖这些AI回归。

定向命令在仓库根执行：

```bash
npm test --workspace=packages/web -- --runInBand --runTestsByPath \
  src/components/recording/__tests__/record-page-uses-smart-recorder.test.tsx \
  src/lib/__tests__/ai-service.test.ts \
  src/app/api/ai/generate-content/__tests__/route.test.ts \
  src/app/api/ai/transcribe/__tests__/route.test.ts \
  src/app/api/ai/health/__tests__/route.test.ts
```

## 独立代码复审

独立审阅者按T00计划检查工作树diff、新增响应校验文件和相关调用者。结论：无Critical或Important问题，范围内可交付；最终结论需完整verify通过，现已完成。

两处Minor及处理：

1. `followUpQuestions ?? []`对省略/null的规则不明确。现明确追问可省略，不凭空补问；若提供则必须为字符串数组，null返回502。提示、契约与回归均已对齐。
2. 无转写时“not available yet”易让人误以为后台仍会处理。改为明确“无转写，因此无法准备草稿，仍可保存录音”，并确认此时没有新增生成调用。

## 证据边界

录音页回归使用真实ReviewStage/AudioPlayer组件，但替换了录音设备、媒体API、上传和数据库边界。这里验证界面状态、请求隔离与保存参数，不证明真实音频可恢复或云端持久保存。未运行供应商实测、真机中断、跨家庭对象访问、备份恢复或部署；G0–G4仍未验收。

构建已有的服务端Supabase配置缺失、旧Next配置与多lockfile提示保留在日志中。最后两处代码修正后已重跑定向测试和verify；shared/infra没有相关代码或配置变化。构建生成的`next-env.d.ts`路径改动已恢复，未混入本批变更。

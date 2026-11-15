# G1 修复与恢复证据

完成：2026-11-08（Asia/Taipei）；目录日期为批次开始日。当前[报告](../../2026-11-07-g1-fixes-and-recovery.md)与[汇总回执](verification.json)以最终复跑为准。

| 验证 | 最终回执 |
| --- | --- |
| Chrome 中断／丢响应／重复保存／清理矩阵 | [passed](../2026-11-07-g1-chrome/interrupted-browser-1794066185867-ac613c97-6cd1-485a-8cd7-7f831171d8cb/results.json) |
| Chrome AI 9 组与保存分离 | [passed](ai-1794066594425-a6982664-d810-45ac-be23-4a0decc4a326/results.json) |
| 5/20/30 分钟及中断件完整性 | [passed](../2026-11-07-g1-chrome/audio-1794066593597-a7048455-bb94-4fc9-9796-7091b3d41b8b/results.json) |
| 原 PCM 不变与包截断反例 | [passed](envelope-1794066595672-83b3e6e2-5bb2-474d-8c5f-31cac325d242/results.json) |
| 完整迁移及真实备份恢复 | [passed](../2026-11-07-g1-chrome/migrations-1794066887638-762c32a5-09e5-475c-8886-854591e60253/results.json) |

完整门禁：Web162/3382、shared4/16、infra24、184页；原始输出见 [gate 日志](raw/saga-g1-fixes-gate-2.log.gz)。949 个源码／配置／文档输入封存于 [source.tar.gz](source.tar.gz)，逐文件哈希见 [manifest](source-manifest.json)。

备份演练使用真实 PG17.4、完整 bootstrap＋29 个根迁移、两个实际 Chrome 录音及一个无关 legacy 对象。实际备份 5 个对象，墓碑重放后恢复 3 个幸存对象。恢复库的生产播放接口对被删对象返回409；即使原资产仍为 ready，墓碑单独也会阻断。幸存原件通过 Chrome 播放。

`raw/` 保存本批原失败和最终通过日志；`.before` 文件保留文档更新前的内容。之前 Chrome 的所有运行回执／日志及 4,866 个更早证据文件已重算，未发现变更。next-env 构建生成字节和恢复检查单独保留。

本地 auth/Storage/PostgREST 适配器、可控 AI HTTP 结果、合成字幕与合成音频都有明确边界。备份恢复为停止写入后的维护演练；在线引用安全删除、晚到写入和物理结果持久化仍未实现。G1 整门 false，手机延期不阻塞当前 Web 验收。未暂存、提交、推送、远端迁移或部署。

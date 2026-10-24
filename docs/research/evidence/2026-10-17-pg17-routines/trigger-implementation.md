# 固定触发函数采集入口实现

Task 1 的入口与测试已完成，可供独立审查。新增入口只接受固定快照中的 `public.update_updated_at_column()`，不接受 CLI 配置；本次没有连接远端或读取私有远端定义。

## 文件与约束

- [新增入口](../../../../scripts/inspect-supabase-trigger.cjs) 使用固定快照 SHA256 `8b2a4647b017305183e67b2b932be02080a789dba4fc48b23b2f23a97991e66e`，选中唯一的 public、零参数、`kind=f`、`return_type=trigger` 定义，要求 MD5 `3bfa5e64985d89e65932564c89520d5b`。
- 复用 `inspect-supabase-routines.cjs` 的 `TARGET_SQL`、`collect`（内部使用原 `validateRows` / `readOnlySnapshot`）和 `savePrivateCapture`，以及共享配置与 `runCapture`。旧查询、旧实验和依赖均未修改。
- 连接继续固定 metadata_reader、TLS 证书/主机验证、REPEATABLE READ READ ONLY、后端 10s/2s/15s 限时和 90 秒异步截止；异常路径回滚并关闭或强制清理连接。
- 定义仅写入已有忽略目录 `supabase/.temp/routine-audit/`，目录 0700、文件 0600、独占创建；公共报告只有安全身份、摘要、状态和验证元数据。文件名增加 `capture-trigger-` 前缀，避免与旧批次混淆。
- [新增测试](../../../../scripts/__tests__/inspect-supabase-trigger.test.cjs) 使用明确标识的虚构正文、凭据及 CA。VM 只替换 pg 外部边界、文件根路径、凭据/CA 读取与计时器；目标选择、共享查询/验证、生命周期、权限及落盘实现均实际执行。

## 验证结果

Node.js `v22.22.2`。原有真实 catalog 测试使用其固定的 PostgreSQL `16.11 (Homebrew)`、独立 Unix socket、禁 TCP；本报告不将该结果作为 PG17 行为证据。

| 证据 | 退出码 | 通过 / 总数 | 失败 | 跳过 |
| --- | --- | --- | --- | --- |
| [RED](trigger-red.tap) | 1 | 0 / 17 | 17 | 0 |
| [新增 GREEN](trigger-green.tap) | 0 | 17 / 17 | 0 | 0 |
| [旧 52 + 新 17 回归](trigger-regression-green.tap) | 0 | 69 / 69 | 0 | 0 |

RED 在新增入口尚不存在时执行，17 项均因明确断言“fixed trigger capture entry must exist”失败；随后添加最小入口并取得 GREEN。历史 RED 未覆盖。

新测试覆盖固定身份与摘要、快照字节漂移、CLI/凭据配置拒绝、仅传递一个精确身份、匹配/缺失/属性漂移/定义漂移、错误身份/重复/虚假摘要/畸形结果、安全公共输出、TLS 拒绝、不安全后台会话、权限拒绝、私有文件模式与摘要、连接/读取/回滚/关闭卡住、关闭失败后的私有证据保留。

完整回归命令：

```sh
SAGA_ROUTINE_LOCAL_PG=1 node --test --test-reporter=tap \
  scripts/__tests__/inspect-supabase-metadata.test.cjs \
  scripts/__tests__/inspect-supabase-routines.test.cjs \
  scripts/__tests__/inspect-supabase-routines-local.test.cjs \
  scripts/__tests__/inspect-supabase-routines-local-cleanup.test.cjs \
  scripts/__tests__/inspect-supabase-trigger.test.cjs
```

`node --check scripts/inspect-supabase-trigger.cjs` 退出 0；新增源码尾随空白检查通过。七个旧实现/测试文件与实现开始前记录的 SHA256 完全相同，逐项记录于 [机器可读核验](trigger-implementation-verification.json)。

## SHA256

| 文件 | SHA256 |
| --- | --- |
| `scripts/inspect-supabase-trigger.cjs` | `28550950685ec509a2e20c7e8992caac28be5c690b69ecb65c69332b31eeb7e5` |
| `scripts/__tests__/inspect-supabase-trigger.test.cjs` | `71b3fd0909cc94bedb1da93143d00e7c880c6d4b42e3d8728205ce6295f0f1c2` |
| `trigger-red.tap` | `9671a5dcae749277a66e19ed441ef3731ac0b7a52ddf71fcd22658dc1d90d1d2` |
| `trigger-green.tap` | `3d5a6942a55db8a79c80d82a30a8245ae5a49de4640791d5ec181a817758214b` |
| `trigger-regression-green.tap` | `96e7231f54a883e89c843478d6dc6300ce789dcec3a429b9ab2a4078f6ad1a5c` |
| `trigger-implementation-verification.json` | `7288fce0ea0f2f1063e35f7da18f10eadd6acd4919ebfd7268abe67e9e7beb2c` |

自查确认：入口在读取凭据前验证参数和快照；目标定义仅由原固定 catalog 查询读取；原验证器控制私有/公共字段；所有网络生命周期由已有共享 runtime 执行；成功采集后的关闭错误仍保留私有证据且返回错误。未发现需要修改旧文件的问题。

## 限制与后续

本子任务不执行真实只读采集，不确认远端函数仍与快照一致，也不评估其实际正文或依赖。17 项测试中的成功匹配来自虚构目标；固定真实摘要与虚构正文不同的 CLI 路径预期为 drift。完整远端成功路径须由主控制器在独立审查后只执行一次采集，并审核新增私有定义，才能将触发函数纳入 PG17 精确重放。

没有提交、推送、迁移、部署、业务行读取、远端 RPC 调用、依赖编辑或 handoff 编辑；PG17.4 源码构建和实验属于主流程的独立任务。

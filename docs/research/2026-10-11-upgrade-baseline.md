# 10月升级：P0代码与环境基线

2026-10-11（Asia/Taipei）。已确认D01–D16全部A；本轮开始实际实施。基线commit `1caa21a72`；工作分支`codex/october-upgrade-p0`，保留现有未提交文档。Node v22.22.2、npm 10.9.7。

## 核验范围

已读四份指定文档、P0准备计划，并逐段核查AIService、ASR/文本生成/健康路由、主录音页、ReviewStage、媒体上传/签名/删除、项目授权、录音IndexedDB、根迁移和部署工作流。研究引用的补读与外部核验由独立报告记录；未读取到的网页不计为已核实。

| 基线检查 | 结果 | 边界 |
|---|---|---|
| 同日此前`npm run verify` | 退出0；56套/402项Web测试、类型、lint、构建通过 | 修改后重跑；不是生产验收 |
| `npm run test:infra` | 7/7通过，退出0 | 配置检查，不等于远端迁移已应用 |
| `npm test --workspace=packages/shared -- --runInBand` | 4套/16项通过，退出0 | 共享类型/逻辑测试 |
| `packages/web/.env.local`仅检查已知变量是否非空 | Supabase URL/anon、OpenRouter存在；service role、TEXT三项、SiliconFlow、Stripe secret缺失 | 未输出值；存在不代表有效；进程/远端配置另核 |
| 生产域名、部署commit、迁移历史、对象规模、备份 | 未核实 | 本地源码不能证明远端状态；不阻塞纯逻辑修复 |

## 当前实际数据流

| 入口 | 当前实现 | 后续处理 |
|---|---|---|
| 主录音上传 | `lib/storage.ts`写`audio-recordings`，key为`user/projects/project/stories/temp/file` | T02统一资产身份、真实bucket/key |
| ASR | 接受音频或storagePath；固定从`saga`用admin读取 | T02/T03统一定位与对象级授权；暂不宣布可处理正式资料 |
| 签名回放 | `api/media/signed-url`允许包含`/projects/`的路径，未验证该项目成员关系 | 新增P1优先隔离反例，发布阻塞项 |
| 删除 | `lib/stories.ts`只取basename再拼`stories/name`，未检查Storage删除错误 | T03资产驱动删除、重试及墓碑 |
| 录音草稿 | IndexedDB仅失败块；缺持久会话目录和完整校验闭环 | T04本地先落盘、会话恢复及合并校验 |
| 业务持久化 | `stories`、`agent_runs`、`agent_artifacts`、`story_elements`已有结构 | 复用并演进；Worker租约/任务语义仍需T05 |
| 迁移 | 根`supabase/migrations/`由CI应用；历史`packages/web/supabase/`为原SQL | 修正文档“不使用迁移框架”的描述；未重复执行SQL |

## T00首批修复依据

1. `AIService`健康请求失败会返回随机转写/模板故事，并标为完成；正常端点返回缺字段也会补出泛化内容与高置信度。
2. 健康路由固定宣称转写可用、只看OpenRouter，忽略TEXT配置与实际服务端ASR凭据；HTTP 200不等于能力可用。
3. ASR缺置信度默认0.9，文本生成将低分强抬到0.7；这些是合成数值，不是测量结果。
4. ReviewStage默认展示未执行的Auto-Leveling；主录音页失败只写控制台，用户无法区分整理中/失败。
5. 返回录音选择后没有清除上次转写/AI内容，异步结果也没有录音代际校验。

首批实现详见[T00计划](../superpowers/plans/2026-10-11-upgrade-t00-truthful-ai.md)。本轮不以修复这些问题宣称媒体授权、恢复、持久Worker或G0/G1已完成。

## T00首批实施与最终核验

2026-10-11本地实施，分支`codex/october-upgrade-p0`、基准commit `1caa21a72`，变更保留在工作树，未提交或部署。

| 已实施行为 | 实际边界 |
|---|---|
| AIService直接请求对应能力，失败报错；移除随机转写、模板故事和mock模式 | 实际供应商仍为现有配置，本轮未替换模型或调用真实账户 |
| ASR/生成共享响应校验；标题/摘要必需，追问可省略但不补写 | 结构校验不证明模型所述事实正确；来源、评测和家人批准仍属后续工作 |
| 缺失/非法confidence保持未知，0和低分保留 | provider自报数值不是准确率；本轮没有测得准确率 |
| 健康接口按TEXT/OpenRouter与SiliconFlow分别报告配置 | 配置存在不代表远端可达、额度可用或符合数据条件 |
| 审阅页显示处理中/失败/无转写，保留保存动作，移除Auto-Leveling假标记 | 保存操作仍经过现有上传/故事写入；原声恢复、对象权限及保存事务未在本批完成 |
| 新录音清空旧音频/转写/AI状态，拒绝旧异步resolve/reject，释放预览URL | 尚未建立跨浏览器重开、离线会话目录或Worker级取消 |

| 最终命令 | 结果与持久日志 |
|---|---|
| 五个受影响测试文件的定向Jest回归 | 退出0，5套/41项；[focused-tests.log](evidence/2026-10-11-t00/focused-tests.log) |
| `npm run verify` | 退出0，类型检查、lint、Web 57套/433项及构建通过；[verify.log](evidence/2026-10-11-t00/verify.log) |
| `npm test --workspace=packages/shared -- --runInBand` | 退出0，4套/16项；[shared.log](evidence/2026-10-11-t00/shared.log) |
| `npm run test:infra` | 退出0，7项；[infra.log](evidence/2026-10-11-t00/infra.log) |

独立代码复审无Critical/Important问题，两处Minor均已修正并验证；先失败后修复及复审详情见[证据索引](evidence/2026-10-11-t00/README.md)。最后两处修改后重新运行定向测试与完整verify；shared/infra相关源码与配置未变，复用本轮已通过结果。构建产生的`next-env.d.ts`路由类型路径变化已还原，不纳入功能变更。

构建仍提示`SUPABASE_SERVICE_ROLE_KEY`缺失、Next.js旧配置项和多lockfile根目录推断。本轮没有生产迁移、付费调用、真实素材处理、部署、备份恢复或真机测试；不宣布G0–G4通过。历史模拟档案尚未审计或清除；不能由新增路径拒绝mock推断历史资料均真实。

下一步继续P0的质量门/数据契约和两入口原型，取得相关远端及账户证据后进入T02资产统一。T02/T03必须关闭签名回放与ASR对象授权缺口；T05/T04分别落实持久任务与录音恢复。

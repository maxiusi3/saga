# UR Saga 战略决策与实施计划

**制定日期**: 2026-10-08  
**决策者角色**: 项目负责人（基于全面研究，无需等待用户行为数据）  
**目标**: 在 8 周内完成从 "技术原型" 到 "可信赖的家庭服务" 的转变

---

## 执行摘要

基于对代码库、PRD、竞品、社交讨论和 AI 技术的全面研究，我做出以下**关键决策**：

1. ✅ **继续英语市场，美国优先试点** —— 保留产品基础，避免推倒重来
2. ✅ **先做 "值得信任的档案系统"，再做 "AI 主持人"** —— 原声保存 > 智能对话
3. ✅ **高质量 AI 基准先行，不为省 $2 牺牲 8 小时调试** —— Scribe v2 + Opus 5.5 + Astra
4. ✅ **两个并行入口**：保存已有声音 + 家人陪同讲新故事 —— 而非单一 "四周传记"
5. ✅ **8 周后必须有真实数据** —— 否则战略重新评估

**不做的事情（明确拒绝的方向）**：
- ❌ 不等 3 个月收集用户反馈再决策（时间窗口不允许）
- ❌ 不先开发公共档案、Wiki Editor Agent、Media Agent（Phase 2 暂缓）
- ❌ 不追求 "NPR 级音频处理" 作为 MVP 核心（PRD 已下调，代码未实现）
- ❌ 不同时支持 8 种语言（先验证英语单一市场）
- ❌ 不把 "AI 更强" 当核心卖点（用户要的是 "事情做完了"）

---

## 第一部分：战略决策与理由

### 决策 1：市场定位 —— 英语家庭，美国优先试点

**决策内容**：
- 目标市场：英语家庭（美国 70%，英国/加拿大/澳洲 30%）
- 首轮付费试点：美国（单一货币、可比较的获客成本、明确的竞品标杆）
- 目标用户：35-55 岁成年子女购买，60+ 岁父母/祖父母讲述

**理由**：
1. **现有基础匹配**：产品已有英文界面、英文 PRD、英文技术栈
2. **竞品即标杆**：Remento $99、Storyworth $69-$199 提供了清晰的价格锚点
3. **社交证据支持**：X/Reddit/Instagram 的英语讨论显示真实需求和痛点
4. **不是排他性选择**：保留其他英语地区数字入口，根据真实渠道调整优先级

**证据强度评估**：
- ✅ 用户已选定英语方向（高确定性）
- ⚠️ 美国 vs 其他英语国家（中等确定性，基于运营便利性，非需求验证）
- ❌ 未证明英语市场需求 > 中文市场（无同口径对比数据）

**如果错了的信号**：
- 6 周内美国获客成本 > $80 且转化率 < 3%
- 英国/澳洲出现明显更低成本的真实付费渠道
- 出现愿意支付 > $150 的非英语市场合作方

---

### 决策 2：产品核心 —— 先做档案系统，再做 AI 主持

**决策内容**：
将产品定位为 **"家庭的私密声音档案 + AI 辅助整理"**，而非 "AI 采访机器人"。

**优先级排序**：
1. **P0（生存线）**：原声不丢、可导出、能回放 —— 2 周内完成
2. **P1（核心价值）**：按人物/事件索引、原话可追溯、家人可确认 —— 4 周内完成
3. **P2（体验提升）**：AI 生成下一个问题、智能追问 —— 6 周内测试
4. **P3（未来可选）**：实时语音主持、多模态理解 —— 8 周后根据数据决定

**理由**：
1. **信任是护城河**：Remento 承诺 "公司倒闭后你仍有原始录音和书"，这是竞争力
2. **现有代码更接近档案系统**：`agent_runs`、`source_refs`、权限系统已有基础
3. **风险不对称**：
   - 档案失败 = 数据丢失，不可逆，信任永久破产
   - AI 主持失败 = 体验不佳，可以人工补救，可以迭代改进
4. **社交证据**：X 上保存母亲语音留言的案例 —— 用户要的是 "不丢" 而非 "AI 很聪明"

**实施标准**：
- 每个录音自动备份到 3 个位置（原始存储 + 版本备份 + 可恢复归档）
- 导出包必须包含：原始音频 + 转写文本 + 时间戳 + 元数据，离线可打开
- 每句 AI 生成内容必须标注来源片段，点击可直接跳转到原声播放
- 家庭审阅界面：原话 vs 改写并排显示，差异高亮

---

### 决策 3：AI 技术栈 —— 高质量基准优先，受控降本

**决策内容**：
采用 **Scribe v2 (ASR) + Opus 5.5 (编辑) + Astra (复核) + Voyage 4 (检索)** 作为初始质量基准。

**三档策略**：
| 档位 | 使用时机 | 成本/项目 | 质量预期 |
|------|---------|-----------|----------|
| **高档**（现在） | 所有首轮试点家庭 | ~$2.62 | 建立质量标杆，发现真实问题 |
| **中档**（6周后） | 高档盲测无明显质量差异后切换 | ~$1.50 | Sonnet 替代 Opus，自我复核 |
| **低档**（成熟期） | 简单任务 + 家庭接受人工校订 | ~$0.83 | Luna 辅助 + Sonnet 编辑 |

**理由**：
1. **时间成本 > API 成本**：
   - 高档比中档每项目多花 $1.13
   - 如果能减少 2.3 分钟人工返工（按 $30/小时算），已经回本
   - 8 周内不可能测试完所有模型组合，先用最强的找到真实瓶颈
2. **质量问题的代价不可逆**：
   - 错误地把 "母亲" 识别为 "姨妈" —— 破坏信任
   - 遗漏关键人名或日期 —— 需要家属重听 2 小时录音
   - 幻觉创造不存在的事件 —— 比没有 AI 更糟糕
3. **独立评测支持**：
   - Scribe v2 WER 2.2%（低于 Nova-3 的 5.2%）
   - Opus 5.5 在 Artificial Analysis 通用文字榜领先组
   - 不是榜首，但能力齐全（时间戳、分离、结构化输出）

**实施细节**：
```typescript
// packages/web/src/lib/ai/model-router.ts
export const MODEL_TIERS = {
  HIGH: {
    asr: 'scribe_v2',           // ElevenLabs
    editor: 'claude-opus-5-5',   // Anthropic
    reviewer: 'gpt-6-astra',     // OpenAI
    embedding: 'voyage-4-large', // Voyage AI
    rerank: 'rerank-3'
  },
  MEDIUM: {
    asr: 'scribe_v2',
    editor: 'claude-sonnet-5-5',
    reviewer: 'claude-opus-5-5', // 自我复核
    embedding: 'voyage-4-large',
    rerank: 'rerank-3'
  },
  LOW: {
    asr: 'scribe_v2',
    editor: 'claude-sonnet-5-5',
    reviewer: 'gpt-6-luna',      // 仅基础检查
    embedding: 'voyage-4-large',
    rerank: 'rerank-3'           // 检索不降档
  }
}
```

**不做的事**：
- ❌ 不在首轮同时测试 10 个 ASR 模型
- ❌ 不因为 DeepSeek 便宜就先用它（未验证英语老年语音表现）
- ❌ 不把模型选择暴露给用户（"选择 AI 等级" 不是家庭能理解的决策）

**如果错了的信号**：
- 实际 API 成本 > $5/项目（预算的 2 倍）
- Opus 推理时间 > 5 分钟导致体验问题
- 发现开源模型在真实家庭录音上质量无差异

---

### 决策 4：产品入口 —— 两条并行路径

**决策内容**：
提供两个独立但可互补的产品入口，而非单一 "四周传记项目"。

#### 入口 A：保存已有声音（Save Existing Memories）
**用户带来什么**：一段旧语音留言、家庭视频片段、录音文件  
**产品做什么**：
1. 上传原件（支持常见格式：MP3/M4A/WAV/MOV/MP4）
2. 提示用户补充背景："这是谁？什么时候？为什么重要？"
3. 自动转写 + 按说话人分离（如果多人）
4. 生成可回听卡片：原声 + 背景 + 简短摘要
5. 导出包：原件 + 元数据 + 可离线打开的 HTML 播放器

**定价假设**：
- 免费试用：1 段录音，最长 5 分钟
- $19 单次：最多 30 分钟录音，10 张照片
- $59 家庭包：无限上传 1 年，包含后续整理成册

**验证目标**：
- 相比直接存云盘，是否真的更容易 "找到" 和 "再次播放"？
- 补充背景的转化率 > 60%？
- 6 个月后回访打开率 > 30%？

#### 入口 B：一起讲新故事（Record New Stories Together）
**用户带来什么**：一位愿意讲述的亲人 + 一个问题或老照片  
**产品做什么**：
1. 家人操作界面，看到下一个问题建议
2. 点击录音（支持暂停、跳过、重录）
3. AI 在后台：识别提到的人名地点、生成追问建议
4. 2-3 次短访谈后（每次 10-20 分钟）
5. 交付：原声音频 + 校对后文字 + 首份小作品（1-2 页故事）

**定价假设**：
- $39 首个故事：3 次访谈，最多 60 分钟，数字交付
- $99 故事集：10 次访谈，最多 300 分钟，数字 + PDF
- $199 实体套装：同上 + 精装书 + 二维码原声（需核实印刷成本）

**验证目标**：
- 家人陪同 vs 长辈独立的完成率差异？
- AI 问题建议的采纳率 > 40%？
- 实际人工支持时间 < 30 分钟/家庭？

**两者关系**：
- A 是轻量入口，建立信任，引导到 B
- B 是核心收入，但需要更高承诺
- 用户可以只用 A，不强制升级到 B
- A 的素材可以成为 B 的起点（"围绕这段录音，多讲讲背后的故事"）

**理由**：
1. **社交证据**：X 上保存语音留言的案例 —— 有些家庭只需要保存，不需要新访谈
2. **降低启动门槛**：上传 1 段录音 << 承诺做完 4 周项目
3. **分离需求验证**：分别测试 "档案能力" 和 "采访能力" 的付费意愿
4. **竞品差异化**：Storyworth/Remento 都从 "写新故事" 开始，我们可以从 "先保存已有的" 切入

---

### 决策 5：实施时间表 —— 8 周生死线

**决策内容**：
8 周内必须完成从原型到真实付费用户的转变，否则战略重新评估。

**Week 1-2：工程生存线（P0 Issues）**
目标：确保数据不会丢失，系统可以信任

- [ ] 执行 3 个数据库迁移脚本（Supabase SQL Editor）
- [ ] 移除所有模拟降级逻辑（禁止返回示例内容）
- [ ] 实现完整导出功能：原始音频 + 转写 + 元数据 + 离线播放器
- [ ] 修复录音恢复流程：断网、页面刷新、iOS 中断场景真机测试
- [ ] 添加音频完整性校验：上传后自动验证文件可播放
- [ ] 补充服务器端 ASR 兜底：浏览器识别失败时自动触发 Scribe v2

**验证标准**：
- ✅ 5 个测试录音（每个 15-30 分钟），100% 可导出且离线可播放
- ✅ 断网恢复：拔掉 WiFi 30 秒后恢复，录音继续无数据丢失
- ✅ 所有 AI 生成内容可追溯到原始音频时间戳

**Week 3-4：双入口 MVP**
目标：两条产品路径可以完整走通

**入口 A（保存已有）实施**：
- [ ] 上传界面：拖拽文件 + 格式验证（MP3/M4A/WAV/MOV/MP4）
- [ ] 背景表单：谁、什么时候、为什么重要（可选但引导填写）
- [ ] Scribe v2 转写 + 说话人分离
- [ ] 记忆卡片生成：原声播放器 + 背景 + 摘要
- [ ] 导出：原件 + JSON 元数据 + HTML 播放器

**入口 B（陪同讲述）实施**：
- [ ] 家人界面：显示当前问题、录音按钮、暂停/跳过/重录
- [ ] AI 问题建议：基于已讲内容，用 Opus 5.5 生成 3 个候选问题
- [ ] 后台处理：Scribe 转写 → Opus 提取人物/事件 → 生成草稿
- [ ] 家人审阅：原话 vs 编辑并排，播放原声片段，确认/修改
- [ ] 交付页面：首份小作品（1-2 页）+ 原声下载链接

**Week 5-6：真实家庭试点**
目标：8-12 个付费家庭，收集第一手数据

**招募方式**：
1. **个人网络** (目标 4 个家庭)
   - 团队成员自己家庭
   - 朋友/同事的父母
   - 明确这是付费试点，但提供 50% 早鸟折扣
2. **小型内容合作** (目标 4 个家庭)
   - 联系 1-2 个家庭/养老话题的小型创作者（< 5K 粉丝）
   - 提供免费服务，换取真实案例和反馈
   - 不要求发帖推广，专注收集使用数据
3. **Reddit/Facebook 小规模邀请** (目标 4 个家庭)
   - 在相关讨论串真诚回复（非硬广）
   - "我们正在测试一个新服务，寻找愿意给反馈的家庭"
   - 提供试用链接，收取 $19-39 象征性费用

**数据收集清单**：
```markdown
每个家庭记录：
- 【招募】来源渠道、首次接触到付款的天数
- 【启动】谁操作界面、长辈是独立还是陪同、用什么设备
- 【过程】录音次数、每次时长、中断次数、需要人工协助的环节
- 【质量】ASR 错误数、需要修改的人名地点、AI 遗漏的重要信息
- 【完成】是否拿到最终成果、是否下载、是否会推荐给朋友
- 【成本】API 费用、人工支持分钟数、Stripe 手续费
```

**Week 7-8：数据分析与战略决策**
目标：验证核心假设，决定是继续、调整还是转向

**核心指标评估**：
1. **完成率**：已开始家庭中，拿到可带走成果的比例
   - 目标：入口 A > 80%，入口 B > 60%
   - 如果 < 50%，找出阻塞环节，重新设计流程
2. **质量满意度**：家人认为内容忠实且可用
   - 目标：无严重事实错误，ASR 姓名准确率 > 90%
   - 如果有家庭因质量问题退款，立即暂停新招募
3. **单位经济**：每个完成家庭的净贡献
   - 目标：入口 A 贡献 > $10，入口 B 贡献 > $30（扣除 API + 人工 + 手续费，不含获客）
   - 如果贡献为负，要么提价、要么降低人工介入
4. **推荐意愿**：NPS 或 "会推荐给朋友" 的比例
   - 目标：> 60% 明确愿意推荐
   - 如果 < 30%，产品未达到可传播的质量

**8 周后的三种决策路径**：

| 场景 | 指标表现 | 决策 |
|------|---------|------|
| **场景 A：验证成功** | 完成率 > 60%，单位经济为正，NPS > 50% | 继续：扩大招募，优化转化漏斗，准备小规模付费广告测试 |
| **场景 B：部分验证** | 完成率低但质量满意度高，或反之 | 调整：专注解决明确瓶颈（入口设计 / AI 质量 / 人工支持），再测 4 周 |
| **场景 C：核心假设失败** | 完成率 < 30%，大量退款，无人愿推荐 | 转向：可能的方向包括 B2B（机构服务）、纯工具（不做采访）、或停止项目 |

**不允许的逃避**：
- ❌ "样本太小，再测 100 个家庭" —— 8 个深度案例足以发现致命问题
- ❌ "是用户不懂，我们产品很好" —— 如果 60% 的人用不成，是产品的问题
- ❌ "换个 AI 模型就好了" —— 先确认问题是模型质量，不是产品设计

---

## 第二部分：详细实施计划

### 模块 1：数据库与权限（Week 1）

**负责人**：后端工程师  
**目标**：确保数据不丢失，权限不泄露

#### 任务 1.1：执行待定数据库迁移
```bash
# 在 Supabase SQL Editor 中依次执行
1. packages/web/supabase/migrations/20261007000001_create_waitlist.sql
2. packages/web/supabase/migrations/20261007000002_improve_storage_rls.sql
3. packages/web/supabase/agent-phase1.sql (验证是否已执行)
```

**验证**：
```sql
-- 检查关键表是否存在
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'waitlist_signups',
  'agent_runs', 
  'agent_artifacts', 
  'interview_sessions', 
  'interview_events', 
  'story_elements'
);
-- 应返回 6 行
```

#### 任务 1.2：移除模拟降级逻辑
**文件**：`packages/web/src/lib/ai-service.ts`

```typescript
// 删除第 42-50, 112-120, 235-246 行的模拟返回逻辑
// 替换为明确的错误状态和重试机制

export async function transcribeAudio(params: TranscribeParams): Promise<TranscribeResult> {
  try {
    const result = await callRealASR(params);
    return result;
  } catch (error) {
    // 不返回模拟内容，记录错误并返回明确的失败状态
    await logProcessingError({
      type: 'asr_failure',
      assetId: params.assetId,
      error: error.message,
      retryable: isRetryableError(error)
    });
    
    return {
      status: 'failed',
      error: 'transcription_failed',
      message: '转写失败，原始音频已保存，可稍后重试',
      retryable: true
    };
  }
}
```

**验证**：
- 全局搜索 `mockTranscription`、`demoStory`、`fallbackContent`
- 确认生产代码路径不存在这些分支
- 添加集成测试：API 失败时返回明确错误，不返回示例内容

#### 任务 1.3：修复音频存储访问授权漏洞
**文件**：`packages/web/src/app/api/ai/transcribe/route.ts`

**当前问题**（第 66-71 行）：
```typescript
// 接收 storagePath 后直接用 admin 下载，未验证归属
const { data: audioData } = await supabaseAdmin
  .storage
  .from('saga')
  .download(storagePath);
```

**修复方案**：
```typescript
export async function POST(request: Request) {
  // 1. 先验证身份
  const auth = await getAuthenticatedUser(request);
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { storagePath, projectId } = await request.json();
  
  // 2. 验证该音频属于该用户有权限的项目
  const { data: asset, error } = await supabaseAdmin
    .from('media_assets')
    .select('id, project_id, uploaded_by')
    .eq('storage_path', storagePath)
    .single();
  
  if (error || !asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }
  
  // 3. 检查项目访问权限
  const accessCheck = await requireProjectAccess(asset.project_id, auth.user);
  if (!accessCheck.ok) {
    return accessCheck.response; // 返回 403
  }
  
  // 4. 现在可以安全下载
  const { data: audioData } = await supabaseAdmin
    .storage
    .from('saga')
    .download(storagePath);
  
  // ... 继续处理
}
```

**验证**：
- 用户 A 不能触发用户 B 的音频转写
- 测试用例：尝试传入不属于自己的 `storagePath`，应返回 403

#### 任务 1.4：音频完整性校验
**新文件**：`packages/web/src/lib/server/media-validator.ts`

```typescript
import ffprobe from 'ffprobe-static';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function validateAudioFile(filePath: string): Promise<ValidationResult> {
  try {
    // 使用 ffprobe 检查文件元数据
    const { stdout } = await execAsync(
      `${ffprobe.path} -v quiet -print_format json -show_format -show_streams "${filePath}"`
    );
    
    const metadata = JSON.parse(stdout);
    
    // 检查是否有音频流
    const audioStream = metadata.streams.find((s: any) => s.codec_type === 'audio');
    if (!audioStream) {
      return { valid: false, error: 'no_audio_stream' };
    }
    
    // 检查时长（至少 1 秒，最多 4 小时）
    const duration = parseFloat(metadata.format.duration);
    if (duration < 1 || duration > 14400) {
      return { valid: false, error: 'invalid_duration', duration };
    }
    
    return {
      valid: true,
      duration,
      codec: audioStream.codec_name,
      sampleRate: audioStream.sample_rate,
      channels: audioStream.channels
    };
  } catch (error) {
    return { valid: false, error: 'validation_failed', message: error.message };
  }
}
```

**集成到上传流程**：
```typescript
// packages/web/src/app/api/media/upload/route.ts
export async function POST(request: Request) {
  // ... 文件上传到临时位置
  
  // 上传后立即验证
  const validation = await validateAudioFile(tempFilePath);
  if (!validation.valid) {
    await fs.unlink(tempFilePath); // 删除无效文件
    return NextResponse.json({ 
      error: 'invalid_audio_file', 
      details: validation.error 
    }, { status: 400 });
  }
  
  // 验证通过，保存到永久存储
  // ... 上传到 Supabase Storage
  
  // 记录元数据
  await supabaseAdmin.from('media_assets').insert({
    project_id: projectId,
    storage_path: storagePath,
    duration: validation.duration,
    codec: validation.codec,
    validated_at: new Date().toISOString()
  });
}
```

---

### 模块 2：录音恢复与导出（Week 1-2）

**负责人**：前端 + 后端工程师  
**目标**：断网、崩溃、刷新都不丢数据

#### 任务 2.1：录音恢复流程真机测试
**文件**：`packages/web/src/components/recording/SmartRecorder.tsx`

**测试场景清单**：
```markdown
| 场景 | 设备 | 操作 | 预期结果 | 实际结果 | 通过? |
|------|------|------|----------|----------|-------|
| 断网恢复 | iPhone 13, iOS 17 | 录音中拔掉 WiFi 30s 后恢复 | 自动同步缺失片段，无数据丢失 | | [ ] |
| 页面刷新 | Chrome 130, macOS | 录音中按 Cmd+R | IndexedDB 保留数据，恢复录音状态 | | [ ] |
| 浏览器崩溃 | Safari, iPad | 强制关闭 Safari 后重开 | 提示恢复录音，点击继续 | | [ ] |
| 锁屏中断 | Android, Pixel 8 | 录音中锁屏 5 分钟 | Screen Wake Lock 保持，或优雅暂停并提示 | | [ ] |
| 存储额度满 | 任意 | IndexedDB 达到限制 | 提前警告，引导清理或升级浏览器设置 | | [ ] |
| 长录音 | 任意 | 连续录音 90 分钟 | 60s 分块正常上传，内存不溢出 | | [ ] |
```

**修复发现的问题（示例）**：
```typescript
// SmartRecorder.tsx 增强恢复逻辑
useEffect(() => {
  // 组件挂载时检查是否有未完成的录音
  async function checkPendingRecording() {
    const pending = await db.recordings
      .where('status')
      .equals('in_progress')
      .or('status')
      .equals('paused')
      .first();
    
    if (pending) {
      setShowRecoveryPrompt(true);
      setPendingRecording(pending);
    }
  }
  
  checkPendingRecording();
}, []);

// 恢复录音时重新关联到同一个 session
async function resumeRecording() {
  const session = pendingRecording;
  
  // 检查哪些分片已上传成功
  const uploadedChunks = await fetch(`/api/recordings/${session.id}/chunks`).then(r => r.json());
  
  // 从 IndexedDB 找出未上传的分片
  const localChunks = await db.chunks
    .where('recordingId')
    .equals(session.id)
    .and(chunk => !uploadedChunks.includes(chunk.sequence))
    .toArray();
  
  // 后台同步未上传分片
  for (const chunk of localChunks) {
    await uploadChunk(chunk);
  }
  
  // 恢复录音界面
  setRecordingId(session.id);
  setElapsedTime(session.elapsed);
  setStatus('recording');
}
```

#### 任务 2.2：实现完整导出功能
**目标**：用户得到一个 ZIP 文件，里面包含所有数据，离线可打开

**导出包结构**：
```
family-memories-2026-10-08.zip
├── index.html                    # 离线播放器（单文件，无外部依赖）
├── audio/
│   ├── 001-grandpa-childhood.m4a
│   ├── 002-mom-wedding-day.m4a
│   └── ...
├── transcripts/
│   ├── 001-grandpa-childhood.json  # 包含逐词时间戳
│   ├── 002-mom-wedding-day.json
│   └── ...
├── stories/
│   ├── grandpa-early-years.md
│   ├── mom-meeting-dad.md
│   └── ...
├── photos/
│   └── ...
├── manifest.json                 # 总索引
└── README.txt                    # 说明文档
```

**manifest.json 示例**：
```json
{
  "export_version": "1.0",
  "exported_at": "2026-10-08T15:30:00Z",
  "project": {
    "id": "proj_abc123",
    "name": "Smith Family Memories",
    "storytellers": ["John Smith", "Mary Smith"]
  },
  "recordings": [
    {
      "id": "rec_001",
      "title": "Grandpa's Childhood",
      "recorded_at": "2026-09-15T10:00:00Z",
      "storyteller": "John Smith",
      "duration": 1847,
      "audio_file": "audio/001-grandpa-childhood.m4a",
      "transcript_file": "transcripts/001-grandpa-childhood.json",
      "stories": ["stories/grandpa-early-years.md"]
    }
  ],
  "people": [
    {
      "name": "John Smith",
      "role": "Grandfather",
      "mentioned_in": ["rec_001", "rec_003"]
    }
  ]
}
```

**离线播放器（index.html）**：
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Family Memories - Offline Archive</title>
  <style>
    :root {
      --bg-primary: #0A0D12;
      --bg-secondary: #0F131C;
      --text-primary: #E8EAED;
      --accent: #38BDF8;
    }
    body {
      margin: 0;
      font-family: -apple-system, system-ui, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    .recording-card {
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1rem;
      cursor: pointer;
    }
    audio {
      width: 100%;
      margin-top: 1rem;
    }
    .transcript {
      font-size: 0.9rem;
      line-height: 1.6;
      margin-top: 1rem;
      opacity: 0.8;
    }
    .timestamp {
      color: var(--accent);
      cursor: pointer;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Family Memories Archive</h1>
    <div id="recordings"></div>
  </div>
  
  <script>
    // 读取 manifest.json 并渲染
    fetch('manifest.json')
      .then(r => r.json())
      .then(data => {
        const container = document.getElementById('recordings');
        
        data.recordings.forEach(rec => {
          const card = document.createElement('div');
          card.className = 'recording-card';
          card.innerHTML = `
            <h2>${rec.title}</h2>
            <p>${rec.storyteller} • ${new Date(rec.recorded_at).toLocaleDateString()}</p>
            <audio controls src="${rec.audio_file}"></audio>
            <div class="transcript" id="transcript-${rec.id}"></div>
          `;
          container.appendChild(card);
          
          // 加载转写（带时间戳点击跳转）
          fetch(rec.transcript_file)
            .then(r => r.json())
            .then(transcript => {
              const transcriptDiv = document.getElementById(`transcript-${rec.id}`);
              const audio = card.querySelector('audio');
              
              transcript.words.forEach(word => {
                const span = document.createElement('span');
                span.textContent = word.text + ' ';
                span.className = 'timestamp';
                span.dataset.time = word.start;
                span.onclick = () => {
                  audio.currentTime = word.start;
                  audio.play();
                };
                transcriptDiv.appendChild(span);
              });
            });
        });
      });
  </script>
</body>
</html>
```

**后端 API 实现**：
```typescript
// packages/web/src/app/api/projects/[id]/export/route.ts
import archiver from 'archiver';
import { PassThrough } from 'stream';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthenticatedUser(request);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const accessCheck = await requireProjectAccess(params.id, auth.user);
  if (!accessCheck.ok) return accessCheck.response;
  
  // 查询该项目的所有数据
  const { data: recordings } = await supabaseAdmin
    .from('recordings')
    .select('*, transcript:transcripts(*), stories:story_versions(*)')
    .eq('project_id', params.id);
  
  // 创建 ZIP 流
  const archive = archiver('zip', { zlib: { level: 9 } });
  const passThrough = new PassThrough();
  
  archive.pipe(passThrough);
  
  // 添加 manifest.json
  const manifest = generateManifest(recordings);
  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
  
  // 添加离线播放器
  const indexHtml = fs.readFileSync('./export-templates/index.html', 'utf8');
  archive.append(indexHtml, { name: 'index.html' });
  
  // 添加音频文件
  for (const rec of recordings) {
    const { data: audioBuffer } = await supabaseAdmin.storage
      .from('saga')
      .download(rec.storage_path);
    
    const filename = `${rec.sequence}-${slugify(rec.title)}.m4a`;
    archive.append(Buffer.from(await audioBuffer.arrayBuffer()), {
      name: `audio/${filename}`
    });
    
    // 添加转写 JSON
    if (rec.transcript) {
      archive.append(JSON.stringify(rec.transcript, null, 2), {
        name: `transcripts/${rec.sequence}-${slugify(rec.title)}.json`
      });
    }
  }
  
  // 添加故事 Markdown
  for (const rec of recordings) {
    if (rec.stories && rec.stories.length > 0) {
      const latestStory = rec.stories[rec.stories.length - 1];
      archive.append(latestStory.content, {
        name: `stories/${slugify(latestStory.title)}.md`
      });
    }
  }
  
  // 添加 README
  archive.append(generateReadme(manifest), { name: 'README.txt' });
  
  await archive.finalize();
  
  return new Response(passThrough as any, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="family-memories-${params.id}.zip"`
    }
  });
}
```

**前端触发导出**：
```typescript
// packages/web/src/components/projects/ExportButton.tsx
export function ExportButton({ projectId }: { projectId: string }) {
  const [exporting, setExporting] = useState(false);
  
  async function handleExport() {
    setExporting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/export`);
      const blob = await response.blob();
      
      // 触发浏览器下载
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `family-memories-${projectId}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('导出成功！你的家庭记忆已安全保存');
    } catch (error) {
      toast.error('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  }
  
  return (
    <button onClick={handleExport} disabled={exporting}>
      {exporting ? '正在导出...' : '导出完整档案'}
    </button>
  );
}
```

---

### 模块 3：AI 处理流水线（Week 2-3）

**负责人**：AI 工程师  
**目标**：高质量转写 + 忠实编辑 + 可追溯来源

#### 任务 3.1：集成 ElevenLabs Scribe v2
**新文件**：`packages/web/src/lib/ai/providers/elevenlabs.ts`

```typescript
import fetch from 'node-fetch';

interface ScribeV2Result {
  transcription: string;
  words: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  speakers: Array<{
    speaker_id: string;
    segments: Array<{
      text: string;
      start: number;
      end: number;
    }>;
  }>;
  language: string;
}

export async function transcribeWithScribe(
  audioBuffer: Buffer,
  options: {
    language?: string;
    enableDiarization?: boolean;
  } = {}
): Promise<ScribeV2Result> {
  const formData = new FormData();
  formData.append('audio', new Blob([audioBuffer]));
  formData.append('model', 'scribe_v2');
  
  if (options.enableDiarization) {
    formData.append('diarization', 'true');
  }
  
  if (options.language) {
    formData.append('language', options.language);
  }
  
  const response = await fetch('https://api.elevenlabs.io/v1/audio-transcription', {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY!,
    },
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Scribe v2 failed: ${error}`);
  }
  
  const result = await response.json();
  
  // 标准化输出格式
  return {
    transcription: result.text || result.transcription,
    words: result.words.map((w: any) => ({
      text: w.word || w.text,
      start: w.start,
      end: w.end,
      confidence: w.confidence || 0.95,
    })),
    speakers: result.speakers || [],
    language: result.detected_language || options.language || 'en',
  };
}

// 将说话人分离结果合并回逐词时间戳
export function mergeSpeakerDiarization(
  words: ScribeV2Result['words'],
  speakers: ScribeV2Result['speakers']
): Array<{
  text: string;
  start: number;
  end: number;
  speaker_id: string | null;
}> {
  const merged = words.map(word => ({
    ...word,
    speaker_id: null as string | null,
  }));
  
  for (const speaker of speakers) {
    for (const segment of speaker.segments) {
      // 找到该时间段内的所有词
      merged.forEach(word => {
        if (word.start >= segment.start && word.end <= segment.end) {
          word.speaker_id = speaker.speaker_id;
        }
      });
    }
  }
  
  return merged;
}
```

**集成到现有转写流程**：
```typescript
// packages/web/src/app/api/ai/transcribe/route.ts
import { transcribeWithScribe, mergeSpeakerDiarization } from '@/lib/ai/providers/elevenlabs';

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { storagePath, projectId, enableDiarization = true } = await request.json();
  
  // 验证权限（参考任务 1.3）
  // ...
  
  // 下载音频
  const { data: audioData } = await supabaseAdmin.storage
    .from('saga')
    .download(storagePath);
  
  const audioBuffer = Buffer.from(await audioData.arrayBuffer());
  
  // 使用 Scribe v2 转写
  const result = await transcribeWithScribe(audioBuffer, {
    language: 'en',
    enableDiarization,
  });
  
  // 合并说话人信息
  const wordsWithSpeakers = mergeSpeakerDiarization(result.words, result.speakers);
  
  // 保存到数据库
  const { data: transcript } = await supabaseAdmin
    .from('transcripts')
    .insert({
      media_asset_id: assetId,
      transcription_text: result.transcription,
      words: wordsWithSpeakers,
      speakers: result.speakers,
      model: 'scribe_v2',
      language: result.language,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  return NextResponse.json({
    success: true,
    transcript_id: transcript.id,
    text: result.transcription,
    word_count: result.words.length,
    speaker_count: result.speakers.length,
  }, { headers: auth.headers });
}
```

#### 任务 3.2：实现 Opus 5.5 证据提取
**目标**：从转写中提取人物、事件、时间、地点，必须带原句引用

**新文件**：`packages/web/src/lib/agents/evidence-extractor.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface EvidenceExtractionResult {
  people: Array<{
    name: string;
    relationship?: string; // "mother", "grandfather", etc.
    aliases: string[]; // "Mom", "Grandma Mary"
    source_quote: string;
    confidence: number;
    word_range: [number, number]; // 在 words 数组中的起止位置
  }>;
  events: Array<{
    description: string;
    when?: {
      year?: number;
      month?: string;
      precision: 'exact' | 'approximate' | 'unknown';
    };
    where?: string;
    participants: string[];
    source_quote: string;
    confidence: number;
    word_range: [number, number];
  }>;
  themes: string[];
  emotions: Array<{
    emotion: string;
    context: string;
    source_quote: string;
  }>;
}

export async function extractEvidence(
  transcription: string,
  words: Array<{ text: string; start: number; end: number }>,
  storytellerName: string
): Promise<EvidenceExtractionResult> {
  // 构建提示词
  const prompt = `你是一位口述历史整理专家。我会给你一段家庭成员的口述录音转写，你需要提取关键信息。

**重要原则**：
1. 只提取转写中明确提到的内容，不要推测或补充
2. 每条信息必须引用原文片段
3. 如果时间、地点不确定，保留为 null 或标注 "approximate"
4. 人名可能以昵称出现（"妈妈"、"老爸"），记录所有变体
5. 同一个人的不同称呼要关联起来

**讲述者**: ${storytellerName}

**转写内容**:
${transcription}

请以 JSON 格式返回提取的信息。`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 4000,
    temperature: 0.3,
    messages: [{
      role: 'user',
      content: prompt,
    }],
    system: `你是证据提取助手。输出必须是严格的 JSON，结构如下：
{
  "people": [
    {
      "name": "正式姓名（如果知道）",
      "relationship": "与讲述者的关系",
      "aliases": ["昵称1", "昵称2"],
      "source_quote": "他提到的原话",
      "confidence": 0.9
    }
  ],
  "events": [
    {
      "description": "简短事件描述",
      "when": { "year": 1975, "precision": "approximate" },
      "where": "地点",
      "participants": ["涉及的人名"],
      "source_quote": "原话",
      "confidence": 0.85
    }
  ],
  "themes": ["主题1", "主题2"],
  "emotions": [
    {
      "emotion": "快乐/悲伤/骄傲等",
      "context": "什么事情引发的",
      "source_quote": "原话"
    }
  ]
}

如果某个字段不确定，使用 null 而不是猜测。`,
  });
  
  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }
  
  // 解析 JSON
  let extracted: EvidenceExtractionResult;
  try {
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    extracted = JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Failed to parse Claude response:', content.text);
    throw new Error(`JSON parsing failed: ${error.message}`);
  }
  
  // 为每个引用找到对应的词位置
  extracted.people = extracted.people.map(person => ({
    ...person,
    word_range: findQuotePosition(person.source_quote, words),
  }));
  
  extracted.events = extracted.events.map(event => ({
    ...event,
    word_range: findQuotePosition(event.source_quote, words),
  }));
  
  return extracted;
}

// 辅助函数：在 words 数组中找到引用的位置
function findQuotePosition(
  quote: string,
  words: Array<{ text: string; start: number; end: number }>
): [number, number] {
  const quoteWords = quote.toLowerCase().split(/\s+/);
  
  for (let i = 0; i <= words.length - quoteWords.length; i++) {
    const windowWords = words
      .slice(i, i + quoteWords.length)
      .map(w => w.text.toLowerCase());
    
    // 检查是否匹配（允许一定容差）
    const matchScore = quoteWords.reduce((score, qw, idx) => {
      return score + (windowWords[idx]?.includes(qw) || qw.includes(windowWords[idx]) ? 1 : 0);
    }, 0);
    
    if (matchScore / quoteWords.length > 0.7) {
      return [i, i + quoteWords.length - 1];
    }
  }
  
  // 如果找不到精确匹配，返回整个转写的范围
  console.warn(`Quote not found in transcript: "${quote}"`);
  return [0, words.length - 1];
}
```

**API 路由**：
```typescript
// packages/web/src/app/api/agents/editor/extract-evidence/route.ts
import { extractEvidence } from '@/lib/agents/evidence-extractor';

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { transcriptId, storytellerName } = await request.json();
  
  // 获取转写内容
  const { data: transcript } = await supabaseAdmin
    .from('transcripts')
    .select('*, media_asset:media_assets(project_id)')
    .eq('id', transcriptId)
    .single();
  
  if (!transcript) {
    return NextResponse.json({ error: 'Transcript not found' }, { status: 404 });
  }
  
  // 验证权限
  const accessCheck = await requireProjectAccess(transcript.media_asset.project_id, auth.user);
  if (!accessCheck.ok) return accessCheck.response;
  
  // 提取证据
  const evidence = await extractEvidence(
    transcript.transcription_text,
    transcript.words,
    storytellerName
  );
  
  // 保存到数据库
  const storyElements = [];
  
  for (const person of evidence.people) {
    storyElements.push({
      transcript_id: transcriptId,
      element_type: 'person',
      value: person.name,
      metadata: {
        relationship: person.relationship,
        aliases: person.aliases,
      },
      source_quote: person.source_quote,
      word_range: person.word_range,
      confidence: person.confidence,
    });
  }
  
  for (const event of evidence.events) {
    storyElements.push({
      transcript_id: transcriptId,
      element_type: 'event',
      value: event.description,
      metadata: {
        when: event.when,
        where: event.where,
        participants: event.participants,
      },
      source_quote: event.source_quote,
      word_range: event.word_range,
      confidence: event.confidence,
    });
  }
  
  await supabaseAdmin.from('story_elements').insert(storyElements);
  
  return NextResponse.json({
    success: true,
    people_count: evidence.people.length,
    events_count: evidence.events.length,
    themes: evidence.themes,
  }, { headers: auth.headers });
}
```

#### 任务 3.3：实现 Astra 证据复核
**目标**：用不同模型检查是否有新增事实、主体变更、日期错误

```typescript
// packages/web/src/lib/agents/evidence-reviewer.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ReviewResult {
  issues: Array<{
    type: 'added_fact' | 'changed_subject' | 'date_conflict' | 'missing_source';
    severity: 'high' | 'medium' | 'low';
    description: string;
    location: string; // 在草稿中的位置
    original_quote?: string;
    suggested_fix?: string;
  }>;
  overall_assessment: 'approved' | 'needs_review' | 'rejected';
}

export async function reviewEvidence(
  originalTranscript: string,
  extractedElements: any[],
  draftStory: string
): Promise<ReviewResult> {
  const prompt = `你是一位严谨的事实核查员。我会给你：
1. 原始口述录音转写
2. 从中提取的关键信息
3. 基于这些信息编写的故事草稿

你的任务是检查草稿中是否有：
- **新增事实**：草稿中出现了转写里没有的信息
- **主体变更**：把 A 说的话变成了 B 说的
- **日期冲突**：年份、时间顺序与原话不符
- **遗漏引用**：草稿中的重要陈述找不到原话来源

**原始转写**：
${originalTranscript}

**提取的关键信息**：
${JSON.stringify(extractedElements, null, 2)}

**故事草稿**：
${draftStory}

请列出所有发现的问题，按严重程度排序。`;

  const response = await openai.chat.completions.create({
    model: 'gpt-6-astra',
    messages: [
      {
        role: 'system',
        content: `你是事实核查助手。输出 JSON 格式：
{
  "issues": [
    {
      "type": "added_fact",
      "severity": "high",
      "description": "草稿说 '1975 年' 但原话是 '大概七十年代'",
      "location": "第二段第一句",
      "original_quote": "原话",
      "suggested_fix": "建议改为..."
    }
  ],
  "overall_assessment": "needs_review"
}`,
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });
  
  const result = JSON.parse(response.choices[0].message.content);
  return result;
}
```

---

### 模块 4：双入口 MVP（Week 3-4）

#### 任务 4.1：入口 A - 保存已有声音

**前端页面**：`packages/web/src/app/[locale]/dashboard/projects/[id]/import/page.tsx`

```tsx
'use client';

import { useState } from 'react';
import { Upload, Mic, Video } from 'lucide-react';
import { toast } from 'sonner';

export default function ImportMemoriesPage({ params }: { params: { id: string; locale: string } }) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState<'upload' | 'context' | 'processing' | 'complete'>('upload');
  
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files || []);
    
    // 验证文件类型
    const validFiles = selectedFiles.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['mp3', 'm4a', 'wav', 'mov', 'mp4', 'webm'].includes(ext || '');
    });
    
    if (validFiles.length !== selectedFiles.length) {
      toast.error('部分文件格式不支持，已自动过滤');
    }
    
    setFiles(validFiles);
  }
  
  async function handleUpload() {
    if (files.length === 0) return;
    
    setUploading(true);
    setStep('context');
  }
  
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2">保存已有的声音</h1>
      <p className="text-gray-400 mb-8">
        上传旧的语音留言、家庭视频或录音文件，我们帮你整理并永久保存
      </p>
      
      {step === 'upload' && (
        <div className="space-y-6">
          {/* 文件上传区域 */}
          <div
            className="border-2 border-dashed border-gray-600 rounded-xl p-12 text-center hover:border-blue-500 transition cursor-pointer"
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <Upload className="w-16 h-16 mx-auto mb-4 text-gray-500" />
            <p className="text-lg mb-2">拖拽文件到这里，或点击选择</p>
            <p className="text-sm text-gray-500">
              支持 MP3, M4A, WAV, MOV, MP4 格式
            </p>
            <input
              id="file-input"
              type="file"
              multiple
              accept="audio/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          
          {/* 已选文件列表 */}
          {files.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">已选择 {files.length} 个文件</h3>
              {files.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between bg-gray-800 p-3 rounded">
                  <div className="flex items-center gap-3">
                    {file.type.startsWith('audio/') ? <Mic className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                    <span>{file.name}</span>
                    <span className="text-sm text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                  <button
                    onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                    className="text-red-500 hover:text-red-400"
                  >
                    移除
                  </button>
                </div>
              ))}
              
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium mt-4"
              >
                继续
              </button>
            </div>
          )}
          
          {/* 示例卡片 */}
          <div className="grid grid-cols-3 gap-4 mt-8">
            <div className="bg-gray-800 p-6 rounded-lg">
              <Mic className="w-8 h-8 mb-3 text-blue-500" />
              <h4 className="font-medium mb-2">语音留言</h4>
              <p className="text-sm text-gray-400">
                保存亲人的生日祝福、节日问候
              </p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg">
              <Video className="w-8 h-8 mb-3 text-blue-500" />
              <h4 className="font-medium mb-2">家庭视频</h4>
              <p className="text-sm text-gray-400">
                从旧手机、相机中找到的珍贵片段
              </p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg">
              <Mic className="w-8 h-8 mb-3 text-blue-500" />
              <h4 className="font-medium mb-2">随手录音</h4>
              <p className="text-sm text-gray-400">
                聊天时顺手录下的故事
              </p>
            </div>
          </div>
        </div>
      )}
      
      {step === 'context' && (
        <ContextForm
          files={files}
          onSubmit={async (contexts) => {
            setStep('processing');
            // 上传文件并提交背景信息
            for (let i = 0; i < files.length; i++) {
              await uploadMemory(files[i], contexts[i], params.id);
            }
            setStep('complete');
          }}
        />
      )}
      
      {step === 'processing' && (
        <ProcessingView files={files} />
      )}
      
      {step === 'complete' && (
        <CompleteView projectId={params.id} />
      )}
    </div>
  );
}

function ContextForm({ files, onSubmit }: { 
  files: File[]; 
  onSubmit: (contexts: any[]) => void;
}) {
  const [contexts, setContexts] = useState(
    files.map(() => ({
      who: '',
      when: '',
      why: '',
    }))
  );
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">补充一些背景信息</h2>
      <p className="text-gray-400">
        这些信息帮助你以后更容易找到这段记忆
      </p>
      
      {files.map((file, idx) => (
        <div key={idx} className="bg-gray-800 p-6 rounded-lg space-y-4">
          <h3 className="font-medium">{file.name}</h3>
          
          <div>
            <label className="block text-sm mb-2">这是谁的声音？</label>
            <input
              type="text"
              placeholder="例如：妈妈、爷爷"
              value={contexts[idx].who}
              onChange={e => {
                const newContexts = [...contexts];
                newContexts[idx].who = e.target.value;
                setContexts(newContexts);
              }}
              className="w-full bg-gray-700 rounded px-4 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm mb-2">大概什么时候？（可选）</label>
            <input
              type="text"
              placeholder="例如：2023 年生日、去年春节"
              value={contexts[idx].when}
              onChange={e => {
                const newContexts = [...contexts];
                newContexts[idx].when = e.target.value;
                setContexts(newContexts);
              }}
              className="w-full bg-gray-700 rounded px-4 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm mb-2">为什么重要？（可选）</label>
            <textarea
              placeholder="例如：这是妈妈最后一次唱生日歌给我"
              value={contexts[idx].why}
              onChange={e => {
                const newContexts = [...contexts];
                newContexts[idx].why = e.target.value;
                setContexts(newContexts);
              }}
              className="w-full bg-gray-700 rounded px-4 py-2 h-24"
            />
          </div>
        </div>
      ))}
      
      <button
        onClick={() => onSubmit(contexts)}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium"
      >
        开始整理
      </button>
    </div>
  );
}
```

**后端 API**：
```typescript
// packages/web/src/app/api/projects/[id]/memories/import/route.ts
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await getAuthenticatedUser(request);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const accessCheck = await requireProjectAccess(params.id, auth.user);
  if (!accessCheck.ok) return accessCheck.response;
  
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const who = formData.get('who') as string;
  const when = formData.get('when') as string;
  const why = formData.get('why') as string;
  
  // 1. 上传到 Supabase Storage
  const fileName = `${Date.now()}-${file.name}`;
  const storagePath = `projects/${params.id}/imports/${fileName}`;
  
  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from('saga')
    .upload(storagePath, await file.arrayBuffer(), {
      contentType: file.type,
    });
  
  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
  
  // 2. 创建 media_asset 记录
  const { data: asset } = await supabaseAdmin
    .from('media_assets')
    .insert({
      project_id: params.id,
      storage_path: storagePath,
      original_filename: file.name,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: auth.user.id,
      metadata: { who, when, why },
    })
    .select()
    .single();
  
  // 3. 触发后台转写任务
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ai/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storagePath,
      assetId: asset.id,
      enableDiarization: true,
    }),
  });
  
  // 4. 创建记忆卡片（初始状态）
  const { data: memory } = await supabaseAdmin
    .from('memory_cards')
    .insert({
      project_id: params.id,
      media_asset_id: asset.id,
      title: file.name.replace(/\.[^/.]+$/, ''),
      context: { who, when, why },
      status: 'processing',
    })
    .select()
    .single();
  
  return NextResponse.json({
    success: true,
    memory_id: memory.id,
    asset_id: asset.id,
  }, { headers: auth.headers });
}
```

#### 任务 4.2：入口 B - 陪同讲新故事

**前端页面**：`packages/web/src/app/[locale]/dashboard/projects/[id]/guided-session/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Mic, Pause, Check, SkipForward } from 'lucide-react';

export default function GuidedSessionPage({ params }: { params: { id: string } }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  useEffect(() => {
    // 启动会话并获取首个问题
    fetch(`/api/projects/${params.id}/sessions`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        setSessionId(data.session_id);
        setCurrentQuestion(data.initial_question);
      });
  }, [params.id]);
  
  async function startRecording() {
    setRecording(true);
    // 启动录音逻辑（复用 SmartRecorder）
  }
  
  async function stopRecording() {
    setRecording(false);
    // 停止录音并上传
    
    // 获取 AI 建议的下一个问题
    const response = await fetch(`/api/sessions/${sessionId}/suggest-next`, {
      method: 'POST',
    });
    const data = await response.json();
    setSuggestedQuestions(data.suggestions);
  }
  
  function selectQuestion(question: string) {
    setCurrentQuestion(question);
    setSuggestedQuestions([]);
  }
  
  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">陪同讲故事</h1>
        <p className="text-gray-400">
          你来操作，亲人讲述，我们在旁边辅助
        </p>
      </div>
      
      {/* 当前问题卡片 */}
      <div className="bg-gradient-to-br from-blue-900 to-purple-900 p-8 rounded-2xl mb-6">
        <h2 className="text-xl font-medium mb-4">当前问题</h2>
        <p className="text-2xl leading-relaxed">{currentQuestion}</p>
      </div>
      
      {/* 录音控制 */}
      <div className="flex flex-col items-center gap-4 mb-8">
        {!recording ? (
          <button
            onClick={startRecording}
            className="w-24 h-24 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition"
          >
            <Mic className="w-10 h-10" />
          </button>
        ) : (
          <>
            <div className="text-4xl font-mono">{formatTime(recordingTime)}</div>
            <div className="flex gap-4">
              <button
                onClick={stopRecording}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center gap-2"
              >
                <Check className="w-5 h-5" />
                完成这个问题
              </button>
              <button
                onClick={() => {/* 暂停逻辑 */}}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center gap-2"
              >
                <Pause className="w-5 h-5" />
                暂停
              </button>
            </div>
          </>
        )}
      </div>
      
      {/* AI 建议的下一个问题 */}
      {suggestedQuestions.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-gray-400">AI 建议的下一个问题：</h3>
          {suggestedQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => selectQuestion(q)}
              className="w-full text-left bg-gray-800 hover:bg-gray-700 p-4 rounded-lg transition"
            >
              {q}
            </button>
          ))}
          
          <button
            onClick={() => {/* 自定义问题 */}}
            className="w-full text-left bg-gray-800 hover:bg-gray-700 p-4 rounded-lg transition text-gray-400 border-2 border-dashed border-gray-600"
          >
            + 我想问别的...
          </button>
        </div>
      )}
      
      {/* 已完成的录音列表 */}
      <div className="mt-12">
        <h3 className="font-medium mb-4">已完成的部分</h3>
        {/* 显示本次会话已录制的片段 */}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
```

---

### 模块 5：家庭试点招募（Week 5-6）

**负责人**：产品 + 增长  
**目标**：8-12 个真实付费家庭，收集第一手数据

#### 任务 5.1：设置支付流程（Stripe）

**前端**：`packages/web/src/app/[locale]/dashboard/projects/[id]/checkout/page.tsx`

```tsx
'use client';

import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function CheckoutPage({ params }: { params: { id: string } }) {
  const [selectedPlan, setSelectedPlan] = useState<'import' | 'guided'>('import');
  
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">选择你的起点</h1>
      
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* 入口 A 定价 */}
        <div 
          className={`border-2 rounded-xl p-6 cursor-pointer transition ${
            selectedPlan === 'import' ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700'
          }`}
          onClick={() => setSelectedPlan('import')}
        >
          <h3 className="text-xl font-bold mb-2">保存已有声音</h3>
          <div className="text-3xl font-bold mb-4">$19</div>
          <ul className="space-y-2 text-sm text-gray-400">
            <li>✓ 上传最多 30 分钟录音</li>
            <li>✓ 自动转写 + 说话人识别</li>
            <li>✓ 生成可回听记忆卡片</li>
            <li>✓ 完整数据导出包</li>
          </ul>
          <p className="text-xs text-gray-500 mt-4">
            💡 适合：已有语音留言、旧录音想保存的家庭
          </p>
        </div>
        
        {/* 入口 B 定价 */}
        <div 
          className={`border-2 rounded-xl p-6 cursor-pointer transition ${
            selectedPlan === 'guided' ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700'
          }`}
          onClick={() => setSelectedPlan('guided')}
        >
          <h3 className="text-xl font-bold mb-2">一起讲新故事</h3>
          <div className="text-3xl font-bold mb-4">$39</div>
          <ul className="space-y-2 text-sm text-gray-400">
            <li>✓ 3 次引导式访谈</li>
            <li>✓ 最多 60 分钟录音</li>
            <li>✓ AI 问题建议</li>
            <li>✓ 原声 + 整理后的文字</li>
            <li>✓ 首份小作品（1-2 页故事）</li>
          </ul>
          <p className="text-xs text-gray-500 mt-4">
            💡 适合：想系统记录父母故事的家庭
          </p>
        </div>
      </div>
      
      {/* 早鸟折扣提示 */}
      <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-6">
        <p className="text-yellow-300">
          🎉 <strong>早期测试用户</strong>：享受 50% 折扣 + 优先支持
        </p>
        <p className="text-sm text-gray-400 mt-1">
          我们会认真听取你的反馈，帮助产品变得更好
        </p>
      </div>
      
      <Elements stripe={stripePromise}>
        <CheckoutForm projectId={params.id} plan={selectedPlan} />
      </Elements>
    </div>
  );
}

function CheckoutForm({ projectId, plan }: { projectId: string; plan: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    
    setLoading(true);
    
    // 创建支付意图
    const response = await fetch('/api/payments/create-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, plan }),
    });
    
    const { clientSecret } = await response.json();
    
    // 确认支付
    const { error } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard/projects/${projectId}/success`,
      },
    });
    
    if (error) {
      toast.error(error.message);
      setLoading(false);
    }
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-3 rounded-lg font-medium"
      >
        {loading ? '处理中...' : `支付 $${plan === 'import' ? '9.50' : '19.50'} (50% 早鸟折扣)`}
      </button>
      
      <p className="text-xs text-center text-gray-500">
        支付信息由 Stripe 安全处理，我们不存储你的银行卡信息
      </p>
    </form>
  );
}
```

#### 任务 5.2：招募渠道执行

**渠道 1：个人网络（目标 4 个家庭）**

准备材料：
```markdown
# 发给朋友/同事的邀请消息模板

嗨 [名字]，

我们正在做一个帮助家庭保存父母/祖父母声音和故事的产品，现在处于早期测试阶段。

如果你：
- 有父母/祖父母愿意分享一些人生故事
- 或者手机里有一些珍贵的旧语音留言、录音想好好保存
- 愿意给我们真实反馈（包括批评）

我们提供 50% 早鸟折扣（$9.50 起），作为交换，希望你能：
1. 实际使用一次完整流程
2. 告诉我们哪里卡住了、哪里做得好
3. 录音后的 2 周内完成一次 30 分钟反馈电话

不强制要求写好评或发社交媒体，我们只是想知道真实体验。

感兴趣的话回复我，我发详细链接给你。

[你的名字]
```

**渠道 2：Reddit 真诚回复（目标 4 个家庭）**

在这些 subreddit 找相关讨论：
- r/AgingParents
- r/Genealogy
- r/FamilyHistory
- r/RedditForGrownups

回复模板（针对 "想记录父母故事但不知道怎么开始" 的帖子）：
```markdown
我们正在测试一个产品来解决这个问题（声明：我是团队成员）。

目前有两个入口：
1. 如果你有旧录音/语音留言想保存 → 上传后自动转写和整理
2. 如果想陪父母讲新故事 → 我们提供问题建议，你负责录音

早期测试阶段提供 50% 折扣（$9.50-19.50），但我们会真诚请教你的反馈。

不确定适不适合你，但如果想试试可以 DM 我。即使试了觉得不行，也希望你能告诉我们为什么。
```

**不要做的事**：
- ❌ 声称 "最好的产品"、"革命性"、"AI 驱动"
- ❌ 在帖子里直接贴购买链接（会被当成垃圾广告）
- ❌ 冒充普通用户（诚实说明身份）
- ❌ 给负面评价的竞品帖子下拉客

**渠道 3：小型内容创作者合作（目标 4 个家庭）**

目标创作者特征：
- 主题：家庭关系、养老照护、家谱研究
- 粉丝：500-5000（不要大号，大号很难建立真实关系）
- 互动率高，评论区有真实讨论

合作提案邮件：
```
主题：邀请合作：家庭故事保存产品测试

嗨 [创作者名字]，

我是 UR Saga 的 [你的角色]，一个帮助家庭保存父母声音和故事的产品。

我看到你的内容关于 [具体哪条内容打动了你]，感觉你的观众可能也关心这个话题。

我们现在处于早期测试，想邀请你：
1. 免费使用我们的服务（为你自己家庭或你选择的一个家庭）
2. 给我们诚实反馈（包括不好的地方）
3. 如果你觉得值得，可以分享给你的观众（但不强制）

不是典型的推广合作 —— 我们不要求你必须发帖，也不会给你佣金链接。
只是真心想知道，这个产品对真实家庭是否有用。

如果你有兴趣，我可以先发一个演示视频给你看看。

[你的名字]
[联系方式]
```

#### 任务 5.3：数据收集仪表板

**新文件**：`packages/web/src/app/[locale]/admin/pilot-dashboard/page.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';

interface PilotFamily {
  id: string;
  source: string; // 'personal' | 'reddit' | 'creator' | 'other'
  created_at: string;
  paid_at: string | null;
  first_recording_at: string | null;
  completed_at: string | null;
  plan: 'import' | 'guided';
  recordings_count: number;
  support_minutes: number;
  api_cost: number;
  nps_score: number | null;
  feedback: string | null;
}

export default function PilotDashboard() {
  const [families, setFamilies] = useState<PilotFamily[]>([]);
  
  useEffect(() => {
    fetch('/api/admin/pilot-metrics')
      .then(r => r.json())
      .then(data => setFamilies(data.families));
  }, []);
  
  // 计算关键指标
  const metrics = {
    total: families.length,
    paid: families.filter(f => f.paid_at).length,
    started: families.filter(f => f.first_recording_at).length,
    completed: families.filter(f => f.completed_at).length,
    avgSupportTime: families.reduce((sum, f) => sum + f.support_minutes, 0) / families.length,
    avgAPICost: families.reduce((sum, f) => sum + f.api_cost, 0) / families.length,
    avgNPS: families.filter(f => f.nps_score !== null).reduce((sum, f) => sum + (f.nps_score || 0), 0) / families.filter(f => f.nps_score !== null).length,
  };
  
  return (
    <div className="max-w-7xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">试点家庭仪表板</h1>
      
      {/* 关键指标卡片 */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard title="总家庭数" value={metrics.total} />
        <MetricCard title="付款率" value={`${((metrics.paid / metrics.total) * 100).toFixed(0)}%`} />
        <MetricCard title="启动率" value={`${((metrics.started / metrics.paid) * 100).toFixed(0)}%`} />
        <MetricCard title="完成率" value={`${((metrics.completed / metrics.started) * 100).toFixed(0)}%`} />
      </div>
      
      <div className="grid grid-cols-3 gap-4 mb-8">
        <MetricCard title="平均人工时间" value={`${metrics.avgSupportTime.toFixed(1)} 分钟`} />
        <MetricCard title="平均 API 成本" value={`$${metrics.avgAPICost.toFixed(2)}`} />
        <MetricCard title="平均 NPS" value={metrics.avgNPS.toFixed(1)} />
      </div>
      
      {/* 家庭列表 */}
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left">来源</th>
              <th className="px-4 py-3 text-left">计划</th>
              <th className="px-4 py-3 text-left">状态</th>
              <th className="px-4 py-3 text-left">录音数</th>
              <th className="px-4 py-3 text-left">人工时间</th>
              <th className="px-4 py-3 text-left">API 成本</th>
              <th className="px-4 py-3 text-left">NPS</th>
              <th className="px-4 py-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {families.map(family => (
              <tr key={family.id} className="border-t border-gray-700">
                <td className="px-4 py-3">{family.source}</td>
                <td className="px-4 py-3">{family.plan}</td>
                <td className="px-4 py-3">
                  <StatusBadge family={family} />
                </td>
                <td className="px-4 py-3">{family.recordings_count}</td>
                <td className="px-4 py-3">{family.support_minutes} min</td>
                <td className="px-4 py-3">${family.api_cost.toFixed(2)}</td>
                <td className="px-4 py-3">
                  {family.nps_score !== null ? family.nps_score : '-'}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => {/* 查看详情 */}}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    查看
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="text-sm text-gray-400 mb-1">{title}</div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
}

function StatusBadge({ family }: { family: PilotFamily }) {
  if (family.completed_at) {
    return <span className="px-2 py-1 bg-green-900 text-green-300 rounded text-sm">已完成</span>;
  }
  if (family.first_recording_at) {
    return <span className="px-2 py-1 bg-blue-900 text-blue-300 rounded text-sm">进行中</span>;
  }
  if (family.paid_at) {
    return <span className="px-2 py-1 bg-yellow-900 text-yellow-300 rounded text-sm">已付款</span>;
  }
  return <span className="px-2 py-1 bg-gray-700 text-gray-400 rounded text-sm">未付款</span>;
}
```

---

### 模块 6：8 周决策评估（Week 7-8）

**负责人**：全团队  
**目标**：基于真实数据决定继续、调整还是转向

#### 任务 6.1：数据分析脚本

**新文件**：`scripts/analyze-pilot-results.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzePilotResults() {
  // 获取所有试点家庭数据
  const { data: families } = await supabase
    .from('pilot_families')
    .select('*')
    .order('created_at', { ascending: true });
  
  if (!families) {
    console.error('No pilot families found');
    return;
  }
  
  console.log('=== UR Saga 8周试点结果分析 ===\n');
  
  // 1. 漏斗转化率
  const funnelMetrics = {
    interested: families.length,
    paid: families.filter(f => f.paid_at).length,
    started: families.filter(f => f.first_recording_at).length,
    completed: families.filter(f => f.completed_at).length,
    recommended: families.filter(f => f.nps_score && f.nps_score >= 9).length,
  };
  
  console.log('## 漏斗转化');
  console.log(`注册家庭: ${funnelMetrics.interested}`);
  console.log(`付款: ${funnelMetrics.paid} (${((funnelMetrics.paid / funnelMetrics.interested) * 100).toFixed(1)}%)`);
  console.log(`首次录音: ${funnelMetrics.started} (${((funnelMetrics.started / funnelMetrics.paid) * 100).toFixed(1)}%)`);
  console.log(`完成交付: ${funnelMetrics.completed} (${((funnelMetrics.completed / funnelMetrics.started) * 100).toFixed(1)}%)`);
  console.log(`愿意推荐: ${funnelMetrics.recommended} (${((funnelMetrics.recommended / funnelMetrics.completed) * 100).toFixed(1)}%)\n`);
  
  // 2. 入口 A vs 入口 B 对比
  const entryA = families.filter(f => f.plan === 'import');
  const entryB = families.filter(f => f.plan === 'guided');
  
  console.log('## 入口对比');
  console.log(`入口 A（保存已有）: ${entryA.length} 家庭`);
  console.log(`  - 完成率: ${((entryA.filter(f => f.completed_at).length / entryA.length) * 100).toFixed(1)}%`);
  console.log(`  - 平均人工时间: ${(entryA.reduce((sum, f) => sum + f.support_minutes, 0) / entryA.length).toFixed(1)} 分钟`);
  console.log(`入口 B（陪同讲述）: ${entryB.length} 家庭`);
  console.log(`  - 完成率: ${((entryB.filter(f => f.completed_at).length / entryB.length) * 100).toFixed(1)}%`);
  console.log(`  - 平均人工时间: ${(entryB.reduce((sum, f) => sum + f.support_minutes, 0) / entryB.length).toFixed(1)} 分钟\n`);
  
  // 3. 单位经济
  const completedFamilies = families.filter(f => f.completed_at);
  const avgRevenue = completedFamilies.reduce((sum, f) => sum + f.revenue, 0) / completedFamilies.length;
  const avgAPICost = completedFamilies.reduce((sum, f) => sum + f.api_cost, 0) / completedFamilies.length;
  const avgStripeFee = completedFamilies.reduce((sum, f) => sum + f.stripe_fee, 0) / completedFamilies.length;
  const avgSupportCost = completedFamilies.reduce((sum, f) => sum + (f.support_minutes * 0.5), 0) / completedFamilies.length; // 假设 $30/小时
  
  const contribution = avgRevenue - avgAPICost - avgStripeFee - avgSupportCost;
  
  console.log('## 单位经济（平均每个完成家庭）');
  console.log(`收入: $${avgRevenue.toFixed(2)}`);
  console.log(`API 成本: -$${avgAPICost.toFixed(2)}`);
  console.log(`Stripe 手续费: -$${avgStripeFee.toFixed(2)}`);
  console.log(`人工支持成本: -$${avgSupportCost.toFixed(2)} (${(completedFamilies.reduce((sum, f) => sum + f.support_minutes, 0) / completedFamilies.length).toFixed(1)} 分钟)`);
  console.log(`净贡献: $${contribution.toFixed(2)}\n`);
  
  // 4. 质量问题
  const { data: issues } = await supabase
    .from('quality_issues')
    .select('*')
    .in('family_id', completedFamilies.map(f => f.id));
  
  const issuesByType = issues?.reduce((acc, issue) => {
    acc[issue.type] = (acc[issue.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};
  
  console.log('## 质量问题');
  Object.entries(issuesByType)
    .sort(([, a], [, b]) => b - a)
    .forEach(([type, count]) => {
      console.log(`${type}: ${count} 次`);
    });
  console.log();
  
  // 5. 决策建议
  console.log('## 决策建议');
  
  const completionRate = (funnelMetrics.completed / funnelMetrics.started) * 100;
  const npsRate = (funnelMetrics.recommended / funnelMetrics.completed) * 100;
  
  if (completionRate >= 60 && contribution > 0 && npsRate >= 50) {
    console.log('✅ **场景 A：验证成功**');
    console.log('建议：扩大招募规模，优化转化漏斗，准备小规模付费广告测试');
  } else if (completionRate < 30 || contribution < -10 || npsRate < 20) {
    console.log('❌ **场景 C：核心假设失败**');
    console.log('建议：团队讨论是否转向 B2B、纯工具化，或停止项目');
  } else {
    console.log('⚠️ **场景 B：部分验证**');
    console.log('建议：专注解决明确瓶颈，再测 4 周');
    
    if (completionRate < 60) {
      console.log('  - 优先级 1：提高完成率（当前 ${completionRate.toFixed(1)}%）');
    }
    if (contribution < 10) {
      console.log('  - 优先级 2：降低人工支持成本或提价');
    }
    if (npsRate < 50) {
      console.log('  - 优先级 3：提升质量满意度');
    }
  }
}

analyzePilotResults();
```

运行：
```bash
npx tsx scripts/analyze-pilot-results.ts
```

#### 任务 6.2：用户反馈访谈指南

**完成家庭反馈电话（30 分钟结构）**

1. **开场（3 分钟）**
   - 感谢参与，说明目的：真实反馈比好评更有价值
   - 获得录音许可（用于内部分析）

2. **完成过程回顾（10 分钟）**
   - "从你第一次看到我们，到完成这次录音/整理，能带我走一遍吗？"
   - 在每个关键节点追问：
     - 什么让你继续下去？
     - 什么让你想放弃？
     - 有没有卡住的地方？

3. **质量评估（10 分钟）**
   - "看到最终成果时，你的第一反应是什么？"
   - "转写的人名、日期准确吗？有没有明显错误？"
   - "你会把这个成果永久保存吗？为什么？"
   - "如果你爸妈/爷爷奶奶看到，他们会说什么？"

4. **推荐意愿（5 分钟）**
   - NPS 问题："0-10 分，你有多大可能推荐给朋友？"
   - 追问："为什么是这个分数？"
   - "什么情况下你会给更高/更低分？"

5. **产品改进（2 分钟）**
   - "如果只能改一个地方，你希望改什么？"

**未完成家庭访谈（15 分钟结构）**

1. **停止节点（5 分钟）**
   - "你记得是在哪一步停下来的？"
   - "当时发生了什么？"（技术问题、时间不够、失去兴趣？）

2. **期望 vs 现实（5 分钟）**
   - "购买前，你以为会是什么样？"
   - "实际体验和预期的差别在哪？"

3. **挽回可能（5 分钟）**
   - "如果我们现在解决了 [他们提到的问题]，你会继续吗？"
   - "或者这个方向本身不适合你？"

---

## 第三部分：风险管理与应急预案

### 风险 1：8 周内完不成试点目标

**触发条件**：Week 6 结束时 < 4 个付费家庭

**应急措施**：
1. 延长招募期 2 周，但不延长整体决策时间
2. 降低价格到 $5（纯成本覆盖），明确告知 "测试版"
3. 如果仍然招不到，说明需求未验证或获客方式错误，执行场景 C（转向或停止）

### 风险 2：数据丢失或质量事故

**触发条件**：任何一个家庭的录音永久丢失或严重质量问题

**应急措施**：
1. 立即暂停所有新招募
2. 全额退款给受影响家庭 + 诚恳道歉
3. Root cause 分析，修复后再重新开放
4. 如果是系统性问题（如架构缺陷），可能需要重构关键模块

### 风险 3：AI 成本爆炸

**触发条件**：实际 API 成本 > 预算的 3 倍（单项目 > $8）

**应急措施**：
1. 立即分析哪个环节消耗最大（可能是无效重试、过长上下文）
2. 紧急降档：暂时用更便宜模型（如 Sonnet 替代 Opus）
3. 增加人工审核门槛：只对通过初筛的内容用高档模型
4. 如果无法控制成本，提价或减少包含的录音时长

### 风险 4：完成率极低（< 30%）

**触发条件**：Week 6 数据显示完成率 < 30%

**诊断路径**：
1. 是技术问题吗？（录音失败、界面卡住、导出不work）
   - → 优先修复工程问题
2. 是体验问题吗？（太复杂、不知道下一步、长辈不愿意）
   - → 简化流程，增加引导
3. 是需求问题吗？（用户买了但其实不想做）
   - → 可能是获客渠道错了，或产品解决的不是真需求

---

## 第四部分：成功后的扩张路径（Week 9+）

**仅在场景 A（验证成功）后执行**

### Month 3：优化转化漏斗
- 目标：50 个付费家庭
- A/B 测试着陆页、定价、首次引导
- 增加 SEO 内容：博客、案例故事、使用指南
- 小规模 Google Ads / Facebook Ads（每日预算 $50-100）

### Month 4-6：产品迭代
- 根据前 50 个家庭的反馈，优化最痛的 3 个点
- 实现批量导出、家庭相册集成
- 测试实时语音主持（如果完成率数据支持）
- 增加第二种交付物：有声书、PDF 排版

### Month 7-12：扩展获客渠道
- 内容营销：YouTube 视频、播客访谈
- 合作推广：与家谱网站、养老社区、照护服务机构合作
- 推荐机制：完成家庭邀请朋友，双方获得折扣
- 国际扩展：如果英语市场稳定，测试英国、加拿大本地化

### 不在 12 个月内做的事
- ❌ 公共档案、Wiki Editor（Phase 2）
- ❌ 声音克隆、AI 人格模拟
- ❌ 原生 App（除非 PWA 有明确瓶颈）
- ❌ 多语言全面支持（除非出现明确的跨语家庭需求集群）

---

## 附录 A：技术债务登记

以下是当前代码库的已知问题，不阻塞试点，但需要在扩张前解决：

1. **数据库迁移管理**
   - 现状：手动执行 SQL 文件，无版本跟踪
   - 风险：生产与开发 schema 漂移
   - 解决：引入 Supabase Migrations 或 Prisma Migrate

2. **浏览器兼容性测试**
   - 现状：只在 Chrome/Mac 上测试过
   - 风险：老年用户可能用 Safari/iPad/Android 各种版本
   - 解决：Week 1-2 真机测试矩阵

3. **国际化不完整**
   - 现状：Toast 通知、alert 对话框还是硬编码英文
   - 风险：如果扩展到非英语市场会很明显
   - 解决：用 next-intl 包裹所有用户可见文字

4. **品牌遗留引用**
   - 现状：代码里还有 "Furbridge" 等旧品牌名
   - 风险：如果外部人看代码会困惑
   - 解决：全局搜索替换（非紧急）

---

## 附录 B：关键决策文档索引

将以下文档作为决策参考，定期重读：

| 文档 | 用途 | 何时查阅 |
|------|------|----------|
| `UR saga v1.8.md` | 产品愿景与范围 | 添加新功能前，确认是否在 Phase 1 范围内 |
| `2026-10-07-market-and-business.md` | 竞品定价与商业模式 | 调整定价、包装时 |
| `2026-10-08-social-and-market-strategy.md` | 真实用户需求证据 | 设计功能、写文案时，确保贴近真实痛点 |
| `2026-10-08-ai-blueprint-and-model-tiers.md` | AI 技术选型 | 模型切换、成本优化时 |
| `CLAUDE.md` | 代码库架构与约定 | 新工程师入职、重构前 |

---

## 附录 C：每周检查清单

**Week 1-2 检查点（工程生存线）**
- [ ] 3 个数据库迁移已执行并验证
- [ ] 模拟降级逻辑已完全移除
- [ ] 5 个测试录音可以完整导出且离线播放
- [ ] 断网恢复测试通过（iOS + Android）
- [ ] 音频访问权限漏洞已修复

**Week 3-4 检查点（双入口 MVP）**
- [ ] 入口 A：可以上传文件、补充背景、生成记忆卡片
- [ ] 入口 B：可以看到问题建议、录音、审阅草稿
- [ ] Scribe v2 转写集成完成
- [ ] Opus 5.5 证据提取集成完成
- [ ] 至少 1 个内部测试家庭完整走通流程

**Week 5-6 检查点（家庭试点）**
- [ ] 至少 4 个真实付费家庭开始使用
- [ ] 每个家庭的数据收集表单已填写
- [ ] 试点仪表板显示实时数据
- [ ] 至少 2 个家庭完成了首次录音

**Week 7-8 检查点（数据分析）**
- [ ] 完成率、单位经济、NPS 数据已计算
- [ ] 至少 4 个完成家庭的反馈访谈已完成
- [ ] 团队已讨论分析结果
- [ ] 做出明确决策：继续/调整/转向

---

## 结语

这不是一份完美的计划，也不是一个稳赢的策略。但它基于对现状的诚实评估、对市场的深入研究、对技术的务实选择。

**8 周后，我们会知道三件事**：
1. 真实的家庭是否愿意为这个产品付费
2. 我们能否以可持续的成本交付承诺
3. 用户是否会向朋友推荐

如果这三个答案都是肯定的，我们就有了一个值得投入的事业。
如果有任何一个是否定的，我们就有了明确的改进方向。
如果全部都是否定的，我们就诚实地承认，并把精力投入到更有希望的方向。

**现在，开始执行。**

---

**文档版本**: v1.0  
**最后更新**: 2026-10-09  
**下次审阅**: Week 2 结束（2026-10-23）
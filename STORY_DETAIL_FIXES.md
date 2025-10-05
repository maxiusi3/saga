# ✅ 故事详情页修复完成

## 🎯 修复内容

### 1. ✅ 移除重复的故事标题（红框1）

**问题**：音频播放器中显示了重复的故事标题

**修复**：
```typescript
// 之前
<ModernAudioPlayer
  src={story.audio_url}
  title={story.title}  // ❌ 重复显示标题
  duration={story.audio_duration}
/>

// 现在
<ModernAudioPlayer
  src={story.audio_url}
  showDownload={true}  // ✅ 只显示播放器，不显示标题
/>
```

### 2. ✅ 使用真实的评论和追问数据（红框2）

**问题**：使用模拟数据，评论和追问功能不可用

**修复**：
- 移除了模拟的评论数据
- 集成了真实的 `StoryInteractions` 组件
- 支持真实的评论和追问功能

**之前**：
```typescript
// ❌ 模拟数据
<div className="flex gap-3">
  <Avatar><AvatarFallback>M</AvatarFallback></Avatar>
  <div className="flex-1">
    <p>This brings back so many memories! Thank you for sharing this story.</p>
  </div>
</div>
```

**现在**：
```typescript
// ✅ 真实数据
<StoryInteractions
  storyId={storyId}
  projectId={projectId}
  userRole={user?.role || 'viewer'}
  isProjectOwner={story.storyteller_id === user?.id}
  isStoryteller={story.storyteller_id === user?.id}
/>
```

## 📋 功能说明

### 评论功能（所有用户）
- ✅ 所有项目成员都可以添加评论
- ✅ 评论会实时显示
- ✅ 显示评论者姓名和时间

### 追问功能（仅 Facilitator）
- ✅ 只有 Facilitator 可以提问
- ✅ 追问会成为新的录音提示
- ✅ Storyteller 可以点击 "Record Answer" 回答追问
- ✅ 追问状态显示：Pending（待回答）/ Answered（已回答）

## 🔍 权限控制

### 根据用户角色显示不同功能

```typescript
// Facilitator 可以：
- 添加评论 ✅
- 提出追问 ✅
- 查看所有交互 ✅

// Storyteller 可以：
- 查看评论和追问 ✅
- 回答追问（通过录音）✅

// 其他成员可以：
- 添加评论 ✅
- 查看所有交互 ✅
```

## 🎨 UI 改进

### 布局优化
- 移除了重复的标题显示
- 评论和追问合并到一个组件中
- AI 建议的问题移到侧边栏
- 更清晰的视觉层次

### 交互优化
- 实时加载交互数据
- 提交评论/追问后立即显示
- 清晰的状态反馈（加载、成功、失败）

## 📊 数据流

```
用户操作
  ↓
StoryInteractions 组件
  ↓
interactionService.createInteraction()
  ↓
/api/stories/[storyId]/interactions (POST)
  ↓
Supabase interactions 表
  ↓
实时更新 UI
```

## 🧪 测试步骤

### 1. 测试评论功能
1. 访问任意故事详情页
2. 在评论框输入文字
3. 点击 "Post Comment"
4. 验证评论立即显示

### 2. 测试追问功能（Facilitator）
1. 以 Facilitator 身份登录
2. 访问故事详情页
3. 在追问框输入问题
4. 点击 "Ask Question"
5. 验证追问显示为 "Pending" 状态

### 3. 测试回答追问（Storyteller）
1. 以 Storyteller 身份登录
2. 查看有追问的故事
3. 点击 "Record Answer" 按钮
4. 录制回答
5. 验证追问状态变为 "Answered"

## 🔧 技术细节

### 使用的组件
- `StoryInteractions` - 评论和追问的主组件
- `interactionService` - 处理 API 调用
- `canUserPerformAction` - 权限检查

### API 端点
- `GET /api/stories/[storyId]/interactions` - 获取交互列表
- `POST /api/stories/[storyId]/interactions` - 创建新交互

### 数据库表
- `interactions` 表存储所有评论和追问
- 字段：`id`, `story_id`, `user_id`, `type`, `content`, `answered_at`, `created_at`

## ✅ 完成

所有修复已完成，故事详情页现在：
- ✅ 没有重复的标题
- ✅ 使用真实的评论和追问数据
- ✅ 支持完整的交互功能
- ✅ 权限控制正确
- ✅ UI 清晰美观

可以重新部署到 Vercel 测试！

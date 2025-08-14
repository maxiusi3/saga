# Web端Facilitator页面差距分析

## 📋 根据MVP文档应有的页面结构

### 1. 资源管理模块 (缺失)
- `/dashboard/resources` - 资源钱包管理页面
- `/dashboard/purchase` - Saga包购买页面
- `/dashboard/purchase/success` - 购买成功页面

### 2. 项目主页/故事流 (部分缺失)
- `/dashboard/projects/[id]/feed` - 项目故事流 (当前的[id]页面需要重构)
- `/dashboard/projects/[id]/settings` - 项目设置/成员管理

### 3. 故事详情页 (需要重构)
- `/dashboard/stories/[id]` - 故事详情页 (需要按MVP规范重构)
- `/dashboard/stories/[id]/edit` - 转录编辑页面

### 4. 成员管理 (缺失)
- `/dashboard/projects/[id]/members` - 成员管理页面
- `/dashboard/projects/[id]/invite/facilitator` - 邀请协作者
- `/dashboard/projects/[id]/invite/storyteller` - 邀请讲述者

### 5. 数据导出 (部分存在但可能不符合规范)
- `/dashboard/projects/[id]/export` - 项目导出页面 (需要检查是否符合规范)

## 🎯 优先级修复计划

### 高优先级 (核心功能)
1. **资源钱包页面** - 用户需要看到可用的seats
2. **Saga包购买页面** - 核心商业模式
3. **项目故事流重构** - 主要交互界面
4. **成员管理页面** - 邀请和管理功能

### 中优先级 (用户体验)
1. **故事详情页重构** - 按MVP规范优化
2. **项目设置页面** - 项目管理功能
3. **转录编辑页面** - 内容编辑功能

### 低优先级 (完善功能)
1. **购买成功页面** - 用户反馈
2. **导出页面优化** - 数据管理

## 📐 设计规范要求

根据MVP文档，每个页面应该包含：

### 资源钱包摘要组件
```
显示内容: "Seats available: 1 Project, 0 Facilitator, 1 Storyteller"
交互: 点击跳转到完整资源管理页面
```

### 项目卡片组件
```
- 项目标题
- 讲述者头像/姓名
- 协作者头像
- 状态徽章 ("Active", "1 New Story!", "Invite Sent", "Invite Expired")
- 点击跳转到项目故事流
```

### 故事卡片组件
```
- AI建议的标题
- 时间戳和讲述者姓名
- 嵌入式音频播放器
- 转录片段
- 照片缩略图
- 交互摘要 ("💬 3 Comments ❓ 1 Follow-up")
```

## 🚀 实施建议

1. **先修复404问题** - 确保现有页面正常工作
2. **创建缺失的核心页面** - 资源管理和购买流程
3. **重构现有页面** - 使其符合MVP设计规范
4. **添加缺失的组件** - 按照文档规范实现UI组件
5. **测试完整用户流程** - 确保从注册到使用的完整体验

## 📝 下一步行动

1. 创建资源钱包相关页面
2. 创建Saga包购买流程
3. 重构项目详情页为故事流页面
4. 添加成员管理功能
5. 优化故事详情页面
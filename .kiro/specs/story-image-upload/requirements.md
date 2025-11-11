# 需求文档：故事图片上传功能

## 简介

本功能为故事系统添加图片上传和管理能力，允许 storyteller 在录制故事时上传图片作为补充，facilitator 和 storyteller 可以在评论中上传图片，storyteller 可以从评论中选择图片添加到故事。图片将存储在 Supabase Storage 中，并与故事片段或评论关联。

## 术语表

- **System**: 故事图片管理系统
- **Storyteller**: 故事讲述者，可以录制故事、上传图片、编辑故事内容
- **Facilitator**: 协调者，可以查看故事、发表评论、上传评论图片
- **Story**: 故事，包含多个故事片段
- **Story Transcript**: 故事片段，包括原始录音和后续 followup 录音
- **Comment**: 评论，facilitator 或 storyteller 对故事的反馈
- **Transcript Image**: 故事片段图片，与特定故事片段关联的图片
- **Comment Image**: 评论图片，附加在评论中的图片
- **Comment-Sourced Image**: 评论补充图片，从评论中选择并添加到故事的图片
- **Primary Image**: 主图片，在故事列表中显示的缩略图
- **Image Gallery**: 图片相册，展示故事所有图片的区域
- **Supabase Storage**: 图片存储服务
- **Recording Interface**: 录制界面，storyteller 录制故事的页面
- **Story Detail Page**: 故事详情页面，展示故事完整信息的页面
- **Edit Modal**: 编辑弹窗，用于编辑故事片段文本和管理图片

## 需求

### 需求 1：故事片段图片上传

**用户故事**：作为 storyteller，我希望在录制故事时上传图片作为补充，以便更好地表达故事内容

#### 验收标准

1. WHEN Storyteller 完成录音并进入审核阶段，THE System SHALL 显示图片上传区域
2. WHEN Storyteller 点击上传图片按钮，THE System SHALL 打开文件选择对话框
3. WHEN Storyteller 选择图片文件，THE System SHALL 验证文件格式为 JPG、JPEG、PNG、GIF 或 WEBP
4. WHEN Storyteller 选择图片文件，THE System SHALL 验证文件大小不超过 10MB
5. IF 文件格式不支持或文件大小超过限制，THEN THE System SHALL 显示错误提示并拒绝上传
6. WHEN 图片验证通过，THE System SHALL 显示图片预览
7. WHILE 故事片段已有图片数量少于 6 张，THE System SHALL 允许继续上传图片
8. WHEN 故事片段已有 6 张图片，THE System SHALL 禁用上传按钮并显示数量限制提示
9. WHEN Storyteller 取消录音，THE System SHALL 删除已上传的图片
10. WHEN Storyteller 完成录音并提交，THE System SHALL 将图片上传到 Supabase Storage 并关联到该故事片段

### 需求 2：评论图片上传

**用户故事**：作为 facilitator 或 storyteller，我希望在发表评论时上传图片，以便提供视觉补充信息

#### 验收标准

1. WHEN Facilitator 或 Storyteller 在评论输入区域，THE System SHALL 显示图片上传按钮
2. WHEN 用户点击图片上传按钮，THE System SHALL 打开文件选择对话框
3. WHEN 用户选择图片文件，THE System SHALL 验证文件格式为 JPG、JPEG、PNG、GIF 或 WEBP
4. WHEN 用户选择图片文件，THE System SHALL 验证文件大小不超过 10MB
5. IF 文件格式不支持或文件大小超过限制，THEN THE System SHALL 显示错误提示并拒绝上传
6. WHEN 图片验证通过，THE System SHALL 在评论输入区域显示图片预览
7. WHILE 评论已有图片数量少于 6 张，THE System SHALL 允许继续上传图片
8. WHEN 评论已有 6 张图片，THE System SHALL 禁用上传按钮并显示数量限制提示
9. WHEN 用户提交评论，THE System SHALL 将图片上传到 Supabase Storage 并关联到该评论
10. WHEN 评论发布成功，THE System SHALL 在评论中立即显示上传的图片

### 需求 3：评论图片选择添加到故事

**用户故事**：作为 storyteller，我希望从评论中选择图片添加到故事，以便丰富故事内容

#### 验收标准

1. WHEN Storyteller 查看包含图片的评论，THE System SHALL 在每张图片上显示选择框
2. WHEN Storyteller 点击选择框，THE System SHALL 标记该图片为已选择状态
3. WHEN Storyteller 选择一张或多张图片，THE System SHALL 显示"添加到故事"按钮
4. WHEN Storyteller 点击"添加到故事"按钮，THE System SHALL 将选中的图片复制到故事的评论补充图片区域
5. WHEN 图片添加成功，THE System SHALL 保持原评论中的图片不变
6. WHEN 图片添加成功，THE System SHALL 标记这些图片来源为"评论补充"
7. WHEN 故事总图片数量（包括所有片段图片和评论补充图片）达到合理上限，THE System SHALL 禁用添加功能并提示用户
8. WHEN 图片添加失败，THE System SHALL 显示错误提示并保持原有状态

### 需求 4：故事图片相册展示

**用户故事**：作为用户，我希望在故事详情页面看到所有图片的相册视图，以便浏览故事的所有视觉内容

#### 验收标准

1. WHEN 用户打开故事详情页面，THE System SHALL 显示图片相册区域
2. WHEN 故事包含图片，THE System SHALL 在相册中展示所有图片
3. WHEN 展示图片，THE System SHALL 显示每张图片的来源标签（片段序号或"评论补充"）
4. WHEN 用户点击图片，THE System SHALL 以大图模式展示该图片
5. WHEN 故事有多张图片，THE System SHALL 提供左右导航按钮切换图片
6. WHEN 故事有主图片设置，THE System SHALL 在相册中标记主图片
7. WHEN 故事没有图片，THE System SHALL 隐藏图片相册区域
8. WHEN 用户切换故事片段，THE System SHALL 高亮显示该片段关联的图片

### 需求 5：故事片段图片编辑

**用户故事**：作为 storyteller，我希望编辑故事片段时可以管理图片，以便调整图片内容和顺序

#### 验收标准

1. WHEN Storyteller 点击编辑故事片段按钮，THE System SHALL 打开编辑弹窗
2. WHEN 编辑弹窗打开，THE System SHALL 显示当前片段的文本和图片
3. WHEN Storyteller 在编辑弹窗中，THE System SHALL 允许上传新图片
4. WHILE 片段图片数量少于 6 张，THE System SHALL 允许继续上传
5. WHEN Storyteller 点击图片删除按钮，THE System SHALL 从片段中移除该图片
6. WHEN Storyteller 拖拽图片，THE System SHALL 允许重新排序图片
7. WHEN Storyteller 保存编辑，THE System SHALL 更新片段文本和图片信息
8. WHEN Storyteller 取消编辑，THE System SHALL 放弃所有更改并关闭弹窗
9. WHEN 删除图片后保存，THE System SHALL 从 Supabase Storage 中删除该图片文件

### 需求 6：主图片设置

**用户故事**：作为 storyteller，我希望设置故事的主图片，以便在故事列表中显示合适的缩略图

#### 验收标准

1. WHEN Storyteller 在图片相册中查看图片，THE System SHALL 在每张图片上显示"设为主图片"按钮
2. WHEN Storyteller 点击"设为主图片"按钮，THE System SHALL 将该图片标记为主图片
3. WHEN 设置新的主图片，THE System SHALL 取消之前的主图片标记
4. WHEN 故事有主图片，THE System SHALL 在故事列表中显示该图片作为缩略图
5. WHEN 故事没有设置主图片但有图片，THE System SHALL 在故事列表中显示第一张图片作为缩略图
6. WHEN 故事没有任何图片，THE System SHALL 在故事列表中显示默认占位图
7. WHEN 主图片被删除，THE System SHALL 自动选择下一张图片作为主图片

### 需求 7：图片存储和访问控制

**用户故事**：作为系统管理员，我希望图片安全存储并有适当的访问控制，以便保护用户隐私

#### 验收标准

1. WHEN 图片上传成功，THE System SHALL 将图片存储在 Supabase Storage 的专用 bucket 中
2. WHEN 存储图片，THE System SHALL 使用唯一的文件名避免冲突
3. WHEN 存储图片，THE System SHALL 记录图片的元数据（文件大小、格式、上传时间、上传者）
4. WHEN 用户请求访问图片，THE System SHALL 验证用户是否为项目成员
5. IF 用户不是项目成员，THEN THE System SHALL 拒绝访问并返回 403 错误
6. WHEN 故事或评论被删除，THE System SHALL 同时删除关联的图片文件
7. WHEN 图片上传失败，THE System SHALL 清理临时文件并释放存储空间
8. WHEN 生成图片 URL，THE System SHALL 使用带有效期的签名 URL 确保安全访问

### 需求 8：图片加载和性能优化

**用户故事**：作为用户，我希望图片快速加载，以便流畅浏览故事内容

#### 验收标准

1. WHEN 显示图片列表，THE System SHALL 使用缩略图而非原图
2. WHEN 用户点击查看大图，THE System SHALL 加载原始尺寸图片
3. WHEN 图片加载中，THE System SHALL 显示加载指示器
4. IF 图片加载失败，THEN THE System SHALL 显示错误占位图和重试按钮
5. WHEN 图片加载超时（超过 10 秒），THE System SHALL 显示超时提示
6. WHEN 上传图片，THE System SHALL 显示上传进度条
7. WHEN 批量上传图片，THE System SHALL 并行处理提高效率
8. WHEN 图片尺寸过大，THE System SHALL 在客户端进行压缩后再上传

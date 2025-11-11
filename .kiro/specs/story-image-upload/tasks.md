# 实施计划：故事图片上传功能

- [x] 1. 数据库迁移和类型定义
  - 创建数据库迁移脚本，定义 story_images 和 interaction_images 表结构
  - 更新 TypeScript 类型定义文件
  - _需求: 1.1, 1.10, 2.9, 7.1, 7.2, 7.3_

- [x] 1.1 创建数据库迁移脚本
  - 在 `supabase/migrations/` 创建新的迁移文件
  - 定义 `story_images` 表，包含所有字段、约束和索引
  - 定义 `interaction_images` 表，包含所有字段、约束和索引
  - 创建 RLS 策略确保访问控制
  - 添加表和列的注释说明
  - _需求: 7.1, 7.2, 7.3, 7.4_

- [x] 1.2 更新 TypeScript 类型定义
  - 在 `packages/shared/src/types/` 创建 `image.ts` 文件
  - 定义 `StoryImage` 接口
  - 定义 `InteractionImage` 接口
  - 定义图片上传、排序、设置主图片的请求/响应接口
  - 更新 `packages/web/src/types/supabase.ts` 添加新表类型
  - _需求: 1.1, 2.9, 7.2_

- [x] 2. 实现图片上传和存储服务
  - 创建图片上传工具函数
  - 实现 Supabase Storage 集成
  - 实现图片压缩和验证逻辑
  - _需求: 1.3, 1.4, 1.5, 2.3, 2.4, 2.5, 7.1, 8.8_

- [x] 2.1 创建图片验证工具
  - 在 `packages/web/src/lib/` 创建 `image-utils.ts`
  - 实现文件格式验证函数（支持 JPG, JPEG, PNG, GIF, WEBP）
  - 实现文件大小验证函数（最大 10MB）
  - 实现图片尺寸获取函数
  - 实现文件头验证（magic bytes）确保安全
  - _需求: 1.3, 1.4, 1.5, 2.3, 2.4, 2.5, 7.1_

- [x] 2.2 实现图片压缩功能
  - 在 `image-utils.ts` 添加图片压缩函数
  - 使用 Canvas API 压缩大于 2MB 的图片
  - 保持图片宽高比
  - 支持 JPEG 质量调整
  - _需求: 8.8_

- [x] 2.3 创建 Supabase Storage 服务
  - 在 `packages/web/src/lib/` 创建 `storage-service.ts`
  - 实现图片上传到 Supabase Storage 的函数
  - 实现生成签名 URL 的函数（24 小时有效期）
  - 实现删除存储文件的函数
  - 实现文件路径生成逻辑（按设计文档的命名规则）
  - _需求: 1.10, 2.9, 7.1, 7.8_

- [x] 3. 实现故事片段图片 API
  - 创建故事片段图片上传 API
  - 创建故事片段图片查询 API
  - 实现权限验证
  - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

- [x] 3.1 创建故事片段图片上传 API
  - 创建 `packages/web/src/app/api/stories/[storyId]/transcripts/[transcriptId]/images/route.ts`
  - 实现 POST 端点处理 multipart/form-data
  - 验证用户是否为 storyteller
  - 验证图片数量限制（最多 6 张）
  - 调用图片验证和压缩函数
  - 上传到 Supabase Storage
  - 创建数据库记录
  - 返回图片信息和签名 URL
  - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.10_

- [x] 3.2 创建故事图片查询 API
  - 创建 `packages/web/src/app/api/stories/[storyId]/images/route.ts`
  - 实现 GET 端点查询故事所有图片
  - 验证用户是否为项目成员
  - 按 order_index 排序返回
  - 为每张图片生成签名 URL
  - _需求: 4.1, 4.2, 7.4_

- [x] 4. 实现故事图片管理 API
  - 创建图片删除 API
  - 创建图片排序 API
  - 创建设置主图片 API
  - _需求: 5.5, 5.6, 5.9, 6.1, 6.2, 6.3, 6.4, 6.7_

- [x] 4.1 实现图片删除 API
  - 在 `packages/web/src/app/api/stories/[storyId]/images/[imageId]/route.ts` 实现 DELETE 端点
  - 验证用户是否为 storyteller
  - 从数据库删除记录
  - 从 Supabase Storage 删除文件
  - 如果删除的是主图片，自动设置下一张为主图片
  - _需求: 5.5, 5.9, 6.7, 7.6_

- [x] 4.2 实现图片排序 API
  - 在 `packages/web/src/app/api/stories/[storyId]/images/reorder/route.ts` 实现 PATCH 端点
  - 验证用户是否为 storyteller
  - 接收图片 ID 数组
  - 批量更新 order_index
  - _需求: 5.6_

- [x] 4.3 实现设置主图片 API
  - 在 `packages/web/src/app/api/stories/[storyId]/images/[imageId]/set-primary/route.ts` 实现 PATCH 端点
  - 验证用户是否为 storyteller
  - 取消之前的主图片标记
  - 设置新的主图片
  - _需求: 6.1, 6.2, 6.3_

- [x] 5. 实现评论图片 API
  - 创建评论图片上传 API
  - 创建评论图片删除 API
  - 创建从评论复制图片到故事的 API
  - _需求: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 5.1 创建评论图片上传 API
  - 创建 `packages/web/src/app/api/interactions/[interactionId]/images/route.ts`
  - 实现 POST 端点处理 multipart/form-data
  - 验证用户是否为项目成员
  - 验证图片数量限制（最多 6 张）
  - 调用图片验证和压缩函数
  - 上传到 Supabase Storage
  - 创建数据库记录
  - 返回图片信息和签名 URL
  - _需求: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

- [x] 5.2 创建评论图片删除 API
  - 在 `packages/web/src/app/api/interactions/[interactionId]/images/[imageId]/route.ts` 实现 DELETE 端点
  - 验证用户是否为图片上传者
  - 从数据库删除记录
  - 从 Supabase Storage 删除文件
  - _需求: 2.10_

- [x] 5.3 实现从评论复制图片到故事 API
  - 在 `packages/web/src/app/api/stories/[storyId]/images/route.ts` 添加 POST 端点
  - 接收评论图片 ID 数组
  - 验证用户是否为 storyteller
  - 复制 Storage 中的图片文件到故事目录
  - 创建新的 story_images 记录，标记 source_type 为 'comment'
  - 记录 source_interaction_id
  - 返回新创建的图片记录
  - _需求: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 6. 创建通用图片上传组件
  - 实现 ImageUploader 组件
  - 支持拖拽上传
  - 显示预览和进度
  - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [x] 6.1 创建 ImageUploader 组件
  - 在 `packages/web/src/components/images/` 创建 `ImageUploader.tsx`
  - 实现文件选择按钮
  - 实现拖拽区域
  - 实现客户端验证（格式、大小、数量）
  - 显示验证错误提示
  - 显示图片预览网格
  - 显示上传进度条
  - 支持删除预览图片
  - 调用图片压缩函数
  - 支持禁用状态
  - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [x] 7. 创建图片展示组件
  - 实现 ImageGallery 组件
  - 实现 ImageLightbox 组件
  - 支持图片查看和导航
  - _需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [x] 7.1 创建 ImageGallery 组件
  - 在 `packages/web/src/components/images/` 创建 `ImageGallery.tsx`
  - 实现网格布局展示图片
  - 显示图片来源标签（片段序号或"评论补充"）
  - 高亮当前片段的图片
  - 标记主图片
  - 点击图片打开 lightbox
  - 编辑模式：显示删除按钮、设置主图片按钮
  - 编辑模式：支持拖拽排序（使用 dnd-kit 或类似库）
  - 空状态提示
  - _需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [x] 7.2 创建 ImageLightbox 组件
  - 在 `packages/web/src/components/images/` 创建 `ImageLightbox.tsx`
  - 实现全屏遮罩层
  - 显示当前图片
  - 左右导航按钮
  - 支持键盘快捷键（ESC 关闭，方向键导航）
  - 显示图片序号（如 "3 / 10"）
  - 关闭按钮
  - 支持缩放功能（可选）
  - _需求: 4.4, 4.5_

- [x] 8. 创建评论图片选择组件
  - 实现 CommentImageSelector 组件
  - 支持多选和批量添加
  - _需求: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 8.1 创建 CommentImageSelector 组件
  - 在 `packages/web/src/components/images/` 创建 `CommentImageSelector.tsx`
  - 显示评论图片网格
  - 每张图片显示选择框
  - 支持多选
  - 显示已选择数量
  - "添加到故事"按钮
  - 调用复制图片 API
  - 显示加载和成功状态
  - _需求: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 9. 集成图片上传到录制界面
  - 更新 RecordingInterface 组件
  - 在审核阶段添加图片上传
  - 处理录音取消时的图片清理
  - _需求: 1.1, 1.2, 1.6, 1.7, 1.8, 1.9, 1.10_

- [x] 9.1 更新 RecordingInterface 组件
  - 修改 `packages/web/src/components/recording/recording-interface.tsx`
  - 在审核阶段（reviewing state）添加 ImageUploader 组件
  - 管理上传的图片状态
  - 在提交录音时一起上传图片
  - 在取消录音时删除已上传的图片
  - 更新 UI 布局适配图片上传区域
  - _需求: 1.1, 1.2, 1.6, 1.7, 1.8, 1.9, 1.10_

- [x] 10. 创建故事片段编辑弹窗
  - 实现 TranscriptEditModal 组件
  - 支持编辑文本和管理图片
  - _需求: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

- [x] 10.1 创建 TranscriptEditModal 组件
  - 在 `packages/web/src/components/stories/` 创建 `TranscriptEditModal.tsx`
  - 实现弹窗布局（使用 Dialog 组件）
  - 显示文本编辑区域（Textarea）
  - 集成 ImageUploader 组件用于上传新图片
  - 显示当前图片列表，支持删除
  - 支持拖拽排序图片
  - 保存按钮调用更新 API
  - 取消按钮放弃更改
  - _需求: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

- [x] 11. 集成图片功能到故事详情页
  - 更新 StoryDetailPage 组件
  - 添加图片相册展示
  - 添加评论图片选择功能
  - 集成编辑弹窗
  - _需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 11.1 更新 StoryDetailPage 组件添加图片相册
  - 修改 `packages/web/src/components/stories/story-detail-page.tsx`
  - 在页面加载时获取故事图片
  - 在主内容区域添加 ImageGallery 组件
  - 传递当前活动的 transcript_id 用于高亮
  - 处理图片点击打开 lightbox
  - 处理设置主图片、删除图片、排序图片的操作
  - _需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 11.2 添加编辑故事片段功能
  - 在 StoryDetailPage 添加"编辑"按钮
  - 点击打开 TranscriptEditModal
  - 传递当前片段数据和图片
  - 处理保存后的数据更新
  - _需求: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

- [x] 11.3 集成评论图片选择功能
  - 在评论区域显示评论图片
  - 为 storyteller 显示 CommentImageSelector
  - 处理从评论添加图片到故事
  - 刷新图片相册显示新添加的图片
  - _需求: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 12. 更新评论组件支持图片上传
  - 修改评论输入区域
  - 添加图片上传功能
  - 显示评论中的图片
  - _需求: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

- [x] 12.1 更新评论组件
  - 修改 StoryDetailPage 中的评论输入区域
  - 添加图片上传按钮
  - 集成 ImageUploader 组件（限制 6 张）
  - 在提交评论时一起上传图片
  - 在评论列表中显示图片
  - 为图片上传者显示删除按钮
  - _需求: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

- [x] 13. 更新故事列表显示主图片
  - 修改故事列表组件
  - 显示主图片作为缩略图
  - 处理无图片的情况
  - _需求: 6.4, 6.5, 6.6_

- [x] 13.1 更新故事列表组件
  - 修改故事列表相关组件
  - 在查询故事时包含主图片信息
  - 显示主图片作为缩略图
  - 如果没有主图片但有其他图片，显示第一张
  - 如果没有任何图片，显示默认占位图
  - 使用 Next.js Image 组件优化加载
  - _需求: 6.4, 6.5, 6.6_

- [x] 14. 添加国际化翻译
  - 添加所有图片相关的翻译键
  - 支持多语言
  - _需求: 所有需求_

- [x] 14.1 添加英文翻译
  - 在 `packages/web/public/locales/en/` 创建或更新 `images.json`
  - 添加所有图片相关的翻译键
  - 包括上传提示、错误消息、按钮文本等
  - _需求: 所有需求_

- [x] 14.2 添加中文翻译
  - 在 `packages/web/public/locales/zh-CN/` 创建或更新 `images.json`
  - 翻译所有图片相关的文本
  - _需求: 所有需求_

- [x] 14.3 添加其他语言翻译
  - 在其他语言目录添加翻译文件
  - 确保所有支持的语言都有完整翻译
  - _需求: 所有需求_

- [x] 15. 实现图片加载优化
  - 添加懒加载
  - 实现响应式图片
  - 添加加载状态
  - _需求: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 15.1 优化图片加载性能
  - 使用 Next.js Image 组件的优化特性
  - 实现懒加载非首屏图片
  - 添加图片加载占位符
  - 实现加载失败的错误处理和重试
  - 预加载相邻图片提升体验
  - 添加加载超时处理（10 秒）
  - _需求: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 16. 添加错误处理和用户反馈
  - 实现全面的错误处理
  - 添加友好的错误提示
  - 添加成功反馈
  - _需求: 1.5, 2.5, 3.8, 8.4, 8.5_

- [x] 16.1 实现错误处理机制
  - 在所有 API 调用中添加 try-catch
  - 显示友好的错误提示（使用 toast 或 alert）
  - 区分不同类型的错误（网络错误、权限错误、验证错误）
  - 提供重试选项
  - 记录错误日志用于调试
  - _需求: 1.5, 2.5, 3.8, 8.4, 8.5_

- [x] 16.2 添加用户反馈
  - 上传成功后显示成功提示
  - 删除、排序、设置主图片后显示确认
  - 操作进行中显示加载状态
  - 使用乐观更新提升体验
  - _需求: 所有需求_

- [x] 17. 编写测试
  - 编写组件单元测试
  - 编写 API 集成测试
  - 编写 E2E 测试
  - _需求: 所有需求_

- [x] 17.1 编写组件单元测试
  - 测试 ImageUploader 组件的验证逻辑
  - 测试 ImageGallery 组件的渲染和交互
  - 测试 ImageLightbox 组件的导航
  - 测试 CommentImageSelector 组件的选择逻辑
  - 测试 TranscriptEditModal 组件的保存和取消
  - _需求: 所有需求_

- [x] 17.2 编写 API 集成测试
  - 测试图片上传 API 的完整流程
  - 测试权限控制（RLS 策略）
  - 测试图片删除的级联清理
  - 测试从评论复制图片的逻辑
  - 测试图片排序和设置主图片
  - _需求: 所有需求_

- [x] 17.3 编写 E2E 测试
  - 测试录制时上传图片的完整流程
  - 测试评论上传图片的流程
  - 测试从评论选择图片添加到故事
  - 测试编辑故事片段管理图片
  - 测试图片相册的查看和导航
  - 测试设置主图片和在列表中显示
  - _需求: 所有需求_

- [x] 18. 文档和代码审查
  - 更新 API 文档
  - 添加代码注释
  - 进行代码审查
  - _需求: 所有需求_

- [x] 18.1 更新文档
  - 更新 README 或开发文档说明新功能
  - 记录 API 端点和使用方法
  - 添加组件使用示例
  - 记录数据库表结构变更
  - _需求: 所有需求_

- [x] 18.2 代码审查和优化
  - 审查所有新增代码
  - 确保代码符合项目规范
  - 优化性能瓶颈
  - 确保安全性
  - 清理调试代码和注释
  - _需求: 所有需求_

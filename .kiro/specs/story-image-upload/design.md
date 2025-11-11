# 设计文档：故事图片上传功能

## 概述

本设计文档描述了故事图片上传功能的技术实现方案。该功能允许用户在故事片段和评论中上传、管理和展示图片，图片存储在 Supabase Storage 中，并通过数据库关联到相应的故事片段或评论。

### 核心目标

1. 为故事片段（原始录音和 followup 录音）添加图片上传功能
2. 为评论添加图片上传功能
3. 允许 storyteller 从评论中选择图片添加到故事
4. 提供图片相册视图和管理功能
5. 支持主图片设置用于故事列表缩略图
6. 确保图片安全存储和访问控制

### 技术栈

- **前端**: Next.js 14, React, TypeScript, TailwindCSS
- **后端**: Next.js API Routes
- **数据库**: Supabase PostgreSQL
- **存储**: Supabase Storage
- **图片处理**: Browser-native APIs (Canvas API for compression)

## 架构设计

### 系统架构图

```mermaid
graph TB
    subgraph "客户端层"
        A[录制界面] --> B[图片上传组件]
        C[故事详情页] --> D[图片相册组件]
        C --> E[评论组件]
        E --> F[评论图片上传]
        D --> G[图片编辑弹窗]
    end
    
    subgraph "API 层"
        H[/api/stories/:id/images]
        I[/api/stories/:id/transcripts/:tid/images]
        J[/api/interactions/:id/images]
        K[/api/stories/:id/images/reorder]
        L[/api/stories/:id/images/set-primary]
    end
    
    subgraph "数据层"
        M[(story_images 表)]
        N[(interaction_images 表)]
        O[Supabase Storage]
    end
    
    B --> I
    F --> J
    D --> H
    G --> K
    G --> L
    
    H --> M
    I --> M
    J --> N
    K --> M
    L --> M
    
    H --> O
    I --> O
    J --> O
```

### 数据流

1. **上传流程**:
   - 用户选择图片 → 客户端验证 → 压缩处理 → 上传到 API → 存储到 Supabase Storage → 创建数据库记录

2. **查看流程**:
   - 请求故事详情 → API 查询图片记录 → 生成签名 URL → 返回给客户端 → 渲染图片

3. **从评论添加流程**:
   - 选择评论图片 → 调用复制 API → 复制图片文件 → 创建新的故事图片记录 → 标记来源

## 数据模型

### 数据库表设计

#### 1. story_images 表

存储故事图片信息，包括故事片段图片和从评论添加的图片。

```sql
CREATE TABLE story_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  transcript_id UUID REFERENCES story_transcripts(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN DEFAULT FALSE,
  source_type TEXT NOT NULL CHECK (source_type IN ('transcript', 'comment')),
  source_interaction_id UUID REFERENCES interactions(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_story_primary UNIQUE (story_id, is_primary) WHERE is_primary = TRUE
);

-- 索引
CREATE INDEX idx_story_images_story_id ON story_images(story_id);
CREATE INDEX idx_story_images_transcript_id ON story_images(transcript_id);
CREATE INDEX idx_story_images_source ON story_images(source_type, source_interaction_id);
CREATE INDEX idx_story_images_order ON story_images(story_id, order_index);

-- RLS 策略
ALTER TABLE story_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view images of stories in their projects"
  ON story_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stories s
      JOIN project_members pm ON pm.project_id = s.project_id
      WHERE s.id = story_images.story_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Storytellers can insert images for their stories"
  ON story_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id = story_images.story_id
      AND s.storyteller_id = auth.uid()
    )
  );

CREATE POLICY "Storytellers can update images for their stories"
  ON story_images FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id = story_images.story_id
      AND s.storyteller_id = auth.uid()
    )
  );

CREATE POLICY "Storytellers can delete images for their stories"
  ON story_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id = story_images.story_id
      AND s.storyteller_id = auth.uid()
    )
  );
```

#### 2. interaction_images 表

存储评论图片信息。

```sql
CREATE TABLE interaction_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  interaction_id UUID NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  order_index INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_interaction_images_interaction_id ON interaction_images(interaction_id);
CREATE INDEX idx_interaction_images_order ON interaction_images(interaction_id, order_index);

-- RLS 策略
ALTER TABLE interaction_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view images of interactions in their projects"
  ON interaction_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM interactions i
      JOIN stories s ON s.id = i.story_id
      JOIN project_members pm ON pm.project_id = s.project_id
      WHERE i.id = interaction_images.interaction_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Project members can insert images for interactions"
  ON interaction_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM interactions i
      JOIN stories s ON s.id = i.story_id
      JOIN project_members pm ON pm.project_id = s.project_id
      WHERE i.id = interaction_images.interaction_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own interaction images"
  ON interaction_images FOR UPDATE
  USING (uploaded_by = auth.uid());

CREATE POLICY "Users can delete their own interaction images"
  ON interaction_images FOR DELETE
  USING (uploaded_by = auth.uid());
```

### TypeScript 类型定义

```typescript
// packages/shared/src/types/image.ts

export interface StoryImage {
  id: string
  story_id: string
  transcript_id: string | null
  storage_path: string
  file_name: string
  file_size: number
  mime_type: string
  width: number | null
  height: number | null
  order_index: number
  is_primary: boolean
  source_type: 'transcript' | 'comment'
  source_interaction_id: string | null
  uploaded_by: string
  created_at: Date
  updated_at: Date
  url?: string // 临时签名 URL，由 API 生成
}

export interface InteractionImage {
  id: string
  interaction_id: string
  storage_path: string
  file_name: string
  file_size: number
  mime_type: string
  width: number | null
  height: number | null
  order_index: number
  uploaded_by: string
  created_at: Date
  updated_at: Date
  url?: string // 临时签名 URL，由 API 生成
}

export interface ImageUploadRequest {
  file: File
  transcript_id?: string
  interaction_id?: string
}

export interface ImageUploadResponse {
  image: StoryImage | InteractionImage
  url: string
}

export interface ImageReorderRequest {
  image_ids: string[] // 按新顺序排列的图片 ID 数组
}

export interface SetPrimaryImageRequest {
  image_id: string
}

export interface CopyImagesFromCommentRequest {
  interaction_image_ids: string[] // 要复制的评论图片 ID 数组
}
```

## 组件设计

### 1. ImageUploader 组件

通用图片上传组件，支持拖拽、预览、验证。

```typescript
interface ImageUploaderProps {
  maxImages?: number // 最大图片数量，默认 6
  maxSizeMB?: number // 最大文件大小（MB），默认 10
  acceptedFormats?: string[] // 接受的格式，默认 ['jpg', 'jpeg', 'png', 'gif', 'webp']
  images: Array<{ id: string; url: string; file?: File }>
  onImagesChange: (images: Array<{ id: string; url: string; file?: File }>) => void
  onUpload?: (files: File[]) => Promise<void>
  disabled?: boolean
  showPreview?: boolean
}
```

**功能**:
- 文件选择和拖拽上传
- 客户端验证（格式、大小）
- 图片预览
- 删除图片
- 显示上传进度

### 2. ImageGallery 组件

图片相册组件，展示故事的所有图片。

```typescript
interface ImageGalleryProps {
  storyId: string
  images: StoryImage[]
  activeTranscriptId?: string | null
  canEdit?: boolean
  onImageClick?: (image: StoryImage, index: number) => void
  onSetPrimary?: (imageId: string) => Promise<void>
  onDelete?: (imageId: string) => Promise<void>
  onReorder?: (imageIds: string[]) => Promise<void>
}
```

**功能**:
- 网格布局展示图片
- 按来源分组（片段序号、评论补充）
- 高亮当前片段的图片
- 主图片标记
- 点击放大查看
- 编辑模式：拖拽排序、删除、设置主图片

### 3. ImageLightbox 组件

图片灯箱组件，全屏查看图片。

```typescript
interface ImageLightboxProps {
  images: Array<{ id: string; url: string; caption?: string }>
  initialIndex: number
  isOpen: boolean
  onClose: () => void
  onNavigate?: (index: number) => void
}
```

**功能**:
- 全屏展示
- 左右导航
- 缩放功能
- 键盘快捷键（ESC 关闭，方向键导航）

### 4. CommentImageSelector 组件

评论图片选择器，用于从评论中选择图片添加到故事。

```typescript
interface CommentImageSelectorProps {
  interactionImages: InteractionImage[]
  onSelect: (imageIds: string[]) => Promise<void>
  disabled?: boolean
}
```

**功能**:
- 多选图片
- 显示选中状态
- 批量添加到故事

### 5. TranscriptEditModal 组件

故事片段编辑弹窗，支持编辑文本和管理图片。

```typescript
interface TranscriptEditModalProps {
  isOpen: boolean
  transcript: StoryTranscript
  images: StoryImage[]
  onClose: () => void
  onSave: (data: { transcript: string; images: StoryImage[] }) => Promise<void>
}
```

**功能**:
- 编辑文本内容
- 上传新图片
- 删除图片
- 拖拽排序图片
- 保存或取消

## API 设计

### 1. 故事图片 API

#### GET /api/stories/:storyId/images

获取故事的所有图片。

**响应**:
```json
{
  "images": [
    {
      "id": "uuid",
      "story_id": "uuid",
      "transcript_id": "uuid",
      "file_name": "image.jpg",
      "file_size": 1024000,
      "mime_type": "image/jpeg",
      "width": 1920,
      "height": 1080,
      "order_index": 0,
      "is_primary": true,
      "source_type": "transcript",
      "source_interaction_id": null,
      "url": "https://...",
      "created_at": "2025-01-10T00:00:00Z"
    }
  ]
}
```

#### POST /api/stories/:storyId/images

上传故事图片（用于从评论复制）。

**请求体**:
```json
{
  "interaction_image_ids": ["uuid1", "uuid2"]
}
```

**响应**:
```json
{
  "images": [...]
}
```

#### DELETE /api/stories/:storyId/images/:imageId

删除故事图片。

**响应**:
```json
{
  "success": true
}
```

#### PATCH /api/stories/:storyId/images/reorder

重新排序图片。

**请求体**:
```json
{
  "image_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**响应**:
```json
{
  "success": true
}
```

#### PATCH /api/stories/:storyId/images/:imageId/set-primary

设置主图片。

**响应**:
```json
{
  "success": true
}
```

### 2. 故事片段图片 API

#### POST /api/stories/:storyId/transcripts/:transcriptId/images

上传故事片段图片。

**请求**: multipart/form-data
- `file`: 图片文件

**响应**:
```json
{
  "image": {
    "id": "uuid",
    "url": "https://..."
  }
}
```

### 3. 评论图片 API

#### POST /api/interactions/:interactionId/images

上传评论图片。

**请求**: multipart/form-data
- `file`: 图片文件

**响应**:
```json
{
  "image": {
    "id": "uuid",
    "url": "https://..."
  }
}
```

#### DELETE /api/interactions/:interactionId/images/:imageId

删除评论图片。

**响应**:
```json
{
  "success": true
}
```

## 存储策略

### Supabase Storage 结构

```
saga (bucket)
├── stories/
│   ├── {story_id}/
│   │   ├── images/
│   │   │   ├── transcript-0-{timestamp}-{uuid}.jpg
│   │   │   ├── transcript-1-{timestamp}-{uuid}.jpg
│   │   │   └── comment-{timestamp}-{uuid}.jpg
│   │   └── audio/
│   │       └── ...
└── interactions/
    └── {interaction_id}/
        └── images/
            ├── {timestamp}-{uuid}.jpg
            └── ...
```

### 文件命名规则

- 故事片段图片: `transcript-{sequence_number}-{timestamp}-{uuid}.{ext}`
- 评论补充图片: `comment-{timestamp}-{uuid}.{ext}`
- 评论图片: `{timestamp}-{uuid}.{ext}`

### 存储策略

1. **上传前压缩**: 客户端使用 Canvas API 压缩大于 2MB 的图片
2. **生成缩略图**: 服务端生成 400x400 的缩略图用于列表展示
3. **签名 URL**: 使用 24 小时有效期的签名 URL
4. **清理策略**: 删除记录时同步删除存储文件

## 错误处理

### 客户端错误

1. **文件格式不支持**: 显示友好提示，列出支持的格式
2. **文件过大**: 提示文件大小限制，建议压缩
3. **数量超限**: 禁用上传按钮，显示限制提示
4. **网络错误**: 显示重试按钮，支持断点续传

### 服务端错误

1. **存储失败**: 返回 500 错误，清理临时文件
2. **权限不足**: 返回 403 错误
3. **资源不存在**: 返回 404 错误
4. **数据库错误**: 返回 500 错误，记录日志

## 测试策略

### 单元测试

1. **图片验证逻辑**: 测试格式、大小验证
2. **图片压缩**: 测试压缩算法
3. **URL 生成**: 测试签名 URL 生成

### 集成测试

1. **上传流程**: 测试完整上传流程
2. **权限控制**: 测试 RLS 策略
3. **删除级联**: 测试删除故事时图片的清理

### E2E 测试

1. **录制时上传**: 测试录制界面图片上传
2. **评论上传**: 测试评论图片上传
3. **从评论添加**: 测试选择评论图片添加到故事
4. **图片管理**: 测试编辑、删除、排序、设置主图片

## 性能优化

### 1. 图片加载优化

- 使用 Next.js Image 组件自动优化
- 懒加载非首屏图片
- 使用 WebP 格式（支持的浏览器）
- 响应式图片（根据屏幕尺寸加载不同尺寸）

### 2. 上传优化

- 客户端压缩减少传输大小
- 并行上传多张图片
- 显示上传进度
- 支持取消上传

### 3. 缓存策略

- 浏览器缓存图片 URL
- CDN 缓存（如果使用）
- 预加载相邻图片

### 4. 数据库优化

- 使用索引加速查询
- 批量操作减少数据库往返
- 使用连接查询减少查询次数

## 安全考虑

### 1. 文件验证

- 服务端验证文件类型（不仅依赖 MIME type）
- 检查文件头（magic bytes）
- 限制文件大小
- 扫描恶意内容（如果需要）

### 2. 访问控制

- RLS 策略确保用户只能访问有权限的图片
- 签名 URL 防止未授权访问
- 定期轮换签名密钥

### 3. 存储安全

- 使用 UUID 文件名防止猜测
- 分离存储路径避免遍历攻击
- 定期备份

### 4. 输入验证

- 验证所有用户输入
- 防止 SQL 注入
- 防止 XSS 攻击

## 国际化

### 翻译键

```json
{
  "images": {
    "upload": "上传图片",
    "uploadHint": "点击或拖拽图片到此处",
    "maxImages": "最多 {count} 张图片",
    "maxSize": "单张图片最大 {size}MB",
    "supportedFormats": "支持 JPG, PNG, GIF, WebP 格式",
    "uploading": "上传中...",
    "uploadSuccess": "上传成功",
    "uploadError": "上传失败",
    "delete": "删除",
    "setPrimary": "设为主图片",
    "primary": "主图片",
    "fromTranscript": "来自片段 {number}",
    "fromComment": "评论补充",
    "selectFromComments": "从评论中选择图片",
    "addToStory": "添加到故事",
    "reorder": "重新排序",
    "gallery": "图片相册",
    "noImages": "暂无图片",
    "errors": {
      "invalidFormat": "不支持的图片格式",
      "tooLarge": "图片大小超过限制",
      "tooMany": "图片数量超过限制",
      "uploadFailed": "上传失败，请重试"
    }
  }
}
```

## 迁移计划

### 阶段 1: 数据库迁移

1. 创建 `story_images` 表
2. 创建 `interaction_images` 表
3. 创建索引和 RLS 策略
4. 测试迁移脚本

### 阶段 2: 后端 API

1. 实现图片上传 API
2. 实现图片查询 API
3. 实现图片管理 API（删除、排序、设置主图片）
4. 实现从评论复制图片 API

### 阶段 3: 前端组件

1. 实现 ImageUploader 组件
2. 实现 ImageGallery 组件
3. 实现 ImageLightbox 组件
4. 实现 CommentImageSelector 组件
5. 实现 TranscriptEditModal 组件

### 阶段 4: 集成

1. 集成到录制界面
2. 集成到故事详情页
3. 集成到评论系统
4. 添加国际化翻译

### 阶段 5: 测试和优化

1. 单元测试
2. 集成测试
3. E2E 测试
4. 性能优化
5. 安全审计

## 未来扩展

### 可能的功能增强

1. **图片编辑**: 裁剪、旋转、滤镜
2. **AI 功能**: 自动标签、内容识别、智能推荐
3. **批量操作**: 批量上传、批量删除
4. **相册分享**: 生成分享链接
5. **图片搜索**: 按标签、日期搜索
6. **视频支持**: 扩展到支持短视频

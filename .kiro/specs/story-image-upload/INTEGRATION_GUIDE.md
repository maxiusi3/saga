# 故事图片上传功能 - 集成指南

本指南提供详细的代码示例，说明如何将已实现的图片功能集成到现有页面中。

---

## 任务 11: 集成图片功能到故事详情页

### 11.1 更新 StoryDetailPage 组件添加图片相册

**文件**: `packages/web/src/components/stories/story-detail-page.tsx`

#### 步骤 1: 添加导入

在文件顶部添加：

```typescript
import { ImageGallery } from '@/components/images/ImageGallery'
import { CommentImageSelector } from '@/components/images/CommentImageSelector'
import { TranscriptEditModal } from '@/components/stories/TranscriptEditModal'
import { StoryImage, InteractionImage } from '@saga/shared/types/image'
import { StoryTranscript } from '@saga/shared/types/story'
```

#### 步骤 2: 添加状态管理

在组件内部添加状态：

```typescript
// 图片相关状态
const [storyImages, setStoryImages] = useState<StoryImage[]>([])
const [commentImages, setCommentImages] = useState<InteractionImage[]>([])
const [loadingImages, setLoadingImages] = useState(false)

// 编辑弹窗状态
const [isEditModalOpen, setIsEditModalOpen] = useState(false)
const [editingTranscript, setEditingTranscript] = useState<StoryTranscript | null>(null)
const [transcriptImages, setTranscriptImages] = useState<StoryImage[]>([])
```

#### 步骤 3: 添加获取图片的函数

```typescript
// 获取故事图片
const fetchStoryImages = async () => {
  setLoadingImages(true)
  try {
    const response = await fetch(`/api/stories/${story.id}/images`)
    if (response.ok) {
      const data = await response.json()
      setStoryImages(data.images || [])
    }
  } catch (error) {
    console.error('Error fetching story images:', error)
  } finally {
    setLoadingImages(false)
  }
}

// 获取评论图片
const fetchCommentImages = async () => {
  try {
    // 从所有评论中提取图片
    const allImages: InteractionImage[] = []
    for (const comment of comments) {
      const response = await fetch(`/api/interactions/${comment.id}/images`)
      if (response.ok) {
        const data = await response.json()
        allImages.push(...(data.images || []))
      }
    }
    setCommentImages(allImages)
  } catch (error) {
    console.error('Error fetching comment images:', error)
  }
}

// 组件加载时获取图片
useEffect(() => {
  fetchStoryImages()
  fetchCommentImages()
}, [story.id, comments])
```

#### 步骤 4: 添加图片管理函数

```typescript
// 设置主图片
const handleSetPrimary = async (imageId: string) => {
  try {
    const response = await fetch(`/api/stories/${story.id}/images/${imageId}/set-primary`, {
      method: 'PATCH',
    })
    if (response.ok) {
      await fetchStoryImages() // 刷新图片列表
    }
  } catch (error) {
    console.error('Error setting primary image:', error)
  }
}

// 删除图片
const handleDeleteImage = async (imageId: string) => {
  try {
    const response = await fetch(`/api/stories/${story.id}/images/${imageId}`, {
      method: 'DELETE',
    })
    if (response.ok) {
      await fetchStoryImages() // 刷新图片列表
    }
  } catch (error) {
    console.error('Error deleting image:', error)
  }
}

// 重新排序图片
const handleReorderImages = async (imageIds: string[]) => {
  try {
    const response = await fetch(`/api/stories/${story.id}/images/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_ids: imageIds }),
    })
    if (response.ok) {
      await fetchStoryImages() // 刷新图片列表
    }
  } catch (error) {
    console.error('Error reordering images:', error)
  }
}

// 从评论选择图片
const handleSelectFromComments = async (imageIds: string[]) => {
  try {
    const response = await fetch(`/api/stories/${story.id}/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interaction_image_ids: imageIds }),
    })
    if (response.ok) {
      await fetchStoryImages() // 刷新图片列表
    }
  } catch (error) {
    console.error('Error adding images from comments:', error)
  }
}
```

#### 步骤 5: 在 JSX 中添加图片相册

在主内容区域（音频播放器之后）添加：

```typescript
{/* 图片相册 */}
{storyImages.length > 0 && (
  <Card variant="content">
    <CardHeader>
      <CardTitle>{t('detail.imageGallery')}</CardTitle>
    </CardHeader>
    <CardContent>
      <ImageGallery
        storyId={story.id}
        images={storyImages}
        activeTranscriptId={activeTranscriptIndex > 0 ? transcripts[activeTranscriptIndex - 1]?.id : null}
        canEdit={canEdit}
        onSetPrimary={handleSetPrimary}
        onDelete={handleDeleteImage}
        onReorder={handleReorderImages}
      />
    </CardContent>
  </Card>
)}

{/* 从评论选择图片 */}
{canEdit && userRole === 'storyteller' && commentImages.length > 0 && (
  <CommentImageSelector
    interactionImages={commentImages}
    onSelect={handleSelectFromComments}
  />
)}
```

### 11.2 添加编辑故事片段功能

#### 步骤 1: 添加编辑按钮

在故事片段列表中，为每个片段添加编辑按钮：

```typescript
{canEdit && (
  <Button
    variant="tertiary"
    size="sm"
    onClick={() => {
      setEditingTranscript(transcript)
      setTranscriptImages(storyImages.filter(img => img.transcript_id === transcript.id))
      setIsEditModalOpen(true)
    }}
  >
    <Edit className="w-4 h-4 mr-1" />
    {t('detail.edit')}
  </Button>
)}
```

#### 步骤 2: 添加编辑弹窗

在组件末尾添加：

```typescript
{/* 编辑故事片段弹窗 */}
{isEditModalOpen && editingTranscript && (
  <TranscriptEditModal
    isOpen={isEditModalOpen}
    transcript={editingTranscript}
    images={transcriptImages}
    onClose={() => {
      setIsEditModalOpen(false)
      setEditingTranscript(null)
      setTranscriptImages([])
    }}
    onSave={async (data) => {
      // 更新文本
      const response = await fetch(`/api/stories/${story.id}/transcripts/${editingTranscript.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: data.transcript }),
      })
      
      if (response.ok) {
        await fetchStoryImages() // 刷新图片
        setIsEditModalOpen(false)
        setEditingTranscript(null)
      }
    }}
    onUploadImages={async (files) => {
      // 上传新图片
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        await fetch(`/api/stories/${story.id}/transcripts/${editingTranscript.id}/images`, {
          method: 'POST',
          body: formData,
        })
      }
      await fetchStoryImages()
    }}
    onDeleteImage={async (imageId) => {
      await handleDeleteImage(imageId)
    }}
  />
)}
```

---

## 任务 12: 更新评论组件支持图片上传

### 12.1 更新评论组件

**文件**: `packages/web/src/components/stories/story-detail-page.tsx`

#### 步骤 1: 添加导入

```typescript
import { ImageUploader } from '@/components/images/ImageUploader'
```

#### 步骤 2: 添加评论图片状态

```typescript
const [commentImages, setCommentImages] = useState<Array<{ id: string; file: File; preview: string }>>([])
```

#### 步骤 3: 在评论输入区域添加图片上传

找到评论输入区域，添加 ImageUploader：

```typescript
{/* 添加评论 */}
<div className="space-y-3">
  <Textarea
    placeholder={t('detail.commentPlaceholder')}
    value={newComment}
    onChange={(e) => setNewComment(e.target.value)}
    rows={3}
  />
  
  {/* 图片上传 */}
  <ImageUploader
    maxImages={6}
    images={commentImages}
    onImagesChange={setCommentImages}
    showPreview={true}
  />
  
  <Button 
    variant="primary" 
    size="sm" 
    onClick={async () => {
      if (newComment.trim() && onAddComment) {
        // 先添加评论
        await onAddComment(newComment)
        
        // 获取刚创建的评论 ID（需要从 onAddComment 返回）
        // 然后上传图片
        if (commentImages.length > 0) {
          // 这里需要评论 ID，可能需要修改 onAddComment 返回值
          for (const img of commentImages) {
            const formData = new FormData()
            formData.append('file', img.file)
            await fetch(`/api/interactions/${commentId}/images`, {
              method: 'POST',
              body: formData,
            })
          }
        }
        
        setNewComment('')
        setCommentImages([])
      }
    }}
  >
    <Send className="w-4 h-4 mr-1" />
    {t('detail.addComment')}
  </Button>
</div>
```

#### 步骤 4: 显示评论中的图片

在评论列表中显示图片：

```typescript
{comment.images && comment.images.length > 0 && (
  <div className="mt-2 grid grid-cols-3 gap-2">
    {comment.images.map((image) => (
      <img
        key={image.id}
        src={image.url}
        alt={image.file_name}
        className="w-full h-24 object-cover rounded cursor-pointer"
        onClick={() => {
          // 打开 lightbox 查看大图
        }}
      />
    ))}
  </div>
)}
```

---

## 任务 13: 更新故事列表显示主图片

### 13.1 更新故事列表组件

**文件**: 故事列表相关组件（需要找到具体文件）

#### 步骤 1: 在查询故事时包含主图片

修改故事查询逻辑，包含主图片信息：

```typescript
// 在获取故事列表时，同时获取主图片
const fetchStoriesWithImages = async () => {
  const stories = await fetchStories() // 原有的获取故事函数
  
  // 为每个故事获取主图片
  const storiesWithImages = await Promise.all(
    stories.map(async (story) => {
      try {
        const response = await fetch(`/api/stories/${story.id}/images`)
        if (response.ok) {
          const data = await response.json()
          const primaryImage = data.images?.find((img: StoryImage) => img.is_primary)
          const firstImage = data.images?.[0]
          return {
            ...story,
            primaryImage: primaryImage || firstImage || null,
          }
        }
      } catch (error) {
        console.error('Error fetching story images:', error)
      }
      return story
    })
  )
  
  return storiesWithImages
}
```

#### 步骤 2: 在故事卡片中显示主图片

```typescript
{/* 故事卡片 */}
<Card>
  {/* 主图片 */}
  {story.primaryImage ? (
    <div className="aspect-video w-full overflow-hidden rounded-t-lg">
      <img
        src={story.primaryImage.url}
        alt={story.title}
        className="w-full h-full object-cover"
      />
    </div>
  ) : (
    <div className="aspect-video w-full bg-muted rounded-t-lg flex items-center justify-center">
      <Camera className="w-12 h-12 text-muted-foreground" />
    </div>
  )}
  
  <CardContent>
    <h3>{story.title}</h3>
    {/* 其他故事信息 */}
  </CardContent>
</Card>
```

#### 步骤 3: 使用 Next.js Image 组件优化

```typescript
import Image from 'next/image'

{story.primaryImage ? (
  <div className="relative aspect-video w-full overflow-hidden rounded-t-lg">
    <Image
      src={story.primaryImage.url}
      alt={story.title}
      fill
      className="object-cover"
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    />
  </div>
) : (
  <div className="aspect-video w-full bg-muted rounded-t-lg flex items-center justify-center">
    <Camera className="w-12 h-12 text-muted-foreground" />
  </div>
)}
```

---

## 需要添加的翻译键

在 `packages/web/public/locales/*/stories.json` 中添加：

```json
{
  "detail": {
    "imageGallery": "图片相册",
    "edit": "编辑",
    "editTranscript": "编辑故事片段",
    "transcriptText": "文本内容",
    "transcriptPlaceholder": "输入故事文本...",
    "existingImages": "现有图片",
    "addNewImages": "添加新图片",
    "save": "保存",
    "saving": "保存中...",
    "cancel": "取消"
  }
}
```

---

## 完整集成检查清单

### 任务 11: 故事详情页
- [ ] 导入所需组件
- [ ] 添加状态管理
- [ ] 添加获取图片函数
- [ ] 添加图片管理函数
- [ ] 在 JSX 中添加 ImageGallery
- [ ] 添加 CommentImageSelector
- [ ] 添加编辑按钮
- [ ] 添加 TranscriptEditModal

### 任务 12: 评论组件
- [ ] 导入 ImageUploader
- [ ] 添加评论图片状态
- [ ] 在评论输入区添加 ImageUploader
- [ ] 修改提交逻辑上传图片
- [ ] 在评论列表显示图片

### 任务 13: 故事列表
- [ ] 修改查询逻辑包含主图片
- [ ] 在故事卡片显示主图片
- [ ] 处理无图片情况
- [ ] 使用 Next.js Image 优化

---

## 注意事项

1. **错误处理**: 所有 API 调用都应该有 try-catch 错误处理
2. **加载状态**: 添加加载指示器提升用户体验
3. **权限检查**: 确保只有有权限的用户才能编辑和删除
4. **刷新数据**: 操作成功后刷新相关数据
5. **用户反馈**: 使用 toast 或其他方式提供操作反馈

---

## 测试建议

1. 测试图片上传（录制界面）
2. 测试图片相册显示
3. 测试设置主图片
4. 测试删除图片
5. 测试拖拽排序
6. 测试从评论选择图片
7. 测试编辑故事片段
8. 测试评论上传图片
9. 测试故事列表显示主图片

---

**创建日期**: 2025-01-11
**版本**: 1.0
**状态**: 集成指南完成


---

## 已完成的集成总结

### ✅ 任务 11: 故事详情页集成 (已完成)

**文件**: `packages/web/src/components/stories/story-detail-page.tsx`

**完成的功能**:
1. **图片相册展示** (11.1) ✅
   - 添加了 `ImageGallery` 组件显示所有故事图片
   - 支持按片段高亮显示图片
   - 支持设置主图片、删除图片、重新排序
   - 实时获取和更新图片数据

2. **编辑故事片段** (11.2) ✅
   - 添加"编辑"按钮打开 `TranscriptEditModal`
   - 支持同时编辑文本和管理图片
   - 保存后自动刷新图片相册

3. **评论图片选择** (11.3) ✅
   - 集成 `CommentImageSelector` 组件
   - 仅对 storyteller 角色显示
   - 支持从评论图片批量添加到故事
   - 添加后自动刷新图片相册

**新增的状态管理**:
```typescript
const [storyImages, setStoryImages] = useState<StoryImage[]>([])
const [interactionImages, setInteractionImages] = useState<InteractionImage[]>([])
const [commentImages, setCommentImages] = useState<Array<{ id: string; file: File; preview: string }>>([])
const [isLoadingImages, setIsLoadingImages] = useState(false)
const [editModalOpen, setEditModalOpen] = useState(false)
const [editingTranscriptData, setEditingTranscriptData] = useState<any | null>(null)
```

**新增的函数**:
- `fetchStoryImages()`: 获取故事所有图片
- `fetchInteractionImages()`: 获取评论中的图片
- `handleSetPrimaryImage()`: 设置主图片
- `handleDeleteImage()`: 删除图片
- `handleReorderImages()`: 重新排序图片
- `handleAddImagesFromComments()`: 从评论添加图片到故事
- `handleEditTranscript()`: 打开编辑弹窗
- `handleSaveTranscriptFromModal()`: 保存后刷新

---

### ✅ 任务 12: 评论组件图片上传 (已完成)

**文件**: `packages/web/src/components/stories/story-detail-page.tsx`

**完成的功能**:
1. **评论输入区域** (12.1) ✅
   - 集成 `ImageUploader` 组件到评论输入区域
   - 限制最多 6 张图片
   - 提交评论时自动上传图片

2. **评论列表显示图片** ✅
   - 在评论列表中显示图片网格
   - 每个评论最多显示 3 列图片
   - 图片以 aspect-square 比例显示

**更新的函数**:
```typescript
const handleAddComment = async () => {
  // 提交评论
  await onAddComment(newComment)
  
  // 上传评论图片
  if (commentImages.length > 0) {
    const formData = new FormData()
    commentImages.forEach((img) => {
      formData.append('images', img.file)
    })
    await fetch(`/api/interactions/${latestComment.id}/images`, {
      method: 'POST',
      body: formData,
    })
    setCommentImages([])
    await fetchInteractionImages()
  }
}
```

---

### ✅ 任务 13: 故事列表显示主图片 (已完成)

**文件**: 
- `packages/web/src/app/api/projects/[id]/stories/route.ts`
- `packages/web/src/app/[locale]/dashboard/projects/[id]/page.tsx`

**完成的功能**:
1. **API 更新** (13.1) ✅
   - 在故事列表 API 中添加主图片查询
   - 优先返回 `is_primary=true` 的图片
   - 如果没有主图片，返回第一张图片（按 order_index 排序）
   - 返回格式：`primary_image: { id, url, caption, is_primary }`

2. **前端显示** ✅
   - 在 `StoryCard` 组件中传递 `thumbnail` 属性
   - 使用 `story.primary_image?.url` 作为缩略图
   - 如果没有图片，StoryCard 会显示默认占位符

**API 更新代码**:
```typescript
// Get primary image or first image
const { data: primaryImage } = await db
  .from('story_images')
  .select('id, url, caption, is_primary')
  .eq('story_id', story.id)
  .order('is_primary', { ascending: false })
  .order('order_index', { ascending: true })
  .limit(1)
  .maybeSingle()

return {
  ...story,
  primary_image: primaryImage || null
}
```

**前端使用代码**:
```tsx
<StoryCard
  key={story.id}
  id={story.id}
  title={story.title}
  thumbnail={(story as any).primary_image?.url}
  // ... 其他属性
/>
```

---

## 集成检查清单

### 故事详情页 (StoryDetailPage)
- [x] 导入必要的组件和类型
- [x] 添加图片相关状态管理
- [x] 实现 fetchStoryImages 函数
- [x] 实现 fetchInteractionImages 函数
- [x] 添加 ImageGallery 组件到页面
- [x] 添加 TranscriptEditModal 组件
- [x] 添加 CommentImageSelector 组件
- [x] 在评论输入区域添加 ImageUploader
- [x] 在评论列表中显示图片
- [x] 实现图片管理函数（设置主图片、删除、排序）

### 故事列表 (ProjectPage)
- [x] 更新 API 查询包含主图片
- [x] 在 StoryCard 中传递 thumbnail 属性
- [x] 处理无图片的情况

### API 端点
- [x] GET /api/stories/[storyId]/images - 获取故事图片
- [x] POST /api/stories/[storyId]/images - 上传图片
- [x] DELETE /api/stories/[storyId]/images/[imageId] - 删除图片
- [x] PATCH /api/stories/[storyId]/images/[imageId]/set-primary - 设置主图片
- [x] PATCH /api/stories/[storyId]/images/reorder - 重新排序
- [x] GET /api/interactions/[interactionId]/images - 获取评论图片
- [x] POST /api/interactions/[interactionId]/images - 上传评论图片
- [x] DELETE /api/interactions/[interactionId]/images/[imageId] - 删除评论图片

---

## 测试建议

### 功能测试
1. **图片上传**
   - 测试在录制时上传图片
   - 测试在评论中上传图片
   - 测试文件格式验证
   - 测试文件大小限制
   - 测试数量限制（最多 6 张）

2. **图片管理**
   - 测试设置主图片
   - 测试删除图片
   - 测试拖拽排序
   - 测试从评论添加图片到故事

3. **图片显示**
   - 测试故事详情页图片相册
   - 测试故事列表缩略图
   - 测试评论中的图片显示
   - 测试 lightbox 查看大图

4. **权限控制**
   - 测试只有 storyteller 可以管理图片
   - 测试只有图片上传者可以删除评论图片
   - 测试项目成员可以查看图片

### 性能测试
1. 测试图片压缩功能
2. 测试懒加载
3. 测试大量图片的加载性能

### 兼容性测试
1. 测试不同浏览器
2. 测试移动设备
3. 测试不同图片格式

---

## 故障排除

### 常见问题

1. **图片上传失败**
   - 检查 Supabase Storage 配置
   - 检查文件大小是否超过限制
   - 检查文件格式是否支持
   - 检查网络连接

2. **图片不显示**
   - 检查 URL 是否正确
   - 检查签名 URL 是否过期
   - 检查 RLS 策略
   - 检查浏览器控制台错误

3. **权限错误**
   - 检查用户角色
   - 检查 RLS 策略
   - 检查 API 权限验证

4. **性能问题**
   - 检查图片是否已压缩
   - 检查是否启用懒加载
   - 检查网络请求数量

---

## 下一步

所有核心功能已完成集成。建议的后续工作：

1. **优化**
   - 添加图片预加载
   - 优化移动端体验
   - 添加图片编辑功能（裁剪、旋转）

2. **增强**
   - 添加图片标签功能
   - 添加图片搜索
   - 添加批量操作

3. **监控**
   - 添加错误追踪
   - 添加性能监控
   - 添加使用统计

---

最后更新: 2025-01-11

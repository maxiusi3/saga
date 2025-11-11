# 故事图片上传功能 - 测试指南

## 测试概述

本文档提供了故事图片上传功能的完整测试指南，包括单元测试、集成测试和 E2E 测试的示例。

---

## 任务 17.1: 组件单元测试

### 1. ImageUploader 组件测试

**测试文件**: `packages/web/src/components/images/__tests__/ImageUploader.test.tsx`

**测试用例**:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ImageUploader } from '../ImageUploader'

describe('ImageUploader', () => {
  it('应该渲染上传区域', () => {
    render(<ImageUploader maxImages={6} onImagesChange={jest.fn()} />)
    expect(screen.getByText(/click or drag/i)).toBeInTheDocument()
  })

  it('应该验证文件格式', async () => {
    const onImagesChange = jest.fn()
    render(<ImageUploader maxImages={6} onImagesChange={onImagesChange} />)
    
    const file = new File(['content'], 'test.txt', { type: 'text/plain' })
    const input = screen.getByLabelText(/upload/i)
    
    fireEvent.change(input, { target: { files: [file] } })
    
    await waitFor(() => {
      expect(screen.getByText(/unsupported format/i)).toBeInTheDocument()
    })
  })

  it('应该验证文件大小', async () => {
    const onImagesChange = jest.fn()
    render(<ImageUploader maxImages={6} onImagesChange={onImagesChange} />)
    
    // 创建一个超过 10MB 的文件
    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', { 
      type: 'image/jpeg' 
    })
    const input = screen.getByLabelText(/upload/i)
    
    fireEvent.change(input, { target: { files: [largeFile] } })
    
    await waitFor(() => {
      expect(screen.getByText(/size exceeds limit/i)).toBeInTheDocument()
    })
  })

  it('应该限制图片数量', async () => {
    const onImagesChange = jest.fn()
    render(<ImageUploader maxImages={2} onImagesChange={onImagesChange} />)
    
    const files = [
      new File(['content1'], 'test1.jpg', { type: 'image/jpeg' }),
      new File(['content2'], 'test2.jpg', { type: 'image/jpeg' }),
      new File(['content3'], 'test3.jpg', { type: 'image/jpeg' }),
    ]
    const input = screen.getByLabelText(/upload/i)
    
    fireEvent.change(input, { target: { files } })
    
    await waitFor(() => {
      expect(screen.getByText(/maximum.*reached/i)).toBeInTheDocument()
    })
  })

  it('应该支持拖拽上传', async () => {
    const onImagesChange = jest.fn()
    render(<ImageUploader maxImages={6} onImagesChange={onImagesChange} />)
    
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
    const dropZone = screen.getByText(/click or drag/i).closest('div')
    
    fireEvent.drop(dropZone!, {
      dataTransfer: { files: [file] }
    })
    
    await waitFor(() => {
      expect(onImagesChange).toHaveBeenCalled()
    })
  })
})
```

### 2. ImageGallery 组件测试

**测试文件**: `packages/web/src/components/images/__tests__/ImageGallery.test.tsx`

**测试用例**:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { ImageGallery } from '../ImageGallery'
import { StoryImage } from '@saga/shared/types/image'

const mockImages: StoryImage[] = [
  {
    id: '1',
    story_id: 'story1',
    url: 'https://example.com/image1.jpg',
    file_name: 'image1.jpg',
    is_primary: true,
    order_index: 0,
    created_at: '2025-01-01',
  },
  {
    id: '2',
    story_id: 'story1',
    url: 'https://example.com/image2.jpg',
    file_name: 'image2.jpg',
    is_primary: false,
    order_index: 1,
    created_at: '2025-01-01',
  },
]

describe('ImageGallery', () => {
  it('应该渲染所有图片', () => {
    render(<ImageGallery storyId="story1" images={mockImages} />)
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })

  it('应该显示主图片标记', () => {
    render(<ImageGallery storyId="story1" images={mockImages} />)
    expect(screen.getByText(/primary/i)).toBeInTheDocument()
  })

  it('应该在编辑模式显示操作按钮', () => {
    render(
      <ImageGallery 
        storyId="story1" 
        images={mockImages} 
        canEdit={true}
        onSetPrimary={jest.fn()}
        onDelete={jest.fn()}
      />
    )
    
    // 悬停在图片上应该显示按钮
    const image = screen.getAllByRole('img')[1]
    fireEvent.mouseEnter(image.closest('div')!)
    
    expect(screen.getByTitle(/set.*primary/i)).toBeInTheDocument()
    expect(screen.getByTitle(/delete/i)).toBeInTheDocument()
  })

  it('应该调用设置主图片回调', async () => {
    const onSetPrimary = jest.fn()
    render(
      <ImageGallery 
        storyId="story1" 
        images={mockImages} 
        canEdit={true}
        onSetPrimary={onSetPrimary}
      />
    )
    
    const setPrimaryButton = screen.getByTitle(/set.*primary/i)
    fireEvent.click(setPrimaryButton)
    
    expect(onSetPrimary).toHaveBeenCalledWith('2')
  })

  it('应该显示空状态', () => {
    render(<ImageGallery storyId="story1" images={[]} />)
    expect(screen.getByText(/no images/i)).toBeInTheDocument()
  })
})
```

### 3. ImageLightbox 组件测试

**测试文件**: `packages/web/src/components/images/__tests__/ImageLightbox.test.tsx`

**测试用例**:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { ImageLightbox } from '../ImageLightbox'

const mockImages = [
  { id: '1', url: 'https://example.com/image1.jpg', caption: 'Image 1' },
  { id: '2', url: 'https://example.com/image2.jpg', caption: 'Image 2' },
  { id: '3', url: 'https://example.com/image3.jpg', caption: 'Image 3' },
]

describe('ImageLightbox', () => {
  it('应该在打开时显示', () => {
    render(
      <ImageLightbox 
        images={mockImages} 
        initialIndex={0} 
        isOpen={true}
        onClose={jest.fn()}
      />
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('应该显示当前图片序号', () => {
    render(
      <ImageLightbox 
        images={mockImages} 
        initialIndex={1} 
        isOpen={true}
        onClose={jest.fn()}
      />
    )
    expect(screen.getByText(/2.*3/)).toBeInTheDocument()
  })

  it('应该支持键盘导航', () => {
    const onNavigate = jest.fn()
    render(
      <ImageLightbox 
        images={mockImages} 
        initialIndex={1} 
        isOpen={true}
        onClose={jest.fn()}
        onNavigate={onNavigate}
      />
    )
    
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(onNavigate).toHaveBeenCalledWith(2)
    
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(onNavigate).toHaveBeenCalledWith(0)
  })

  it('应该支持 ESC 键关闭', () => {
    const onClose = jest.fn()
    render(
      <ImageLightbox 
        images={mockImages} 
        initialIndex={0} 
        isOpen={true}
        onClose={onClose}
      />
    )
    
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
```

### 4. CommentImageSelector 组件测试

**测试文件**: `packages/web/src/components/images/__tests__/CommentImageSelector.test.tsx`

**测试用例**:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { CommentImageSelector } from '../CommentImageSelector'
import { InteractionImage } from '@saga/shared/types/image'

const mockImages: InteractionImage[] = [
  {
    id: '1',
    interaction_id: 'comment1',
    url: 'https://example.com/image1.jpg',
    file_name: 'image1.jpg',
    created_at: '2025-01-01',
  },
  {
    id: '2',
    interaction_id: 'comment2',
    url: 'https://example.com/image2.jpg',
    file_name: 'image2.jpg',
    created_at: '2025-01-01',
  },
]

describe('CommentImageSelector', () => {
  it('应该渲染所有评论图片', () => {
    render(<CommentImageSelector images={mockImages} onAddToStory={jest.fn()} />)
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  })

  it('应该支持多选', () => {
    render(<CommentImageSelector images={mockImages} onAddToStory={jest.fn()} />)
    
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1])
    
    expect(screen.getByText(/2.*selected/i)).toBeInTheDocument()
  })

  it('应该调用添加回调', () => {
    const onAddToStory = jest.fn()
    render(<CommentImageSelector images={mockImages} onAddToStory={onAddToStory} />)
    
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    
    const addButton = screen.getByText(/add to story/i)
    fireEvent.click(addButton)
    
    expect(onAddToStory).toHaveBeenCalledWith(['1'])
  })
})
```

### 5. TranscriptEditModal 组件测试

**测试文件**: `packages/web/src/components/stories/__tests__/TranscriptEditModal.test.tsx`

**测试用例**:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TranscriptEditModal } from '../TranscriptEditModal'

const mockTranscript = {
  id: 'transcript1',
  transcript: 'Original transcript text',
}

describe('TranscriptEditModal', () => {
  it('应该显示当前文本', () => {
    render(
      <TranscriptEditModal 
        open={true}
        transcript={mockTranscript}
        storyId="story1"
        onClose={jest.fn()}
        onSave={jest.fn()}
      />
    )
    
    expect(screen.getByDisplayValue(/original transcript/i)).toBeInTheDocument()
  })

  it('应该允许编辑文本', () => {
    render(
      <TranscriptEditModal 
        open={true}
        transcript={mockTranscript}
        storyId="story1"
        onClose={jest.fn()}
        onSave={jest.fn()}
      />
    )
    
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Updated text' } })
    
    expect(screen.getByDisplayValue(/updated text/i)).toBeInTheDocument()
  })

  it('应该调用保存回调', async () => {
    const onSave = jest.fn()
    render(
      <TranscriptEditModal 
        open={true}
        transcript={mockTranscript}
        storyId="story1"
        onClose={jest.fn()}
        onSave={onSave}
      />
    )
    
    const saveButton = screen.getByText(/save/i)
    fireEvent.click(saveButton)
    
    await waitFor(() => {
      expect(onSave).toHaveBeenCalled()
    })
  })

  it('应该调用关闭回调', () => {
    const onClose = jest.fn()
    render(
      <TranscriptEditModal 
        open={true}
        transcript={mockTranscript}
        storyId="story1"
        onClose={onClose}
        onSave={jest.fn()}
      />
    )
    
    const cancelButton = screen.getByText(/cancel/i)
    fireEvent.click(cancelButton)
    
    expect(onClose).toHaveBeenCalled()
  })
})
```

---

## 任务 17.2: API 集成测试

### 测试文件结构

```
packages/web/src/app/api/__tests__/
├── stories/
│   └── images.test.ts
└── interactions/
    └── images.test.ts
```

### 1. 故事图片 API 测试

**测试文件**: `packages/web/src/app/api/__tests__/stories/images.test.ts`

**测试用例**:

```typescript
import { createMocks } from 'node-mocks-http'
import { GET, POST, DELETE, PATCH } from '@/app/api/stories/[storyId]/images/route'

describe('Story Images API', () => {
  describe('GET /api/stories/[storyId]/images', () => {
    it('应该返回故事的所有图片', async () => {
      const { req, res } = createMocks({
        method: 'GET',
      })
      
      await GET(req, { params: { storyId: 'story1' } })
      
      expect(res._getStatusCode()).toBe(200)
      const data = JSON.parse(res._getData())
      expect(data.images).toBeDefined()
      expect(Array.isArray(data.images)).toBe(true)
    })

    it('应该验证用户权限', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          authorization: 'Bearer invalid_token',
        },
      })
      
      await GET(req, { params: { storyId: 'story1' } })
      
      expect(res._getStatusCode()).toBe(401)
    })
  })

  describe('POST /api/stories/[storyId]/images', () => {
    it('应该上传图片', async () => {
      const formData = new FormData()
      formData.append('file', new Blob(['test']), 'test.jpg')
      
      const { req, res } = createMocks({
        method: 'POST',
        body: formData,
      })
      
      await POST(req, { params: { storyId: 'story1' } })
      
      expect(res._getStatusCode()).toBe(200)
      const data = JSON.parse(res._getData())
      expect(data.image).toBeDefined()
    })

    it('应该验证文件格式', async () => {
      const formData = new FormData()
      formData.append('file', new Blob(['test']), 'test.txt')
      
      const { req, res } = createMocks({
        method: 'POST',
        body: formData,
      })
      
      await POST(req, { params: { storyId: 'story1' } })
      
      expect(res._getStatusCode()).toBe(400)
    })
  })

  describe('DELETE /api/stories/[storyId]/images/[imageId]', () => {
    it('应该删除图片', async () => {
      const { req, res } = createMocks({
        method: 'DELETE',
      })
      
      await DELETE(req, { params: { storyId: 'story1', imageId: 'image1' } })
      
      expect(res._getStatusCode()).toBe(200)
    })

    it('应该验证用户是否为 storyteller', async () => {
      const { req, res } = createMocks({
        method: 'DELETE',
        headers: {
          authorization: 'Bearer facilitator_token',
        },
      })
      
      await DELETE(req, { params: { storyId: 'story1', imageId: 'image1' } })
      
      expect(res._getStatusCode()).toBe(403)
    })
  })

  describe('PATCH /api/stories/[storyId]/images/[imageId]/set-primary', () => {
    it('应该设置主图片', async () => {
      const { req, res } = createMocks({
        method: 'PATCH',
      })
      
      await PATCH(req, { params: { storyId: 'story1', imageId: 'image1' } })
      
      expect(res._getStatusCode()).toBe(200)
    })
  })
})
```

### 2. 评论图片 API 测试

**测试文件**: `packages/web/src/app/api/__tests__/interactions/images.test.ts`

**测试用例**:

```typescript
import { createMocks } from 'node-mocks-http'
import { GET, POST, DELETE } from '@/app/api/interactions/[interactionId]/images/route'

describe('Interaction Images API', () => {
  describe('GET /api/interactions/[interactionId]/images', () => {
    it('应该返回评论的所有图片', async () => {
      const { req, res } = createMocks({
        method: 'GET',
      })
      
      await GET(req, { params: { interactionId: 'comment1' } })
      
      expect(res._getStatusCode()).toBe(200)
      const data = JSON.parse(res._getData())
      expect(data.images).toBeDefined()
    })
  })

  describe('POST /api/interactions/[interactionId]/images', () => {
    it('应该上传评论图片', async () => {
      const formData = new FormData()
      formData.append('file', new Blob(['test']), 'test.jpg')
      
      const { req, res } = createMocks({
        method: 'POST',
        body: formData,
      })
      
      await POST(req, { params: { interactionId: 'comment1' } })
      
      expect(res._getStatusCode()).toBe(200)
    })

    it('应该限制图片数量', async () => {
      const formData = new FormData()
      for (let i = 0; i < 7; i++) {
        formData.append('file', new Blob(['test']), `test${i}.jpg`)
      }
      
      const { req, res } = createMocks({
        method: 'POST',
        body: formData,
      })
      
      await POST(req, { params: { interactionId: 'comment1' } })
      
      expect(res._getStatusCode()).toBe(400)
    })
  })
})
```

---

## 任务 17.3: E2E 测试

### 测试文件结构

```
packages/web/e2e/
├── story-images.spec.ts
└── comment-images.spec.ts
```

### 1. 故事图片 E2E 测试

**测试文件**: `packages/web/e2e/story-images.spec.ts`

**测试用例**:

```typescript
import { test, expect } from '@playwright/test'

test.describe('Story Images', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name="email"]', 'storyteller@example.com')
    await page.fill('[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('应该在录制时上传图片', async ({ page }) => {
    await page.goto('/dashboard/projects/1/record')
    
    // 开始录制
    await page.click('button:has-text("Start Recording")')
    await page.waitForTimeout(3000)
    await page.click('button:has-text("Stop")')
    
    // 上传图片
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('test-fixtures/test-image.jpg')
    
    // 提交
    await page.click('button:has-text("Submit")')
    
    // 验证
    await expect(page.locator('text=Story created successfully')).toBeVisible()
  })

  test('应该在故事详情页查看图片相册', async ({ page }) => {
    await page.goto('/dashboard/projects/1/stories/1')
    
    // 验证图片相册存在
    await expect(page.locator('text=Image Gallery')).toBeVisible()
    
    // 点击图片打开 lightbox
    await page.click('img[alt*="image"]')
    await expect(page.locator('[role="dialog"]')).toBeVisible()
  })

  test('应该设置主图片', async ({ page }) => {
    await page.goto('/dashboard/projects/1/stories/1')
    
    // 悬停在图片上
    await page.hover('img[alt*="image"]')
    
    // 点击设置主图片按钮
    await page.click('button[title*="Set as primary"]')
    
    // 验证成功提示
    await expect(page.locator('text=Primary image set successfully')).toBeVisible()
  })

  test('应该删除图片', async ({ page }) => {
    await page.goto('/dashboard/projects/1/stories/1')
    
    // 悬停在图片上
    await page.hover('img[alt*="image"]')
    
    // 点击删除按钮
    await page.click('button[title*="Delete"]')
    
    // 确认删除
    await page.click('button:has-text("Confirm")')
    
    // 验证成功提示
    await expect(page.locator('text=Image deleted successfully')).toBeVisible()
  })

  test('应该拖拽排序图片', async ({ page }) => {
    await page.goto('/dashboard/projects/1/stories/1')
    
    const firstImage = page.locator('img[alt*="image"]').first()
    const secondImage = page.locator('img[alt*="image"]').nth(1)
    
    // 拖拽第一张图片到第二张的位置
    await firstImage.dragTo(secondImage)
    
    // 验证成功提示
    await expect(page.locator('text=Images reordered successfully')).toBeVisible()
  })

  test('应该在故事列表显示主图片', async ({ page }) => {
    await page.goto('/dashboard/projects/1')
    
    // 验证故事卡片有缩略图
    const storyCard = page.locator('[data-testid="story-card"]').first()
    await expect(storyCard.locator('img')).toBeVisible()
  })
})
```

### 2. 评论图片 E2E 测试

**测试文件**: `packages/web/e2e/comment-images.spec.ts`

**测试用例**:

```typescript
import { test, expect } from '@playwright/test'

test.describe('Comment Images', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name="email"]', 'user@example.com')
    await page.fill('[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('应该在评论中上传图片', async ({ page }) => {
    await page.goto('/dashboard/projects/1/stories/1')
    
    // 输入评论
    await page.fill('textarea[placeholder*="comment"]', 'Test comment with image')
    
    // 上传图片
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('test-fixtures/test-image.jpg')
    
    // 提交评论
    await page.click('button:has-text("Add Comment")')
    
    // 验证评论和图片显示
    await expect(page.locator('text=Test comment with image')).toBeVisible()
    await expect(page.locator('img[alt*="Comment image"]')).toBeVisible()
  })

  test('应该从评论选择图片添加到故事', async ({ page }) => {
    await page.goto('/dashboard/projects/1/stories/1')
    
    // 滚动到评论图片选择器
    await page.locator('text=Select images from comments').scrollIntoViewIfNeeded()
    
    // 选择图片
    await page.click('input[type="checkbox"]')
    
    // 点击添加按钮
    await page.click('button:has-text("Add to story")')
    
    // 验证成功提示
    await expect(page.locator('text=Images added successfully')).toBeVisible()
  })
})
```

---

## 运行测试

### 单元测试

```bash
# 运行所有单元测试
npm test

# 运行特定组件测试
npm test ImageUploader

# 运行测试并生成覆盖率报告
npm test -- --coverage
```

### API 集成测试

```bash
# 运行 API 测试
npm test -- api

# 运行特定 API 测试
npm test -- api/stories
```

### E2E 测试

```bash
# 运行所有 E2E 测试
npm run test:e2e

# 运行特定 E2E 测试
npm run test:e2e story-images

# 在 UI 模式运行
npm run test:e2e -- --ui
```

---

## 测试覆盖率目标

- **组件单元测试**: 目标 80% 覆盖率
- **API 集成测试**: 目标 90% 覆盖率
- **E2E 测试**: 覆盖所有关键用户流程

---

## 持续集成

在 CI/CD 流程中自动运行测试：

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm test -- --coverage
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

---

## 注意事项

1. **测试数据**: 使用测试夹具和模拟数据
2. **清理**: 每个测试后清理测试数据
3. **隔离**: 测试应该相互独立
4. **速度**: 优化测试执行速度
5. **可维护性**: 保持测试代码简洁易读

---

最后更新: 2025-01-11

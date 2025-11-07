# Follow-up Recording Feature 实现计划

## 功能概述
允许用户为现有故事添加后续录音片段，支持长故事分段录制。

## 数据库设计

### 新表：story_transcripts
```sql
CREATE TABLE story_transcripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  audio_url TEXT,
  audio_duration INTEGER, -- 秒
  transcript TEXT NOT NULL,
  sequence_number INTEGER NOT NULL, -- 录音顺序
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(story_id, sequence_number)
);

CREATE INDEX idx_story_transcripts_story_id ON story_transcripts(story_id);
CREATE INDEX idx_story_transcripts_recorded_at ON story_transcripts(recorded_at);
```

### 修改 stories 表
```sql
-- 添加字段标记是否有多个录音片段
ALTER TABLE stories ADD COLUMN has_multiple_transcripts BOOLEAN DEFAULT FALSE;
ALTER TABLE stories ADD COLUMN transcript_count INTEGER DEFAULT 1;
```

## API 端点

### 1. 创建 Follow-up Recording
```
POST /api/stories/:storyId/transcripts
Body: {
  audioBlob: File,
  transcript: string,
  duration: number
}
Response: {
  id: string,
  sequenceNumber: number,
  recordedAt: string
}
```

### 2. 获取故事的所有 Transcripts
```
GET /api/stories/:storyId/transcripts
Response: {
  transcripts: Array<{
    id: string,
    audioUrl: string,
    audioDuration: number,
    transcript: string,
    sequenceNumber: number,
    recordedAt: string
  }>
}
```

### 3. 更新 Transcript
```
PATCH /api/stories/:storyId/transcripts/:transcriptId
Body: {
  transcript: string
}
```

### 4. 删除 Transcript
```
DELETE /api/stories/:storyId/transcripts/:transcriptId
```

## 前端实现

### 1. 故事详情页 (story-detail-page.tsx)

#### 添加 Follow-up 按钮
```tsx
<Button variant="primary" size="sm" onClick={handleFollowUp}>
  <Plus className="w-4 h-4 mr-1" />
  Follow-up Recording
</Button>
```

#### 显示播放列表
```tsx
{transcripts.length > 1 && (
  <Card variant="content">
    <CardHeader>
      <CardTitle>Recording Segments ({transcripts.length})</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        {transcripts.map((transcript, index) => (
          <button
            key={transcript.id}
            onClick={() => setActiveTranscript(transcript)}
            className={`w-full text-left p-3 rounded-lg ${
              activeTranscript.id === transcript.id
                ? 'bg-primary/10 border-primary'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">
                Segment {index + 1}
              </span>
              <span className="text-sm text-muted-foreground">
                {formatDate(transcript.recordedAt)}
              </span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {formatDuration(transcript.audioDuration)}
            </div>
          </button>
        ))}
      </div>
    </CardContent>
  </Card>
)}
```

#### 显示多个 Transcripts
```tsx
<Card variant="content">
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle>
        Transcript {activeTranscriptIndex > 0 ? `(Segment ${activeTranscriptIndex + 1})` : ''}
      </CardTitle>
      {canEdit && (
        <Button variant="tertiary" size="sm" onClick={() => setIsEditingTranscript(!isEditingTranscript)}>
          <Edit className="w-4 h-4" />
        </Button>
      )}
    </div>
  </CardHeader>
  <CardContent>
    {/* Transcript content */}
  </CardContent>
</Card>
```

### 2. 录音页面 (record/page.tsx)

#### 支持 Follow-up 模式
```tsx
// URL: /dashboard/projects/:id/record?followup=:storyId

const searchParams = useSearchParams()
const followupStoryId = searchParams.get('followup')
const isFollowupMode = !!followupStoryId

// 修改提交逻辑
const handleSubmitStory = async () => {
  if (isFollowupMode) {
    // 创建新的 transcript
    await createTranscript(followupStoryId, {
      audioBlob,
      transcript,
      duration
    })
    // 跳转回故事详情页
    router.push(`/dashboard/projects/${projectId}/stories/${followupStoryId}`)
  } else {
    // 原有逻辑：创建新故事
    // ...
  }
}
```

### 3. 翻译文件更新

#### en/stories.json
```json
{
  "detail": {
    "followupRecording": "Follow-up Recording",
    "recordingSegments": "Recording Segments",
    "segment": "Segment",
    "addSegment": "Add Recording Segment"
  }
}
```

#### zh-CN/stories.json
```json
{
  "detail": {
    "followupRecording": "继续录制",
    "recordingSegments": "录音片段",
    "segment": "片段",
    "addSegment": "添加录音片段"
  }
}
```

## 实现顺序

1. ✅ 创建数据库迁移文件
2. ✅ 创建 API 路由
3. ✅ 更新故事详情页面
4. ✅ 更新录音页面支持 follow-up 模式
5. ✅ 添加翻译
6. ✅ 测试完整流程

## 注意事项

1. **音频存储**：需要为每个 transcript 单独存储音频文件
2. **播放器状态**：切换 transcript 时需要重置播放器状态
3. **权限控制**：只有故事的讲述者和管理员可以添加 follow-up
4. **UI 反馈**：添加 loading 状态和错误处理
5. **数据一致性**：删除 transcript 时需要重新计算 sequence_number

## 后续优化

1. 支持拖拽排序 transcripts
2. 支持合并多个 transcripts
3. 支持导出完整的合并音频
4. 添加 transcript 之间的时间间隔显示

# Storage RLS 安全审计报告

**审计日期**: 2026-10-07  
**审计范围**: Supabase Storage `saga` bucket 的 RLS 策略  
**审计人员**: Claude Sonnet 5.5

---

## 执行摘要

✅ **总体评估**: Storage RLS 策略设计合理且安全  
⚠️ **发现问题**: 2个需要注意的配置细节  
🎯 **建议改进**: 3条优化建议

---

## 1. Bucket 配置审计

### 1.1 Bucket 基本配置

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'saga',
  'saga',
  false,  -- ✅ Private bucket (非公开)
  104857600,  -- 100MB limit
  ARRAY['audio/webm', 'audio/mpeg', 'audio/mp3', 'image/jpeg', 'image/png', 'image/webp', 'video/mp4']
);
```

**安全评估**: ✅ **安全**

- ✅ Bucket 设置为 `public = false`（私有）
- ✅ 文件大小限制合理（100MB）
- ✅ MIME 类型白名单限制（防止上传可执行文件）

---

## 2. RLS 策略审计

### 2.1 用户自有文件策略

#### Policy 1: 用户上传自己的文件

```sql
CREATE POLICY "Users can upload files to their own folders"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'saga' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

**安全评估**: ✅ **安全**

- ✅ 限制 bucket 为 `saga`
- ✅ 路径第一级必须是用户自己的 UUID
- ✅ 防止用户上传文件到其他用户目录

**文件路径示例**:
```
✅ {user_id}/profile/avatar.jpg
✅ {user_id}/temp/recording-123.webm
❌ {other_user_id}/profile/avatar.jpg  (被阻止)
```

---

#### Policy 2: 用户查看自己的文件

```sql
CREATE POLICY "Users can view their own files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'saga' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

**安全评估**: ✅ **安全**

- ✅ 用户只能查看自己目录下的文件
- ✅ 无法列出或访问其他用户的文件

---

#### Policy 3 & 4: 用户更新/删除自己的文件

```sql
-- UPDATE 策略
CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'saga' AND auth.uid()::text = (storage.foldername(name))[1]);

-- DELETE 策略
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (bucket_id = 'saga' AND auth.uid()::text = (storage.foldername(name))[1]);
```

**安全评估**: ✅ **安全**

- ✅ 用户只能修改/删除自己的文件
- ✅ 与之前修复的 SEC-01 配合使用（API 层也有验证）

---

### 2.2 项目共享文件策略

#### Policy 5: 项目成员查看项目文件

```sql
CREATE POLICY "Project members can view project files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'saga' 
  AND (
    -- 用户自己的文件
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- 用户有权限访问的项目文件
    EXISTS (
      SELECT 1 FROM project_roles pr
      JOIN projects p ON pr.project_id = p.id
      WHERE pr.user_id = auth.uid()
      AND (storage.foldername(name))[2] = 'projects'
      AND (storage.foldername(name))[3] = p.id::text
    )
  )
);
```

**安全评估**: ✅ **安全**

- ✅ 通过 `project_roles` 表验证成员资格
- ✅ 支持项目文件共享（路径: `{user_id}/projects/{project_id}/...`）
- ✅ 非项目成员无法访问

**文件路径示例**:
```
✅ {user_id}/projects/{project_id}/stories/{story_id}/audio.mp3
   → 项目成员都可以访问
```

---

#### Policy 6: Facilitators 上传项目文件

```sql
CREATE POLICY "Project facilitators can upload project files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'saga' 
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    (
      (storage.foldername(name))[2] = 'projects'
      AND EXISTS (
        SELECT 1 FROM project_roles pr
        JOIN projects p ON pr.project_id = p.id
        WHERE pr.user_id = auth.uid()
        AND pr.role IN ('facilitator', 'co_facilitator')
        AND (storage.foldername(name))[3] = p.id::text
      )
    )
  )
);
```

**安全评估**: ✅ **安全**

- ✅ 限制上传权限给 facilitator 和 co_facilitator 角色
- ✅ 验证项目成员资格
- ✅ 防止普通成员上传到项目共享空间

---

#### Policy 7: Storytellers 上传故事文件

```sql
CREATE POLICY "Storytellers can upload story files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'saga' 
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    (
      (storage.foldername(name))[2] = 'projects'
      AND EXISTS (
        SELECT 1 FROM project_roles pr
        JOIN projects p ON pr.project_id = p.id
        WHERE pr.user_id = auth.uid()
        AND pr.role = 'storyteller'
        AND (storage.foldername(name))[3] = p.id::text
      )
    )
  )
);
```

**安全评估**: ✅ **安全**

- ✅ Storytellers 可以上传到项目目录
- ✅ 验证角色和项目成员资格

---

## 3. 潜在问题与风险

### ⚠️ 问题 1: 缺少项目文件的 UPDATE/DELETE 策略

**现状**: 
- 项目共享文件（`{user_id}/projects/{project_id}/...`）可以被 facilitators 和 storytellers 上传
- 但**没有明确的 UPDATE 或 DELETE 策略**来管理这些文件

**风险**:
- 如果路径第一级是用户自己的 ID，用户可以删除项目共享文件（通过 Policy 4）
- 这可能导致项目成员误删除其他成员上传的文件

**文件路径示例**:
```
用户 A 上传: {user_A}/projects/{project_id}/story.mp3
用户 A 可以删除 ✅ (Policy 4: "Users can delete their own files")

用户 B (同项目成员) 能否删除用户 A 的文件？
→ 如果路径是 {user_A}/... 则不能 ✅
→ 如果路径是 {project_id}/... 则需要额外策略
```

**建议修复**:
```sql
-- 允许 facilitators 删除项目文件
CREATE POLICY "Project facilitators can delete project files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'saga' 
  AND (storage.foldername(name))[2] = 'projects'
  AND EXISTS (
    SELECT 1 FROM project_roles pr
    JOIN projects p ON pr.project_id = p.id
    WHERE pr.user_id = auth.uid()
    AND pr.role IN ('facilitator', 'co_facilitator', 'owner')
    AND (storage.foldername(name))[3] = p.id::text
  )
);
```

---

### ⚠️ 问题 2: 路径结构依赖性强

**现状**:
- 所有策略都依赖路径结构约定（`{user_id}/projects/{project_id}/...`）
- 如果前端代码上传文件时路径不符合约定，会导致权限问题

**风险**:
- 开发者可能不小心使用错误的路径格式
- 没有强制性的路径校验机制

**建议改进**:
在 API 层（如 `api/media/upload`）添加路径验证：

```typescript
// 验证路径格式
function validateStoragePath(path: string, userId: string): boolean {
  const parts = path.split('/');
  
  // 用户自有文件: {user_id}/...
  if (parts[0] === userId) return true;
  
  // 项目文件: {user_id}/projects/{project_id}/...
  if (parts.length >= 3 && parts[1] === 'projects') {
    // 验证 project_id 格式
    return isValidUUID(parts[2]);
  }
  
  return false;
}
```

---

### ℹ️ 观察 3: 缺少项目所有者（owner）角色的显式策略

**现状**:
- Policy 6 只允许 `facilitator` 和 `co_facilitator` 上传项目文件
- **没有包含 `owner` 角色**

**影响**:
- 如果项目所有者的角色是 `owner`（而非 `facilitator`），他们可能无法上传项目文件

**建议修复**:
```sql
-- 修改 Policy 6
WHERE pr.role IN ('owner', 'facilitator', 'co_facilitator')
```

---

## 4. 文件路径架构审计

### 当前路径结构

```
用户自有文件:
  {user_id}/profile/avatar.jpg
  {user_id}/temp/recording-session-123.webm

项目共享文件:
  {user_id}/projects/{project_id}/stories/{story_id}/audio.mp3
  {user_id}/projects/{project_id}/exports/export-2026-10-07.zip
```

**评估**: ✅ **设计合理**

- ✅ 路径第一级始终是上传者的 `user_id`（符合 Supabase Storage 最佳实践）
- ✅ 第二级 `projects` 标识共享空间
- ✅ 第三级 `{project_id}` 隔离不同项目

---

## 5. 与 API 层的配合审计

### 已修复的 SEC-01

**文件**: `packages/web/src/app/api/media/delete-image/route.ts`

```typescript
// ✅ 现在有认证检查
const auth = await getAuthenticatedUser(request);
if (!auth.ok) return auth.response;

// ✅ 验证路径所有权
const userPrefix = `${auth.user.id}/`;
const invalidPaths = paths.filter(p => !p.startsWith(userPrefix));
if (invalidPaths.length > 0) {
  return NextResponse.json(
    { error: `Unauthorized: Cannot delete files outside your directory` },
    { status: 403, headers: auth.headers }
  );
}
```

**评估**: ✅ **API 层和 RLS 双重保护**

- ✅ API 层验证路径所有权（第一道防线）
- ✅ RLS 策略阻止越权删除（第二道防线）

---

## 6. 测试建议

### 6.1 基本权限测试

```bash
# 测试 1: 用户上传自己的文件
curl -X POST https://encdblxyxztvfxotfuyh.supabase.co/storage/v1/object/saga/{user_id}/test.jpg \
  -H "Authorization: Bearer $USER_TOKEN" \
  --data-binary @test.jpg

# 测试 2: 用户尝试上传到其他用户目录（应失败）
curl -X POST https://encdblxyxztvfxotfuyh.supabase.co/storage/v1/object/saga/{other_user_id}/test.jpg \
  -H "Authorization: Bearer $USER_TOKEN" \
  --data-binary @test.jpg

# 预期结果: 403 Forbidden 或类似错误
```

### 6.2 项目共享测试

```bash
# 测试 3: 项目成员查看项目文件
curl https://encdblxyxztvfxotfuyh.supabase.co/storage/v1/object/saga/{user_id}/projects/{project_id}/story.mp3 \
  -H "Authorization: Bearer $MEMBER_TOKEN"

# 测试 4: 非成员尝试访问（应失败）
curl https://encdblxyxztvfxotfuyh.supabase.co/storage/v1/object/saga/{user_id}/projects/{project_id}/story.mp3 \
  -H "Authorization: Bearer $NON_MEMBER_TOKEN"

# 预期结果: 403 Forbidden
```

---

## 7. 安全评分

| 评估维度 | 评分 | 说明 |
|---------|------|------|
| **身份验证** | ✅ 9/10 | 所有策略都验证 auth.uid() |
| **路径隔离** | ✅ 9/10 | 用户目录强制隔离 |
| **角色验证** | ✅ 8/10 | 项目角色验证完善，但缺少 owner |
| **最小权限** | ✅ 8/10 | 策略分离合理，READ/WRITE 分开 |
| **防御深度** | ✅ 9/10 | API 层 + RLS 双重保护 |
| **审计能力** | ⚠️ 6/10 | 缺少文件操作审计日志 |

**总体评分**: ✅ **8.2/10 (良好)**

---

## 8. 建议的改进措施

### 优先级 1: 添加项目文件删除策略

```sql
CREATE POLICY "Project facilitators can delete project files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'saga' 
  AND (storage.foldername(name))[2] = 'projects'
  AND EXISTS (
    SELECT 1 FROM project_roles pr
    WHERE pr.user_id = auth.uid()
    AND pr.role IN ('owner', 'facilitator', 'co_facilitator')
    AND (storage.foldername(name))[3] = pr.project_id::text
  )
);
```

### 优先级 2: 修复角色策略遗漏

修改现有策略，在角色检查中添加 `'owner'`：
- Policy 6: Project facilitators can upload
- Policy 7: 可能需要也允许 owner 上传

### 优先级 3: 添加文件操作审计

```sql
-- 创建审计表
CREATE TABLE storage_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  operation TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 触发器记录删除操作
CREATE OR REPLACE FUNCTION log_storage_delete()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO storage_audit_log (user_id, operation, file_path)
  VALUES (auth.uid(), 'DELETE', OLD.name);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 9. 结论

### ✅ 安全优势

1. **双重防护**: API 层认证 + RLS 策略
2. **路径隔离**: 用户目录强制隔离，防止越权访问
3. **角色管理**: 基于 project_roles 的细粒度权限控制
4. **私有 Bucket**: 文件不公开，必须通过认证访问
5. **MIME 类型限制**: 防止上传可执行文件

### ⚠️ 需要改进

1. **项目文件删除策略**: 缺少 facilitator 删除项目文件的策略
2. **角色覆盖**: `owner` 角色未包含在某些策略中
3. **审计日志**: 缺少文件操作的审计追踪

### 🎯 总体结论

**Storage RLS 策略设计合理且基本安全**，可以投入生产使用。

建议优先级：
1. **立即执行**: 添加项目文件删除策略（避免权限混乱）
2. **近期执行**: 补充 owner 角色到相关策略（1周内）
3. **中期执行**: 添加审计日志功能（1-2个月）

---

**审计完成时间**: 2026-10-07  
**下次审计建议**: 3个月后或有重大架构变更时

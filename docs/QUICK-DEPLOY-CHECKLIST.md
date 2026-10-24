# 🚀 快速部署清单

**当前状态**: ✅ 代码已推送到 GitHub，Vercel 自动部署完成  
**待完成**: 🔴 数据库迁移（需要手动执行）

---

## 📋 立即执行（5分钟）

### Step 1: 打开 Supabase SQL Editor

🔗 **链接**: https://supabase.com/dashboard/project/encdblxyxztvfxotfuyh/sql/new

---

### Step 2: 执行迁移脚本 1 - 创建 Waitlist 表

**复制以下 SQL**:

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  package_interest TEXT CHECK (package_interest IN ('standard', 'premium', 'enterprise')),
  message TEXT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_waitlist_signups_email ON public.waitlist_signups(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_user_id ON public.waitlist_signups(user_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_created_at ON public.waitlist_signups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_notified_at ON public.waitlist_signups(notified_at) WHERE notified_at IS NULL;

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can sign up for waitlist" ON public.waitlist_signups;
CREATE POLICY "Anyone can sign up for waitlist"
ON public.waitlist_signups FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own waitlist signup" ON public.waitlist_signups;
CREATE POLICY "Users can view their own waitlist signup"
ON public.waitlist_signups FOR SELECT
USING (
  auth.uid() = user_id
  OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

CREATE OR REPLACE VIEW public.waitlist_stats AS
SELECT
  COUNT(*) as total_signups,
  COUNT(DISTINCT email) as unique_emails,
  COUNT(CASE WHEN package_interest = 'standard' THEN 1 END) as standard_interest,
  COUNT(CASE WHEN package_interest = 'premium' THEN 1 END) as premium_interest,
  COUNT(CASE WHEN package_interest = 'enterprise' THEN 1 END) as enterprise_interest,
  COUNT(CASE WHEN notified_at IS NOT NULL THEN 1 END) as notified_count,
  COUNT(CASE WHEN converted_at IS NOT NULL THEN 1 END) as converted_count,
  DATE_TRUNC('day', MIN(created_at)) as first_signup_date,
  DATE_TRUNC('day', MAX(created_at)) as latest_signup_date
FROM public.waitlist_signups;

DO $$
DECLARE
  table_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'waitlist_signups'
  ) INTO table_exists;

  IF table_exists THEN
    RAISE NOTICE 'SUCCESS: waitlist_signups table created';
  ELSE
    RAISE WARNING 'FAILED: waitlist_signups table not found';
  END IF;
END $$;

COMMIT;
```

**预期输出**: `SUCCESS: waitlist_signups table created`

✅ **检查点**: 看到 SUCCESS 消息 → 继续下一步

---

### Step 3: 执行迁移脚本 2 - 改进 Storage RLS

**复制以下 SQL**:

```sql
BEGIN;

DROP POLICY IF EXISTS "Project facilitators can delete project files" ON storage.objects;
CREATE POLICY "Project facilitators can delete project files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'saga'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR (
      (storage.foldername(name))[2] = 'projects'
      AND EXISTS (
        SELECT 1 FROM project_roles pr
        JOIN projects p ON pr.project_id = p.id
        WHERE pr.user_id = auth.uid()
        AND pr.role IN ('owner', 'facilitator', 'co_facilitator')
        AND pr.status = 'active'
        AND (storage.foldername(name))[3] = p.id::text
      )
    )
  )
);

DROP POLICY IF EXISTS "Project facilitators can update project files" ON storage.objects;
CREATE POLICY "Project facilitators can update project files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'saga'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR (
      (storage.foldername(name))[2] = 'projects'
      AND EXISTS (
        SELECT 1 FROM project_roles pr
        JOIN projects p ON pr.project_id = p.id
        WHERE pr.user_id = auth.uid()
        AND pr.role IN ('owner', 'facilitator', 'co_facilitator')
        AND pr.status = 'active'
        AND (storage.foldername(name))[3] = p.id::text
      )
    )
  )
);

DROP POLICY IF EXISTS "Project facilitators can upload project files" ON storage.objects;
CREATE POLICY "Project facilitators can upload project files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'saga'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR (
      (storage.foldername(name))[2] = 'projects'
      AND EXISTS (
        SELECT 1 FROM project_roles pr
        JOIN projects p ON pr.project_id = p.id
        WHERE pr.user_id = auth.uid()
        AND pr.role IN ('owner', 'facilitator', 'co_facilitator')
        AND pr.status = 'active'
        AND (storage.foldername(name))[3] = p.id::text
      )
    )
  )
);

DROP POLICY IF EXISTS "Storytellers can upload story files" ON storage.objects;
CREATE POLICY "Storytellers can upload story files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'saga'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR (
      (storage.foldername(name))[2] = 'projects'
      AND EXISTS (
        SELECT 1 FROM project_roles pr
        JOIN projects p ON pr.project_id = p.id
        WHERE pr.user_id = auth.uid()
        AND pr.role IN ('owner', 'facilitator', 'co_facilitator', 'storyteller')
        AND pr.status = 'active'
        AND (storage.foldername(name))[3] = p.id::text
      )
    )
  )
);

DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname IN (
      'Project facilitators can delete project files',
      'Project facilitators can update project files',
      'Project facilitators can upload project files',
      'Storytellers can upload story files'
    );

  IF policy_count = 4 THEN
    RAISE NOTICE 'SUCCESS: All 4 storage policies created/updated';
  ELSE
    RAISE WARNING 'WARNING: Expected 4 policies, found %', policy_count;
  END IF;
END $$;

COMMIT;
```

**预期输出**: `SUCCESS: All 4 storage policies created/updated`

✅ **检查点**: 看到 SUCCESS 消息 → 数据库迁移完成！

---

## 🧪 验证部署（2分钟）

### 1. 测试 Waitlist 功能

**访问**: https://your-vercel-domain.vercel.app/zh-CN/dashboard/purchase

**操作**:
1. 填写邮箱
2. 选择套餐类型
3. 点击 "Join Waitlist"
4. 看到成功页面 ✅

---

### 2. 验证数据库记录

**在 Supabase SQL Editor 运行**:

```sql
SELECT * FROM public.waitlist_signups ORDER BY created_at DESC LIMIT 5;
```

**预期**: 看到你刚才提交的记录 ✅

---

### 3. 检查统计数据

```sql
SELECT * FROM public.waitlist_stats;
```

**预期**: 看到 `total_signups >= 1` ✅

---

## ✅ 完成清单

- [ ] 执行迁移脚本 1（Waitlist 表）
- [ ] 执行迁移脚本 2（Storage RLS）
- [ ] 测试 Waitlist 注册
- [ ] 验证数据库记录
- [ ] 检查统计数据

---

## 🆘 遇到问题？

### 脚本执行失败

1. **检查错误信息** - Supabase 会显示具体错误
2. **检查表是否已存在** - 可能之前已经创建过
3. **检查权限** - 确保你有 `service_role` 权限

### Waitlist 提交失败

1. **检查 API 路由** - 访问 `/api/waitlist` 应该返回 405（只允许 POST）
2. **检查环境变量** - Vercel 上是否设置了 Supabase 密钥
3. **查看 Vercel 日志** - Functions → Logs

### Storage 上传失败

1. **检查 bucket** - `saga` bucket 是否存在
2. **检查 RLS 策略** - 查看 Supabase Logs
3. **检查用户角色** - 确认 `project_roles` 表中的数据

---

## 📊 部署状态

| 组件 | 状态 |
|------|------|
| 代码推送 | ✅ 完成 |
| Vercel 部署 | ✅ 自动完成 |
| 数据库迁移 | ⏳ 待执行（手动） |
| Waitlist 功能 | ⏳ 等待迁移 |
| Storage RLS | ⏳ 等待迁移 |

---

**预计完成时间**: 5-7 分钟  
**完成后**: 所有功能正常运行，可以接受用户注册 🎉

---

**详细文档**: 查看 `docs/deployment-summary-2026-10-07.md`

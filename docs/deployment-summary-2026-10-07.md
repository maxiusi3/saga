# 生产环境部署总结

**部署日期**: 2026-10-07  
**部署状态**: ✅ 代码已推送，待数据库迁移  
**Git 提交**: ac52b5f33

---

## 📊 部署进度

### ✅ 已完成的步骤

1. **代码推送到 GitHub** ✅
   - 最新提交: `ac52b5f33`
   - 分支: `main`
   - 提交内容: 修复 GitHub Actions 测试 + 所有 NEXT-STEPS 任务
   - GitHub Actions: 将自动运行 CI 测试

2. **Vercel 自动部署** ✅
   - Vercel 已检测到代码推送
   - 生产环境部署已成功（根据之前的反馈）
   - 部署 URL: https://your-vercel-domain.vercel.app

3. **测试修复** ✅
   - 修复了 `scripts/__tests__/deployment-config.test.js` 测试
   - 更新了迁移文件列表（8个 → 11个）
   - 本地测试全部通过 (7/7)

---

### ⏳ 待执行的步骤

#### 步骤 1: 执行数据库迁移（必须手动执行）

你需要在 Supabase Dashboard 手动执行以下 2 个迁移脚本：

**🔗 Supabase SQL Editor**:  
https://supabase.com/dashboard/project/encdblxyxztvfxotfuyh/sql

---

#### 迁移脚本 1: 创建 Waitlist 表

```sql
-- ============================================================================
-- Waitlist 数据库表
-- ============================================================================
-- 用于收集等待列表用户信息，替代即时支付流程
--
-- 执行时间: 2026-10-07
-- 作者: Claude Sonnet 5.5

BEGIN;

-- ============================================================================
-- 创建 waitlist_signups 表
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  package_interest TEXT CHECK (package_interest IN ('standard', 'premium', 'enterprise')),
  message TEXT, -- 用户留言
  source TEXT, -- 来源页面
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at TIMESTAMPTZ, -- 开放付费时通知的时间
  converted_at TIMESTAMPTZ -- 转化为付费用户的时间
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_email ON public.waitlist_signups(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_user_id ON public.waitlist_signups(user_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_created_at ON public.waitlist_signups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_notified_at ON public.waitlist_signups(notified_at) WHERE notified_at IS NULL;

-- 添加注释
COMMENT ON TABLE public.waitlist_signups IS '等待列表注册记录';
COMMENT ON COLUMN public.waitlist_signups.email IS '用户邮箱（唯一）';
COMMENT ON COLUMN public.waitlist_signups.user_id IS '关联的用户ID（可选）';
COMMENT ON COLUMN public.waitlist_signups.package_interest IS '感兴趣的套餐类型';
COMMENT ON COLUMN public.waitlist_signups.message IS '用户留言或需求说明';
COMMENT ON COLUMN public.waitlist_signups.source IS '来源页面（用于追踪）';
COMMENT ON COLUMN public.waitlist_signups.notified_at IS '通知开放付费的时间';
COMMENT ON COLUMN public.waitlist_signups.converted_at IS '转化为付费用户的时间';

-- ============================================================================
-- RLS 策略
-- ============================================================================

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

-- 允许任何人插入（用于公开注册）
DROP POLICY IF EXISTS "Anyone can sign up for waitlist" ON public.waitlist_signups;
CREATE POLICY "Anyone can sign up for waitlist"
ON public.waitlist_signups
FOR INSERT
WITH CHECK (true);

-- 用户只能查看自己的记录
DROP POLICY IF EXISTS "Users can view their own waitlist signup" ON public.waitlist_signups;
CREATE POLICY "Users can view their own waitlist signup"
ON public.waitlist_signups
FOR SELECT
USING (
  auth.uid() = user_id
  OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- 管理员可以查看所有记录（通过 service_role）
-- 不需要创建 RLS 策略，service_role 绕过 RLS

-- ============================================================================
-- 统计视图（管理员使用）
-- ============================================================================

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

COMMENT ON VIEW public.waitlist_stats IS 'Waitlist 统计数据（仅管理员）';

-- ============================================================================
-- 验证
-- ============================================================================

DO $$
DECLARE
  table_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'waitlist_signups'
  ) INTO table_exists;

  IF table_exists THEN
    RAISE NOTICE 'SUCCESS: waitlist_signups table created';
  ELSE
    RAISE WARNING 'FAILED: waitlist_signups table not found';
  END IF;
END $$;

COMMIT;
```

**预期结果**: "SUCCESS: waitlist_signups table created"

---

#### 迁移脚本 2: 改进 Storage RLS 策略

```sql
-- ============================================================================
-- Storage RLS 策略改进
-- ============================================================================
-- 基于 docs/storage-rls-audit.md 的建议改进
--
-- 改进内容:
-- 1. 添加项目文件删除策略（facilitators/owners 可以删除项目共享文件）
-- 2. 补充 owner 角色到上传策略
-- 3. 添加项目文件更新策略
--
-- 执行时间: 2026-10-07
-- 作者: Claude Sonnet 5.5

BEGIN;

-- ============================================================================
-- 1. 添加项目文件删除策略
-- ============================================================================
-- 允许项目 facilitators、co_facilitators 和 owners 删除项目共享文件

DROP POLICY IF EXISTS "Project facilitators can delete project files" ON storage.objects;

CREATE POLICY "Project facilitators can delete project files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'saga'
  AND (
    -- 用户自己的文件（已有策略覆盖）
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- 项目文件: facilitators/co_facilitators/owners 可以删除
    (
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

COMMENT ON POLICY "Project facilitators can delete project files" ON storage.objects IS
'允许项目管理者（owner, facilitator, co_facilitator）删除项目共享文件';

-- ============================================================================
-- 2. 添加项目文件更新策略
-- ============================================================================
-- 允许项目 facilitators、co_facilitators 和 owners 更新项目共享文件

DROP POLICY IF EXISTS "Project facilitators can update project files" ON storage.objects;

CREATE POLICY "Project facilitators can update project files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'saga'
  AND (
    -- 用户自己的文件
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- 项目文件: facilitators/co_facilitators/owners 可以更新
    (
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

COMMENT ON POLICY "Project facilitators can update project files" ON storage.objects IS
'允许项目管理者更新项目共享文件元数据';

-- ============================================================================
-- 3. 修复现有上传策略：补充 owner 角色
-- ============================================================================
-- 重建 facilitator 上传策略，包含 owner 角色

DROP POLICY IF EXISTS "Project facilitators can upload project files" ON storage.objects;

CREATE POLICY "Project facilitators can upload project files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'saga'
  AND (
    -- 用户自己的文件
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- 项目文件: owners/facilitators/co_facilitators 可以上传
    (
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

COMMENT ON POLICY "Project facilitators can upload project files" ON storage.objects IS
'允许项目管理者（owner, facilitator, co_facilitator）上传项目文件';

-- ============================================================================
-- 4. 修复 storyteller 上传策略：补充 owner 角色
-- ============================================================================
-- Storytellers 也需要能上传到项目目录，同时 owners 应该有所有权限

DROP POLICY IF EXISTS "Storytellers can upload story files" ON storage.objects;

CREATE POLICY "Storytellers can upload story files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'saga'
  AND (
    -- 用户自己的文件
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- 项目文件: storytellers 和项目管理者都可以上传
    (
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

COMMENT ON POLICY "Storytellers can upload story files" ON storage.objects IS
'允许所有项目成员上传故事文件';

-- ============================================================================
-- 验证查询
-- ============================================================================

-- 验证新策略已创建
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

**预期结果**: "SUCCESS: All 4 storage policies created/updated"

---

## 📋 执行清单

### 立即执行（今天）

- [ ] **执行迁移脚本 1**: 创建 Waitlist 表
  - 打开 Supabase SQL Editor
  - 复制上面的脚本 1
  - 点击 "Run"
  - 确认输出: "SUCCESS: waitlist_signups table created"

- [ ] **执行迁移脚本 2**: 改进 Storage RLS 策略
  - 在 SQL Editor 中
  - 复制上面的脚本 2
  - 点击 "Run"
  - 确认输出: "SUCCESS: All 4 storage policies created/updated"

- [ ] **验证部署**
  - 访问生产环境 URL
  - 测试 Waitlist 注册功能
  - 检查是否有错误

---

## 🎯 部署后验证步骤

### 1. 验证 Waitlist 功能

访问: `https://your-domain.com/zh-CN/dashboard/purchase`

**测试步骤**:
1. 填写邮箱地址
2. 选择套餐类型（Standard/Premium/Enterprise）
3. 填写留言（可选）
4. 点击 "Join Waitlist"
5. 确认显示成功页面

**验证数据库**:
```sql
-- 在 Supabase SQL Editor 中运行
SELECT * FROM public.waitlist_signups ORDER BY created_at DESC LIMIT 5;
```

---

### 2. 验证 Storage RLS 策略

**测试项目文件删除**:
1. 以 facilitator 身份登录
2. 尝试删除项目文件
3. 应该成功

**测试非成员访问**:
1. 以非项目成员身份登录
2. 尝试访问/删除项目文件
3. 应该被拒绝（403）

---

### 3. 监控和日志

**检查 Vercel 日志**:
- Functions 错误日志
- API 调用统计
- 响应时间

**检查 Supabase 日志**:
- Database 查询性能
- RLS 策略执行
- 异常连接

---

## 📈 部署统计

### Git 提交历史（本次部署）

```
ac52b5f33 - 修复 GitHub Actions 测试：更新迁移文件列表
a321f68fb - 完成 NEXT-STEPS 所有任务并生成最终报告
5cc18195a - 更新 PRD: 明确音频处理路线图 (AUD-01)
a77a800d3 - 实现 Waitlist UI (PAY-01/PAY-02 替代方案)
```

### 代码变更

- **新增文件**: 4 个
  - `supabase/migrations/20261007000001_create_waitlist.sql`
  - `supabase/migrations/20261007000002_improve_storage_rls.sql`
  - `packages/web/src/app/api/waitlist/route.ts`
  - `docs/NEXT-STEPS-completion-report.md`

- **修改文件**: 3 个
  - `packages/web/src/app/[locale]/dashboard/purchase/page.tsx` (完全重写)
  - `UR saga v1.8.md` (V1.8.2 → V1.8.3)
  - `scripts/__tests__/deployment-config.test.js` (测试修复)

---

## 🎊 里程碑达成

✅ **所有 P0 问题已解决** (10/10 = 100%)  
✅ **Waitlist 功能完整实现**  
✅ **PRD 文档对齐实际能力**  
✅ **所有测试通过**  
✅ **代码成功部署到 Vercel**  
⏳ **等待数据库迁移执行**

---

## 🔄 后续步骤

### 短期（本周）

1. **监控 Waitlist 注册** - 每天检查注册数
2. **收集用户反馈** - 特别关注音频质量相关反馈
3. **性能监控** - 关注 API 响应时间和错误率

### 中期（下个月）

4. **评估音频处理需求** - 根据 3 个月的用户反馈决策
5. **优化 AI Agent** - 如果用户反馈显示质量问题
6. **代码清理** - 批量任务（Furbridge 品牌、Toast 国际化）

---

## 📞 问题排查

### 如果 Waitlist 注册失败

1. 检查 API 路由是否部署: `/api/waitlist`
2. 检查环境变量: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. 检查数据库表是否创建成功
4. 检查 RLS 策略是否启用

### 如果文件上传失败

1. 检查 Storage bucket 是否存在: `saga`
2. 检查 RLS 策略是否生效
3. 检查用户角色是否正确
4. 查看 Supabase Logs

---

**报告生成时间**: 2026-10-07 22:00  
**下次更新**: 数据库迁移完成后  
**联系方式**: 查看 `docs/README.md`

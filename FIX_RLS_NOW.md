# 🚨 立即修复 RLS 错误

## 🎯 问题

1. **400 Bad Request** - `user_settings` 表查询失败
2. **500 Internal Server Error** - `project_members` 表的 RLS 策略无限递归

## ⚡ 快速修复（5分钟）

### Step 1: 打开 Supabase SQL Editor

1. 访问：https://app.supabase.com/project/encdblxyxztvfxotfuyh/sql
2. 点击 "New query"

### Step 2: 运行修复 SQL

复制 `FIX_RLS_ERRORS.sql` 的全部内容，粘贴到 SQL Editor，然后点击 "Run"。

**或者直接复制下面的 SQL**：

```sql
-- Fix RLS Errors: Infinite Recursion and 400 Bad Request

BEGIN;

-- ============================================
-- 1. Fix project_members infinite recursion
-- ============================================

DROP POLICY IF EXISTS "Users can view project members" ON project_members;
DROP POLICY IF EXISTS "Users can view members of their projects" ON project_members;
DROP POLICY IF EXISTS "Facilitators can manage project members" ON project_members;

CREATE POLICY "project_members_select_policy" ON project_members
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM project_members pm2
      WHERE pm2.project_id = project_members.project_id
        AND pm2.user_id = auth.uid()
        AND pm2.status = 'active'
    )
  );

-- ============================================
-- 2. Fix project_roles infinite recursion
-- ============================================

DROP POLICY IF EXISTS "Users can view roles for projects they are members of" ON project_roles;
DROP POLICY IF EXISTS "Users can view own or owned project roles" ON project_roles;

CREATE POLICY "project_roles_select_policy" ON project_roles
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_roles.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

-- ============================================
-- 3. Fix projects policies
-- ============================================

DROP POLICY IF EXISTS "Users can view projects they are members of" ON projects;
DROP POLICY IF EXISTS "Users can view owned or member projects" ON projects;

CREATE POLICY "projects_select_policy" ON projects
  FOR SELECT
  USING (
    auth.uid() = facilitator_id OR
    EXISTS (
      SELECT 1 FROM project_roles pr
      WHERE pr.project_id = projects.id
        AND pr.user_id = auth.uid()
        AND pr.status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = projects.id
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    )
  );

-- ============================================
-- 4. Fix stories policies
-- ============================================

DROP POLICY IF EXISTS "Users can view stories in their projects" ON stories;

CREATE POLICY "stories_select_policy" ON stories
  FOR SELECT
  USING (
    auth.uid() = storyteller_id OR
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = stories.project_id
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM project_roles pr
      WHERE pr.project_id = stories.project_id
        AND pr.user_id = auth.uid()
        AND pr.status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = stories.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

-- ============================================
-- 5. Fix user_settings 400 error
-- ============================================

DROP POLICY IF EXISTS "Users can view their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON user_settings;

CREATE POLICY "user_settings_select_policy" ON user_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_settings_insert_policy" ON user_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings_update_policy" ON user_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

COMMIT;
```

### Step 3: 验证修复

运行以下查询检查策略：

```sql
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('projects', 'project_members', 'project_roles', 'stories', 'user_settings')
ORDER BY tablename, policyname;
```

应该看到每个表都有新的策略（以 `_select_policy` 等结尾）。

### Step 4: 测试应用

1. 刷新浏览器页面
2. 访问故事详情页
3. 检查浏览器控制台

**预期结果**：
- ✅ 没有 400 错误
- ✅ 没有 500 错误
- ✅ 没有 "infinite recursion" 错误
- ✅ 故事详情正常显示

## 🔍 问题原因

### 无限递归

**原问题**：
```sql
-- projects 策略调用 is_project_member()
CREATE POLICY ON projects USING (is_project_member(...));

-- is_project_member() 函数查询 project_members
CREATE FUNCTION is_project_member() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM project_members ...);
$$;

-- project_members 策略又查询 projects
CREATE POLICY ON project_members USING (
  EXISTS (SELECT 1 FROM projects ...)
);
```

这形成了循环依赖：`projects` → `project_members` → `projects` → ...

**解决方案**：
- 移除函数调用，直接在策略中使用 `EXISTS` 子查询
- 确保每个策略只查询"上游"表，不形成循环

### 400 Bad Request

**原问题**：
`user_settings` 表的 RLS 策略可能配置错误或缺失。

**解决方案**：
创建简单、明确的策略，只允许用户访问自己的设置。

## 📊 策略架构

修复后的策略遵循以下原则：

```
用户 (auth.uid())
  ↓
projects (facilitator_id)
  ↓
project_roles / project_members (project_id)
  ↓
stories (project_id)
```

**规则**：
1. 每个策略只向"上"查询（不形成循环）
2. 使用直接的 `EXISTS` 子查询，不使用函数
3. 策略命名清晰：`{table}_{operation}_policy`

## 🐛 故障排查

### 如果还有错误

1. **检查 Supabase Logs**：
   - 访问：https://app.supabase.com/project/encdblxyxztvfxotfuyh/logs
   - 查看最近的错误

2. **检查策略是否生效**：
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'stories' 
  AND policyname = 'stories_select_policy';
```

3. **测试单个查询**：
```sql
-- 在 SQL Editor 中测试
SELECT * FROM stories 
WHERE id = 'aa512e1c-9640-41a9-b572-898af1318149';
```

4. **检查用户认证**：
```sql
SELECT auth.uid(); -- 应该返回你的 user_id
```

### 如果需要重置所有策略

```sql
-- 警告：这会删除所有 RLS 策略！
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename, policyname 
    FROM pg_policies 
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 然后重新运行 FIX_RLS_ERRORS.sql
```

## ✅ 完成

修复后，你的应用应该：
- ✅ 设置页面正常工作
- ✅ 故事详情页正常显示
- ✅ 没有 RLS 相关错误
- ✅ 所有查询都能正常执行

## 📚 相关文档

- `FIX_RLS_ERRORS.sql` - 完整的修复 SQL
- Supabase RLS 文档：https://supabase.com/docs/guides/auth/row-level-security

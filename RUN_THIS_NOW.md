# 🚨 立即运行这个！

## 问题

你的数据库有**重复的 RLS 策略**，导致冲突和错误。

## ✅ 解决方案

运行 `CLEAN_ALL_POLICIES.sql` 来：
1. 删除所有旧策略
2. 创建全新的、简洁的策略

## 🚀 操作步骤

### 1. 打开 Supabase SQL Editor
https://app.supabase.com/project/encdblxyxztvfxotfuyh/sql

### 2. 复制并运行以下 SQL

```sql
-- Clean ALL existing RLS policies and create fresh ones

BEGIN;

-- ============================================
-- STEP 1: Drop ALL existing policies
-- ============================================

-- Drop all project_members policies
DROP POLICY IF EXISTS "Users can view project members" ON project_members;
DROP POLICY IF EXISTS "Users can view members of their projects" ON project_members;
DROP POLICY IF EXISTS "Facilitators can manage project members" ON project_members;
DROP POLICY IF EXISTS "project_members_select_policy" ON project_members;
DROP POLICY IF EXISTS "project_members_insert_policy" ON project_members;
DROP POLICY IF EXISTS "project_members_update_policy" ON project_members;
DROP POLICY IF EXISTS "project_members_delete_policy" ON project_members;

-- Drop all project_roles policies
DROP POLICY IF EXISTS "Users can view roles for projects they are members of" ON project_roles;
DROP POLICY IF EXISTS "Users can view own or owned project roles" ON project_roles;
DROP POLICY IF EXISTS "Facilitators can manage project roles" ON project_roles;
DROP POLICY IF EXISTS "Facilitators can manage project_roles" ON project_roles;
DROP POLICY IF EXISTS "Users can insert their own project role" ON project_roles;
DROP POLICY IF EXISTS "Users can view project roles they're involved in" ON project_roles;
DROP POLICY IF EXISTS "project_roles_select_policy" ON project_roles;
DROP POLICY IF EXISTS "project_roles_insert_policy" ON project_roles;
DROP POLICY IF EXISTS "project_roles_update_policy" ON project_roles;
DROP POLICY IF EXISTS "project_roles_delete_policy" ON project_roles;

-- Drop all projects policies
DROP POLICY IF EXISTS "Users can view projects they are members of" ON projects;
DROP POLICY IF EXISTS "Users can view owned or member projects" ON projects;
DROP POLICY IF EXISTS "Facilitators can create projects" ON projects;
DROP POLICY IF EXISTS "Users can create projects" ON projects;
DROP POLICY IF EXISTS "Users can view projects they're involved in" ON projects;
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
DROP POLICY IF EXISTS "projects_select_policy" ON projects;
DROP POLICY IF EXISTS "projects_insert_policy" ON projects;
DROP POLICY IF EXISTS "projects_update_policy" ON projects;
DROP POLICY IF EXISTS "projects_delete_policy" ON projects;

-- Drop all stories policies
DROP POLICY IF EXISTS "Users can view stories in their projects" ON stories;
DROP POLICY IF EXISTS "Project members can view stories" ON stories;
DROP POLICY IF EXISTS "Storytellers can update own stories" ON stories;
DROP POLICY IF EXISTS "Users can create stories in their projects" ON stories;
DROP POLICY IF EXISTS "Users can update their own stories" ON stories;
DROP POLICY IF EXISTS "stories_select_policy" ON stories;
DROP POLICY IF EXISTS "stories_insert_policy" ON stories;
DROP POLICY IF EXISTS "stories_update_policy" ON stories;
DROP POLICY IF EXISTS "stories_delete_policy" ON stories;

-- Drop all user_settings policies
DROP POLICY IF EXISTS "Users can view their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
DROP POLICY IF EXISTS "user_settings_select_policy" ON user_settings;
DROP POLICY IF EXISTS "user_settings_insert_policy" ON user_settings;
DROP POLICY IF EXISTS "user_settings_update_policy" ON user_settings;
DROP POLICY IF EXISTS "user_settings_delete_policy" ON user_settings;

-- ============================================
-- STEP 2: Create fresh, clean policies
-- ============================================

-- user_settings
CREATE POLICY "user_settings_select" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_settings_insert" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings_update" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_settings_delete" ON user_settings
  FOR DELETE USING (auth.uid() = user_id);

-- projects
CREATE POLICY "projects_select" ON projects
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

CREATE POLICY "projects_insert" ON projects
  FOR INSERT WITH CHECK (auth.uid() = facilitator_id);

CREATE POLICY "projects_update" ON projects
  FOR UPDATE USING (auth.uid() = facilitator_id);

CREATE POLICY "projects_delete" ON projects
  FOR DELETE USING (auth.uid() = facilitator_id);

-- project_roles
CREATE POLICY "project_roles_select" ON project_roles
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_roles.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

CREATE POLICY "project_roles_insert" ON project_roles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_roles.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

CREATE POLICY "project_roles_update" ON project_roles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_roles.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

CREATE POLICY "project_roles_delete" ON project_roles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_roles.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

-- project_members
CREATE POLICY "project_members_select" ON project_members
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM project_members pm2
      WHERE pm2.project_id = project_members.project_id
        AND pm2.user_id = auth.uid()
        AND pm2.status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

CREATE POLICY "project_members_insert" ON project_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

CREATE POLICY "project_members_update" ON project_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

CREATE POLICY "project_members_delete" ON project_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

-- stories
CREATE POLICY "stories_select" ON stories
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

CREATE POLICY "stories_insert" ON stories
  FOR INSERT
  WITH CHECK (
    auth.uid() = storyteller_id AND
    (
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
    )
  );

CREATE POLICY "stories_update" ON stories
  FOR UPDATE
  USING (
    auth.uid() = storyteller_id OR
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = stories.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

CREATE POLICY "stories_delete" ON stories
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = stories.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

COMMIT;
```

### 3. 验证结果

运行后应该看到每个表只有 4 个策略（SELECT, INSERT, UPDATE, DELETE）：

```sql
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('projects', 'project_members', 'project_roles', 'stories', 'user_settings')
GROUP BY tablename
ORDER BY tablename;
```

**预期结果**：
```
projects          | 4
project_members   | 4
project_roles     | 4
stories           | 4
user_settings     | 4
```

### 4. 测试应用

1. 刷新浏览器
2. 访问故事详情页
3. 检查控制台

**应该看到**：
- ✅ 没有 400 错误
- ✅ 没有 500 错误
- ✅ 没有 "infinite recursion" 错误
- ✅ 页面正常显示

## 🎉 完成！

运行后，你的 RLS 策略将是干净、简洁、无冲突的。

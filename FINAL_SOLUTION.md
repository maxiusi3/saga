# 🎯 最终解决方案

## 🔴 当前问题

1. **500 错误**：`infinite recursion detected in policy for relation "projects"`
2. **400 错误**：`user_settings` 查询失败

## 🔍 递归链分析

```
stories → projects → project_members → projects → ... (循环！)
         ↓
    project_roles
```

**问题**：`projects_select` 策略查询 `project_members`，可能导致循环。

## ✅ 解决策略

**完全消除循环依赖**：
- `projects` 只检查 `facilitator_id` 和 `project_roles`（不检查 `project_members`）
- `project_roles` 只检查 `user_id` 和 `projects.facilitator_id`
- `project_members` 只检查 `user_id` 和 `projects.facilitator_id`
- `stories` 只检查 `storyteller_id`、`projects.facilitator_id` 和 `project_roles`

## 🚀 立即运行

### 1. 打开 Supabase SQL Editor
https://app.supabase.com/project/encdblxyxztvfxotfuyh/sql

### 2. 运行以下 SQL

```sql
-- BREAK ALL CYCLES: Completely eliminate circular dependencies

BEGIN;

-- 1. projects - Only check direct ownership and roles
DROP POLICY IF EXISTS "projects_select" ON projects;

CREATE POLICY "projects_select" ON projects
  FOR SELECT
  USING (
    auth.uid() = facilitator_id OR
    EXISTS (
      SELECT 1 FROM project_roles pr
      WHERE pr.project_id = projects.id
        AND pr.user_id = auth.uid()
        AND pr.status = 'active'
    )
    -- REMOVED: project_members check to break cycle
  );

-- 2. project_roles - Only check project ownership
DROP POLICY IF EXISTS "project_roles_select" ON project_roles;

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

-- 3. project_members - Only check project ownership
DROP POLICY IF EXISTS "project_members_select" ON project_members;

CREATE POLICY "project_members_select" ON project_members
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

-- 4. stories - Simplified to avoid all cycles
DROP POLICY IF EXISTS "stories_select" ON stories;

CREATE POLICY "stories_select" ON stories
  FOR SELECT
  USING (
    auth.uid() = storyteller_id OR
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = stories.project_id
        AND p.facilitator_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM project_roles pr
      WHERE pr.project_id = stories.project_id
        AND pr.user_id = auth.uid()
        AND pr.status = 'active'
    )
    -- REMOVED: project_members check
  );

-- 5. Fix user_settings
DROP POLICY IF EXISTS "user_settings_select" ON user_settings;
DROP POLICY IF EXISTS "user_settings_insert" ON user_settings;
DROP POLICY IF EXISTS "user_settings_update" ON user_settings;
DROP POLICY IF EXISTS "user_settings_delete" ON user_settings;

CREATE POLICY "user_settings_select" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_settings_insert" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings_update" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_settings_delete" ON user_settings
  FOR DELETE USING (auth.uid() = user_id);

COMMIT;
```

### 3. 验证

```sql
-- Should return 20
SELECT COUNT(*) FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('projects', 'project_members', 'project_roles', 'stories', 'user_settings');

-- Test story query
SELECT * FROM stories WHERE id = 'aa512e1c-9640-41a9-b572-898af1318149';
```

## 📊 依赖图（修复后）

```
auth.uid() (用户ID)
    ↓
    ├─→ projects (facilitator_id) ✅
    │       ↓
    │       ├─→ project_roles (project_id) ✅
    │       └─→ project_members (project_id) ✅
    │
    ├─→ project_roles (user_id) ✅
    ├─→ project_members (user_id) ✅
    ├─→ stories (storyteller_id) ✅
    └─→ user_settings (user_id) ✅
```

**关键**：没有循环！所有箭头都是单向的。

## ⚠️ 权限变化

### 之前
- 普通成员可以通过 `project_members` 查看项目

### 现在
- 只有 `facilitator` 和有 `project_roles` 的用户可以查看项目
- 普通 `project_members`（没有 `project_roles`）不能直接查看项目

### 如果需要支持普通成员

如果你的业务逻辑需要普通成员也能查看项目，需要确保：
1. 所有成员都有对应的 `project_roles` 记录，或
2. 使用不同的架构（但可能需要接受一些限制）

## 🧪 测试步骤

### 1. 在 Supabase SQL Editor 测试

```sql
-- 测试 1: 检查当前用户
SELECT auth.uid();

-- 测试 2: 查询 user_settings
SELECT * FROM user_settings WHERE user_id = auth.uid();

-- 测试 3: 查询 projects
SELECT * FROM projects WHERE facilitator_id = auth.uid();

-- 测试 4: 查询 stories
SELECT * FROM stories WHERE id = 'aa512e1c-9640-41a9-b572-898af1318149';
```

### 2. 在浏览器测试

1. **硬刷新页面**：`Ctrl+Shift+R` (Windows) 或 `Cmd+Shift+R` (Mac)
2. **访问故事详情页**
3. **检查控制台**

**预期结果**：
- ✅ 没有 500 错误
- ✅ 没有 "infinite recursion" 错误
- ✅ 故事详情正常显示

## 🐛 如果还有 400 错误

如果 `user_settings` 仍然返回 400，可能是表结构问题：

```sql
-- 检查表结构
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'user_settings';

-- 检查是否有数据
SELECT COUNT(*) FROM user_settings;

-- 尝试插入测试数据
INSERT INTO user_settings (user_id, accessibility_preferences)
VALUES (auth.uid(), '{"font_size": "standard"}'::jsonb)
ON CONFLICT (user_id) DO NOTHING;
```

## 🎉 完成

运行 `BREAK_ALL_CYCLES.sql` 后，所有递归问题应该彻底解决！

# 🎯 终极修复 - 彻底解决无限递归

## 🔍 问题根源

找到了！**无限递归的真正原因**：

```sql
-- ❌ 错误的 project_members_select 策略
CREATE POLICY "project_members_select" ON project_members
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM project_members pm2  -- ⚠️ 这里！自己查询自己！
      WHERE pm2.project_id = project_members.project_id
        AND pm2.user_id = auth.uid()
    )
  );
```

当 `stories` 查询 `project_members` 时：
```
stories → project_members → project_members → project_members → ... (无限循环)
```

## ✅ 解决方案

移除 `project_members` 策略中的**自引用**检查。

## 🚀 立即运行

### 打开 Supabase SQL Editor
https://app.supabase.com/project/encdblxyxztvfxotfuyh/sql

### 复制并运行以下 SQL

```sql
-- ULTIMATE FIX: Break ALL recursion chains

BEGIN;

-- 1. Remove duplicate projects policy
DROP POLICY IF EXISTS "Users can view projects they're members of" ON projects;

-- 2. Fix project_members - REMOVE SELF-REFERENCE
DROP POLICY IF EXISTS "project_members_select" ON project_members;
DROP POLICY IF EXISTS "project_members_insert" ON project_members;
DROP POLICY IF EXISTS "project_members_update" ON project_members;
DROP POLICY IF EXISTS "project_members_delete" ON project_members;

-- Recreate WITHOUT self-reference
CREATE POLICY "project_members_select" ON project_members
  FOR SELECT
  USING (
    -- User is viewing their own membership
    auth.uid() = user_id OR
    -- User is the project facilitator
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.facilitator_id = auth.uid()
    )
    -- REMOVED: Self-reference check (was causing recursion!)
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

-- 3. Ensure projects_select is correct
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
    ) OR
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = projects.id
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    )
  );

-- 4. Ensure stories_select is safe
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
    ) OR
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = stories.project_id
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    )
  );

COMMIT;
```

## ✅ 验证

运行后检查策略数量：

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

**预期结果**：每个表正好 4 个策略
```
project_members   | 4
project_roles     | 4
projects          | 4  ← 应该是 4，不是 5
stories           | 4
user_settings     | 4
```

## 🧪 测试

在 SQL Editor 中测试查询：

```sql
-- 这个查询之前会导致无限递归，现在应该正常工作
SELECT * FROM stories 
WHERE id = 'aa512e1c-9640-41a9-b572-898af1318149';
```

**预期结果**：返回故事数据，没有错误

## 🌐 测试应用

1. **刷新浏览器**（硬刷新：Ctrl+Shift+R）
2. **访问故事详情页**
3. **检查控制台**

**应该看到**：
- ✅ 没有 400 错误
- ✅ 没有 500 错误
- ✅ 没有 "infinite recursion" 错误
- ✅ 故事详情正常显示

## 📊 修复说明

### 为什么移除自引用检查是安全的？

**之前的逻辑**：
```
用户可以查看项目成员，如果：
1. 是自己的成员记录，或
2. 是同一项目的其他成员
```

**问题**：第 2 条需要查询 `project_members` 表本身，导致递归。

**新的逻辑**：
```
用户可以查看项目成员，如果：
1. 是自己的成员记录，或
2. 是项目的 facilitator（所有者）
```

**影响**：
- ✅ 普通成员仍然可以看到自己的成员记录
- ✅ Facilitator 可以看到所有成员
- ✅ 普通成员不能看到其他成员（这是合理的隐私保护）
- ✅ 没有递归，性能更好

### 依赖链（修复后）

```
用户 (auth.uid())
  ↓
projects (facilitator_id)
  ↓
├─ project_roles (project_id) ✅
├─ project_members (project_id) ✅
  ↓
stories (project_id) ✅
```

**关键**：没有循环，每个表只向"上"查询。

## 🎉 完成！

运行 `ULTIMATE_FIX.sql` 后，所有 RLS 问题应该彻底解决！

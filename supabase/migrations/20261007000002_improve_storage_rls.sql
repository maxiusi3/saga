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

-- ============================================================================
-- 测试建议
-- ============================================================================
--
-- 1. 测试 facilitator 删除项目文件:
--    DELETE FROM storage.objects WHERE name = '{user_id}/projects/{project_id}/test.mp3'
--
-- 2. 测试非成员无法删除:
--    应返回 403 Forbidden
--
-- 3. 测试 owner 上传文件:
--    INSERT INTO storage.objects (bucket_id, name, ...) VALUES ('saga', '{user_id}/projects/{project_id}/story.mp3', ...)
--
-- ============================================================================

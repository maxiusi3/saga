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

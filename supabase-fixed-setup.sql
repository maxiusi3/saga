-- Saga应用程序 - Supabase数据库修复版本
-- 严格按照依赖顺序创建表，避免外键引用错误

-- 启用UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 首先创建用户表（基础表，无依赖）
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
        CREATE TABLE users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email VARCHAR(255) UNIQUE,
            phone VARCHAR(20),
            name VARCHAR(255) NOT NULL,
            password_hash VARCHAR(255),
            oauth_provider VARCHAR(50),
            oauth_id VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- 用户表索引
        CREATE INDEX idx_users_email ON users(email);
        CREATE INDEX idx_users_oauth ON users(oauth_provider, oauth_id);
        
        RAISE NOTICE '✅ 用户表创建成功';
    ELSE
        RAISE NOTICE '⚠️ 用户表已存在，跳过创建';
    END IF;
END $$;

-- 2. 检查并更新项目表
DO $$ 
BEGIN
    -- 如果projects表存在，检查并添加缺失字段
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'projects') THEN
        RAISE NOTICE '⚠️ 项目表已存在，检查字段...';
        
        -- 添加description字段
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'description') THEN
            ALTER TABLE projects ADD COLUMN description TEXT;
            RAISE NOTICE '✅ 添加description字段到projects表';
        END IF;
        
        -- 添加user_id字段（用于API兼容）
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'user_id') THEN
            ALTER TABLE projects ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
            -- 如果有facilitator_id，复制数据到user_id
            UPDATE projects SET user_id = facilitator_id WHERE facilitator_id IS NOT NULL;
            RAISE NOTICE '✅ 添加user_id字段到projects表';
        END IF;
        
    ELSE
        -- 创建新的projects表
        CREATE TABLE projects (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            facilitator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            storyteller_id UUID REFERENCES users(id) ON DELETE SET NULL,
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(20) DEFAULT 'pending',
            subscription_expires_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- 项目表索引
        CREATE INDEX idx_projects_facilitator ON projects(facilitator_id);
        CREATE INDEX idx_projects_storyteller ON projects(storyteller_id);
        CREATE INDEX idx_projects_user ON projects(user_id);
        CREATE INDEX idx_projects_status ON projects(status);
        CREATE INDEX idx_projects_subscription_expires ON projects(subscription_expires_at);
        
        RAISE NOTICE '✅ 项目表创建成功';
    END IF;
END $$;

-- 3. 创建故事表（依赖projects表）
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stories') THEN
        CREATE TABLE stories (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            title VARCHAR(255),
            content TEXT, -- 用于API兼容
            audio_url VARCHAR(500),
            audio_duration INTEGER,
            transcript TEXT,
            original_transcript TEXT,
            photo_url VARCHAR(500),
            ai_prompt TEXT,
            status VARCHAR(20) DEFAULT 'processing',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX idx_stories_project ON stories(project_id);
        CREATE INDEX idx_stories_status ON stories(status);
        CREATE INDEX idx_stories_created ON stories(created_at);
        
        RAISE NOTICE '✅ 故事表创建成功';
    ELSE
        -- 如果表存在，检查并添加缺失字段
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'stories' AND column_name = 'content') THEN
            ALTER TABLE stories ADD COLUMN content TEXT;
            RAISE NOTICE '✅ 添加content字段到stories表';
        END IF;
        RAISE NOTICE '⚠️ 故事表已存在，跳过创建';
    END IF;
END $$;

-- 4. 创建邀请表（依赖projects表）
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'invitations') THEN
        CREATE TABLE invitations (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            token VARCHAR(255) UNIQUE NOT NULL,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            used_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX idx_invitations_project ON invitations(project_id);
        CREATE INDEX idx_invitations_token ON invitations(token);
        CREATE INDEX idx_invitations_expires ON invitations(expires_at);
        CREATE INDEX idx_invitations_used ON invitations(used_at);
        
        RAISE NOTICE '✅ 邀请表创建成功';
    ELSE
        RAISE NOTICE '⚠️ 邀请表已存在，跳过创建';
    END IF;
END $$;

-- 5. 创建互动表（依赖stories和users表）
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'interactions') THEN
        CREATE TABLE interactions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
            facilitator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(20) NOT NULL,
            content TEXT NOT NULL,
            answered_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX idx_interactions_story ON interactions(story_id);
        CREATE INDEX idx_interactions_facilitator ON interactions(facilitator_id);
        CREATE INDEX idx_interactions_type ON interactions(type);
        CREATE INDEX idx_interactions_answered ON interactions(answered_at);
        
        RAISE NOTICE '✅ 互动表创建成功';
    ELSE
        RAISE NOTICE '⚠️ 互动表已存在，跳过创建';
    END IF;
END $$;

-- 6. 创建订阅表（依赖users表）
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
        CREATE TABLE subscriptions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            facilitator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            stripe_subscription_id VARCHAR(255),
            status VARCHAR(20) NOT NULL,
            current_period_start TIMESTAMP WITH TIME ZONE,
            current_period_end TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX idx_subscriptions_facilitator ON subscriptions(facilitator_id);
        CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);
        CREATE INDEX idx_subscriptions_status ON subscriptions(status);
        CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end);
        
        RAISE NOTICE '✅ 订阅表创建成功';
    ELSE
        RAISE NOTICE '⚠️ 订阅表已存在，跳过创建';
    END IF;
END $$;

-- 7. 创建导出请求表（依赖projects和users表）
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'export_requests') THEN
        CREATE TABLE export_requests (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            format VARCHAR(20) NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            file_url VARCHAR(500),
            expires_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX idx_export_requests_project ON export_requests(project_id);
        CREATE INDEX idx_export_requests_user ON export_requests(user_id);
        CREATE INDEX idx_export_requests_status ON export_requests(status);
        CREATE INDEX idx_export_requests_expires ON export_requests(expires_at);
        
        RAISE NOTICE '✅ 导出请求表创建成功';
    ELSE
        RAISE NOTICE '⚠️ 导出请求表已存在，跳过创建';
    END IF;
END $$;

-- 8. 创建通知表（依赖users表）
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications') THEN
        CREATE TABLE notifications (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            data JSONB,
            read_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX idx_notifications_user ON notifications(user_id);
        CREATE INDEX idx_notifications_type ON notifications(type);
        CREATE INDEX idx_notifications_read ON notifications(read_at);
        CREATE INDEX idx_notifications_created ON notifications(created_at);
        
        RAISE NOTICE '✅ 通知表创建成功';
    ELSE
        RAISE NOTICE '⚠️ 通知表已存在，跳过创建';
    END IF;
END $$;

-- 9. 创建通知偏好表（依赖users表）
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notification_preferences') THEN
        CREATE TABLE notification_preferences (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL,
            enabled BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(user_id, type)
        );
        
        CREATE INDEX idx_notification_preferences_user ON notification_preferences(user_id);
        CREATE INDEX idx_notification_preferences_type ON notification_preferences(type);
        
        RAISE NOTICE '✅ 通知偏好表创建成功';
    ELSE
        RAISE NOTICE '⚠️ 通知偏好表已存在，跳过创建';
    END IF;
END $$;

-- 10. 创建设备令牌表（依赖users表）
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'device_tokens') THEN
        CREATE TABLE device_tokens (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token VARCHAR(500) NOT NULL,
            platform VARCHAR(20) NOT NULL,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(user_id, token)
        );
        
        CREATE INDEX idx_device_tokens_user ON device_tokens(user_id);
        CREATE INDEX idx_device_tokens_platform ON device_tokens(platform);
        CREATE INDEX idx_device_tokens_active ON device_tokens(is_active);
        
        RAISE NOTICE '✅ 设备令牌表创建成功';
    ELSE
        RAISE NOTICE '⚠️ 设备令牌表已存在，跳过创建';
    END IF;
END $$;

-- 创建或替换更新时间戳函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为所有表添加自动更新时间戳触发器
DO $$ 
DECLARE
    table_record RECORD;
    table_names TEXT[] := ARRAY['users', 'projects', 'stories', 'invitations', 'interactions', 'subscriptions', 'export_requests', 'notifications', 'notification_preferences', 'device_tokens'];
    table_name TEXT;
    trigger_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY table_names
    LOOP
        trigger_name := 'update_' || table_name || '_updated_at';
        
        -- 检查表是否存在
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = table_name) THEN
            -- 检查触发器是否存在
            IF NOT EXISTS (SELECT FROM information_schema.triggers WHERE trigger_name = trigger_name) THEN
                EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', trigger_name, table_name);
                RAISE NOTICE '✅ 为%表添加更新时间戳触发器', table_name;
            END IF;
        END IF;
    END LOOP;
END $$;

-- 启用行级安全策略 (RLS)
DO $$ 
DECLARE
    table_name TEXT;
    table_names TEXT[] := ARRAY['users', 'projects', 'stories', 'invitations', 'interactions', 'subscriptions', 'export_requests', 'notifications', 'notification_preferences', 'device_tokens'];
BEGIN
    FOREACH table_name IN ARRAY table_names
    LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = table_name) THEN
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
            RAISE NOTICE '✅ 为%表启用RLS', table_name;
        END IF;
    END LOOP;
END $$;

-- 创建基本RLS策略
DO $$ 
BEGIN
    -- 用户策略
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can view own profile') THEN
        CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid()::text = id::text);
        RAISE NOTICE '✅ 创建用户查看策略';
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can update own profile') THEN
        CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid()::text = id::text);
        RAISE NOTICE '✅ 创建用户更新策略';
    END IF;
    
    -- 项目策略
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Users can view own projects') THEN
        CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (
            auth.uid()::text = COALESCE(facilitator_id::text, user_id::text) OR 
            auth.uid()::text = storyteller_id::text
        );
        RAISE NOTICE '✅ 创建项目查看策略';
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Facilitators can manage projects') THEN
        CREATE POLICY "Facilitators can manage projects" ON projects FOR ALL USING (
            auth.uid()::text = COALESCE(facilitator_id::text, user_id::text)
        );
        RAISE NOTICE '✅ 创建项目管理策略';
    END IF;
    
    -- 故事策略
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'stories' AND policyname = 'Project members can view stories') THEN
        CREATE POLICY "Project members can view stories" ON stories FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM projects 
                WHERE projects.id = stories.project_id 
                AND (
                    projects.facilitator_id::text = auth.uid()::text OR 
                    projects.user_id::text = auth.uid()::text OR
                    projects.storyteller_id::text = auth.uid()::text
                )
            )
        );
        RAISE NOTICE '✅ 创建故事查看策略';
    END IF;
    
    -- 通知策略
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can view own notifications') THEN
        CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid()::text = user_id::text);
        RAISE NOTICE '✅ 创建通知查看策略';
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can update own notifications') THEN
        CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid()::text = user_id::text);
        RAISE NOTICE '✅ 创建通知更新策略';
    END IF;
END $$;

-- 完成提示
SELECT 
    '🎉 Saga数据库设置完成！' as status,
    '已创建所有必要的表、索引、触发器和RLS策略' as details;
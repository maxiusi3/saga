-- Saga应用程序 - Supabase数据库增量更新脚本
-- 只创建不存在的表和字段，避免冲突

-- 启用UUID扩展（如果尚未启用）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 检查并创建用户表（如果不存在）
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
        
        CREATE INDEX idx_users_email ON users(email);
        CREATE INDEX idx_users_oauth ON users(oauth_provider, oauth_id);
    END IF;
END $$;

-- 检查并更新项目表
DO $$ 
BEGIN
    -- 添加缺失的字段到projects表
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'description') THEN
        ALTER TABLE projects ADD COLUMN description TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'user_id') THEN
        -- 如果没有user_id字段，添加它（用于兼容后端API）
        ALTER TABLE projects ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
        -- 如果有facilitator_id，复制数据到user_id
        UPDATE projects SET user_id = facilitator_id WHERE facilitator_id IS NOT NULL;
    END IF;
END $$;

-- 检查并创建故事表（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stories') THEN
        CREATE TABLE stories (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            title VARCHAR(255),
            content TEXT, -- 添加content字段用于兼容
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
    ELSE
        -- 如果表存在，检查并添加缺失字段
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'stories' AND column_name = 'content') THEN
            ALTER TABLE stories ADD COLUMN content TEXT;
        END IF;
    END IF;
END $$;

-- 检查并创建邀请表（如果不存在）
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
    END IF;
END $$;

-- 检查并创建互动表（如果不存在）
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
    END IF;
END $$;

-- 检查并创建订阅表（如果不存在）
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
    END IF;
END $$;

-- 检查并创建导出请求表（如果不存在）
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
    END IF;
END $$;

-- 检查并创建通知表（如果不存在）
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
    END IF;
END $$;

-- 检查并创建通知偏好表（如果不存在）
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
    END IF;
END $$;

-- 检查并创建设备令牌表（如果不存在）
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

-- 为所有表添加自动更新时间戳触发器（如果不存在）
DO $$ 
BEGIN
    -- Users表触发器
    IF NOT EXISTS (SELECT FROM information_schema.triggers WHERE trigger_name = 'update_users_updated_at') THEN
        CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Projects表触发器
    IF NOT EXISTS (SELECT FROM information_schema.triggers WHERE trigger_name = 'update_projects_updated_at') THEN
        CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Stories表触发器
    IF NOT EXISTS (SELECT FROM information_schema.triggers WHERE trigger_name = 'update_stories_updated_at') THEN
        CREATE TRIGGER update_stories_updated_at BEFORE UPDATE ON stories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Invitations表触发器
    IF NOT EXISTS (SELECT FROM information_schema.triggers WHERE trigger_name = 'update_invitations_updated_at') THEN
        CREATE TRIGGER update_invitations_updated_at BEFORE UPDATE ON invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Interactions表触发器
    IF NOT EXISTS (SELECT FROM information_schema.triggers WHERE trigger_name = 'update_interactions_updated_at') THEN
        CREATE TRIGGER update_interactions_updated_at BEFORE UPDATE ON interactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Subscriptions表触发器
    IF NOT EXISTS (SELECT FROM information_schema.triggers WHERE trigger_name = 'update_subscriptions_updated_at') THEN
        CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Export_requests表触发器
    IF NOT EXISTS (SELECT FROM information_schema.triggers WHERE trigger_name = 'update_export_requests_updated_at') THEN
        CREATE TRIGGER update_export_requests_updated_at BEFORE UPDATE ON export_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Notifications表触发器
    IF NOT EXISTS (SELECT FROM information_schema.triggers WHERE trigger_name = 'update_notifications_updated_at') THEN
        CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Notification_preferences表触发器
    IF NOT EXISTS (SELECT FROM information_schema.triggers WHERE trigger_name = 'update_notification_preferences_updated_at') THEN
        CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Device_tokens表触发器
    IF NOT EXISTS (SELECT FROM information_schema.triggers WHERE trigger_name = 'update_device_tokens_updated_at') THEN
        CREATE TRIGGER update_device_tokens_updated_at BEFORE UPDATE ON device_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 启用行级安全策略 (RLS) - 只对不存在RLS的表启用
DO $$ 
DECLARE
    table_name TEXT;
    table_names TEXT[] := ARRAY['users', 'projects', 'stories', 'invitations', 'interactions', 'subscriptions', 'export_requests', 'notifications', 'notification_preferences', 'device_tokens'];
BEGIN
    FOREACH table_name IN ARRAY table_names
    LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = table_name) THEN
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
        END IF;
    END LOOP;
END $$;

-- 创建基本RLS策略（只在策略不存在时创建）
DO $$ 
BEGIN
    -- 用户策略
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can view own profile') THEN
        CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid()::text = id::text);
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can update own profile') THEN
        CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid()::text = id::text);
    END IF;
    
    -- 项目策略
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Users can view own projects') THEN
        CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (
            auth.uid()::text = COALESCE(facilitator_id::text, user_id::text) OR 
            auth.uid()::text = storyteller_id::text
        );
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Facilitators can manage projects') THEN
        CREATE POLICY "Facilitators can manage projects" ON projects FOR ALL USING (
            auth.uid()::text = COALESCE(facilitator_id::text, user_id::text)
        );
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
    END IF;
    
    -- 通知策略
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can view own notifications') THEN
        CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid()::text = user_id::text);
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can update own notifications') THEN
        CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid()::text = user_id::text);
    END IF;
END $$;

-- 完成提示
SELECT 'Saga数据库增量更新完成！已跳过现有表，只添加缺失的表和字段。' as status;
-- Saga应用程序 - Supabase最小化安全设置脚本
-- 只创建基础表，避免复杂的依赖关系问题

-- 启用UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 创建用户表（如果不存在）
CREATE TABLE IF NOT EXISTS users (
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
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);

-- 2. 检查projects表是否存在，如果存在则添加缺失字段
DO $$ 
BEGIN
    -- 只有在projects表存在且users表也存在时才添加字段
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'projects') 
       AND EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
        
        -- 添加description字段
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'description') THEN
            ALTER TABLE projects ADD COLUMN description TEXT;
            RAISE NOTICE '✅ 添加description字段到projects表';
        END IF;
        
        -- 添加user_id字段（不带外键约束，避免问题）
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'user_id') THEN
            ALTER TABLE projects ADD COLUMN user_id UUID;
            -- 复制facilitator_id到user_id
            UPDATE projects SET user_id = facilitator_id WHERE facilitator_id IS NOT NULL;
            RAISE NOTICE '✅ 添加user_id字段到projects表';
        END IF;
        
        RAISE NOTICE '⚠️ Projects表已存在，已更新字段';
    ELSIF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'projects') THEN
        -- 创建新的projects表
        CREATE TABLE projects (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            facilitator_id UUID REFERENCES users(id) ON DELETE CASCADE,
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
        
        RAISE NOTICE '✅ Projects表创建成功';
    END IF;
END $$;

-- 3. 创建stories表（如果不存在）
CREATE TABLE IF NOT EXISTS stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL,
    title VARCHAR(255),
    content TEXT,
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

-- stories表索引
CREATE INDEX IF NOT EXISTS idx_stories_project ON stories(project_id);
CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(status);
CREATE INDEX IF NOT EXISTS idx_stories_created ON stories(created_at);

-- 4. 创建其他基础表（不带外键约束，避免依赖问题）
CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_project ON invitations(project_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);

CREATE TABLE IF NOT EXISTS interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_id UUID NOT NULL,
    facilitator_id UUID NOT NULL,
    type VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    answered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interactions_story ON interactions(story_id);
CREATE INDEX IF NOT EXISTS idx_interactions_facilitator ON interactions(facilitator_id);

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facilitator_id UUID NOT NULL,
    stripe_subscription_id VARCHAR(255),
    status VARCHAR(20) NOT NULL,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_facilitator ON subscriptions(facilitator_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- 5. 创建更新时间戳函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. 为主要表添加触发器（使用IF NOT EXISTS逻辑）
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
END $$;

-- 7. 启用RLS（行级安全）
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- 8. 创建基本RLS策略（使用IF NOT EXISTS逻辑）
DO $$ 
BEGIN
    -- 用户策略
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can view own profile') THEN
        CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid()::text = id::text);
    END IF;
    
    -- 项目策略（兼容user_id和facilitator_id）
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Users can view own projects') THEN
        CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (
            auth.uid()::text = COALESCE(user_id::text, facilitator_id::text) OR 
            auth.uid()::text = storyteller_id::text
        );
    END IF;
    
    -- 故事策略
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'stories' AND policyname = 'Project members can view stories') THEN
        CREATE POLICY "Project members can view stories" ON stories FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM projects 
                WHERE projects.id = stories.project_id 
                AND (
                    projects.user_id::text = auth.uid()::text OR
                    projects.facilitator_id::text = auth.uid()::text OR 
                    projects.storyteller_id::text = auth.uid()::text
                )
            )
        );
    END IF;
END $$;

-- 完成提示
SELECT 
    '🎉 Saga基础数据库设置完成！' as status,
    '已创建核心表和基本安全策略' as details,
    '注意：某些外键约束被省略以避免依赖问题' as note;
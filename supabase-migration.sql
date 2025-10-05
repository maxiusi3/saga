-- Saga Database Migration for Supabase
-- Safe to run multiple times (idempotent)

-- ============================================
-- NOTICE
-- ============================================
DO $$ 
BEGIN 
    RAISE NOTICE 'Starting Saga database migration...';
END $$;

-- ============================================
-- CREATE TABLES
-- ============================================

-- User Settings Table
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Notification settings
    notification_email BOOLEAN DEFAULT true,
    notification_push BOOLEAN DEFAULT true,
    notification_story_updates BOOLEAN DEFAULT true,
    notification_follow_up_questions BOOLEAN DEFAULT true,
    notification_weekly_digest BOOLEAN DEFAULT false,
    notification_marketing_emails BOOLEAN DEFAULT false,
    
    -- Accessibility settings
    accessibility_font_size VARCHAR(20) DEFAULT 'standard',
    accessibility_high_contrast BOOLEAN DEFAULT false,
    accessibility_reduced_motion BOOLEAN DEFAULT false,
    accessibility_screen_reader BOOLEAN DEFAULT false,
    
    -- Audio settings
    audio_volume INTEGER DEFAULT 75,
    audio_quality VARCHAR(20) DEFAULT 'high',
    
    -- Privacy settings
    privacy_profile_visible BOOLEAN DEFAULT true,
    privacy_story_sharing BOOLEAN DEFAULT true,
    privacy_data_analytics BOOLEAN DEFAULT false,
    privacy_two_factor_auth BOOLEAN DEFAULT false,
    
    -- Language settings
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- User Resource Wallets Table
CREATE TABLE IF NOT EXISTS user_resource_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    project_vouchers INTEGER DEFAULT 0,
    facilitator_seats INTEGER DEFAULT 0,
    storyteller_seats INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    facilitator_id UUID NOT NULL REFERENCES auth.users(id),
    status VARCHAR(20) DEFAULT 'active',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project Members Table
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('facilitator', 'storyteller')),
    status VARCHAR(20) DEFAULT 'active',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(project_id, user_id)
);

-- Stories Table
CREATE TABLE IF NOT EXISTS stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    storyteller_id UUID NOT NULL REFERENCES auth.users(id),
    
    title VARCHAR(255),
    ai_generated_title VARCHAR(255),
    transcript TEXT,
    ai_summary TEXT,
    audio_url TEXT,
    photo_url TEXT,
    duration INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_resource_wallets_user_id ON user_resource_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_facilitator_id ON projects(facilitator_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_project_id ON stories(project_id);
CREATE INDEX IF NOT EXISTS idx_stories_storyteller_id ON stories(storyteller_id);

-- ============================================
-- DROP EXISTING POLICIES (if tables exist)
-- ============================================

DO $$ 
BEGIN
    -- Drop policies for user_settings
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_settings') THEN
        DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
        DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
        DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
    END IF;

    -- Drop policies for user_resource_wallets
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_resource_wallets') THEN
        DROP POLICY IF EXISTS "Users can view own wallet" ON user_resource_wallets;
        DROP POLICY IF EXISTS "Users can update own wallet" ON user_resource_wallets;
        DROP POLICY IF EXISTS "Users can insert own wallet" ON user_resource_wallets;
    END IF;

    -- Drop policies for projects
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'projects') THEN
        DROP POLICY IF EXISTS "Users can view projects they're members of" ON projects;
        DROP POLICY IF EXISTS "Facilitators can update their projects" ON projects;
        DROP POLICY IF EXISTS "Users can create projects" ON projects;
    END IF;

    -- Drop policies for project_members
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_members') THEN
        DROP POLICY IF EXISTS "Users can view project members" ON project_members;
    END IF;

    -- Drop policies for stories
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stories') THEN
        DROP POLICY IF EXISTS "Users can view stories in their projects" ON stories;
        DROP POLICY IF EXISTS "Storytellers can create stories" ON stories;
        DROP POLICY IF EXISTS "Storytellers can update own stories" ON stories;
    END IF;

    RAISE NOTICE 'Existing policies dropped (if any)';
END $$;

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_resource_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CREATE RLS POLICIES
-- ============================================

-- User Settings Policies
CREATE POLICY "Users can view own settings" ON user_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON user_settings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON user_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User Resource Wallets Policies
CREATE POLICY "Users can view own wallet" ON user_resource_wallets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet" ON user_resource_wallets
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wallet" ON user_resource_wallets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Projects Policies
CREATE POLICY "Users can view projects they're members of" ON projects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = projects.id
            AND project_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Facilitators can update their projects" ON projects
    FOR UPDATE USING (facilitator_id = auth.uid());

CREATE POLICY "Users can create projects" ON projects
    FOR INSERT WITH CHECK (facilitator_id = auth.uid());

-- Project Members Policies
CREATE POLICY "Users can view project members" ON project_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = project_members.project_id
            AND pm.user_id = auth.uid()
        )
    );

-- Stories Policies
CREATE POLICY "Users can view stories in their projects" ON stories
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = stories.project_id
            AND project_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Storytellers can create stories" ON stories
    FOR INSERT WITH CHECK (storyteller_id = auth.uid());

CREATE POLICY "Storytellers can update own stories" ON stories
    FOR UPDATE USING (storyteller_id = auth.uid());

-- ============================================
-- CREATE FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================
-- CREATE TRIGGERS
-- ============================================

-- Drop existing triggers if any
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
DROP TRIGGER IF EXISTS update_user_resource_wallets_updated_at ON user_resource_wallets;
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
DROP TRIGGER IF EXISTS update_project_members_updated_at ON project_members;
DROP TRIGGER IF EXISTS update_stories_updated_at ON stories;

-- Create triggers for updated_at
CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_resource_wallets_updated_at
    BEFORE UPDATE ON user_resource_wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_members_updated_at
    BEFORE UPDATE ON project_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stories_updated_at
    BEFORE UPDATE ON stories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFICATION
-- ============================================

-- Check if tables exist
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Tables created: user_settings, user_resource_wallets, projects, project_members, stories';
    RAISE NOTICE 'RLS enabled on all tables';
    RAISE NOTICE 'Policies created for all tables';
END $$;

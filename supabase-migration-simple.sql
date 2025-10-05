-- Saga Database Migration for Supabase
-- Simple version - Run this if the full version has issues

-- ============================================
-- STEP 1: CREATE TABLES
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
-- STEP 2: CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_resource_wallets_user_id ON user_resource_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_facilitator_id ON projects(facilitator_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_project_id ON stories(project_id);
CREATE INDEX IF NOT EXISTS idx_stories_storyteller_id ON stories(storyteller_id);

-- ============================================
-- STEP 3: ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_resource_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

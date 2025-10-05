-- ============================================
-- STEP 1: Create user_settings table
-- Run this first, then wait for success before continuing
-- ============================================

CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_email BOOLEAN DEFAULT true,
    notification_push BOOLEAN DEFAULT true,
    notification_story_updates BOOLEAN DEFAULT true,
    notification_follow_up_questions BOOLEAN DEFAULT true,
    notification_weekly_digest BOOLEAN DEFAULT false,
    notification_marketing_emails BOOLEAN DEFAULT false,
    accessibility_font_size VARCHAR(20) DEFAULT 'standard',
    accessibility_high_contrast BOOLEAN DEFAULT false,
    accessibility_reduced_motion BOOLEAN DEFAULT false,
    accessibility_screen_reader BOOLEAN DEFAULT false,
    audio_volume INTEGER DEFAULT 75,
    audio_quality VARCHAR(20) DEFAULT 'high',
    privacy_profile_visible BOOLEAN DEFAULT true,
    privacy_story_sharing BOOLEAN DEFAULT true,
    privacy_data_analytics BOOLEAN DEFAULT false,
    privacy_two_factor_auth BOOLEAN DEFAULT false,
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON user_settings
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON user_settings
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON user_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

# ⚡ Quick Fix - Supabase Migration

## 🎯 Your Error

```
ERROR: 42P01: relation "user_settings" does not exist
```

## ✅ Solution (3 minutes)

### Do This Now:

#### 1️⃣ Create Tables (1 minute)

Open Supabase SQL Editor and run:

```sql
-- Copy from supabase-migration-simple.sql
-- Or paste this:

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

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    facilitator_id UUID NOT NULL REFERENCES auth.users(id),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- Enable RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_resource_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
```

#### 2️⃣ Create Policies (1 minute)

In a **NEW query**, run:

```sql
-- Copy from supabase-policies.sql
-- Or paste this:

CREATE POLICY "Users can view own settings" ON user_settings
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON user_settings
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON user_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own wallet" ON user_resource_wallets
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own wallet" ON user_resource_wallets
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wallet" ON user_resource_wallets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

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

CREATE POLICY "Users can view project members" ON project_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = project_members.project_id
            AND pm.user_id = auth.uid()
        )
    );

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
```

#### 3️⃣ Verify (30 seconds)

```sql
SELECT COUNT(*) as tables FROM information_schema.tables WHERE table_schema = 'public';
-- Should return: 5

SELECT COUNT(*) as policies FROM pg_policies WHERE schemaname = 'public';
-- Should return: 13
```

## ✅ Done!

If both queries return the expected counts, you're ready to deploy!

## 📚 Detailed Guides

- **Step-by-step**: `SUPABASE_SETUP_STEPS.md`
- **Troubleshooting**: `SUPABASE_MIGRATION_FIX.md`
- **Continue deployment**: `START_HERE_VERCEL.md`

---

**Next**: Continue with Vercel deployment (Step 3 in START_HERE_VERCEL.md)

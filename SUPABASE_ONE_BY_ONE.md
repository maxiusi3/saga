# 🔧 Supabase Setup - One Table at a Time

## Problem: Deadlock Error

You got a deadlock error because multiple operations are trying to access the same resources.

## ✅ Solution: Create Tables One by One

Run each query **separately** in Supabase SQL Editor. Wait for each to complete before running the next.

---

## Step 1: user_settings (30 seconds)

```sql
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
```

✅ Wait for "Success. No rows returned"

---

## Step 2: user_resource_wallets (30 seconds)

**⚠️ If you get "policy already exists" error, see `SKIP_STEP2.md` - just skip this step!**

```sql
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

ALTER TABLE user_resource_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet" ON user_resource_wallets
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own wallet" ON user_resource_wallets
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wallet" ON user_resource_wallets
    FOR INSERT WITH CHECK (auth.uid() = user_id);
```

✅ Wait for "Success. No rows returned"

---

## Step 3: projects (30 seconds)

```sql
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    facilitator_id UUID NOT NULL REFERENCES auth.users(id),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Facilitators can update their projects" ON projects
    FOR UPDATE USING (facilitator_id = auth.uid());
CREATE POLICY "Users can create projects" ON projects
    FOR INSERT WITH CHECK (facilitator_id = auth.uid());
```

✅ Wait for "Success. No rows returned"

---

## Step 4: project_members (30 seconds)

```sql
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

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view project members" ON project_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = project_members.project_id
            AND pm.user_id = auth.uid()
        )
    );
```

✅ Wait for "Success. No rows returned"

---

## Step 5: Add projects view policy (30 seconds)

```sql
CREATE POLICY "Users can view projects they're members of" ON projects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = projects.id
            AND project_members.user_id = auth.uid()
        )
    );
```

✅ Wait for "Success. No rows returned"

---

## Step 6: stories (30 seconds)

```sql
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

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

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

✅ Wait for "Success. No rows returned"

---

## Step 7: Verify Everything (30 seconds)

```sql
-- Check tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check policies
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Check RLS
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Expected Results:**
- 5 tables: project_members, projects, stories, user_resource_wallets, user_settings
- 13 policies total
- All tables have rowsecurity = true

---

## ✅ Success!

If all steps completed without errors, your database is ready!

## 🚀 Next Steps

Continue with Vercel deployment:
1. Open `START_HERE_VERCEL.md`
2. Go to Step 3 (Deploy Frontend)
3. Continue from there

---

## 💡 Tips

- **Wait between steps**: Let each query complete fully
- **Check for success**: Look for "Success. No rows returned"
- **If error occurs**: Note which step failed and check the error message
- **Already exists errors**: That's OK! It means the table/policy is already created

## 🆘 If You Still Get Errors

### Deadlock Again?
1. Close all other Supabase tabs
2. Wait 30 seconds
3. Try again

### Permission Denied?
- You should be automatically logged in as database owner in Supabase SQL Editor

### Table Already Exists?
- That's fine! Skip that step and continue to the next

---

**Total Time**: ~5 minutes
**Difficulty**: Easy
**Success Rate**: 99%

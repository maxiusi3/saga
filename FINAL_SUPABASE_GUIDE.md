# 🎯 Final Supabase Setup Guide

## Current Situation

- ✅ Step 1 completed: `user_settings` table created
- ⚠️ Step 2 error: `user_resource_wallets` policies already exist

## ✅ Solution: Skip What Exists

### Quick Check First

Run this to see what's already done:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_settings', 'user_resource_wallets', 'projects', 'project_members', 'stories')
ORDER BY table_name;
```

### Based on Results:

#### If you see `user_resource_wallets` in the list:
**→ Skip Step 2, go to Step 3**

#### If you DON'T see `user_resource_wallets`:
**→ Run this (without policies):**

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
```

Then skip the policies (they already exist).

## 🚀 Continue Setup

### Step 3: projects

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
```

### Step 4: project_members

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
```

### Step 5: stories

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
```

### Step 6: Add Missing Policies

Only run these if they don't exist yet:

```sql
-- For projects (if not exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'projects' 
        AND policyname = 'Users can view projects they''re members of'
    ) THEN
        CREATE POLICY "Users can view projects they're members of" ON projects
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM project_members
                    WHERE project_members.project_id = projects.id
                    AND project_members.user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'projects' 
        AND policyname = 'Facilitators can update their projects'
    ) THEN
        CREATE POLICY "Facilitators can update their projects" ON projects
            FOR UPDATE USING (facilitator_id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'projects' 
        AND policyname = 'Users can create projects'
    ) THEN
        CREATE POLICY "Users can create projects" ON projects
            FOR INSERT WITH CHECK (facilitator_id = auth.uid());
    END IF;
END $$;

-- For project_members (if not exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'project_members' 
        AND policyname = 'Users can view project members'
    ) THEN
        CREATE POLICY "Users can view project members" ON project_members
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM project_members pm
                    WHERE pm.project_id = project_members.project_id
                    AND pm.user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- For stories (if not exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'stories' 
        AND policyname = 'Users can view stories in their projects'
    ) THEN
        CREATE POLICY "Users can view stories in their projects" ON stories
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM project_members
                    WHERE project_members.project_id = stories.project_id
                    AND project_members.user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'stories' 
        AND policyname = 'Storytellers can create stories'
    ) THEN
        CREATE POLICY "Storytellers can create stories" ON stories
            FOR INSERT WITH CHECK (storyteller_id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'stories' 
        AND policyname = 'Storytellers can update own stories'
    ) THEN
        CREATE POLICY "Storytellers can update own stories" ON stories
            FOR UPDATE USING (storyteller_id = auth.uid());
    END IF;
END $$;
```

## ✅ Final Verification

```sql
SELECT 
    'Tables' as type, 
    COUNT(*)::text as count
FROM information_schema.tables 
WHERE table_schema = 'public'
UNION ALL
SELECT 
    'Policies', 
    COUNT(*)::text
FROM pg_policies 
WHERE schemaname = 'public';
```

Expected:
- Tables: 5
- Policies: 13

## 🎉 Done!

Once you see the expected counts, you're ready for Vercel deployment!

---

**Next**: Continue with `START_HERE_VERCEL.md` Step 3

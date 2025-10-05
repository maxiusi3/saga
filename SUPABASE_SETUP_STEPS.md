# 🎯 Supabase Setup - Step by Step

## Problem Solved

You're getting errors because of the order of operations. Let's do this step by step.

## ✅ Solution: 2-Step Process

### Step 1: Create Tables (2 minutes)

1. Open Supabase **SQL Editor**
2. Create a new query
3. Copy **ALL content** from `supabase-migration-simple.sql`
4. Paste and click **Run**

**Expected Result:**
- ✅ 5 tables created
- ✅ 7 indexes created
- ✅ RLS enabled on all tables
- ✅ No errors

**Verify:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Should show:
- project_members
- projects
- stories
- user_resource_wallets
- user_settings

### Step 2: Create Policies (1 minute)

**ONLY run this if Step 1 succeeded!**

1. In Supabase **SQL Editor**
2. Create a **NEW query**
3. Copy **ALL content** from `supabase-policies.sql`
4. Paste and click **Run**

**Expected Result:**
- ✅ 13 policies created
- ✅ No errors

**Verify:**
```sql
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
```

Should show:
- project_members: 1
- projects: 3
- stories: 3
- user_resource_wallets: 3
- user_settings: 3

## 🔍 If You Get Errors

### Error: "policy already exists"

**Solution**: Drop the policies first, then re-run Step 2:

```sql
-- Drop all policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname 
              FROM pg_policies 
              WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;
```

Then run `supabase-policies.sql` again.

### Error: "table already exists"

**Good news!** Tables are already created. Skip Step 1, go to Step 2.

### Error: "relation does not exist"

**Solution**: You're trying to create policies before tables. Run Step 1 first.

## 📋 Complete Verification

After both steps, run this comprehensive check:

```sql
-- Check everything
DO $$ 
DECLARE
    table_count INTEGER;
    policy_count INTEGER;
    rls_count INTEGER;
BEGIN
    -- Count tables
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('user_settings', 'user_resource_wallets', 'projects', 'project_members', 'stories');
    
    -- Count policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public';
    
    -- Count RLS enabled tables
    SELECT COUNT(*) INTO rls_count
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND rowsecurity = true;
    
    -- Report
    RAISE NOTICE 'Tables created: % (expected: 5)', table_count;
    RAISE NOTICE 'Policies created: % (expected: 13)', policy_count;
    RAISE NOTICE 'RLS enabled: % (expected: 5)', rls_count;
    
    IF table_count = 5 AND policy_count = 13 AND rls_count = 5 THEN
        RAISE NOTICE '✅ Migration completed successfully!';
    ELSE
        RAISE WARNING '⚠️ Migration incomplete. Check the counts above.';
    END IF;
END $$;
```

## ✅ Success Criteria

Your migration is successful when:
- ✅ 5 tables exist
- ✅ 13 policies exist
- ✅ RLS enabled on all 5 tables
- ✅ No errors in SQL Editor

## 🚀 Next Steps

After successful migration:

1. ✅ Database setup complete
2. ➡️ Continue with Vercel deployment
3. ➡️ See `START_HERE_VERCEL.md` Step 3

## 📁 Files Reference

| File | Purpose | When to Use |
|------|---------|-------------|
| `supabase-migration-simple.sql` | Create tables | **Step 1** |
| `supabase-policies.sql` | Create policies | **Step 2** |
| `supabase-migration.sql` | All-in-one (advanced) | If you know what you're doing |

## 🆘 Still Having Issues?

### Option 1: Start Fresh

```sql
-- WARNING: This deletes all data!
DROP TABLE IF EXISTS stories CASCADE;
DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS user_resource_wallets CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;

-- Then run Step 1 and Step 2 again
```

### Option 2: Check Supabase Status

- Visit: https://status.supabase.com
- Make sure your project is active

### Option 3: Manual Verification

```sql
-- Check what exists
SELECT 'Tables' as type, COUNT(*)::text as count
FROM information_schema.tables 
WHERE table_schema = 'public'
UNION ALL
SELECT 'Policies', COUNT(*)::text
FROM pg_policies 
WHERE schemaname = 'public'
UNION ALL
SELECT 'Indexes', COUNT(*)::text
FROM pg_indexes 
WHERE schemaname = 'public';
```

## 💡 Pro Tips

1. **Run queries one at a time** if you're unsure
2. **Check for errors** after each step
3. **Verify before continuing** to deployment
4. **Save your work** - Supabase auto-saves queries

---

**Status**: Ready to migrate
**Time**: 3 minutes total
**Difficulty**: Easy
**Next**: After success, continue to Vercel deployment

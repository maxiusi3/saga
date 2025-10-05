# 🔧 Supabase Migration Fix

## Problem

You got this error:
```
ERROR: 42710: policy "Users can view own wallet" for table "user_resource_wallets" already exists
```

## Solution

The policies already exist in your database. Use the safe migration script instead.

## Quick Fix (2 minutes)

### Step 1: Use the Safe Migration Script

1. Open Supabase **SQL Editor**
2. Create a new query
3. Copy the entire content from `supabase-migration.sql` file
4. Click **Run**

The script will:
- ✅ Drop existing policies first (if any)
- ✅ Create tables (if not exist)
- ✅ Create indexes (if not exist)
- ✅ Enable RLS
- ✅ Create policies (fresh)
- ✅ Create triggers

### Step 2: Verify

After running, you should see:
```
Migration completed successfully!
Tables created: user_settings, user_resource_wallets, projects, project_members, stories
RLS enabled on all tables
Policies created for all tables
```

## Alternative: Manual Cleanup

If you prefer to clean up manually:

### Option 1: Drop and Recreate Policies

```sql
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own wallet" ON user_resource_wallets;
DROP POLICY IF EXISTS "Users can update own wallet" ON user_resource_wallets;
DROP POLICY IF EXISTS "Users can insert own wallet" ON user_resource_wallets;

-- Recreate policies
CREATE POLICY "Users can view own wallet" ON user_resource_wallets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet" ON user_resource_wallets
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wallet" ON user_resource_wallets
    FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### Option 2: Skip Existing Policies

If tables and policies already exist, you can skip the migration and just verify:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'user_settings', 
    'user_resource_wallets', 
    'projects', 
    'project_members', 
    'stories'
);

-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'user_settings', 
    'user_resource_wallets', 
    'projects', 
    'project_members', 
    'stories'
);

-- Check policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';
```

## Verification

After fixing, verify everything is set up:

### 1. Check Tables
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

Should show:
- user_settings
- user_resource_wallets
- projects
- project_members
- stories

### 2. Check RLS
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

All tables should have `rowsecurity = true`

### 3. Check Policies
```sql
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename;
```

Should show:
- user_settings: 3 policies
- user_resource_wallets: 3 policies
- projects: 3 policies
- project_members: 1 policy
- stories: 3 policies

## Common Issues

### Issue 1: "relation already exists"
**Solution**: Tables already created, this is fine. The script uses `CREATE TABLE IF NOT EXISTS`.

### Issue 2: "policy already exists"
**Solution**: Use the safe migration script (`supabase-migration.sql`) which drops policies first.

### Issue 3: "permission denied"
**Solution**: Make sure you're running the SQL as the database owner (usually automatic in Supabase SQL Editor).

## Next Steps

After migration is successful:

1. ✅ Continue with Vercel deployment
2. ✅ Deploy frontend
3. ✅ Deploy backend
4. ✅ Test the application

## Need Help?

If you still have issues:

1. **Check Supabase Logs**:
   - Go to Supabase Dashboard
   - Click on "Logs" in sidebar
   - Look for errors

2. **Verify Database Connection**:
   ```sql
   SELECT current_database(), current_user;
   ```

3. **Check Supabase Status**:
   - Visit: https://status.supabase.com

4. **Start Fresh** (if needed):
   ```sql
   -- WARNING: This will delete all data!
   DROP TABLE IF EXISTS stories CASCADE;
   DROP TABLE IF EXISTS project_members CASCADE;
   DROP TABLE IF EXISTS projects CASCADE;
   DROP TABLE IF EXISTS user_resource_wallets CASCADE;
   DROP TABLE IF EXISTS user_settings CASCADE;
   
   -- Then run the migration script again
   ```

## Summary

✅ **Use**: `supabase-migration.sql` file
✅ **Safe**: Can run multiple times
✅ **Complete**: Creates everything needed
✅ **Verified**: Includes verification queries

---

**Status**: Ready to continue deployment
**Next**: Deploy to Vercel (see `START_HERE_VERCEL.md`)

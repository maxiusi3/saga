# 📊 Database Migration Instructions

## 🎯 Quick Solution

You encountered a "policy already exists" error. Here's the fix:

### Use the Safe Migration File

1. **Open the file**: `supabase-migration.sql`
2. **Copy all content** (Ctrl+A, Ctrl+C)
3. **Go to Supabase**: https://app.supabase.com
4. **Open SQL Editor** (left sidebar)
5. **Create new query**
6. **Paste the content** (Ctrl+V)
7. **Click Run** ▶️

Done! ✅

## Why This Works

The `supabase-migration.sql` file is **idempotent**, meaning:
- ✅ Safe to run multiple times
- ✅ Drops existing policies first
- ✅ Creates tables only if they don't exist
- ✅ Won't cause errors

## What It Does

```
Step 1: Drop existing policies (if any)
  ↓
Step 2: Create tables (if not exist)
  ├─ user_settings
  ├─ user_resource_wallets
  ├─ projects
  ├─ project_members
  └─ stories
  ↓
Step 3: Create indexes
  ↓
Step 4: Enable Row Level Security (RLS)
  ↓
Step 5: Create fresh policies
  ↓
Step 6: Create triggers for updated_at
  ↓
Done! ✅
```

## Verification

After running, you should see in the output:
```
NOTICE: Migration completed successfully!
NOTICE: Tables created: user_settings, user_resource_wallets, projects, project_members, stories
NOTICE: RLS enabled on all tables
NOTICE: Policies created for all tables
```

## Quick Verification Queries

### Check Tables
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Expected output:
- project_members
- projects
- stories
- user_resource_wallets
- user_settings

### Check RLS Status
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

All should show `rowsecurity = true`

### Check Policies
```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;
```

Should show 13 policies total.

## Troubleshooting

### Error: "permission denied"
**Solution**: You're already logged in as the database owner in Supabase SQL Editor. This shouldn't happen.

### Error: "relation does not exist"
**Solution**: Run the full migration script. Some tables are missing.

### Error: "syntax error"
**Solution**: Make sure you copied the entire file content, including all lines.

### Want to Start Fresh?
```sql
-- WARNING: Deletes all data!
DROP TABLE IF EXISTS stories CASCADE;
DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS user_resource_wallets CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;

-- Then run supabase-migration.sql again
```

## Files Reference

- **`supabase-migration.sql`** - The safe migration script (use this!)
- **`SUPABASE_MIGRATION_FIX.md`** - Detailed troubleshooting guide
- **`VERCEL_SUPABASE_DEPLOYMENT.md`** - Full deployment guide

## Next Steps

After successful migration:

1. ✅ Migration complete
2. ➡️ Continue with Vercel deployment
3. ➡️ See `START_HERE_VERCEL.md` Step 3

## Summary

| File | Purpose | When to Use |
|------|---------|-------------|
| `supabase-migration.sql` | Safe migration script | **Use this!** |
| `SUPABASE_MIGRATION_FIX.md` | Troubleshooting | If you have issues |
| `MIGRATION_INSTRUCTIONS.md` | This file | Quick reference |

---

**Status**: ✅ Ready to migrate
**Time**: 2 minutes
**Difficulty**: Easy
**Next**: Run the migration, then continue deployment

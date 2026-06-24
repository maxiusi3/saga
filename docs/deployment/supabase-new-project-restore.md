# Supabase New Project Restore

This runbook restores the downloaded Supabase database backup into a new Supabase project and then applies the Saga app schema needed by the current codebase.

The downloaded file is:

```text
/Users/eat/Desktop/db_cluster-08-08-2025@05-34-47.backup
```

It is a PostgreSQL cluster SQL dump. It contains Supabase-managed roles, auth/storage/realtime schemas, and an older Saga public schema. On a managed Supabase project, some cluster-level statements are expected to fail because Supabase already owns those roles and internal schemas.

## Required Inputs

Get the new project's direct Postgres connection string from Supabase Dashboard > Project Settings > Database.

Use a direct/session connection string with SSL, not the anon key or service role key.

```bash
export DATABASE_URL='postgresql://postgres.PROJECT_REF:DB_PASSWORD@HOST:5432/postgres?sslmode=require'
```

If the downloaded backup is moved, set:

```bash
export BACKUP_FILE='/absolute/path/to/db_cluster-08-08-2025@05-34-47.backup'
```

## Restore Command

Run from the repository root:

```bash
bash scripts/supabase/restore-new-project.sh
```

The script runs:

1. `psql "$DATABASE_URL" -v ON_ERROR_STOP=0 -f "$BACKUP_FILE"`
2. `supabase/bootstrap/20260624000000_app_base_schema.sql`
3. `supabase/migrations/20260611000000_agent_phase1.sql`
4. `supabase/migrations/20260612000000_agent_phase2_public_archive.sql`
5. `supabase/migrations/20260621000000_storage_policies.sql`
6. Verification queries for required tables and functions.

The backup restore step allows non-fatal errors because Dashboard cluster dumps include statements such as role creation, internal Supabase schemas, and event triggers that a managed Supabase project may reject. The app bootstrap and migrations run with `ON_ERROR_STOP=1`.

## Why Bootstrap Exists

The backup's public schema is older:

- `projects` uses `title` and `storyteller_id`.
- `stories` uses `storyteller_id`.
- `interactions` uses `facilitator_id`.
- `project_roles`, `user_resource_wallets`, `seat_transactions`, `invitations`, and prompt/settings tables are not present in the backup.

The current app expects the newer shape:

- `projects.name`, `projects.description`, `projects.facilitator_id`
- `project_roles`
- `stories.user_id` plus legacy `storyteller_id` compatibility
- `user_resource_wallets` and `seat_transactions`
- `create_project_with_role(...)`
- agent and public archive tables from the existing migrations

The bootstrap SQL adds compatibility columns and missing base tables without deleting restored data.

## After Restore

Configure these in the new Supabase project:

1. Auth Site URL and redirect URLs from `docs/deployment/github-vercel-supabase.md`.
2. Storage bucket `saga` should exist after the storage migration; confirm it in Storage.
3. Copy new Supabase values into Vercel environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Update GitHub Actions secrets:
   - `SUPABASE_PROJECT_REF`
   - `SUPABASE_DB_PASSWORD`
   - `SUPABASE_ACCESS_TOKEN` if using a new Supabase account/token

Rotate any old Supabase anon/service-role keys and AI provider keys that were previously exposed in local examples or logs.

## Validation

After restore:

```bash
npm run test:infra
npm run verify
```

Then deploy and check:

1. GitHub Actions `ci`, `supabase-production`, and `vercel-production`.
2. Vercel `/api/health`.
3. Supabase sign-in.
4. Project creation through the app.
5. Story recording or story creation.
6. Storage upload to the `saga` bucket.

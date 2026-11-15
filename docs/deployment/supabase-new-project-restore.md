# Supabase New Project Restore

This runbook restores the downloaded Supabase database backup into a new Supabase project and then applies the Saga app schema needed by the current codebase.

2026-11-14 local verification: the restore script includes all 40 root migrations after bootstrap, including processing recovery, AI edit requests, semantic sources, and hosting reminders. Native dump/restore now checks exact AI source/version/consent/lease/evidence and reminder/notification/receipt records, then replays post-freeze tombstones and rejects late callbacks. See the [audit repair receipt](../research/2026-11-14-audit-repair.md). This is local validation; no remote restore or migration was performed. Before enabling these features after a separately authorized deployment, follow [AI editing](../story-ai-edit.md), [semantic search](../semantic-search.md), [hosting reminders](../hosting-reminders.md), and [processing recovery](../processing-recovery.md) for server configuration, provider qualification, and worker operation.

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
3. Every root `supabase/migrations/*.sql` file in filename order, stopping at the first failure.
4. Verification queries for required tables and functions.

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
It also supplies historical `project_members`, `story_artifacts`, `public_archive_entries`,
and `waitlist` relations required by later migrations. These retain restored rows,
enable RLS, and deny client table access. They are separate from the newer agent,
public contribution, and waitlist signup tables.

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

## Replay post-freeze whole-story deletion

Before enabling application access after a modern backup restore, replay the exact
post-freeze `deletion_requests` and `deletion_targets`, and mark their captured
assets `deleting`. For every capture-version-1 story request, execute the
service/maintenance-only `public.purge_story_content(request_id)` in the same
maintenance transaction. Preserve the captured rows and their digests; this RPC
clears restored text and derived rows while retaining replay identities.
Then run the media deletion worker against restored Storage objects. A metadata
404 does not prove backend object/version deletion. Validate the surviving object
manifest separately. This sequence is exercised by
`node experiments/g1-local/verify-migrations.mjs --backup` on a new local PG17 DB;
it is not a claim that a hosted project was restored.

## G3 payment records and publication volume

Modern database backups must include the complete application schema, including
`invitation_candidate` and `entitlement_candidate`, plus the public payment order,
event, request, project-rights, publication snapshot/job and artifact-cleanup
tables. A `public`-only dump loses the trusted invitation sources. The current
local rehearsal uses a full `pg_dump -Fc` and compares all these restored rows
before replay; it does not reissue payment events to manufacture missing rights.

Back up the private `ARCHIVE_SPOOL_DIR` as a separate volume with a relative-path,
size and SHA-256 manifest. Restore its exact layout on the worker/download host
before enabling readers. Replaying deletion captures removes affected snapshots
and jobs and creates durable cleanup records. Run publication reconciliation to
erase the restored ZIPs, then verify unrelated archives retain their hashes.
The same local `--backup` command exercises this sequence with actual publication
worker output. See [publication worker operations](../publication-worker.md).

The invitation HTTP adapters call `invitation_candidate` RPCs. The local
`supabase/config.toml` exposes this schema; hosted Supabase must have the same
explicit API schema configuration. Its table grants remain revoked and only
the restricted authenticated RPCs are callable. Keep `entitlement_candidate`
private. Native PostgreSQL tests verify grants and transactions but do not
substitute for checking hosted PostgREST schema exposure and schema-cache reload.

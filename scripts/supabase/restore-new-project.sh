#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_FILE="${BACKUP_FILE:-/Users/eat/Desktop/db_cluster-08-08-2025@05-34-47.backup}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  cat >&2 <<'EOF'
DATABASE_URL is required.

Use the new Supabase project's direct Postgres connection string, for example:
  export DATABASE_URL='postgresql://postgres.PROJECT_REF:DB_PASSWORD@aws-...pooler.supabase.com:5432/postgres?sslmode=require'

Find it in Supabase Dashboard > Project Settings > Database.
EOF
  exit 2
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 2
fi

cd "$ROOT_DIR"

echo "==> Restoring downloaded Supabase backup"
echo "    $BACKUP_FILE"
echo "    Cluster-level statements may report expected errors on managed Supabase."
psql "$DATABASE_URL" -v ON_ERROR_STOP=0 -f "$BACKUP_FILE"

echo "==> Applying Saga base schema bootstrap"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "supabase/bootstrap/20260624000000_app_base_schema.sql"

echo "==> Applying Saga application migrations"
for migration in supabase/migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
done

echo "==> Verifying required tables and RPC"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles',
    'projects',
    'project_roles',
    'stories',
    'interactions',
    'user_resource_wallets',
    'seat_transactions',
    'invitations',
    'chapters',
    'prompts',
    'project_prompt_state',
    'privacy_agreements',
    'agent_runs',
    'interview_sessions',
    'agent_artifacts',
    'story_elements',
    'public_contributions'
  )
order by table_name;

select routine_schema, routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('create_project_with_role', 'handle_new_user');

-- Fail if the payment/source graph or durable publication storage is missing.
do $$
declare relation text;
begin
  foreach relation in array array[
    'invitation_candidate.trusted_seat_sources', 'invitation_candidate.bindings',
    'invitation_candidate.requests', 'entitlement_candidate.sources', 'entitlement_candidate.events',
    'public.payment_orders', 'public.payment_order_requests', 'public.payment_order_events',
    'public.payment_project_rights', 'public.publication_snapshots',
    'public.publication_delivery_jobs', 'public.publication_artifact_cleanup',
    'public.story_ai_edit_requests', 'public.story_transcription_requests',
    'public.hosting_reminders'
  ] loop
    if to_regclass(relation) is null then raise exception 'Required relation missing: %', relation; end if;
  end loop;
end $$;
SQL

echo "==> Restore complete"

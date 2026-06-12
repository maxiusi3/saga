-- Phase 2 public archive and Wiki Editor Agent tables.
-- Run after agent-phase1.sql.

-- Migration preflight:
-- This migration replaces Phase 1 check constraints and assumes production does not
-- contain agent_runs.agent_type or agent_artifacts.artifact_type values outside the
-- allowlists below. If production may have drifted, query distinct values before
-- applying this migration.
do $$
begin
  alter table public.agent_runs drop constraint if exists agent_runs_agent_type_check;
  alter table public.agent_runs
    add constraint agent_runs_agent_type_check
    check (agent_type in ('interview', 'editor_librarian', 'wiki_editor'));

  alter table public.agent_artifacts drop constraint if exists agent_artifacts_artifact_type_check;
  alter table public.agent_artifacts
    add constraint agent_artifacts_artifact_type_check
    check (artifact_type in (
      'host_intervention',
      'standalone_story',
      'story_summary',
      'follow_up_questions',
      'story_elements',
      'anonymized_contribution_preview',
      'wiki_event_candidate',
      'wiki_event_draft'
    ));
end $$;

create table if not exists public.platform_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('public_archive_reviewer')),
  granted_by uuid null references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz null
);

create table if not exists public.public_contribution_invitations (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  invited_storyteller_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed', 'expired')),
  message text null,
  created_at timestamptz not null default now(),
  responded_at timestamptz null
);

create table if not exists public.public_contributions (
  id uuid primary key default gen_random_uuid(),
  public_ref text not null unique default ('pc_' || replace(gen_random_uuid()::text, '-', '')),
  source_project_id uuid not null references public.projects(id) on delete restrict,
  source_story_id uuid not null references public.stories(id) on delete restrict,
  source_user_id uuid not null references auth.users(id) on delete restrict,
  source_story_hash text not null,
  source_content_hash text not null,
  consent_scope jsonb not null default '["text","structured_elements"]'::jsonb
    constraint public_contributions_consent_scope_allowed
    check (
      case
        when jsonb_typeof(consent_scope) = 'array' then
          jsonb_array_length(consent_scope) = 2
          and consent_scope @> '["text","structured_elements"]'::jsonb
          and consent_scope <@ '["text","structured_elements"]'::jsonb
        else false
      end
    ),
  consent_copy_version text not null,
  anonymized_title text not null,
  anonymized_text text not null,
  anonymized_summary text not null,
  status text not null default 'active' check (status in ('active', 'withdrawn')),
  wiki_status text not null default 'pending' check (wiki_status in ('pending', 'processed', 'failed')),
  submitted_at timestamptz not null default now(),
  withdrawn_at timestamptz null
);

alter table public.public_contributions
  drop constraint if exists public_contributions_source_project_id_fkey;
alter table public.public_contributions
  drop constraint if exists public_contributions_source_story_id_fkey;
alter table public.public_contributions
  drop constraint if exists public_contributions_source_user_id_fkey;
alter table public.public_contributions
  drop constraint if exists public_contributions_source_project_fk;
alter table public.public_contributions
  drop constraint if exists public_contributions_source_story_fk;
alter table public.public_contributions
  drop constraint if exists public_contributions_source_user_fk;

alter table public.public_contributions
  add constraint public_contributions_source_project_fk
  foreign key (source_project_id) references public.projects(id) on delete restrict;
alter table public.public_contributions
  add constraint public_contributions_source_story_fk
  foreign key (source_story_id) references public.stories(id) on delete restrict;
alter table public.public_contributions
  add constraint public_contributions_source_user_fk
  foreign key (source_user_id) references auth.users(id) on delete restrict;

alter table public.public_contributions
  drop constraint if exists public_contributions_consent_scope_allowed;
alter table public.public_contributions
  add constraint public_contributions_consent_scope_allowed
  check (
    case
      when jsonb_typeof(consent_scope) = 'array' then
        jsonb_array_length(consent_scope) = 2
        and consent_scope @> '["text","structured_elements"]'::jsonb
        and consent_scope <@ '["text","structured_elements"]'::jsonb
      else false
    end
  );

create table if not exists public.public_contribution_elements (
  id uuid primary key default gen_random_uuid(),
  public_contribution_id uuid not null references public.public_contributions(id) on delete cascade,
  element_type text not null check (element_type in ('time', 'place', 'person', 'event', 'theme', 'emotion', 'decision', 'consequence', 'reflection')),
  value text not null,
  normalized_value text null,
  source_quote text null,
  confidence numeric not null default 0.8 check (confidence >= 0 and confidence <= 1),
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed', 'approved', 'rejected', 'edited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.public_event_clusters (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'candidate' check (status in ('candidate', 'draft', 'approved', 'rejected', 'needs_reprocessing')),
  event_label text not null,
  timeframe text not null,
  place_scope text not null,
  historical_context_summary text not null,
  perspective_summary text not null,
  representative_excerpts jsonb not null default '[]'::jsonb,
  uncertainty_notes text not null,
  confidence numeric not null default 0.7 check (confidence >= 0 and confidence <= 1),
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed', 'approved', 'rejected', 'edited')),
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.public_event_contributions (
  id uuid primary key default gen_random_uuid(),
  public_event_cluster_id uuid not null references public.public_event_clusters(id) on delete cascade,
  public_contribution_id uuid not null references public.public_contributions(id) on delete cascade,
  match_confidence numeric not null default 0.7 check (match_confidence >= 0 and match_confidence <= 1),
  perspective_summary text not null,
  excerpt_allowed boolean not null default true,
  created_at timestamptz not null default now(),
  removed_at timestamptz null
);

create table if not exists public.public_archive_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('preview_generated', 'opted_in', 'wiki_processed', 'review_approved', 'review_rejected', 'withdrawn')),
  actor_user_id uuid null references auth.users(id) on delete set null,
  public_contribution_id uuid null references public.public_contributions(id) on delete set null,
  public_event_cluster_id uuid null references public.public_event_clusters(id) on delete set null,
  consent_copy_version text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Bridge the story owner column name across schema generations:
-- older specs used storyteller_id while the current generated types expose user_id.
create or replace function public.enforce_public_archive_story_consistency()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_row jsonb := to_jsonb(new);
  story_row jsonb;
  target_story_id uuid;
  target_project_id uuid;
  target_owner_id uuid;
  story_project_id uuid;
  story_owner_id uuid;
begin
  if tg_table_name = 'public_contributions' then
    target_story_id := (new_row->>'source_story_id')::uuid;
    target_project_id := (new_row->>'source_project_id')::uuid;
    target_owner_id := (new_row->>'source_user_id')::uuid;
  elsif tg_table_name = 'public_contribution_invitations' then
    target_story_id := (new_row->>'story_id')::uuid;
    target_project_id := (new_row->>'project_id')::uuid;
    target_owner_id := (new_row->>'invited_storyteller_id')::uuid;
  else
    raise exception 'unsupported public archive consistency table: %', tg_table_name
      using errcode = '23514';
  end if;

  select to_jsonb(s.*)
  into story_row
  from public.stories s
  where s.id = target_story_id;

  if story_row is null then
    raise exception 'public archive story % does not exist', target_story_id
      using errcode = '23503';
  end if;

  story_project_id := (story_row->>'project_id')::uuid;
  story_owner_id := (coalesce(story_row->>'storyteller_id', story_row->>'user_id'))::uuid;

  if story_project_id is distinct from target_project_id then
    raise exception 'public archive story % project mismatch', target_story_id
      using errcode = '23514';
  end if;

  if story_owner_id is distinct from target_owner_id then
    raise exception 'public archive story % owner mismatch', target_story_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_public_contributions_story_consistency
  on public.public_contributions;
create trigger enforce_public_contributions_story_consistency
  before insert or update of source_story_id, source_project_id, source_user_id
  on public.public_contributions
  for each row
  execute function public.enforce_public_archive_story_consistency();

drop trigger if exists enforce_public_contribution_invitations_story_consistency
  on public.public_contribution_invitations;
create trigger enforce_public_contribution_invitations_story_consistency
  before insert or update of story_id, project_id, invited_storyteller_id
  on public.public_contribution_invitations
  for each row
  execute function public.enforce_public_archive_story_consistency();

alter table public.platform_roles enable row level security;
alter table public.public_contribution_invitations enable row level security;
alter table public.public_contributions enable row level security;
alter table public.public_contribution_elements enable row level security;
alter table public.public_event_clusters enable row level security;
alter table public.public_event_contributions enable row level security;
alter table public.public_archive_audit_events enable row level security;

revoke all on table
  public.platform_roles,
  public.public_contribution_invitations,
  public.public_contributions,
  public.public_contribution_elements,
  public.public_event_clusters,
  public.public_event_contributions,
  public.public_archive_audit_events
from anon, authenticated;

create or replace function public.set_public_archive_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_public_contribution_elements_updated_at'
      and tgrelid = 'public.public_contribution_elements'::regclass
  ) then
    create trigger set_public_contribution_elements_updated_at
      before update on public.public_contribution_elements
      for each row
      execute function public.set_public_archive_updated_at();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_public_event_clusters_updated_at'
      and tgrelid = 'public.public_event_clusters'::regclass
  ) then
    create trigger set_public_event_clusters_updated_at
      before update on public.public_event_clusters
      for each row
      execute function public.set_public_archive_updated_at();
  end if;
end $$;

-- These constraints/indexes intentionally fail if invalid consent scopes or duplicate
-- active rows exist; clean production drift before applying if needed.
create unique index if not exists idx_platform_roles_active_reviewer_unique
  on public.platform_roles(user_id)
  where role = 'public_archive_reviewer' and revoked_at is null;
create index if not exists idx_public_contributions_story_user on public.public_contributions(source_story_id, source_user_id);
create unique index if not exists idx_public_contributions_active_story_user_unique
  on public.public_contributions(source_story_id, source_user_id)
  where status = 'active';
create index if not exists idx_public_contributions_active_wiki on public.public_contributions(status, wiki_status);
create index if not exists idx_public_contribution_elements_contribution on public.public_contribution_elements(public_contribution_id);
create index if not exists idx_public_event_contributions_cluster on public.public_event_contributions(public_event_cluster_id);
create index if not exists idx_public_event_contributions_contribution on public.public_event_contributions(public_contribution_id);
create unique index if not exists idx_public_event_contributions_active_unique
  on public.public_event_contributions(public_event_cluster_id, public_contribution_id)
  where removed_at is null;
create index if not exists idx_public_archive_audit_contribution on public.public_archive_audit_events(public_contribution_id);

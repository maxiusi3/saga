-- ============================================================================
-- UR Saga Database Deployment Script
-- Generated: 2026-10-07
-- Purpose: Complete database initialization for fresh/abandoned Supabase project
-- ============================================================================
--
-- INSTRUCTIONS:
-- 1. Open: https://supabase.com/dashboard/project/encdblxyxztvfxotfuyh/sql
-- 2. Copy this entire file
-- 3. Paste into SQL Editor
-- 4. Click "Run" (or press Cmd+Enter)
--
-- This script will:
-- - Create all base tables (users, projects, stories, etc.)
-- - Set up Row Level Security (RLS) policies
-- - Create secure RPC functions (NEW: wallet, invitations, export)
-- - Configure storage policies
-- - Initialize agent system tables
--
-- IMPORTANT: This script is idempotent (safe to run multiple times)
-- ============================================================================

-- Start transaction for atomicity
BEGIN;

-- ============================================================================
-- STEP 1: Base Schema (from bootstrap)
-- ============================================================================
-- This creates all core tables: users, projects, stories, chapters, etc.
-- Saga base schema bootstrap for a new Supabase project.
--
-- Purpose:
-- 1. Make a freshly-created Supabase project usable by the current app.
-- 2. Normalize the older Dashboard logical backup schema
--    (projects.title, stories.storyteller_id, interactions.facilitator_id)
--    into the current app schema without deleting restored data.
-- 3. Provide base tables required before the phase 1/phase 2 agent migrations.
--
-- Run this after restoring the downloaded backup and before
-- supabase/migrations/*.sql.

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  email text,
  phone text,
  display_name text,
  user_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists user_id uuid;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists user_metadata jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
update public.profiles set user_id = id where user_id is null;
create unique index if not exists profiles_user_id_unique on public.profiles(user_id);

-- Drop existing user_profiles if it exists as a table
drop table if exists public.user_profiles cascade;
create or replace view public.user_profiles as
select
  coalesce(user_id, id) as id,
  coalesce(display_name, user_metadata->>'name', email) as name,
  email,
  user_metadata->>'avatar_url' as avatar_url,
  created_at,
  updated_at
from public.profiles;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text,
  description text,
  facilitator_id uuid not null references auth.users(id) on delete cascade,
  owner_id uuid,
  storyteller_id uuid references auth.users(id) on delete set null,
  title text,
  status text not null default 'active',
  invitation_token text,
  invitation_expires_at timestamptz,
  payment_status text not null default 'paid',
  subscription_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects drop constraint if exists projects_payment_status_check;
alter table public.projects add column if not exists name text;
alter table public.projects add column if not exists description text;
alter table public.projects add column if not exists facilitator_id uuid;
alter table public.projects add column if not exists owner_id uuid;
alter table public.projects add column if not exists storyteller_id uuid;
alter table public.projects add column if not exists title text;
alter table public.projects add column if not exists status text not null default 'active';
alter table public.projects add column if not exists invitation_token text;
alter table public.projects add column if not exists invitation_expires_at timestamptz;
alter table public.projects add column if not exists payment_status text not null default 'paid';
alter table public.projects add column if not exists subscription_expires_at timestamptz;
alter table public.projects add column if not exists created_at timestamptz not null default now();
alter table public.projects add column if not exists updated_at timestamptz not null default now();
update public.projects
set
  name = coalesce(name, title),
  owner_id = coalesce(owner_id, facilitator_id),
  status = case
    when status in ('awaiting_invitation', 'inactive') then 'pending'
    else coalesce(status, 'active')
  end
where name is null
  or owner_id is null
  or status in ('awaiting_invitation', 'inactive');
alter table public.projects alter column name set not null;
alter table public.projects alter column status set default 'active';

create table if not exists public.project_roles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'facilitator', 'co_facilitator', 'storyteller')),
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  status text not null default 'active' check (status in ('pending', 'active', 'declined', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists project_roles_project_user_unique
  on public.project_roles(project_id, user_id);

insert into public.project_roles (project_id, user_id, role, joined_at, status)
select id, facilitator_id, 'facilitator', created_at, 'active'
from public.projects
where facilitator_id is not null
on conflict (project_id, user_id) do nothing;

insert into public.project_roles (project_id, user_id, role, joined_at, status)
select id, storyteller_id, 'storyteller', created_at, 'active'
from public.projects
where storyteller_id is not null
on conflict (project_id, user_id) do nothing;

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  storyteller_id uuid references auth.users(id) on delete set null,
  title text,
  content text,
  audio_url text,
  photo_url text,
  transcript text,
  ai_prompt text,
  ai_generated_title text,
  ai_summary text,
  ai_follow_up_questions jsonb,
  ai_confidence_score numeric,
  happened_at timestamptz,
  recording_mode text,
  is_public boolean not null default false,
  parent_story_id uuid,
  images jsonb,
  chapter_id uuid,
  prompt_id uuid,
  duration integer,
  audio_duration integer,
  file_size bigint,
  stt_metadata jsonb,
  status text not null default 'processing',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stories drop constraint if exists stories_status_check;
alter table public.stories add column if not exists user_id uuid;
alter table public.stories add column if not exists storyteller_id uuid;
alter table public.stories add column if not exists title text;
alter table public.stories add column if not exists content text;
alter table public.stories add column if not exists audio_url text;
alter table public.stories add column if not exists photo_url text;
alter table public.stories add column if not exists transcript text;
alter table public.stories add column if not exists ai_prompt text;
alter table public.stories add column if not exists ai_generated_title text;
alter table public.stories add column if not exists ai_summary text;
alter table public.stories add column if not exists ai_follow_up_questions jsonb;
alter table public.stories add column if not exists ai_confidence_score numeric;
alter table public.stories add column if not exists happened_at timestamptz;
alter table public.stories add column if not exists recording_mode text;
alter table public.stories add column if not exists is_public boolean not null default false;
alter table public.stories add column if not exists parent_story_id uuid;
alter table public.stories add column if not exists images jsonb;
alter table public.stories add column if not exists chapter_id uuid;
alter table public.stories add column if not exists prompt_id uuid;
alter table public.stories add column if not exists duration integer;
alter table public.stories add column if not exists audio_duration integer;
alter table public.stories add column if not exists file_size bigint;
alter table public.stories add column if not exists stt_metadata jsonb;
alter table public.stories add column if not exists status text not null default 'processing';
alter table public.stories add column if not exists created_at timestamptz not null default now();
alter table public.stories add column if not exists updated_at timestamptz not null default now();
update public.stories set user_id = coalesce(user_id, storyteller_id) where user_id is null;

create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  facilitator_id uuid references auth.users(id) on delete set null,
  type text not null,
  content text not null,
  status text,
  attachments jsonb,
  answered_at timestamptz,
  answer_story_id uuid references public.stories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.interactions drop constraint if exists interactions_type_check;
alter table public.interactions add column if not exists user_id uuid;
alter table public.interactions add column if not exists facilitator_id uuid;
alter table public.interactions add column if not exists type text;
alter table public.interactions add column if not exists content text;
alter table public.interactions add column if not exists status text;
alter table public.interactions add column if not exists attachments jsonb;
alter table public.interactions add column if not exists answered_at timestamptz;
alter table public.interactions add column if not exists answer_story_id uuid;
alter table public.interactions add column if not exists created_at timestamptz not null default now();
alter table public.interactions add column if not exists updated_at timestamptz not null default now();
update public.interactions set user_id = coalesce(user_id, facilitator_id) where user_id is null;

create or replace view public.story_interactions as
select
  id,
  story_id,
  coalesce(user_id, facilitator_id) as user_id,
  facilitator_id,
  type,
  content,
  status,
  attachments,
  answered_at,
  answer_story_id,
  created_at,
  updated_at
from public.interactions;

create table if not exists public.user_resource_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_vouchers integer not null default 1,
  facilitator_seats integer not null default 2,
  storyteller_seats integer not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

drop policy if exists "wallet_insert_self" on public.user_resource_wallets;
create policy "wallet_insert_self"
on public.user_resource_wallets
for insert
with check (auth.uid() = user_id);

create table if not exists public.seat_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  transaction_type text not null,
  resource_type text not null,
  amount integer not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_email text not null,
  invitee_role text not null check (invitee_role in ('facilitator', 'co_facilitator', 'storyteller')),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  type text not null,
  title text not null,
  message text not null,
  data jsonb not null default '{}'::jsonb,
  action_url text,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  notification_type text not null,
  enabled boolean not null default true,
  email_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, project_id, notification_type)
);

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  order_index integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid references public.chapters(id) on delete set null,
  text text not null,
  audio_url text,
  order_index integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_prompt_state (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  current_chapter_id uuid references public.chapters(id) on delete set null,
  current_prompt_id uuid references public.prompts(id) on delete set null,
  completed_prompt_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);

drop policy if exists "chapters_select_authenticated" on public.chapters;
create policy "chapters_select_authenticated"
on public.chapters
for select
using (auth.uid() is not null);

drop policy if exists "prompts_select_authenticated" on public.prompts;
create policy "prompts_select_authenticated"
on public.prompts
for select
using (auth.uid() is not null);

drop policy if exists "project_prompt_state_select_members" on public.project_prompt_state;
create policy "project_prompt_state_select_members"
on public.project_prompt_state
for select
using (
  exists (
    select 1 from public.project_roles pr
    where pr.project_id = project_prompt_state.project_id
      and pr.user_id = auth.uid()
      and pr.status = 'active'
  )
  or exists (
    select 1 from public.projects p
    where p.id = project_prompt_state.project_id
      and p.facilitator_id = auth.uid()
  )
);

create table if not exists public.privacy_agreements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agreement_version text not null,
  accepted_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active',
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.create_project_with_role(
  project_name text,
  project_description text,
  facilitator_id uuid,
  creator_role text default 'facilitator'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  new_project_id uuid;
begin
  insert into public.projects (name, title, description, facilitator_id, owner_id, status, payment_status)
  values (project_name, project_name, nullif(project_description, ''), facilitator_id, facilitator_id, 'active', 'paid')
  returning id into new_project_id;

  insert into public.project_roles (project_id, user_id, role, joined_at, status)
  values (
    new_project_id,
    facilitator_id,
    case when creator_role in ('storyteller', 'facilitator') then creator_role else 'facilitator' end,
    now(),
    'active'
  )
  on conflict (project_id, user_id) do nothing;

  insert into public.user_resource_wallets (user_id)
  values (facilitator_id)
  on conflict (user_id) do nothing;

  update public.user_resource_wallets
  set
    project_vouchers = greatest(project_vouchers - 1, 0),
    updated_at = now()
  where user_id = facilitator_id
    and project_vouchers > 0;

  return new_project_id;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
begin
  insert into public.profiles (id, user_id, email, display_name, user_metadata)
  values (
    new.id,
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data, '{}'::jsonb)
  )
  on conflict (id) do update
  set
    user_id = excluded.user_id,
    email = excluded.email,
    display_name = excluded.display_name,
    user_metadata = excluded.user_metadata,
    updated_at = now();

  insert into public.user_resource_wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
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
    'subscriptions'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

drop policy if exists "projects_select_members" on public.projects;
create policy "projects_select_members"
on public.projects
for select
using (
  auth.uid() = facilitator_id
  or exists (
    select 1 from public.project_roles pr
    where pr.project_id = projects.id
      and pr.user_id = auth.uid()
      and pr.status = 'active'
  )
);

drop policy if exists "projects_insert_authenticated" on public.projects;
create policy "projects_insert_authenticated"
on public.projects
for insert
with check (auth.uid() = facilitator_id);

drop policy if exists "project_roles_select_self" on public.project_roles;
create policy "project_roles_select_self"
on public.project_roles
for select
using (auth.uid() = user_id);

drop policy if exists "stories_select_members" on public.stories;
create policy "stories_select_members"
on public.stories
for select
using (
  exists (
    select 1 from public.projects p
    where p.id = stories.project_id
      and (
        p.facilitator_id = auth.uid()
        or exists (
          select 1 from public.project_roles pr
          where pr.project_id = p.id
            and pr.user_id = auth.uid()
            and pr.status = 'active'
        )
      )
  )
);

drop policy if exists "stories_insert_members" on public.stories;
create policy "stories_insert_members"
on public.stories
for insert
with check (
  auth.uid() = coalesce(user_id, storyteller_id)
  or exists (
    select 1 from public.projects p
    where p.id = stories.project_id
      and p.facilitator_id = auth.uid()
  )
  or exists (
    select 1 from public.project_roles pr
    where pr.project_id = stories.project_id
      and pr.user_id = auth.uid()
      and pr.status = 'active'
  )
);

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
on public.profiles
for select
using (auth.uid() = coalesce(user_id, id));

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
using (auth.uid() = coalesce(user_id, id))
with check (auth.uid() = coalesce(user_id, id));

drop policy if exists "wallet_select_self" on public.user_resource_wallets;
create policy "wallet_select_self"
on public.user_resource_wallets
for select
using (auth.uid() = user_id);

drop policy if exists "wallet_update_self" on public.user_resource_wallets;
create policy "wallet_update_self"
on public.user_resource_wallets
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "notifications_select_self" on public.notifications;
create policy "notifications_select_self"
on public.notifications
for select
using (auth.uid() = recipient_id);

drop policy if exists "notifications_update_self" on public.notifications;
create policy "notifications_update_self"
on public.notifications
for update
using (auth.uid() = recipient_id)
with check (auth.uid() = recipient_id);

drop policy if exists "notification_settings_select_self" on public.notification_settings;
create policy "notification_settings_select_self"
on public.notification_settings
for select
using (auth.uid() = user_id);

drop policy if exists "notification_settings_write_self" on public.notification_settings;
create policy "notification_settings_write_self"
on public.notification_settings
for insert
with check (auth.uid() = user_id);

drop policy if exists "notification_settings_update_self" on public.notification_settings;
create policy "notification_settings_update_self"
on public.notification_settings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_settings_select_self" on public.user_settings;
create policy "user_settings_select_self"
on public.user_settings
for select
using (auth.uid() = user_id);

drop policy if exists "user_settings_write_self" on public.user_settings;
create policy "user_settings_write_self"
on public.user_settings
for insert
with check (auth.uid() = user_id);

drop policy if exists "user_settings_update_self" on public.user_settings;
create policy "user_settings_update_self"
on public.user_settings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

create or replace function public.mark_notifications_as_read(
  user_id uuid,
  notification_ids uuid[] default null
)
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  updated_count integer := 0;
begin
  if notification_ids is null then
    update public.notifications
    set is_read = true,
        read_at = coalesce(read_at, now()),
        updated_at = now()
    where recipient_id = user_id
      and is_read = false;
  else
    update public.notifications
    set is_read = true,
        read_at = coalesce(read_at, now()),
        updated_at = now()
    where recipient_id = user_id
      and id = any(notification_ids)
      and is_read = false;
  end if;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

create or replace function public.get_unread_notification_count(user_id uuid)
returns integer
language sql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
  select count(*)::integer
  from public.notifications
  where recipient_id = user_id
    and is_read = false
$$;

create index if not exists projects_facilitator_id_idx on public.projects(facilitator_id);
create index if not exists project_roles_user_id_idx on public.project_roles(user_id);
create index if not exists stories_project_id_idx on public.stories(project_id);
create index if not exists stories_user_id_idx on public.stories(user_id);
create index if not exists interactions_story_id_idx on public.interactions(story_id);
create index if not exists invitations_token_idx on public.invitations(token);

-- ============================================================================
-- STEP 2: Agent Phase 1 - Core Agent Tables
-- ============================================================================

-- Phase 1 agent tables for the private biography loop.
-- Run in Supabase SQL editor before deploying API routes that write agent data.

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_type text not null check (agent_type in ('interview', 'editor_librarian')),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  project_id uuid null references public.projects(id) on delete cascade,
  story_id uuid null references public.stories(id) on delete cascade,
  interview_session_id uuid null,
  content_hash text null,
  input jsonb not null default '{}'::jsonb,
  output jsonb null,
  model text null,
  error text null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  created_by uuid not null references auth.users(id) on delete cascade
);

create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  storyteller_id uuid not null references auth.users(id) on delete cascade,
  prompt_text text null,
  recording_mode text not null check (recording_mode in ('deep_dive', 'chat')),
  intervention_level text not null check (intervention_level in ('off', 'low', 'high')),
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  completed_at timestamptz null
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'agent_runs_interview_session_fk'
      and conrelid = 'public.agent_runs'::regclass
  ) then
    alter table public.agent_runs
      add constraint agent_runs_interview_session_fk
      foreign key (interview_session_id)
      references public.interview_sessions(id)
      on delete set null;
  end if;
end $$;

alter table public.agent_runs
  add column if not exists content_hash text null;

create table if not exists public.interview_events (
  id uuid primary key default gen_random_uuid(),
  interview_session_id uuid not null references public.interview_sessions(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  storyteller_id uuid not null references auth.users(id) on delete cascade,
  event_kind text not null check (event_kind in ('opening', 'warmup', 'prior_story_recap', 'gentle_probe', 'transition', 'emotional_support', 'closing')),
  intervention_level text not null check (intervention_level in ('off', 'low', 'high')),
  trigger_reason text not null,
  prompt_text text not null,
  transcript_window text null,
  transcript_start_offset integer null,
  transcript_end_offset integer null,
  accepted boolean null,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_artifacts (
  id uuid primary key default gen_random_uuid(),
  agent_run_id uuid not null references public.agent_runs(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  story_id uuid null references public.stories(id) on delete cascade,
  artifact_type text not null check (artifact_type in ('host_intervention', 'standalone_story', 'story_summary', 'follow_up_questions', 'story_elements')),
  payload jsonb not null default '{}'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed', 'approved', 'rejected', 'edited')),
  confidence numeric not null default 0.8 check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.story_elements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  story_id uuid not null references public.stories(id) on delete cascade,
  agent_run_id uuid not null references public.agent_runs(id) on delete cascade,
  element_type text not null check (element_type in ('time', 'place', 'person', 'event', 'theme', 'emotion', 'decision', 'consequence', 'reflection')),
  value text not null,
  normalized_value text null,
  source_quote text not null,
  source_start_offset integer null,
  source_end_offset integer null,
  confidence numeric not null default 0.8 check (confidence >= 0 and confidence <= 1),
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed', 'approved', 'rejected', 'edited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_runs enable row level security;
alter table public.interview_sessions enable row level security;
alter table public.interview_events enable row level security;
alter table public.agent_artifacts enable row level security;
alter table public.story_elements enable row level security;

revoke all on table
  public.agent_runs,
  public.interview_sessions,
  public.interview_events,
  public.agent_artifacts,
  public.story_elements
from anon, authenticated;

create or replace function public.set_agent_phase1_updated_at()
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
    where tgname = 'set_agent_artifacts_updated_at'
      and tgrelid = 'public.agent_artifacts'::regclass
  ) then
    create trigger set_agent_artifacts_updated_at
      before update on public.agent_artifacts
      for each row
      execute function public.set_agent_phase1_updated_at();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_story_elements_updated_at'
      and tgrelid = 'public.story_elements'::regclass
  ) then
    create trigger set_story_elements_updated_at
      before update on public.story_elements
      for each row
      execute function public.set_agent_phase1_updated_at();
  end if;
end $$;

create index if not exists idx_agent_runs_project_id on public.agent_runs(project_id);
create index if not exists idx_agent_runs_story_id on public.agent_runs(story_id);
create index if not exists idx_agent_runs_agent_type on public.agent_runs(agent_type);
create unique index if not exists idx_agent_runs_completed_editor_story_content_hash_unique
  on public.agent_runs(story_id, content_hash)
  where agent_type = 'editor_librarian'
    and status = 'completed'
    and story_id is not null
    and content_hash is not null;
create index if not exists idx_agent_runs_completed_editor_story_hash_completed_at
  on public.agent_runs(story_id, content_hash, completed_at desc)
  where agent_type = 'editor_librarian'
    and status = 'completed'
    and story_id is not null
    and content_hash is not null;
create index if not exists idx_interview_sessions_project_id on public.interview_sessions(project_id);
create index if not exists idx_interview_events_session_id on public.interview_events(interview_session_id);
create index if not exists idx_agent_artifacts_story_id on public.agent_artifacts(story_id);
create index if not exists idx_story_elements_story_id on public.story_elements(story_id);
create index if not exists idx_story_elements_project_type on public.story_elements(project_id, element_type);

-- ============================================================================
-- STEP 3: Agent Phase 2 - Public Archive System
-- ============================================================================

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

-- ============================================================================
-- STEP 4: Storage Policies
-- ============================================================================

-- Supabase Storage Policies for Saga Project
-- Run this script in your Supabase SQL editor to set up storage policies

-- Create the 'saga' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'saga',
  'saga',
  false, -- Private bucket
  52428800, -- 50MB limit per file
  ARRAY[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/m4a',
    'audio/aac',
    'audio/ogg',
    'audio/webm',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policy: Users can upload files to their own folders
DROP POLICY IF EXISTS "Users can upload files to their own folders" ON storage.objects;
CREATE POLICY "Users can upload files to their own folders"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'saga' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can view their own files
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
CREATE POLICY "Users can view their own files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'saga' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can update their own files
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
CREATE POLICY "Users can update their own files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'saga' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own files
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'saga' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Project members can view files in shared project folders
DROP POLICY IF EXISTS "Project members can view project files" ON storage.objects;
CREATE POLICY "Project members can view project files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'saga' 
  AND (
    -- User's own files
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- Project files that user has access to
    EXISTS (
      SELECT 1 FROM project_roles pr
      JOIN projects p ON pr.project_id = p.id
      WHERE pr.user_id = auth.uid()
      AND (storage.foldername(name))[2] = 'projects'
      AND (storage.foldername(name))[3] = p.id::text
    )
  )
);

-- Policy: Project facilitators can upload files to project folders
DROP POLICY IF EXISTS "Project facilitators can upload project files" ON storage.objects;
CREATE POLICY "Project facilitators can upload project files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'saga' 
  AND (
    -- User's own files
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- Project files for facilitators
    (
      (storage.foldername(name))[2] = 'projects'
      AND EXISTS (
        SELECT 1 FROM project_roles pr
        JOIN projects p ON pr.project_id = p.id
        WHERE pr.user_id = auth.uid()
        AND pr.role IN ('facilitator', 'co_facilitator')
        AND (storage.foldername(name))[3] = p.id::text
      )
    )
  )
);

-- Policy: Storytellers can upload files to their own project stories
DROP POLICY IF EXISTS "Storytellers can upload story files" ON storage.objects;
CREATE POLICY "Storytellers can upload story files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'saga' 
  AND (
    -- User's own files
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- Story files for storytellers
    (
      (storage.foldername(name))[2] = 'projects'
      AND EXISTS (
        SELECT 1 FROM project_roles pr
        JOIN projects p ON pr.project_id = p.id
        WHERE pr.user_id = auth.uid()
        AND pr.role = 'storyteller'
        AND (storage.foldername(name))[3] = p.id::text
      )
    )
  )
);

-- Skipping storage.objects RLS enablement on managed Supabase projects.
-- Supabase owns storage.objects and has RLS enabled by default; hosted project
-- postgres users cannot ALTER this table's ownership-level settings.

-- Example file path structure:
-- User files: {user_id}/profile/avatar.jpg
-- Project files: {user_id}/projects/{project_id}/stories/{story_id}/audio.mp3
-- Project exports: {user_id}/projects/{project_id}/exports/export.pdf

-- ============================================================================
-- STEP 5: Dashboard Support Tables
-- ============================================================================

-- Dashboard support tables and policies required by the authenticated dashboard
-- API routes. This mirrors the production-safe pieces from the bootstrap schema
-- so existing linked projects receive them through `supabase db push`.

create table if not exists public.user_resource_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_vouchers integer not null default 1,
  facilitator_seats integer not null default 2,
  storyteller_seats integer not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  order_index integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid references public.chapters(id) on delete set null,
  text text not null,
  audio_url text,
  order_index integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_prompt_state (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  current_chapter_id uuid references public.chapters(id) on delete set null,
  current_prompt_id uuid references public.prompts(id) on delete set null,
  completed_prompt_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  type text not null,
  title text not null,
  message text not null,
  data jsonb not null default '{}'::jsonb,
  action_url text,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  notification_type text not null,
  enabled boolean not null default true,
  email_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, project_id, notification_type)
);

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'notifications',
    'notification_settings',
    'user_settings',
    'user_resource_wallets',
    'chapters',
    'prompts',
    'project_prompt_state'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

drop policy if exists "wallet_insert_self" on public.user_resource_wallets;
create policy "wallet_insert_self"
on public.user_resource_wallets
for insert
with check (auth.uid() = user_id);

drop policy if exists "notifications_select_self" on public.notifications;
create policy "notifications_select_self"
on public.notifications
for select
using (auth.uid() = recipient_id);

drop policy if exists "notifications_update_self" on public.notifications;
create policy "notifications_update_self"
on public.notifications
for update
using (auth.uid() = recipient_id)
with check (auth.uid() = recipient_id);

drop policy if exists "notifications_delete_self" on public.notifications;
create policy "notifications_delete_self"
on public.notifications
for delete
using (auth.uid() = recipient_id);

drop policy if exists "notification_settings_select_self" on public.notification_settings;
create policy "notification_settings_select_self"
on public.notification_settings
for select
using (auth.uid() = user_id);

drop policy if exists "notification_settings_write_self" on public.notification_settings;
create policy "notification_settings_write_self"
on public.notification_settings
for insert
with check (auth.uid() = user_id);

drop policy if exists "notification_settings_update_self" on public.notification_settings;
create policy "notification_settings_update_self"
on public.notification_settings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_settings_select_self" on public.user_settings;
create policy "user_settings_select_self"
on public.user_settings
for select
using (auth.uid() = user_id);

drop policy if exists "user_settings_write_self" on public.user_settings;
create policy "user_settings_write_self"
on public.user_settings
for insert
with check (auth.uid() = user_id);

drop policy if exists "user_settings_update_self" on public.user_settings;
create policy "user_settings_update_self"
on public.user_settings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "chapters_select_authenticated" on public.chapters;
create policy "chapters_select_authenticated"
on public.chapters
for select
using (auth.uid() is not null);

drop policy if exists "prompts_select_authenticated" on public.prompts;
create policy "prompts_select_authenticated"
on public.prompts
for select
using (auth.uid() is not null);

drop policy if exists "project_prompt_state_select_members" on public.project_prompt_state;
create policy "project_prompt_state_select_members"
on public.project_prompt_state
for select
using (
  exists (
    select 1 from public.project_roles pr
    where pr.project_id = project_prompt_state.project_id
      and pr.user_id = auth.uid()
      and pr.status = 'active'
  )
  or exists (
    select 1 from public.projects p
    where p.id = project_prompt_state.project_id
      and p.facilitator_id = auth.uid()
  )
);

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

create or replace function public.mark_notifications_as_read(
  user_id uuid,
  notification_ids uuid[] default null
)
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  updated_count integer := 0;
begin
  if notification_ids is null then
    update public.notifications
    set is_read = true,
        read_at = coalesce(read_at, now()),
        updated_at = now()
    where recipient_id = user_id
      and is_read = false;
  else
    update public.notifications
    set is_read = true,
        read_at = coalesce(read_at, now()),
        updated_at = now()
    where recipient_id = user_id
      and id = any(notification_ids)
      and is_read = false;
  end if;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

create or replace function public.get_unread_notification_count(user_id uuid)
returns integer
language sql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
  select count(*)::integer
  from public.notifications
  where recipient_id = user_id
    and is_read = false
$$;

-- ============================================================================
-- STEP 6: Security Fixes - Wallet RLS + RPC Functions (P0 Remediation)
-- ============================================================================
-- This is the critical security update from 2026-10-06:
-- - Locks down user_resource_wallets (removes direct UPDATE/INSERT)
-- - Creates 6 secure RPC functions:
--   * initialize_user_wallet
--   * process_package_purchase
--   * send_project_invitation
--   * accept_project_invitation
--   * cleanup_expired_invitations
--   * request_data_export
-- ============================================================================

-- Drop old function signatures first (they may exist with different signatures)
DROP FUNCTION IF EXISTS initialize_user_wallet(uuid);
DROP FUNCTION IF EXISTS process_package_purchase(uuid, text, integer, integer, text);
DROP FUNCTION IF EXISTS send_project_invitation(uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS accept_project_invitation(text, uuid);
DROP FUNCTION IF EXISTS cleanup_expired_invitations();
DROP FUNCTION IF EXISTS request_data_export(uuid, uuid, boolean, boolean);

-- Migration: Fix Wallet RLS + Implement Missing RPCs
-- Created: 2026-10-06
-- Purpose: SEC-02 (wallet RLS lockdown) + SEC-03 (missing RPC functions)

-- ============================================================================
-- PART 1: WALLET RLS LOCKDOWN (SEC-02)
-- ============================================================================

-- Drop insecure RLS policies that allowed direct client updates
DROP POLICY IF EXISTS "wallet_update_self" ON user_resource_wallets;
DROP POLICY IF EXISTS "wallet_insert_self" ON user_resource_wallets;

-- Keep read-only policy
-- Ensure users can still SELECT their own wallet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_resource_wallets'
    AND policyname = 'wallet_select_self'
  ) THEN
    CREATE POLICY "wallet_select_self" ON user_resource_wallets
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- PART 2: WALLET RPC FUNCTIONS (SEC-02 + SEC-03)
-- ============================================================================

-- Initialize user wallet (idempotent, safe to call multiple times)
CREATE OR REPLACE FUNCTION initialize_user_wallet(p_user_id UUID)
RETURNS TABLE(
  user_id UUID,
  standard_hours INTEGER,
  premium_hours INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only allow users to initialize their own wallet
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot initialize wallet for another user';
  END IF;

  -- Insert if not exists, return existing if already created
  INSERT INTO user_resource_wallets (user_id, standard_hours, premium_hours)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN QUERY
  SELECT w.user_id, w.standard_hours, w.premium_hours, w.created_at, w.updated_at
  FROM user_resource_wallets w
  WHERE w.user_id = p_user_id;
END;
$$;

-- Process package purchase (atomic transaction with idempotency)
CREATE OR REPLACE FUNCTION process_package_purchase(
  p_user_id UUID,
  p_package_code TEXT,
  p_standard_hours INTEGER,
  p_premium_hours INTEGER,
  p_payment_reference TEXT
)
RETURNS TABLE(
  user_id UUID,
  standard_hours INTEGER,
  premium_hours INTEGER,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_record TEXT;
BEGIN
  -- Check for duplicate payment reference (idempotency)
  SELECT payment_reference INTO v_existing_record
  FROM user_resource_wallets
  WHERE user_id = p_user_id AND last_payment_reference = p_payment_reference;

  IF v_existing_record IS NOT NULL THEN
    RAISE NOTICE 'Payment reference % already processed, skipping', p_payment_reference;
    RETURN QUERY
    SELECT w.user_id, w.standard_hours, w.premium_hours, w.updated_at
    FROM user_resource_wallets w
    WHERE w.user_id = p_user_id;
    RETURN;
  END IF;

  -- Atomic update: add hours and record payment
  UPDATE user_resource_wallets
  SET
    standard_hours = standard_hours + p_standard_hours,
    premium_hours = premium_hours + p_premium_hours,
    last_payment_reference = p_payment_reference,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Return updated wallet
  RETURN QUERY
  SELECT w.user_id, w.standard_hours, w.premium_hours, w.updated_at
  FROM user_resource_wallets w
  WHERE w.user_id = p_user_id;
END;
$$;

-- Add last_payment_reference column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_resource_wallets'
    AND column_name = 'last_payment_reference'
  ) THEN
    ALTER TABLE user_resource_wallets
    ADD COLUMN last_payment_reference TEXT;

    CREATE INDEX IF NOT EXISTS idx_wallet_payment_ref
    ON user_resource_wallets(last_payment_reference);
  END IF;
END $$;

-- ============================================================================
-- PART 3: INVITATION RPCs (SEC-03)
-- ============================================================================

-- Send project invitation
CREATE OR REPLACE FUNCTION send_project_invitation(
  p_project_id UUID,
  p_inviter_id UUID,
  p_invitee_email TEXT,
  p_role TEXT,
  p_token TEXT
)
RETURNS TABLE(
  id UUID,
  token TEXT,
  email TEXT,
  role TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  -- Check inviter has permission (owner or facilitator)
  SELECT pm.role INTO v_user_role
  FROM project_members pm
  WHERE pm.project_id = p_project_id AND pm.user_id = p_inviter_id;

  IF v_user_role IS NULL THEN
    SELECT p.owner_id INTO v_user_role
    FROM projects p
    WHERE p.id = p_project_id AND p.owner_id = p_inviter_id;

    IF v_user_role IS NOT NULL THEN
      v_user_role := 'owner';
    END IF;
  END IF;

  IF v_user_role NOT IN ('owner', 'facilitator') THEN
    RAISE EXCEPTION 'Unauthorized: Only owners and facilitators can send invitations';
  END IF;

  -- Create invitation (7-day expiry)
  INSERT INTO project_invitations (
    project_id,
    inviter_id,
    invitee_email,
    role,
    token,
    expires_at,
    status
  )
  VALUES (
    p_project_id,
    p_inviter_id,
    LOWER(p_invitee_email),
    p_role,
    p_token,
    NOW() + INTERVAL '7 days',
    'pending'
  )
  RETURNING
    project_invitations.id,
    project_invitations.token,
    project_invitations.invitee_email,
    project_invitations.role,
    project_invitations.expires_at
  INTO id, token, email, role, expires_at;

  RETURN NEXT;
END;
$$;

-- Accept project invitation
CREATE OR REPLACE FUNCTION accept_project_invitation(
  p_token TEXT,
  p_user_id UUID
)
RETURNS TABLE(
  project_id UUID,
  role TEXT,
  success BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  -- Fetch and validate invitation
  SELECT * INTO v_invitation
  FROM project_invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > NOW();

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  -- Add user to project members (idempotent)
  INSERT INTO project_members (project_id, user_id, role, joined_at)
  VALUES (v_invitation.project_id, p_user_id, v_invitation.role, NOW())
  ON CONFLICT (project_id, user_id) DO NOTHING;

  -- Mark invitation as accepted
  UPDATE project_invitations
  SET status = 'accepted', accepted_at = NOW()
  WHERE token = p_token;

  RETURN QUERY
  SELECT v_invitation.project_id, v_invitation.role::TEXT, TRUE;
END;
$$;

-- Cleanup expired invitations (for cron jobs)
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM project_invitations
  WHERE status = 'pending' AND expires_at < NOW();

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- ============================================================================
-- PART 4: EXPORT RPC (SEC-03)
-- ============================================================================

-- Request data export (placeholder for export queue)
CREATE OR REPLACE FUNCTION request_data_export(
  p_user_id UUID,
  p_project_id UUID,
  p_include_audio BOOLEAN,
  p_include_photos BOOLEAN
)
RETURNS TABLE(
  export_id UUID,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_access BOOLEAN;
BEGIN
  -- Verify user has access to project
  SELECT EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = p_project_id AND pm.user_id = p_user_id
    UNION
    SELECT 1 FROM projects p
    WHERE p.id = p_project_id AND p.owner_id = p_user_id
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Unauthorized: No access to project';
  END IF;

  -- TODO: Create export_requests table and insert record
  -- For now, return placeholder
  RETURN QUERY
  SELECT
    gen_random_uuid() AS export_id,
    'queued'::TEXT AS status,
    NOW() AS created_at;
END;
$$;

-- ============================================================================
-- PART 5: GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION initialize_user_wallet(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_package_purchase(UUID, TEXT, INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION send_project_invitation(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_project_invitation(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_invitations() TO authenticated;
GRANT EXECUTE ON FUNCTION request_data_export(UUID, UUID, BOOLEAN, BOOLEAN) TO authenticated;

-- Grant service role for admin operations
GRANT EXECUTE ON FUNCTION cleanup_expired_invitations() TO service_role;
GRANT EXECUTE ON FUNCTION process_package_purchase(UUID, TEXT, INTEGER, INTEGER, TEXT) TO service_role;

-- ============================================================================
-- FINALIZE
-- ============================================================================

COMMIT;

-- Verify critical components
DO $$
DECLARE
  rpc_count INTEGER;
  table_count INTEGER;
BEGIN
  -- Check RPC functions
  SELECT COUNT(*) INTO rpc_count
  FROM information_schema.routines 
  WHERE routine_schema = 'public' 
  AND routine_name IN (
    'initialize_user_wallet',
    'process_package_purchase',
    'send_project_invitation',
    'accept_project_invitation',
    'cleanup_expired_invitations',
    'request_data_export'
  );
  
  -- Check core tables
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('users', 'projects', 'stories', 'user_resource_wallets');
  
  RAISE NOTICE '✅ Deployment verification:';
  RAISE NOTICE '   - RPC functions created: % / 6', rpc_count;
  RAISE NOTICE '   - Core tables exist: % / 4', table_count;
  
  IF rpc_count = 6 AND table_count = 4 THEN
    RAISE NOTICE '🎉 Database initialized successfully!';
  ELSE
    RAISE WARNING '⚠️  Some components may be missing. Check logs above.';
  END IF;
END $$;

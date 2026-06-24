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

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

create index if not exists projects_facilitator_id_idx on public.projects(facilitator_id);
create index if not exists project_roles_user_id_idx on public.project_roles(user_id);
create index if not exists stories_project_id_idx on public.stories(project_id);
create index if not exists stories_user_id_idx on public.stories(user_id);
create index if not exists interactions_story_id_idx on public.interactions(story_id);
create index if not exists invitations_token_idx on public.invitations(token);

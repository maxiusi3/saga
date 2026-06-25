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

-- Phase 1 agent tables for the private biography loop.
-- Run in Supabase SQL editor before deploying API routes that write agent data.

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_type text not null check (agent_type in ('interview', 'editor_librarian')),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  project_id uuid null references public.projects(id) on delete cascade,
  story_id uuid null references public.stories(id) on delete cascade,
  interview_session_id uuid null,
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

alter table public.agent_runs
  add constraint agent_runs_interview_session_fk
  foreign key (interview_session_id)
  references public.interview_sessions(id)
  on delete set null;

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

create index if not exists idx_agent_runs_project_id on public.agent_runs(project_id);
create index if not exists idx_agent_runs_story_id on public.agent_runs(story_id);
create index if not exists idx_agent_runs_agent_type on public.agent_runs(agent_type);
create index if not exists idx_interview_sessions_project_id on public.interview_sessions(project_id);
create index if not exists idx_interview_events_session_id on public.interview_events(interview_session_id);
create index if not exists idx_agent_artifacts_story_id on public.agent_artifacts(story_id);
create index if not exists idx_story_elements_story_id on public.story_elements(story_id);
create index if not exists idx_story_elements_project_type on public.story_elements(project_id, element_type);

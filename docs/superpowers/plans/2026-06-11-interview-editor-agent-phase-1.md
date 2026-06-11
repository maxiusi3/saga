# Interview and Editor Agent Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 private biography loop: Interview Agent plus Editor and Librarian Agent, with durable agent artifacts and no Wiki or Media implementation.

**Architecture:** Add shared agent types, Supabase SQL for Phase 1 agent tables, server-side agent storage helpers, pure agent decision/extraction modules, protected API routes, and UI integration in the existing recording and story detail flows. The Interview Agent owns live host interventions; the Editor and Librarian Agent runs after story creation and creates standalone story artifacts plus structured story elements.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Supabase, Jest, existing OpenRouter-compatible AI routes, existing story recording components.

---

## Scope Check

This plan implements only Phase 1:

1. Interview Agent.
2. Editor and Librarian Agent.
3. `agent_runs`, `agent_artifacts`, `interview_sessions`, `interview_events`, and `story_elements`.
4. Off, Low, and High intervention levels.
5. Private biography artifacts and review surfaces.

This plan explicitly excludes:

1. Wiki Editor Agent.
2. Public archive event clustering.
3. Public anonymization routes.
4. Media Agent.
5. Photo restoration.
6. Story video generation.
7. `public_contributions`, `event_clusters`, and `media_jobs`.

If implementation work starts touching those excluded items, stop and split that work into a later phase.

## File Structure

Create:

- `packages/shared/src/types/agents.ts` - shared Phase 1 agent enums, interfaces, and payload shapes.
- `packages/shared/src/types/__tests__/agents.test.ts` - shared type and constant tests.
- `packages/web/supabase/agent-phase1.sql` - SQL for Phase 1 agent tables and indexes.
- `packages/web/src/lib/server/agent-store.ts` - server-only persistence helpers for agent runs, artifacts, sessions, events, and story elements.
- `packages/web/src/lib/server/__tests__/agent-store.test.ts` - server persistence unit tests with mocked Supabase admin client.
- `packages/web/src/lib/agents/interview-agent.ts` - pure Interview Agent state and intervention generation.
- `packages/web/src/lib/agents/__tests__/interview-agent.test.ts` - Interview Agent behavior tests.
- `packages/web/src/lib/agents/editor-agent.ts` - pure Editor and Librarian Agent artifact and element extraction logic.
- `packages/web/src/lib/agents/__tests__/editor-agent.test.ts` - Editor Agent behavior tests.
- `packages/web/src/lib/agent-service.ts` - browser client wrappers for Interview Agent APIs and Editor Agent processing.
- `packages/web/src/app/api/agents/interview/session/route.ts` - protected route to create an interview session.
- `packages/web/src/app/api/agents/interview/session/__tests__/route.test.ts` - interview session route tests.
- `packages/web/src/app/api/agents/interview/intervention/route.ts` - protected route to generate and store host interventions.
- `packages/web/src/app/api/agents/interview/intervention/__tests__/route.test.ts` - interview intervention route tests.
- `packages/web/src/app/api/agents/editor/process-story/route.ts` - protected route to process one story through the Editor and Librarian Agent.
- `packages/web/src/app/api/agents/editor/process-story/__tests__/route.test.ts` - Editor Agent route tests.
- `packages/web/src/app/api/stories/[storyId]/agent-artifacts/route.ts` - protected route to load private Editor Agent artifacts for one story.
- `packages/web/src/app/api/stories/[storyId]/agent-artifacts/__tests__/route.test.ts` - story artifact loading route tests.
- `packages/web/src/components/recording/InterventionLevelSelector.tsx` - Off/Low/High control shown before recording.
- `packages/web/src/components/recording/__tests__/intervention-level-selector.test.tsx` - selector tests.
- `packages/web/src/components/stories/AgentArtifactsPanel.tsx` - story detail panel for standalone story artifact and extracted elements.
- `packages/web/src/components/stories/__tests__/agent-artifacts-panel.test.tsx` - artifact panel tests.

Modify:

- `packages/shared/src/types/index.ts` - export agent types.
- `packages/shared/src/index.ts` - export agent types from package root.
- `packages/web/src/app/[locale]/dashboard/projects/[id]/record/page.tsx` - start interview session, store intervention level, trigger editor processing after save.
- `packages/web/src/components/recording/RecorderHub.tsx` - render intervention level selector before mode selection.
- `packages/web/src/components/recording/SmartRecorder.tsx` - request Interview Agent interventions instead of generic realtime prompts.
- `packages/web/src/components/recording/__tests__/record-page-uses-smart-recorder.test.tsx` - update existing record page integration test for agent props.
- `packages/web/src/app/[locale]/dashboard/projects/[id]/stories/[storyId]/page.tsx` - render agent artifacts panel.
- `packages/web/src/types/supabase.ts` - add typed entries for Phase 1 agent tables.
- `docs/superpowers/specs/2026-06-11-agent-collaboration-design.md` - keep the implementation boundary synchronized if code changes reveal a mismatch.
- `UR saga v1.8.md` - keep the product requirement synchronized if code changes reveal a mismatch.

---

### Task 1: Shared Phase 1 Agent Types

**Files:**
- Create: `packages/shared/src/types/agents.ts`
- Create: `packages/shared/src/types/__tests__/agents.test.ts`
- Modify: `packages/shared/src/types/index.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write the failing shared type tests**

Create `packages/shared/src/types/__tests__/agents.test.ts`:

```ts
import {
  AGENT_TYPES,
  INTERVENTION_LEVELS,
  INTERVIEW_EVENT_KINDS,
  STORY_ELEMENT_TYPES,
  type AgentType,
  type InterventionLevel,
  type StoryElementType,
} from '../agents'

describe('agent shared types', () => {
  it('defines Phase 1 agent types only', () => {
    const values: AgentType[] = [...AGENT_TYPES]
    expect(values).toEqual(['interview', 'editor_librarian'])
  })

  it('defines the supported Interview Agent intervention levels', () => {
    const values: InterventionLevel[] = [...INTERVENTION_LEVELS]
    expect(values).toEqual(['off', 'low', 'high'])
  })

  it('defines host intervention event kinds', () => {
    expect(INTERVIEW_EVENT_KINDS).toEqual([
      'opening',
      'warmup',
      'prior_story_recap',
      'gentle_probe',
      'transition',
      'emotional_support',
      'closing',
    ])
  })

  it('defines required private biography element types', () => {
    const values: StoryElementType[] = [...STORY_ELEMENT_TYPES]
    expect(values).toEqual([
      'time',
      'place',
      'person',
      'event',
      'theme',
      'emotion',
      'decision',
      'consequence',
      'reflection',
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test --workspace=packages/shared -- --runInBand packages/shared/src/types/__tests__/agents.test.ts
```

Expected: fail because `../agents` does not exist.

- [ ] **Step 3: Add shared agent types**

Create `packages/shared/src/types/agents.ts`:

```ts
export const AGENT_TYPES = ['interview', 'editor_librarian'] as const
export type AgentType = (typeof AGENT_TYPES)[number]

export const AGENT_RUN_STATUSES = ['pending', 'running', 'completed', 'failed'] as const
export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number]

export const AGENT_REVIEW_STATUSES = ['unreviewed', 'approved', 'rejected', 'edited'] as const
export type AgentReviewStatus = (typeof AGENT_REVIEW_STATUSES)[number]

export const INTERVENTION_LEVELS = ['off', 'low', 'high'] as const
export type InterventionLevel = (typeof INTERVENTION_LEVELS)[number]

export const INTERVIEW_EVENT_KINDS = [
  'opening',
  'warmup',
  'prior_story_recap',
  'gentle_probe',
  'transition',
  'emotional_support',
  'closing',
] as const
export type InterviewEventKind = (typeof INTERVIEW_EVENT_KINDS)[number]

export const STORY_ELEMENT_TYPES = [
  'time',
  'place',
  'person',
  'event',
  'theme',
  'emotion',
  'decision',
  'consequence',
  'reflection',
] as const
export type StoryElementType = (typeof STORY_ELEMENT_TYPES)[number]

export interface AgentRun {
  id: string
  agent_type: AgentType
  status: AgentRunStatus
  project_id?: string
  story_id?: string
  interview_session_id?: string
  input: Record<string, unknown>
  output?: Record<string, unknown>
  model?: string
  error?: string
  started_at: string
  completed_at?: string
  created_by: string
}

export interface AgentArtifact {
  id: string
  agent_run_id: string
  project_id: string
  story_id?: string
  artifact_type:
    | 'host_intervention'
    | 'standalone_story'
    | 'story_summary'
    | 'follow_up_questions'
    | 'story_elements'
  payload: Record<string, unknown>
  source_refs: AgentSourceRef[]
  review_status: AgentReviewStatus
  confidence: number
  created_at: string
  updated_at: string
}

export interface AgentSourceRef {
  source_type: 'transcript' | 'story' | 'interview_event' | 'media'
  source_id: string
  start_offset?: number
  end_offset?: number
  quote?: string
}

export interface InterviewSession {
  id: string
  project_id: string
  storyteller_id: string
  prompt_text?: string
  recording_mode: 'deep_dive' | 'chat'
  intervention_level: InterventionLevel
  status: 'active' | 'completed' | 'abandoned'
  started_at: string
  completed_at?: string
}

export interface InterviewEvent {
  id: string
  interview_session_id: string
  project_id: string
  storyteller_id: string
  event_kind: InterviewEventKind
  intervention_level: InterventionLevel
  trigger_reason: string
  prompt_text: string
  transcript_window?: string
  transcript_start_offset?: number
  transcript_end_offset?: number
  accepted?: boolean
  created_at: string
}

export interface StoryElement {
  id: string
  project_id: string
  story_id: string
  agent_run_id: string
  element_type: StoryElementType
  value: string
  normalized_value?: string
  source_quote: string
  source_start_offset?: number
  source_end_offset?: number
  confidence: number
  review_status: AgentReviewStatus
  created_at: string
  updated_at: string
}
```

- [ ] **Step 4: Export the shared types**

Append to `packages/shared/src/types/index.ts`:

```ts
export * from './agents'
```

Append to `packages/shared/src/index.ts`:

```ts
export * from './types/agents'
```

- [ ] **Step 5: Run shared tests**

Run:

```bash
npm test --workspace=packages/shared -- --runInBand packages/shared/src/types/__tests__/agents.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/types/agents.ts packages/shared/src/types/__tests__/agents.test.ts packages/shared/src/types/index.ts packages/shared/src/index.ts
git commit -m "feat: add phase one agent shared types"
```

---

### Task 2: Phase 1 Agent Database Schema

**Files:**
- Create: `packages/web/supabase/agent-phase1.sql`
- Modify: `packages/web/src/types/supabase.ts`

- [ ] **Step 1: Create SQL schema file**

Create `packages/web/supabase/agent-phase1.sql`:

```sql
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
```

- [ ] **Step 2: Add typed Supabase entries**

Modify `packages/web/src/types/supabase.ts` inside `Database.public.Tables` with table entries matching the SQL. Add these entries after `interactions` and before `subscriptions`:

```ts
      agent_runs: {
        Row: {
          id: string
          agent_type: string
          status: string
          project_id: string | null
          story_id: string | null
          interview_session_id: string | null
          input: Json
          output: Json | null
          model: string | null
          error: string | null
          started_at: string
          completed_at: string | null
          created_by: string
        }
        Insert: {
          id?: string
          agent_type: string
          status?: string
          project_id?: string | null
          story_id?: string | null
          interview_session_id?: string | null
          input?: Json
          output?: Json | null
          model?: string | null
          error?: string | null
          started_at?: string
          completed_at?: string | null
          created_by: string
        }
        Update: {
          id?: string
          agent_type?: string
          status?: string
          project_id?: string | null
          story_id?: string | null
          interview_session_id?: string | null
          input?: Json
          output?: Json | null
          model?: string | null
          error?: string | null
          started_at?: string
          completed_at?: string | null
          created_by?: string
        }
      }
      interview_sessions: {
        Row: {
          id: string
          project_id: string
          storyteller_id: string
          prompt_text: string | null
          recording_mode: string
          intervention_level: string
          status: string
          started_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          storyteller_id: string
          prompt_text?: string | null
          recording_mode: string
          intervention_level: string
          status?: string
          started_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          storyteller_id?: string
          prompt_text?: string | null
          recording_mode?: string
          intervention_level?: string
          status?: string
          started_at?: string
          completed_at?: string | null
        }
      }
      interview_events: {
        Row: {
          id: string
          interview_session_id: string
          project_id: string
          storyteller_id: string
          event_kind: string
          intervention_level: string
          trigger_reason: string
          prompt_text: string
          transcript_window: string | null
          transcript_start_offset: number | null
          transcript_end_offset: number | null
          accepted: boolean | null
          created_at: string
        }
        Insert: {
          id?: string
          interview_session_id: string
          project_id: string
          storyteller_id: string
          event_kind: string
          intervention_level: string
          trigger_reason: string
          prompt_text: string
          transcript_window?: string | null
          transcript_start_offset?: number | null
          transcript_end_offset?: number | null
          accepted?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string
          interview_session_id?: string
          project_id?: string
          storyteller_id?: string
          event_kind?: string
          intervention_level?: string
          trigger_reason?: string
          prompt_text?: string
          transcript_window?: string | null
          transcript_start_offset?: number | null
          transcript_end_offset?: number | null
          accepted?: boolean | null
          created_at?: string
        }
      }
```

Add these `agent_artifacts` and `story_elements` entries immediately after `interview_events`:

```ts
      agent_artifacts: {
        Row: {
          id: string
          agent_run_id: string
          project_id: string
          story_id: string | null
          artifact_type: string
          payload: Json
          source_refs: Json
          review_status: string
          confidence: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          agent_run_id: string
          project_id: string
          story_id?: string | null
          artifact_type: string
          payload?: Json
          source_refs?: Json
          review_status?: string
          confidence?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          agent_run_id?: string
          project_id?: string
          story_id?: string | null
          artifact_type?: string
          payload?: Json
          source_refs?: Json
          review_status?: string
          confidence?: number
          created_at?: string
          updated_at?: string
        }
      }
      story_elements: {
        Row: {
          id: string
          project_id: string
          story_id: string
          agent_run_id: string
          element_type: string
          value: string
          normalized_value: string | null
          source_quote: string
          source_start_offset: number | null
          source_end_offset: number | null
          confidence: number
          review_status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          story_id: string
          agent_run_id: string
          element_type: string
          value: string
          normalized_value?: string | null
          source_quote: string
          source_start_offset?: number | null
          source_end_offset?: number | null
          confidence?: number
          review_status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          story_id?: string
          agent_run_id?: string
          element_type?: string
          value?: string
          normalized_value?: string | null
          source_quote?: string
          source_start_offset?: number | null
          source_end_offset?: number | null
          confidence?: number
          review_status?: string
          created_at?: string
          updated_at?: string
        }
      }
```

- [ ] **Step 3: Run type check**

Run:

```bash
npm run type-check --workspace=packages/web
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add packages/web/supabase/agent-phase1.sql packages/web/src/types/supabase.ts
git commit -m "feat: add phase one agent schema"
```

---

### Task 3: Agent Store Server Helpers

**Files:**
- Create: `packages/web/src/lib/server/agent-store.ts`
- Create: `packages/web/src/lib/server/__tests__/agent-store.test.ts`

- [ ] **Step 1: Write failing persistence tests**

Create `packages/web/src/lib/server/__tests__/agent-store.test.ts`:

```ts
import {
  createAgentRun,
  completeAgentRun,
  createInterviewSession,
  createInterviewEvent,
  createAgentArtifact,
  createStoryElements,
} from '../agent-store'

const single = jest.fn()
const select = jest.fn(() => ({ single }))
const insert = jest.fn(() => ({ select }))
const updateSingle = jest.fn()
const updateSelect = jest.fn(() => ({ single: updateSingle }))
const eq = jest.fn(() => ({ select: updateSelect }))
const update = jest.fn(() => ({ eq }))
const from = jest.fn(() => ({ insert, update }))

jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({ from }),
}))

describe('agent-store', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    single.mockResolvedValue({ data: { id: 'row-1' }, error: null })
    updateSingle.mockResolvedValue({ data: { id: 'run-1', status: 'completed' }, error: null })
  })

  it('creates agent runs', async () => {
    await createAgentRun({
      agentType: 'interview',
      projectId: 'project-1',
      storyId: null,
      interviewSessionId: null,
      createdBy: 'user-1',
      input: { phase: 'opening' },
      model: 'deterministic-v1',
    })

    expect(from).toHaveBeenCalledWith('agent_runs')
    expect(insert).toHaveBeenCalledWith({
      agent_type: 'interview',
      status: 'running',
      project_id: 'project-1',
      story_id: null,
      interview_session_id: null,
      created_by: 'user-1',
      input: { phase: 'opening' },
      model: 'deterministic-v1',
    })
  })

  it('completes agent runs', async () => {
    await completeAgentRun('run-1', { prompt: 'Welcome.' })

    expect(update).toHaveBeenCalledWith({
      status: 'completed',
      output: { prompt: 'Welcome.' },
      completed_at: expect.any(String),
      error: null,
    })
  })

  it('creates interview sessions and events', async () => {
    await createInterviewSession({
      projectId: 'project-1',
      storytellerId: 'user-1',
      promptText: 'Tell me about your childhood.',
      recordingMode: 'deep_dive',
      interventionLevel: 'low',
    })

    await createInterviewEvent({
      interviewSessionId: 'session-1',
      projectId: 'project-1',
      storytellerId: 'user-1',
      eventKind: 'opening',
      interventionLevel: 'low',
      triggerReason: 'session_started',
      promptText: 'Welcome. Take your time.',
      transcriptWindow: '',
      transcriptStartOffset: null,
      transcriptEndOffset: null,
    })

    expect(from).toHaveBeenCalledWith('interview_sessions')
    expect(from).toHaveBeenCalledWith('interview_events')
  })

  it('creates artifacts and story elements', async () => {
    await createAgentArtifact({
      agentRunId: 'run-1',
      projectId: 'project-1',
      storyId: 'story-1',
      artifactType: 'standalone_story',
      payload: { title: 'A Story' },
      sourceRefs: [],
      confidence: 0.85,
    })

    await createStoryElements([
      {
        projectId: 'project-1',
        storyId: 'story-1',
        agentRunId: 'run-1',
        elementType: 'time',
        value: '1976',
        normalizedValue: '1976',
        sourceQuote: 'In 1976',
        sourceStartOffset: 0,
        sourceEndOffset: 7,
        confidence: 0.9,
      },
    ])

    expect(from).toHaveBeenCalledWith('agent_artifacts')
    expect(from).toHaveBeenCalledWith('story_elements')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/lib/server/__tests__/agent-store.test.ts
```

Expected: fail because `agent-store` does not exist.

- [ ] **Step 3: Add agent store helper**

Create `packages/web/src/lib/server/agent-store.ts`:

```ts
import type {
  AgentType,
  AgentReviewStatus,
  InterviewEventKind,
  InterventionLevel,
  StoryElementType,
} from '@saga/shared'
import { getSupabaseAdmin } from '@/lib/supabase'

type JsonObject = Record<string, unknown>
type SourceRefInput = Record<string, unknown>

function raise(error: { message?: string } | null) {
  if (error) throw new Error(error.message || 'Supabase agent store operation failed')
}

export async function createAgentRun(input: {
  agentType: AgentType
  projectId: string | null
  storyId: string | null
  interviewSessionId: string | null
  createdBy: string
  input: JsonObject
  model: string
}) {
  const { data, error } = await getSupabaseAdmin()
    .from('agent_runs')
    .insert({
      agent_type: input.agentType,
      status: 'running',
      project_id: input.projectId,
      story_id: input.storyId,
      interview_session_id: input.interviewSessionId,
      created_by: input.createdBy,
      input: input.input,
      model: input.model,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function completeAgentRun(agentRunId: string, output: JsonObject) {
  const { data, error } = await getSupabaseAdmin()
    .from('agent_runs')
    .update({
      status: 'completed',
      output,
      completed_at: new Date().toISOString(),
      error: null,
    })
    .eq('id', agentRunId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function failAgentRun(agentRunId: string, errorMessage: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('agent_runs')
    .update({
      status: 'failed',
      error: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq('id', agentRunId)
    .select()
    .single()

  raise(error)
  return data
}

export async function createInterviewSession(input: {
  projectId: string
  storytellerId: string
  promptText?: string | null
  recordingMode: 'deep_dive' | 'chat'
  interventionLevel: InterventionLevel
}) {
  const { data, error } = await getSupabaseAdmin()
    .from('interview_sessions')
    .insert({
      project_id: input.projectId,
      storyteller_id: input.storytellerId,
      prompt_text: input.promptText || null,
      recording_mode: input.recordingMode,
      intervention_level: input.interventionLevel,
      status: 'active',
    })
    .select()
    .single()

  raise(error)
  return data
}

export async function completeInterviewSession(interviewSessionId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('interview_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', interviewSessionId)
    .select()
    .single()

  raise(error)
  return data
}

export async function createInterviewEvent(input: {
  interviewSessionId: string
  projectId: string
  storytellerId: string
  eventKind: InterviewEventKind
  interventionLevel: InterventionLevel
  triggerReason: string
  promptText: string
  transcriptWindow?: string | null
  transcriptStartOffset?: number | null
  transcriptEndOffset?: number | null
  accepted?: boolean | null
}) {
  const { data, error } = await getSupabaseAdmin()
    .from('interview_events')
    .insert({
      interview_session_id: input.interviewSessionId,
      project_id: input.projectId,
      storyteller_id: input.storytellerId,
      event_kind: input.eventKind,
      intervention_level: input.interventionLevel,
      trigger_reason: input.triggerReason,
      prompt_text: input.promptText,
      transcript_window: input.transcriptWindow || null,
      transcript_start_offset: input.transcriptStartOffset ?? null,
      transcript_end_offset: input.transcriptEndOffset ?? null,
      accepted: input.accepted ?? null,
    })
    .select()
    .single()

  raise(error)
  return data
}

export async function createAgentArtifact(input: {
  agentRunId: string
  projectId: string
  storyId?: string | null
  artifactType: 'host_intervention' | 'standalone_story' | 'story_summary' | 'follow_up_questions' | 'story_elements'
  payload: JsonObject
  sourceRefs: SourceRefInput[]
  confidence: number
  reviewStatus?: AgentReviewStatus
}) {
  const { data, error } = await getSupabaseAdmin()
    .from('agent_artifacts')
    .insert({
      agent_run_id: input.agentRunId,
      project_id: input.projectId,
      story_id: input.storyId || null,
      artifact_type: input.artifactType,
      payload: input.payload,
      source_refs: input.sourceRefs,
      confidence: input.confidence,
      review_status: input.reviewStatus || 'unreviewed',
    })
    .select()
    .single()

  raise(error)
  return data
}

export async function createStoryElements(
  elements: Array<{
    projectId: string
    storyId: string
    agentRunId: string
    elementType: StoryElementType
    value: string
    normalizedValue?: string | null
    sourceQuote: string
    sourceStartOffset?: number | null
    sourceEndOffset?: number | null
    confidence: number
    reviewStatus?: AgentReviewStatus
  }>,
) {
  if (elements.length === 0) return []

  const { data, error } = await getSupabaseAdmin()
    .from('story_elements')
    .insert(
      elements.map(element => ({
        project_id: element.projectId,
        story_id: element.storyId,
        agent_run_id: element.agentRunId,
        element_type: element.elementType,
        value: element.value,
        normalized_value: element.normalizedValue || null,
        source_quote: element.sourceQuote,
        source_start_offset: element.sourceStartOffset ?? null,
        source_end_offset: element.sourceEndOffset ?? null,
        confidence: element.confidence,
        review_status: element.reviewStatus || 'unreviewed',
      })),
    )
    .select()

  raise(error)
  return data || []
}

export async function getAgentArtifactsForStory(storyId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('agent_artifacts')
    .select('*')
    .eq('story_id', storyId)
    .order('created_at', { ascending: false })

  raise(error)
  return data || []
}

export async function getStoryElementsForStory(storyId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('story_elements')
    .select('*')
    .eq('story_id', storyId)
    .order('created_at', { ascending: true })

  raise(error)
  return data || []
}
```

- [ ] **Step 4: Run test**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/lib/server/__tests__/agent-store.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/server/agent-store.ts packages/web/src/lib/server/__tests__/agent-store.test.ts
git commit -m "feat: add phase one agent store"
```

---

### Task 4: Interview Agent Logic

**Files:**
- Create: `packages/web/src/lib/agents/interview-agent.ts`
- Create: `packages/web/src/lib/agents/__tests__/interview-agent.test.ts`

- [ ] **Step 1: Write failing Interview Agent tests**

Create `packages/web/src/lib/agents/__tests__/interview-agent.test.ts`:

```ts
import { generateInterviewIntervention } from '../interview-agent'

describe('generateInterviewIntervention', () => {
  it('returns no prompt when intervention level is off', () => {
    const result = generateInterviewIntervention({
      interventionLevel: 'off',
      phase: 'opening',
      storytellerName: 'John',
      currentPrompt: 'Tell me about your first home.',
      recentTranscript: '',
      previousStorySummary: null,
      previousPrompts: [],
      silenceMs: 0,
    })

    expect(result).toEqual({
      shouldIntervene: false,
      eventKind: null,
      triggerReason: 'intervention_level_off',
      promptText: '',
    })
  })

  it('creates a short opening at low intervention level', () => {
    const result = generateInterviewIntervention({
      interventionLevel: 'low',
      phase: 'opening',
      storytellerName: 'John',
      currentPrompt: 'Tell me about your first home.',
      recentTranscript: '',
      previousStorySummary: null,
      previousPrompts: [],
      silenceMs: 0,
    })

    expect(result.shouldIntervene).toBe(true)
    expect(result.eventKind).toBe('opening')
    expect(result.promptText).toContain('John')
    expect(result.promptText.length).toBeLessThanOrEqual(220)
  })

  it('uses prior story recap when available at high level', () => {
    const result = generateInterviewIntervention({
      interventionLevel: 'high',
      phase: 'prior_story_recap',
      storytellerName: 'Mei',
      currentPrompt: 'Tell me about moving to the city.',
      recentTranscript: '',
      previousStorySummary: 'Last time you described leaving your village by train.',
      previousPrompts: [],
      silenceMs: 0,
    })

    expect(result.shouldIntervene).toBe(true)
    expect(result.eventKind).toBe('prior_story_recap')
    expect(result.promptText).toContain('Last time')
  })

  it('does not probe during low-level short silence', () => {
    const result = generateInterviewIntervention({
      interventionLevel: 'low',
      phase: 'story_listening',
      storytellerName: 'John',
      currentPrompt: 'Tell me about school.',
      recentTranscript: 'I walked there with my brother.',
      previousStorySummary: null,
      previousPrompts: [],
      silenceMs: 5000,
    })

    expect(result.shouldIntervene).toBe(false)
    expect(result.triggerReason).toBe('listening_without_interrupting')
  })

  it('offers emotional support for negative emotional cues', () => {
    const result = generateInterviewIntervention({
      interventionLevel: 'low',
      phase: 'story_listening',
      storytellerName: 'John',
      currentPrompt: 'Tell me about your family.',
      recentTranscript: 'That was a painful time and I still feel guilty.',
      previousStorySummary: null,
      previousPrompts: [],
      silenceMs: 3000,
    })

    expect(result.shouldIntervene).toBe(true)
    expect(result.eventKind).toBe('emotional_support')
    expect(result.promptText).toContain('pause')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/lib/agents/__tests__/interview-agent.test.ts
```

Expected: fail because `interview-agent` does not exist.

- [ ] **Step 3: Add Interview Agent pure logic**

Create `packages/web/src/lib/agents/interview-agent.ts`:

```ts
import type { InterviewEventKind, InterventionLevel } from '@saga/shared'

export type InterviewPhase =
  | 'opening'
  | 'warmup'
  | 'prior_story_recap'
  | 'story_listening'
  | 'transition'
  | 'closing'

export interface InterviewInterventionInput {
  interventionLevel: InterventionLevel
  phase: InterviewPhase
  storytellerName?: string
  currentPrompt?: string
  recentTranscript: string
  previousStorySummary: string | null
  previousPrompts: string[]
  silenceMs: number
}

export interface InterviewInterventionResult {
  shouldIntervene: boolean
  eventKind: InterviewEventKind | null
  triggerReason: string
  promptText: string
}

const NEGATIVE_EMOTION_PATTERN = /(painful|guilty|sad|grief|lonely|afraid|scared|ashamed|难过|内疚|伤心|害怕|孤独|痛苦)/i

export function generateInterviewIntervention(input: InterviewInterventionInput): InterviewInterventionResult {
  if (input.interventionLevel === 'off') {
    return {
      shouldIntervene: false,
      eventKind: null,
      triggerReason: 'intervention_level_off',
      promptText: '',
    }
  }

  const name = input.storytellerName?.trim() || 'there'

  if (NEGATIVE_EMOTION_PATTERN.test(input.recentTranscript)) {
    return {
      shouldIntervene: true,
      eventKind: 'emotional_support',
      triggerReason: 'negative_emotional_cue',
      promptText: 'We can pause for a moment if you want. Take your time; you do not have to rush this part.',
    }
  }

  if (input.phase === 'opening') {
    return {
      shouldIntervene: true,
      eventKind: 'opening',
      triggerReason: 'session_started',
      promptText: `Hi ${name}. I am here to listen and gently help if you get stuck. You can take your time. ${input.currentPrompt || 'Start wherever the memory begins for you.'}`,
    }
  }

  if (input.phase === 'warmup' && input.interventionLevel === 'high') {
    return {
      shouldIntervene: true,
      eventKind: 'warmup',
      triggerReason: 'high_level_warmup',
      promptText: 'Before the main story, what is one small detail from that time that still feels vivid to you?',
    }
  }

  if (input.phase === 'prior_story_recap' && input.previousStorySummary) {
    return {
      shouldIntervene: true,
      eventKind: 'prior_story_recap',
      triggerReason: 'previous_story_available',
      promptText: `${input.previousStorySummary} We can continue from there, or you can start with the moment that feels most important today.`,
    }
  }

  if (input.phase === 'story_listening') {
    const silenceThreshold = input.interventionLevel === 'high' ? 12000 : 20000
    if (input.silenceMs >= silenceThreshold) {
      const promptText = pickNonRepeatedPrompt(
        [
          'What happened next?',
          'Who else was there with you?',
          'Can you describe what the place looked or sounded like?',
          'What were you feeling in that moment?',
        ],
        input.previousPrompts,
      )
      return {
        shouldIntervene: true,
        eventKind: 'gentle_probe',
        triggerReason: 'long_silence',
        promptText,
      }
    }
  }

  if (input.phase === 'transition' && input.interventionLevel === 'high') {
    return {
      shouldIntervene: true,
      eventKind: 'transition',
      triggerReason: 'high_level_transition',
      promptText: 'You just described an important turning point. We can stay with that moment and talk about what changed afterward.',
    }
  }

  if (input.phase === 'closing') {
    return {
      shouldIntervene: true,
      eventKind: 'closing',
      triggerReason: 'session_closing',
      promptText: 'Thank you for sharing that. Later, you can add names, dates, places, or photos if any details come back to you.',
    }
  }

  return {
    shouldIntervene: false,
    eventKind: null,
    triggerReason: 'listening_without_interrupting',
    promptText: '',
  }
}

function pickNonRepeatedPrompt(prompts: string[], previousPrompts: string[]) {
  return prompts.find(prompt => !previousPrompts.includes(prompt)) || prompts[0]
}
```

- [ ] **Step 4: Run test**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/lib/agents/__tests__/interview-agent.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/agents/interview-agent.ts packages/web/src/lib/agents/__tests__/interview-agent.test.ts
git commit -m "feat: add interview agent logic"
```

---

### Task 5: Interview Agent API And Client Service

**Files:**
- Create: `packages/web/src/app/api/agents/interview/session/route.ts`
- Create: `packages/web/src/app/api/agents/interview/intervention/route.ts`
- Create: `packages/web/src/lib/agent-service.ts`
- Test: `packages/web/src/app/api/agents/interview/session/__tests__/route.test.ts`
- Test: `packages/web/src/app/api/agents/interview/intervention/__tests__/route.test.ts`

- [ ] **Step 1: Write API tests for session creation**

Create `packages/web/src/app/api/agents/interview/session/__tests__/route.test.ts`:

```ts
/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from 'next/server'
import { POST } from '../route'
import { createInterviewSession } from '@/lib/server/agent-store'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'

jest.mock('@/lib/server/auth', () => ({
  getAuthenticatedUser: jest.fn(),
}))

jest.mock('@/lib/server/project-access', () => ({
  requireProjectAccess: jest.fn(),
}))

jest.mock('@/lib/server/agent-store', () => ({
  createInterviewSession: jest.fn(),
}))

describe('/api/agents/interview/session', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthenticatedUser as jest.Mock).mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      headers: new Headers(),
    })
    ;(requireProjectAccess as jest.Mock).mockResolvedValue({ ok: true })
    ;(createInterviewSession as jest.Mock).mockResolvedValue({ id: 'session-1' })
  })

  it('creates an interview session for a project member', async () => {
    const request = new NextRequest('http://localhost/api/agents/interview/session', {
      method: 'POST',
      body: JSON.stringify({
        projectId: 'project-1',
        storytellerId: 'user-1',
        promptText: 'Tell me about your first home.',
        recordingMode: 'deep_dive',
        interventionLevel: 'low',
      }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ session: { id: 'session-1' } })
    expect(createInterviewSession).toHaveBeenCalledWith({
      projectId: 'project-1',
      storytellerId: 'user-1',
      promptText: 'Tell me about your first home.',
      recordingMode: 'deep_dive',
      interventionLevel: 'low',
    })
  })

  it('rejects invalid intervention levels', async () => {
    const request = new NextRequest('http://localhost/api/agents/interview/session', {
      method: 'POST',
      body: JSON.stringify({
        projectId: 'project-1',
        storytellerId: 'user-1',
        recordingMode: 'deep_dive',
        interventionLevel: 'very_high',
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    expect(createInterviewSession).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Write API tests for intervention creation**

Create `packages/web/src/app/api/agents/interview/intervention/__tests__/route.test.ts`:

```ts
/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST } from '../route'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import { createAgentRun, completeAgentRun, createInterviewEvent } from '@/lib/server/agent-store'

jest.mock('@/lib/server/auth', () => ({
  getAuthenticatedUser: jest.fn(),
}))

jest.mock('@/lib/server/project-access', () => ({
  requireProjectAccess: jest.fn(),
}))

jest.mock('@/lib/server/agent-store', () => ({
  createAgentRun: jest.fn(),
  completeAgentRun: jest.fn(),
  createInterviewEvent: jest.fn(),
}))

describe('/api/agents/interview/intervention', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthenticatedUser as jest.Mock).mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      headers: new Headers(),
    })
    ;(requireProjectAccess as jest.Mock).mockResolvedValue({ ok: true })
    ;(createAgentRun as jest.Mock).mockResolvedValue({ id: 'run-1' })
    ;(completeAgentRun as jest.Mock).mockResolvedValue({ id: 'run-1' })
    ;(createInterviewEvent as jest.Mock).mockResolvedValue({ id: 'event-1' })
  })

  it('does not create an event when intervention level is off', async () => {
    const request = new NextRequest('http://localhost/api/agents/interview/intervention', {
      method: 'POST',
      body: JSON.stringify({
        projectId: 'project-1',
        storytellerId: 'user-1',
        interviewSessionId: 'session-1',
        interventionLevel: 'off',
        phase: 'opening',
        currentPrompt: 'Tell me about your first home.',
        recentTranscript: '',
        previousStorySummary: null,
        previousPrompts: [],
        silenceMs: 0,
      }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.intervention.shouldIntervene).toBe(false)
    expect(createInterviewEvent).not.toHaveBeenCalled()
  })

  it('creates an agent run and interview event for an opening', async () => {
    const request = new NextRequest('http://localhost/api/agents/interview/intervention', {
      method: 'POST',
      body: JSON.stringify({
        projectId: 'project-1',
        storytellerId: 'user-1',
        interviewSessionId: 'session-1',
        interventionLevel: 'low',
        phase: 'opening',
        currentPrompt: 'Tell me about your first home.',
        recentTranscript: '',
        previousStorySummary: null,
        previousPrompts: [],
        silenceMs: 0,
      }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.intervention.eventKind).toBe('opening')
    expect(createAgentRun).toHaveBeenCalledWith(expect.objectContaining({ agentType: 'interview' }))
    expect(createInterviewEvent).toHaveBeenCalledWith(expect.objectContaining({ eventKind: 'opening' }))
    expect(completeAgentRun).toHaveBeenCalledWith('run-1', expect.any(Object))
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/app/api/agents/interview/session/__tests__/route.test.ts packages/web/src/app/api/agents/interview/intervention/__tests__/route.test.ts
```

Expected: fail because route files do not exist.

- [ ] **Step 4: Implement session route**

Create `packages/web/src/app/api/agents/interview/session/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { INTERVENTION_LEVELS, type InterventionLevel } from '@saga/shared'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import { createInterviewSession } from '@/lib/server/agent-store'

const RECORDING_MODES = ['deep_dive', 'chat'] as const
type RecordingMode = (typeof RECORDING_MODES)[number]

function isRecordingMode(value: unknown): value is RecordingMode {
  return typeof value === 'string' && RECORDING_MODES.includes(value as RecordingMode)
}

function isInterventionLevel(value: unknown): value is InterventionLevel {
  return typeof value === 'string' && INTERVENTION_LEVELS.includes(value as InterventionLevel)
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const projectId = typeof body.projectId === 'string' ? body.projectId : ''
    const storytellerId = typeof body.storytellerId === 'string' ? body.storytellerId : ''
    const promptText = typeof body.promptText === 'string' ? body.promptText : null

    if (!projectId || !storytellerId || !isRecordingMode(body.recordingMode) || !isInterventionLevel(body.interventionLevel)) {
      return NextResponse.json({ error: 'Invalid interview session payload' }, { status: 400, headers: auth.headers })
    }

    const access = await requireProjectAccess(projectId, auth.user)
    if (!access.ok) return access.response

    const session = await createInterviewSession({
      projectId,
      storytellerId,
      promptText,
      recordingMode: body.recordingMode,
      interventionLevel: body.interventionLevel,
    })

    return NextResponse.json({ session }, { headers: auth.headers })
  } catch (error) {
    console.error('Failed to create interview session', error)
    return NextResponse.json({ error: 'Failed to create interview session' }, { status: 500, headers: auth.headers })
  }
}
```

- [ ] **Step 5: Implement intervention route**

Create `packages/web/src/app/api/agents/interview/intervention/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { INTERVENTION_LEVELS, type InterventionLevel } from '@saga/shared'
import { generateInterviewIntervention, type InterviewPhase } from '@/lib/agents/interview-agent'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import { createAgentRun, completeAgentRun, createInterviewEvent, failAgentRun } from '@/lib/server/agent-store'

const INTERVIEW_PHASES: InterviewPhase[] = ['opening', 'warmup', 'prior_story_recap', 'story_listening', 'transition', 'closing']

function isInterventionLevel(value: unknown): value is InterventionLevel {
  return typeof value === 'string' && INTERVENTION_LEVELS.includes(value as InterventionLevel)
}

function isInterviewPhase(value: unknown): value is InterviewPhase {
  return typeof value === 'string' && INTERVIEW_PHASES.includes(value as InterviewPhase)
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  let runId: string | null = null

  try {
    const body = await request.json()
    const projectId = typeof body.projectId === 'string' ? body.projectId : ''
    const storytellerId = typeof body.storytellerId === 'string' ? body.storytellerId : ''
    const interviewSessionId = typeof body.interviewSessionId === 'string' ? body.interviewSessionId : ''

    if (!projectId || !storytellerId || !interviewSessionId || !isInterventionLevel(body.interventionLevel) || !isInterviewPhase(body.phase)) {
      return NextResponse.json({ error: 'Invalid intervention payload' }, { status: 400, headers: auth.headers })
    }

    const access = await requireProjectAccess(projectId, auth.user)
    if (!access.ok) return access.response

    const intervention = generateInterviewIntervention({
      interventionLevel: body.interventionLevel,
      phase: body.phase,
      storytellerName: typeof body.storytellerName === 'string' ? body.storytellerName : undefined,
      currentPrompt: typeof body.currentPrompt === 'string' ? body.currentPrompt : undefined,
      recentTranscript: typeof body.recentTranscript === 'string' ? body.recentTranscript : '',
      previousStorySummary: typeof body.previousStorySummary === 'string' ? body.previousStorySummary : null,
      previousPrompts: Array.isArray(body.previousPrompts) ? body.previousPrompts.filter((prompt: unknown) => typeof prompt === 'string') : [],
      silenceMs: typeof body.silenceMs === 'number' ? body.silenceMs : 0,
    })

    if (!intervention.shouldIntervene || !intervention.eventKind) {
      return NextResponse.json({ intervention }, { headers: auth.headers })
    }

    const run = await createAgentRun({
      agentType: 'interview',
      projectId,
      storyId: null,
      interviewSessionId,
      createdBy: auth.user.id,
      input: body,
      model: 'deterministic-interview-agent-v1',
    })
    runId = run.id

    const event = await createInterviewEvent({
      interviewSessionId,
      projectId,
      storytellerId,
      eventKind: intervention.eventKind,
      interventionLevel: body.interventionLevel,
      triggerReason: intervention.triggerReason,
      promptText: intervention.promptText,
      transcriptWindow: typeof body.recentTranscript === 'string' ? body.recentTranscript : '',
      transcriptStartOffset: null,
      transcriptEndOffset: null,
    })

    await completeAgentRun(run.id, { intervention, eventId: event.id })

    return NextResponse.json({ intervention, event }, { headers: auth.headers })
  } catch (error) {
    if (runId) await failAgentRun(runId, error instanceof Error ? error.message : 'Unknown interview agent error')
    console.error('Failed to create interview intervention', error)
    return NextResponse.json({ error: 'Failed to create interview intervention' }, { status: 500, headers: auth.headers })
  }
}
```

- [ ] **Step 6: Implement browser client wrapper**

Create `packages/web/src/lib/agent-service.ts`:

```ts
import type { InterventionLevel } from '@saga/shared'
import { useAuthStore } from '@/stores/auth-store'
import type { InterviewPhase } from '@/lib/agents/interview-agent'

async function authHeaders(): Promise<Record<string, string>> {
  const token = await useAuthStore.getState().getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const agentService = {
  async createInterviewSession(input: {
    projectId: string
    storytellerId: string
    promptText?: string
    recordingMode: 'deep_dive' | 'chat'
    interventionLevel: InterventionLevel
  }) {
    const response = await fetch('/api/agents/interview/session', {
      method: 'POST',
      headers: {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })
    if (!response.ok) throw new Error('Failed to create interview session')
    return response.json()
  },

  async requestInterviewIntervention(input: {
    projectId: string
    storytellerId: string
    interviewSessionId: string
    interventionLevel: InterventionLevel
    phase: InterviewPhase
    currentPrompt?: string
    recentTranscript: string
    previousStorySummary: string | null
    previousPrompts: string[]
    silenceMs: number
  }) {
    const response = await fetch('/api/agents/interview/intervention', {
      method: 'POST',
      headers: {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })
    if (!response.ok) throw new Error('Failed to create interview intervention')
    return response.json()
  },
}
```

- [ ] **Step 7: Run API tests**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/app/api/agents/interview/session/__tests__/route.test.ts packages/web/src/app/api/agents/interview/intervention/__tests__/route.test.ts
```

Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/app/api/agents/interview/session packages/web/src/app/api/agents/interview/intervention packages/web/src/lib/agent-service.ts
git commit -m "feat: add interview agent api"
```

---

### Task 6: Interview Agent UI Integration

**Files:**
- Create: `packages/web/src/components/recording/InterventionLevelSelector.tsx`
- Create: `packages/web/src/components/recording/__tests__/intervention-level-selector.test.tsx`
- Modify: `packages/web/src/components/recording/RecorderHub.tsx`
- Modify: `packages/web/src/components/recording/SmartRecorder.tsx`
- Modify: `packages/web/src/app/[locale]/dashboard/projects/[id]/record/page.tsx`
- Test: `packages/web/src/components/recording/__tests__/record-page-uses-smart-recorder.test.tsx`

- [ ] **Step 1: Write selector test**

Create `packages/web/src/components/recording/__tests__/intervention-level-selector.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { InterventionLevelSelector } from '../InterventionLevelSelector'

describe('InterventionLevelSelector', () => {
  it('lets the storyteller choose off, low, or high', () => {
    const onChange = jest.fn()
    render(<InterventionLevelSelector value="low" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /off/i }))
    fireEvent.click(screen.getByRole('button', { name: /high/i }))

    expect(onChange).toHaveBeenNthCalledWith(1, 'off')
    expect(onChange).toHaveBeenNthCalledWith(2, 'high')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/components/recording/__tests__/intervention-level-selector.test.tsx
```

Expected: fail because selector does not exist.

- [ ] **Step 3: Create selector component**

Create `packages/web/src/components/recording/InterventionLevelSelector.tsx`:

```tsx
'use client'

import type { InterventionLevel } from '@saga/shared'
import { Button } from '@/components/ui/button'

interface Props {
  value: InterventionLevel
  onChange: (value: InterventionLevel) => void
}

const options: Array<{ value: InterventionLevel; label: string; description: string }> = [
  { value: 'off', label: 'Off', description: 'No host guidance during recording.' },
  { value: 'low', label: 'Low', description: 'Opening, closing, and help only when you pause or feel stuck.' },
  { value: 'high', label: 'High', description: 'A more active host with warmup, recap, and occasional transitions.' },
]

export function InterventionLevelSelector({ value, onChange }: Props) {
  return (
    <section className="rounded-xl border bg-white p-4 shadow-sm dark:bg-stone-900">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Host guidance</h3>
        <p className="text-sm text-stone-500">Choose how much the AI host should intervene while you tell the story.</p>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {options.map(option => (
          <Button
            key={option.value}
            type="button"
            variant={value === option.value ? 'default' : 'outline'}
            className="h-auto flex-col items-start whitespace-normal p-3 text-left"
            onClick={() => onChange(option.value)}
          >
            <span className="font-medium">{option.label}</span>
            <span className="text-xs opacity-80">{option.description}</span>
          </Button>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Update record page test for intervention props**

Replace `packages/web/src/components/recording/__tests__/record-page-uses-smart-recorder.test.tsx` with:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'

const smartRecorder = jest.fn((props: any) => (
  <div data-testid="smart-recorder">
    {props.interventionLevel}:{props.interviewSessionId}
  </div>
))

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'project-1' }),
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}))

jest.mock('@/components/recording/RecorderHub', () => ({
  RecorderHub: ({
    onModeSelect,
    onInterventionLevelChange,
  }: {
    onModeSelect: (mode: 'deep_dive' | 'chat') => void
    onInterventionLevelChange: (level: 'off' | 'low' | 'high') => void
  }) => (
    <button
      type="button"
      onClick={() => {
        onInterventionLevelChange('high')
        onModeSelect('deep_dive')
      }}
    >
      Start recording
    </button>
  ),
}))

jest.mock('@/components/recording/SmartRecorder', () => ({
  SmartRecorder: (props: any) => smartRecorder(props),
}))

jest.mock('@/components/recording/ReviewStage', () => ({
  ReviewStage: () => <div data-testid="review-stage" />,
}))

jest.mock('@/components/recording/ResonanceCard', () => ({
  ResonanceCard: () => <div data-testid="resonance-card" />,
}))

jest.mock('@/lib/agent-service', () => ({
  agentService: {
    createInterviewSession: jest.fn().mockResolvedValue({ session: { id: 'session-1' } }),
    processStoryWithEditorAgent: jest.fn(),
  },
}))

jest.mock('@/lib/ai-service', () => ({
  aiService: {
    generateContentFromTranscript: jest.fn(),
  },
}))

jest.mock('@/lib/storage', () => ({
  uploadStoryAudio: jest.fn(),
  StorageService: jest.fn(),
}))

jest.mock('@/lib/stories', () => ({
  storyService: {
    createStory: jest.fn(),
    updateStory: jest.fn(),
  },
}))

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({ user: { id: 'user-1' } }),
}))

describe('record page V1.8 recorder selection', () => {
  it('passes selected intervention level and session id into SmartRecorder', async () => {
    const Page = (await import('@/app/[locale]/dashboard/projects/[id]/record/page')).default

    render(<Page />)
    fireEvent.click(screen.getByRole('button', { name: /start recording/i }))

    expect(await screen.findByTestId('smart-recorder')).toHaveTextContent('high:session-1')
    expect(smartRecorder).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      storytellerId: 'user-1',
      interviewSessionId: 'session-1',
      interventionLevel: 'high',
    }))
  })
})
```

- [ ] **Step 5: Update recording page state and props**

Modify `packages/web/src/app/[locale]/dashboard/projects/[id]/record/page.tsx`.

Change the shared import:

```ts
import { StoryPrompt, getNextPrompt, type InterventionLevel } from '@saga/shared'
```

Add the agent service import:

```ts
import { agentService } from '@/lib/agent-service'
```

Add state beside the current flow state:

```ts
const [interventionLevel, setInterventionLevel] = useState<InterventionLevel>('low')
const [interviewSessionId, setInterviewSessionId] = useState<string | null>(null)
```

Replace `handleModeSelect` with:

```ts
const handleModeSelect = async (selectedMode: RecordingMode) => {
  setMode(selectedMode)
  setInterviewSessionId(null)

  if (user?.id) {
    try {
      const response = await agentService.createInterviewSession({
        projectId,
        storytellerId: user.id,
        promptText: currentPrompt?.text,
        recordingMode: selectedMode,
        interventionLevel,
      })
      setInterviewSessionId(response.session.id)
    } catch (error) {
      console.warn('Interview Agent session creation failed:', error)
    }
  }

  setStage('recording')
}
```

Pass intervention props into `RecorderHub`:

```tsx
<RecorderHub
  onModeSelect={handleModeSelect}
  projectTitle={currentPrompt.text}
  interventionLevel={interventionLevel}
  onInterventionLevelChange={setInterventionLevel}
/>
```

Pass session and level props into `SmartRecorder`:

```tsx
<SmartRecorder
  projectId={projectId}
  storytellerId={user?.id || ''}
  interviewSessionId={interviewSessionId}
  interventionLevel={interventionLevel}
  promptText={currentPrompt.text}
  locale={locale}
  maxDuration={30 * 60}
  onRecordingComplete={(res) => handleRecordingComplete({
    audioBlob: res.audioBlob,
    transcript: res.transcript,
    duration: res.duration
  })}
  onError={(message) => {
    console.error('[record/page] recorder error:', message)
  }}
/>
```

- [ ] **Step 6: Update `RecorderHub`**

Replace `packages/web/src/components/recording/RecorderHub.tsx` with:

```tsx
import React from 'react'
import { Mic, MessageCircle } from 'lucide-react'
import type { InterventionLevel } from '@saga/shared'
import { InterventionLevelSelector } from './InterventionLevelSelector'

interface RecorderHubProps {
  onModeSelect: (mode: 'deep_dive' | 'chat') => void
  projectTitle?: string
  interventionLevel: InterventionLevel
  onInterventionLevelChange: (value: InterventionLevel) => void
}

export function RecorderHub({
  onModeSelect,
  projectTitle = 'New Story',
  interventionLevel,
  onInterventionLevelChange,
}: RecorderHubProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-8 p-6 animate-in fade-in duration-500">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-serif font-medium text-stone-800 dark:text-stone-100">
          How would you like to tell this story?
        </h2>
        <p className="text-stone-500 dark:text-stone-400">
          Choose the format that fits your memory.
        </p>
      </div>

      <div className="w-full max-w-2xl">
        <InterventionLevelSelector value={interventionLevel} onChange={onInterventionLevelChange} />
      </div>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-6 md:grid-cols-2">
        <button
          onClick={() => onModeSelect('deep_dive')}
          className="group relative flex flex-col items-center rounded-2xl border-2 border-stone-200 bg-white p-8 text-left transition-all duration-300 hover:border-amber-500 hover:shadow-xl dark:border-stone-800 dark:bg-stone-900 dark:hover:border-amber-500"
        >
          <div className="mb-4 rounded-full bg-amber-100 p-4 text-amber-600 transition-transform group-hover:scale-110 dark:bg-amber-900/30 dark:text-amber-400">
            <Mic className="h-8 w-8" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-stone-800 dark:text-stone-100">
            Deep Dive
          </h3>
          <p className="text-center text-sm text-stone-500 dark:text-stone-400">
            Best for long, detailed stories. The host can help only as much as you allow.
          </p>
          <span className="absolute right-4 top-4 rounded-full bg-stone-100 px-2 py-1 text-xs font-medium text-stone-500 dark:bg-stone-800">
            10-30 mins
          </span>
        </button>

        <button
          onClick={() => onModeSelect('chat')}
          className="group relative flex flex-col items-center rounded-2xl border-2 border-stone-200 bg-white p-8 text-left transition-all duration-300 hover:border-blue-500 hover:shadow-xl dark:border-stone-800 dark:bg-stone-900 dark:hover:border-blue-500"
        >
          <div className="mb-4 rounded-full bg-blue-100 p-4 text-blue-600 transition-transform group-hover:scale-110 dark:bg-blue-900/30 dark:text-blue-400">
            <MessageCircle className="h-8 w-8" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-stone-800 dark:text-stone-100">
            Chat Bubbles
          </h3>
          <p className="text-center text-sm text-stone-500 dark:text-stone-400">
            Share quick anecdotes or thoughts, one bubble at a time. Like sending a voice note.
          </p>
          <span className="absolute right-4 top-4 rounded-full bg-stone-100 px-2 py-1 text-xs font-medium text-stone-500 dark:bg-stone-800">
            1-2 mins
          </span>
        </button>
      </div>

      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-stone-50 p-4 text-center dark:border-stone-800 dark:bg-stone-900/50">
        <p className="text-sm italic text-stone-500 dark:text-stone-400">
          "{projectTitle}"
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Update `SmartRecorder`**

Modify `packages/web/src/components/recording/SmartRecorder.tsx`.

Add imports:

```ts
import type { InterventionLevel } from '@saga/shared'
import { agentService } from '@/lib/agent-service'
```

Extend `SmartRecorderProps`:

```ts
projectId: string
storytellerId: string
interviewSessionId: string | null
interventionLevel: InterventionLevel
```

Add those props to the component destructuring:

```ts
projectId,
storytellerId,
interviewSessionId,
interventionLevel,
```

Add this helper before `handleSilence`:

```ts
const showAgentPrompt = useCallback((prompt: string) => {
  if (!prompt) return
  setAiPrompt(prompt)
  setPreviousPrompts(prev => [...prev.slice(-4), prompt])
  setLastProcessedLength((transcript + interimTranscript).length)
  setTimeout(() => setAiPrompt(''), 10000)
}, [transcript, interimTranscript])
```

Replace the existing `aiService.generateRealtimePrompt` call in `handleSilence` with:

```ts
if (!interviewSessionId || interventionLevel === 'off') return
const response = await agentService.requestInterviewIntervention({
  projectId,
  storytellerId,
  interviewSessionId,
  interventionLevel,
  phase: 'story_listening',
  currentPrompt: promptText,
  recentTranscript: newContent,
  previousStorySummary: null,
  previousPrompts,
  silenceMs: 20000,
})
const prompt = response.intervention?.promptText || ''
showAgentPrompt(prompt)
```

Add this opening request after `setRecordingState('recording')` in `startRecording`:

```ts
if (interviewSessionId && interventionLevel !== 'off') {
  const response = await agentService.requestInterviewIntervention({
    projectId,
    storytellerId,
    interviewSessionId,
    interventionLevel,
    phase: 'opening',
    currentPrompt: promptText,
    recentTranscript: '',
    previousStorySummary: null,
    previousPrompts,
    silenceMs: 0,
  })
  showAgentPrompt(response.intervention?.promptText || '')
}
```

Add this closing request at the start of `handleComplete`:

```ts
if (interviewSessionId && interventionLevel !== 'off') {
  agentService.requestInterviewIntervention({
    projectId,
    storytellerId,
    interviewSessionId,
    interventionLevel,
    phase: 'closing',
    currentPrompt: promptText,
    recentTranscript: transcript.trim(),
    previousStorySummary: null,
    previousPrompts,
    silenceMs: 0,
  }).catch(error => {
    console.warn('Interview Agent closing prompt failed:', error)
  })
}
```

- [ ] **Step 8: Run UI tests**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/components/recording/__tests__/intervention-level-selector.test.tsx packages/web/src/components/recording/__tests__/record-page-uses-smart-recorder.test.tsx
```

Expected: pass.

- [ ] **Step 9: Commit**

```bash
git add packages/web/src/components/recording/InterventionLevelSelector.tsx packages/web/src/components/recording/__tests__/intervention-level-selector.test.tsx packages/web/src/components/recording/RecorderHub.tsx packages/web/src/components/recording/SmartRecorder.tsx 'packages/web/src/app/[locale]/dashboard/projects/[id]/record/page.tsx' packages/web/src/components/recording/__tests__/record-page-uses-smart-recorder.test.tsx
git commit -m "feat: wire interview agent into recording"
```

---

### Task 7: Editor And Librarian Agent Logic

**Files:**
- Create: `packages/web/src/lib/agents/editor-agent.ts`
- Create: `packages/web/src/lib/agents/__tests__/editor-agent.test.ts`

- [ ] **Step 1: Write failing Editor Agent tests**

Create `packages/web/src/lib/agents/__tests__/editor-agent.test.ts`:

```ts
import { processStoryForBiography } from '../editor-agent'

describe('processStoryForBiography', () => {
  it('creates a standalone story and required story element types', () => {
    const result = processStoryForBiography({
      storyId: 'story-1',
      projectId: 'project-1',
      title: 'Leaving Home',
      transcript: 'In 1976, I left Guangzhou with my brother. I felt afraid, but I decided to keep going. That choice changed my life.',
      createdAt: '2026-06-11T00:00:00.000Z',
    })

    expect(result.standaloneStory.title).toBe('Leaving Home')
    expect(result.standaloneStory.body).toContain('In 1976')
    expect(result.elements.map(element => element.elementType)).toEqual(
      expect.arrayContaining(['time', 'place', 'person', 'emotion', 'decision', 'consequence']),
    )
  })

  it('keeps source quotes for every extracted element', () => {
    const result = processStoryForBiography({
      storyId: 'story-1',
      projectId: 'project-1',
      title: 'Factory',
      transcript: 'My first job was in a factory. I learned discipline there.',
      createdAt: '2026-06-11T00:00:00.000Z',
    })

    expect(result.elements.length).toBeGreaterThan(0)
    expect(result.elements.every(element => element.sourceQuote.length > 0)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/lib/agents/__tests__/editor-agent.test.ts
```

Expected: fail because `editor-agent` does not exist.

- [ ] **Step 3: Add Editor Agent pure logic**

Create `packages/web/src/lib/agents/editor-agent.ts`:

```ts
import type { StoryElementType } from '@saga/shared'

export interface EditorAgentInput {
  storyId: string
  projectId: string
  title?: string | null
  transcript: string
  createdAt: string
}

export interface EditorStoryElement {
  elementType: StoryElementType
  value: string
  normalizedValue?: string
  sourceQuote: string
  sourceStartOffset: number
  sourceEndOffset: number
  confidence: number
}

export interface EditorAgentOutput {
  standaloneStory: {
    title: string
    body: string
    summary: string
  }
  elements: EditorStoryElement[]
}

export function processStoryForBiography(input: EditorAgentInput): EditorAgentOutput {
  const cleanTranscript = input.transcript.trim()
  const title = input.title?.trim() || deriveTitle(cleanTranscript)
  const summary = cleanTranscript.length > 180 ? `${cleanTranscript.slice(0, 177)}...` : cleanTranscript

  return {
    standaloneStory: {
      title,
      body: cleanTranscript,
      summary,
    },
    elements: extractElements(cleanTranscript),
  }
}

function deriveTitle(transcript: string) {
  const firstSentence = transcript.split(/[.!?。！？]/)[0]?.trim()
  return firstSentence ? firstSentence.slice(0, 80) : 'Untitled Story'
}

function extractElements(transcript: string): EditorStoryElement[] {
  const elements: EditorStoryElement[] = []
  addRegexElements(elements, transcript, 'time', /\b(19\d{2}|20\d{2})\b/g, 0.9)
  addRegexElements(elements, transcript, 'place', /\b(Guangzhou|Shanghai|Beijing|Taipei|Hong Kong|New York|London)\b/g, 0.75)
  addRegexElements(elements, transcript, 'person', /\b(my brother|my sister|my mother|my father|我的哥哥|我的姐姐|我的妈妈|我的爸爸)\b/gi, 0.75)
  addRegexElements(elements, transcript, 'emotion', /\b(afraid|sad|happy|proud|guilty|scared|难过|开心|骄傲|内疚|害怕)\b/gi, 0.75)
  addRegexElements(elements, transcript, 'decision', /\b(I decided to [^.。]+|I chose to [^.。]+|我决定[^。]+)\b/gi, 0.78)
  addRegexElements(elements, transcript, 'consequence', /\b(changed my life|taught me [^.。]+|让我[^。]+|改变了我的人生)\b/gi, 0.78)
  addRegexElements(elements, transcript, 'reflection', /\b(I learned [^.。]+|I realized [^.。]+|我明白了[^。]+)\b/gi, 0.8)

  if (transcript.length > 0) {
    elements.push({
      elementType: 'event',
      value: deriveTitle(transcript),
      sourceQuote: transcript.slice(0, Math.min(160, transcript.length)),
      sourceStartOffset: 0,
      sourceEndOffset: Math.min(160, transcript.length),
      confidence: 0.7,
    })
  }

  if (/family|mother|father|brother|sister|家|妈妈|爸爸|哥哥|姐姐/i.test(transcript)) {
    const quote = findSentence(transcript, /family|mother|father|brother|sister|家|妈妈|爸爸|哥哥|姐姐/i)
    elements.push({
      elementType: 'theme',
      value: 'Family',
      sourceQuote: quote.text,
      sourceStartOffset: quote.start,
      sourceEndOffset: quote.end,
      confidence: 0.72,
    })
  }

  return elements
}

function addRegexElements(
  elements: EditorStoryElement[],
  transcript: string,
  elementType: StoryElementType,
  pattern: RegExp,
  confidence: number,
) {
  for (const match of transcript.matchAll(pattern)) {
    const value = match[0]
    const start = match.index || 0
    elements.push({
      elementType,
      value,
      normalizedValue: value,
      sourceQuote: value,
      sourceStartOffset: start,
      sourceEndOffset: start + value.length,
      confidence,
    })
  }
}

function findSentence(transcript: string, pattern: RegExp) {
  const sentences = transcript.match(/[^.!?。！？]+[.!?。！？]?/g) || [transcript]
  let offset = 0
  for (const sentence of sentences) {
    if (pattern.test(sentence)) {
      return { text: sentence.trim(), start: offset, end: offset + sentence.length }
    }
    offset += sentence.length
  }
  return { text: transcript.slice(0, Math.min(160, transcript.length)), start: 0, end: Math.min(160, transcript.length) }
}
```

- [ ] **Step 4: Run test**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/lib/agents/__tests__/editor-agent.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/agents/editor-agent.ts packages/web/src/lib/agents/__tests__/editor-agent.test.ts
git commit -m "feat: add editor librarian agent logic"
```

---

### Task 8: Editor Agent API, Story Trigger, And Review Panel

**Files:**
- Create: `packages/web/src/app/api/agents/editor/process-story/route.ts`
- Create: `packages/web/src/app/api/agents/editor/process-story/__tests__/route.test.ts`
- Create: `packages/web/src/app/api/stories/[storyId]/agent-artifacts/route.ts`
- Create: `packages/web/src/app/api/stories/[storyId]/agent-artifacts/__tests__/route.test.ts`
- Create: `packages/web/src/components/stories/AgentArtifactsPanel.tsx`
- Create: `packages/web/src/components/stories/__tests__/agent-artifacts-panel.test.tsx`
- Modify: `packages/web/src/lib/agent-service.ts`
- Modify: `packages/web/src/app/[locale]/dashboard/projects/[id]/record/page.tsx`
- Modify: `packages/web/src/app/[locale]/dashboard/projects/[id]/stories/[storyId]/page.tsx`

- [ ] **Step 1: Write Editor API test**

Create `packages/web/src/app/api/agents/editor/process-story/__tests__/route.test.ts`:

```ts
/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST } from '../route'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import {
  createAgentRun,
  completeAgentRun,
  createAgentArtifact,
  createStoryElements,
} from '@/lib/server/agent-store'

const storySingle = jest.fn()
const storyEq = jest.fn(() => ({ single: storySingle }))
const storySelect = jest.fn(() => ({ eq: storyEq }))
const from = jest.fn(() => ({ select: storySelect }))

jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({ from }),
}))

jest.mock('@/lib/server/auth', () => ({
  getAuthenticatedUser: jest.fn(),
}))

jest.mock('@/lib/server/project-access', () => ({
  requireProjectAccess: jest.fn(),
}))

jest.mock('@/lib/server/agent-store', () => ({
  createAgentRun: jest.fn(),
  completeAgentRun: jest.fn(),
  failAgentRun: jest.fn(),
  createAgentArtifact: jest.fn(),
  createStoryElements: jest.fn(),
}))

describe('/api/agents/editor/process-story', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthenticatedUser as jest.Mock).mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      headers: new Headers(),
    })
    ;(requireProjectAccess as jest.Mock).mockResolvedValue({ ok: true })
    ;(createAgentRun as jest.Mock).mockResolvedValue({ id: 'run-1' })
    ;(completeAgentRun as jest.Mock).mockResolvedValue({ id: 'run-1' })
    ;(createAgentArtifact as jest.Mock).mockResolvedValue({ id: 'artifact-1' })
    ;(createStoryElements as jest.Mock).mockResolvedValue([{ id: 'element-1' }])
    storySingle.mockResolvedValue({
      data: {
        id: 'story-1',
        project_id: 'project-1',
        title: 'Leaving Home',
        transcript: 'In 1976, I left Guangzhou with my brother. I felt afraid.',
        created_at: '2026-06-11T00:00:00.000Z',
      },
      error: null,
    })
  })

  it('processes a saved story through the Editor and Librarian Agent', async () => {
    const request = new NextRequest('http://localhost/api/agents/editor/process-story', {
      method: 'POST',
      body: JSON.stringify({ storyId: 'story-1' }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.processed).toBe(true)
    expect(createAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      agentType: 'editor_librarian',
      projectId: 'project-1',
      storyId: 'story-1',
    }))
    expect(createAgentArtifact).toHaveBeenCalledWith(expect.objectContaining({
      artifactType: 'standalone_story',
      storyId: 'story-1',
    }))
    expect(createStoryElements).toHaveBeenCalled()
    expect(completeAgentRun).toHaveBeenCalledWith('run-1', expect.any(Object))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/app/api/agents/editor/process-story/__tests__/route.test.ts
```

Expected: fail because route does not exist.

- [ ] **Step 3: Implement Editor API route**

Create `packages/web/src/app/api/agents/editor/process-story/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { processStoryForBiography } from '@/lib/agents/editor-agent'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import {
  createAgentRun,
  completeAgentRun,
  failAgentRun,
  createAgentArtifact,
  createStoryElements,
} from '@/lib/server/agent-store'

interface StoryRow {
  id: string
  project_id: string
  title: string | null
  transcript: string | null
  created_at: string
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  let agentRunId: string | null = null

  try {
    const body = await request.json()
    const storyId = typeof body.storyId === 'string' ? body.storyId : ''

    if (!storyId) {
      return NextResponse.json({ error: 'storyId is required' }, { status: 400, headers: auth.headers })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('stories')
      .select('id, project_id, title, transcript, created_at')
      .eq('id', storyId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404, headers: auth.headers })
    }

    const story = data as StoryRow
    const access = await requireProjectAccess(story.project_id, auth.user)
    if (!access.ok) return access.response

    const output = processStoryForBiography({
      storyId: story.id,
      projectId: story.project_id,
      title: story.title,
      transcript: story.transcript || '',
      createdAt: story.created_at,
    })

    const run = await createAgentRun({
      agentType: 'editor_librarian',
      projectId: story.project_id,
      storyId: story.id,
      interviewSessionId: null,
      createdBy: auth.user.id,
      input: { storyId: story.id },
      model: 'deterministic-editor-librarian-v1',
    })
    agentRunId = run.id

    await createAgentArtifact({
      agentRunId: run.id,
      projectId: story.project_id,
      storyId: story.id,
      artifactType: 'standalone_story',
      payload: output.standaloneStory,
      sourceRefs: [{ source_type: 'story', source_id: story.id }],
      confidence: 0.82,
    })

    await createAgentArtifact({
      agentRunId: run.id,
      projectId: story.project_id,
      storyId: story.id,
      artifactType: 'story_elements',
      payload: { elements: output.elements },
      sourceRefs: [{ source_type: 'story', source_id: story.id }],
      confidence: 0.78,
    })

    await createStoryElements(
      output.elements.map(element => ({
        projectId: story.project_id,
        storyId: story.id,
        agentRunId: run.id,
        elementType: element.elementType,
        value: element.value,
        normalizedValue: element.normalizedValue || null,
        sourceQuote: element.sourceQuote,
        sourceStartOffset: element.sourceStartOffset,
        sourceEndOffset: element.sourceEndOffset,
        confidence: element.confidence,
      })),
    )

    await completeAgentRun(run.id, {
      standaloneStory: output.standaloneStory,
      elementsCount: output.elements.length,
    })

    return NextResponse.json({
      processed: true,
      agentRunId: run.id,
      elementsCount: output.elements.length,
    }, { headers: auth.headers })
  } catch (error) {
    if (agentRunId) await failAgentRun(agentRunId, error instanceof Error ? error.message : 'Unknown editor agent error')
    console.error('Failed to process story with Editor Agent', error)
    return NextResponse.json({ error: 'Failed to process story with Editor Agent' }, { status: 500, headers: auth.headers })
  }
}
```

- [ ] **Step 4: Extend client agent service**

Append to `packages/web/src/lib/agent-service.ts` inside `agentService`:

```ts
  async processStoryWithEditorAgent(input: { storyId: string }) {
    const response = await fetch('/api/agents/editor/process-story', {
      method: 'POST',
      headers: {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })
    if (!response.ok) throw new Error('Failed to process story with editor agent')
    return response.json()
  },
```

- [ ] **Step 5: Trigger Editor Agent after story save**

Modify `packages/web/src/app/[locale]/dashboard/projects/[id]/record/page.tsx` after successful story creation:

```ts
try {
  await agentService.processStoryWithEditorAgent({ storyId: story.id })
} catch (agentError) {
  console.warn('Editor Agent processing failed after story save:', agentError)
}
```

This must not block the story save success toast. If the editor process fails, the story remains saved and the error is visible in console logs.

- [ ] **Step 6: Write artifact panel test**

Create `packages/web/src/components/stories/__tests__/agent-artifacts-panel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { AgentArtifactsPanel } from '../AgentArtifactsPanel'

describe('AgentArtifactsPanel', () => {
  it('renders standalone story and extracted elements', () => {
    render(
      <AgentArtifactsPanel
        standaloneStory={{ title: 'Leaving Home', summary: 'A story about leaving home.', body: 'Full story.' }}
        elements={[
          { id: 'element-1', element_type: 'time', value: '1976', source_quote: 'In 1976', confidence: 0.9 },
          { id: 'element-2', element_type: 'person', value: 'my brother', source_quote: 'with my brother', confidence: 0.75 },
        ]}
      />,
    )

    expect(screen.getByText('Editor Agent')).toBeInTheDocument()
    expect(screen.getByText('Leaving Home')).toBeInTheDocument()
    expect(screen.getByText('1976')).toBeInTheDocument()
    expect(screen.getByText('my brother')).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: Implement artifact panel**

Create `packages/web/src/components/stories/AgentArtifactsPanel.tsx`:

```tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface StandaloneStory {
  title: string
  summary: string
  body: string
}

interface ElementRow {
  id: string
  element_type: string
  value: string
  source_quote: string
  confidence: number
}

export function AgentArtifactsPanel({
  standaloneStory,
  elements,
}: {
  standaloneStory: StandaloneStory | null
  elements: ElementRow[]
}) {
  if (!standaloneStory && elements.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editor Agent</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {standaloneStory && (
          <section>
            <h3 className="font-semibold">{standaloneStory.title}</h3>
            <p className="text-sm text-muted-foreground">{standaloneStory.summary}</p>
          </section>
        )}
        {elements.length > 0 && (
          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Extracted biography elements</h4>
            <div className="flex flex-wrap gap-2">
              {elements.map(element => (
                <Badge key={element.id} variant="outline" title={element.source_quote}>
                  {element.element_type}: {element.value}
                </Badge>
              ))}
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 8: Write story agent artifacts API test**

Create `packages/web/src/app/api/stories/[storyId]/agent-artifacts/__tests__/route.test.ts`:

```ts
/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET } from '../route'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import { getAgentArtifactsForStory, getStoryElementsForStory } from '@/lib/server/agent-store'

const storySingle = jest.fn()
const storyEq = jest.fn(() => ({ single: storySingle }))
const storySelect = jest.fn(() => ({ eq: storyEq }))
const from = jest.fn(() => ({ select: storySelect }))

jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({ from }),
}))

jest.mock('@/lib/server/auth', () => ({
  getAuthenticatedUser: jest.fn(),
}))

jest.mock('@/lib/server/project-access', () => ({
  requireProjectAccess: jest.fn(),
}))

jest.mock('@/lib/server/agent-store', () => ({
  getAgentArtifactsForStory: jest.fn(),
  getStoryElementsForStory: jest.fn(),
}))

describe('/api/stories/[storyId]/agent-artifacts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthenticatedUser as jest.Mock).mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      headers: new Headers(),
    })
    ;(requireProjectAccess as jest.Mock).mockResolvedValue({ ok: true })
    storySingle.mockResolvedValue({
      data: { id: 'story-1', project_id: 'project-1' },
      error: null,
    })
    ;(getAgentArtifactsForStory as jest.Mock).mockResolvedValue([
      {
        id: 'artifact-1',
        artifact_type: 'standalone_story',
        payload: { title: 'Leaving Home', summary: 'A story.', body: 'Full story.' },
      },
    ])
    ;(getStoryElementsForStory as jest.Mock).mockResolvedValue([
      { id: 'element-1', element_type: 'time', value: '1976', source_quote: 'In 1976', confidence: 0.9 },
    ])
  })

  it('returns private Editor Agent artifacts for an accessible story', async () => {
    const request = new NextRequest('http://localhost/api/stories/story-1/agent-artifacts')
    const response = await GET(request, { params: Promise.resolve({ storyId: 'story-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.standaloneStory).toEqual({ title: 'Leaving Home', summary: 'A story.', body: 'Full story.' })
    expect(body.elements).toHaveLength(1)
    expect(requireProjectAccess).toHaveBeenCalledWith('project-1', { id: 'user-1' })
  })
})
```

- [ ] **Step 9: Implement story agent artifacts API route**

Create `packages/web/src/app/api/stories/[storyId]/agent-artifacts/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import { getAgentArtifactsForStory, getStoryElementsForStory } from '@/lib/server/agent-store'

interface RouteContext {
  params: Promise<{ storyId: string }>
}

interface StoryRow {
  id: string
  project_id: string
}

interface StandaloneStoryPayload {
  title: string
  summary: string
  body: string
}

function isStandaloneStoryPayload(payload: unknown): payload is StandaloneStoryPayload {
  if (!payload || typeof payload !== 'object') return false
  const value = payload as Record<string, unknown>
  return typeof value.title === 'string' && typeof value.summary === 'string' && typeof value.body === 'string'
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  try {
    const { storyId } = await params
    if (!storyId) {
      return NextResponse.json({ error: 'storyId is required' }, { status: 400, headers: auth.headers })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('stories')
      .select('id, project_id')
      .eq('id', storyId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404, headers: auth.headers })
    }

    const story = data as StoryRow
    const access = await requireProjectAccess(story.project_id, auth.user)
    if (!access.ok) return access.response

    const [artifacts, elements] = await Promise.all([
      getAgentArtifactsForStory(story.id),
      getStoryElementsForStory(story.id),
    ])

    const standaloneArtifact = artifacts.find((artifact: any) => artifact.artifact_type === 'standalone_story')
    const standaloneStory = isStandaloneStoryPayload(standaloneArtifact?.payload) ? standaloneArtifact.payload : null

    return NextResponse.json({
      standaloneStory,
      elements,
      artifacts,
    }, { headers: auth.headers })
  } catch (error) {
    console.error('Failed to load story agent artifacts', error)
    return NextResponse.json({ error: 'Failed to load story agent artifacts' }, { status: 500, headers: auth.headers })
  }
}
```

- [ ] **Step 10: Extend client agent service for artifact loading**

Append this method inside `agentService` in `packages/web/src/lib/agent-service.ts`:

```ts
  async getStoryAgentArtifacts(storyId: string) {
    const response = await fetch(`/api/stories/${storyId}/agent-artifacts`, {
      method: 'GET',
      headers: {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) throw new Error('Failed to load story agent artifacts')
    return response.json()
  },
```

- [ ] **Step 11: Render artifact panel on story detail page**

Modify `packages/web/src/app/[locale]/dashboard/projects/[id]/stories/[storyId]/page.tsx`.

Add imports:

```ts
import { AgentArtifactsPanel } from '@/components/stories/AgentArtifactsPanel'
import { agentService } from '@/lib/agent-service'
```

Add state near the other story state:

```ts
const [standaloneStory, setStandaloneStory] = useState<{ title: string; summary: string; body: string } | null>(null)
const [storyElements, setStoryElements] = useState<Array<{
  id: string
  element_type: string
  value: string
  source_quote: string
  confidence: number
}>>([])
```

Add this load after `setSelectedIndex(0)` inside `loadStory`:

```ts
try {
  const agentArtifacts = await agentService.getStoryAgentArtifacts(storyId)
  setStandaloneStory(agentArtifacts.standaloneStory || null)
  setStoryElements(Array.isArray(agentArtifacts.elements) ? agentArtifacts.elements : [])
} catch (agentError) {
  console.warn('Failed to load story agent artifacts:', agentError)
  setStandaloneStory(null)
  setStoryElements([])
}
```

Render the panel after the story transcript `EnhancedCard` and before `StoryInteractions`:

```tsx
<AgentArtifactsPanel
  standaloneStory={standaloneStory}
  elements={storyElements}
/>
```

- [ ] **Step 12: Run Editor tests**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/app/api/agents/editor/process-story/__tests__/route.test.ts packages/web/src/app/api/stories/[storyId]/agent-artifacts/__tests__/route.test.ts packages/web/src/components/stories/__tests__/agent-artifacts-panel.test.tsx
```

Expected: pass.

- [ ] **Step 13: Commit**

```bash
git add packages/web/src/app/api/agents/editor/process-story 'packages/web/src/app/api/stories/[storyId]/agent-artifacts' packages/web/src/components/stories/AgentArtifactsPanel.tsx packages/web/src/components/stories/__tests__/agent-artifacts-panel.test.tsx packages/web/src/lib/agent-service.ts 'packages/web/src/app/[locale]/dashboard/projects/[id]/record/page.tsx' 'packages/web/src/app/[locale]/dashboard/projects/[id]/stories/[storyId]/page.tsx'
git commit -m "feat: process stories with editor agent"
```

---

### Task 9: Full Verification And Scope Guard

**Files:**
- Modify: none unless verification exposes a concrete defect.

- [ ] **Step 1: Check Phase 1 scope did not expand**

Run:

```bash
rg -n "public_contributions|event_clusters|media_jobs|Wiki Editor Agent|Media Agent|photo restoration|video generation" packages/web packages/shared
```

Expected: no matches in implementation files except existing documentation or locale text. If there are implementation matches, remove that work from Phase 1.

- [ ] **Step 2: Run type checks**

Run:

```bash
npm run type-check --workspace=packages/shared
npm run type-check --workspace=packages/web
```

Expected: both pass.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint --workspace=packages/shared
npm run lint --workspace=packages/web
```

Expected: both pass.

- [ ] **Step 4: Run tests**

Run:

```bash
npm test --workspace=packages/shared -- --runInBand
npm test --workspace=packages/web -- --runInBand
```

Expected: all tests pass.

- [ ] **Step 5: Run production build**

Run:

```bash
npm run build:vercel
```

Expected: shared package builds, web app builds, and Next.js completes without type or lint gates being bypassed.

- [ ] **Step 6: Commit verification fixes if any**

If any verification command exposed a concrete defect and the defect was fixed:

```bash
git add <fixed-files>
git commit -m "fix: complete phase one agent verification"
```

If no defects were found, do not create an empty commit.

## Self-Review Checklist

Spec coverage:

1. Interview Agent opening is implemented by Task 4 and Task 6.
2. Interview Agent warmup is implemented by Task 4 and Task 6.
3. Prior-story recap is implemented by Task 4 and API inputs in Task 5.
4. Gentle probing is implemented by Task 4 and SmartRecorder integration in Task 6.
5. Transition hosting is implemented by Task 4 and available through Task 5.
6. Emotional support is implemented by Task 4.
7. Closing is implemented by Task 4 and Task 6.
8. Off, Low, and High intervention levels are implemented by Task 1, Task 4, Task 5, and Task 6.
9. Durable interview events are implemented by Task 2, Task 3, and Task 5.
10. Standalone story artifacts are implemented by Task 7 and Task 8.
11. Structured story elements are implemented by Task 7 and Task 8.
12. Private biography review surface is implemented by Task 8.
13. Wiki Editor Agent is excluded by Scope Check and Task 9.
14. Media Agent is excluded by Scope Check and Task 9.

Placeholder scan:

1. No step contains unresolved placeholder markers.
2. No step contains unfinished task markers.
3. No step asks the implementer to add unspecified validation.
4. Every code-producing task names exact files and commands.

Type consistency:

1. Agent type values are `interview` and `editor_librarian`.
2. Intervention levels are `off`, `low`, and `high`.
3. Interview event kinds are `opening`, `warmup`, `prior_story_recap`, `gentle_probe`, `transition`, `emotional_support`, and `closing`.
4. Story element types are `time`, `place`, `person`, `event`, `theme`, `emotion`, `decision`, `consequence`, and `reflection`.

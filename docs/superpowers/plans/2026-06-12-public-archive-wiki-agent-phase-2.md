# Public Archive Wiki Agent Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the controlled Phase 2 public archive flow: storyteller opt-in, anonymized contribution snapshots, facilitator invitations, Wiki Editor candidate/draft events, platform reviewer approval, contributor-visible approved summaries, and withdrawal.

**Architecture:** Keep public archive state separate from `stories.is_public` and family sharing. Use new public archive tables and server-only store/access helpers; expose narrow API routes for preview, commit, invitation, withdrawal, Wiki processing, review, and contributor summaries. Reuse the Phase 1 agent infrastructure by adding `wiki_editor` and Phase 2 artifact types while ensuring the Wiki Editor reads only committed anonymized public contribution rows.

**Tech Stack:** Next.js route handlers, React 19, TypeScript, Jest, Supabase Postgres/RLS, existing `@saga/shared` package, existing `agent_runs` and `agent_artifacts` infrastructure.

---

## Source Spec

Implement against:

- `docs/superpowers/specs/2026-06-12-public-archive-wiki-agent-design.md`

Do not implement Media Agent, photo restoration, generated video, full public event pages, anonymous public archive browsing, or global public feed.

---

## File Structure

### Shared Package

- Modify `packages/shared/src/types/agents.ts`
  - Add `wiki_editor` to `AGENT_TYPES`.
  - Add Phase 2 artifact types to `AgentArtifact.artifact_type`.
  - Keep Phase 1 types backward-compatible.
- Create `packages/shared/src/types/public-archive.ts`
  - Public archive contribution, invitation, event, reviewer, consent, preview, and summary types.
- Modify `packages/shared/src/types/index.ts`
  - Export public archive types.
- Modify `packages/shared/src/index.ts`
  - Export public archive types through package root.
- Modify `packages/shared/src/types/__tests__/agents.test.ts`
  - Update agent type expectations.
- Create `packages/shared/src/types/__tests__/public-archive.test.ts`
  - Compile/runtime checks for new public archive types.

### Database And Web Types

- Create `packages/web/supabase/agent-phase2-public-archive.sql`
  - New tables, constraints, indexes, RLS, direct privilege revokes, and Phase 2 check-constraint migrations.
- Create `packages/web/supabase/__tests__/agent-phase2-public-archive-sql.test.ts`
  - Static SQL guard tests for RLS, revokes, table names, and constraints.
- Modify `packages/web/src/types/supabase.ts`
  - Add hand-written table types for Phase 2 tables.

### Server Logic

- Create `packages/web/src/lib/public-archive/anonymizer.ts`
  - Deterministic anonymization and preview building.
- Create `packages/web/src/lib/public-archive/wiki-editor-agent.ts`
  - Deterministic candidate/draft event clustering logic.
- Create `packages/web/src/lib/server/public-archive-access.ts`
  - Story owner, facilitator invitation, contribution owner, and reviewer checks.
- Create `packages/web/src/lib/server/public-archive-store.ts`
  - Supabase persistence functions for contributions, elements, invitations, events, audit events, reviewer queues, and summaries.
- Modify `packages/web/src/lib/server/agent-store.ts`
  - Add helper to fetch an agent artifact by id for preview commit.
  - Allow Phase 2 artifact type values in TypeScript.
- Modify `packages/web/src/lib/server/__tests__/agent-store.test.ts`
  - Test Phase 2 artifact helper and artifact type support.
- Create tests under:
  - `packages/web/src/lib/public-archive/__tests__/anonymizer.test.ts`
  - `packages/web/src/lib/public-archive/__tests__/wiki-editor-agent.test.ts`
  - `packages/web/src/lib/server/__tests__/public-archive-access.test.ts`
  - `packages/web/src/lib/server/__tests__/public-archive-store.test.ts`

### API Routes

- Create `packages/web/src/app/api/stories/[storyId]/public-archive/preview/route.ts`
- Create `packages/web/src/app/api/stories/[storyId]/public-archive/preview/__tests__/route.test.ts`
- Create `packages/web/src/app/api/stories/[storyId]/public-archive/route.ts`
  - `GET` story contribution status.
  - `POST` commit contribution from preview.
- Create `packages/web/src/app/api/stories/[storyId]/public-archive/__tests__/route.test.ts`
- Create `packages/web/src/app/api/stories/[storyId]/public-archive/invitations/route.ts`
- Create `packages/web/src/app/api/stories/[storyId]/public-archive/invitations/__tests__/route.test.ts`
- Create `packages/web/src/app/api/public-archive/contributions/[contributionId]/withdraw/route.ts`
- Create `packages/web/src/app/api/public-archive/contributions/[contributionId]/withdraw/__tests__/route.test.ts`
- Create `packages/web/src/app/api/agents/wiki/process-contribution/route.ts`
- Create `packages/web/src/app/api/agents/wiki/process-contribution/__tests__/route.test.ts`
- Create `packages/web/src/app/api/public-archive/reviewer/event-drafts/route.ts`
- Create `packages/web/src/app/api/public-archive/reviewer/event-drafts/__tests__/route.test.ts`
- Create `packages/web/src/app/api/public-archive/reviewer/event-drafts/[eventId]/review/route.ts`
- Create `packages/web/src/app/api/public-archive/reviewer/event-drafts/[eventId]/review/__tests__/route.test.ts`
- Create `packages/web/src/app/api/public-archive/events/approved/route.ts`
- Create `packages/web/src/app/api/public-archive/events/approved/__tests__/route.test.ts`

### Client And UI

- Create `packages/web/src/lib/public-archive-service.ts`
  - Client fetch wrapper for preview, commit, status, invite, withdraw, approved events.
- Create `packages/web/src/components/stories/PublicArchivePanel.tsx`
  - Story detail contribution UI.
- Create `packages/web/src/components/stories/__tests__/public-archive-panel.test.tsx`
- Modify `packages/web/src/app/[locale]/dashboard/projects/[id]/stories/[storyId]/page.tsx`
  - Load public archive status and render `PublicArchivePanel` below `AgentArtifactsPanel`.

---

## Task 1: Shared Agent And Public Archive Types

**Files:**
- Modify: `packages/shared/src/types/agents.ts`
- Create: `packages/shared/src/types/public-archive.ts`
- Modify: `packages/shared/src/types/index.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/types/__tests__/agents.test.ts`
- Create: `packages/shared/src/types/__tests__/public-archive.test.ts`

- [ ] **Step 1: Write failing shared type tests**

Update `packages/shared/src/types/__tests__/agents.test.ts`:

```ts
it('defines Phase 2 agent types', () => {
  const values: AgentType[] = [...AGENT_TYPES]
  expect(values).toEqual(['interview', 'editor_librarian', 'wiki_editor'])
})
```

Create `packages/shared/src/types/__tests__/public-archive.test.ts`:

```ts
import {
  PUBLIC_ARCHIVE_CONSENT_SCOPE,
  PUBLIC_CONTRIBUTION_STATUSES,
  PUBLIC_WIKI_STATUSES,
  PUBLIC_EVENT_STATUSES,
  PLATFORM_ROLES,
  type PublicArchiveContribution,
  type PublicArchiveContributionPreview,
  type PublicArchiveApprovedEventSummary,
  type PlatformRole,
} from '../public-archive'
import * as PackageRoot from '../../index'
import * as TypesBarrel from '../index'

describe('public archive shared types', () => {
  it('defines Phase 2 consent scope and statuses', () => {
    expect(PUBLIC_ARCHIVE_CONSENT_SCOPE).toEqual(['text', 'structured_elements'])
    expect(PUBLIC_CONTRIBUTION_STATUSES).toEqual(['active', 'withdrawn'])
    expect(PUBLIC_WIKI_STATUSES).toEqual(['pending', 'processed', 'failed'])
    expect(PUBLIC_EVENT_STATUSES).toEqual(['candidate', 'draft', 'approved', 'rejected', 'needs_reprocessing'])
    expect(PLATFORM_ROLES).toEqual(['public_archive_reviewer'])
  })

  it('accepts public archive contribution and preview shapes', () => {
    const contribution: PublicArchiveContribution = {
      id: 'contribution-1',
      public_ref: 'pc_001',
      source_story_id: 'story-1',
      source_project_id: 'project-1',
      source_user_id: 'user-1',
      source_story_hash: 'story-hash',
      source_content_hash: 'content-hash',
      consent_scope: ['text', 'structured_elements'],
      consent_copy_version: 'public-archive-consent-v1',
      anonymized_title: 'A market memory',
      anonymized_text: 'In 1976, a child visited a market in Guangzhou.',
      anonymized_summary: 'A childhood memory about courage.',
      status: 'active',
      wiki_status: 'pending',
      submitted_at: '2026-06-12T00:00:00.000Z',
      withdrawn_at: null,
    }

    const preview: PublicArchiveContributionPreview = {
      previewId: 'artifact-1',
      storyId: 'story-1',
      sourceContentHash: 'content-hash',
      consentScope: ['text', 'structured_elements'],
      consentCopyVersion: 'public-archive-consent-v1',
      anonymizedTitle: 'A market memory',
      anonymizedText: 'In 1976, a child visited a market in Guangzhou.',
      anonymizedSummary: 'A childhood memory about courage.',
      elements: [
        {
          elementType: 'time',
          value: '1976',
          normalizedValue: '1976',
          sourceQuote: '1976',
          confidence: 0.9,
        },
      ],
      excludedDataTypes: ['voice', 'audio', 'photos', 'media_derivatives', 'exact_identity'],
    }

    expect(contribution.public_ref).toBe('pc_001')
    expect(preview.elements).toHaveLength(1)
  })

  it('accepts approved event summaries and exports through barrels', () => {
    const role: PlatformRole = 'public_archive_reviewer'
    const summary: PublicArchiveApprovedEventSummary = {
      id: 'event-1',
      eventLabel: '1976 Guangzhou market memories',
      activeContributionCount: 2,
      timeframe: '1976',
      placeScope: 'Guangzhou',
      historicalContextSummary: 'Two contributors remembered market visits in Guangzhou.',
      perspectiveSummary: 'One remembered courage; another remembered family support.',
      representativeExcerpts: ['A child remembered visiting a market.'],
      uncertaintyNotes: 'The exact market is intentionally omitted.',
    }

    expect(role).toBe('public_archive_reviewer')
    expect(summary.activeContributionCount).toBe(2)
    expect(TypesBarrel.PUBLIC_ARCHIVE_CONSENT_SCOPE).toBe(PUBLIC_ARCHIVE_CONSENT_SCOPE)
    expect(PackageRoot.PUBLIC_ARCHIVE_CONSENT_SCOPE).toBe(PUBLIC_ARCHIVE_CONSENT_SCOPE)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test --workspace=packages/shared -- --runInBand packages/shared/src/types/__tests__/agents.test.ts packages/shared/src/types/__tests__/public-archive.test.ts
```

Expected: FAIL because `public-archive.ts` does not exist and `wiki_editor` is not in `AGENT_TYPES`.

- [ ] **Step 3: Add shared public archive types**

Modify `packages/shared/src/types/agents.ts`:

```ts
export const AGENT_TYPES = ['interview', 'editor_librarian', 'wiki_editor'] as const
export type AgentType = (typeof AGENT_TYPES)[number]
```

Replace `AgentArtifact.artifact_type` union with:

```ts
  artifact_type:
    | 'host_intervention'
    | 'standalone_story'
    | 'story_summary'
    | 'follow_up_questions'
    | 'story_elements'
    | 'anonymized_contribution_preview'
    | 'wiki_event_candidate'
    | 'wiki_event_draft'
```

Create `packages/shared/src/types/public-archive.ts`:

```ts
import type { StoryElementType } from './agents'

export const PUBLIC_ARCHIVE_CONSENT_SCOPE = ['text', 'structured_elements'] as const
export type PublicArchiveConsentScope = (typeof PUBLIC_ARCHIVE_CONSENT_SCOPE)[number]

export const PUBLIC_CONTRIBUTION_STATUSES = ['active', 'withdrawn'] as const
export type PublicContributionStatus = (typeof PUBLIC_CONTRIBUTION_STATUSES)[number]

export const PUBLIC_WIKI_STATUSES = ['pending', 'processed', 'failed'] as const
export type PublicWikiStatus = (typeof PUBLIC_WIKI_STATUSES)[number]

export const PUBLIC_EVENT_STATUSES = ['candidate', 'draft', 'approved', 'rejected', 'needs_reprocessing'] as const
export type PublicEventStatus = (typeof PUBLIC_EVENT_STATUSES)[number]

export const PUBLIC_CONTRIBUTION_INVITATION_STATUSES = ['pending', 'accepted', 'dismissed', 'expired'] as const
export type PublicContributionInvitationStatus = (typeof PUBLIC_CONTRIBUTION_INVITATION_STATUSES)[number]

export const PLATFORM_ROLES = ['public_archive_reviewer'] as const
export type PlatformRole = (typeof PLATFORM_ROLES)[number]

export const PUBLIC_ARCHIVE_CONSENT_COPY_VERSION = 'public-archive-consent-v1'

export interface PublicArchiveElementPreview {
  elementType: StoryElementType
  value: string
  normalizedValue: string | null
  sourceQuote: string | null
  confidence: number
}

export interface PublicArchiveContributionPreview {
  previewId: string
  storyId: string
  sourceContentHash: string
  consentScope: PublicArchiveConsentScope[]
  consentCopyVersion: typeof PUBLIC_ARCHIVE_CONSENT_COPY_VERSION
  anonymizedTitle: string
  anonymizedText: string
  anonymizedSummary: string
  elements: PublicArchiveElementPreview[]
  excludedDataTypes: Array<'voice' | 'audio' | 'photos' | 'media_derivatives' | 'exact_identity'>
}

export interface PublicArchiveContribution {
  id: string
  public_ref: string
  source_project_id: string
  source_story_id: string
  source_user_id: string
  source_story_hash: string
  source_content_hash: string
  consent_scope: PublicArchiveConsentScope[]
  consent_copy_version: string
  anonymized_title: string
  anonymized_text: string
  anonymized_summary: string
  status: PublicContributionStatus
  wiki_status: PublicWikiStatus
  submitted_at: string
  withdrawn_at: string | null
}

export interface PublicArchiveContributionElement {
  id: string
  public_contribution_id: string
  element_type: StoryElementType
  value: string
  normalized_value: string | null
  source_quote: string | null
  confidence: number
  review_status: 'unreviewed' | 'approved' | 'rejected' | 'edited'
  created_at: string
  updated_at: string
}

export interface PublicContributionInvitation {
  id: string
  story_id: string
  project_id: string
  invited_storyteller_id: string
  invited_by: string
  status: PublicContributionInvitationStatus
  message: string | null
  created_at: string
  responded_at: string | null
}

export interface PublicArchiveApprovedEventSummary {
  id: string
  eventLabel: string
  activeContributionCount: number
  timeframe: string
  placeScope: string
  historicalContextSummary: string
  perspectiveSummary: string
  representativeExcerpts: string[]
  uncertaintyNotes: string
}
```

Modify `packages/shared/src/index.ts`:

```ts
export * from './types/public-archive'
```

Modify `packages/shared/src/types/index.ts`:

```ts
export * from './public-archive'
```

- [ ] **Step 4: Run shared tests**

Run:

```bash
npm test --workspace=packages/shared -- --runInBand packages/shared/src/types/__tests__/agents.test.ts packages/shared/src/types/__tests__/public-archive.test.ts
```

Expected: PASS.

- [ ] **Step 5: Build shared package**

Run:

```bash
npm run build --workspace=packages/shared
```

Expected: PASS and `packages/shared/dist` includes `public-archive` outputs.

- [ ] **Step 6: Commit shared type changes**

```bash
git add packages/shared/src/types/agents.ts packages/shared/src/types/public-archive.ts packages/shared/src/types/index.ts packages/shared/src/index.ts packages/shared/src/types/__tests__/agents.test.ts packages/shared/src/types/__tests__/public-archive.test.ts packages/shared/dist
git commit -m "feat: add public archive shared types"
```

### Task 2: Phase 2 Database Schema And Supabase Types

**Files:**
- Create: `packages/web/supabase/agent-phase2-public-archive.sql`
- Create: `packages/web/supabase/__tests__/agent-phase2-public-archive-sql.test.ts`
- Modify: `packages/web/src/types/supabase.ts`

- [ ] **Step 1: Write failing SQL guard tests**

Create `packages/web/supabase/__tests__/agent-phase2-public-archive-sql.test.ts`:

```ts
/**
 * @jest-environment node
 */

import { readFileSync } from 'fs'
import { join } from 'path'

describe('agent-phase2-public-archive.sql', () => {
  const sqlPath = join(process.cwd(), 'supabase/agent-phase2-public-archive.sql')
  const sql = readFileSync(sqlPath, 'utf8')

  it('creates all Phase 2 public archive tables', () => {
    expect(sql).toContain('create table if not exists public.platform_roles')
    expect(sql).toContain('create table if not exists public.public_contribution_invitations')
    expect(sql).toContain('create table if not exists public.public_contributions')
    expect(sql).toContain('create table if not exists public.public_contribution_elements')
    expect(sql).toContain('create table if not exists public.public_event_clusters')
    expect(sql).toContain('create table if not exists public.public_event_contributions')
    expect(sql).toContain('create table if not exists public.public_archive_audit_events')
  })

  it('enables RLS and revokes direct broad access', () => {
    expect(sql).toContain('alter table public.public_contributions enable row level security')
    expect(sql).toContain('alter table public.public_event_clusters enable row level security')
    expect(sql).toContain('from anon, authenticated')
  })

  it('extends Phase 1 agent constraints for Wiki Editor artifacts', () => {
    expect(sql).toContain("'wiki_editor'")
    expect(sql).toContain("'anonymized_contribution_preview'")
    expect(sql).toContain("'wiki_event_candidate'")
    expect(sql).toContain("'wiki_event_draft'")
  })
})
```

- [ ] **Step 2: Run SQL guard test to verify it fails**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/supabase/__tests__/agent-phase2-public-archive-sql.test.ts
```

Expected: FAIL because `agent-phase2-public-archive.sql` does not exist.

- [ ] **Step 3: Create Phase 2 SQL migration**

Create `packages/web/supabase/agent-phase2-public-archive.sql` with this structure:

```sql
-- Phase 2 public archive and Wiki Editor Agent tables.
-- Run after agent-phase1.sql.

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
  source_project_id uuid not null references public.projects(id) on delete cascade,
  source_story_id uuid not null references public.stories(id) on delete cascade,
  source_user_id uuid not null references auth.users(id) on delete cascade,
  source_story_hash text not null,
  source_content_hash text not null,
  consent_scope jsonb not null default '["text","structured_elements"]'::jsonb,
  consent_copy_version text not null,
  anonymized_title text not null,
  anonymized_text text not null,
  anonymized_summary text not null,
  status text not null default 'active' check (status in ('active', 'withdrawn')),
  wiki_status text not null default 'pending' check (wiki_status in ('pending', 'processed', 'failed')),
  submitted_at timestamptz not null default now(),
  withdrawn_at timestamptz null
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

create index if not exists idx_platform_roles_active_reviewer
  on public.platform_roles(user_id)
  where role = 'public_archive_reviewer' and revoked_at is null;
create index if not exists idx_public_contributions_story_user on public.public_contributions(source_story_id, source_user_id);
create index if not exists idx_public_contributions_active_wiki on public.public_contributions(status, wiki_status);
create index if not exists idx_public_contribution_elements_contribution on public.public_contribution_elements(public_contribution_id);
create index if not exists idx_public_event_contributions_cluster on public.public_event_contributions(public_event_cluster_id);
create index if not exists idx_public_event_contributions_contribution on public.public_event_contributions(public_contribution_id);
create index if not exists idx_public_archive_audit_contribution on public.public_archive_audit_events(public_contribution_id);
```

- [ ] **Step 4: Update web Supabase types**

Modify `packages/web/src/types/supabase.ts` under `Database.public.Tables` to add entries for:

```ts
      platform_roles: {
        Row: { id: string; user_id: string; role: string; granted_by: string | null; granted_at: string; revoked_at: string | null }
        Insert: { id?: string; user_id: string; role: string; granted_by?: string | null; granted_at?: string; revoked_at?: string | null }
        Update: { id?: string; user_id?: string; role?: string; granted_by?: string | null; granted_at?: string; revoked_at?: string | null }
      }
      public_contribution_invitations: {
        Row: { id: string; story_id: string; project_id: string; invited_storyteller_id: string; invited_by: string; status: string; message: string | null; created_at: string; responded_at: string | null }
        Insert: { id?: string; story_id: string; project_id: string; invited_storyteller_id: string; invited_by: string; status?: string; message?: string | null; created_at?: string; responded_at?: string | null }
        Update: { id?: string; story_id?: string; project_id?: string; invited_storyteller_id?: string; invited_by?: string; status?: string; message?: string | null; created_at?: string; responded_at?: string | null }
      }
      public_contributions: {
        Row: { id: string; public_ref: string; source_project_id: string; source_story_id: string; source_user_id: string; source_story_hash: string; source_content_hash: string; consent_scope: Json; consent_copy_version: string; anonymized_title: string; anonymized_text: string; anonymized_summary: string; status: string; wiki_status: string; submitted_at: string; withdrawn_at: string | null }
        Insert: { id?: string; public_ref?: string; source_project_id: string; source_story_id: string; source_user_id: string; source_story_hash: string; source_content_hash: string; consent_scope?: Json; consent_copy_version: string; anonymized_title: string; anonymized_text: string; anonymized_summary: string; status?: string; wiki_status?: string; submitted_at?: string; withdrawn_at?: string | null }
        Update: { id?: string; public_ref?: string; source_project_id?: string; source_story_id?: string; source_user_id?: string; source_story_hash?: string; source_content_hash?: string; consent_scope?: Json; consent_copy_version?: string; anonymized_title?: string; anonymized_text?: string; anonymized_summary?: string; status?: string; wiki_status?: string; submitted_at?: string; withdrawn_at?: string | null }
      }
      public_contribution_elements: {
        Row: { id: string; public_contribution_id: string; element_type: string; value: string; normalized_value: string | null; source_quote: string | null; confidence: number; review_status: string; created_at: string; updated_at: string }
        Insert: { id?: string; public_contribution_id: string; element_type: string; value: string; normalized_value?: string | null; source_quote?: string | null; confidence?: number; review_status?: string; created_at?: string; updated_at?: string }
        Update: { id?: string; public_contribution_id?: string; element_type?: string; value?: string; normalized_value?: string | null; source_quote?: string | null; confidence?: number; review_status?: string; created_at?: string; updated_at?: string }
      }
      public_event_clusters: {
        Row: { id: string; status: string; event_label: string; timeframe: string; place_scope: string; historical_context_summary: string; perspective_summary: string; representative_excerpts: Json; uncertainty_notes: string; confidence: number; review_status: string; reviewed_by: string | null; reviewed_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; status?: string; event_label: string; timeframe: string; place_scope: string; historical_context_summary: string; perspective_summary: string; representative_excerpts?: Json; uncertainty_notes: string; confidence?: number; review_status?: string; reviewed_by?: string | null; reviewed_at?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; status?: string; event_label?: string; timeframe?: string; place_scope?: string; historical_context_summary?: string; perspective_summary?: string; representative_excerpts?: Json; uncertainty_notes?: string; confidence?: number; review_status?: string; reviewed_by?: string | null; reviewed_at?: string | null; created_at?: string; updated_at?: string }
      }
      public_event_contributions: {
        Row: { id: string; public_event_cluster_id: string; public_contribution_id: string; match_confidence: number; perspective_summary: string; excerpt_allowed: boolean; created_at: string; removed_at: string | null }
        Insert: { id?: string; public_event_cluster_id: string; public_contribution_id: string; match_confidence?: number; perspective_summary: string; excerpt_allowed?: boolean; created_at?: string; removed_at?: string | null }
        Update: { id?: string; public_event_cluster_id?: string; public_contribution_id?: string; match_confidence?: number; perspective_summary?: string; excerpt_allowed?: boolean; created_at?: string; removed_at?: string | null }
      }
      public_archive_audit_events: {
        Row: { id: string; event_type: string; actor_user_id: string | null; public_contribution_id: string | null; public_event_cluster_id: string | null; consent_copy_version: string | null; metadata: Json; created_at: string }
        Insert: { id?: string; event_type: string; actor_user_id?: string | null; public_contribution_id?: string | null; public_event_cluster_id?: string | null; consent_copy_version?: string | null; metadata?: Json; created_at?: string }
        Update: { id?: string; event_type?: string; actor_user_id?: string | null; public_contribution_id?: string | null; public_event_cluster_id?: string | null; consent_copy_version?: string | null; metadata?: Json; created_at?: string }
      }
```

- [ ] **Step 5: Run SQL guard and type check**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/supabase/__tests__/agent-phase2-public-archive-sql.test.ts
npm run type-check --workspace=packages/web
```

Expected: PASS.

- [ ] **Step 6: Commit schema and type changes**

```bash
git add packages/web/supabase/agent-phase2-public-archive.sql packages/web/supabase/__tests__/agent-phase2-public-archive-sql.test.ts packages/web/src/types/supabase.ts
git commit -m "feat: add public archive database schema"
```

### Task 3: Public Archive Anonymizer

**Files:**
- Create: `packages/web/src/lib/public-archive/anonymizer.ts`
- Create: `packages/web/src/lib/public-archive/__tests__/anonymizer.test.ts`

- [ ] **Step 1: Write failing anonymizer tests**

Create `packages/web/src/lib/public-archive/__tests__/anonymizer.test.ts`:

```ts
import { buildContributionPreview, sanitizePublicArchiveText } from '../anonymizer'

describe('public archive anonymizer', () => {
  it('removes direct identifiers while preserving event context', () => {
    const result = sanitizePublicArchiveText(
      'My name is Alice Chen. Email alice@example.com. Phone 555-123-4567. In 1976 my mother took me to Guangzhou after the earthquake.',
      ['Alice Chen'],
    )

    expect(result).not.toContain('Alice Chen')
    expect(result).not.toContain('alice@example.com')
    expect(result).not.toContain('555-123-4567')
    expect(result).toContain('[person]')
    expect(result).toContain('1976')
    expect(result).toContain('Guangzhou')
    expect(result).toContain('earthquake')
  })

  it('builds a preview with text and structured elements only', () => {
    const preview = buildContributionPreview({
      previewId: 'artifact-1',
      story: {
        id: 'story-1',
        title: 'Alice at 123 Pine Street',
        transcript: 'Alice visited 123 Pine Street in Guangzhou in 1976.',
        created_at: '2026-01-02T03:04:05.000Z',
      },
      sourceContentHash: 'hash-1',
      elements: [
        {
          id: 'element-1',
          element_type: 'person',
          value: 'Alice',
          normalized_value: 'Alice',
          source_quote: 'Alice',
          confidence: 0.9,
        },
        {
          id: 'element-2',
          element_type: 'place',
          value: 'Guangzhou',
          normalized_value: 'Guangzhou',
          source_quote: 'Guangzhou',
          confidence: 0.8,
        },
      ],
    })

    expect(preview).toEqual({
      previewId: 'artifact-1',
      storyId: 'story-1',
      sourceContentHash: 'hash-1',
      consentScope: ['text', 'structured_elements'],
      consentCopyVersion: 'public-archive-consent-v1',
      anonymizedTitle: '[person] at [address]',
      anonymizedText: '[person] visited [address] in Guangzhou in 1976.',
      anonymizedSummary: '[person] visited [address] in Guangzhou in 1976.',
      elements: [
        {
          elementType: 'person',
          value: '[person]',
          normalizedValue: '[person]',
          sourceQuote: '[person]',
          confidence: 0.9,
        },
        {
          elementType: 'place',
          value: 'Guangzhou',
          normalizedValue: 'Guangzhou',
          sourceQuote: 'Guangzhou',
          confidence: 0.8,
        },
      ],
      excludedDataTypes: ['voice', 'audio', 'photos', 'media_derivatives', 'exact_identity'],
    })
  })
})
```

- [ ] **Step 2: Run anonymizer tests to verify they fail**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/lib/public-archive/__tests__/anonymizer.test.ts
```

Expected: FAIL because `anonymizer.ts` does not exist.

- [ ] **Step 3: Implement deterministic anonymizer**

Create `packages/web/src/lib/public-archive/anonymizer.ts`:

```ts
import type { StoryElementType } from '@saga/shared/types/agents'
import {
  PUBLIC_ARCHIVE_CONSENT_COPY_VERSION,
  type PublicArchiveContributionPreview,
  type PublicArchiveElementPreview,
} from '@saga/shared/types/public-archive'

interface StoryInput {
  id: string
  title: string | null
  transcript: string | null
  created_at: string
}

interface ElementInput {
  id: string
  element_type: StoryElementType
  value: string
  normalized_value: string | null
  source_quote: string
  confidence: number
}

export function sanitizePublicArchiveText(text: string, privateNames: string[] = []) {
  let output = text
  for (const name of privateNames.filter(Boolean)) {
    output = output.replace(new RegExp(escapeRegExp(name), 'gi'), '[person]')
  }
  output = output.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
  output = output.replace(/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g, '[phone]')
  output = output.replace(/\b\d{1,5}\s+[A-Z][A-Za-z0-9.'-]*(?:\s+[A-Z][A-Za-z0-9.'-]*)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Way|Boulevard|Blvd)\b/g, '[address]')
  return output.replace(/\s+/g, ' ').trim()
}

export function buildContributionPreview(input: {
  previewId: string
  story: StoryInput
  sourceContentHash: string
  elements: ElementInput[]
}): PublicArchiveContributionPreview {
  const privateNames = input.elements
    .filter(element => element.element_type === 'person')
    .map(element => element.value)
  const anonymizedTitle = sanitizePublicArchiveText(input.story.title || 'Untitled story', privateNames)
  const anonymizedText = sanitizePublicArchiveText(input.story.transcript || '', privateNames)
  const anonymizedSummary = summarize(anonymizedText)

  return {
    previewId: input.previewId,
    storyId: input.story.id,
    sourceContentHash: input.sourceContentHash,
    consentScope: ['text', 'structured_elements'],
    consentCopyVersion: PUBLIC_ARCHIVE_CONSENT_COPY_VERSION,
    anonymizedTitle,
    anonymizedText,
    anonymizedSummary,
    elements: input.elements.map(element => anonymizeElement(element, privateNames)),
    excludedDataTypes: ['voice', 'audio', 'photos', 'media_derivatives', 'exact_identity'],
  }
}

function anonymizeElement(element: ElementInput, privateNames: string[]): PublicArchiveElementPreview {
  const anonymizedValue = element.element_type === 'person'
    ? '[person]'
    : sanitizePublicArchiveText(element.value, privateNames)

  return {
    elementType: element.element_type,
    value: anonymizedValue,
    normalizedValue: element.element_type === 'person'
      ? '[person]'
      : element.normalized_value
        ? sanitizePublicArchiveText(element.normalized_value, privateNames)
        : null,
    sourceQuote: element.source_quote
      ? sanitizePublicArchiveText(element.source_quote, privateNames)
      : null,
    confidence: element.confidence,
  }
}

function summarize(text: string) {
  if (text.length <= 220) return text
  return `${text.slice(0, 217).trimEnd()}...`
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
```

- [ ] **Step 4: Run anonymizer tests**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/lib/public-archive/__tests__/anonymizer.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit anonymizer**

```bash
git add packages/web/src/lib/public-archive/anonymizer.ts packages/web/src/lib/public-archive/__tests__/anonymizer.test.ts
git commit -m "feat: add public archive anonymizer"
```

### Task 4: Public Archive Store, Access Helpers, And Agent Store Extension

**Files:**
- Create: `packages/web/src/lib/server/public-archive-access.ts`
- Create: `packages/web/src/lib/server/public-archive-store.ts`
- Modify: `packages/web/src/lib/server/agent-store.ts`
- Create: `packages/web/src/lib/server/__tests__/public-archive-access.test.ts`
- Create: `packages/web/src/lib/server/__tests__/public-archive-store.test.ts`
- Modify: `packages/web/src/lib/server/__tests__/agent-store.test.ts`

- [ ] **Step 1: Write failing access helper tests**

Create `packages/web/src/lib/server/__tests__/public-archive-access.test.ts`:

```ts
import { NextResponse } from 'next/server'
import {
  requireContributionOwner,
  requirePublicArchiveReviewer,
  requireStoryContributionOwner,
  requireStoryFacilitatorForInvitation,
} from '../public-archive-access'

const from = jest.fn()
const select = jest.fn()
const eq = jest.fn()
const is = jest.fn()
const maybeSingle = jest.fn()

jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({ from }),
}))

describe('public-archive-access', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    is.mockReturnValue({ maybeSingle })
    eq.mockReturnValue({ eq, is, maybeSingle })
    select.mockReturnValue({ eq })
    from.mockReturnValue({ select })
  })

  it('allows the story storyteller to contribute', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: { id: 'story-1', project_id: 'project-1', storyteller_id: 'user-1' },
      error: null,
    })

    const result = await requireStoryContributionOwner('story-1', { id: 'user-1' } as any)

    expect(result).toEqual({
      ok: true,
      story: { id: 'story-1', project_id: 'project-1', storyteller_id: 'user-1' },
    })
  })

  it('rejects facilitator contribution ownership for storyteller story', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: { id: 'story-1', project_id: 'project-1', storyteller_id: 'storyteller-1' },
      error: null,
    })

    const result = await requireStoryContributionOwner('story-1', { id: 'facilitator-1' } as any)

    expect(result.ok).toBe(false)
    if (!result.ok) expect((result.response as NextResponse).status).toBe(403)
  })

  it('allows active public archive reviewers', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { id: 'role-1' }, error: null })

    const result = await requirePublicArchiveReviewer({ id: 'reviewer-1' } as any)

    expect(result).toEqual({ ok: true })
    expect(from).toHaveBeenCalledWith('platform_roles')
  })

  it('allows project facilitator to invite a storyteller', async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: { id: 'story-1', project_id: 'project-1', storyteller_id: 'storyteller-1' }, error: null })
      .mockResolvedValueOnce({ data: { facilitator_id: 'facilitator-1' }, error: null })

    const result = await requireStoryFacilitatorForInvitation('story-1', { id: 'facilitator-1' } as any)

    expect(result.ok).toBe(true)
  })

  it('allows users to withdraw only their own contributions', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: { id: 'contribution-1', source_user_id: 'user-1', status: 'active' },
      error: null,
    })

    const result = await requireContributionOwner('contribution-1', { id: 'user-1' } as any)

    expect(result.ok).toBe(true)
  })
})
```

- [ ] **Step 2: Write failing store and agent-store tests**

Add to `packages/web/src/lib/server/__tests__/agent-store.test.ts`:

```ts
import { getAgentArtifactByIdForStory } from '../agent-store'

it('loads a story-scoped agent artifact by id', async () => {
  queryMaybeSingle.mockResolvedValueOnce({
    data: { id: 'artifact-1', story_id: 'story-1', artifact_type: 'anonymized_contribution_preview' },
    error: null,
  })

  const result = await getAgentArtifactByIdForStory('artifact-1', 'story-1')

  expect(result).toEqual({ id: 'artifact-1', story_id: 'story-1', artifact_type: 'anonymized_contribution_preview' })
  expect(from).toHaveBeenCalledWith('agent_artifacts')
  expect(queryEq).toHaveBeenCalledWith('id', 'artifact-1')
  expect(queryEq).toHaveBeenCalledWith('story_id', 'story-1')
})
```

Create `packages/web/src/lib/server/__tests__/public-archive-store.test.ts`:

```ts
import {
  createPublicArchiveAuditEvent,
  createPublicContribution,
  createPublicContributionElements,
  createPublicContributionInvitation,
  getOwnContributionForStory,
  withdrawPublicContribution,
} from '../public-archive-store'

const insertSingle = jest.fn()
const insertSingleSelect = jest.fn(() => ({ single: insertSingle }))
const insertRowsSelect = jest.fn()
const insertRows = jest.fn(() => ({ select: insertRowsSelect }))
const updateSingle = jest.fn()
const updateSelect = jest.fn(() => ({ single: updateSingle }))
const updateEq = jest.fn(() => ({ eq: updateEq, select: updateSelect }))
const update = jest.fn(() => ({ eq: updateEq }))
const maybeSingle = jest.fn()
const queryEq = jest.fn(() => ({ eq: queryEq, maybeSingle }))
const querySelect = jest.fn(() => ({ eq: queryEq }))
const from = jest.fn((table: string) => ({
  insert: table === 'public_contribution_elements' ? insertRows : jest.fn((value) => ({ select: () => ({ single: () => insertSingle({ value }) }) })),
  update,
  select: querySelect,
}))

jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({ from }),
}))

describe('public-archive-store', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    insertSingle.mockResolvedValue({ data: { id: 'row-1' }, error: null })
    insertRowsSelect.mockResolvedValue({ data: [{ id: 'element-1' }], error: null })
    updateSingle.mockResolvedValue({ data: { id: 'contribution-1', status: 'withdrawn' }, error: null })
    maybeSingle.mockResolvedValue({ data: { id: 'contribution-1' }, error: null })
  })

  it('creates public contributions from committed previews', async () => {
    const result = await createPublicContribution({
      sourceProjectId: 'project-1',
      sourceStoryId: 'story-1',
      sourceUserId: 'user-1',
      sourceStoryHash: 'story-hash',
      sourceContentHash: 'content-hash',
      consentCopyVersion: 'public-archive-consent-v1',
      anonymizedTitle: 'A market memory',
      anonymizedText: 'A child visited a market.',
      anonymizedSummary: 'A market memory.',
    })

    expect(result).toEqual({ id: 'row-1' })
    expect(from).toHaveBeenCalledWith('public_contributions')
  })

  it('creates contribution elements in bulk', async () => {
    const result = await createPublicContributionElements('contribution-1', [
      { elementType: 'time', value: '1976', normalizedValue: '1976', sourceQuote: '1976', confidence: 0.9 },
    ])

    expect(result).toEqual([{ id: 'element-1' }])
    expect(from).toHaveBeenCalledWith('public_contribution_elements')
  })

  it('creates facilitator invitations without creating contributions', async () => {
    const result = await createPublicContributionInvitation({
      storyId: 'story-1',
      projectId: 'project-1',
      invitedStorytellerId: 'storyteller-1',
      invitedBy: 'facilitator-1',
      message: 'This story may help others.',
    })

    expect(result).toEqual({ id: 'row-1' })
    expect(from).toHaveBeenCalledWith('public_contribution_invitations')
    expect(from).not.toHaveBeenCalledWith('public_contributions')
  })

  it('loads the current user contribution for a story', async () => {
    const result = await getOwnContributionForStory('story-1', 'user-1')

    expect(result).toEqual({ id: 'contribution-1' })
    expect(queryEq).toHaveBeenCalledWith('source_story_id', 'story-1')
    expect(queryEq).toHaveBeenCalledWith('source_user_id', 'user-1')
  })

  it('withdraws contributions by id', async () => {
    const result = await withdrawPublicContribution('contribution-1')

    expect(result).toEqual({ id: 'contribution-1', status: 'withdrawn' })
    expect(from).toHaveBeenCalledWith('public_contributions')
  })

  it('records audit events', async () => {
    const result = await createPublicArchiveAuditEvent({
      eventType: 'opted_in',
      actorUserId: 'user-1',
      publicContributionId: 'contribution-1',
      publicEventClusterId: null,
      consentCopyVersion: 'public-archive-consent-v1',
      metadata: { storyId: 'story-1' },
    })

    expect(result).toEqual({ id: 'row-1' })
    expect(from).toHaveBeenCalledWith('public_archive_audit_events')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/lib/server/__tests__/public-archive-access.test.ts packages/web/src/lib/server/__tests__/public-archive-store.test.ts packages/web/src/lib/server/__tests__/agent-store.test.ts
```

Expected: FAIL because new helper files and `getAgentArtifactByIdForStory` do not exist.

- [ ] **Step 4: Implement access helpers**

Create `packages/web/src/lib/server/public-archive-access.ts` with exported functions:

```ts
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase'

export type AccessResult<T = Record<string, never>> =
  | ({ ok: true } & T)
  | { ok: false; response: NextResponse }

export async function requireStoryContributionOwner(storyId: string, user: User) {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('stories')
    .select('id, project_id, storyteller_id, title, transcript, created_at')
    .eq('id', storyId)
    .maybeSingle()

  if (error) return denied(500, 'Unable to verify story ownership')
  if (!data) return denied(404, 'Story not found')
  if (data.storyteller_id !== user.id) return denied(403, 'Only the storyteller can contribute this story')
  return { ok: true as const, story: data }
}

export async function requireStoryFacilitatorForInvitation(storyId: string, user: User) {
  const db = getSupabaseAdmin()
  const { data: story, error: storyError } = await db
    .from('stories')
    .select('id, project_id, storyteller_id')
    .eq('id', storyId)
    .maybeSingle()

  if (storyError) return denied(500, 'Unable to verify story access')
  if (!story) return denied(404, 'Story not found')

  const { data: project, error: projectError } = await db
    .from('projects')
    .select('facilitator_id')
    .eq('id', story.project_id)
    .maybeSingle()

  if (projectError) return denied(500, 'Unable to verify project facilitator')
  if (project?.facilitator_id !== user.id) return denied(403, 'Only the project facilitator can invite contribution')
  return { ok: true as const, story }
}

export async function requireContributionOwner(contributionId: string, user: User) {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('public_contributions')
    .select('*')
    .eq('id', contributionId)
    .maybeSingle()

  if (error) return denied(500, 'Unable to verify contribution ownership')
  if (!data) return denied(404, 'Contribution not found')
  if (data.source_user_id !== user.id) return denied(403, 'Access denied')
  return { ok: true as const, contribution: data }
}

export async function requirePublicArchiveReviewer(user: User) {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('platform_roles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role', 'public_archive_reviewer')
    .is('revoked_at', null)
    .maybeSingle()

  if (error) return denied(500, 'Unable to verify reviewer role')
  if (!data) return denied(403, 'Reviewer access required')
  return { ok: true as const }
}

function denied(status: number, error: string) {
  return { ok: false as const, response: NextResponse.json({ error }, { status }) }
}
```

- [ ] **Step 5: Implement store helpers and agent artifact helper**

Create `packages/web/src/lib/server/public-archive-store.ts` with functions named in the tests. Use `getSupabaseAdmin().from(...).insert(...).select().single()` for single-row inserts, `.insert(rows).select()` for element rows, and `.update({ status: 'withdrawn', withdrawn_at: new Date().toISOString() }).eq('id', contributionId).select().single()` for withdrawal.

Add this to `packages/web/src/lib/server/agent-store.ts`:

```ts
export async function getAgentArtifactByIdForStory(agentArtifactId: string, storyId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('agent_artifacts')
    .select('*')
    .eq('id', agentArtifactId)
    .eq('story_id', storyId)
    .maybeSingle()

  raise(error)
  return data || null
}
```

Update `createAgentArtifact` input type to include:

```ts
  artifactType:
    | 'host_intervention'
    | 'standalone_story'
    | 'story_summary'
    | 'follow_up_questions'
    | 'story_elements'
    | 'anonymized_contribution_preview'
    | 'wiki_event_candidate'
    | 'wiki_event_draft'
```

- [ ] **Step 6: Run store/access tests**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/lib/server/__tests__/public-archive-access.test.ts packages/web/src/lib/server/__tests__/public-archive-store.test.ts packages/web/src/lib/server/__tests__/agent-store.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit store/access layer**

```bash
git add packages/web/src/lib/server/public-archive-access.ts packages/web/src/lib/server/public-archive-store.ts packages/web/src/lib/server/agent-store.ts packages/web/src/lib/server/__tests__/public-archive-access.test.ts packages/web/src/lib/server/__tests__/public-archive-store.test.ts packages/web/src/lib/server/__tests__/agent-store.test.ts
git commit -m "feat: add public archive server store"
```

### Task 5: Story Contribution Preview API

**Files:**
- Create: `packages/web/src/app/api/stories/[storyId]/public-archive/preview/route.ts`
- Create: `packages/web/src/app/api/stories/[storyId]/public-archive/preview/__tests__/route.test.ts`

- [ ] **Step 1: Write failing preview route tests**

Create `packages/web/src/app/api/stories/[storyId]/public-archive/preview/__tests__/route.test.ts`:

```ts
/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from 'next/server'
import { POST } from '../route'

const getAuthenticatedUser = jest.fn()
const requireStoryContributionOwner = jest.fn()
const createStoryContentHash = jest.fn()
const getCompletedEditorRunForStory = jest.fn()
const getStoryElementsForRun = jest.fn()
const createAgentRun = jest.fn()
const createAgentArtifact = jest.fn()
const completeAgentRun = jest.fn()
const failAgentRun = jest.fn()
const buildContributionPreview = jest.fn()

jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUser(...args) }))
jest.mock('@/lib/server/public-archive-access', () => ({ requireStoryContributionOwner: (...args: unknown[]) => requireStoryContributionOwner(...args) }))
jest.mock('@/lib/server/story-content-hash', () => ({ createStoryContentHash: (...args: unknown[]) => createStoryContentHash(...args) }))
jest.mock('@/lib/server/agent-store', () => ({
  getCompletedEditorRunForStory: (...args: unknown[]) => getCompletedEditorRunForStory(...args),
  getStoryElementsForRun: (...args: unknown[]) => getStoryElementsForRun(...args),
  createAgentRun: (...args: unknown[]) => createAgentRun(...args),
  createAgentArtifact: (...args: unknown[]) => createAgentArtifact(...args),
  completeAgentRun: (...args: unknown[]) => completeAgentRun(...args),
  failAgentRun: (...args: unknown[]) => failAgentRun(...args),
}))
jest.mock('@/lib/public-archive/anonymizer', () => ({ buildContributionPreview: (...args: unknown[]) => buildContributionPreview(...args) }))

describe('/api/stories/[storyId]/public-archive/preview', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'user-1' }, headers: new Headers([['x-auth-refreshed', '1']]) })
    requireStoryContributionOwner.mockResolvedValue({
      ok: true,
      story: {
        id: 'story-1',
        project_id: 'project-1',
        storyteller_id: 'user-1',
        title: 'Alice in Guangzhou',
        transcript: 'Alice visited Guangzhou in 1976.',
        created_at: '2026-01-02T03:04:05.000Z',
      },
    })
    createStoryContentHash.mockReturnValue('content-hash')
    getCompletedEditorRunForStory.mockResolvedValue({ id: 'editor-run-1' })
    getStoryElementsForRun.mockResolvedValue([
      { id: 'element-1', element_type: 'person', value: 'Alice', normalized_value: 'Alice', source_quote: 'Alice', confidence: 0.9 },
    ])
    createAgentRun.mockResolvedValue({ id: 'wiki-run-1' })
    createAgentArtifact.mockResolvedValue({ id: 'preview-artifact-1' })
    completeAgentRun.mockResolvedValue({ id: 'wiki-run-1', status: 'completed' })
    buildContributionPreview.mockReturnValue({
      previewId: 'preview-artifact-1',
      storyId: 'story-1',
      sourceContentHash: 'content-hash',
      consentScope: ['text', 'structured_elements'],
      consentCopyVersion: 'public-archive-consent-v1',
      anonymizedTitle: '[person] in Guangzhou',
      anonymizedText: '[person] visited Guangzhou in 1976.',
      anonymizedSummary: '[person] visited Guangzhou in 1976.',
      elements: [],
      excludedDataTypes: ['voice', 'audio', 'photos', 'media_derivatives', 'exact_identity'],
    })
  })

  it('creates a private anonymized preview artifact for the storyteller', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/stories/story-1/public-archive/preview', { method: 'POST' }),
      { params: Promise.resolve({ storyId: 'story-1' }) },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('x-auth-refreshed')).toBe('1')
    await expect(response.json()).resolves.toEqual({
      preview: expect.objectContaining({
        previewId: 'preview-artifact-1',
        anonymizedText: '[person] visited Guangzhou in 1976.',
      }),
    })
    expect(requireStoryContributionOwner).toHaveBeenCalledWith('story-1', { id: 'user-1' })
    expect(createAgentRun).toHaveBeenCalledWith(expect.objectContaining({ agentType: 'wiki_editor', contentHash: 'content-hash' }))
    expect(createAgentArtifact).toHaveBeenCalledWith(expect.objectContaining({ artifactType: 'anonymized_contribution_preview' }))
    expect(completeAgentRun).toHaveBeenCalledWith('wiki-run-1', expect.objectContaining({ previewCreated: true }))
  })

  it('uses an empty element list when no completed editor run exists', async () => {
    getCompletedEditorRunForStory.mockResolvedValueOnce(null)

    await POST(
      new NextRequest('http://localhost/api/stories/story-1/public-archive/preview', { method: 'POST' }),
      { params: Promise.resolve({ storyId: 'story-1' }) },
    )

    expect(getStoryElementsForRun).not.toHaveBeenCalled()
    expect(buildContributionPreview).toHaveBeenCalledWith(expect.objectContaining({ elements: [] }))
  })

  it('rejects non-storyteller users before creating an agent run', async () => {
    requireStoryContributionOwner.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Only the storyteller can contribute this story' }, { status: 403 }),
    })

    const response = await POST(
      new NextRequest('http://localhost/api/stories/story-1/public-archive/preview', { method: 'POST' }),
      { params: Promise.resolve({ storyId: 'story-1' }) },
    )

    expect(response.status).toBe(403)
    expect(createAgentRun).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run preview route tests to verify they fail**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/app/api/stories/[storyId]/public-archive/preview/__tests__/route.test.ts
```

Expected: FAIL because preview route does not exist.

- [ ] **Step 3: Implement preview route**

Create `packages/web/src/app/api/stories/[storyId]/public-archive/preview/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { buildContributionPreview } from '@/lib/public-archive/anonymizer'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireStoryContributionOwner } from '@/lib/server/public-archive-access'
import { createStoryContentHash } from '@/lib/server/story-content-hash'
import {
  completeAgentRun,
  createAgentArtifact,
  createAgentRun,
  failAgentRun,
  getCompletedEditorRunForStory,
  getStoryElementsForRun,
} from '@/lib/server/agent-store'

interface RouteContext {
  params: Promise<{ storyId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const { storyId } = await context.params
  const access = await requireStoryContributionOwner(storyId, auth.user)
  if (!access.ok) return withAuthHeaders(access.response, auth.headers)

  const story = access.story
  const sourceContentHash = createStoryContentHash({
    storyId: story.id,
    title: story.title,
    transcript: story.transcript || '',
    createdAt: story.created_at,
  })

  let runId: string | null = null
  try {
    const run = await createAgentRun({
      agentType: 'wiki_editor',
      projectId: story.project_id,
      storyId: story.id,
      interviewSessionId: null,
      createdBy: auth.user.id,
      input: { storyId: story.id, sourceContentHash, phase: 'contribution_preview' },
      contentHash: sourceContentHash,
      model: 'deterministic-public-archive-anonymizer',
    })
    runId = String(run.id)

    const editorRun = await getCompletedEditorRunForStory(story.id, sourceContentHash)
    const elements = editorRun ? await getStoryElementsForRun(String(editorRun.id)) : []
    const temporaryPreview = buildContributionPreview({
      previewId: 'pending',
      story,
      sourceContentHash,
      elements: elements as any[],
    })

    const artifact = await createAgentArtifact({
      agentRunId: runId,
      projectId: story.project_id,
      storyId: story.id,
      artifactType: 'anonymized_contribution_preview',
      payload: temporaryPreview,
      sourceRefs: [{ source_type: 'story', source_id: story.id }],
      confidence: 0.8,
    })

    const preview = { ...temporaryPreview, previewId: String(artifact.id) }
    await completeAgentRun(runId, { previewCreated: true, previewId: preview.previewId })

    return NextResponse.json({ preview }, { headers: auth.headers })
  } catch (error) {
    if (runId) {
      await failAgentRun(runId, error instanceof Error ? error.message : 'Preview generation failed')
    }
    return NextResponse.json({ error: 'Unable to generate public archive preview' }, { status: 500, headers: auth.headers })
  }
}

function withAuthHeaders(response: NextResponse, headers: Headers) {
  headers.forEach((value, key) => response.headers.set(key, value))
  return response
}
```

- [ ] **Step 4: Run preview route tests**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/app/api/stories/[storyId]/public-archive/preview/__tests__/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit preview API**

```bash
git add packages/web/src/app/api/stories/[storyId]/public-archive/preview packages/web/src/app/api/stories/[storyId]/public-archive/preview/__tests__/route.test.ts
git commit -m "feat: add public archive preview api"
```

### Task 6: Contribution Commit, Status, And Withdrawal APIs

**Files:**
- Create: `packages/web/src/app/api/stories/[storyId]/public-archive/route.ts`
- Create: `packages/web/src/app/api/stories/[storyId]/public-archive/__tests__/route.test.ts`
- Create: `packages/web/src/app/api/public-archive/contributions/[contributionId]/withdraw/route.ts`
- Create: `packages/web/src/app/api/public-archive/contributions/[contributionId]/withdraw/__tests__/route.test.ts`

- [ ] **Step 1: Write failing commit/status route tests**

Create `packages/web/src/app/api/stories/[storyId]/public-archive/__tests__/route.test.ts` with tests that assert:

```ts
/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET, POST } from '../route'

const getAuthenticatedUser = jest.fn()
const requireStoryContributionOwner = jest.fn()
const createStoryContentHash = jest.fn()
const getAgentArtifactByIdForStory = jest.fn()
const createPublicContribution = jest.fn()
const createPublicContributionElements = jest.fn()
const createPublicArchiveAuditEvent = jest.fn()
const getOwnContributionForStory = jest.fn()

jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUser(...args) }))
jest.mock('@/lib/server/public-archive-access', () => ({ requireStoryContributionOwner: (...args: unknown[]) => requireStoryContributionOwner(...args) }))
jest.mock('@/lib/server/story-content-hash', () => ({ createStoryContentHash: (...args: unknown[]) => createStoryContentHash(...args) }))
jest.mock('@/lib/server/agent-store', () => ({ getAgentArtifactByIdForStory: (...args: unknown[]) => getAgentArtifactByIdForStory(...args) }))
jest.mock('@/lib/server/public-archive-store', () => ({
  createPublicContribution: (...args: unknown[]) => createPublicContribution(...args),
  createPublicContributionElements: (...args: unknown[]) => createPublicContributionElements(...args),
  createPublicArchiveAuditEvent: (...args: unknown[]) => createPublicArchiveAuditEvent(...args),
  getOwnContributionForStory: (...args: unknown[]) => getOwnContributionForStory(...args),
}))

describe('/api/stories/[storyId]/public-archive', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'user-1' }, headers: new Headers([['x-auth-refreshed', '1']]) })
    requireStoryContributionOwner.mockResolvedValue({
      ok: true,
      story: { id: 'story-1', project_id: 'project-1', storyteller_id: 'user-1', title: 'Story', transcript: 'Text', created_at: '2026-01-02T03:04:05.000Z' },
    })
    createStoryContentHash.mockReturnValue('content-hash')
    getAgentArtifactByIdForStory.mockResolvedValue({
      id: 'preview-1',
      payload: {
        previewId: 'preview-1',
        storyId: 'story-1',
        sourceContentHash: 'content-hash',
        consentCopyVersion: 'public-archive-consent-v1',
        anonymizedTitle: 'Story',
        anonymizedText: 'Anonymized text',
        anonymizedSummary: 'Summary',
        elements: [{ elementType: 'time', value: '1976', normalizedValue: '1976', sourceQuote: '1976', confidence: 0.9 }],
      },
    })
    createPublicContribution.mockResolvedValue({ id: 'contribution-1', public_ref: 'pc_1' })
    createPublicContributionElements.mockResolvedValue([{ id: 'element-1' }])
    createPublicArchiveAuditEvent.mockResolvedValue({ id: 'audit-1' })
    getOwnContributionForStory.mockResolvedValue({ id: 'contribution-1', status: 'active' })
  })

  it('returns the storyteller contribution status for a story', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/stories/story-1/public-archive'),
      { params: Promise.resolve({ storyId: 'story-1' }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ contribution: { id: 'contribution-1', status: 'active' } })
  })

  it('commits a public contribution from a current preview artifact', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/stories/story-1/public-archive', {
        method: 'POST',
        body: JSON.stringify({ previewId: 'preview-1' }),
      }),
      { params: Promise.resolve({ storyId: 'story-1' }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      contribution: { id: 'contribution-1', public_ref: 'pc_1' },
      elementsCount: 1,
    })
    expect(createPublicContribution).toHaveBeenCalledWith(expect.objectContaining({
      sourceProjectId: 'project-1',
      sourceStoryId: 'story-1',
      sourceUserId: 'user-1',
      sourceContentHash: 'content-hash',
      anonymizedText: 'Anonymized text',
    }))
    expect(createPublicContributionElements).toHaveBeenCalledWith('contribution-1', expect.any(Array))
    expect(createPublicArchiveAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'opted_in' }))
  })

  it('rejects stale preview commits', async () => {
    createStoryContentHash.mockReturnValueOnce('new-content-hash')

    const response = await POST(
      new NextRequest('http://localhost/api/stories/story-1/public-archive', {
        method: 'POST',
        body: JSON.stringify({ previewId: 'preview-1' }),
      }),
      { params: Promise.resolve({ storyId: 'story-1' }) },
    )

    expect(response.status).toBe(409)
    expect(createPublicContribution).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Write failing withdrawal route tests**

Create `packages/web/src/app/api/public-archive/contributions/[contributionId]/withdraw/__tests__/route.test.ts`:

```ts
/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST } from '../route'

const getAuthenticatedUser = jest.fn()
const requireContributionOwner = jest.fn()
const withdrawPublicContribution = jest.fn()
const markContributionEventsForReprocessing = jest.fn()
const createPublicArchiveAuditEvent = jest.fn()

jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUser(...args) }))
jest.mock('@/lib/server/public-archive-access', () => ({ requireContributionOwner: (...args: unknown[]) => requireContributionOwner(...args) }))
jest.mock('@/lib/server/public-archive-store', () => ({
  withdrawPublicContribution: (...args: unknown[]) => withdrawPublicContribution(...args),
  markContributionEventsForReprocessing: (...args: unknown[]) => markContributionEventsForReprocessing(...args),
  createPublicArchiveAuditEvent: (...args: unknown[]) => createPublicArchiveAuditEvent(...args),
}))

describe('/api/public-archive/contributions/[contributionId]/withdraw', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'user-1' }, headers: new Headers() })
    requireContributionOwner.mockResolvedValue({ ok: true, contribution: { id: 'contribution-1', status: 'active' } })
    withdrawPublicContribution.mockResolvedValue({ id: 'contribution-1', status: 'withdrawn' })
    markContributionEventsForReprocessing.mockResolvedValue([])
    createPublicArchiveAuditEvent.mockResolvedValue({ id: 'audit-1' })
  })

  it('withdraws an owned active contribution and marks linked events for reprocessing', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/public-archive/contributions/contribution-1/withdraw', { method: 'POST' }),
      { params: Promise.resolve({ contributionId: 'contribution-1' }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ contribution: { id: 'contribution-1', status: 'withdrawn' } })
    expect(withdrawPublicContribution).toHaveBeenCalledWith('contribution-1')
    expect(markContributionEventsForReprocessing).toHaveBeenCalledWith('contribution-1')
    expect(createPublicArchiveAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'withdrawn' }))
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/app/api/stories/[storyId]/public-archive/__tests__/route.test.ts packages/web/src/app/api/public-archive/contributions/[contributionId]/withdraw/__tests__/route.test.ts
```

Expected: FAIL because routes do not exist.

- [ ] **Step 4: Implement commit/status and withdrawal routes**

Implement:

- `GET /api/stories/[storyId]/public-archive`
  - Authenticate.
  - Call `requireStoryContributionOwner`.
  - Return `getOwnContributionForStory(storyId, auth.user.id)`.
- `POST /api/stories/[storyId]/public-archive`
  - Parse `{ previewId }`.
  - Authenticate and require story owner.
  - Load preview via `getAgentArtifactByIdForStory(previewId, storyId)`.
  - Recompute story content hash.
  - Return `409` if hash differs from `payload.sourceContentHash`.
  - Create contribution, elements, and audit event.
- `POST /api/public-archive/contributions/[contributionId]/withdraw`
  - Authenticate.
  - Require contribution owner.
  - Withdraw contribution.
  - Mark linked events for reprocessing.
  - Create audit event.

Add these store helpers to `packages/web/src/lib/server/public-archive-store.ts`:

```ts
export async function markContributionEventsForReprocessing(publicContributionId: string) {
  const db = getSupabaseAdmin()
  const { data: links, error: linkError } = await db
    .from('public_event_contributions')
    .select('public_event_cluster_id')
    .eq('public_contribution_id', publicContributionId)
    .is('removed_at', null)

  raise(linkError)
  const ids = [...new Set((links || []).map(link => link.public_event_cluster_id))]
  if (ids.length === 0) return []

  const { data, error } = await db
    .from('public_event_clusters')
    .update({ status: 'needs_reprocessing', updated_at: new Date().toISOString() })
    .in('id', ids)
    .select()

  raise(error)
  return data || []
}
```

- [ ] **Step 5: Run contribution API tests**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/app/api/stories/[storyId]/public-archive/__tests__/route.test.ts packages/web/src/app/api/public-archive/contributions/[contributionId]/withdraw/__tests__/route.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit contribution APIs**

```bash
git add packages/web/src/app/api/stories/[storyId]/public-archive packages/web/src/app/api/public-archive/contributions packages/web/src/lib/server/public-archive-store.ts
git commit -m "feat: add public archive contribution api"
```

### Task 7: Facilitator Contribution Invitation API

**Files:**
- Create: `packages/web/src/app/api/stories/[storyId]/public-archive/invitations/route.ts`
- Create: `packages/web/src/app/api/stories/[storyId]/public-archive/invitations/__tests__/route.test.ts`

- [ ] **Step 1: Write failing invitation route tests**

Create `packages/web/src/app/api/stories/[storyId]/public-archive/invitations/__tests__/route.test.ts`:

```ts
/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from 'next/server'
import { POST } from '../route'

const getAuthenticatedUser = jest.fn()
const requireStoryFacilitatorForInvitation = jest.fn()
const createPublicContributionInvitation = jest.fn()

jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUser(...args) }))
jest.mock('@/lib/server/public-archive-access', () => ({ requireStoryFacilitatorForInvitation: (...args: unknown[]) => requireStoryFacilitatorForInvitation(...args) }))
jest.mock('@/lib/server/public-archive-store', () => ({ createPublicContributionInvitation: (...args: unknown[]) => createPublicContributionInvitation(...args) }))

describe('/api/stories/[storyId]/public-archive/invitations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'facilitator-1' }, headers: new Headers() })
    requireStoryFacilitatorForInvitation.mockResolvedValue({
      ok: true,
      story: { id: 'story-1', project_id: 'project-1', storyteller_id: 'storyteller-1' },
    })
    createPublicContributionInvitation.mockResolvedValue({ id: 'invitation-1', status: 'pending' })
  })

  it('lets a facilitator invite the storyteller without creating public contribution consent', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/stories/story-1/public-archive/invitations', {
        method: 'POST',
        body: JSON.stringify({ message: 'This story may help others.' }),
      }),
      { params: Promise.resolve({ storyId: 'story-1' }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ invitation: { id: 'invitation-1', status: 'pending' } })
    expect(createPublicContributionInvitation).toHaveBeenCalledWith({
      storyId: 'story-1',
      projectId: 'project-1',
      invitedStorytellerId: 'storyteller-1',
      invitedBy: 'facilitator-1',
      message: 'This story may help others.',
    })
  })

  it('rejects users who cannot manage the story project', async () => {
    requireStoryFacilitatorForInvitation.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Only the project facilitator can invite contribution' }, { status: 403 }),
    })

    const response = await POST(
      new NextRequest('http://localhost/api/stories/story-1/public-archive/invitations', { method: 'POST', body: JSON.stringify({}) }),
      { params: Promise.resolve({ storyId: 'story-1' }) },
    )

    expect(response.status).toBe(403)
    expect(createPublicContributionInvitation).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run invitation test to verify it fails**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/app/api/stories/[storyId]/public-archive/invitations/__tests__/route.test.ts
```

Expected: FAIL because route does not exist.

- [ ] **Step 3: Implement invitation route**

Create route with:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireStoryFacilitatorForInvitation } from '@/lib/server/public-archive-access'
import { createPublicContributionInvitation } from '@/lib/server/public-archive-store'

interface RouteContext {
  params: Promise<{ storyId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const { storyId } = await context.params
  const access = await requireStoryFacilitatorForInvitation(storyId, auth.user)
  if (!access.ok) return access.response

  const body = await request.json().catch(() => ({}))
  const invitation = await createPublicContributionInvitation({
    storyId,
    projectId: access.story.project_id,
    invitedStorytellerId: access.story.storyteller_id,
    invitedBy: auth.user.id,
    message: typeof body.message === 'string' && body.message.trim() ? body.message.trim() : null,
  })

  return NextResponse.json({ invitation }, { headers: auth.headers })
}
```

- [ ] **Step 4: Run invitation tests**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/app/api/stories/[storyId]/public-archive/invitations/__tests__/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit invitation API**

```bash
git add packages/web/src/app/api/stories/[storyId]/public-archive/invitations
git commit -m "feat: add public archive invitation api"
```

### Task 8: Wiki Editor Agent Logic

**Files:**
- Create: `packages/web/src/lib/public-archive/wiki-editor-agent.ts`
- Create: `packages/web/src/lib/public-archive/__tests__/wiki-editor-agent.test.ts`

- [ ] **Step 1: Write failing Wiki Editor tests**

Create `packages/web/src/lib/public-archive/__tests__/wiki-editor-agent.test.ts`:

```ts
import { processWikiEventDraft } from '../wiki-editor-agent'

describe('wiki-editor-agent', () => {
  it('creates a candidate for one active contribution', () => {
    const result = processWikiEventDraft({
      existingClusters: [],
      contributions: [
        {
          id: 'contribution-1',
          anonymized_title: '1976 Guangzhou market memory',
          anonymized_text: 'In 1976 a child remembered a Guangzhou market.',
          anonymized_summary: 'A market memory.',
          elements: [
            { element_type: 'time', value: '1976', normalized_value: '1976', confidence: 0.9 },
            { element_type: 'place', value: 'Guangzhou', normalized_value: 'Guangzhou', confidence: 0.8 },
            { element_type: 'event', value: 'market visit', normalized_value: 'market visit', confidence: 0.7 },
          ],
        },
      ],
    })

    expect(result.status).toBe('candidate')
    expect(result.eventLabel).toBe('1976 Guangzhou market visit memories')
    expect(result.activeContributionIds).toEqual(['contribution-1'])
  })

  it('upgrades matching contributions to a draft', () => {
    const result = processWikiEventDraft({
      existingClusters: [],
      contributions: [
        {
          id: 'contribution-1',
          anonymized_title: '1976 Guangzhou market memory',
          anonymized_text: 'In 1976 a child remembered a Guangzhou market.',
          anonymized_summary: 'A market memory.',
          elements: [
            { element_type: 'time', value: '1976', normalized_value: '1976', confidence: 0.9 },
            { element_type: 'place', value: 'Guangzhou', normalized_value: 'Guangzhou', confidence: 0.8 },
            { element_type: 'event', value: 'market visit', normalized_value: 'market visit', confidence: 0.7 },
          ],
        },
        {
          id: 'contribution-2',
          anonymized_title: 'Guangzhou market in 1976',
          anonymized_text: 'Another contributor remembered going to a Guangzhou market in 1976.',
          anonymized_summary: 'Another market memory.',
          elements: [
            { element_type: 'time', value: '1976', normalized_value: '1976', confidence: 0.9 },
            { element_type: 'place', value: 'Guangzhou', normalized_value: 'Guangzhou', confidence: 0.8 },
            { element_type: 'event', value: 'market visit', normalized_value: 'market visit', confidence: 0.7 },
          ],
        },
      ],
    })

    expect(result.status).toBe('draft')
    expect(result.activeContributionIds).toEqual(['contribution-1', 'contribution-2'])
    expect(result.representativeExcerpts).toHaveLength(2)
    expect(result.uncertaintyNotes).toContain('derived from 2 active contributions')
  })

  it('keeps low-confidence mismatches as separate candidates by selecting only the strongest contribution group', () => {
    const result = processWikiEventDraft({
      existingClusters: [],
      contributions: [
        {
          id: 'contribution-1',
          anonymized_title: '1976 Guangzhou memory',
          anonymized_text: 'Guangzhou in 1976.',
          anonymized_summary: 'Guangzhou memory.',
          elements: [
            { element_type: 'time', value: '1976', normalized_value: '1976', confidence: 0.9 },
            { element_type: 'place', value: 'Guangzhou', normalized_value: 'Guangzhou', confidence: 0.8 },
          ],
        },
        {
          id: 'contribution-2',
          anonymized_title: '2020 Taipei school closure',
          anonymized_text: 'Taipei school closure in 2020.',
          anonymized_summary: 'School closure memory.',
          elements: [
            { element_type: 'time', value: '2020', normalized_value: '2020', confidence: 0.9 },
            { element_type: 'place', value: 'Taipei', normalized_value: 'Taipei', confidence: 0.8 },
          ],
        },
      ],
    })

    expect(result.status).toBe('candidate')
    expect(result.activeContributionIds).toEqual(['contribution-1'])
  })
})
```

- [ ] **Step 2: Run Wiki Editor tests to verify they fail**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/lib/public-archive/__tests__/wiki-editor-agent.test.ts
```

Expected: FAIL because `wiki-editor-agent.ts` does not exist.

- [ ] **Step 3: Implement Wiki Editor deterministic logic**

Create `packages/web/src/lib/public-archive/wiki-editor-agent.ts`:

```ts
import type { StoryElementType } from '@saga/shared/types/agents'

interface PublicContributionForWiki {
  id: string
  anonymized_title: string
  anonymized_text: string
  anonymized_summary: string
  elements: Array<{
    element_type: StoryElementType
    value: string
    normalized_value: string | null
    confidence: number
  }>
}

interface ExistingCluster {
  id: string
  event_label: string
  timeframe: string
  place_scope: string
}

export function processWikiEventDraft(input: {
  existingClusters: ExistingCluster[]
  contributions: PublicContributionForWiki[]
}) {
  const groups = groupBySignature(input.contributions)
  const selected = groups[0] || []
  const first = selected[0]
  const timeframe = getElementValue(first, 'time') || 'Unknown timeframe'
  const placeScope = getElementValue(first, 'place') || 'Unknown place'
  const event = getElementValue(first, 'event') || 'shared event'
  const eventLabel = `${timeframe} ${placeScope} ${event} memories`.replace(/\s+/g, ' ').trim()

  return {
    status: selected.length >= 2 ? 'draft' as const : 'candidate' as const,
    eventLabel,
    timeframe,
    placeScope,
    historicalContextSummary: `Contributors described ${event} around ${placeScope} during ${timeframe}.`,
    perspectiveSummary: selected.map(item => item.anonymized_summary).join(' '),
    representativeExcerpts: selected.slice(0, 3).map(item => excerpt(item.anonymized_text)),
    uncertaintyNotes: `This summary is derived from ${selected.length} active contributions and does not use external historical sources.`,
    confidence: selected.length >= 2 ? 0.8 : 0.65,
    activeContributionIds: selected.map(item => item.id),
  }
}

function groupBySignature(contributions: PublicContributionForWiki[]) {
  const map = new Map<string, PublicContributionForWiki[]>()
  for (const contribution of contributions) {
    const signature = [
      getElementValue(contribution, 'time'),
      getElementValue(contribution, 'place'),
      getElementValue(contribution, 'event'),
    ].filter(Boolean).join('|') || contribution.id
    map.set(signature, [...(map.get(signature) || []), contribution])
  }
  return [...map.values()].sort((a, b) => b.length - a.length)
}

function getElementValue(contribution: PublicContributionForWiki, type: StoryElementType) {
  const element = contribution.elements.find(item => item.element_type === type && item.confidence >= 0.6)
  return element?.normalized_value || element?.value || null
}

function excerpt(text: string) {
  if (text.length <= 160) return text
  return `${text.slice(0, 157).trimEnd()}...`
}
```

- [ ] **Step 4: Run Wiki Editor tests**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/lib/public-archive/__tests__/wiki-editor-agent.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Wiki Editor logic**

```bash
git add packages/web/src/lib/public-archive/wiki-editor-agent.ts packages/web/src/lib/public-archive/__tests__/wiki-editor-agent.test.ts
git commit -m "feat: add wiki editor agent logic"
```

### Task 9: Wiki Processing And Reviewer APIs

**Files:**
- Create: `packages/web/src/lib/server/public-archive-wiki-runner.ts`
- Create: `packages/web/src/lib/server/__tests__/public-archive-wiki-runner.test.ts`
- Create: `packages/web/src/app/api/agents/wiki/process-contribution/route.ts`
- Create: `packages/web/src/app/api/agents/wiki/process-contribution/__tests__/route.test.ts`
- Create: `packages/web/src/app/api/public-archive/reviewer/event-drafts/route.ts`
- Create: `packages/web/src/app/api/public-archive/reviewer/event-drafts/__tests__/route.test.ts`
- Create: `packages/web/src/app/api/public-archive/reviewer/event-drafts/[eventId]/review/route.ts`
- Create: `packages/web/src/app/api/public-archive/reviewer/event-drafts/[eventId]/review/__tests__/route.test.ts`
- Create: `packages/web/src/app/api/public-archive/events/approved/route.ts`
- Create: `packages/web/src/app/api/public-archive/events/approved/__tests__/route.test.ts`
- Modify: `packages/web/src/lib/server/public-archive-store.ts`
- Modify: `packages/web/src/app/api/stories/[storyId]/public-archive/route.ts`
- Modify: `packages/web/src/app/api/stories/[storyId]/public-archive/__tests__/route.test.ts`

- [ ] **Step 1: Extend store helpers for Wiki and reviewer workflows**

Before route tests, add tests to `packages/web/src/lib/server/__tests__/public-archive-store.test.ts` for these functions:

```ts
import {
  approvePublicEventDraft,
  createOrUpdatePublicEventCluster,
  getActiveContributionWithElementsForWiki,
  getApprovedEventSummariesForContributor,
  listReviewerEventDrafts,
  linkPublicEventContributions,
} from '../public-archive-store'
```

Test expectations:

```ts
it('loads active contribution with public elements for wiki processing', async () => {
  const result = await getActiveContributionWithElementsForWiki('contribution-1')
  expect(from).toHaveBeenCalledWith('public_contributions')
  expect(result).toEqual({ id: 'contribution-1' })
})

it('creates or updates public event clusters from wiki output', async () => {
  const result = await createOrUpdatePublicEventCluster({
    status: 'draft',
    eventLabel: '1976 Guangzhou market visit memories',
    timeframe: '1976',
    placeScope: 'Guangzhou',
    historicalContextSummary: 'Contributors described market visits.',
    perspectiveSummary: 'Two perspectives.',
    representativeExcerpts: ['A child remembered a market.'],
    uncertaintyNotes: 'Evidence-limited.',
    confidence: 0.8,
  })
  expect(result).toEqual({ id: 'row-1' })
  expect(from).toHaveBeenCalledWith('public_event_clusters')
})

it('lists reviewer drafts and approves drafts', async () => {
  await listReviewerEventDrafts()
  await approvePublicEventDraft('event-1', 'reviewer-1')
  expect(from).toHaveBeenCalledWith('public_event_clusters')
})
```

Implement the store helpers using Supabase admin and exact table names from Task 2.

- [ ] **Step 2: Write route tests for Wiki processing and reviewer APIs**

Create `packages/web/src/lib/server/__tests__/public-archive-wiki-runner.test.ts`:

```ts
/**
 * @jest-environment node
 */

import { processPublicContributionWithWikiAgent } from '../public-archive-wiki-runner'

const createAgentRun = jest.fn()
const completeAgentRun = jest.fn()
const failAgentRun = jest.fn()
const createAgentArtifact = jest.fn()
const getActiveContributionWithElementsForWiki = jest.fn()
const createOrUpdatePublicEventCluster = jest.fn()
const linkPublicEventContributions = jest.fn()
const updateContributionWikiStatus = jest.fn()
const createPublicArchiveAuditEvent = jest.fn()
const processWikiEventDraft = jest.fn()

jest.mock('@/lib/server/agent-store', () => ({
  createAgentRun: (...args: unknown[]) => createAgentRun(...args),
  completeAgentRun: (...args: unknown[]) => completeAgentRun(...args),
  failAgentRun: (...args: unknown[]) => failAgentRun(...args),
  createAgentArtifact: (...args: unknown[]) => createAgentArtifact(...args),
}))
jest.mock('@/lib/server/public-archive-store', () => ({
  getActiveContributionWithElementsForWiki: (...args: unknown[]) => getActiveContributionWithElementsForWiki(...args),
  createOrUpdatePublicEventCluster: (...args: unknown[]) => createOrUpdatePublicEventCluster(...args),
  linkPublicEventContributions: (...args: unknown[]) => linkPublicEventContributions(...args),
  updateContributionWikiStatus: (...args: unknown[]) => updateContributionWikiStatus(...args),
  createPublicArchiveAuditEvent: (...args: unknown[]) => createPublicArchiveAuditEvent(...args),
}))
jest.mock('@/lib/public-archive/wiki-editor-agent', () => ({
  processWikiEventDraft: (...args: unknown[]) => processWikiEventDraft(...args),
}))

describe('processPublicContributionWithWikiAgent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    createAgentRun.mockResolvedValue({ id: 'run-1' })
    getActiveContributionWithElementsForWiki.mockResolvedValue({
      id: 'contribution-1',
      anonymized_title: '1976 Guangzhou memory',
      anonymized_text: 'A child remembered Guangzhou in 1976.',
      anonymized_summary: 'A Guangzhou memory.',
      elements: [{ element_type: 'time', value: '1976', normalized_value: '1976', confidence: 0.9 }],
    })
    processWikiEventDraft.mockReturnValue({
      status: 'candidate',
      eventLabel: '1976 Guangzhou shared event memories',
      timeframe: '1976',
      placeScope: 'Guangzhou',
      historicalContextSummary: 'Contributor described a memory.',
      perspectiveSummary: 'A Guangzhou memory.',
      representativeExcerpts: ['A child remembered Guangzhou in 1976.'],
      uncertaintyNotes: 'Evidence-limited.',
      confidence: 0.65,
      activeContributionIds: ['contribution-1'],
    })
    createOrUpdatePublicEventCluster.mockResolvedValue({ id: 'event-1' })
    linkPublicEventContributions.mockResolvedValue([{ id: 'link-1' }])
    createAgentArtifact.mockResolvedValue({ id: 'artifact-1' })
    completeAgentRun.mockResolvedValue({ id: 'run-1', status: 'completed' })
    updateContributionWikiStatus.mockResolvedValue({ id: 'contribution-1', wiki_status: 'processed' })
    createPublicArchiveAuditEvent.mockResolvedValue({ id: 'audit-1' })
  })

  it('processes a contribution through Wiki Editor and records artifacts', async () => {
    const result = await processPublicContributionWithWikiAgent({
      contributionId: 'contribution-1',
      actorUserId: 'user-1',
    })

    expect(result).toEqual({ eventClusterId: 'event-1', status: 'candidate' })
    expect(createAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      agentType: 'wiki_editor',
      projectId: null,
      storyId: null,
      interviewSessionId: null,
      model: 'deterministic-wiki-editor-agent',
    }))
    expect(createAgentArtifact).toHaveBeenCalledWith(expect.objectContaining({
      artifactType: 'wiki_event_candidate',
    }))
    expect(updateContributionWikiStatus).toHaveBeenCalledWith('contribution-1', 'processed')
  })
})
```

Create `packages/web/src/app/api/agents/wiki/process-contribution/__tests__/route.test.ts`:

```ts
/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST } from '../route'

const getAuthenticatedUser = jest.fn()
const processPublicContributionWithWikiAgent = jest.fn()

jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUser(...args) }))
jest.mock('@/lib/server/public-archive-wiki-runner', () => ({
  processPublicContributionWithWikiAgent: (...args: unknown[]) => processPublicContributionWithWikiAgent(...args),
}))

describe('/api/agents/wiki/process-contribution', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'user-1' }, headers: new Headers() })
    processPublicContributionWithWikiAgent.mockResolvedValue({ eventClusterId: 'event-1', status: 'candidate' })
  })

  it('processes a contribution for the authenticated actor', async () => {
    const response = await POST(new NextRequest('http://localhost/api/agents/wiki/process-contribution', {
      method: 'POST',
      body: JSON.stringify({ contributionId: 'contribution-1' }),
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      processed: true,
      result: { eventClusterId: 'event-1', status: 'candidate' },
    })
    expect(processPublicContributionWithWikiAgent).toHaveBeenCalledWith({
      contributionId: 'contribution-1',
      actorUserId: 'user-1',
    })
  })
})
```

Create `packages/web/src/app/api/public-archive/reviewer/event-drafts/__tests__/route.test.ts`:

```ts
/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET } from '../route'

const getAuthenticatedUser = jest.fn()
const requirePublicArchiveReviewer = jest.fn()
const listReviewerEventDrafts = jest.fn()

jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUser(...args) }))
jest.mock('@/lib/server/public-archive-access', () => ({ requirePublicArchiveReviewer: (...args: unknown[]) => requirePublicArchiveReviewer(...args) }))
jest.mock('@/lib/server/public-archive-store', () => ({ listReviewerEventDrafts: (...args: unknown[]) => listReviewerEventDrafts(...args) }))

describe('/api/public-archive/reviewer/event-drafts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'reviewer-1' }, headers: new Headers() })
    requirePublicArchiveReviewer.mockResolvedValue({ ok: true })
    listReviewerEventDrafts.mockResolvedValue([{ id: 'event-1', status: 'draft' }])
  })

  it('lists pending event drafts for platform reviewers', async () => {
    const response = await GET(new NextRequest('http://localhost/api/public-archive/reviewer/event-drafts'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ drafts: [{ id: 'event-1', status: 'draft' }] })
    expect(requirePublicArchiveReviewer).toHaveBeenCalledWith({ id: 'reviewer-1' })
  })
})
```

Create `packages/web/src/app/api/public-archive/reviewer/event-drafts/[eventId]/review/__tests__/route.test.ts`:

```ts
/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST } from '../route'

const getAuthenticatedUser = jest.fn()
const requirePublicArchiveReviewer = jest.fn()
const approvePublicEventDraft = jest.fn()
const rejectPublicEventDraft = jest.fn()
const markPublicEventNeedsReprocessing = jest.fn()
const createPublicArchiveAuditEvent = jest.fn()

jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUser(...args) }))
jest.mock('@/lib/server/public-archive-access', () => ({ requirePublicArchiveReviewer: (...args: unknown[]) => requirePublicArchiveReviewer(...args) }))
jest.mock('@/lib/server/public-archive-store', () => ({
  approvePublicEventDraft: (...args: unknown[]) => approvePublicEventDraft(...args),
  rejectPublicEventDraft: (...args: unknown[]) => rejectPublicEventDraft(...args),
  markPublicEventNeedsReprocessing: (...args: unknown[]) => markPublicEventNeedsReprocessing(...args),
  createPublicArchiveAuditEvent: (...args: unknown[]) => createPublicArchiveAuditEvent(...args),
}))

describe('/api/public-archive/reviewer/event-drafts/[eventId]/review', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'reviewer-1' }, headers: new Headers() })
    requirePublicArchiveReviewer.mockResolvedValue({ ok: true })
    approvePublicEventDraft.mockResolvedValue({ id: 'event-1', status: 'approved' })
    rejectPublicEventDraft.mockResolvedValue({ id: 'event-1', status: 'rejected' })
    markPublicEventNeedsReprocessing.mockResolvedValue({ id: 'event-1', status: 'needs_reprocessing' })
    createPublicArchiveAuditEvent.mockResolvedValue({ id: 'audit-1' })
  })

  it('approves a draft event', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/public-archive/reviewer/event-drafts/event-1/review', {
        method: 'POST',
        body: JSON.stringify({ action: 'approve' }),
      }),
      { params: Promise.resolve({ eventId: 'event-1' }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ event: { id: 'event-1', status: 'approved' } })
    expect(approvePublicEventDraft).toHaveBeenCalledWith('event-1', 'reviewer-1')
    expect(createPublicArchiveAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'review_approved' }))
  })
})
```

Create `packages/web/src/app/api/public-archive/events/approved/__tests__/route.test.ts`:

```ts
/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET } from '../route'

const getAuthenticatedUser = jest.fn()
const getApprovedEventSummariesForContributor = jest.fn()

jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUser(...args) }))
jest.mock('@/lib/server/public-archive-store', () => ({
  getApprovedEventSummariesForContributor: (...args: unknown[]) => getApprovedEventSummariesForContributor(...args),
}))

describe('/api/public-archive/events/approved', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'user-1' }, headers: new Headers() })
    getApprovedEventSummariesForContributor.mockResolvedValue([
      { id: 'event-1', eventLabel: '1976 Guangzhou memories', activeContributionCount: 2 },
    ])
  })

  it('returns approved summaries for the authenticated contributor', async () => {
    const response = await GET(new NextRequest('http://localhost/api/public-archive/events/approved'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      events: [{ id: 'event-1', eventLabel: '1976 Guangzhou memories', activeContributionCount: 2 }],
    })
    expect(getApprovedEventSummariesForContributor).toHaveBeenCalledWith('user-1')
  })
})
```

Use the same mocking style as `packages/web/src/app/api/agents/editor/process-story/__tests__/route.test.ts`.

Example assertion for the process route:

```ts
expect(createAgentRun).toHaveBeenCalledWith(expect.objectContaining({
  agentType: 'wiki_editor',
  projectId: null,
  storyId: null,
  interviewSessionId: null,
  model: 'deterministic-wiki-editor-agent',
}))
expect(createAgentArtifact).toHaveBeenCalledWith(expect.objectContaining({
  artifactType: 'wiki_event_draft',
}))
```

- [ ] **Step 3: Run Wiki/reviewer route tests to verify they fail**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/app/api/agents/wiki/process-contribution/__tests__/route.test.ts packages/web/src/app/api/public-archive/reviewer/event-drafts/__tests__/route.test.ts packages/web/src/app/api/public-archive/reviewer/event-drafts/[eventId]/review/__tests__/route.test.ts packages/web/src/app/api/public-archive/events/approved/__tests__/route.test.ts
```

Expected: FAIL because routes do not exist.

- [ ] **Step 4: Implement Wiki runner and process route**

Create `packages/web/src/lib/server/public-archive-wiki-runner.ts`:

```ts
import { processWikiEventDraft } from '@/lib/public-archive/wiki-editor-agent'
import {
  completeAgentRun,
  createAgentArtifact,
  createAgentRun,
  failAgentRun,
} from '@/lib/server/agent-store'
import {
  createOrUpdatePublicEventCluster,
  createPublicArchiveAuditEvent,
  getActiveContributionWithElementsForWiki,
  linkPublicEventContributions,
  updateContributionWikiStatus,
} from '@/lib/server/public-archive-store'

export async function processPublicContributionWithWikiAgent(input: {
  contributionId: string
  actorUserId: string
}) {
  let runId: string | null = null
  try {
    const run = await createAgentRun({
      agentType: 'wiki_editor',
      projectId: null,
      storyId: null,
      interviewSessionId: null,
      createdBy: input.actorUserId,
      input: { contributionId: input.contributionId },
      contentHash: input.contributionId,
      model: 'deterministic-wiki-editor-agent',
    })
    runId = String(run.id)
    const contribution = await getActiveContributionWithElementsForWiki(input.contributionId)
    const wikiOutput = processWikiEventDraft({
      existingClusters: [],
      contributions: [contribution],
    })
    const eventCluster = await createOrUpdatePublicEventCluster(wikiOutput)
    await linkPublicEventContributions(String(eventCluster.id), wikiOutput.activeContributionIds)
    await createAgentArtifact({
      agentRunId: runId,
      projectId: '',
      storyId: null,
      artifactType: wikiOutput.status === 'draft' ? 'wiki_event_draft' : 'wiki_event_candidate',
      payload: wikiOutput,
      sourceRefs: wikiOutput.activeContributionIds.map(id => ({ source_type: 'story', source_id: id })),
      confidence: wikiOutput.confidence,
    })
    await updateContributionWikiStatus(input.contributionId, 'processed')
    await createPublicArchiveAuditEvent({
      eventType: 'wiki_processed',
      actorUserId: input.actorUserId,
      publicContributionId: input.contributionId,
      publicEventClusterId: String(eventCluster.id),
      consentCopyVersion: null,
      metadata: { status: wikiOutput.status },
    })
    await completeAgentRun(runId, { eventClusterId: String(eventCluster.id), status: wikiOutput.status })
    return { eventClusterId: String(eventCluster.id), status: wikiOutput.status }
  } catch (error) {
    await updateContributionWikiStatus(input.contributionId, 'failed')
    if (runId) await failAgentRun(runId, error instanceof Error ? error.message : 'Wiki processing failed')
    throw error
  }
}
```

Implement `packages/web/src/app/api/agents/wiki/process-contribution/route.ts`:

1. Authenticate.
2. Parse `{ contributionId }`.
3. Call `processPublicContributionWithWikiAgent({ contributionId, actorUserId: auth.user.id })`.
4. Return `{ processed: true, result }`.

- [ ] **Step 5: Implement reviewer and approved event routes**

Implement:

- `GET /api/public-archive/reviewer/event-drafts`
  - Authenticate.
  - `requirePublicArchiveReviewer`.
  - Return `listReviewerEventDrafts()`.
- `POST /api/public-archive/reviewer/event-drafts/[eventId]/review`
  - Authenticate.
  - `requirePublicArchiveReviewer`.
  - Parse action.
  - Call approve/reject/needs-reprocessing store helper.
  - Create audit event `review_approved` or `review_rejected`.
- `GET /api/public-archive/events/approved`
  - Authenticate.
  - Return `getApprovedEventSummariesForContributor(auth.user.id)`.

Update `packages/web/src/app/api/stories/[storyId]/public-archive/route.ts` after successful commit:

```ts
void processPublicContributionWithWikiAgent({
  contributionId: String(contribution.id),
  actorUserId: auth.user.id,
}).catch(error => {
  console.error('Failed to process public contribution with Wiki Editor Agent', error)
})
```

Update the commit route test to assert `processPublicContributionWithWikiAgent` is called after contribution creation.

- [ ] **Step 6: Run Wiki/reviewer tests**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/lib/server/__tests__/public-archive-wiki-runner.test.ts packages/web/src/app/api/agents/wiki/process-contribution/__tests__/route.test.ts packages/web/src/app/api/public-archive/reviewer/event-drafts/__tests__/route.test.ts packages/web/src/app/api/public-archive/reviewer/event-drafts/[eventId]/review/__tests__/route.test.ts packages/web/src/app/api/public-archive/events/approved/__tests__/route.test.ts packages/web/src/lib/server/__tests__/public-archive-store.test.ts packages/web/src/app/api/stories/[storyId]/public-archive/__tests__/route.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Wiki/reviewer APIs**

```bash
git add packages/web/src/lib/server/public-archive-wiki-runner.ts packages/web/src/lib/server/__tests__/public-archive-wiki-runner.test.ts packages/web/src/app/api/agents/wiki packages/web/src/app/api/public-archive packages/web/src/lib/server/public-archive-store.ts packages/web/src/lib/server/__tests__/public-archive-store.test.ts packages/web/src/app/api/stories/[storyId]/public-archive/route.ts packages/web/src/app/api/stories/[storyId]/public-archive/__tests__/route.test.ts
git commit -m "feat: add wiki editor public archive api"
```

### Task 10: Client Service And Story Detail Public Archive Panel

**Files:**
- Create: `packages/web/src/lib/public-archive-service.ts`
- Create: `packages/web/src/components/stories/PublicArchivePanel.tsx`
- Create: `packages/web/src/components/stories/__tests__/public-archive-panel.test.tsx`
- Modify: `packages/web/src/app/[locale]/dashboard/projects/[id]/stories/[storyId]/page.tsx`

- [ ] **Step 1: Write failing component tests**

Create `packages/web/src/components/stories/__tests__/public-archive-panel.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PublicArchivePanel } from '../PublicArchivePanel'

describe('PublicArchivePanel', () => {
  it('shows storyteller contribution action and preview confirmation', async () => {
    const onGeneratePreview = jest.fn().mockResolvedValue({
      previewId: 'preview-1',
      anonymizedTitle: 'A market memory',
      anonymizedText: 'An anonymized story.',
      anonymizedSummary: 'Summary.',
      elements: [{ elementType: 'time', value: '1976', normalizedValue: '1976', sourceQuote: '1976', confidence: 0.9 }],
      excludedDataTypes: ['voice', 'audio', 'photos', 'media_derivatives', 'exact_identity'],
    })
    const onCommit = jest.fn().mockResolvedValue({ id: 'contribution-1' })

    render(
      <PublicArchivePanel
        storyId="story-1"
        userRole="storyteller"
        isStoryteller
        contribution={null}
        approvedEvents={[]}
        onGeneratePreview={onGeneratePreview}
        onCommit={onCommit}
        onInvite={jest.fn()}
        onWithdraw={jest.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Anonymously add this story to the Collective Archive' }))

    await waitFor(() => expect(screen.getByText('An anonymized story.')).toBeInTheDocument())
    expect(screen.getByText('Not included: voice, audio, photos, generated media, exact identity')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Join Collective Archive' }))
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith('preview-1'))
  })

  it('shows facilitator invitation action without consent controls', async () => {
    const onInvite = jest.fn().mockResolvedValue({ id: 'invitation-1' })

    render(
      <PublicArchivePanel
        storyId="story-1"
        userRole="facilitator"
        isStoryteller={false}
        contribution={null}
        approvedEvents={[]}
        onGeneratePreview={jest.fn()}
        onCommit={jest.fn()}
        onInvite={onInvite}
        onWithdraw={jest.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Join Collective Archive' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Invite storyteller to contribute' }))
    await waitFor(() => expect(onInvite).toHaveBeenCalled())
  })

  it('shows committed contribution and withdrawal action', async () => {
    const onWithdraw = jest.fn().mockResolvedValue(undefined)

    render(
      <PublicArchivePanel
        storyId="story-1"
        userRole="storyteller"
        isStoryteller
        contribution={{ id: 'contribution-1', status: 'active', anonymized_text: 'Anonymized text', wiki_status: 'pending' }}
        approvedEvents={[]}
        onGeneratePreview={jest.fn()}
        onCommit={jest.fn()}
        onInvite={jest.fn()}
        onWithdraw={onWithdraw}
      />,
    )

    expect(screen.getByText('Anonymized text')).toBeInTheDocument()
    expect(screen.getByText('Wiki summary pending review')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw contribution' }))
    await waitFor(() => expect(onWithdraw).toHaveBeenCalledWith('contribution-1'))
  })
})
```

- [ ] **Step 2: Run component tests to verify they fail**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/components/stories/__tests__/public-archive-panel.test.tsx
```

Expected: FAIL because `PublicArchivePanel` does not exist.

- [ ] **Step 3: Implement client service**

Create `packages/web/src/lib/public-archive-service.ts`:

```ts
import type { PublicArchiveContributionPreview, PublicArchiveApprovedEventSummary } from '@saga/shared/types/public-archive'
import { useAuthStore } from '@/stores/auth-store'

export interface PublicArchiveContributionStatus {
  id: string
  status: string
  wiki_status: string
  anonymized_text: string
}

export const publicArchiveService = {
  async generatePreview(storyId: string): Promise<PublicArchiveContributionPreview> {
    const response = await fetch(`/api/stories/${encodeURIComponent(storyId)}/public-archive/preview`, {
      method: 'POST',
      headers: await jsonHeaders(),
    })
    if (!response.ok) throw new Error('Failed to generate public archive preview')
    const data = await response.json()
    return data.preview
  },

  async getContributionStatus(storyId: string): Promise<PublicArchiveContributionStatus | null> {
    const response = await fetch(`/api/stories/${encodeURIComponent(storyId)}/public-archive`, {
      headers: await authHeaders(),
    })
    if (!response.ok) throw new Error('Failed to load public archive status')
    const data = await response.json()
    return data.contribution || null
  },

  async commitContribution(storyId: string, previewId: string) {
    const response = await fetch(`/api/stories/${encodeURIComponent(storyId)}/public-archive`, {
      method: 'POST',
      headers: await jsonHeaders(),
      body: JSON.stringify({ previewId }),
    })
    if (!response.ok) throw new Error('Failed to commit public archive contribution')
    return response.json()
  },

  async inviteStoryteller(storyId: string) {
    const response = await fetch(`/api/stories/${encodeURIComponent(storyId)}/public-archive/invitations`, {
      method: 'POST',
      headers: await jsonHeaders(),
      body: JSON.stringify({ message: 'This story may help others feel less alone.' }),
    })
    if (!response.ok) throw new Error('Failed to invite storyteller')
    return response.json()
  },

  async withdrawContribution(contributionId: string) {
    const response = await fetch(`/api/public-archive/contributions/${encodeURIComponent(contributionId)}/withdraw`, {
      method: 'POST',
      headers: await authHeaders(),
    })
    if (!response.ok) throw new Error('Failed to withdraw contribution')
    return response.json()
  },

  async getApprovedEvents(): Promise<PublicArchiveApprovedEventSummary[]> {
    const response = await fetch('/api/public-archive/events/approved', {
      headers: await authHeaders(),
    })
    if (!response.ok) throw new Error('Failed to load approved public archive events')
    const data = await response.json()
    return data.events || []
  },
}

async function jsonHeaders() {
  return { ...(await authHeaders()), 'Content-Type': 'application/json' }
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await useAuthStore.getState().getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
```

- [ ] **Step 4: Implement PublicArchivePanel**

Create `packages/web/src/components/stories/PublicArchivePanel.tsx`:

```tsx
import { useState } from 'react'
import type { PublicArchiveApprovedEventSummary, PublicArchiveContributionPreview } from '@saga/shared/types/public-archive'
import { Badge } from '@/components/ui/badge'
import { EnhancedButton } from '@/components/ui/enhanced-button'
import { EnhancedCard, EnhancedCardContent, EnhancedCardHeader, EnhancedCardTitle } from '@/components/ui/enhanced-card'

interface ContributionStatus {
  id: string
  status: string
  wiki_status: string
  anonymized_text: string
}

export function PublicArchivePanel(props: {
  storyId: string
  userRole: 'facilitator' | 'storyteller' | null
  isStoryteller: boolean
  contribution: ContributionStatus | null
  approvedEvents: PublicArchiveApprovedEventSummary[]
  onGeneratePreview: () => Promise<PublicArchiveContributionPreview>
  onCommit: (previewId: string) => Promise<unknown>
  onInvite: () => Promise<unknown>
  onWithdraw: (contributionId: string) => Promise<unknown>
}) {
  const [preview, setPreview] = useState<PublicArchiveContributionPreview | null>(null)
  const [busy, setBusy] = useState(false)

  async function run<T>(operation: () => Promise<T>) {
    setBusy(true)
    try {
      return await operation()
    } finally {
      setBusy(false)
    }
  }

  if (props.contribution?.status === 'active') {
    return (
      <EnhancedCard>
        <EnhancedCardHeader>
          <EnhancedCardTitle>My Public Contribution</EnhancedCardTitle>
        </EnhancedCardHeader>
        <EnhancedCardContent className="space-y-4">
          <Badge variant="outline">Anonymized contribution</Badge>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{props.contribution.anonymized_text}</p>
          {props.approvedEvents.length === 0 ? (
            <p className="text-sm text-gray-500">Wiki summary pending review</p>
          ) : (
            props.approvedEvents.map(event => (
              <section key={event.id} className="rounded-lg border border-sage-200 bg-white p-4">
                <h3 className="font-semibold text-gray-900">{event.eventLabel}</h3>
                <p className="text-sm text-gray-600">{event.perspectiveSummary}</p>
              </section>
            ))
          )}
          <EnhancedButton variant="outline" disabled={busy} onClick={() => run(() => props.onWithdraw(props.contribution!.id))}>
            Withdraw contribution
          </EnhancedButton>
        </EnhancedCardContent>
      </EnhancedCard>
    )
  }

  return (
    <EnhancedCard>
      <EnhancedCardHeader>
        <EnhancedCardTitle>Collective Archive</EnhancedCardTitle>
      </EnhancedCardHeader>
      <EnhancedCardContent className="space-y-4">
        {props.isStoryteller ? (
          <>
            <p className="text-sm text-gray-600">Contribute an anonymized text and structured elements snapshot. Audio, photos, generated media, and exact identity are excluded.</p>
            {!preview && (
              <EnhancedButton disabled={busy} onClick={() => run(async () => setPreview(await props.onGeneratePreview()))}>
                Anonymously add this story to the Collective Archive
              </EnhancedButton>
            )}
            {preview && (
              <section className="space-y-3 rounded-lg border border-sage-200 bg-white p-4">
                <h3 className="font-semibold text-gray-900">{preview.anonymizedTitle}</h3>
                <p className="whitespace-pre-wrap text-sm text-gray-700">{preview.anonymizedText}</p>
                <p className="text-xs text-gray-500">Not included: voice, audio, photos, generated media, exact identity</p>
                <EnhancedButton disabled={busy} onClick={() => run(() => props.onCommit(preview.previewId))}>
                  Join Collective Archive
                </EnhancedButton>
              </section>
            )}
          </>
        ) : props.userRole === 'facilitator' ? (
          <EnhancedButton disabled={busy} onClick={() => run(props.onInvite)}>
            Invite storyteller to contribute
          </EnhancedButton>
        ) : null}
      </EnhancedCardContent>
    </EnhancedCard>
  )
}
```

- [ ] **Step 5: Run component tests**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/components/stories/__tests__/public-archive-panel.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Wire panel into story detail page**

Modify `packages/web/src/app/[locale]/dashboard/projects/[id]/stories/[storyId]/page.tsx`:

1. Add imports:

```ts
import { PublicArchivePanel } from '@/components/stories/PublicArchivePanel'
import { publicArchiveService, type PublicArchiveContributionStatus } from '@/lib/public-archive-service'
import type { PublicArchiveApprovedEventSummary } from '@saga/shared/types/public-archive'
```

2. Add state:

```ts
const [publicContribution, setPublicContribution] = useState<PublicArchiveContributionStatus | null>(null)
const [approvedPublicEvents, setApprovedPublicEvents] = useState<PublicArchiveApprovedEventSummary[]>([])
```

3. In `loadStory`, after agent artifacts load, call:

```ts
try {
  const [contribution, events] = await Promise.all([
    publicArchiveService.getContributionStatus(storyId),
    publicArchiveService.getApprovedEvents(),
  ])
  setPublicContribution(contribution)
  setApprovedPublicEvents(events)
} catch (error) {
  console.warn('[story/page] failed to load public archive status:', error)
  setPublicContribution(null)
  setApprovedPublicEvents([])
}
```

4. Render below `AgentArtifactsPanel`:

```tsx
<PublicArchivePanel
  storyId={storyId}
  userRole={userRole}
  isStoryteller={story.storyteller_id === user?.id}
  contribution={publicContribution}
  approvedEvents={approvedPublicEvents}
  onGeneratePreview={() => publicArchiveService.generatePreview(storyId)}
  onCommit={async (previewId) => {
    await publicArchiveService.commitContribution(storyId, previewId)
    setPublicContribution(await publicArchiveService.getContributionStatus(storyId))
    setApprovedPublicEvents(await publicArchiveService.getApprovedEvents())
  }}
  onInvite={() => publicArchiveService.inviteStoryteller(storyId)}
  onWithdraw={async (contributionId) => {
    await publicArchiveService.withdrawContribution(contributionId)
    setPublicContribution(await publicArchiveService.getContributionStatus(storyId))
    setApprovedPublicEvents(await publicArchiveService.getApprovedEvents())
  }}
/>
```

- [ ] **Step 7: Run story page type check and focused UI test**

Run:

```bash
npm test --workspace=packages/web -- --runInBand packages/web/src/components/stories/__tests__/public-archive-panel.test.tsx
npm run type-check --workspace=packages/web
```

Expected: PASS.

- [ ] **Step 8: Commit client UI**

```bash
git add packages/web/src/lib/public-archive-service.ts packages/web/src/components/stories/PublicArchivePanel.tsx packages/web/src/components/stories/__tests__/public-archive-panel.test.tsx 'packages/web/src/app/[locale]/dashboard/projects/[id]/stories/[storyId]/page.tsx'
git commit -m "feat: add public archive story panel"
```

### Task 11: Final Verification And Scope Guard

**Files:**
- No new feature files.
- Update tests only if a previous task left an intentional compile/test mismatch.

- [ ] **Step 1: Verify Phase 2 scope does not include Media Agent**

Run:

```bash
rg "media_jobs|Media Agent|photo restoration|video generation|story-to-video|photo-to-video" packages/web packages/shared
```

Expected: no matches except existing product copy or spec/plan files outside `packages/web` and `packages/shared`.

- [ ] **Step 2: Verify public archive tables and routes are present**

Run:

```bash
rg "public_contributions|public_event_clusters|public_contribution_invitations|wiki_editor" packages/web packages/shared
```

Expected: matches in shared types, SQL, public archive server/client code, Wiki routes, and tests.

- [ ] **Step 3: Run shared checks**

Run:

```bash
npm run type-check --workspace=packages/shared
npm run lint --workspace=packages/shared
npm test --workspace=packages/shared -- --runInBand
```

Expected: PASS.

- [ ] **Step 4: Run web checks**

Run:

```bash
npm run type-check --workspace=packages/web
npm run lint --workspace=packages/web
npm test --workspace=packages/web -- --runInBand
```

Expected: PASS.

- [ ] **Step 5: Run production build**

Run:

```bash
npm run build:vercel
```

Expected: build exits 0. Existing non-blocking warnings may remain: unsupported Next config `eslint`, deprecated `images.domains`, workspace root inference, middleware convention, or missing local Supabase service role during page data collection.

- [ ] **Step 6: Commit final verification changes when verification changes files**

When verification required code or test changes:

```bash
git add <changed-files>
git commit -m "fix: complete public archive phase two verification"
```

When verification required no changes, do not create an empty commit.

---

## Implementation Notes

1. Public archive contribution must never use `stories.is_public` as source of truth.
2. `preview` may read private story data; committed Wiki processing must only read public contribution tables.
3. Facilitator invitation is not consent and must not create `public_contributions`.
4. Withdrawal must remove active visibility and future Wiki input influence.
5. Reviewer APIs must use `platform_roles`, not project roles.
6. Keep all new tables RLS-enabled and direct `anon`/broad `authenticated` access revoked.
7. Run focused tests after each task and commit frequently.

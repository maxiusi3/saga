/**
 * @jest-environment node
 */

import { readFileSync } from 'fs'
import { join } from 'path'

describe('agent-phase2-public-archive.sql', () => {
  const sqlPath = join(process.cwd(), 'supabase/agent-phase2-public-archive.sql')
  const sql = readFileSync(sqlPath, 'utf8')
  const normalizedSql = sql.replace(/\s+/g, ' ').toLowerCase()
  const phase2Tables = [
    'platform_roles',
    'public_contribution_invitations',
    'public_contributions',
    'public_contribution_elements',
    'public_event_clusters',
    'public_event_contributions',
    'public_archive_audit_events',
  ]

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
    const revokeBlock = normalizedSql.match(/revoke all on table (.*?) from anon, authenticated;/)?.[1]

    expect(revokeBlock).toBeDefined()
    for (const table of phase2Tables) {
      expect(sql).toContain(`alter table public.${table} enable row level security`)
      expect(revokeBlock).toContain(`public.${table}`)
    }

    expect(normalizedSql).toContain('revoke all on table')
  })

  it('extends Phase 1 agent constraints for Wiki Editor artifacts', () => {
    expect(sql).toContain("'wiki_editor'")
    expect(sql).toContain("'anonymized_contribution_preview'")
    expect(sql).toContain("'wiki_event_candidate'")
    expect(sql).toContain("'wiki_event_draft'")
  })

  it('keeps public contribution source references from cascading deletes', () => {
    expect(normalizedSql).toContain(
      'source_project_id uuid not null references public.projects(id) on delete restrict',
    )
    expect(normalizedSql).toContain(
      'source_story_id uuid not null references public.stories(id) on delete restrict',
    )
    expect(normalizedSql).toContain(
      'source_user_id uuid not null references auth.users(id) on delete restrict',
    )
  })

  it('replaces existing public contribution source foreign keys with restrict constraints', () => {
    expect(normalizedSql).toContain(
      'alter table public.public_contributions drop constraint if exists public_contributions_source_project_id_fkey',
    )
    expect(normalizedSql).toContain(
      'alter table public.public_contributions drop constraint if exists public_contributions_source_story_id_fkey',
    )
    expect(normalizedSql).toContain(
      'alter table public.public_contributions drop constraint if exists public_contributions_source_user_id_fkey',
    )
    expect(normalizedSql).toContain(
      'alter table public.public_contributions drop constraint if exists public_contributions_source_project_fk',
    )
    expect(normalizedSql).toContain(
      'alter table public.public_contributions drop constraint if exists public_contributions_source_story_fk',
    )
    expect(normalizedSql).toContain(
      'alter table public.public_contributions drop constraint if exists public_contributions_source_user_fk',
    )
    expect(normalizedSql).toContain(
      'add constraint public_contributions_source_project_fk foreign key (source_project_id) references public.projects(id) on delete restrict',
    )
    expect(normalizedSql).toContain(
      'add constraint public_contributions_source_story_fk foreign key (source_story_id) references public.stories(id) on delete restrict',
    )
    expect(normalizedSql).toContain(
      'add constraint public_contributions_source_user_fk foreign key (source_user_id) references auth.users(id) on delete restrict',
    )
  })

  it('creates required indexes for reviewer and event contribution lookups', () => {
    expect(normalizedSql).toContain(
      'create unique index if not exists idx_platform_roles_active_reviewer_unique on public.platform_roles(user_id) where role = \'public_archive_reviewer\' and revoked_at is null',
    )
    expect(normalizedSql).toContain(
      'create index if not exists idx_public_contributions_story_user on public.public_contributions(source_story_id, source_user_id)',
    )
    expect(normalizedSql).toContain(
      'create index if not exists idx_public_contributions_active_wiki on public.public_contributions(status, wiki_status)',
    )
    expect(normalizedSql).toContain(
      'create index if not exists idx_public_contribution_elements_contribution on public.public_contribution_elements(public_contribution_id)',
    )
    expect(normalizedSql).toContain(
      'create index if not exists idx_public_event_contributions_cluster on public.public_event_contributions(public_event_cluster_id)',
    )
    expect(normalizedSql).toContain(
      'create index if not exists idx_public_event_contributions_contribution on public.public_event_contributions(public_contribution_id)',
    )
    expect(normalizedSql).toContain(
      'create unique index if not exists idx_public_event_contributions_active_unique on public.public_event_contributions(public_event_cluster_id, public_contribution_id) where removed_at is null',
    )
    expect(normalizedSql).toContain(
      'create index if not exists idx_public_archive_audit_contribution on public.public_archive_audit_events(public_contribution_id)',
    )
  })

  it('creates updated_at triggers for mutable public archive tables', () => {
    expect(normalizedSql).toContain('create or replace function public.set_public_archive_updated_at()')
    expect(normalizedSql).toContain('create trigger set_public_contribution_elements_updated_at')
    expect(normalizedSql).toContain('before update on public.public_contribution_elements')
    expect(normalizedSql).toContain('create trigger set_public_event_clusters_updated_at')
    expect(normalizedSql).toContain('before update on public.public_event_clusters')
  })
})

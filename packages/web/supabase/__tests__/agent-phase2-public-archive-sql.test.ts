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

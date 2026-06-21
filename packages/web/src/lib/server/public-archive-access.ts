import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase'
import { requireProjectAccess } from '@/lib/server/project-access'

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

  // Authorize through the shared project-access helper so facilitators AND active
  // project members (project_roles) are honored consistently with the rest of the app.
  const access = await requireProjectAccess(story.project_id, user)
  if (!access.ok) return { ok: false as const, response: access.response }
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

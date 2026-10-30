import type { User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { getSupabaseAdmin } from '@/lib/supabase'
import { requireProjectAccess, type ProjectAccessResult } from './project-access'

const pinnedFields = ['id', 'project_id', 'bucket', 'object_key', 'kind', 'state', 'version'] as const

function deny(error: string, status: number): ProjectAccessResult {
  return { ok: false, response: NextResponse.json({ error }, { status }) }
}

/** Revalidate after external waits. This is not an atomic DB/Storage revocation barrier. */
export async function requireCurrentMediaAsset(
  admin: ReturnType<typeof getSupabaseAdmin>,
  user: User,
  expected: Record<string, unknown>,
  eligibleStates: readonly string[],
): Promise<ProjectAccessResult> {
  try {
    if (typeof expected.project_id !== 'string' || !expected.project_id) return deny('Invalid asset identity', 500)
    const access = await requireProjectAccess(expected.project_id, user)
    if (!access.ok) return access

    const { data: current, error } = await admin.from('media_assets')
      .select('*').eq('id', expected.id).maybeSingle()
    if (error) return deny('Failed to load asset', 500)
    if (!current) return deny('Asset not found', 404)
    if (['id', 'project_id', 'bucket', 'object_key', 'kind', 'state'].some(field => typeof current[field] !== 'string' || !current[field]) ||
        !Number.isInteger(current.version) || current.version < 1 ||
        (current.story_id != null && (typeof current.story_id !== 'string' || !current.story_id))) {
      return deny('Invalid asset identity', 500)
    }
    if (pinnedFields.some(field => current[field] !== expected[field]) ||
        (current.story_id ?? null) !== (expected.story_id ?? null) ||
        current.tombstone_at != null || !eligibleStates.includes(current.state)) {
      return deny('Asset changed or is no longer eligible', 409)
    }

    // The shipped asset table has no tombstone_at column: select('*') tolerates
    // optional evidence, while deletion_requests is the authoritative ledger.
    // Keep this the final await; callers must publish synchronously on success.
    const subjects = [expected.id, expected.story_id].filter((id): id is string => typeof id === 'string')
    const { data: tombstones, error: deletionError } = await admin.from('deletion_requests')
      .select('subject_id, tombstone_at').eq('project_id', expected.project_id)
      .in('subject_id', subjects).not('tombstone_at', 'is', null)
    if (deletionError || !Array.isArray(tombstones)) return deny('Failed to verify deletion status', 500)
    if (tombstones.length) return deny('Asset or story is being deleted', 409)
    return { ok: true }
  } catch {
    return deny('Unable to verify current asset access', 500)
  }
}

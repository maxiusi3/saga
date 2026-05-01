import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase'

interface ProjectAccessRow {
  id: string
  facilitator_id: string
}

export type ProjectAccessResult =
  | { ok: true }
  | { ok: false; response: NextResponse }

export async function requireProjectAccess(projectId: string, user: User): Promise<ProjectAccessResult> {
  let db: ReturnType<typeof getSupabaseAdmin>
  try {
    db = getSupabaseAdmin()
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Database service not configured' }, { status: 503 }),
    }
  }

  const { data: project, error: projectError } = await db
    .from('projects')
    .select('id, facilitator_id')
    .eq('id', projectId)
    .maybeSingle()

  if (projectError) {
    console.error('Failed to load project for access check', projectError)
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unable to verify project access' }, { status: 500 }),
    }
  }

  if (!project) {
    return { ok: false, response: NextResponse.json({ error: 'Project not found' }, { status: 404 }) }
  }

  const projectRow = project as ProjectAccessRow

  if (projectRow.facilitator_id === user.id) {
    return { ok: true }
  }

  const { data: role, error: roleError } = await db
    .from('project_roles')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (roleError) {
    console.error('Failed to load project role for access check', roleError)
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unable to verify project access' }, { status: 500 }),
    }
  }

  if (!role) {
    return { ok: false, response: NextResponse.json({ error: 'Access denied' }, { status: 403 }) }
  }

  return { ok: true }
}

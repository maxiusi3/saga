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
  const db = getSupabaseAdmin()

  const { data: project, error: projectError } = await db
    .from('projects')
    .select('id, facilitator_id')
    .eq('id', projectId)
    .maybeSingle()

  if (projectError || !project) {
    return { ok: false, response: NextResponse.json({ error: 'Project not found' }, { status: 404 }) }
  }

  const projectRow = project as ProjectAccessRow

  if (projectRow.facilitator_id === user.id) {
    return { ok: true }
  }

  const { data: role } = await db
    .from('project_roles')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!role) {
    return { ok: false, response: NextResponse.json({ error: 'Access denied' }, { status: 403 }) }
  }

  return { ok: true }
}

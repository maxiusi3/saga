import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedClient } from '@/lib/server/authenticated-client'

// 返回单个项目的概览（成员列表与故事计数），避免前端多次直连
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const projectId = (await params).id
    const auth = await getAuthenticatedClient(request)
    if (!auth.ok) {
      return auth.response
    }
    const { user } = auth
    const db: any = auth.client

    const { data: project, error: projectError } = await db
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      if (projectError) {
        console.error('GET /api/projects/[id]/overview project error:', projectError)
      }
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // 权限：所有者或 active 成员
    const isOwner = project.facilitator_id === user.id
    let userRole = isOwner ? 'facilitator' : undefined

    if (!isOwner) {
      const { data: role, error: roleError } = await db
        .from('project_roles')
        .select('id, role')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      if (roleError) {
        console.error('GET /api/projects/[id]/overview role error:', roleError)
        return NextResponse.json({ error: 'Unable to verify project access' }, { status: 500 })
      }
      if (!role) return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      userRole = role.role
    }

    const { data: members, error: membersError } = await db
      .from('project_roles')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'active')

    if (membersError) {
      console.error('GET /api/projects/[id]/overview members error:', membersError)
    }

    const { count: storyCount, error: storyCountError } = await db
      .from('stories')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)

    if (storyCountError) {
      console.error('GET /api/projects/[id]/overview story count error:', storyCountError)
    }

    return NextResponse.json({
      project: {
        ...project,
        user_role: userRole,
        is_owner: isOwner,
      },
      members: members || [],
      storyCount: storyCount || 0,
    })
  } catch (err) {
    console.error('GET /api/projects/[id]/overview unexpected error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

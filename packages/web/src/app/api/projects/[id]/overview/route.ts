import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'

// 返回单个项目的概览（成员列表与故事计数），避免前端多次直连
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseCookie = createRouteHandlerClient({ cookies })
    const projectId = params.id

    // Cookies 优先，Bearer 回退
    let user: any = null
    let db: any = supabaseCookie

    const cookieAuth = await supabaseCookie.auth.getUser()
    if (cookieAuth.data.user && !cookieAuth.error) {
      user = cookieAuth.data.user
    } else {
      const token = request.headers.get('authorization')?.replace('Bearer ', '')
      if (token) {
        const admin = getSupabaseAdmin()
        const { data: tokenUser, error: tokenErr } = await admin.auth.getUser(token)
        if (tokenUser?.user && !tokenErr) {
          user = tokenUser.user
          db = admin
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: project, error: projectError } = await db
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // 权限：所有者或 active 成员
    if (project.facilitator_id !== user.id) {
      const { data: role } = await db
        .from('project_roles')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()
      if (!role) return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { data: members } = await db
      .from('project_roles')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'active')

    const { count: storyCount } = await db
      .from('stories')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)

    return NextResponse.json({ project, members: members || [], storyCount: storyCount || 0 })
  } catch (err) {
    console.error('GET /api/projects/[id]/overview unexpected error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}


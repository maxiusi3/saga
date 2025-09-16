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

    // 详细的认证调试
    let user: any = null
    const db = getSupabaseAdmin() // 统一使用admin客户端

    console.log('[Overview API] Starting auth check for project:', projectId)

    // 尝试Cookie认证
    const cookieAuth = await supabaseCookie.auth.getUser()
    console.log('[Overview API] Cookie auth result:', {
      hasUser: !!cookieAuth.data.user,
      error: cookieAuth.error?.message,
      userId: cookieAuth.data.user?.id
    })

    if (cookieAuth.data.user && !cookieAuth.error) {
      user = cookieAuth.data.user
      console.log('[Overview API] Using cookie auth for user:', user.id)
    } else {
      // 尝试Bearer token认证
      const token = request.headers.get('authorization')?.replace('Bearer ', '')
      console.log('[Overview API] Trying bearer token auth, hasToken:', !!token)

      if (token) {
        const admin = getSupabaseAdmin()
        const { data: tokenUser, error: tokenErr } = await admin.auth.getUser(token)
        console.log('[Overview API] Bearer auth result:', {
          hasUser: !!tokenUser?.user,
          error: tokenErr?.message,
          userId: tokenUser?.user?.id
        })

        if (tokenUser?.user && !tokenErr) {
          user = tokenUser.user
          console.log('[Overview API] Using bearer auth for user:', user.id)
        }
      }
    }

    if (!user) {
      console.log('[Overview API] No valid authentication found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Overview API] Authenticated user:', user.id)

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


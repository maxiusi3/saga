import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'

// 通过 id 列表批量获取项目（校验为成员或所有者）
export async function POST(request: NextRequest) {
  try {
    const supabaseCookie = createRouteHandlerClient({ cookies })
    const body = await request.json().catch(() => ({})) as { ids?: string[] }
    const ids = Array.isArray(body.ids) ? body.ids : []

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

    if (!ids.length) {
      return NextResponse.json({ projects: [] })
    }

    // 基础查询
    const { data: projects, error } = await db
      .from('projects')
      .select('*')
      .in('id', ids)

    if (error) {
      console.error('POST /api/projects/by-ids error:', error)
      return NextResponse.json({ projects: [] })
    }

    // 过滤：仅返回用户有访问权限的项目
    const result = [] as any[]
    for (const p of projects || []) {
      if (p.facilitator_id === user.id) {
        result.push(p)
        continue
      }
      const { data: role } = await db
        .from('project_roles')
        .select('id')
        .eq('project_id', p.id)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()
      if (role) result.push(p)
    }

    return NextResponse.json({ projects: result })
  } catch (err) {
    console.error('POST /api/projects/by-ids unexpected error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}


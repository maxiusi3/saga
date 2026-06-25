import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedClient } from '@/lib/server/authenticated-client'

// 通过 id 列表批量获取项目（校验为成员或所有者）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { ids?: string[] }
    const ids = Array.isArray(body.ids) ? body.ids : []

    const auth = await getAuthenticatedClient(request)
    if (!auth.ok) {
      return auth.response
    }
    const { user } = auth
    const db: any = auth.client

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

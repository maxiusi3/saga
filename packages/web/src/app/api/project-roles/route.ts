import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedClient } from '@/lib/server/authenticated-client'

// 返回当前用户的有效项目成员角色（active）
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedClient(request)
    if (!auth.ok) {
      return auth.response
    }
    const { user } = auth
    const db: any = auth.client

    const { data: roles, error } = await db
      .from('project_roles')
      .select('project_id, role, status')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (error) {
      console.error('GET /api/project-roles error:', error)
      return NextResponse.json({ roles: [] })
    }

    return NextResponse.json({ roles: roles || [] })
  } catch (err) {
    console.error('GET /api/project-roles unexpected error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

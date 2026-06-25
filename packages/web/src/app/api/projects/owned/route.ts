import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedClient } from '@/lib/server/authenticated-client'

// 返回当前用户作为所有者（facilitator_id = user.id）的项目
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedClient(request)
    if (!auth.ok) {
      return auth.response
    }
    const { user } = auth
    const db: any = auth.client

    const { data: projects, error } = await db
      .from('projects')
      .select('*')
      .eq('facilitator_id', user.id)

    if (error) {
      console.error('GET /api/projects/owned error:', error)
      return NextResponse.json({ projects: [] })
    }

    return NextResponse.json({ projects: projects || [] })
  } catch (err) {
    console.error('GET /api/projects/owned unexpected error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'

// 返回当前用户作为所有者（facilitator_id = user.id）的项目
export async function GET(request: NextRequest) {
  try {
    const supabaseCookie = createRouteHandlerClient({ cookies })

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


import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabaseCookie = createRouteHandlerClient({ cookies })

    // 尝试多种认证方式
    let user: any = null
    let authError: any = null

    // 方法1: 尝试从 cookies 获取
    const cookieAuth = await supabaseCookie.auth.getUser()

    if (cookieAuth.data.user && !cookieAuth.error) {
      user = cookieAuth.data.user
    } else {
      // 方法2: 尝试从 Authorization header 获取
      const authHeader = request.headers.get('authorization')
      const token = authHeader?.replace('Bearer ', '')

      if (token) {
        try {
          const adminSupabase = getSupabaseAdmin()
          const { data: tokenUser, error: tokenError } = await adminSupabase.auth.getUser(token)
          if (tokenUser.user && !tokenError) {
            user = tokenUser.user
          } else {
            authError = tokenError
          }
        } catch (error) {
          authError = error
        }
      } else {
        authError = cookieAuth.error
      }
    }

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 获取未读通知数量
    const db = cookieAuth.data.user ? supabaseCookie : getSupabaseAdmin()

    const { data: unreadCount, error } = await db.rpc('get_unread_notification_count', {
      user_id: user.id
    })

    if (error) {
      console.error('Error fetching unread count:', error)
      return NextResponse.json(
        { error: 'Failed to fetch unread count' },
        { status: 500 }
      )
    }

    return NextResponse.json({ unread_count: unreadCount || 0 })
  } catch (error) {
    console.error('Error in GET /api/notifications/unread-count:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

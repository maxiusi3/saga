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
    let authedViaBearer = false

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
            authedViaBearer = true
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
    const db = authedViaBearer ? getSupabaseAdmin() : supabaseCookie

    const { data: unreadCount, error } = await db.rpc('get_unread_notification_count', {
      user_id: user.id
    })

    if (error) {
      console.error('Error fetching unread count:', error)
      // 失败时降级为 0，避免前端抛错
      return NextResponse.json({ unread_count: 0 })
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

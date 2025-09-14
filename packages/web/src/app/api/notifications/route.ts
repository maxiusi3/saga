import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const supabaseCookie = createRouteHandlerClient({ cookies })
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')

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

    // 获取用户的通知
    // 为彻底规避 RLS，在服务端路由中统一使用 admin 客户端执行查询，但始终按 user.id 过滤
    const db = getSupabaseAdmin()

    const { data: notifications, error } = await db
      .from('notifications')
      .select('*')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching notifications:', error)
      return NextResponse.json(
        { error: 'Failed to fetch notifications' },
        { status: 500 }
      )
    }

    // 格式化响应数据
    const formattedNotifications = (notifications || []).map((notification: any) => ({
      id: notification.id,
      recipient_id: notification.recipient_id,
      sender_id: notification.sender_id,
      sender_name: 'System',
      sender_avatar: null,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      action_url: notification.action_url,
      is_read: notification.is_read,
      read_at: notification.read_at,
      created_at: notification.created_at,
      updated_at: notification.updated_at
    }))

    return NextResponse.json(formattedNotifications)
  } catch (error) {
    console.error('Error in GET /api/notifications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseCookie = createRouteHandlerClient({ cookies })

    // 鉴权：Cookies 优先，Bearer 回退
    let user: any = null
    let db: any = supabaseCookie
    let authedViaBearer = false

    const cookieAuth = await supabaseCookie.auth.getUser()
    if (cookieAuth.data.user && !cookieAuth.error) {
      user = cookieAuth.data.user
    } else {
      const authHeader = request.headers.get('authorization')
      const token = authHeader?.replace('Bearer ', '')
      if (token) {
        const admin = getSupabaseAdmin()
        const { data: tokenUser } = await admin.auth.getUser(token)
        if (tokenUser?.user) {
          user = tokenUser.user
          db = admin
          authedViaBearer = true
        }
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 统一使用 admin 执行后续数据库操作
    db = getSupabaseAdmin()

    const body = await request.json()
    const { action, notification_ids } = body

    if (action === 'mark_as_read') {
      if (notification_ids && Array.isArray(notification_ids)) {
        // 标记指定通知为已读
        const { data, error } = await db.rpc('mark_notifications_as_read', {
          user_id: user.id,
          notification_ids
        })

        if (error) {
          console.error('Error marking notifications as read:', error)
          return NextResponse.json(
            { error: 'Failed to mark notifications as read' },
            { status: 500 }
          )
        }

        return NextResponse.json({ success: true, updated_count: data })
      } else {
        // 标记所有通知为已读
        const { data, error } = await db.rpc('mark_notifications_as_read', {
          user_id: user.id
        })

        if (error) {
          console.error('Error marking all notifications as read:', error)
          return NextResponse.json(
            { error: 'Failed to mark all notifications as read' },
            { status: 500 }
          )
        }

        return NextResponse.json({ success: true, updated_count: data })
      }
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in POST /api/notifications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabaseCookie = createRouteHandlerClient({ cookies })
    const { searchParams } = new URL(request.url)
    const notificationId = searchParams.get('id')

    // 验证用户身份
    const { data: { user }, error: authError } = await supabaseCookie.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!notificationId) {
      return NextResponse.json(
        { error: 'Notification ID is required' },
        { status: 400 }
      )
    }

    // 删除通知（只能删除自己的通知）
    const { error } = await supabaseCookie
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('recipient_id', user.id)

    if (error) {
      console.error('Error deleting notification:', error)
      return NextResponse.json(
        { error: 'Failed to delete notification' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/notifications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

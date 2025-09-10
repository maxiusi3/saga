import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 获取用户的通知
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select(`
        *,
        sender:sender_id (
          id,
          email,
          user_metadata
        )
      `)
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
    const formattedNotifications = notifications.map(notification => ({
      id: notification.id,
      recipient_id: notification.recipient_id,
      sender_id: notification.sender_id,
      sender_name: notification.sender?.user_metadata?.full_name || 
                  notification.sender?.email || 
                  'System',
      sender_avatar: notification.sender?.user_metadata?.avatar_url,
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
    const supabase = createRouteHandlerClient({ cookies })

    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action, notification_ids } = body

    if (action === 'mark_as_read') {
      if (notification_ids && Array.isArray(notification_ids)) {
        // 标记指定通知为已读
        const { data, error } = await supabase.rpc('mark_notifications_as_read', {
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
        const { data, error } = await supabase.rpc('mark_notifications_as_read', {
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
    const supabase = createRouteHandlerClient({ cookies })
    const { searchParams } = new URL(request.url)
    const notificationId = searchParams.get('id')

    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser()
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
    const { error } = await supabase
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

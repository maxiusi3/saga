import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
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

    // 获取未读通知数量
    const { data: unreadCount, error } = await supabase.rpc('get_unread_notification_count', {
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

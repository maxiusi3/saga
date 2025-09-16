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

    // 获取用户的通知（并补充 sender/profile 与 story/project 标题信息）
    const db = authedViaBearer ? getSupabaseAdmin() : supabaseCookie

    const { data: notifications, error } = await db
      .from('notifications')
      .select('*')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching notifications:', error)
      return NextResponse.json([])
    }

    const list = notifications || []

    // 解析需要补充的 sender/story/project id 集合
    const senderIds = Array.from(new Set(list.map((n: any) => n.sender_id).filter(Boolean)))
    const projectIds = Array.from(new Set(list.map((n: any) => n.data?.project_id).filter(Boolean)))
    const storyIds = Array.from(new Set(list.map((n: any) => n.data?.story_id).filter(Boolean)))

    // 批量拉取 sender profiles
    let senderProfiles: Record<string, any> = {}
    if (senderIds.length > 0) {
      const { data: profiles } = await db
        .from('user_profiles')
        .select('id, name, email, avatar_url')
        .in('id', senderIds)
      senderProfiles = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]))
    }

    // 批量拉取项目与故事标题
    let projectTitles: Record<string, string> = {}
    if (projectIds.length > 0) {
      const { data: projects } = await db
        .from('projects')
        .select('id, title')
        .in('id', projectIds)
      projectTitles = Object.fromEntries((projects || []).map((p: any) => [p.id, p.title]))
    }

    let storyTitles: Record<string, string> = {}
    if (storyIds.length > 0) {
      const { data: stories } = await db
        .from('stories')
        .select('id, title')
        .in('id', storyIds)
      storyTitles = Object.fromEntries((stories || []).map((s: any) => [s.id, s.title]))
    }

    const formattedNotifications = list.map((n: any) => {
      const data = n.data || {}
      const sender = (n.sender_id && senderProfiles[n.sender_id]) || {}
      const actionUrl = n.action_url || (data.project_id && data.story_id ? `/dashboard/projects/${data.project_id}/stories/${data.story_id}` : null)
      return {
        id: n.id,
        recipient_id: n.recipient_id,
        sender_id: n.sender_id,
        sender_name: sender.name || sender.email || 'System',
        sender_avatar: sender.avatar_url || null,
        project_id: data.project_id || null,
        story_id: data.story_id || null,
        comment_id: data.interaction_id || null,
        notification_type: n.type,
        title: n.title,
        message: n.message,
        preview_text: data.preview_text || null,
        action_url: actionUrl,
        is_read: n.is_read,
        read_at: n.read_at,
        created_at: n.created_at,
        updated_at: n.updated_at,
        project_title: data.project_id ? projectTitles[data.project_id] || null : null,
        story_title: data.story_id ? storyTitles[data.story_id] || null : null
      }
    })

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

    // Bearer 路径使用 admin 执行后续数据库操作；有 cookie 时继续使用 cookie 客户端
    if (authedViaBearer) {
      db = getSupabaseAdmin()
    }

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

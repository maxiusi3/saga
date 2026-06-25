import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedClient } from '@/lib/server/authenticated-client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    const auth = await getAuthenticatedClient(request)
    if (!auth.ok) {
      return auth.response
    }
    const { user } = auth
    const db: any = auth.client

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
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedClient(request)
    if (!auth.ok) {
      return auth.response
    }
    const { user } = auth
    const db: any = auth.client

    const body = await request.json()
    const { action, notification_ids } = body

    if (action === 'mark_as_read') {
      if (notification_ids && Array.isArray(notification_ids)) {
        const { data, error } = await db
          .from('notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('recipient_id', user.id)
          .in('id', notification_ids)
          .select('id')

        if (error) {
          console.error('Error marking notifications as read:', error)
          return NextResponse.json(
            { error: 'Failed to mark notifications as read' },
            { status: 500 }
          )
        }

        return NextResponse.json({ success: true, updated_count: data?.length || 0 })
      } else {
        const { data, error } = await db
          .from('notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('recipient_id', user.id)
          .eq('is_read', false)
          .select('id')

        if (error) {
          console.error('Error marking all notifications as read:', error)
          return NextResponse.json(
            { error: 'Failed to mark all notifications as read' },
            { status: 500 }
          )
        }

        return NextResponse.json({ success: true, updated_count: data?.length || 0 })
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
    const { searchParams } = new URL(request.url)
    const notificationId = searchParams.get('id')

    const auth = await getAuthenticatedClient(request)
    if (!auth.ok) {
      return auth.response
    }
    const { user } = auth
    const db: any = auth.client

    if (!notificationId) {
      return NextResponse.json(
        { error: 'Notification ID is required' },
        { status: 400 }
      )
    }

    // 删除通知（只能删除自己的通知）
    const { error } = await db
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

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedClient } from '@/lib/server/authenticated-client'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedClient(request)
    if (!auth.ok) {
      return auth.response
    }
    const { user } = auth
    const db: any = auth.client

    // 获取未读通知数量
    const { count, error } = await db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('is_read', false)

    if (error) {
      console.error('Error fetching unread count:', error)
      // 失败时降级为 0，避免前端抛错
      return NextResponse.json({ unread_count: 0 })
    }

    return NextResponse.json({ unread_count: count || 0 })
  } catch (error) {
    console.error('Error in GET /api/notifications/unread-count:', error)
    return NextResponse.json({ unread_count: 0 })
  }
}

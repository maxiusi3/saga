import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }
    const adminSupabase = createClient(supabaseUrl, serviceKey)
    const rawToken = params.token
    const token = decodeURIComponent(rawToken)

    // 获取邀请信息
    const { data: invitation, error } = await adminSupabase
      .from('invitations')
      .select(`
        *,
        project:project_id (
          id,
          name,
          description
        ),
        inviter:inviter_id (
          id,
          email,
          user_metadata
        )
      `)
      .eq('token', token)
      .single()

    if (error || !invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    // 检查邀请是否过期
    const now = new Date()
    const expiresAt = new Date(invitation.expires_at)
    
    if (expiresAt < now && invitation.status === 'pending') {
      // 更新过期状态
      await adminSupabase
        .from('invitations')
        .update({ 
          status: 'expired',
          updated_at: now.toISOString()
        })
        .eq('id', invitation.id)
      
      invitation.status = 'expired'
    }

    // 格式化响应数据
    const formattedInvitation = {
      id: invitation.id,
      project_id: invitation.project_id,
      project_name: invitation.project?.name || 'Unknown Project',
      project_description: invitation.project?.description,
      inviter_name: invitation.inviter?.user_metadata?.full_name || 
                   invitation.inviter?.email || 
                   'Unknown User',
      inviter_avatar: invitation.inviter?.user_metadata?.avatar_url,
      role: invitation.role,
      status: invitation.status,
      expires_at: invitation.expires_at,
      created_at: invitation.created_at
    }

    return NextResponse.json(formattedInvitation)
  } catch (error) {
    console.error('Error in GET /api/invitations/[token]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

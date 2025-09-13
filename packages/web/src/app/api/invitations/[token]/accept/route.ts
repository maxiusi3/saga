import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const rawToken = params.token
    const token = decodeURIComponent(rawToken)

    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Please sign in to accept this invitation' },
        { status: 401 }
      )
    }

    // 使用数据库函数接受邀请
    const { data: result, error } = await supabase.rpc('accept_project_invitation', {
      invitation_token: token,
      user_id: user.id
    })

    if (error) {
      console.error('Error accepting invitation:', error)
      
      // 处理特定错误
      if (error.message.includes('Invalid or expired invitation')) {
        return NextResponse.json(
          { error: 'This invitation is invalid or has expired' },
          { status: 400 }
        )
      } else if (error.message.includes('already has this role')) {
        return NextResponse.json(
          { error: 'You already have this role in the project' },
          { status: 409 }
        )
      } else {
        return NextResponse.json(
          { error: 'Failed to accept invitation' },
          { status: 500 }
        )
      }
    }

    // 获取项目信息用于重定向
    const { data: invitation, error: invitationError } = await supabase
      .from('invitations')
      .select(`
        project_id,
        project:project_id (
          name
        )
      `)
      .eq('token', token)
      .single()

    if (invitationError || !invitation) {
      return NextResponse.json(
        { error: 'Failed to retrieve project information' },
        { status: 500 }
      )
    }

    // 发送成功通知给邀请者
    const { data: inviterInfo } = await supabase
      .from('invitations')
      .select(`
        inviter_id,
        role,
        inviter:inviter_id (
          user_metadata
        )
      `)
      .eq('token', token)
      .single()

    if (inviterInfo) {
      // 创建通知
      await supabase.rpc('send_notification', {
        recipient_user_id: inviterInfo.inviter_id,
        sender_user_id: user.id,
        notification_type: 'member_joined',
        notification_title: 'Invitation Accepted',
        notification_message: `${user.user_metadata?.full_name || user.email} has joined your project as a ${inviterInfo.role}`,
        notification_data: {
          project_id: invitation.project_id,
          accepted_role: inviterInfo.role
        },
        notification_action_url: `/dashboard/projects/${invitation.project_id}`
      })
    }

    return NextResponse.json({
      success: true,
      project_id: invitation.project_id,
      project_name: invitation.project?.name,
      message: 'Successfully joined the project!'
    })
  } catch (error) {
    console.error('Error in POST /api/invitations/[token]/accept:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

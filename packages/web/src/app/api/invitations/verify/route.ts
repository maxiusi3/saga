import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // 使用 admin 客户端查询邀请
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 查找邀请
    const { data: invitation, error } = await adminSupabase
      .from('invitations')
      .select(`
        id,
        invitee_email,
        role,
        message,
        expires_at,
        status,
        project_id,
        projects!inner (
          id,
          name,
          facilitator_id
        )
      `)
      .eq('token', token)
      .eq('status', 'pending')
      .single()

    if (error || !invitation) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation' },
        { status: 404 }
      )
    }

    // 检查邀请是否过期
    if (new Date(invitation.expires_at) < new Date()) {
      // 更新邀请状态为过期
      await adminSupabase
        .from('invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id)

      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 410 }
      )
    }

    // 获取邀请者信息
    const { data: inviterProfile } = await adminSupabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', invitation.projects.facilitator_id)
      .single()

    return NextResponse.json({
      id: invitation.id,
      invitee_email: invitation.invitee_email,
      project_name: invitation.projects.name,
      project_id: invitation.project_id,
      inviter_name: inviterProfile?.full_name || inviterProfile?.email || 'Unknown',
      role: invitation.role,
      message: invitation.message,
      expires_at: invitation.expires_at
    })

  } catch (error) {
    console.error('Error verifying invitation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

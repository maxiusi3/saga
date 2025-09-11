import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, user_id } = body

    if (!token || !user_id) {
      return NextResponse.json(
        { error: 'Token and user_id are required' },
        { status: 400 }
      )
    }

    // 尝试多种认证方式
    let user: any = null
    let authError: any = null

    // 方法1: 尝试从 cookies 获取
    const supabase = createRouteHandlerClient({ cookies })
    const cookieAuth = await supabase.auth.getUser()

    if (cookieAuth.data.user && !cookieAuth.error) {
      user = cookieAuth.data.user
    } else {
      // 方法2: 尝试从 Authorization header 获取
      const authHeader = request.headers.get('authorization')
      const token = authHeader?.replace('Bearer ', '')

      if (token) {
        try {
          const adminSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          )
          const { data: tokenUser, error: tokenError } = await adminSupabase.auth.getUser(token)
          if (tokenUser.user && !tokenError) {
            user = tokenUser.user
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

    if (authError || !user || user.id !== user_id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 使用 admin 客户端处理邀请
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 查找邀请
    const { data: invitation, error: invitationError } = await adminSupabase
      .from('invitations')
      .select(`
        id,
        invitee_email,
        role,
        project_id,
        status,
        expires_at
      `)
      .eq('token', token)
      .eq('status', 'pending')
      .single()

    if (invitationError || !invitation) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation' },
        { status: 404 }
      )
    }

    // 检查邮箱是否匹配
    if (invitation.invitee_email.toLowerCase() !== user.email?.toLowerCase()) {
      return NextResponse.json(
        { error: 'Email address does not match the invitation' },
        { status: 403 }
      )
    }

    // 检查邀请是否过期
    if (new Date(invitation.expires_at) < new Date()) {
      await adminSupabase
        .from('invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id)

      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 410 }
      )
    }

    // 检查用户是否已经是项目成员
    const { data: existingRole } = await adminSupabase
      .from('project_roles')
      .select('id')
      .eq('project_id', invitation.project_id)
      .eq('user_id', user_id)
      .eq('status', 'active')
      .single()

    if (existingRole) {
      return NextResponse.json(
        { error: 'You are already a member of this project' },
        { status: 409 }
      )
    }

    // 开始事务：接受邀请
    const { error: roleError } = await adminSupabase
      .from('project_roles')
      .insert({
        project_id: invitation.project_id,
        user_id: user_id,
        role: invitation.role,
        status: 'active'
      })

    if (roleError) {
      console.error('Error creating project role:', roleError)
      return NextResponse.json(
        { error: 'Failed to accept invitation' },
        { status: 500 }
      )
    }

    // 更新邀请状态
    const { error: updateError } = await adminSupabase
      .from('invitations')
      .update({ 
        status: 'accepted',
        updated_at: new Date().toISOString()
      })
      .eq('id', invitation.id)

    if (updateError) {
      console.error('Error updating invitation status:', updateError)
      // 不返回错误，因为主要操作（添加用户到项目）已经成功
    }

    // 记录座位使用交易
    await adminSupabase
      .from('seat_transactions')
      .insert({
        user_id: user_id,
        transaction_type: 'use',
        resource_type: invitation.role + '_seat',
        amount: 1,
        project_id: invitation.project_id,
        metadata: {
          action: 'invitation_accepted',
          invitation_id: invitation.id
        }
      })

    return NextResponse.json({
      success: true,
      project_id: invitation.project_id,
      role: invitation.role
    })

  } catch (error) {
    console.error('Error accepting invitation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

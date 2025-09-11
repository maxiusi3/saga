import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { EmailService } from '@/lib/email-service'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 检查环境变量
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createRouteHandlerClient({ cookies })
    const { id: projectId } = params

    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 验证用户是否是项目所有者
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('facilitator_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project || project.facilitator_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied. Only project owners can manage invitations.' },
        { status: 403 }
      )
    }

    // 获取项目的邀请列表
    const { data: invitations, error } = await supabase
      .from('invitations')
      .select(`
        *,
        inviter:inviter_id (
          id,
          email,
          user_metadata
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching invitations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch invitations' },
        { status: 500 }
      )
    }

    // 更新过期状态
    const now = new Date()
    const updatedInvitations = invitations.map(invitation => {
      if (invitation.status === 'pending' && new Date(invitation.expires_at) < now) {
        // 异步更新数据库中的过期状态
        supabase
          .from('invitations')
          .update({ status: 'expired', updated_at: now.toISOString() })
          .eq('id', invitation.id)
          .then(() => {})
          .catch(err => console.error('Error updating expired invitation:', err))
        
        return { ...invitation, status: 'expired' }
      }
      return invitation
    })

    return NextResponse.json(updatedInvitations)
  } catch (error) {
    console.error('Error in GET /api/projects/[id]/invitations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 检查环境变量
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // 尝试从 Authorization header 获取 token
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    let supabase = createRouteHandlerClient({ cookies })
    const { id: projectId } = params

    // 验证用户身份
    let user: any = null
    let authError: any = null

    // 首先尝试从 cookies 获取用户
    const cookieAuth = await supabase.auth.getUser()
    if (cookieAuth.data.user && !cookieAuth.error) {
      user = cookieAuth.data.user
    } else if (token) {
      // 如果 cookies 失败，尝试使用 token 验证
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const adminSupabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        const { data: tokenUser, error: tokenError } = await adminSupabase.auth.getUser(token)
        if (tokenUser.user && !tokenError) {
          user = tokenUser.user
          // 为后续查询创建带用户上下文的客户端
          supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          )
        } else {
          authError = tokenError
        }
      } catch (error) {
        authError = error
      }
    } else {
      authError = cookieAuth.error
    }

    console.log('Auth check:', { user: user?.id, authError, hasToken: !!token })
    if (authError || !user) {
      console.log('Auth failed:', authError)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 验证用户是否是项目所有者 - 使用 service role 绕过 RLS 进行调试
    const { createClient } = await import('@supabase/supabase-js')
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 使用 admin 客户端查看项目实际数据
    const { data: adminProject, error: adminError } = await adminSupabase
      .from('projects')
      .select('id, facilitator_id, name')
      .eq('id', projectId)
      .single()

    console.log('Admin project check:', { adminProject, adminError, userId: user.id })

    // 使用普通客户端查看 RLS 过滤后的结果
    const { data: userProject, error: userError } = await supabase
      .from('projects')
      .select('id, facilitator_id, name')
      .eq('id', projectId)
      .single()

    console.log('User project check:', { userProject, userError, userId: user.id })

    // 如果项目不存在
    if (adminError || !adminProject) {
      return NextResponse.json(
        { error: 'Project not found.' },
        { status: 404 }
      )
    }

    // 如果用户不是项目所有者
    if (adminProject.facilitator_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied. Only project owners can send invitations.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email, role } = body

    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email and role are required' },
        { status: 400 }
      )
    }

    if (!['facilitator', 'storyteller'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be facilitator or storyteller.' },
        { status: 400 }
      )
    }

    // 检查是否已经有相同邮箱和角色的待处理邀请
    const { data: existingInvitation } = await supabase
      .from('invitations')
      .select('id, status, expires_at')
      .eq('project_id', projectId)
      .eq('invitee_email', email.toLowerCase())
      .eq('role', role)
      .eq('status', 'pending')
      .single()

    if (existingInvitation) {
      // 检查是否过期
      if (new Date(existingInvitation.expires_at) > new Date()) {
        return NextResponse.json(
          { error: 'An active invitation already exists for this email and role' },
          { status: 409 }
        )
      } else {
        // 如果过期了，更新状态
        await supabase
          .from('invitations')
          .update({ status: 'expired' })
          .eq('id', existingInvitation.id)
      }
    }

    // 检查用户资源钱包是否有足够的座位 - 使用 admin 客户端
    const { data: wallet, error: walletError } = await adminSupabase
      .from('user_resource_wallets')
      .select('facilitator_seats, storyteller_seats')
      .eq('user_id', user.id)
      .single()

    if (walletError || !wallet) {
      return NextResponse.json(
        { error: 'Unable to verify available seats' },
        { status: 500 }
      )
    }

    const requiredSeats = role === 'facilitator' ? 'facilitator_seats' : 'storyteller_seats'
    if (wallet[requiredSeats] <= 0) {
      return NextResponse.json(
        { error: `Insufficient ${role} seats. Please purchase more seats to send this invitation.` },
        { status: 402 }
      )
    }

    // 使用数据库函数发送邀请 - 使用 admin 客户端
    const { data: invitation, error } = await adminSupabase.rpc('send_project_invitation', {
      project_id: projectId,
      inviter_id: user.id,
      invitee_email: email.toLowerCase(),
      invitation_role: role
    })

    if (error) {
      console.error('Error sending invitation:', error)
      return NextResponse.json(
        { error: 'Failed to send invitation' },
        { status: 500 }
      )
    }

    // 获取完整的邀请信息 - 使用 admin 客户端，简化查询
    const { data: fullInvitation, error: fetchError } = await adminSupabase
      .from('invitations')
      .select('*')
      .eq('id', invitation.invitation_id)
      .single()

    if (fetchError) {
      console.error('Error fetching created invitation:', fetchError)
      return NextResponse.json(
        { error: 'Invitation sent but failed to retrieve details' },
        { status: 500 }
      )
    }

    // 获取项目信息用于邮件发送
    const { data: projectInfo } = await supabase
      .from('projects')
      .select('name, description')
      .eq('id', projectId)
      .single()

    // 发送邀请邮件
    try {
      const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${fullInvitation.token}`

      await EmailService.sendInvitationEmail(fullInvitation.invitee_email, {
        inviterName: fullInvitation.inviter?.user_metadata?.full_name ||
                    fullInvitation.inviter?.email ||
                    'A family member',
        projectName: projectInfo?.name || 'Family Biography Project',
        role: fullInvitation.role,
        inviteUrl,
        expiresAt: fullInvitation.expires_at
      })
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError)
      // 不因为邮件发送失败而阻止邀请创建
    }

    return NextResponse.json(fullInvitation, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/projects/[id]/invitations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { id: projectId } = params
    const { searchParams } = new URL(request.url)
    const invitationId = searchParams.get('invitation_id')

    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!invitationId) {
      return NextResponse.json(
        { error: 'Invitation ID is required' },
        { status: 400 }
      )
    }

    // 验证用户是否有权限管理该项目的邀请
    const { data: invitation, error: invitationError } = await supabase
      .from('invitations')
      .select('inviter_id, status, role')
      .eq('id', invitationId)
      .eq('project_id', projectId)
      .single()

    if (invitationError || !invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    if (invitation.inviter_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied. You can only cancel invitations you sent.' },
        { status: 403 }
      )
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending invitations can be cancelled' },
        { status: 400 }
      )
    }

    // 取消邀请并释放座位
    const { error: updateError } = await supabase
      .from('invitations')
      .update({ 
        status: 'declined',
        updated_at: new Date().toISOString()
      })
      .eq('id', invitationId)

    if (updateError) {
      console.error('Error cancelling invitation:', updateError)
      return NextResponse.json(
        { error: 'Failed to cancel invitation' },
        { status: 500 }
      )
    }

    // 释放预留的座位
    const seatColumn = invitation.role === 'facilitator' ? 'facilitator_seats' : 'storyteller_seats'
    await supabase
      .from('user_resource_wallets')
      .update({
        [seatColumn]: supabase.raw(`${seatColumn} + 1`),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/projects/[id]/invitations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

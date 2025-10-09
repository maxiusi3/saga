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
      console.error('Missing Supabase environment variables')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const { id: projectId } = params
    
    // 尝试从 Authorization header 获取 token
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    // Create Supabase client
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // Verify user identity
    let user: any = null
    let authError: any = null

    console.log('GET invitations - Auth attempt:', { hasAuthHeader: !!authHeader, hasToken: !!token })

    // First try to get user from cookies
    const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser()
    
    console.log('GET invitations - Cookie auth result:', { 
      hasUser: !!cookieUser, 
      userId: cookieUser?.id,
      error: cookieError?.message 
    })

    if (cookieUser && !cookieError) {
      user = cookieUser
    } else if (token) {
      // If cookies fail, try using token for verification
      console.log('GET invitations - Trying token auth')
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const adminSupabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        const { data: tokenData, error: tokenError } = await adminSupabase.auth.getUser(token)
        if (tokenData.user && !tokenError) {
          user = tokenData.user
          console.log('GET invitations - Token auth successful:', user.id)
        } else {
          authError = tokenError
          console.log('GET invitations - Token auth failed:', tokenError)
        }
      } catch (error) {
        authError = error
        console.error('GET invitations - Token auth error:', error)
      }
    } else {
      authError = cookieError
    }

    if (authError || !user) {
      console.error('GET invitations - Authentication failed:', { authError, hasUser: !!user })
      return NextResponse.json(
        { error: 'Unauthorized', details: authError?.message },
        { status: 401 }
      )
    }

    console.log('GET invitations - Auth successful:', user.id)

    // Verify if user is project owner - use admin client
    const { createClient } = await import('@supabase/supabase-js')
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: project, error: projectError } = await adminSupabase
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

    // Run cleanup for expired invitations before fetching
    try {
      await adminSupabase.rpc('cleanup_expired_invitations')
    } catch (cleanupError) {
      console.warn('Failed to run invitation cleanup:', cleanupError)
      // Continue with normal operation even if cleanup fails
    }

    // Get project invitations list - using admin client
    const { data: invitations, error } = await adminSupabase
      .from('invitations')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching invitations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch invitations' },
        { status: 500 }
      )
    }

    // Update expired status - use admin client
    const now = new Date()
    const updatedInvitations = invitations.map(invitation => {
      if (invitation.status === 'pending' && new Date(invitation.expires_at) < now) {
        // Async update expired status in database
        adminSupabase
          .from('invitations')
          .update({ status: 'expired', updated_at: now.toISOString() })
          .eq('id', invitation.id)
          .then(() => {})

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
      console.error('Missing Supabase environment variables')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const { id: projectId } = params
    
    // 尝试从 Authorization header 获取 token
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    // Create Supabase client
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // Verify user identity
    let user: any = null
    let authError: any = null

    console.log('POST invitation - Auth attempt:', { hasAuthHeader: !!authHeader, hasToken: !!token })

    // First try to get user from cookies
    const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser()
    
    console.log('POST invitation - Cookie auth result:', { 
      hasUser: !!cookieUser, 
      userId: cookieUser?.id,
      error: cookieError?.message 
    })

    if (cookieUser && !cookieError) {
      user = cookieUser
    } else if (token) {
      // If cookies fail, try using token for verification
      console.log('POST invitation - Trying token auth')
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const adminSupabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        const { data: tokenData, error: tokenError } = await adminSupabase.auth.getUser(token)
        if (tokenData.user && !tokenError) {
          user = tokenData.user
          console.log('POST invitation - Token auth successful:', user.id)
        } else {
          authError = tokenError
          console.log('POST invitation - Token auth failed:', tokenError)
        }
      } catch (error) {
        authError = error
        console.error('POST invitation - Token auth error:', error)
      }
    } else {
      authError = cookieError
    }

    console.log('POST invitation - Final auth check:', { user: user?.id, authError, hasToken: !!token })
    if (authError || !user) {
      console.error('POST invitation - Authentication failed:', authError)
      return NextResponse.json(
        { error: 'Unauthorized', details: authError?.message },
        { status: 401 }
      )
    }

    console.log('POST invitation - Auth successful:', user.id)

    // Verify if user is project owner - use service role to bypass RLS for debugging
    const { createClient } = await import('@supabase/supabase-js')
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Use admin client to view actual project data
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
    const { email, role, message } = body

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

    // 如果是邀请storyteller，检查项目中是否已经有storyteller
    if (role === 'storyteller') {
      // 检查是否已有active的storyteller
      const { data: existingStoryteller } = await adminSupabase
        .from('project_roles')
        .select('id')
        .eq('project_id', projectId)
        .eq('role', 'storyteller')
        .eq('status', 'active')
        .single()

      if (existingStoryteller) {
        return NextResponse.json(
          { error: 'This project already has a storyteller. Only one storyteller is allowed per project.' },
          { status: 409 }
        )
      }

      // 检查是否有pending的storyteller邀请
      const { data: pendingStoryteller } = await adminSupabase
        .from('invitations')
        .select('id')
        .eq('project_id', projectId)
        .eq('role', 'storyteller')
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .single()

      if (pendingStoryteller) {
        return NextResponse.json(
          { error: 'There is already a pending storyteller invitation for this project. Only one storyteller is allowed per project.' },
          { status: 409 }
        )
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
        {
          error: `Insufficient ${role} seats. Please purchase more seats to send this invitation.`,
          errorCode: 'INSUFFICIENT_SEATS',
          purchaseUrl: '/dashboard/purchase',
          requiredSeats: 1,
          availableSeats: wallet[requiredSeats]
        },
        { status: 402 }
      )
    }

    // 使用数据库函数发送邀请 - 使用 admin 客户端
    const { data: invitation, error } = await adminSupabase.rpc('send_project_invitation', {
      project_id: projectId,
      inviter_id: user.id,
      invitee_email: email.toLowerCase(),
      invitation_role: role,
      invitation_message: message || null
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
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { id: projectId } = params
    const { searchParams } = new URL(request.url)
    const invitationId = searchParams.get('invitation_id')

    // Verify user identity
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    console.log('DELETE invitation - Auth result:', { hasUser: !!user, error: authError?.message })
    
    if (authError || !user) {
      console.error('DELETE invitation - Authentication failed:', authError)
      return NextResponse.json(
        { error: 'Unauthorized', details: authError?.message },
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

    // Release reserved seats
    const seatColumn = invitation.role === 'facilitator' ? 'facilitator_seats' : 'storyteller_seats'
    
    // Get current wallet state and increment the appropriate seat count
    const { data: wallet } = await supabase
      .from('user_resource_wallets')
      .select('facilitator_seats, storyteller_seats')
      .eq('user_id', user.id)
      .single()
    
    if (wallet) {
      const currentSeats = (wallet as any)[seatColumn] || 0
      await supabase
        .from('user_resource_wallets')
        .update({
          [seatColumn]: currentSeats + 1,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/projects/[id]/invitations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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

    // 使用数据库函数执行接受逻辑（包含角色绑定与交易记录）
    const { data: result, error: acceptError } = await adminSupabase.rpc('accept_project_invitation', {
      invitation_token: token,
      user_id
    })

    if (acceptError) {
      console.error('Error accepting invitation via RPC:', acceptError)
      // 将常见错误映射到合适的状态码
      const msg = String(acceptError.message || '')
      if (msg.includes('Invalid or expired invitation')) {
        return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 })
      }
      if (msg.includes('already has this role')) {
        return NextResponse.json({ error: 'You are already a member of this project' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      project_id: result?.project_id || invitation.project_id,
      role: result?.role || invitation.role
    })

  } catch (error) {
    console.error('Error accepting invitation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

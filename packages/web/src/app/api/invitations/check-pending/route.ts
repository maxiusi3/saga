import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    // 尝试多种认证方式
    let user: any = null
    let authError: any = null

    // 方法1: 尝试从 cookies 获取
    const supabase = createRouteHandlerClient({ cookies })
    const cookieAuth = await supabase.auth.getUser()

    if (cookieAuth.data.user && !cookieAuth.error) {
      user = cookieAuth.data.user
      console.log('Check pending: Auth via cookies successful', { userId: user.id, email: user.email })
    } else {
      console.log('Check pending: Cookie auth failed', { error: cookieAuth.error })

      // 方法2: 尝试从 Authorization header 获取
      const authHeader = request.headers.get('authorization')
      const token = authHeader?.replace('Bearer ', '')

      if (token) {
        try {
          const { createClient } = await import('@supabase/supabase-js')
          const adminSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          )
          const { data: tokenUser, error: tokenError } = await adminSupabase.auth.getUser(token)
          if (tokenUser.user && !tokenError) {
            user = tokenUser.user
            console.log('Check pending: Auth via token successful', { userId: user.id, email: user.email })
          } else {
            authError = tokenError
            console.log('Check pending: Token auth failed', { error: tokenError })
          }
        } catch (error) {
          authError = error
          console.log('Check pending: Token auth error', { error })
        }
      } else {
        authError = cookieAuth.error
      }
    }

    if (authError || !user || !user.email) {
      console.log('Check pending: Auth failed or no email', { authError, userId: user?.id, email: user?.email })
      return NextResponse.json(
        { hasPendingInvitations: false },
        { status: 200 }
      )
    }

    console.log('Check pending: User authenticated', { userId: user.id, email: user.email })

    // 使用 admin 客户端查询待处理的邀请
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 查找用户邮箱对应的待处理邀请
    console.log('Check pending: Searching for invitations with email:', user.email.toLowerCase())

    const { data: invitations, error } = await adminSupabase
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
      .eq('invitee_email', user.email.toLowerCase())
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())

    console.log('Check pending: Query result', { invitations, error, searchEmail: user.email.toLowerCase() })

    if (error) {
      console.error('Error checking pending invitations:', error)
      return NextResponse.json(
        { hasPendingInvitations: false },
        { status: 200 }
      )
    }

    const hasPendingInvitations = invitations && invitations.length > 0

    return NextResponse.json({
      hasPendingInvitations,
      invitationCount: invitations?.length || 0,
      invitations: hasPendingInvitations ? invitations.map(inv => ({
        id: inv.id,
        project_name: inv.projects?.name || 'Unknown Project',
        role: inv.role,
        message: inv.message,
        expires_at: inv.expires_at,
        project_id: inv.project_id
      })) : []
    })

  } catch (error) {
    console.error('Error in check-pending invitations:', error)
    return NextResponse.json(
      { hasPendingInvitations: false },
      { status: 200 }
    )
  }
}

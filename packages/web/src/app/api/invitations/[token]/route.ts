import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const url = new URL(request.url)
    const debug = url.searchParams.get('debug') === '1'

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }
    const adminSupabase = createClient(supabaseUrl, serviceKey)
    let token = params.token
    try { token = decodeURIComponent(token) } catch {}
    try { token = decodeURIComponent(token) } catch {}
    token = token.trim()

    // 生成 token 候选集合，兼容多次编码、空格替换与 url-safe 变体
    const candidates = Array.from(new Set([
      token,
      token.replace(/\s/g, '+'),
      token.replace(/%2B/gi, '+'),
      token.replace(/%3D/gi, '='),
      token.replace(/-/g, '+').replace(/_/g, '/'),
      token.replace(/=+$/, ''),           // 去掉尾部 padding
      token.endsWith('=') ? token.slice(0, -1) : token,
      token.endsWith('==') ? token.slice(0, -2) : token,
      token + '=',
      token + '=='
    ]))

    // 获取邀请信息（先用 in 查询，若无结果，逐个 eq 回退）
    let invitation: any = null
    let error: any = null
    {
      const { data: list, error: e1 } = await adminSupabase
        .from('invitations')
        .select('id, token, status, expires_at, project_id, inviter_id, invitee_email, role, created_at, updated_at')
        .in('token', candidates)
        .limit(1)
      if (Array.isArray(list) && list[0]) invitation = list[0]
      error = e1
    }

    if (!invitation) {
      for (const t of candidates) {
        const { data: list2, error: e2 } = await adminSupabase
          .from('invitations')
          .select('id, token, status, expires_at, project_id, inviter_id, invitee_email, role, created_at, updated_at')
          .eq('token', t)
          .limit(1)
        if (Array.isArray(list2) && list2[0]) { invitation = list2[0]; error = null; break }
        if (e2) error = e2
      }
    }

    if (!invitation) {
      const debugPayload = debug ? { candidates, token, supabaseUrl, error: error ? String(error.message || error) : undefined } : undefined
      return NextResponse.json(
        { error: 'Invitation not found', debug: debugPayload },
        { status: 404 }
      )
    }

    // 追加项目信息与邀请人信息（单独查询，避免关系映射问题）
    const [{ data: project }, { data: inviter }] = await Promise.all([
      adminSupabase.from('projects').select('id, name, description').eq('id', invitation.project_id).limit(1),
      adminSupabase.from('profiles').select('id, email, user_metadata').eq('id', invitation.inviter_id).limit(1)
    ])

    const projectInfo = Array.isArray(project) ? project[0] : null
    const inviterInfo = Array.isArray(inviter) ? inviter[0] : null

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
      project_name: projectInfo?.name || 'Unknown Project',
      project_description: projectInfo?.description,
      inviter_name: inviterInfo?.user_metadata?.full_name || inviterInfo?.email || 'Unknown User',
      inviter_avatar: inviterInfo?.user_metadata?.avatar_url,
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

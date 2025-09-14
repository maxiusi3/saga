import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const supabaseCookieClient = createRouteHandlerClient({ cookies })

    const urlObj = new URL(request.url)
    const debug = urlObj.searchParams.get('debug') === '1'

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    let token = params.token
    try { token = decodeURIComponent(token) } catch {}
    try { token = decodeURIComponent(token) } catch {}
    token = token.trim()

    // 验证用户身份（优先 cookies，不行则用 Authorization Bearer）
    let user: any = null
    let supabaseClientForRpc: any = supabaseCookieClient
    {
      const { data, error } = await supabaseCookieClient.auth.getUser()
      if (!error && data.user) user = data.user
    }
    if (!user) {
      const authHeader = request.headers.get('authorization')
      const bearer = authHeader?.replace('Bearer ', '')
      if (bearer) {
        const bearerClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${bearer}` } }
        })
        const { data: u, error: e } = await bearerClient.auth.getUser(bearer)
        if (!e && u?.user) {
          user = u.user
          supabaseClientForRpc = bearerClient
        } else if (serviceKey) {
          // 回退：使用 admin 客户端解析 JWT（某些环境下 anonKey.getUser(jwt) 会失败）
          try {
            const adminClient = createClient(supabaseUrl, serviceKey)
            const { data: u2, error: e2 } = await adminClient.auth.getUser(bearer)
            if (!e2 && u2?.user) {
              user = u2.user
              supabaseClientForRpc = bearerClient // 仍使用 bearerClient 调用 RPC（RLS 依据用户）
            }
          } catch {}
        }
      }
    }
    if (!user) {
      const authHeader = request.headers.get('authorization')
      const bearer = authHeader?.replace('Bearer ', '')
      const payload = debug ? { reason: 'no_user', hasCookie: false, hasBearer: !!bearer } : undefined
      return NextResponse.json({ error: 'Please sign in to accept this invitation', debug: payload }, { status: 401 })
    }

    // 兼容多种 token 变体
    const candidates = Array.from(new Set([
      token,
      token.replace(/\s/g, '+'),
      token.replace(/%2B/gi, '+'),
      token.replace(/%3D/gi, '='),
      token.replace(/-/g, '+').replace(/_/g, '/'),
      token.replace(/=+$/, ''),
      token.endsWith('=') ? token.slice(0, -1) : token,
      token.endsWith('==') ? token.slice(0, -2) : token,
      token + '=',
      token + '=='
    ]))

    let result: any = null
    let error: any = null
    for (const t of candidates) {
      const r = await supabaseClientForRpc.rpc('accept_project_invitation', {
        invitation_token: t,
        user_id: user.id
      })
      if (!r.error) { result = r.data; error = null; break }
      error = r.error
    }

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

    // 直接使用 RPC 返回的项目 ID
    return NextResponse.json({
      success: true,
      project_id: result?.project_id,
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

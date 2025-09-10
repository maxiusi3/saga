import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { version = '1.0', ip_address } = body

    // 检查用户是否已经同意过当前版本的隐私政策
    const { data: existingAgreement } = await supabase
      .from('privacy_agreements')
      .select('id, version, agreed_at')
      .eq('user_id', user.id)
      .eq('version', version)
      .single()

    if (existingAgreement) {
      return NextResponse.json({
        success: true,
        message: 'Privacy agreement already recorded',
        agreement: existingAgreement
      })
    }

    // 记录新的隐私政策同意
    const { data: agreement, error } = await supabase
      .from('privacy_agreements')
      .insert({
        user_id: user.id,
        version: version,
        agreed_at: new Date().toISOString(),
        ip_address: ip_address || null,
        user_agent: request.headers.get('user-agent') || null
      })
      .select()
      .single()

    if (error) {
      console.error('Error recording privacy agreement:', error)
      return NextResponse.json(
        { error: 'Failed to record privacy agreement' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Privacy agreement recorded successfully',
      agreement
    })

  } catch (error) {
    console.error('Error in POST /api/privacy-pledge:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 获取用户的隐私政策同意记录
    const { data: agreements, error } = await supabase
      .from('privacy_agreements')
      .select('*')
      .eq('user_id', user.id)
      .order('agreed_at', { ascending: false })

    if (error) {
      console.error('Error fetching privacy agreements:', error)
      return NextResponse.json(
        { error: 'Failed to fetch privacy agreements' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      agreements: agreements || [],
      latest_version: agreements?.[0]?.version || null,
      has_agreed: (agreements?.length || 0) > 0
    })

  } catch (error) {
    console.error('Error in GET /api/privacy-pledge:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

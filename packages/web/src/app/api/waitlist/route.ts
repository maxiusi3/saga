import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { z } from 'zod'

// 验证 schema
const WaitlistSignupSchema = z.object({
  email: z.string().email('Invalid email address'),
  package_interest: z.enum(['standard', 'premium', 'enterprise']).optional(),
  message: z.string().max(500).optional(),
  source: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 验证输入
    const validation = WaitlistSignupSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { email, package_interest, message, source } = validation.data

    // 获取当前用户（如果已登录）
    const authHeader = request.headers.get('authorization')
    let userId: string | null = null

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const supabase = getSupabaseAdmin()
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id || null
    }

    // 插入到数据库
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('waitlist_signups')
      .insert({
        email,
        user_id: userId,
        package_interest: package_interest || null,
        message: message || null,
        source: source || 'purchase_page'
      })
      .select()
      .single()

    if (error) {
      // 处理重复邮箱
      if (error.code === '23505') { // unique_violation
        return NextResponse.json(
          { error: 'Email already registered', message: 'You are already on the waitlist!' },
          { status: 409 }
        )
      }

      console.error('Waitlist signup error:', error)
      return NextResponse.json(
        { error: 'Failed to join waitlist' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully joined the waitlist!',
      data: {
        id: data.id,
        email: data.email,
        created_at: data.created_at
      }
    })

  } catch (error) {
    console.error('Waitlist API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET: 检查用户是否已在等待列表中
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('waitlist_signups')
      .select('id, email, created_at, package_interest')
      .eq('email', email)
      .single()

    if (error) {
      if (error.code === 'PGRST116') { // no rows returned
        return NextResponse.json({ registered: false })
      }
      throw error
    }

    return NextResponse.json({
      registered: true,
      data: {
        id: data.id,
        email: data.email,
        created_at: data.created_at,
        package_interest: data.package_interest
      }
    })

  } catch (error) {
    console.error('Waitlist check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

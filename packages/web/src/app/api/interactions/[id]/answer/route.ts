import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseCookie = createRouteHandlerClient({ cookies })
    const { id } = params

    // Cookies 优先，Bearer 回退
    let user: any = null
    let db: any = supabaseCookie

    const cookieAuth = await supabaseCookie.auth.getUser()
    if (cookieAuth.data.user && !cookieAuth.error) {
      user = cookieAuth.data.user
    } else {
      const token = request.headers.get('authorization')?.replace('Bearer ', '')
      if (token) {
        const admin = getSupabaseAdmin()
        const { data: tokenUser, error: tokenErr } = await admin.auth.getUser(token)
        if (tokenUser?.user && !tokenErr) {
          user = tokenUser.user
          db = admin
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { answer_story_id } = body

    if (!answer_story_id) {
      return NextResponse.json({ error: 'Missing answer_story_id' }, { status: 400 })
    }

    // 使用admin客户端来更新interaction
    const admin = getSupabaseAdmin()

    // 首先验证interaction存在且用户有权限
    const { data: interaction, error: fetchError } = await admin
      .from('interactions')
      .select(`
        *,
        story:story_id (
          project_id,
          storyteller_id
        )
      `)
      .eq('id', id)
      .eq('type', 'followup')
      .single()

    if (fetchError || !interaction) {
      return NextResponse.json({ error: 'Followup not found' }, { status: 404 })
    }

    // 验证用户是故事的讲述者
    if (interaction.story.storyteller_id !== user.id) {
      return NextResponse.json({ error: 'Only the storyteller can answer this followup' }, { status: 403 })
    }

    // 更新interaction状态
    const { error: updateError } = await admin
      .from('interactions')
      .update({
        answered_at: new Date().toISOString(),
        answer_story_id: answer_story_id
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating interaction:', updateError)
      return NextResponse.json({ error: 'Failed to update followup status' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST /api/interactions/[id]/answer unexpected error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

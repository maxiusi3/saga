import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'

// POST /api/interactions/[interactionId]/answer
// body: { answer: string }
// 权限：仅故事讲述者（故事的 storyteller_id）可以回答，或项目拥有者/管理员可代表回答（可配置）
export async function POST(
  request: NextRequest,
  { params }: { params: { interactionId: string } }
) {
  try {
    const supabaseCookie = createRouteHandlerClient({ cookies })
    const { interactionId } = params

    // 认证
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

    const body = await request.json().catch(() => ({}))
    const answer = (body?.answer || '').trim()
    if (!answer) {
      return NextResponse.json({ error: 'Answer text required' }, { status: 400 })
    }

    // 读取交互以获取 story_id、类型、当前状态
    const admin = getSupabaseAdmin()
    const { data: interaction, error: iErr } = await admin
      .from('interactions')
      .select('id, story_id, type, answered_at')
      .eq('id', interactionId)
      .maybeSingle()

    if (iErr || !interaction) {
      console.error('Error fetching interaction:', iErr)
      return NextResponse.json({ error: 'Interaction not found' }, { status: 404 })
    }

    if (interaction.type !== 'followup') {
      return NextResponse.json({ error: 'Only follow-up questions can be answered' }, { status: 400 })
    }

    // 读取故事以校验讲述者身份
    const { data: story, error: sErr } = await admin
      .from('stories')
      .select('id, project_id, storyteller_id, title')
      .eq('id', interaction.story_id)
      .maybeSingle()

    if (sErr || !story) {
      console.error('Error fetching story for answer:', sErr)
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    // 权限：仅故事讲述者可以回答
    const isStoryteller = story.storyteller_id === user.id
    if (!isStoryteller) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 更新 followup 的回答文本与时间
    const { data: updated, error: uErr } = await admin
      .from('interactions')
      .update({ answered_at: new Date().toISOString(), answer_text: answer })
      .eq('id', interactionId)
      .eq('type', 'followup')
      .select('*')
      .single()

    if (uErr) {
      console.error('Error updating interaction answer:', uErr)
      return NextResponse.json({ error: 'Failed to answer followup' }, { status: 500 })
    }

    // 给提问者发一条“story_response”通知
    try {
      const { data: asker } = await admin
        .from('interactions')
        .select('facilitator_id')
        .eq('id', interactionId)
        .maybeSingle()

      if (asker?.facilitator_id) {
        await admin.from('notifications').insert({
          recipient_id: asker.facilitator_id,
          sender_id: user.id,
          type: 'story_response',
          title: 'Follow-up answered',
          message: 'Your follow-up question has been answered.',
          data: {
            project_id: story.project_id,
            story_id: story.id,
            interaction_id: interactionId
          },
          action_url: `/dashboard/projects/${story.project_id}/stories/${story.id}`
        })
      }
    } catch (e) {
      console.warn('Failed to send response notification:', e)
    }

    return NextResponse.json({
      id: updated.id,
      story_id: updated.story_id,
      facilitator_id: updated.facilitator_id,
      type: updated.type,
      content: updated.content,
      answer_text: updated.answer_text || null,
      answered_at: updated.answered_at,
      created_at: updated.created_at
    })
  } catch (error) {
    console.error('Error in POST /api/interactions/[interactionId]/answer:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


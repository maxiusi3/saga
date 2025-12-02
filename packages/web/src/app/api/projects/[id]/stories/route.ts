import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'

// Return stories list for a project (permission: project members or owners)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseCookie = createRouteHandlerClient({ cookies })
    const projectId = params.id

    // Cookies priority, Bearer fallback
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

    // Permission: project owner or active members
    const { data: role } = await db
      .from('project_roles')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    const { data: project } = await db
      .from('projects')
      .select('facilitator_id')
      .eq('id', projectId)
      .maybeSingle()

    if (!role && project?.facilitator_id !== user.id) {
      return NextResponse.json({ error: 'Access denied to project' }, { status: 403 })
    }

    const { data: stories, error } = await db
      .from('stories')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching stories:', error)
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }

    // For each story, get the interaction summary
    const storiesWithDetails = await Promise.all(
      stories.map(async (story: any) => {
        const { data: interactions, error: interactionsError } = await db
          .from('interactions')
          .select('id, type, created_at')
          .eq('story_id', story.id)

        if (interactionsError) {
          console.error(
            `Error fetching interactions for story ${story.id}:`,
            interactionsError
          )
          return story // Return story without details on error
        }

        const comments_count = interactions.filter((i: any) => i.type === 'comment').length
        const follow_ups_count = interactions.filter((i: any) => i.type === 'followup').length

        const latest_interaction_time = interactions.length > 0
          ? interactions.reduce((latest: number, a: any) => {
            const a_time = new Date(a.created_at).getTime()
            return a_time > latest ? a_time : latest
          }, 0)
          : null

        return {
          ...story,
          comments_count,
          follow_ups_count,
          latest_interaction_time: latest_interaction_time ? new Date(latest_interaction_time).toISOString() : null
        }
      })
    )

    return NextResponse.json({ stories: storiesWithDetails || [] })
  } catch (err) {
    console.error('GET /api/projects/[id]/stories unexpected error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}


// Create story (permission: project members or owners), fields consistent with frontend
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseCookie = createRouteHandlerClient({ cookies })
    const projectId = params.id

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

    // Permission: project owner or active members
    const { data: role } = await db
      .from('project_roles')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    const { data: project } = await db
      .from('projects')
      .select('facilitator_id')
      .eq('id', projectId)
      .maybeSingle()

    if (!role && project?.facilitator_id !== user.id) {
      return NextResponse.json({ error: 'Access denied to project' }, { status: 403 })
    }

    const body = await request.json()

    const basePayload: any = {
      project_id: projectId,
      storyteller_id: user.id,
      title: body.title,
      content: body.content,
      audio_url: body.audio_url || null,
      audio_duration: body.audio_duration,
      transcript: body.transcript,
      ai_generated_title: body.ai_generated_title,
      ai_summary: body.ai_summary,
      ai_follow_up_questions: body.ai_follow_up_questions,
      ai_confidence_score: body.ai_confidence_score,
      happened_at: body.happened_at,
      recording_mode: body.recording_mode,
      is_public: body.is_public,
      status: 'ready'
    }
    const extendedPayload: any = {
      ...basePayload,
      parent_story_id: body.parent_story_id || null,
      images: Array.isArray(body.images) ? body.images : null,
    }

    let story: any = null
    let error: any = null
    {
      const { data, error: err } = await db
        .from('stories')
        .insert(extendedPayload)
        .select()
        .single()
      story = data
      error = err
    }

    if (error && (error.code === '42703' || /column/.test(error.message || ''))) {
      const { data, error: err2 } = await db
        .from('stories')
        .insert(basePayload)
        .select()
        .single()
      story = data
      error = err2
    }

    if (error) {
      console.error('POST /api/projects/[id]/stories error:', error)
      return NextResponse.json({ error: 'Failed to create story' }, { status: 500 })
    }

    // 如果这是回应追问，更新追问状态
    if (body.followup_interaction_id) {
      console.log('[Story Creation] Updating followup interaction:', {
        followup_interaction_id: body.followup_interaction_id,
        answer_story_id: story.id,
        user_id: user.id
      })

      try {
        // 使用admin客户端来确保有权限更新interactions
        const admin = getSupabaseAdmin()
        const { error: updateError } = await admin
          .from('interactions')
          .update({
            answered_at: new Date().toISOString(),
            answer_story_id: story.id
          })
          .eq('id', body.followup_interaction_id)
          .eq('type', 'followup')

        if (updateError) {
          console.error('[Story Creation] Failed to update followup status:', updateError)
        } else {
          console.log('[Story Creation] Successfully updated followup status')
        }
      } catch (followupError) {
        console.error('[Story Creation] Error updating followup status:', followupError)
      }
    } else {
      console.log('[Story Creation] No followup_interaction_id provided')
    }

    // 发送通知给所有项目的 facilitators
    try {
      await sendNewStoryNotifications(db, story, user.id, body.responding_to_prompt_id)
    } catch (notificationError) {
      console.warn('Failed to send new story notifications:', notificationError)
      // 不影响故事创建的成功响应
    }

    return NextResponse.json({ story })
  } catch (err) {
    console.error('POST /api/projects/[id]/stories unexpected error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// 辅助函数：发送新故事通知给所有 facilitators
async function sendNewStoryNotifications(supabase: any, story: any, storytellerId: string, respondingToPromptId?: string) {
  // 使用admin客户端确保有足够权限创建通知
  const adminSupabase = getSupabaseAdmin()
  try {
    // 获取项目信息
    const { data: project } = await supabase
      .from('projects')
      .select('id, title, facilitator_id')
      .eq('id', story.project_id)
      .maybeSingle()

    if (!project) return

    // 获取故事讲述者信息
    let storytellerName = 'Unknown User'
    const { data: storytellerProfile } = await supabase
      .from('user_profiles')
      .select('name, email')
      .eq('id', storytellerId)
      .maybeSingle()
    if (storytellerProfile) {
      storytellerName = storytellerProfile.name || storytellerProfile.email || storytellerName
    }

    // 收集所有需要通知的 facilitators（包括项目所有者和协作 facilitators）
    const facilitatorIds = new Set<string>()

    // 添加项目所有者（facilitator_id）
    if (project.facilitator_id) {
      facilitatorIds.add(project.facilitator_id)
    }

    // 添加项目中的协作 facilitators
    const { data: projectRoles } = await supabase
      .from('project_roles')
      .select('user_id')
      .eq('project_id', story.project_id)
      .eq('role', 'facilitator')
      .eq('status', 'active')

    if (projectRoles) {
      projectRoles.forEach((role: any) => {
        if (role.user_id) facilitatorIds.add(role.user_id)
      })
    }

    // 检查是否是回应follow-up question
    let isResponseToFollowup = false
    let originalQuestionCreator = null

    if (respondingToPromptId) {
      const { data: userPrompt } = await supabase
        .from('user_prompts')
        .select('created_by, text')
        .eq('id', respondingToPromptId)
        .single()

      if (userPrompt) {
        isResponseToFollowup = true
        originalQuestionCreator = userPrompt.created_by
      }
    }

    // 为每个 facilitator 创建通知
    const notifications = Array.from(facilitatorIds).map(facilitatorId => {
      const isOriginalQuestioner = isResponseToFollowup && facilitatorId === originalQuestionCreator

      return {
        recipient_id: facilitatorId,
        sender_id: storytellerId,
        type: isOriginalQuestioner ? 'story_response' : 'new_story',
        title: isOriginalQuestioner ? 'Follow-up Question Answered' : 'New Story Recorded',
        message: isOriginalQuestioner
          ? `${storytellerName} answered your follow-up question with a new story "${story.title || story.ai_generated_title || 'Untitled'}"`
          : `${storytellerName} recorded a new story "${story.title || story.ai_generated_title || 'Untitled'}"`,
        data: {
          story_id: story.id,
          project_id: story.project_id,
          is_response_to_followup: isResponseToFollowup,
          responding_to_prompt_id: respondingToPromptId || null
        },
        action_url: `/dashboard/projects/${story.project_id}/stories/${story.id}`
      }
    })

    if (notifications.length > 0) {
      const { error } = await adminSupabase
        .from('notifications')
        .insert(notifications)

      if (error) {
        console.error('Error creating new story notifications:', error)
      }
    }
  } catch (error) {
    console.error('Error in sendNewStoryNotifications:', error)
    throw error
  }
}

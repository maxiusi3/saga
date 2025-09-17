import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'

// 返回某项目的 stories 列表（权限：项目成员或所有者）
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseCookie = createRouteHandlerClient({ cookies })
    const projectId = params.id

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

    // 权限：项目拥有者或 active 成员
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
      console.error('GET /api/projects/[id]/stories error:', error)
      return NextResponse.json({ stories: [] })
    }

    // 获取storyteller的用户资料信息
    const storytellerIds = Array.from(new Set(stories?.map((story: any) => story.storyteller_id).filter(Boolean)))
    let profilesMap: Record<string, { name?: string | null; email?: string | null; avatar_url?: string | null }> = {}

    if (storytellerIds.length > 0) {
      const { data: profiles, error: pErr } = await db
        .from('user_profiles')
        .select('id, name, email, avatar_url')
        .in('id', storytellerIds)

      if (!pErr && profiles) {
        profilesMap = Object.fromEntries(profiles.map((p: any) => [p.id, p]))
      }
    }

    // 为每个story添加storyteller信息
    const storiesWithProfiles = stories?.map((story: any) => {
      const profile = profilesMap[story.storyteller_id]
      return {
        ...story,
        storyteller_name: profile?.name || profile?.email || 'Unknown User',
        storyteller_avatar: profile?.avatar_url || null
      }
    })

    return NextResponse.json({ stories: storiesWithProfiles || [] })
  } catch (err) {
    console.error('GET /api/projects/[id]/stories unexpected error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}


// 创建故事（权限：项目成员或所有者），字段与前端保持一致
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

    // 权限：项目拥有者或 active 成员
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

    const { data: story, error } = await db
      .from('stories')
      .insert({
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
        status: 'ready'
      })
      .select()
      .single()

    if (error) {
      console.error('POST /api/projects/[id]/stories error:', error)
      return NextResponse.json({ error: 'Failed to create story' }, { status: 500 })
    }

    // 如果这是回应追问，更新追问状态
    if (body.followup_interaction_id) {
      try {
        const { error: updateError } = await db
          .from('interactions')
          .update({
            answered_at: new Date().toISOString(),
            answer_story_id: story.id
          })
          .eq('id', body.followup_interaction_id)
          .eq('type', 'followup')

        if (updateError) {
          console.error('Failed to update followup status:', updateError)
        }
      } catch (followupError) {
        console.error('Error updating followup status:', followupError)
      }
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

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(
  request: NextRequest,
  { params }: { params: { storyId: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { storyId } = params

    // 获取故事的所有交互记录
    const { data: interactions, error } = await supabase
      .from('interactions')
      .select(`
        *,
        facilitator:facilitator_id (
          id,
          email,
          user_metadata
        )
      `)
      .eq('story_id', storyId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching interactions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch interactions' },
        { status: 500 }
      )
    }

    // 格式化响应数据
    const formattedInteractions = interactions.map(interaction => ({
      id: interaction.id,
      story_id: interaction.story_id,
      facilitator_id: interaction.facilitator_id,
      type: interaction.type,
      content: interaction.content,
      answered_at: interaction.answered_at,
      created_at: interaction.created_at,
      facilitator_name: interaction.facilitator?.user_metadata?.full_name || 
                       interaction.facilitator?.email || 
                       'Unknown User',
      facilitator_avatar: interaction.facilitator?.user_metadata?.avatar_url
    }))

    return NextResponse.json(formattedInteractions)
  } catch (error) {
    console.error('Error in GET /api/stories/[storyId]/interactions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { storyId: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { storyId } = params

    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 解析请求体
    const body = await request.json()
    const { type, content } = body

    if (!type || !content || !['comment', 'followup'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      )
    }

    // 创建交互记录
    const { data: interaction, error } = await supabase
      .from('interactions')
      .insert({
        story_id: storyId,
        facilitator_id: user.id,
        type,
        content: content.trim()
      })
      .select(`
        *,
        facilitator:facilitator_id (
          id,
          email,
          user_metadata
        )
      `)
      .single()

    if (error) {
      console.error('Error creating interaction:', error)
      return NextResponse.json(
        { error: 'Failed to create interaction' },
        { status: 500 }
      )
    }

    // 如果是跟进问题，创建用户提示
    if (type === 'followup') {
      await createUserPromptFromFollowup(supabase, storyId, content, user.id)
    }

    // 发送通知
    await sendInteractionNotification(supabase, interaction)

    // 格式化响应
    const formattedInteraction = {
      id: interaction.id,
      story_id: interaction.story_id,
      facilitator_id: interaction.facilitator_id,
      type: interaction.type,
      content: interaction.content,
      answered_at: interaction.answered_at,
      created_at: interaction.created_at,
      facilitator_name: interaction.facilitator?.user_metadata?.full_name || 
                       interaction.facilitator?.email || 
                       'Unknown User',
      facilitator_avatar: interaction.facilitator?.user_metadata?.avatar_url
    }

    return NextResponse.json(formattedInteraction, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/stories/[storyId]/interactions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 辅助函数：从跟进问题创建用户提示
async function createUserPromptFromFollowup(
  supabase: any,
  storyId: string,
  content: string,
  facilitatorId: string
) {
  try {
    // 获取故事信息以获取项目ID
    const { data: story, error: storyError } = await supabase
      .from('stories')
      .select('project_id')
      .eq('id', storyId)
      .single()

    if (storyError || !story) {
      console.error('Error fetching story for user prompt:', storyError)
      return
    }

    // 创建用户提示
    const { error } = await supabase
      .from('user_prompts')
      .insert({
        project_id: story.project_id,
        created_by: facilitatorId,
        parent_story_id: storyId,
        text: content,
        priority: 1, // 跟进问题优先级最高
        is_delivered: false
      })

    if (error) {
      console.error('Error creating user prompt:', error)
    }
  } catch (error) {
    console.error('Error creating user prompt from followup:', error)
  }
}

// 辅助函数：发送交互通知
async function sendInteractionNotification(supabase: any, interaction: any) {
  try {
    // 获取故事信息
    const { data: story, error: storyError } = await supabase
      .from('stories')
      .select(`
        id,
        title,
        storyteller_id,
        project_id,
        project:project_id (
          name
        )
      `)
      .eq('id', interaction.story_id)
      .single()

    if (storyError || !story) {
      console.error('Error fetching story for notification:', storyError)
      return
    }

    // 创建通知
    const notificationType = interaction.type === 'comment' ? 'new_comment' : 'new_follow_up_question'
    
    const { error } = await supabase
      .from('notifications')
      .insert({
        recipient_id: story.storyteller_id,
        sender_id: interaction.facilitator_id,
        type: notificationType,
        title: interaction.type === 'comment' ? 'New Comment' : 'New Follow-up Question',
        message: interaction.type === 'comment' 
          ? `Someone commented on your story "${story.title || 'Untitled'}"`
          : `Someone asked a follow-up question about your story "${story.title || 'Untitled'}"`,
        data: {
          story_id: story.id,
          project_id: story.project_id,
          interaction_id: interaction.id
        }
      })

    if (error) {
      console.error('Error creating notification:', error)
    }
  } catch (error) {
    console.error('Error sending interaction notification:', error)
  }
}

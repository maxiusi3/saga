import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { storyId: string } }
) {
  try {
    const supabaseCookie = createRouteHandlerClient({ cookies })
    const { storyId } = params

    // Cookies 优先，Bearer 回退（避免跨域或预览环境下 cookie 丢失导致 401）
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

    // 获取故事的所有交互记录（按实际表结构：interactions.user_id）
    const { data: interactions, error } = await db
      .from('interactions')
      .select('*')
      .eq('story_id', storyId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching interactions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch interactions' },
        { status: 500 }
      )
    }

    const list = interactions || []

    // 批量查询用户资料以展示名称与头像
    const userIds = Array.from(new Set(list.map((it: any) => it.user_id).filter(Boolean)))
    let profilesMap: Record<string, { name?: string | null; email?: string | null; avatar_url?: string | null }> = {}
    if (userIds.length > 0) {
      const { data: profiles, error: pErr } = await db
        .from('user_profiles')
        .select('id, name, email, avatar_url')
        .in('id', userIds)

      if (pErr) {
        console.warn('Warning: failed to fetch user profiles for interactions:', pErr)
      } else {
        profilesMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]))
      }
    }

    // 格式化响应数据，维持前端所需字段名称（facilitator_id 等）
    const formattedInteractions = list.map((interaction: any) => {
      const profile = profilesMap[interaction.user_id] || {}
      return {
        id: interaction.id,
        story_id: interaction.story_id,
        facilitator_id: interaction.user_id, // 向下兼容前端字段名
        type: interaction.type,
        content: interaction.content,
        created_at: interaction.created_at,
        answered_at: interaction.answered_at, // 若无此列则为 undefined
        facilitator_name: profile.name || profile.email || 'Unknown User',
        facilitator_avatar: profile.avatar_url || null,
      }
    })

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
    const supabaseCookie = createRouteHandlerClient({ cookies })
    const { storyId } = params

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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 为避免 RLS 导致 Facilitator 无法读取他人故事，这里使用 Admin 客户端执行权限判定与写入
    const admin = getSupabaseAdmin()
    const dbRead = admin
    const dbWrite = admin

    // 解析请求体
    const body = await request.json()
    const { type, content } = body

    if (!type || !content || !['comment', 'followup'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      )
    }

    // 权限：仅允许项目 Facilitator 或项目拥有者评论/追问
    // 首先找到该故事所属项目及讲述者（按实际表结构：stories.user_id 为讲述者）
    const { data: storyRow, error: storyErr } = await dbRead
      .from('stories')
      .select('id, project_id, user_id')
      .eq('id', storyId)
      .maybeSingle()

    if (storyErr || !storyRow) {
      console.error('Error fetching story before interaction insert:', storyErr)
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    // 读取该项目的 facilitator_id 与成员角色
    const { data: projectRow } = await dbRead
      .from('projects')
      .select('facilitator_id')
      .eq('id', storyRow.project_id)
      .maybeSingle()

    const { data: roleRow } = await dbRead
      .from('project_roles')
      .select('role, status')
      .eq('project_id', storyRow.project_id)
      .eq('user_id', user.id)
      .maybeSingle()

    const isOwner = projectRow?.facilitator_id === user.id
    const isActiveMember = !!roleRow && roleRow.status === 'active'
    const isFacilitator = isOwner || (roleRow?.role === 'facilitator' && isActiveMember)

    if (!isFacilitator) {
      // 允许故事讲述者对“自己的故事”回复评论（若需求如此，可放开）
      if (!(storyRow.user_id === user.id && type === 'comment')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // 创建交互记录（按实际表结构：interactions.user_id）
    const { data: interaction, error } = await dbWrite
      .from('interactions')
      .insert({
        story_id: storyId,
        user_id: user.id,
        type,
        content: content.trim()
      })
      .select('*')
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
      await createUserPromptFromFollowup(db, storyId, content, user.id)
    }

    // 发送通知
    await sendInteractionNotification(db, interaction)

    // 查询提交者资料
    let facilitator_name = 'Unknown User'
    let facilitator_avatar: string | null = null
    const { data: selfProfile } = await db
      .from('user_profiles')
      .select('name, email, avatar_url')
      .eq('id', user.id)
      .maybeSingle()
    if (selfProfile) {
      facilitator_name = selfProfile.name || selfProfile.email || 'Unknown User'
      facilitator_avatar = selfProfile.avatar_url || null
    }

    // 格式化响应
    const formattedInteraction = {
      id: interaction.id,
      story_id: interaction.story_id,
      facilitator_id: interaction.user_id,
      type: interaction.type,
      content: interaction.content,
      answered_at: interaction.answered_at,
      created_at: interaction.created_at,
      facilitator_name,
      facilitator_avatar
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
    // 获取故事信息（按实际表结构：stories.user_id 为讲述者）
    const { data: story, error: storyError } = await supabase
      .from('stories')
      .select('id, title, user_id, project_id')
      .eq('id', interaction.story_id)
      .single()

    if (storyError || !story) {
      console.error('Error fetching story for notification:', storyError)
      return
    }

    // 创建通知（简化 data 结构，避免跨 schema 关联）
    const notificationType = interaction.type === 'comment' ? 'new_comment' : 'new_follow_up_question'
    const { error } = await supabase
      .from('notifications')
      .insert({
        recipient_id: story.user_id,
        sender_id: interaction.user_id,
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

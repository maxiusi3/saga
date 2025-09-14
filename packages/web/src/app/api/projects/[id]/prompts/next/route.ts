import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseCookie = createRouteHandlerClient({ cookies })
    const { id: projectId } = params

    // 鉴权：Cookies 优先，Bearer 回退
    let user: any = null
    let db: any = supabaseCookie

    const cookieAuth = await supabaseCookie.auth.getUser()
    if (cookieAuth.data.user && !cookieAuth.error) {
      user = cookieAuth.data.user
    } else {
      const authHeader = request.headers.get('authorization')
      const token = authHeader?.replace('Bearer ', '')
      if (token) {
        const admin = getSupabaseAdmin()
        const { data: tokenUser } = await admin.auth.getUser(token)
        if (tokenUser?.user) {
          user = tokenUser.user
          db = admin
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 验证用户是否有权限访问该项目（使用与鉴权一致的客户端）
    const { data: projectRole, error: roleError } = await db
      .from('project_roles')
      .select('role, status')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (roleError || !projectRole) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    // 首先检查是否有用户提示（优先级更高）
    const { data: userPrompts, error: userPromptError } = await db
      .from('user_prompts')
      .select(`
        *,
        creator:created_by (
          id,
          email,
          user_metadata
        ),
        parent_story:parent_story_id (
          id,
          title
        )
      `)
      .eq('project_id', projectId)
      .eq('is_delivered', false)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)

    if (userPromptError) {
      console.error('Error fetching user prompts:', userPromptError)
    } else if (userPrompts && userPrompts.length > 0) {
      const userPrompt = userPrompts[0]
      return NextResponse.json({
        prompt: {
          id: userPrompt.id,
          text: userPrompt.text,
          type: 'user',
          priority: userPrompt.priority,
          created_by: userPrompt.created_by,
          creator_name: userPrompt.creator?.user_metadata?.full_name || 
                       userPrompt.creator?.email || 
                       'Unknown User',
          parent_story_id: userPrompt.parent_story_id,
          parent_story_title: userPrompt.parent_story?.title,
          created_at: userPrompt.created_at
        },
        is_user_prompt: true
      })
    }

    // 如果没有用户提示，获取系统提示
    const { data: promptState } = await db
      .from('project_prompt_state')
      .select('*')
      .eq('project_id', projectId)
      .single()

    if (!promptState || !promptState.current_chapter_id) {
      // 初始化项目提示状态
      const { data: firstChapter } = await db
        .from('chapters')
        .select('id')
        .eq('is_active', true)
        .order('order_index', { ascending: true })
        .limit(1)
        .single()

      if (!firstChapter) {
        return NextResponse.json({ prompt: null, is_user_prompt: false })
      }

      // 创建初始状态
      const { data: newPromptState, error: createError } = await db
        .from('project_prompt_state')
        .insert({
          project_id: projectId,
          current_chapter_id: firstChapter.id,
          current_prompt_index: 0
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating prompt state:', createError)
        return NextResponse.json(
          { error: 'Failed to initialize prompt state' },
          { status: 500 }
        )
      }

      // 使用新创建的状态
      const currentPromptState = newPromptState
      
      // 获取第一个提示
      const { data: prompts, error: promptsError } = await db
        .from('prompts')
        .select(`
          *,
          chapter:chapter_id (
            id,
            name,
            description
          )
        `)
        .eq('chapter_id', currentPromptState.current_chapter_id)
        .eq('is_active', true)
        .order('order_index', { ascending: true })

      if (promptsError || !prompts || prompts.length === 0) {
        return NextResponse.json({ prompt: null, is_user_prompt: false })
      }

      const currentPrompt = prompts[currentPromptState.current_prompt_index]
      if (!currentPrompt) {
        return NextResponse.json({ prompt: null, is_user_prompt: false })
      }

      return NextResponse.json({
        prompt: {
          id: currentPrompt.id,
          text: currentPrompt.text,
          type: 'system',
          chapter_id: currentPrompt.chapter_id,
          chapter_name: currentPrompt.chapter?.name,
          chapter_description: currentPrompt.chapter?.description,
          order_index: currentPrompt.order_index,
          created_at: currentPrompt.created_at
        },
        is_user_prompt: false
      })
    }

    // 获取当前章节的提示
    const { data: prompts, error: promptsError } = await db
      .from('prompts')
      .select(`
        *,
        chapter:chapter_id (
          id,
          name,
          description
        )
      `)
      .eq('chapter_id', promptState.current_chapter_id)
      .eq('is_active', true)
      .order('order_index', { ascending: true })

    if (promptsError) {
      console.error('Error fetching prompts:', promptsError)
      return NextResponse.json(
        { error: 'Failed to fetch prompts' },
        { status: 500 }
      )
    }

    if (!prompts || prompts.length === 0) {
      return NextResponse.json({ prompt: null, is_user_prompt: false })
    }

    // 获取当前索引的提示
    const currentPrompt = prompts[promptState.current_prompt_index]
    if (!currentPrompt) {
      // 当前章节已完成，检查是否有下一章节
      const { data: nextChapter } = await db
        .from('chapters')
        .select('id')
        .eq('is_active', true)
        .gt('order_index', (await db
          .from('chapters')
          .select('order_index')
          .eq('id', promptState.current_chapter_id)
          .single()
        ).data?.order_index || 0)
        .order('order_index', { ascending: true })
        .limit(1)
        .single()

      if (nextChapter) {
        // 移动到下一章节
        await db
          .from('project_prompt_state')
          .update({
            current_chapter_id: nextChapter.id,
            current_prompt_index: 0,
            updated_at: new Date().toISOString()
          })
          .eq('project_id', projectId)

        // 递归调用获取下一章节的第一个提示
        return GET(request, { params })
      }

      return NextResponse.json({ prompt: null, is_user_prompt: false })
    }

    return NextResponse.json({
      prompt: {
        id: currentPrompt.id,
        text: currentPrompt.text,
        type: 'system',
        chapter_id: currentPrompt.chapter_id,
        chapter_name: currentPrompt.chapter?.name,
        chapter_description: currentPrompt.chapter?.description,
        order_index: currentPrompt.order_index,
        created_at: currentPrompt.created_at
      },
      is_user_prompt: false
    })
  } catch (error) {
    console.error('Error in GET /api/projects/[id]/prompts/next:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseCookie = createRouteHandlerClient({ cookies })
    const { id: projectId } = params

    // 鉴权：Cookies 优先，Bearer 回退
    let user: any = null
    let db: any = supabaseCookie

    const cookieAuth = await supabaseCookie.auth.getUser()
    if (cookieAuth.data.user && !cookieAuth.error) {
      user = cookieAuth.data.user
    } else {
      const authHeader = request.headers.get('authorization')
      const token = authHeader?.replace('Bearer ', '')
      if (token) {
        const admin = getSupabaseAdmin()
        const { data: tokenUser } = await admin.auth.getUser(token)
        if (tokenUser?.user) {
          user = tokenUser.user
          db = admin
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { prompt_id, is_user_prompt } = body

    if (!prompt_id) {
      return NextResponse.json(
        { error: 'Prompt ID is required' },
        { status: 400 }
      )
    }

    if (is_user_prompt) {
      // 标记用户提示为已交付
      const { error } = await db
        .from('user_prompts')
        .update({ 
          is_delivered: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', prompt_id)
        .eq('project_id', projectId)

      if (error) {
        console.error('Error marking user prompt as delivered:', error)
        return NextResponse.json(
          { error: 'Failed to mark prompt as delivered' },
          { status: 500 }
        )
      }
    } else {
      // 更新项目提示状态
      const { error } = await db
        .from('project_prompt_state')
        .update({
          current_prompt_index: db.rpc ? db.raw('current_prompt_index + 1') : (undefined as any),
          last_prompt_delivered_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('project_id', projectId)

      if (error) {
        console.error('Error updating project prompt state:', error)
        return NextResponse.json(
          { error: 'Failed to update prompt state' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in POST /api/projects/[id]/prompts/next:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

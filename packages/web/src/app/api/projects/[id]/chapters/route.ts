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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 验证用户是否有权限访问该项目
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

    // 获取所有活跃章节
    const { data: chapters, error: chaptersError } = await db
      .from('chapters')
      .select('*')
      .eq('is_active', true)
      .order('order_index', { ascending: true })

    if (chaptersError) {
      console.error('Error fetching chapters:', chaptersError)
      return NextResponse.json(
        { error: 'Failed to fetch chapters' },
        { status: 500 }
      )
    }

    // 获取项目的提示状态
    const { data: promptState } = await db
      .from('project_prompt_state')
      .select('*')
      .eq('project_id', projectId)
      .single()

    // 获取每个章节的进度信息
    const progressPromises = chapters.map(async (chapter) => {
      // 获取章节的提示数量
      const { count: totalPrompts } = await db
        .from('prompts')
        .select('*', { count: 'exact', head: true })
        .eq('chapter_id', chapter.id)
        .eq('is_active', true)

      // 获取该章节已完成的故事数量
      const { data: completedStories } = await db
        .from('stories')
        .select('prompt_id')
        .eq('project_id', projectId)
        .not('prompt_id', 'is', null)

      // 计算该章节已完成的提示数量
      const { data: chapterPrompts } = await db
        .from('prompts')
        .select('id')
        .eq('chapter_id', chapter.id)
        .eq('is_active', true)

      const chapterPromptIds = chapterPrompts?.map(p => p.id) || []
      const completedPromptsInChapter = completedStories?.filter(story => 
        chapterPromptIds.includes(story.prompt_id)
      ).length || 0

      // 获取该章节的故事总数
      const { count: storiesCount } = await db
        .from('stories')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('chapter_id', chapter.id)

      return {
        chapter: {
          id: chapter.id,
          name: chapter.name,
          description: chapter.description,
          order_index: chapter.order_index,
          is_active: chapter.is_active,
          created_at: chapter.created_at
        },
        completed_prompts: completedPromptsInChapter,
        total_prompts: totalPrompts || 0,
        stories_count: storiesCount || 0,
        is_current: promptState?.current_chapter_id === chapter.id
      }
    })

    const progress = await Promise.all(progressPromises)

    return NextResponse.json({
      chapters: chapters.map(chapter => ({
        id: chapter.id,
        name: chapter.name,
        description: chapter.description,
        order_index: chapter.order_index,
        is_active: chapter.is_active,
        created_at: chapter.created_at
      })),
      progress,
      prompt_state: promptState ? {
        project_id: promptState.project_id,
        current_chapter_id: promptState.current_chapter_id,
        current_prompt_index: promptState.current_prompt_index,
        last_prompt_delivered_at: promptState.last_prompt_delivered_at,
        updated_at: promptState.updated_at
      } : null
    })
  } catch (error) {
    console.error('Error in GET /api/projects/[id]/chapters:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'

// Get pending follow-up questions for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseCookie = createRouteHandlerClient({ cookies })
    const projectId = (await params).id

    // Cookies 优先，Bearer 回退 (same as stories API)
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

    // Check if user has access to this project (same logic as stories API)
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
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get stories for this project first
    const { data: projectStories, error: storiesError } = await db
      .from('stories')
      .select('id, title')
      .eq('project_id', projectId)

    if (storiesError) {
      console.error('Error fetching project stories:', storiesError)
      return NextResponse.json({ error: 'Failed to fetch stories' }, { status: 500 })
    }

    if (!projectStories || projectStories.length === 0) {
      return NextResponse.json({ interactions: [] })
    }

    // Get story IDs for this project
    const storyIds = projectStories.map(s => s.id)

    // Get pending follow-up questions for stories in this project
    const { data: interactions, error: interactionsError } = await db
      .from('interactions')
      .select('id, content, created_at, story_id')
      .eq('type', 'followup')
      .is('answer_story_id', null)
      .is('answered_at', null)
      .in('story_id', storyIds)
      .order('created_at', { ascending: false })

    // Create a map of story titles
    const storyTitleMap = Object.fromEntries(
      projectStories.map(s => [s.id, s.title])
    )

    if (interactionsError) {
      console.error('Error fetching pending interactions:', {
        error: interactionsError,
        projectId,
        userId: user.id,
        query: 'interactions with stories join'
      })
      return NextResponse.json({
        error: 'Failed to fetch interactions',
        details: interactionsError.message
      }, { status: 500 })
    }

    // Format the response to include story title
    const formattedInteractions = interactions?.map((interaction: any) => ({
      id: interaction.id,
      content: interaction.content,
      created_at: interaction.created_at,
      story_id: interaction.story_id,
      story_title: storyTitleMap[interaction.story_id] || 'Unknown Story'
    })) || []

    return NextResponse.json({ interactions: formattedInteractions })
  } catch (err) {
    console.error('GET /api/projects/[id]/interactions/pending unexpected error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

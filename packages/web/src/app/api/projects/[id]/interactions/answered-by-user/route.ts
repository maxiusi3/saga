import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * Get answered follow-up questions created by the current user for a specific project
 * This endpoint is used by facilitators to see their follow-up questions that have been answered
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseCookie = createRouteHandlerClient({ cookies })
    const projectId = params.id

    // Use the same auth pattern as working endpoints
    let user: any = null
    let db: any = supabaseCookie

    // First try cookies
    const cookieAuth = await supabaseCookie.auth.getUser()
    if (cookieAuth.data.user && !cookieAuth.error) {
      user = cookieAuth.data.user
    } else {
      // Fallback to Bearer token with admin client
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

    // Check if user has access to this project
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
    const storyIds = projectStories.map((s: any) => s.id)

    // Get answered follow-up questions created by the current user for stories in this project
    const { data: interactions, error: interactionsError } = await db
      .from('interactions')
      .select('id, content, created_at, answered_at, story_id, answer_story_id')
      .eq('type', 'followup')
      .eq('facilitator_id', user.id) // Only questions created by this user
      .not('answered_at', 'is', null) // Only answered questions
      .in('story_id', storyIds)
      .order('answered_at', { ascending: false })

    if (interactionsError) {
      console.error('Error fetching answered interactions:', interactionsError)
      return NextResponse.json({ error: 'Failed to fetch interactions' }, { status: 500 })
    }

    // Create a map of story titles
    const storyTitleMap = Object.fromEntries(
      projectStories.map((s: any) => [s.id, s.title])
    )

    // Add story titles to interactions
    const interactionsWithTitles = (interactions || []).map((interaction: any) => ({
      ...interaction,
      story_title: storyTitleMap[interaction.story_id] || 'Unknown Story'
    }))

    return NextResponse.json({ interactions: interactionsWithTitles })

  } catch (error) {
    console.error('Error in answered-by-user API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
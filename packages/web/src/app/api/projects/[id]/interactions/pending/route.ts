import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminSupabase } from '@/lib/supabase'

// Get pending follow-up questions for a project
export async function GET(
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
        const { data: { user: tokenUser }, error: tokenError } = await supabaseCookie.auth.getUser(token)
        if (tokenUser && !tokenError) {
          user = tokenUser
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has access to this project
    const { data: membership, error: membershipError } = await db
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get pending follow-up questions (type = 'followup' and both answer_story_id and answered_at are null)
    const { data: interactions, error: interactionsError } = await db
      .from('interactions')
      .select(`
        id,
        content,
        created_at,
        story_id,
        stories!inner(
          id,
          title,
          storyteller_id
        )
      `)
      .eq('type', 'followup')
      .is('answer_story_id', null)
      .is('answered_at', null)
      .eq('stories.project_id', projectId)
      .order('created_at', { ascending: false })

    if (interactionsError) {
      console.error('Error fetching pending interactions:', interactionsError)
      return NextResponse.json({ error: 'Failed to fetch interactions' }, { status: 500 })
    }

    // Format the response to include story title
    const formattedInteractions = interactions?.map((interaction: any) => ({
      id: interaction.id,
      content: interaction.content,
      created_at: interaction.created_at,
      story_id: interaction.story_id,
      story_title: interaction.stories.title
    })) || []

    return NextResponse.json({ interactions: formattedInteractions })
  } catch (err) {
    console.error('GET /api/projects/[id]/interactions/pending unexpected error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

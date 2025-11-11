import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// PATCH /api/stories/:storyId/images/reorder - Reorder images
export async function PATCH(
  request: NextRequest,
  { params }: { params: { storyId: string } }
) {
  try {
    const { storyId } = params
    console.log('[Story Images Reorder API] PATCH request for story:', storyId)

    // Get authenticated user
    const supabase = createRouteHandlerClient({ cookies })
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use admin client
    const admin = getSupabaseAdmin()

    // Verify story exists and user is the storyteller
    const { data: story, error: storyError } = await admin
      .from('stories')
      .select('id, user_id')
      .eq('id', storyId)
      .single()

    if (storyError || !story) {
      console.error('[Story Images Reorder API] Story not found:', storyError)
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    if (story.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the storyteller can reorder images' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { image_ids } = body

    if (!image_ids || !Array.isArray(image_ids)) {
      return NextResponse.json(
        { error: 'Invalid request: image_ids array required' },
        { status: 400 }
      )
    }

    // Verify all images belong to this story
    const { data: images, error: imagesError } = await admin
      .from('story_images')
      .select('id')
      .eq('story_id', storyId)
      .in('id', image_ids)

    if (imagesError || !images) {
      console.error('[Story Images Reorder API] Error fetching images:', imagesError)
      return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 })
    }

    if (images.length !== image_ids.length) {
      return NextResponse.json(
        { error: 'Some images do not belong to this story' },
        { status: 400 }
      )
    }

    // Update order_index for each image
    const updates = image_ids.map((imageId, index) =>
      admin.from('story_images').update({ order_index: index }).eq('id', imageId)
    )

    await Promise.all(updates)

    console.log('[Story Images Reorder API] Images reordered successfully')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Story Images Reorder API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

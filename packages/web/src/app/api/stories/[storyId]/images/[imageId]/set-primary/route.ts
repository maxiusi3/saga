import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// PATCH /api/stories/:storyId/images/:imageId/set-primary - Set image as primary
export async function PATCH(
  _request: NextRequest,
  { params }: { params: { storyId: string; imageId: string } }
) {
  try {
    const { storyId, imageId } = params
    console.log('[Set Primary Image API] PATCH request for image:', imageId)

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
      console.error('[Set Primary Image API] Story not found:', storyError)
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    if (story.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the storyteller can set primary image' },
        { status: 403 }
      )
    }

    // Verify image exists and belongs to story
    const { data: image, error: imageError } = await admin
      .from('story_images')
      .select('id')
      .eq('id', imageId)
      .eq('story_id', storyId)
      .single()

    if (imageError || !image) {
      console.error('[Set Primary Image API] Image not found:', imageError)
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Unset current primary image
    await admin
      .from('story_images')
      .update({ is_primary: false })
      .eq('story_id', storyId)
      .eq('is_primary', true)

    // Set new primary image
    const { error: updateError } = await admin
      .from('story_images')
      .update({ is_primary: true })
      .eq('id', imageId)

    if (updateError) {
      console.error('[Set Primary Image API] Update error:', updateError)
      return NextResponse.json({ error: 'Failed to set primary image' }, { status: 500 })
    }

    console.log('[Set Primary Image API] Primary image set successfully:', imageId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Set Primary Image API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

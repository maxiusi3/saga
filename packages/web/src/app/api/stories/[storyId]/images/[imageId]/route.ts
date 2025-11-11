import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'
import { deleteImage } from '@/lib/storage-service'

export const dynamic = 'force-dynamic'

// DELETE /api/stories/:storyId/images/:imageId - Delete an image
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { storyId: string; imageId: string } }
) {
  try {
    const { storyId, imageId } = params
    console.log('[Story Image API] DELETE request for image:', imageId)

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
      console.error('[Story Image API] Story not found:', storyError)
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    if (story.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the storyteller can delete images' },
        { status: 403 }
      )
    }

    // Get image record
    const { data: image, error: imageError } = await admin
      .from('story_images')
      .select('*')
      .eq('id', imageId)
      .eq('story_id', storyId)
      .single()

    if (imageError || !image) {
      console.error('[Story Image API] Image not found:', imageError)
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    const wasPrimary = image.is_primary

    // Delete from storage
    const { error: storageError } = await deleteImage(image.storage_path)

    if (storageError) {
      console.error('[Story Image API] Storage delete error:', storageError)
      // Continue with database deletion even if storage fails
    }

    // Delete from database
    const { error: deleteError } = await admin.from('story_images').delete().eq('id', imageId)

    if (deleteError) {
      console.error('[Story Image API] Database delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 })
    }

    // If deleted image was primary, set next image as primary
    if (wasPrimary) {
      const { data: nextImage } = await admin
        .from('story_images')
        .select('id')
        .eq('story_id', storyId)
        .order('order_index', { ascending: true })
        .limit(1)
        .single()

      if (nextImage) {
        await admin.from('story_images').update({ is_primary: true }).eq('id', nextImage.id)
      }
    }

    console.log('[Story Image API] Image deleted successfully:', imageId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Story Image API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

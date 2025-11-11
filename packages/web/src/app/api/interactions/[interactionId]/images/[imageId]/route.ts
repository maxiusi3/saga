import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'
import { deleteImage } from '@/lib/storage-service'

export const dynamic = 'force-dynamic'

// DELETE /api/interactions/:interactionId/images/:imageId - Delete an interaction image
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { interactionId: string; imageId: string } }
) {
  try {
    const { interactionId, imageId } = params
    console.log('[Interaction Image API] DELETE request for image:', imageId)

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

    // Get image record
    const { data: image, error: imageError } = await admin
      .from('interaction_images')
      .select('*')
      .eq('id', imageId)
      .eq('interaction_id', interactionId)
      .single()

    if (imageError || !image) {
      console.error('[Interaction Image API] Image not found:', imageError)
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Verify user is the uploader
    if (image.uploaded_by !== user.id) {
      return NextResponse.json(
        { error: 'Only the uploader can delete this image' },
        { status: 403 }
      )
    }

    // Delete from storage
    const { error: storageError } = await deleteImage(image.storage_path)

    if (storageError) {
      console.error('[Interaction Image API] Storage delete error:', storageError)
      // Continue with database deletion even if storage fails
    }

    // Delete from database
    const { error: deleteError } = await admin
      .from('interaction_images')
      .delete()
      .eq('id', imageId)

    if (deleteError) {
      console.error('[Interaction Image API] Database delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 })
    }

    console.log('[Interaction Image API] Image deleted successfully:', imageId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Interaction Image API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

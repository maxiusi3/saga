import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'
import { uploadImage, generateInteractionImagePath, getSignedImageUrl } from '@/lib/storage-service'
import { IMAGE_VALIDATION } from '@saga/shared/types/image'

export const dynamic = 'force-dynamic'

// POST /api/interactions/:interactionId/images - Upload image for interaction
export async function POST(
  request: NextRequest,
  { params }: { params: { interactionId: string } }
) {
  try {
    const { interactionId } = params
    console.log('[Interaction Images API] POST request for interaction:', interactionId)

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

    // Verify interaction exists and user has access
    const { data: interaction, error: interactionError } = await admin
      .from('interactions')
      .select('id, story_id')
      .eq('id', interactionId)
      .single()

    if (interactionError || !interaction) {
      console.error('[Interaction Images API] Interaction not found:', interactionError)
      return NextResponse.json({ error: 'Interaction not found' }, { status: 404 })
    }

    // Verify user is a project member
    const { data: story } = await admin
      .from('stories')
      .select('project_id')
      .eq('id', interaction.story_id)
      .single()

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    const { data: membership } = await admin
      .from('project_members')
      .select('id')
      .eq('project_id', story.project_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!membership) {
      return NextResponse.json(
        { error: 'Only project members can upload images to interactions' },
        { status: 403 }
      )
    }

    // Check current image count for this interaction
    const { count: imageCount, error: countError } = await admin
      .from('interaction_images')
      .select('*', { count: 'exact', head: true })
      .eq('interaction_id', interactionId)

    if (countError) {
      console.error('[Interaction Images API] Error counting images:', countError)
      return NextResponse.json({ error: 'Failed to check image count' }, { status: 500 })
    }

    if ((imageCount || 0) >= IMAGE_VALIDATION.MAX_IMAGES_PER_INTERACTION) {
      return NextResponse.json(
        {
          error: 'Maximum number of images reached',
          details: `Maximum ${IMAGE_VALIDATION.MAX_IMAGES_PER_INTERACTION} images per interaction`,
        },
        { status: 400 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file size
    if (file.size > IMAGE_VALIDATION.MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: 'File too large',
          details: `Maximum file size: ${IMAGE_VALIDATION.MAX_FILE_SIZE / (1024 * 1024)}MB`,
        },
        { status: 400 }
      )
    }

    // Validate file type
    if (!IMAGE_VALIDATION.SUPPORTED_FORMATS.includes(file.type)) {
      return NextResponse.json(
        {
          error: 'Unsupported file format',
          details: `Supported formats: ${IMAGE_VALIDATION.SUPPORTED_EXTENSIONS.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Generate storage path
    const storagePath = generateInteractionImagePath(interactionId, file.name)

    // Upload to storage
    const { error: uploadError } = await uploadImage(file, storagePath)

    if (uploadError) {
      console.error('[Interaction Images API] Upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
    }

    // Get next order index
    const { data: existingImages } = await admin
      .from('interaction_images')
      .select('order_index')
      .eq('interaction_id', interactionId)
      .order('order_index', { ascending: false })
      .limit(1)

    const nextOrderIndex =
      existingImages && existingImages.length > 0 ? existingImages[0].order_index + 1 : 0

    // Create database record
    const { data: image, error: insertError } = await admin
      .from('interaction_images')
      .insert({
        interaction_id: interactionId,
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        order_index: nextOrderIndex,
        uploaded_by: user.id,
      })
      .select()
      .single()

    if (insertError || !image) {
      console.error('[Interaction Images API] Database insert error:', insertError)
      // Clean up uploaded file
      await admin.storage.from('saga').remove([storagePath])
      return NextResponse.json({ error: 'Failed to create image record' }, { status: 500 })
    }

    // Generate signed URL
    const { url } = await getSignedImageUrl(storagePath)

    console.log('[Interaction Images API] Image uploaded successfully:', image.id)
    return NextResponse.json(
      {
        image: {
          ...image,
          url,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[Interaction Images API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

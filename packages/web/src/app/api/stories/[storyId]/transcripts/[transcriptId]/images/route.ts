import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'
import { generateTranscriptImagePath, getSignedImageUrl, generateThumbnailPath } from '@/lib/storage-service'
import sharp from 'sharp'
import { IMAGE_VALIDATION } from '@saga/shared/types/image'

export const dynamic = 'force-dynamic'

// POST /api/stories/:storyId/transcripts/:transcriptId/images - Upload image for transcript
export async function POST(
  request: NextRequest,
  { params }: { params: { storyId: string; transcriptId: string } }
) {
  try {
    const { storyId, transcriptId } = params
    console.log('[Transcript Images API] POST request for story:', storyId, 'transcript:', transcriptId)

    // Get authenticated user
    const supabase = createRouteHandlerClient({ cookies })
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use admin client to bypass RLS for verification
    const admin = getSupabaseAdmin()

    // Verify story exists and user is the storyteller
    const { data: story, error: storyError } = await admin
      .from('stories')
      .select('id, user_id')
      .eq('id', storyId)
      .single()

    if (storyError || !story) {
      console.error('[Transcript Images API] Story not found:', storyError)
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    if (story.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the storyteller can upload images' },
        { status: 403 }
      )
    }

    // Verify transcript exists and belongs to story
    const { data: transcript, error: transcriptError } = await admin
      .from('story_transcripts')
      .select('id, sequence_number')
      .eq('id', transcriptId)
      .eq('story_id', storyId)
      .single()

    if (transcriptError || !transcript) {
      console.error('[Transcript Images API] Transcript not found:', transcriptError)
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
    }

    // Check current image count for this transcript
    const { count: imageCount, error: countError } = await admin
      .from('story_images')
      .select('*', { count: 'exact', head: true })
      .eq('transcript_id', transcriptId)

    if (countError) {
      console.error('[Transcript Images API] Error counting images:', countError)
      return NextResponse.json({ error: 'Failed to check image count' }, { status: 500 })
    }

    if ((imageCount || 0) >= IMAGE_VALIDATION.MAX_IMAGES_PER_TRANSCRIPT) {
      return NextResponse.json(
        {
          error: 'Maximum number of images reached',
          details: `Maximum ${IMAGE_VALIDATION.MAX_IMAGES_PER_TRANSCRIPT} images per transcript`,
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
    const storagePath = generateTranscriptImagePath(storyId, transcript.sequence_number, file.name)

    const adminStorage = getSupabaseAdmin().storage
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await adminStorage
      .from('saga')
      .upload(storagePath, fileBuffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      console.error('[Transcript Images API] Upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
    }

    // Generate thumbnail with watermark and get dimensions
    const meta = await sharp(fileBuffer).metadata()
    const width = meta.width || null
    const height = meta.height || null
    const thumbnailPath = generateThumbnailPath(storagePath)
    const watermarkSvg = Buffer.from(
      `<svg width="400" height="400"><rect width="400" height="400" fill="transparent"/><text x="10" y="390" font-size="20" fill="rgba(255,255,255,0.7)">© Saga</text></svg>`
    )
    const thumbnailBuffer = await sharp(fileBuffer)
      .resize(400, 400, { fit: 'cover' })
      .composite([{ input: watermarkSvg, gravity: 'southeast' }])
      .jpeg({ quality: 80 })
      .toBuffer()
    await adminStorage.from('saga').upload(thumbnailPath, thumbnailBuffer, { contentType: 'image/jpeg', upsert: false })

    // Get next order index
    const { data: existingImages } = await admin
      .from('story_images')
      .select('order_index')
      .eq('transcript_id', transcriptId)
      .order('order_index', { ascending: false })
      .limit(1)

    const nextOrderIndex =
      existingImages && existingImages.length > 0 ? existingImages[0].order_index + 1 : 0

    // Create database record
    const { data: image, error: insertError } = await admin
      .from('story_images')
      .insert({
        story_id: storyId,
        transcript_id: transcriptId,
        storage_path: storagePath,
        thumbnail_path: thumbnailPath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        width,
        height,
        order_index: nextOrderIndex,
        is_primary: false,
        source_type: 'transcript',
        uploaded_by: user.id,
        description_i18n: {},
        copyright_verified: true
      })
      .select()
      .single()

    if (insertError || !image) {
      console.error('[Transcript Images API] Database insert error:', insertError)
      // Clean up uploaded file
      await admin.storage.from('saga').remove([storagePath])
      return NextResponse.json({ error: 'Failed to create image record' }, { status: 500 })
    }

    // Generate signed URL
    const { url } = await getSignedImageUrl(storagePath)
    const { url: thumbnailUrl } = await getSignedImageUrl(thumbnailPath)

    console.log('[Transcript Images API] Image uploaded successfully:', image.id)
    return NextResponse.json(
      {
        image: {
          ...image,
          url,
          thumbnail_url: thumbnailUrl,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[Transcript Images API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

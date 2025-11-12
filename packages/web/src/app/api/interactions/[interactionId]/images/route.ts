import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'
import { generateInteractionImagePath, getSignedImageUrl, generateThumbnailPath } from '@/lib/storage-service'
import sharp from 'sharp'
import { IMAGE_VALIDATION } from '@saga/shared/types/image'

export const dynamic = 'force-dynamic'

// GET /api/interactions/:interactionId/images - Get images for interaction
export async function GET(
  _request: NextRequest,
  { params }: { params: { interactionId: string } }
) {
  try {
    const { interactionId } = params
    const supabase = createRouteHandlerClient({ cookies })
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = getSupabaseAdmin()

    // Verify interaction and membership
    const { data: interaction, error: interactionError } = await admin
      .from('interactions')
      .select('id, story_id')
      .eq('id', interactionId)
      .single()

    if (interactionError || !interaction) {
      return NextResponse.json({ error: 'Interaction not found' }, { status: 404 })
    }

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
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { data: images, error: imagesError } = await admin
      .from('interaction_images')
      .select('*')
      .eq('interaction_id', interactionId)
      .order('order_index', { ascending: true })

    if (imagesError) {
      return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 })
    }

    const storagePaths = images?.map((img) => img.storage_path) || []
    const thumbPaths = images?.map((img) => img.thumbnail_path).filter(Boolean) as string[]
    const urlMap = await Promise.all(storagePaths.map(async (p) => ({ p, ...(await getSignedImageUrl(p)) })))
    const thumbUrlMap = await Promise.all(thumbPaths.map(async (p) => ({ p, ...(await getSignedImageUrl(p)) })))
    const urlDict = new Map(urlMap.map((x) => [x.p, x.url || null]))
    const thumbDict = new Map(thumbUrlMap.map((x) => [x.p, x.url || null]))

    const imagesWithUrls = images?.map((img) => ({
      ...img,
      url: urlDict.get(img.storage_path) || null,
      thumbnail_url: img.thumbnail_path ? thumbDict.get(img.thumbnail_path) || null : null,
    }))

    return NextResponse.json({ images: imagesWithUrls || [] })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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

    const adminStorage = getSupabaseAdmin().storage
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await adminStorage
      .from('saga')
      .upload(storagePath, fileBuffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      console.error('[Interaction Images API] Upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
    }

    // Generate thumbnail and dimensions
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
        thumbnail_path: thumbnailPath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        width,
        height,
        order_index: nextOrderIndex,
        uploaded_by: user.id,
        description_i18n: {},
        copyright_verified: true
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
    const { url: thumbnailUrl } = await getSignedImageUrl(thumbnailPath)

    console.log('[Interaction Images API] Image uploaded successfully:', image.id)
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
    console.error('[Interaction Images API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

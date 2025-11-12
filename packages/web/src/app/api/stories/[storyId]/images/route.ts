import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'
import {
  getSignedImageUrls,
  copyImage,
  generateCommentImagePath,
  getSignedImageUrl,
  generateThumbnailPath,
} from '@/lib/storage-service'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'

// GET /api/stories/:storyId/images - Get all images for a story
export async function GET(
  _request: NextRequest,
  { params }: { params: { storyId: string } }
) {
  try {
    const { storyId } = params
    console.log('[Story Images API] GET request for story:', storyId)

    // Get authenticated user
    const supabase = createRouteHandlerClient({ cookies })
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use admin client to bypass RLS
    const admin = getSupabaseAdmin()

    // Verify user has access to this story (is a project member)
    const { data: story, error: storyError } = await admin
      .from('stories')
      .select('id, project_id')
      .eq('id', storyId)
      .single()

    if (storyError || !story) {
      console.error('[Story Images API] Story not found:', storyError)
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

    // Get all images for this story
    const { data: images, error: imagesError } = await admin
      .from('story_images')
      .select('*')
      .eq('story_id', storyId)
      .order('order_index', { ascending: true })

    if (imagesError) {
      console.error('[Story Images API] Error fetching images:', imagesError)
      return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 })
    }

    // Generate signed URLs for all images
    const storagePaths = images?.map((img) => img.storage_path) || []
    const thumbPaths = images?.map((img) => img.thumbnail_path).filter(Boolean) as string[]
    const urlMap = await getSignedImageUrls(storagePaths)
    const thumbUrlMap = await getSignedImageUrls(thumbPaths)

    // Add URLs to images
    const imagesWithUrls = images?.map((img) => ({
      ...img,
      url: urlMap.get(img.storage_path) || null,
      thumbnail_url: img.thumbnail_path ? thumbUrlMap.get(img.thumbnail_path) || null : null,
    }))

    console.log('[Story Images API] Found images:', imagesWithUrls?.length || 0)
    return NextResponse.json({ images: imagesWithUrls || [] })
  } catch (error) {
    console.error('[Story Images API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/stories/:storyId/images - Copy images from interactions to story
export async function POST(
  request: NextRequest,
  { params }: { params: { storyId: string } }
) {
  try {
    const { storyId } = params
    console.log('[Story Images API] POST request for story:', storyId)

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
      console.error('[Story Images API] Story not found:', storyError)
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    if (story.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the storyteller can add images from comments' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { interaction_image_ids } = body

    if (!interaction_image_ids || !Array.isArray(interaction_image_ids)) {
      return NextResponse.json(
        { error: 'Invalid request: interaction_image_ids array required' },
        { status: 400 }
      )
    }

    if (interaction_image_ids.length === 0) {
      return NextResponse.json({ images: [] })
    }

    // Get interaction images
    const { data: interactionImages, error: fetchError } = await admin
      .from('interaction_images')
      .select('*')
      .in('id', interaction_image_ids)

    if (fetchError || !interactionImages) {
      console.error('[Story Images API] Error fetching interaction images:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch interaction images' }, { status: 500 })
    }

    // Get next order index for story images
    const { data: existingImages } = await admin
      .from('story_images')
      .select('order_index')
      .eq('story_id', storyId)
      .order('order_index', { ascending: false })
      .limit(1)

    let nextOrderIndex =
      existingImages && existingImages.length > 0 ? existingImages[0].order_index + 1 : 0

    // Copy each image
    const copiedImages = []
    for (const interactionImage of interactionImages) {
      // Generate new storage path
      const newStoragePath = generateCommentImagePath(storyId, interactionImage.file_name)
      
      // Copy file in storage
      const { success, error: copyError } = await copyImage(
        interactionImage.storage_path,
        newStoragePath
      )

      if (!success || copyError) {
        console.error('[Story Images API] Error copying image:', copyError)
        continue // Skip this image but continue with others
      }

      // Ensure thumbnail exists (copy or generate)
      let newThumbnailPath: string | null = null
      if (interactionImage.thumbnail_path) {
        newThumbnailPath = generateThumbnailPath(newStoragePath)
        await copyImage(interactionImage.thumbnail_path, newThumbnailPath)
      } else {
        const { data: downloaded } = await admin.storage
          .from('saga')
          .download(newStoragePath)
        if (downloaded) {
          const buf = Buffer.from(await downloaded.arrayBuffer())
          const thumbBuf = await sharp(buf).resize(400, 400, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer()
          newThumbnailPath = generateThumbnailPath(newStoragePath)
          await admin.storage.from('saga').upload(newThumbnailPath, thumbBuf, { contentType: 'image/jpeg', upsert: false })
        }
      }

      // Create story_images record
      const { data: newImage, error: insertError } = await admin
        .from('story_images')
        .insert({
          story_id: storyId,
          transcript_id: null, // Comment-sourced images don't belong to a specific transcript
          storage_path: newStoragePath,
          thumbnail_path: newThumbnailPath,
          file_name: interactionImage.file_name,
          file_size: interactionImage.file_size,
          mime_type: interactionImage.mime_type,
          width: interactionImage.width,
          height: interactionImage.height,
          order_index: nextOrderIndex++,
          is_primary: false,
          source_type: 'comment',
          source_interaction_id: interactionImage.interaction_id,
          uploaded_by: user.id,
          description_i18n: interactionImage.description_i18n || {},
          copyright_verified: interactionImage.copyright_verified || false
        })
        .select()
        .single()

      if (insertError || !newImage) {
        console.error('[Story Images API] Error creating image record:', insertError)
        // Clean up copied file
        await admin.storage.from('saga').remove([newStoragePath])
        continue
      }

      // Generate signed URL
      const { url } = await getSignedImageUrl(newStoragePath)
      const { url: thumbUrl } = newThumbnailPath ? await getSignedImageUrl(newThumbnailPath) : { url: null }

      copiedImages.push({
        ...newImage,
        url,
        thumbnail_url: thumbUrl,
      })
    }

    console.log('[Story Images API] Copied images:', copiedImages.length)
    return NextResponse.json({ images: copiedImages }, { status: 201 })
  } catch (error) {
    console.error('[Story Images API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

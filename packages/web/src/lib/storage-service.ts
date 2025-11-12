/**
 * Supabase Storage service for image upload and management
 */

import { createClientSupabase } from './supabase'
import { generateUniqueFileName } from './image-utils'

const STORAGE_BUCKET = 'saga'
const SIGNED_URL_EXPIRY = 24 * 60 * 60 // 24 hours in seconds

/**
 * Generate storage path for story transcript image
 */
export function generateTranscriptImagePath(
  storyId: string,
  transcriptSequence: number,
  fileName: string
): string {
  const uniqueName = generateUniqueFileName(fileName)
  return `stories/${storyId}/images/transcript-${transcriptSequence}-${uniqueName}`
}

/**
 * Generate storage path for comment-sourced image
 */
export function generateCommentImagePath(storyId: string, fileName: string): string {
  const uniqueName = generateUniqueFileName(fileName)
  return `stories/${storyId}/images/comment-${uniqueName}`
}

/**
 * Generate storage path for interaction image
 */
export function generateInteractionImagePath(interactionId: string, fileName: string): string {
  const uniqueName = generateUniqueFileName(fileName)
  return `interactions/${interactionId}/images/${uniqueName}`
}

export function generateThumbnailPath(originalPath: string): string {
  const parts = originalPath.split('/')
  const file = parts.pop() || ''
  const base = file.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '')
  const ext = (file.match(/\.(jpg|jpeg|png|gif|webp)$/i)?.[0] || '.jpg')
  return `${parts.join('/')}/thumbnails/${base}-thumb${ext}`
}

/**
 * Upload image to Supabase Storage
 */
export async function uploadImage(
  file: File,
  storagePath: string
): Promise<{ path: string; error?: Error }> {
  try {
    const supabase = createClientSupabase()

    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

    if (error) {
      console.error('Storage upload error:', error)
      return { path: storagePath, error: new Error(error.message) }
    }

    return { path: storagePath }
  } catch (error) {
    console.error('Upload image error:', error)
    return {
      path: storagePath,
      error: error instanceof Error ? error : new Error('Unknown upload error'),
    }
  }
}

/**
 * Delete image from Supabase Storage
 */
export async function deleteImage(storagePath: string): Promise<{ success: boolean; error?: Error }> {
  try {
    const supabase = createClientSupabase()

    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])

    if (error) {
      console.error('Storage delete error:', error)
      return { success: false, error: new Error(error.message) }
    }

    return { success: true }
  } catch (error) {
    console.error('Delete image error:', error)
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unknown delete error'),
    }
  }
}

export async function deleteImageWithThumbnail(
  storagePath: string,
  thumbnailPath?: string | null
): Promise<{ success: boolean; error?: Error }> {
  try {
    const supabase = createClientSupabase()
    const paths = [storagePath]
    if (thumbnailPath) paths.push(thumbnailPath)
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(paths)
    if (error) {
      return { success: false, error: new Error(error.message) }
    }
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unknown delete error'),
    }
  }
}

/**
 * Generate signed URL for image access
 */
export async function getSignedImageUrl(
  storagePath: string,
  expiresIn: number = SIGNED_URL_EXPIRY
): Promise<{ url: string | null; error?: Error }> {
  try {
    const supabase = createClientSupabase()

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, expiresIn)

    if (error) {
      console.error('Signed URL error:', error)
      return { url: null, error: new Error(error.message) }
    }

    return { url: data.signedUrl }
  } catch (error) {
    console.error('Get signed URL error:', error)
    return {
      url: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

/**
 * Generate signed URLs for multiple images
 */
export async function getSignedImageUrls(
  storagePaths: string[],
  expiresIn: number = SIGNED_URL_EXPIRY
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>()

  await Promise.all(
    storagePaths.map(async (path) => {
      const { url } = await getSignedImageUrl(path, expiresIn)
      if (url) {
        urlMap.set(path, url)
      }
    })
  )

  return urlMap
}

/**
 * Copy image file within storage (for copying from interaction to story)
 */
export async function copyImage(
  sourcePath: string,
  destinationPath: string
): Promise<{ success: boolean; error?: Error }> {
  try {
    const supabase = createClientSupabase()

    // Download the source file
    const { data: sourceData, error: downloadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(sourcePath)

    if (downloadError || !sourceData) {
      console.error('Download error:', downloadError)
      return { success: false, error: new Error(downloadError?.message || 'Download failed') }
    }

    // Upload to destination
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(destinationPath, sourceData, {
        contentType: sourceData.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return { success: false, error: new Error(uploadError.message) }
    }

    return { success: true }
  } catch (error) {
    console.error('Copy image error:', error)
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unknown copy error'),
    }
  }
}

/**
 * Get public URL for an image (without expiry, for public images)
 */
export function getPublicImageUrl(storagePath: string): string {
  const supabase = createClientSupabase()
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

/**
 * Delete multiple images
 */
export async function deleteImages(storagePaths: string[]): Promise<{ success: boolean; error?: Error }> {
  try {
    const supabase = createClientSupabase()

    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(storagePaths)

    if (error) {
      console.error('Storage batch delete error:', error)
      return { success: false, error: new Error(error.message) }
    }

    return { success: true }
  } catch (error) {
    console.error('Delete images error:', error)
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unknown delete error'),
    }
  }
}

import { createClientSupabase } from './supabase'

export interface UploadOptions {
  bucket?: string
  folder?: string
  fileName?: string
  maxSize?: number // in bytes
  allowedTypes?: string[]
}

export interface UploadResult {
  success: boolean
  url?: string
  path?: string
  error?: string
}

export class StorageService {
  private supabase = createClientSupabase()
  private defaultBucket = 'saga'

  /**
   * Upload a file to Supabase Storage
   */
  async uploadFile(
    file: File | Blob,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    try {
      const {
        bucket = this.defaultBucket,
        folder = 'uploads',
        fileName,
        maxSize = 50 * 1024 * 1024, // 50MB default
        allowedTypes = [
          'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/aac',
          'audio/ogg', 'audio/webm', 'image/jpeg', 'image/jpg', 'image/png',
          'image/webp', 'image/gif'
        ]
      } = options

      // Validate file size
      if (file.size > maxSize) {
        return {
          success: false,
          error: `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(maxSize / 1024 / 1024)}MB)`
        }
      }

      // Validate file type
      const fileType = file instanceof File ? file.type : 'application/octet-stream'
      if (allowedTypes.length > 0 && !allowedTypes.includes(fileType)) {
        return {
          success: false,
          error: `File type ${fileType} is not allowed. Allowed types: ${allowedTypes.join(', ')}`
        }
      }

      // Get current user
      const { data: { user }, error: userError } = await this.supabase.auth.getUser()
      if (userError || !user) {
        return {
          success: false,
          error: 'User not authenticated'
        }
      }

      // Generate file path
      const timestamp = Date.now()
      const originalName = file instanceof File ? file.name : 'upload'
      const extension = originalName.split('.').pop() || 'bin'
      const finalFileName = fileName || `${timestamp}-${Math.random().toString(36).substring(2)}.${extension}`
      const filePath = `${user.id}/${folder}/${finalFileName}`

      // Upload file
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('Storage upload error:', error)
        return {
          success: false,
          error: error.message
        }
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from(bucket)
        .getPublicUrl(data.path)

      return {
        success: true,
        url: urlData.publicUrl,
        path: data.path
      }

    } catch (error) {
      console.error('Upload error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      }
    }
  }

  /**
   * Upload audio file for a story
   */
  async uploadStoryAudio(
    audioFile: File | Blob,
    projectId: string,
    storyId?: string
  ): Promise<UploadResult> {
    const folder = storyId 
      ? `projects/${projectId}/stories/${storyId}`
      : `projects/${projectId}/stories/temp`

    // Use public audio bucket to ensure direct playback via public URL
    return this.uploadFile(audioFile, {
      bucket: 'audio-recordings',
      folder,
      allowedTypes: [
        'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 
        'audio/aac', 'audio/ogg', 'audio/webm'
      ],
      maxSize: 100 * 1024 * 1024 // 100MB for audio
    })
  }

  /**
   * Upload image file
   */
  async uploadImage(
    imageFile: File | Blob,
    folder: string = 'images'
  ): Promise<UploadResult> {
    return this.uploadFile(imageFile, {
      folder,
      allowedTypes: [
        'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'
      ],
      maxSize: 10 * 1024 * 1024 // 10MB for images
    })
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(filePath: string, bucket: string = this.defaultBucket): Promise<boolean> {
    try {
      const { error } = await this.supabase.storage
        .from(bucket)
        .remove([filePath])

      if (error) {
        console.error('Storage delete error:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Delete error:', error)
      return false
    }
  }

  /**
   * Get signed URL for private file access
   */
  async getSignedUrl(
    filePath: string, 
    expiresIn: number = 3600, // 1 hour default
    bucket: string = this.defaultBucket
  ): Promise<string | null> {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, expiresIn)

      if (error) {
        console.error('Signed URL error:', error)
        return null
      }

      return data.signedUrl
    } catch (error) {
      console.error('Signed URL error:', error)
      return null
    }
  }

  /**
   * List files in a folder
   */
  async listFiles(
    folder: string,
    bucket: string = this.defaultBucket
  ): Promise<any[]> {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .list(folder)

      if (error) {
        console.error('List files error:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('List files error:', error)
      return []
    }
  }

  /**
   * Get file info
   */
  async getFileInfo(
    filePath: string,
    bucket: string = this.defaultBucket
  ): Promise<any | null> {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .list('', {
          search: filePath
        })

      if (error) {
        console.error('Get file info error:', error)
        return null
      }

      return data?.[0] || null
    } catch (error) {
      console.error('Get file info error:', error)
      return null
    }
  }

  /**
   * Check if user can access file
   */
  async canAccessFile(filePath: string): Promise<boolean> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) return false

      // Check if file belongs to user
      if (filePath.startsWith(`${user.id}/`)) {
        return true
      }

      // Check if file is in a project the user has access to
      const pathParts = filePath.split('/')
      if (pathParts.length >= 4 && pathParts[1] === 'projects') {
        const projectId = pathParts[2]
        
        const { data, error } = await this.supabase
          .from('project_roles')
          .select('id')
          .eq('user_id', user.id)
          .eq('project_id', projectId)
          .single()

        return !error && !!data
      }

      return false
    } catch (error) {
      console.error('Access check error:', error)
      return false
    }
  }
}

// Export singleton instance
export const storageService = new StorageService()

// Helper functions for common operations
export const uploadStoryAudio = (audioFile: File | Blob, projectId: string, storyId?: string) =>
  storageService.uploadStoryAudio(audioFile, projectId, storyId)

export const uploadImage = (imageFile: File | Blob, folder?: string) =>
  storageService.uploadImage(imageFile, folder)

export const deleteFile = (filePath: string) =>
  storageService.deleteFile(filePath)

export const getSignedUrl = (filePath: string, expiresIn?: number) =>
  storageService.getSignedUrl(filePath, expiresIn)

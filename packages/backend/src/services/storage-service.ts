import { AWSConfig } from '../config/aws'
import { createError } from '../middleware/error-handler'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import sharp from 'sharp'

export interface UploadResult {
  key: string
  url: string
  cdnUrl: string
  size: number
  contentType: string
}

export interface ImageProcessingOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'jpeg' | 'png' | 'webp'
  generateThumbnail?: boolean
  thumbnailSize?: number
}

export class StorageService {
  private static readonly AUDIO_FOLDER = 'audio'
  private static readonly IMAGES_FOLDER = 'images'
  private static readonly THUMBNAILS_FOLDER = 'thumbnails'
  private static readonly EXPORTS_FOLDER = 'exports'

  static async uploadAudioFile(
    file: Express.Multer.File,
    projectId: string,
    storyId: string
  ): Promise<UploadResult> {
    try {
      // Validate file
      if (!this.isValidAudioFile(file)) {
        throw createError('Invalid audio file format', 400, 'INVALID_AUDIO_FORMAT')
      }

      // Generate unique key
      const fileExtension = path.extname(file.originalname)
      const key = `${this.AUDIO_FOLDER}/${projectId}/${storyId}/${uuidv4()}${fileExtension}`

      // Upload to S3
      const uploadParams = {
        Bucket: AWSConfig.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          projectId,
          storyId,
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
        },
        ServerSideEncryption: 'AES256',
      }

      const result = await AWSConfig.s3.upload(uploadParams).promise()

      return {
        key,
        url: result.Location,
        cdnUrl: `https://${AWSConfig.cloudFrontDomain}/${key}`,
        size: file.size,
        contentType: file.mimetype,
      }
    } catch (error) {
      console.error('Audio upload failed:', error)
      throw createError('Failed to upload audio file', 500, 'AUDIO_UPLOAD_FAILED')
    }
  }

  static async uploadImageFile(
    file: Express.Multer.File,
    projectId: string,
    storyId: string,
    options: ImageProcessingOptions = {}
  ): Promise<UploadResult> {
    try {
      // Validate file
      if (!this.isValidImageFile(file)) {
        throw createError('Invalid image file format', 400, 'INVALID_IMAGE_FORMAT')
      }

      // Process image
      const processedImage = await this.processImage(file.buffer, options)

      // Generate unique key
      const fileExtension = options.format ? `.${options.format}` : path.extname(file.originalname)
      const key = `${this.IMAGES_FOLDER}/${projectId}/${storyId}/${uuidv4()}${fileExtension}`

      // Upload to S3
      const uploadParams = {
        Bucket: AWSConfig.bucketName,
        Key: key,
        Body: processedImage.buffer,
        ContentType: `image/${options.format || 'jpeg'}`,
        Metadata: {
          projectId,
          storyId,
          originalName: file.originalname,
          width: processedImage.info.width.toString(),
          height: processedImage.info.height.toString(),
          uploadedAt: new Date().toISOString(),
        },
        ServerSideEncryption: 'AES256',
      }

      const result = await AWSConfig.s3.upload(uploadParams).promise()

      // Generate thumbnail if requested
      if (options.generateThumbnail) {
        await this.generateThumbnail(file.buffer, projectId, storyId, key, options.thumbnailSize)
      }

      return {
        key,
        url: result.Location,
        cdnUrl: `https://${AWSConfig.cloudFrontDomain}/${key}`,
        size: processedImage.buffer.length,
        contentType: `image/${options.format || 'jpeg'}`,
      }
    } catch (error) {
      console.error('Image upload failed:', error)
      throw createError('Failed to upload image file', 500, 'IMAGE_UPLOAD_FAILED')
    }
  }

  static async uploadExportFile(
    buffer: Buffer,
    projectId: string,
    filename: string,
    contentType = 'application/zip'
  ): Promise<UploadResult> {
    try {
      const key = `${this.EXPORTS_FOLDER}/${projectId}/${uuidv4()}-${filename}`

      const uploadParams = {
        Bucket: AWSConfig.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          projectId,
          filename,
          uploadedAt: new Date().toISOString(),
        },
        ServerSideEncryption: 'AES256',
        // Set expiration for export files (30 days)
        Expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }

      const result = await AWSConfig.s3.upload(uploadParams).promise()

      return {
        key,
        url: result.Location,
        cdnUrl: `https://${AWSConfig.cloudFrontDomain}/${key}`,
        size: buffer.length,
        contentType,
      }
    } catch (error) {
      console.error('Export upload failed:', error)
      throw createError('Failed to upload export file', 500, 'EXPORT_UPLOAD_FAILED')
    }
  }

  static async deleteFile(key: string): Promise<void> {
    try {
      await AWSConfig.s3.deleteObject({
        Bucket: AWSConfig.bucketName,
        Key: key,
      }).promise()
    } catch (error) {
      console.error('File deletion failed:', error)
      throw createError('Failed to delete file', 500, 'FILE_DELETE_FAILED')
    }
  }

  static async getFileMetadata(key: string): Promise<AWS.S3.HeadObjectOutput> {
    try {
      return await AWSConfig.s3.headObject({
        Bucket: AWSConfig.bucketName,
        Key: key,
      }).promise()
    } catch (error) {
      console.error('Failed to get file metadata:', error)
      throw createError('File not found', 404, 'FILE_NOT_FOUND')
    }
  }

  static generateSecureDownloadUrl(key: string, expiresIn = 3600): string {
    return AWSConfig.generatePresignedUrl(key, expiresIn)
  }

  static generateUploadUrl(
    projectId: string,
    fileType: 'audio' | 'image',
    contentType: string
  ): { uploadUrl: string; fields: any; key: string } {
    const folder = fileType === 'audio' ? this.AUDIO_FOLDER : this.IMAGES_FOLDER
    const key = `${folder}/${projectId}/${uuidv4()}`

    const presigned = AWSConfig.generateUploadPresignedUrl(key, contentType)

    return {
      uploadUrl: presigned.uploadUrl,
      fields: presigned.fields,
      key,
    }
  }

  private static async processImage(
    buffer: Buffer,
    options: ImageProcessingOptions
  ): Promise<{ buffer: Buffer; info: sharp.OutputInfo }> {
    let processor = sharp(buffer)

    // Resize if dimensions specified
    if (options.maxWidth || options.maxHeight) {
      processor = processor.resize(options.maxWidth, options.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
    }

    // Convert format if specified
    if (options.format) {
      switch (options.format) {
        case 'jpeg':
          processor = processor.jpeg({ quality: options.quality || 85 })
          break
        case 'png':
          processor = processor.png({ quality: options.quality || 85 })
          break
        case 'webp':
          processor = processor.webp({ quality: options.quality || 85 })
          break
      }
    }

    const result = await processor.toBuffer({ resolveWithObject: true })
    return result
  }

  private static async generateThumbnail(
    originalBuffer: Buffer,
    projectId: string,
    storyId: string,
    originalKey: string,
    size = 200
  ): Promise<void> {
    try {
      const thumbnailBuffer = await sharp(originalBuffer)
        .resize(size, size, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer()

      const thumbnailKey = `${this.THUMBNAILS_FOLDER}/${projectId}/${storyId}/${path.basename(originalKey, path.extname(originalKey))}_thumb.jpg`

      await AWSConfig.s3.upload({
        Bucket: AWSConfig.bucketName,
        Key: thumbnailKey,
        Body: thumbnailBuffer,
        ContentType: 'image/jpeg',
        Metadata: {
          projectId,
          storyId,
          originalKey,
          thumbnailSize: size.toString(),
          uploadedAt: new Date().toISOString(),
        },
        ServerSideEncryption: 'AES256',
      }).promise()
    } catch (error) {
      console.error('Thumbnail generation failed:', error)
      // Don't throw error for thumbnail generation failure
    }
  }

  private static isValidAudioFile(file: Express.Multer.File): boolean {
    const allowedTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/mp4',
      'audio/aac',
      'audio/ogg',
    ]
    return allowedTypes.includes(file.mimetype)
  }

  private static isValidImageFile(file: Express.Multer.File): boolean {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ]
    return allowedTypes.includes(file.mimetype)
  }

  /**
   * Get file size in bytes
   */
  static async getFileSize(key: string): Promise<number> {
    try {
      const metadata = await this.getFileMetadata(key);
      return metadata.ContentLength || 0;
    } catch (error) {
      console.error('Error getting file size:', error);
      return 0;
    }
  }

  /**
   * List temporary files older than the specified date
   */
  static async listTempFiles(olderThan: Date): Promise<string[]> {
    try {
      const params = {
        Bucket: AWSConfig.bucketName,
        Prefix: 'temp/',
      };

      const objects = await AWSConfig.s3.listObjectsV2(params).promise();
      const tempFiles: string[] = [];

      if (objects.Contents) {
        for (const object of objects.Contents) {
          if (object.Key && object.LastModified && object.LastModified < olderThan) {
            tempFiles.push(object.Key);
          }
        }
      }

      return tempFiles;
    } catch (error) {
      console.error('Error listing temp files:', error);
      return [];
    }
  }

  /**
   * List files in a specific folder older than the specified date
   */
  static async listFilesOlderThan(folder: string, olderThan: Date): Promise<string[]> {
    try {
      const params = {
        Bucket: AWSConfig.bucketName,
        Prefix: folder,
      };

      const objects = await AWSConfig.s3.listObjectsV2(params).promise();
      const oldFiles: string[] = [];

      if (objects.Contents) {
        for (const object of objects.Contents) {
          if (object.Key && object.LastModified && object.LastModified < olderThan) {
            oldFiles.push(object.Key);
          }
        }
      }

      return oldFiles;
    } catch (error) {
      console.error('Error listing old files:', error);
      return [];
    }
  }

  /**
   * Get total storage usage for a project
   */
  static async getProjectStorageUsage(projectId: string): Promise<number> {
    try {
      let totalSize = 0;
      const folders = [this.AUDIO_FOLDER, this.IMAGES_FOLDER, this.EXPORTS_FOLDER];

      for (const folder of folders) {
        const params = {
          Bucket: AWSConfig.bucketName,
          Prefix: `${folder}/${projectId}/`,
        };

        const objects = await AWSConfig.s3.listObjectsV2(params).promise();
        
        if (objects.Contents) {
          for (const object of objects.Contents) {
            totalSize += object.Size || 0;
          }
        }
      }

      return totalSize;
    } catch (error) {
      console.error('Error calculating project storage usage:', error);
      return 0;
    }
  }

  static async cleanupExpiredFiles(): Promise<number> {
    try {
      // List objects in exports folder older than 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      const listParams = {
        Bucket: AWSConfig.bucketName,
        Prefix: `${this.EXPORTS_FOLDER}/`,
      }

      const objects = await AWSConfig.s3.listObjectsV2(listParams).promise()
      
      if (!objects.Contents) return 0

      const expiredObjects = objects.Contents.filter(
        obj => obj.LastModified && obj.LastModified < thirtyDaysAgo
      )

      if (expiredObjects.length === 0) return 0

      // Delete expired objects
      const deleteParams = {
        Bucket: AWSConfig.bucketName,
        Delete: {
          Objects: expiredObjects.map(obj => ({ Key: obj.Key! })),
        },
      }

      await AWSConfig.s3.deleteObjects(deleteParams).promise()
      return expiredObjects.length
    } catch (error) {
      console.error('Cleanup failed:', error)
      return 0
    }
  }
}
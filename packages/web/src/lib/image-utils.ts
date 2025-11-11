/**
 * Image utility functions for validation, compression, and processing
 */

import { IMAGE_VALIDATION, ImageError, ImageUploadError } from '@saga/shared/types/image'

/**
 * Validate image file format
 */
export function validateImageFormat(file: File): { valid: boolean; error?: ImageError } {
  // Check MIME type
  if (!IMAGE_VALIDATION.SUPPORTED_FORMATS.includes(file.type)) {
    return {
      valid: false,
      error: {
        code: 'INVALID_FORMAT',
        message: 'Unsupported image format',
        details: `Supported formats: ${IMAGE_VALIDATION.SUPPORTED_EXTENSIONS.join(', ').toUpperCase()}`,
      },
    }
  }

  // Check file extension
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension || !IMAGE_VALIDATION.SUPPORTED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: {
        code: 'INVALID_FORMAT',
        message: 'Invalid file extension',
        details: `Supported extensions: ${IMAGE_VALIDATION.SUPPORTED_EXTENSIONS.join(', ')}`,
      },
    }
  }

  return { valid: true }
}

/**
 * Validate image file size
 */
export function validateImageSize(file: File): { valid: boolean; error?: ImageError } {
  if (file.size > IMAGE_VALIDATION.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: {
        code: 'FILE_TOO_LARGE',
        message: 'File size exceeds limit',
        details: `Maximum file size: ${IMAGE_VALIDATION.MAX_FILE_SIZE / (1024 * 1024)}MB`,
      },
    }
  }

  return { valid: true }
}

/**
 * Validate image count
 */
export function validateImageCount(
  currentCount: number,
  maxCount: number
): { valid: boolean; error?: ImageError } {
  if (currentCount >= maxCount) {
    return {
      valid: false,
      error: {
        code: 'TOO_MANY_IMAGES',
        message: 'Maximum number of images reached',
        details: `Maximum images allowed: ${maxCount}`,
      },
    }
  }

  return { valid: true }
}

/**
 * Comprehensive image validation
 */
export function validateImage(
  file: File,
  currentCount: number,
  maxCount: number
): { valid: boolean; error?: ImageError } {
  // Validate format
  const formatValidation = validateImageFormat(file)
  if (!formatValidation.valid) {
    return formatValidation
  }

  // Validate size
  const sizeValidation = validateImageSize(file)
  if (!sizeValidation.valid) {
    return sizeValidation
  }

  // Validate count
  const countValidation = validateImageCount(currentCount, maxCount)
  if (!countValidation.valid) {
    return countValidation
  }

  return { valid: true }
}

/**
 * Get image dimensions from file
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      })
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

/**
 * Validate file header (magic bytes) for security
 * Checks the first few bytes to ensure the file is actually an image
 */
export async function validateFileHeader(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const arr = new Uint8Array(e.target?.result as ArrayBuffer).subarray(0, 4)
      let header = ''
      for (let i = 0; i < arr.length; i++) {
        header += arr[i].toString(16).padStart(2, '0')
      }

      // Check magic bytes for common image formats
      const validHeaders = [
        'ffd8ffe0', // JPEG
        'ffd8ffe1', // JPEG
        'ffd8ffe2', // JPEG
        'ffd8ffe3', // JPEG
        'ffd8ffe8', // JPEG
        '89504e47', // PNG
        '47494638', // GIF
        '52494646', // WEBP (starts with RIFF)
      ]

      const isValid = validHeaders.some((validHeader) => header.startsWith(validHeader))
      resolve(isValid)
    }

    reader.onerror = () => resolve(false)
    reader.readAsArrayBuffer(file.slice(0, 4))
  })
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Generate a unique file name
 */
export function generateUniqueFileName(originalName: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg'
  return `${timestamp}-${random}.${extension}`
}

/**
 * Create a preview URL for an image file
 */
export function createImagePreview(file: File): string {
  return URL.createObjectURL(file)
}

/**
 * Revoke a preview URL to free memory
 */
export function revokeImagePreview(url: string): void {
  URL.revokeObjectURL(url)
}

/**
 * Compress an image file using Canvas API
 * @param file - The image file to compress
 * @param quality - JPEG quality (0-1), default 0.8
 * @param maxWidth - Maximum width, default 1920
 * @param maxHeight - Maximum height, default 1920
 * @returns Compressed image file
 */
export async function compressImage(
  file: File,
  quality: number = IMAGE_VALIDATION.COMPRESSION_QUALITY,
  maxWidth: number = 1920,
  maxHeight: number = 1920
): Promise<File> {
  // Skip compression if file is already small enough
  if (file.size <= IMAGE_VALIDATION.COMPRESSION_THRESHOLD) {
    return file
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()

      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        // Create canvas and draw image
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'))
              return
            }

            // Create new file from blob
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            })

            // Use compressed file only if it's smaller
            resolve(compressedFile.size < file.size ? compressedFile : file)
          },
          'image/jpeg',
          quality
        )
      }

      img.onerror = () => reject(new Error('Failed to load image for compression'))
      img.src = e.target?.result as string
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Compress multiple images in parallel
 */
export async function compressImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map((file) => compressImage(file)))
}

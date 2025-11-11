'use client'

import React, { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useTranslations } from 'next-intl'
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import {
  validateImage,
  compressImage,
  createImagePreview,
  revokeImagePreview,
  formatFileSize,
} from '@/lib/image-utils'
import { IMAGE_VALIDATION } from '@saga/shared/types/image'

interface ImageFile {
  id: string
  file: File
  preview: string
  uploading?: boolean
  error?: string
}

interface ImageUploaderProps {
  maxImages?: number
  maxSizeMB?: number
  images: ImageFile[]
  onImagesChange: (images: ImageFile[]) => void
  onUpload?: (files: File[]) => Promise<void>
  disabled?: boolean
  showPreview?: boolean
  className?: string
}

export function ImageUploader({
  maxImages = IMAGE_VALIDATION.MAX_IMAGES_PER_TRANSCRIPT,
  maxSizeMB = IMAGE_VALIDATION.MAX_FILE_SIZE / (1024 * 1024),
  images,
  onImagesChange,
  onUpload,
  disabled = false,
  showPreview = true,
  className = '',
}: ImageUploaderProps) {
  const t = useTranslations('images')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setUploadError(null)
    const newImages: ImageFile[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Validate image
      const validation = validateImage(file, images.length + newImages.length, maxImages)

      if (!validation.valid) {
        setUploadError(validation.error?.message || 'Validation failed')
        continue
      }

      // Compress if needed
      let processedFile = file
      try {
        processedFile = await compressImage(file)
      } catch (error) {
        console.error('Compression error:', error)
        // Use original file if compression fails
      }

      // Create preview
      const preview = createImagePreview(processedFile)

      newImages.push({
        id: `${Date.now()}-${i}`,
        file: processedFile,
        preview,
      })
    }

    if (newImages.length > 0) {
      const updatedImages = [...images, ...newImages]
      onImagesChange(updatedImages)

      // Call upload handler if provided
      if (onUpload) {
        try {
          await onUpload(newImages.map((img) => img.file))
        } catch (error) {
          console.error('Upload error:', error)
          setUploadError(t('errors.uploadFailed'))
        }
      }
    }
  }

  const handleRemoveImage = (id: string) => {
    const imageToRemove = images.find((img) => img.id === id)
    if (imageToRemove) {
      revokeImagePreview(imageToRemove.preview)
    }
    onImagesChange(images.filter((img) => img.id !== id))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (disabled) return

    const files = e.dataTransfer.files
    handleFileSelect(files)
  }

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const canAddMore = images.length < maxImages

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      {canAddMore && (
        <Card
          variant="content"
          className={`cursor-pointer transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : 'border-border'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/50'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary" />
              </div>

              <div className="space-y-2">
                <p className="text-foreground font-medium">{t('uploadHint')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('maxImages', { count: maxImages })} • {t('maxSize', { size: maxSizeMB })}
                </p>
                <p className="text-xs text-muted-foreground">{t('supportedFormats')}</p>
              </div>

              <Button variant="secondary" size="sm" disabled={disabled} type="button">
                <ImageIcon className="w-4 h-4 mr-2" />
                {t('upload')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_VALIDATION.SUPPORTED_FORMATS.join(',')}
        multiple
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
        disabled={disabled}
      />

      {/* Error message */}
      {uploadError && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive">{uploadError}</p>
        </div>
      )}

      {/* Image count */}
      {images.length > 0 && (
        <div className="text-sm text-muted-foreground">
          {images.length} / {maxImages} {t('imagesSelected')}
        </div>
      )}

      {/* Preview Grid */}
      {showPreview && images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {images.map((image) => (
            <div key={image.id} className="relative group">
              <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                <img
                  src={image.preview}
                  alt={image.file.name}
                  className="w-full h-full object-cover"
                />

                {/* Uploading overlay */}
                {image.uploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}

                {/* Remove button */}
                {!disabled && !image.uploading && (
                  <button
                    onClick={() => handleRemoveImage(image.id)}
                    className="absolute top-2 right-2 w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    type="button"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* File info */}
              <div className="mt-1 text-xs text-muted-foreground truncate">
                {image.file.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatFileSize(image.file.size)}
              </div>

              {/* Error */}
              {image.error && (
                <div className="mt-1 text-xs text-destructive">{image.error}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTranslations } from 'next-intl'
import { Star, Trash2, GripVertical, AlertCircle } from 'lucide-react'
import { StoryImage } from '@saga/shared/types/image'
import { ImageLightbox } from './ImageLightbox'

interface ImageGalleryProps {
  storyId: string
  images: StoryImage[]
  activeTranscriptId?: string | null
  canEdit?: boolean
  onImageClick?: (image: StoryImage, index: number) => void
  onSetPrimary?: (imageId: string) => Promise<void>
  onDelete?: (imageId: string) => Promise<void>
  onReorder?: (imageIds: string[]) => Promise<void>
}

export function ImageGallery({
  storyId,
  images,
  activeTranscriptId,
  canEdit = false,
  onImageClick,
  onSetPrimary,
  onDelete,
  onReorder,
}: ImageGalleryProps) {
  const t = useTranslations('images')
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})
  const [imageLoading, setImageLoading] = useState<Record<string, boolean>>({})

  if (images.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>{t('noImages')}</p>
      </div>
    )
  }

  const handleImageClick = (image: StoryImage, index: number) => {
    if (onImageClick) {
      onImageClick(image, index)
    } else {
      setLightboxIndex(index)
      setLightboxOpen(true)
    }
  }

  const handleSetPrimary = async (imageId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (onSetPrimary) {
      await onSetPrimary(imageId)
    }
  }

  const handleDelete = async (imageId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (onDelete && confirm(t('confirmDelete'))) {
      await onDelete(imageId)
    }
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }

  const handleDragEnd = async () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newImages = [...images]
      const [removed] = newImages.splice(draggedIndex, 1)
      newImages.splice(dragOverIndex, 0, removed)

      if (onReorder) {
        await onReorder(newImages.map((img) => img.id))
      }
    }

    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const getSourceLabel = (image: StoryImage) => {
    if (image.source_type === 'comment') {
      return t('fromComment')
    }
    if (image.transcript_id) {
      // Find transcript sequence number
      return t('fromTranscript', { number: 0 }) // TODO: Get actual sequence number
    }
    return ''
  }

  const isHighlighted = (image: StoryImage) => {
    return activeTranscriptId && image.transcript_id === activeTranscriptId
  }

  const handleImageError = (imageId: string) => {
    setImageErrors((prev) => ({ ...prev, [imageId]: true }))
    setImageLoading((prev) => ({ ...prev, [imageId]: false }))
  }

  const handleImageLoad = (imageId: string) => {
    setImageLoading((prev) => ({ ...prev, [imageId]: false }))
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {images.map((image, index) => (
          <div
            key={image.id}
            draggable={canEdit}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`relative group cursor-pointer ${
              isHighlighted(image) ? 'ring-2 ring-primary' : ''
            } ${dragOverIndex === index ? 'opacity-50' : ''}`}
          >
            {/* Drag handle */}
            {canEdit && (
              <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-6 h-6 bg-black/50 rounded flex items-center justify-center cursor-move">
                  <GripVertical className="w-4 h-4 text-white" />
                </div>
              </div>
            )}

            {/* Image */}
            <div
              className="aspect-square rounded-lg overflow-hidden bg-muted relative"
              onClick={() => handleImageClick(image, index)}
            >
              {imageErrors[image.id] ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mb-2" />
                  <span className="text-xs">{t('loadError')}</span>
                </div>
              ) : (
                <>
                  {imageLoading[image.id] && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted">
                      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <Image
                    src={image.thumbnail_url || image.url || ''}
                    alt={image.file_name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                    className="object-cover transition-transform group-hover:scale-105"
                    onError={() => handleImageError(image.id)}
                    onLoad={() => handleImageLoad(image.id)}
                    loading="lazy"
                    quality={85}
                  />
                </>
              )}
            </div>

            {/* Badges and actions */}
            <div className="absolute top-2 right-2 flex flex-col gap-2">
              {/* Primary badge */}
              {image.is_primary && (
                <Badge variant="default" size="sm" className="bg-primary">
                  <Star className="w-3 h-3 mr-1 fill-current" />
                  {t('primary')}
                </Badge>
              )}

              {/* Source badge */}
              {getSourceLabel(image) && (
                <Badge variant="outline" size="sm" className="bg-white/90">
                  {getSourceLabel(image)}
                </Badge>
              )}

              {/* Edit actions */}
              {canEdit && (
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!image.is_primary && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => handleSetPrimary(image.id, e)}
                      title={t('setPrimary')}
                    >
                      <Star className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={(e) => handleDelete(image.id, e)}
                    title={t('delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      <ImageLightbox
        images={images.map((img) => ({
          id: img.id,
          url: img.url || '',
          caption: img.file_name,
        }))}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={setLightboxIndex}
      />
    </>
  )
}

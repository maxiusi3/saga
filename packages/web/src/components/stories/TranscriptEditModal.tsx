'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useTranslations } from 'next-intl'
import { X, Save, Loader2 } from 'lucide-react'
import { StoryTranscript } from '@saga/shared/types/story'
import { StoryImage } from '@saga/shared/types/image'
import { ImageUploader } from '@/components/images/ImageUploader'

interface TranscriptEditModalProps {
  isOpen: boolean
  transcript: StoryTranscript
  images: StoryImage[]
  onClose: () => void
  onSave: (data: { transcript: string; imagesToDelete: string[] }) => Promise<void>
  onUploadImages?: (files: File[]) => Promise<void>
  onDeleteImage?: (imageId: string) => Promise<void>
}

export function TranscriptEditModal({
  isOpen,
  transcript,
  images,
  onClose,
  onSave,
  onUploadImages,
  onDeleteImage,
}: TranscriptEditModalProps) {
  const t = useTranslations('stories')
  const [editedTranscript, setEditedTranscript] = useState(transcript.transcript)
  const [uploadedImages, setUploadedImages] = useState<Array<{ id: string; file: File; preview: string }>>([])
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setEditedTranscript(transcript.transcript)
    setUploadedImages([])
    setImagesToDelete([])
  }, [transcript])

  if (!isOpen) return null

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Upload new images first
      if (uploadedImages.length > 0 && onUploadImages) {
        await onUploadImages(uploadedImages.map(img => img.file))
      }

      // Delete marked images
      if (imagesToDelete.length > 0 && onDeleteImage) {
        await Promise.all(imagesToDelete.map(id => onDeleteImage(id)))
      }

      // Save transcript text
      await onSave({
        transcript: editedTranscript,
        imagesToDelete,
      })

      onClose()
    } catch (error) {
      console.error('Error saving transcript:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditedTranscript(transcript.transcript)
    setUploadedImages([])
    setImagesToDelete([])
    onClose()
  }

  const handleDeleteExistingImage = (imageId: string) => {
    if (!imagesToDelete.includes(imageId)) {
      setImagesToDelete([...imagesToDelete, imageId])
    }
  }

  const displayImages = images.filter(img => !imagesToDelete.includes(img.id))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleCancel}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">
            {t('detail.editTranscript')}
          </h2>
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Transcript Text */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t('detail.transcriptText')}
            </label>
            <Textarea
              value={editedTranscript}
              onChange={(e) => setEditedTranscript(e.target.value)}
              rows={10}
              className="w-full"
              placeholder={t('detail.transcriptPlaceholder')}
            />
          </div>

          {/* Existing Images */}
          {displayImages.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t('detail.existingImages')} ({displayImages.length})
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {displayImages.map((image) => (
                  <div key={image.id} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                      <img
                        src={image.url || ''}
                        alt={image.file_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeleteExistingImage(image.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload New Images */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t('detail.addNewImages')}
            </label>
            <ImageUploader
              maxImages={6 - displayImages.length}
              images={uploadedImages}
              onImagesChange={setUploadedImages}
              showPreview={true}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
          <Button variant="secondary" onClick={handleCancel} disabled={isSaving}>
            {t('detail.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('detail.saving')}
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {t('detail.save')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

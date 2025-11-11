'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useTranslations } from 'next-intl'
import { Check, Plus, Loader2 } from 'lucide-react'
import { InteractionImage } from '@saga/shared/types/image'

interface CommentImageSelectorProps {
  interactionImages: InteractionImage[]
  onSelect: (imageIds: string[]) => Promise<void>
  disabled?: boolean
}

export function CommentImageSelector({
  interactionImages,
  onSelect,
  disabled = false,
}: CommentImageSelectorProps) {
  const t = useTranslations('images')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (interactionImages.length === 0) {
    return null
  }

  const handleToggleSelect = (imageId: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(imageId)) {
      newSelected.delete(imageId)
    } else {
      newSelected.add(imageId)
    }
    setSelectedIds(newSelected)
  }

  const handleAddToStory = async () => {
    if (selectedIds.size === 0) return

    setIsSubmitting(true)
    try {
      await onSelect(Array.from(selectedIds))
      setSelectedIds(new Set()) // Clear selection after success
    } catch (error) {
      console.error('Error adding images to story:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card variant="content" className="mt-4">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-foreground">{t('selectFromComments')}</h4>
            {selectedIds.size > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddToStory}
                disabled={disabled || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('adding')}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    {t('addToStory')} ({selectedIds.size})
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Image grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {interactionImages.map((image) => {
              const isSelected = selectedIds.has(image.id)

              return (
                <button
                  key={image.id}
                  onClick={() => handleToggleSelect(image.id)}
                  disabled={disabled || isSubmitting}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-transparent hover:border-border'
                  } ${disabled || isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <img
                    src={image.url || ''}
                    alt={image.file_name}
                    className="w-full h-full object-cover"
                  />

                  {/* Selection indicator */}
                  <div
                    className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                      isSelected ? 'bg-primary/20 opacity-100' : 'opacity-0 hover:opacity-100'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isSelected ? 'bg-primary' : 'bg-white/80'
                      }`}
                    >
                      {isSelected ? (
                        <Check className="w-5 h-5 text-white" />
                      ) : (
                        <div className="w-5 h-5 border-2 border-gray-400 rounded-full" />
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Help text */}
          <p className="text-xs text-muted-foreground">{t('selectMultipleHint')}</p>
        </div>
      </CardContent>
    </Card>
  )
}

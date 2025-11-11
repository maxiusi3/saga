'use client'

import React, { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface LightboxImage {
  id: string
  url: string
  caption?: string
}

interface ImageLightboxProps {
  images: LightboxImage[]
  initialIndex: number
  isOpen: boolean
  onClose: () => void
  onNavigate?: (index: number) => void
}

export function ImageLightbox({
  images,
  initialIndex,
  isOpen,
  onClose,
  onNavigate,
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex)

  useEffect(() => {
    setCurrentIndex(initialIndex)
  }, [initialIndex])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft') {
        handlePrevious()
      } else if (e.key === 'ArrowRight') {
        handleNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, currentIndex])

  const handlePrevious = () => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1
    setCurrentIndex(newIndex)
    onNavigate?.(newIndex)
  }

  const handleNext = () => {
    const newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0
    setCurrentIndex(newIndex)
    onNavigate?.(newIndex)
  }

  if (!isOpen || images.length === 0) return null

  const currentImage = images[currentIndex]

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-4 right-4 text-white hover:bg-white/10"
        onClick={onClose}
      >
        <X className="w-6 h-6" />
      </Button>

      {/* Image counter */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-white text-sm">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Previous button */}
      {images.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:bg-white/10"
          onClick={(e) => {
            e.stopPropagation()
            handlePrevious()
          }}
        >
          <ChevronLeft className="w-8 h-8" />
        </Button>
      )}

      {/* Image */}
      <div
        className="max-w-[90vw] max-h-[90vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={currentImage.url}
          alt={currentImage.caption || `Image ${currentIndex + 1}`}
          className="max-w-full max-h-[80vh] object-contain"
        />
        {currentImage.caption && (
          <p className="mt-4 text-white text-center text-sm">{currentImage.caption}</p>
        )}
      </div>

      {/* Next button */}
      {images.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:bg-white/10"
          onClick={(e) => {
            e.stopPropagation()
            handleNext()
          }}
        >
          <ChevronRight className="w-8 h-8" />
        </Button>
      )}
    </div>
  )
}

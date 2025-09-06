'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChapterSummary } from '@saga/shared'
import { formatRelativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ChapterSummaryCardProps {
  chapter: ChapterSummary
  projectId: string
  onEdit?: (chapter: ChapterSummary) => void
  onDelete?: (chapterId: string) => void
}

export function ChapterSummaryCard({ 
  chapter, 
  projectId, 
  onEdit, 
  onDelete 
}: ChapterSummaryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showActions, setShowActions] = useState(false)

  const getEmotionalToneColor = (tone: string) => {
    switch (tone) {
      case 'positive':
        return 'bg-success/10 text-success-foreground border-success/20'
      case 'reflective':
        return 'bg-primary/10 text-primary-foreground border-primary/20'
      case 'bittersweet':
        return 'bg-secondary/10 text-secondary-foreground border-secondary/20'
      default:
        return 'bg-muted text-muted-foreground border-border'
    }
  }

  const getEmotionalToneIcon = (tone: string) => {
    switch (tone) {
      case 'positive':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'reflective':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )
      case 'bittersweet':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        )
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )
    }
  }

  return (
    <div className="bg-gradient-to-r from-primary/5 to-secondary/5 border-2 border-primary/20 rounded-lg shadow-sm hover:shadow-md transition-all duration-200">
      {/* Chapter Header */}
      <div className="p-6 border-b border-primary/10">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {chapter.title}
                </h3>
              </div>
              
              <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getEmotionalToneColor(chapter.emotionalTone)}`}>
                {getEmotionalToneIcon(chapter.emotionalTone)}
                <span className="ml-1 capitalize">{chapter.emotionalTone}</span>
              </div>
            </div>

            <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-3">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                {chapter.storyIds.length} stories
              </div>
              
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                {chapter.theme}
              </div>

              {chapter.timeframe && (chapter.timeframe.start || chapter.timeframe.end) && (
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {chapter.timeframe.start && chapter.timeframe.end 
                    ? `${chapter.timeframe.start} - ${chapter.timeframe.end}`
                    : chapter.timeframe.start || chapter.timeframe.end
                  }
                </div>
              )}

              <span>{formatRelativeTime(chapter.createdAt)}</span>
            </div>

            <p className={`text-card-foreground leading-relaxed ${!isExpanded ? 'line-clamp-2' : ''}`}>
              {chapter.description}
            </p>

            {chapter.description.length > 150 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-2 text-sm text-primary hover:text-primary/90 font-medium"
              >
                {isExpanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>

          <div className="relative ml-4">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-background/50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>

            {showActions && (
              <div className="absolute right-0 mt-2 w-48 bg-background rounded-md shadow-lg z-10 border">
                <div className="py-1">
                  {onEdit && (
                    <button
                      onClick={() => {
                        onEdit(chapter)
                        setShowActions(false)
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted"
                    >
                      Edit Chapter
                    </button>
                  )}
                  <Link
                    href={`/dashboard/projects/${projectId}/chapters/${chapter.id}`}
                    className="block px-4 py-2 text-sm text-foreground hover:bg-muted"
                    onClick={() => setShowActions(false)}
                  >
                    View Details
                  </Link>
                  {onDelete && (
                    <button
                      onClick={() => {
                        onDelete(chapter.id)
                        setShowActions(false)
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
                    >
                      Delete Chapter
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Key Highlights */}
      {chapter.keyHighlights && chapter.keyHighlights.length > 0 && (
        <div className="px-6 py-4">
          <h4 className="text-sm font-medium text-foreground mb-3">Key Highlights</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {chapter.keyHighlights.map((highlight, index) => (
              <div
                key={index}
                className="flex items-start space-x-2 text-sm text-card-foreground"
              >
                <div className="w-1.5 h-1.5 bg-primary/40 rounded-full mt-2 flex-shrink-0"></div>
                <span>{highlight}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-6 py-4 bg-background/50 border-t border-primary/10 rounded-b-lg">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Chapter Summary • AI Generated
          </div>
          <Link
            href={`/dashboard/projects/${projectId}/chapters/${chapter.id}`}
            className="inline-flex items-center px-3 py-1.5 border border-primary/30 text-sm font-medium rounded-md text-primary bg-background hover:bg-primary/5 transition-colors duration-200"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View Chapter
          </Link>
        </div>
      </div>

      {/* Click outside to close actions */}
      {showActions && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowActions(false)}
        />
      )}
    </div>
  )
}

const getEmotionalToneColor = (tone: string) => {
  switch (tone.toLowerCase()) {
    case 'positive':
      return 'bg-success/10 text-success'
    case 'negative':
      return 'bg-destructive/10 text-destructive'
    case 'neutral':
      return 'bg-muted text-muted-foreground'
    case 'mixed':
      return 'bg-primary/10 text-primary'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

export function ChapterSummaryCard({ 
  chapter, 
  projectId, 
  onEdit, 
  onDelete 
}: ChapterSummaryCardProps) {
  return (
    <div
      className={`bg-gradient-to-r from-primary/5 to-secondary/5 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 p-6 ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground">
            {chapter.title}
          </h3>
          <div
            className={`inline-block px-2 py-1 text-xs font-medium rounded-full mt-2 ${getEmotionalToneColor(
              chapter.emotionalTone
            )}`}
          >
            {chapter.emotionalTone}
          </div>
        </div>
        {chapter.audioUrl && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="ml-4">
                  <PlayCircle className="h-6 w-6 text-primary" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Listen to chapter summary</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <div className="mt-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {chapter.summary}
        </p>
      </div>

      <div className="mt-6">
        <h4 className="text-sm font-semibold text-foreground mb-3">
          Key Highlights
        </h4>
        <ul className="space-y-2">
          {chapter.keyHighlights.map((highlight, index) => (
            <li key={index} className="flex items-start">
              <CheckCircle2 className="h-4 w-4 text-success mt-1 mr-3 flex-shrink-0" />
              <span className="text-sm text-foreground">{highlight}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 border-t border-border pt-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Chapter Summary
        </span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm">
                <MessageSquarePlus className="h-4 w-4 mr-2" />
                Add Note
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Add a note or comment to this chapter</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}
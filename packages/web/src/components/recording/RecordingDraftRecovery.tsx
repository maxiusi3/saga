'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface RecordingDraft {
  id: string
  projectId: string
  promptId: string
  audioBlob: Blob
  duration: number
  createdAt: Date
  promptText?: string
}

interface RecordingDraftRecoveryProps {
  projectId: string
  promptId: string
  onDraftRecovered: (draft: RecordingDraft) => void
  onDraftDiscarded: () => void
  className?: string
}

export function RecordingDraftRecovery({
  projectId,
  promptId,
  onDraftRecovered,
  onDraftDiscarded,
  className = ''
}: RecordingDraftRecoveryProps) {
  const [draft, setDraft] = useState<RecordingDraft | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkForDraft()
  }, [projectId, promptId])

  const checkForDraft = async () => {
    try {
      setIsLoading(true)
      
      // Check localStorage for draft
      const draftKey = `recording-draft-${projectId}-${promptId}`
      const draftData = localStorage.getItem(draftKey)
      
      if (draftData) {
        const parsedDraft = JSON.parse(draftData)
        
        // Check if draft is not too old (24 hours)
        const draftAge = Date.now() - new Date(parsedDraft.createdAt).getTime()
        const maxAge = 24 * 60 * 60 * 1000 // 24 hours
        
        if (draftAge < maxAge && parsedDraft.audioBlobUrl) {
          // Try to recover the audio blob from the stored URL
          try {
            const response = await fetch(parsedDraft.audioBlobUrl)
            const audioBlob = await response.blob()
            
            setDraft({
              ...parsedDraft,
              audioBlob,
              createdAt: new Date(parsedDraft.createdAt)
            })
          } catch (error) {
            console.error('Failed to recover audio blob:', error)
            // Clean up invalid draft
            localStorage.removeItem(draftKey)
          }
        } else {
          // Clean up old draft
          localStorage.removeItem(draftKey)
          if (parsedDraft.audioBlobUrl) {
            URL.revokeObjectURL(parsedDraft.audioBlobUrl)
          }
        }
      }
    } catch (error) {
      console.error('Failed to check for draft:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRecoverDraft = () => {
    if (draft) {
      onDraftRecovered(draft)
      // Clean up the draft from localStorage
      const draftKey = `recording-draft-${projectId}-${promptId}`
      localStorage.removeItem(draftKey)
    }
  }

  const handleDiscardDraft = () => {
    if (draft) {
      // Clean up the draft
      const draftKey = `recording-draft-${projectId}-${promptId}`
      localStorage.removeItem(draftKey)
      
      // Revoke the blob URL if it exists
      const draftData = localStorage.getItem(draftKey)
      if (draftData) {
        const parsedDraft = JSON.parse(draftData)
        if (parsedDraft.audioBlobUrl) {
          URL.revokeObjectURL(parsedDraft.audioBlobUrl)
        }
      }
      
      setDraft(null)
      onDraftDiscarded()
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  if (isLoading) {
    return (
      <div className={`text-center py-4 ${className}`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
        <p className="text-sm text-muted-foreground">Checking for saved recordings...</p>
      </div>
    )
  }

  if (!draft) {
    return null
  }

  return (
    <Card className={`p-6 border-yellow-500/20 bg-yellow-500/10 ${className}`}>
      <div className="text-center space-y-4">
        <div className="text-yellow-500 text-4xl mb-2">💾</div>
        
        <div>
          <h3 className="text-lg font-bold text-yellow-500 mb-2">
            Saved Recording Found
          </h3>
          <p className="text-yellow-500/90 text-sm mb-4">
            We found a recording you started earlier. Would you like to continue with it or start fresh?
          </p>
        </div>

        <div className="bg-background rounded-lg p-4 border border-yellow-500/20">
          <div className="text-sm text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Duration:</span>
              <span className="font-mono font-medium">{formatDuration(draft.duration)}</span>
            </div>
            <div className="flex justify-between">
              <span>Saved:</span>
              <span>{formatDate(draft.createdAt)}</span>
            </div>
            {draft.promptText && (
              <div className="mt-2 pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground italic">
                  "{draft.promptText.substring(0, 100)}{draft.promptText.length > 100 ? '...' : ''}"
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={handleRecoverDraft}
            className="bg-success hover:bg-success/90 text-success-foreground px-6 py-2"
          >
            📁 Continue with Saved Recording
          </Button>
          <Button
            onClick={handleDiscardDraft}
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive/10 px-6 py-2"
          >
            🗑️ Start Fresh
          </Button>
        </div>

        <div className="text-xs text-muted-foreground mt-4">
          <p>💡 Tip: Saved recordings are automatically deleted after 24 hours</p>
        </div>
      </div>
    </Card>
  )
}

// Utility functions for saving and managing drafts
export const saveDraft = (
  projectId: string,
  promptId: string,
  audioBlob: Blob,
  duration: number,
  promptText?: string
) => {
  try {
    const draftKey = `recording-draft-${projectId}-${promptId}`
    const audioBlobUrl = URL.createObjectURL(audioBlob)
    
    const draft = {
      id: `${projectId}-${promptId}-${Date.now()}`,
      projectId,
      promptId,
      audioBlobUrl,
      duration,
      createdAt: new Date().toISOString(),
      promptText
    }
    
    localStorage.setItem(draftKey, JSON.stringify(draft))
    
    // Set up cleanup after 24 hours
    setTimeout(() => {
      const currentDraft = localStorage.getItem(draftKey)
      if (currentDraft) {
        const parsedDraft = JSON.parse(currentDraft)
        if (parsedDraft.audioBlobUrl) {
          URL.revokeObjectURL(parsedDraft.audioBlobUrl)
        }
        localStorage.removeItem(draftKey)
      }
    }, 24 * 60 * 60 * 1000) // 24 hours
    
    return true
  } catch (error) {
    console.error('Failed to save draft:', error)
    return false
  }
}

export const clearDraft = (projectId: string, promptId: string) => {
  try {
    const draftKey = `recording-draft-${projectId}-${promptId}`
    const draftData = localStorage.getItem(draftKey)
    
    if (draftData) {
      const parsedDraft = JSON.parse(draftData)
      if (parsedDraft.audioBlobUrl) {
        URL.revokeObjectURL(parsedDraft.audioBlobUrl)
      }
      localStorage.removeItem(draftKey)
    }
    
    return true
  } catch (error) {
    console.error('Failed to clear draft:', error)
    return false
  }
}
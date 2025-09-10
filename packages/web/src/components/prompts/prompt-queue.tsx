import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { MessageSquare, Clock, User, Sparkles, Send, RefreshCw } from 'lucide-react'
import { chapterService } from '@/lib/chapters'

interface PromptQueueProps {
  projectId: string
  className?: string
  onPromptDelivered?: () => void
}

interface QueuedPrompt {
  id: string
  text: string
  type: 'system' | 'user'
  priority?: number
  chapter_name?: string
  created_by?: string
  parent_story_id?: string
  created_at: Date
}

export function PromptQueue({ projectId, className, onPromptDelivered }: PromptQueueProps) {
  const [nextPrompt, setNextPrompt] = useState<QueuedPrompt | null>(null)
  const [loading, setLoading] = useState(true)
  const [delivering, setDelivering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchNextPrompt()
  }, [projectId])

  const fetchNextPrompt = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const result = await chapterService.getNextPrompt(projectId)
      
      if (result) {
        const { prompt, isUserPrompt } = result
        
        let formattedPrompt: QueuedPrompt = {
          id: prompt.id,
          text: prompt.text,
          type: isUserPrompt ? 'user' : 'system',
          created_at: new Date(prompt.created_at)
        }

        if (isUserPrompt) {
          formattedPrompt.priority = prompt.priority
          formattedPrompt.created_by = prompt.created_by
          formattedPrompt.parent_story_id = prompt.parent_story_id
        } else {
          // 获取章节信息
          const chapters = await chapterService.getActiveChapters()
          const chapter = chapters.find(c => c.id === prompt.chapter_id)
          formattedPrompt.chapter_name = chapter?.name
        }

        setNextPrompt(formattedPrompt)
      } else {
        setNextPrompt(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch next prompt')
    } finally {
      setLoading(false)
    }
  }

  const deliverPrompt = async () => {
    if (!nextPrompt) return

    try {
      setDelivering(true)
      
      const success = await chapterService.markPromptAsDelivered(
        projectId, 
        nextPrompt.id, 
        nextPrompt.type === 'user'
      )

      if (success) {
        // 通知父组件提示已交付
        onPromptDelivered?.()
        
        // 获取下一个提示
        await fetchNextPrompt()
      } else {
        setError('Failed to deliver prompt')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deliver prompt')
    } finally {
      setDelivering(false)
    }
  }

  if (loading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="space-y-4">
          <div className="h-6 bg-muted rounded animate-pulse" />
          <div className="h-20 bg-muted rounded animate-pulse" />
          <div className="h-8 bg-muted rounded animate-pulse" />
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center space-y-4">
          <p className="text-destructive">Error: {error}</p>
          <FurbridgeButton onClick={fetchNextPrompt} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </FurbridgeButton>
        </div>
      </Card>
    )
  }

  if (!nextPrompt) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center space-y-4">
          <div className="text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <h3 className="font-medium">No prompts in queue</h3>
            <p className="text-sm">All available prompts have been delivered.</p>
          </div>
          <FurbridgeButton onClick={fetchNextPrompt} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Check for new prompts
          </FurbridgeButton>
        </div>
      </Card>
    )
  }

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Next Prompt
          </h3>
          <div className="flex items-center gap-2">
            {nextPrompt.type === 'user' ? (
              <Badge variant="default" className="flex items-center gap-1">
                <User className="h-3 w-3" />
                Follow-up
              </Badge>
            ) : (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                AI Prompt
              </Badge>
            )}
            {nextPrompt.priority && (
              <Badge variant="outline">
                Priority {nextPrompt.priority}
              </Badge>
            )}
          </div>
        </div>

        {/* Prompt Content */}
        <div className="space-y-3">
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-foreground leading-relaxed">
              {nextPrompt.text}
            </p>
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {nextPrompt.chapter_name && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {nextPrompt.chapter_name}
              </div>
            )}
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {nextPrompt.created_at.toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <FurbridgeButton 
            onClick={fetchNextPrompt} 
            variant="ghost" 
            size="sm"
            disabled={delivering}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </FurbridgeButton>
          
          <FurbridgeButton 
            onClick={deliverPrompt}
            disabled={delivering}
            className="bg-primary"
          >
            {delivering ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Delivering...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Deliver Prompt
              </>
            )}
          </FurbridgeButton>
        </div>

        {/* Help Text */}
        <div className="text-xs text-muted-foreground pt-2 border-t border-border">
          {nextPrompt.type === 'user' ? (
            <p>This is a follow-up question from a facilitator. It will be prioritized over AI prompts.</p>
          ) : (
            <p>This is an AI-generated prompt from the current chapter. Delivering it will advance the story journey.</p>
          )}
        </div>
      </div>
    </Card>
  )
}

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Circle, Clock, BookOpen } from 'lucide-react'
import { ChapterProgress as ChapterProgressType } from '@saga/shared'
import { chapterService } from '@/lib/chapters'

interface ChapterProgressProps {
  projectId: string
  className?: string
}

export function ChapterProgress({ projectId, className }: ChapterProgressProps) {
  const [progress, setProgress] = useState<ChapterProgressType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProgress()
  }, [projectId])

  const fetchProgress = async () => {
    try {
      setLoading(true)
      setError(null)
      const progressData = await chapterService.getProjectChapterProgress(projectId)
      setProgress(progressData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chapter progress')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="space-y-4">
          <div className="h-6 bg-muted rounded animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-2 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center text-muted-foreground">
          <p>Failed to load chapter progress</p>
          <button 
            onClick={fetchProgress}
            className="mt-2 text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </Card>
    )
  }

  const totalPrompts = progress.reduce((sum, chapter) => sum + chapter.total_prompts, 0)
  const completedPrompts = progress.reduce((sum, chapter) => sum + chapter.completed_prompts, 0)
  const overallProgress = totalPrompts > 0 ? (completedPrompts / totalPrompts) * 100 : 0

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-6">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Story Journey Progress
            </h3>
            <Badge variant="outline">
              {completedPrompts}/{totalPrompts} prompts
            </Badge>
          </div>
          <Progress value={overallProgress} className="h-2" />
          <p className="text-sm text-muted-foreground">
            {Math.round(overallProgress)}% complete
          </p>
        </div>

        {/* Chapter Details */}
        <div className="space-y-4">
          <h4 className="font-medium text-foreground">Chapters</h4>
          <div className="space-y-3">
            {progress.map((chapterProgress) => {
              const chapterPercent = chapterProgress.total_prompts > 0 
                ? (chapterProgress.completed_prompts / chapterProgress.total_prompts) * 100 
                : 0
              const isCompleted = chapterProgress.completed_prompts === chapterProgress.total_prompts && chapterProgress.total_prompts > 0
              const isActive = chapterProgress.is_current

              return (
                <div key={chapterProgress.chapter.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isCompleted ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : isActive ? (
                        <Clock className="h-4 w-4 text-primary" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={`font-medium ${
                        isActive ? 'text-primary' : 
                        isCompleted ? 'text-green-600' : 
                        'text-foreground'
                      }`}>
                        {chapterProgress.chapter.name}
                      </span>
                      {isActive && (
                        <Badge variant="default" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {chapterProgress.completed_prompts}/{chapterProgress.total_prompts}
                      </span>
                      {chapterProgress.stories_count > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {chapterProgress.stories_count} stories
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <Progress 
                    value={chapterPercent} 
                    className={`h-1.5 ${
                      isActive ? 'bg-primary/20' : 'bg-muted'
                    }`}
                  />
                  
                  {chapterProgress.chapter.description && (
                    <p className="text-xs text-muted-foreground pl-6">
                      {chapterProgress.chapter.description}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="pt-4 border-t border-border">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-foreground">
                {progress.filter(p => p.completed_prompts === p.total_prompts && p.total_prompts > 0).length}
              </div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {progress.filter(p => p.is_current).length}
              </div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">
                {progress.reduce((sum, p) => sum + p.stories_count, 0)}
              </div>
              <div className="text-xs text-muted-foreground">Stories</div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

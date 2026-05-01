'use client'

import Link from 'next/link'
import { useLocale } from 'next-intl'
import type { ChapterSummary } from '@saga/shared'
import { formatRelativeTime } from '@/lib/utils'

interface ChapterSummaryCardProps {
  chapter: ChapterSummary
  projectId: string
  onDelete?: (chapterId: string) => void
}

export function ChapterSummaryCard({ chapter, projectId, onDelete }: ChapterSummaryCardProps) {
  const locale = useLocale()
  const withLocale = (path: string) => `/${locale}${path}`

  return (
    <article className="rounded-lg border border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Chapter Summary
          </p>
          <h3 className="text-lg font-semibold text-foreground">
            {chapter.chapter_id ? `Chapter ${chapter.chapter_id}` : 'Generated Summary'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {chapter.story_count} stories - {formatRelativeTime(chapter.created_at)}
          </p>
        </div>

        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(chapter.id)}
            className="rounded-md px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
          >
            Delete
          </button>
        )}
      </div>

      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-card-foreground">
        {chapter.summary}
      </p>

      <div className="mt-5 border-t border-primary/10 pt-4">
        <Link
          href={withLocale(`/dashboard/projects/${projectId}/chapters/${chapter.id}`)}
          className="text-sm font-medium text-primary hover:text-primary/80"
        >
          View Chapter
        </Link>
      </div>
    </article>
  )
}

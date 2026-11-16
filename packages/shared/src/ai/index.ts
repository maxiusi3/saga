export * from './types'
export * from './base'
export * from './language'
export * from './parse'
export * from './stories'
export * from './tasks/story-metadata'
export * from './tasks/followups'
export * from './tasks/biography'
export * from './tasks/story-edit'
export * from './eval'

import { storyMetadataTask } from './tasks/story-metadata'
import { projectQuestionsTask, realtimeFollowupTask } from './tasks/followups'
import { chapterDraftTask, projectSummaryTask } from './tasks/biography'
import { factReviewTask, paragraphEditorTask } from './tasks/story-edit'

/** Registry of text tasks routed through the shared runner. */
export const AI_TASKS = {
  [storyMetadataTask.id]: storyMetadataTask,
  [realtimeFollowupTask.id]: realtimeFollowupTask,
  [projectQuestionsTask.id]: projectQuestionsTask,
  [chapterDraftTask.id]: chapterDraftTask,
  [projectSummaryTask.id]: projectSummaryTask,
} as const

/** Registry of audited multi-provider story-edit/review tasks with consent and policy binding. */
export const AUDITED_STORY_EDIT_TASKS = {
  [paragraphEditorTask.id]: paragraphEditorTask,
  [factReviewTask.id]: factReviewTask,
} as const

import { buildMessages, composeSystemPrompt, sourceMaterial } from './base'
import { aiLanguageName, languageInstruction } from './language'
import { AiOutputError } from './types'
import { optionalText } from './parse'

/** A family story passed to multi-story tasks. */
export interface AiStorySource {
  title?: string | null
  content?: string | null
  transcript?: string | null
  createdAt?: string | null
}

export interface AiProjectContext {
  stories: AiStorySource[]
  locale?: string
  projectTitle?: string | null
  storytellerName?: string | null
}

/** Per-story and total character budgets keep multi-story prompts bounded. */
export const STORY_CHAR_LIMIT = 8000
export const STORIES_TOTAL_CHAR_LIMIT = 60000

export function formatStoriesForPrompt(stories: AiStorySource[]): string {
  const perStory = Math.min(STORY_CHAR_LIMIT, Math.floor(STORIES_TOTAL_CHAR_LIMIT / Math.max(stories.length, 1)))
  return stories.map((story, index) => {
    const text = (story.content || story.transcript || '').trim()
    const body = text.length > perStory ? `${text.slice(0, perStory)} […truncated]` : text
    const lines = [`Story ${index + 1}: ${story.title?.trim() || 'Untitled'}`]
    if (story.createdAt) lines.push(`Recorded: ${story.createdAt}`)
    lines.push(body || '(no text)')
    return lines.join('\n')
  }).join('\n---\n')
}

export function projectHeader(context: AiProjectContext): string {
  return [
    `Project: ${context.projectTitle?.trim() || 'Family biography'}`,
    `Storyteller: ${context.storytellerName?.trim() || 'Family member'}`,
    `Fallback language: ${aiLanguageName(context.locale)}`,
  ].join('\n')
}

export function projectMessages(context: AiProjectContext, system: string, request: string) {
  return buildMessages(
    composeSystemPrompt(system, languageInstruction(context.locale)),
    `${projectHeader(context)}\n\n${sourceMaterial('stories', formatStoriesForPrompt(context.stories))}\n\n${request}`,
  )
}

/** Accepts a string or a list of strings and normalizes to a list. */
export function textOrTextList(value: unknown, max: number): string[] {
  if (value === undefined || value === null) return []
  if (typeof value === 'string') return value.trim() ? [value.trim()] : []
  if (!Array.isArray(value)) throw new AiOutputError()
  return value.map(item => {
    const text = optionalText(item)
    if (text === undefined) throw new AiOutputError()
    return text
  }).slice(0, max)
}

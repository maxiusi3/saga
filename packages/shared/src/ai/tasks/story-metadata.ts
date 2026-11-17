import { buildMessages, composeSystemPrompt, INTERVIEW_QUESTION_PRINCIPLES, sourceMaterial } from '../base'
import { languageInstruction } from '../language'
import { optionalTextList, parseJsonObject, reportedConfidence, requiredText } from '../parse'
import type { AiTaskDefinition } from '../types'

export interface StoryMetadataInput {
  transcript: string
  /** The interview prompt the storyteller answered, if any. */
  promptContext?: string | null
  locale?: string
}

export interface StoryMetadataOutput {
  title: string
  summary: string
  followUpQuestions: string[]
  /** Warm, factual listener reflection affirming the value of the memory. */
  comfortNote?: string
  /** Provider-reported score, not a measured accuracy guarantee. */
  confidence?: number
}

export const STORY_TITLE_MAX = 60

const INSTRUCTIONS = `Task: write a title and a warm, affirming summary for one recorded family story, plus optional follow-up questions and a brief listener note.

- title: specific and memorable, drawn from what the story is actually about; at most ${STORY_TITLE_MAX} characters.
- summary: 2–3 warm sentences capturing what happened and affirming why these lived details are meaningful to preserve, using only facts from the transcript.
- comfortNote: optional 1–2 gentle sentences from an appreciative listener reflecting back the everyday care, humor, or resilience visible in the transcript (never invent facts or give clinical/therapy advice).
- followUpQuestions: up to 4 low-pressure questions that would help the storyteller share more about this memory; omit the field if none would be useful.

${INTERVIEW_QUESTION_PRINCIPLES}

Respond with a single JSON object: {"title": string, "summary": string, "comfortNote"?: string, "followUpQuestions"?: string[], "confidence"?: number between 0 and 1}.`

export const storyMetadataTask: AiTaskDefinition<StoryMetadataInput, StoryMetadataOutput> = {
  id: 'story_metadata',
  version: '2026-11-17.1',
  agentType: 'editor_librarian',
  tier: 'standard',
  responseFormat: 'json',
  temperature: 0.5,
  maxOutputTokens: 800,
  buildMessages(input) {
    const context = input.promptContext?.trim()
    return buildMessages(
      composeSystemPrompt(INSTRUCTIONS, languageInstruction(input.locale)),
      [
        context ? `Interview prompt the storyteller was answering: ${context}` : null,
        sourceMaterial('transcript', input.transcript),
      ].filter(Boolean).join('\n\n'),
    )
  },
  parse(raw) {
    const result = parseJsonObject(raw)
    const title = requiredText(result.title)
    const output: StoryMetadataOutput = {
      title: title.length > STORY_TITLE_MAX ? `${title.slice(0, STORY_TITLE_MAX - 3)}...` : title,
      summary: requiredText(result.summary),
      followUpQuestions: optionalTextList(result.followUpQuestions, 4),
    }
    if (typeof result.comfortNote === 'string' && result.comfortNote.trim().length > 0) {
      output.comfortNote = result.comfortNote.trim()
    }
    const confidence = reportedConfidence(result.confidence)
    if (confidence !== undefined) output.confidence = confidence
    return output
  },
}

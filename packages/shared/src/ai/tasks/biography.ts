import { INTERVIEW_QUESTION_PRINCIPLES } from '../base'
import { asObject, optionalTextList, parseJsonObject, reportedConfidence, requiredText } from '../parse'
import { projectMessages, textOrTextList, type AiProjectContext } from '../stories'
import { AiOutputError, type AiTaskDefinition } from '../types'

// ---------------------------------------------------------------------------
// Chapter draft from several related stories
// ---------------------------------------------------------------------------

export interface ChapterDraftOutput {
  title: string
  introduction: string
  summary: string
  themes: string[]
  timeline: string[]
  followUpQuestions: string[]
  confidence?: number
}

const CHAPTER_INSTRUCTIONS = `Task: you are a warm, respectful family biography editor. Organize the provided related stories into one chapter draft that preserves psychological safety for both the storyteller and the family.

- title: a meaningful chapter title.
- introduction: 100–200 words introducing what connects these stories, honoring everyday moments as well as major turns.
- summary: 150–300 words highlighting the key events and their emotional significance without flattening nuance or inventing reconciliations.
- themes: 3–5 main themes.
- timeline: chronological points in the form "period — event", using only dates or periods stated in the stories; keep unknown timing vague (for example "in their youth") rather than guessing years.
- followUpQuestions: 3–5 gentle, low-pressure questions that could uncover related memories.
- Preserve the storyteller's voice and perspective; do not add facts.

${INTERVIEW_QUESTION_PRINCIPLES}

Respond with a single JSON object:
{"title": string, "introduction": string, "summary": string, "themes": string[], "timeline": string[], "followUpQuestions": string[], "confidence"?: number between 0 and 1}`

export const chapterDraftTask: AiTaskDefinition<AiProjectContext, ChapterDraftOutput> = {
  id: 'chapter_draft',
  version: '2026-11-17.1',
  agentType: 'editor_librarian',
  tier: 'long_form',
  responseFormat: 'json',
  temperature: 0.6,
  maxOutputTokens: 2000,
  buildMessages(context) {
    return projectMessages(context, CHAPTER_INSTRUCTIONS, 'Create one chapter draft from these stories.')
  },
  parse(raw) {
    const result = parseJsonObject(raw)
    const output: ChapterDraftOutput = {
      title: requiredText(result.title),
      introduction: requiredText(result.introduction),
      summary: requiredText(result.summary),
      themes: optionalTextList(result.themes, 10),
      timeline: textOrTextList(result.timeline, 50),
      followUpQuestions: optionalTextList(result.followUpQuestions, 10),
    }
    const confidence = reportedConfidence(result.confidence)
    if (confidence !== undefined) output.confidence = confidence
    return output
  },
}

// ---------------------------------------------------------------------------
// Whole-project summary
// ---------------------------------------------------------------------------

export interface LifeStageSummary {
  stage: string
  summary: string
}

export interface ProjectSummaryOutput {
  title: string
  overview: string
  keyThemes: string[]
  lifeStages: LifeStageSummary[]
  wisdom: string[]
  legacy: string
  confidence?: number
}

const SUMMARY_INSTRUCTIONS = `Task: you are a warm, respectful family biography editor. Write a summary of the whole biography project from all recorded stories, honoring both quiet everyday memories and larger milestones without forcing dramatic endings.

- title: a title for the summary.
- overview: 200–300 words describing the storyteller's life as told in these stories, keeping uncertain timing or mixed feelings honest.
- keyThemes: 5–8 main themes.
- lifeStages: the life stages covered, each with a short summary grounded in the stories.
- wisdom: lessons or values the storyteller expressed in their own words or clearly implied; do not invent sayings.
- legacy: a warm closing paragraph on what these stories and the storyteller's own voice pass on to the family.

Respond with a single JSON object:
{"title": string, "overview": string, "keyThemes": string[], "lifeStages": [{"stage": string, "summary": string}], "wisdom": string[], "legacy": string, "confidence"?: number between 0 and 1}`

export const projectSummaryTask: AiTaskDefinition<AiProjectContext, ProjectSummaryOutput> = {
  id: 'project_summary',
  version: '2026-11-17.1',
  agentType: 'editor_librarian',
  tier: 'long_form',
  responseFormat: 'json',
  temperature: 0.6,
  maxOutputTokens: 2000,
  buildMessages(context) {
    return projectMessages(context, SUMMARY_INSTRUCTIONS, 'Create a summary of this family biography project.')
  },
  parse(raw) {
    const result = parseJsonObject(raw)
    if (result.lifeStages !== undefined && !Array.isArray(result.lifeStages)) throw new AiOutputError()
    const lifeStages = ((result.lifeStages as unknown[] | undefined) ?? []).slice(0, 20).map(item => {
      const entry = asObject(item)
      return { stage: requiredText(entry.stage), summary: requiredText(entry.summary) }
    })
    const output: ProjectSummaryOutput = {
      title: requiredText(result.title),
      overview: requiredText(result.overview),
      keyThemes: optionalTextList(result.keyThemes, 12),
      lifeStages,
      wisdom: textOrTextList(result.wisdom, 20),
      legacy: requiredText(result.legacy),
    }
    const confidence = reportedConfidence(result.confidence)
    if (confidence !== undefined) output.confidence = confidence
    return output
  },
}

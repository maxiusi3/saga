import { buildMessages, composeSystemPrompt, INTERVIEW_QUESTION_PRINCIPLES, sourceMaterial } from '../base'
import { languageInstruction, normalizeAiLocale } from '../language'
import { asObject, optionalTextList, parseJsonObject, reportedConfidence, requiredText } from '../parse'
import { projectMessages, type AiProjectContext } from '../stories'
import { AiOutputError, type AiTaskDefinition } from '../types'

/**
 * Every follow-up question in Saga comes from this module so the interview style is defined once:
 * - realtime: one short nudge while the storyteller is recording
 * - project: a question bank built from all existing stories
 * (Per-story questions are part of `story_metadata` to avoid a second call; they share the same principles.)
 */

// ---------------------------------------------------------------------------
// Realtime: one question during recording
// ---------------------------------------------------------------------------

export interface RealtimeFollowupInput {
  transcript: string
  locale?: string
  previousPrompts?: string[]
}

export const REALTIME_FOLLOWUP_MAX_CHARS = 200

const REALTIME_INSTRUCTIONS = `Task: the storyteller is recording a memory right now. Suggest ONE short follow-up question based on what they just said, as an empathetic listener would.

- At most 15 words (or about 30 characters in Chinese, Japanese or Korean).
- Natural, curious and encouraging; it should help them continue, not change the subject.

${INTERVIEW_QUESTION_PRINCIPLES}

Reply with the question text only: no quotes, labels or explanation.`

export const realtimeFollowupTask: AiTaskDefinition<RealtimeFollowupInput, string> = {
  id: 'followup_realtime',
  version: '2026-11-16.1',
  agentType: 'interview',
  tier: 'realtime',
  responseFormat: 'text',
  temperature: 0.7,
  maxOutputTokens: 60,
  buildMessages(input) {
    const previous = (input.previousPrompts ?? []).filter(item => typeof item === 'string' && item.trim()).slice(-20)
    return buildMessages(
      composeSystemPrompt(REALTIME_INSTRUCTIONS, languageInstruction(input.locale)),
      [
        previous.length ? `Questions already asked (do not repeat):\n${previous.map(item => `- ${item}`).join('\n')}` : null,
        sourceMaterial('live_transcript', input.transcript),
      ].filter(Boolean).join('\n\n'),
    )
  },
  parse(raw) {
    const line = raw.split('\n').map(item => item.trim()).find(Boolean) ?? ''
    const question = line.replace(/^(question|问题|問題)\s*[:：]\s*/i, '').replace(/^["'“”‘’「」]+|["'“”‘’「」]+$/g, '').trim()
    if (!question || question.length > REALTIME_FOLLOWUP_MAX_CHARS) throw new AiOutputError()
    return question
  },
}

/**
 * Deterministic interviewer nudge used when no text model is configured or the call fails.
 * This is a suggestion shown to the storyteller, never archive content.
 */
export function fallbackRealtimeFollowup(
  transcript: string,
  locale?: string,
  previousPrompts: string[] = [],
  random: () => number = Math.random,
): string {
  const t = transcript.toLowerCase()
  const isChinese = normalizeAiLocale(locale).startsWith('zh')
  let prompts: string[]

  if (isChinese) {
    prompts = ['然后发生了什么？', '那让你感觉如何？', '能多说一点吗？', '当时你在想什么？', '能描述一下当时的场景吗？', '还有谁在那里？', '为什么这对你很重要？']
    if (/小时候|童年|孩子/.test(t)) prompts = ['那时候你最喜欢做什么？', '你还记得当时的朋友吗？', '那段时光给你留下了什么印象？']
    else if (/工作|上班|职业/.test(t)) prompts = ['第一天上班是什么感觉？', '同事们怎么样？', '那份工作教会了你什么？']
    else if (/家|父母|妈妈|爸爸/.test(t)) prompts = ['家里当时的气氛是怎样的？', '父母对你有什么影响？', '你们有什么家庭传统吗？']
  } else {
    prompts = ['And then what happened?', 'How did that make you feel?', 'Tell me more about that.', 'What was going through your mind?', 'Can you describe the scene?', 'Who else was there?', 'Why was that important to you?']
    if (/child|young|school/.test(t)) prompts = ['What did you like to do back then?', 'Do you remember your friends?', 'What was your favorite memory from that time?']
    else if (/work|job|office/.test(t)) prompts = ['How was your first day?', 'What were your colleagues like?', 'What did you learn from that job?']
    else if (/family|mom|dad|parent/.test(t)) prompts = ['What was the atmosphere like at home?', 'How did your parents influence you?', 'Did you have any family traditions?']
  }

  const available = prompts.filter(prompt => !previousPrompts.includes(prompt))
  const candidates = available.length > 0 ? available : prompts
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))]
}

// ---------------------------------------------------------------------------
// Project: question bank from all stories
// ---------------------------------------------------------------------------

export interface ProjectQuestion {
  category: string
  question: string
}

export interface ProjectQuestionsOutput {
  categories: string[]
  questions: ProjectQuestion[]
  themes: string[]
  confidence?: number
}

const PROJECT_INSTRUCTIONS = `Task: you are an experienced family-history interviewer. Based on the stories already recorded, propose 20–30 follow-up questions that would uncover more meaningful memories.

- Identify themes and life periods that are mentioned but not yet explored, and gaps between stories.
- Group questions into categories such as childhood, work, family or places.

${INTERVIEW_QUESTION_PRINCIPLES}

Respond with a single JSON object:
{"categories": string[], "questions": [{"category": string, "question": string}], "themes": string[], "confidence"?: number between 0 and 1}`

export const projectQuestionsTask: AiTaskDefinition<AiProjectContext, ProjectQuestionsOutput> = {
  id: 'followup_project',
  version: '2026-11-16.1',
  agentType: 'interview',
  tier: 'long_form',
  responseFormat: 'json',
  temperature: 0.7,
  maxOutputTokens: 2000,
  buildMessages(context) {
    return projectMessages(context, PROJECT_INSTRUCTIONS, 'Propose follow-up questions for this family biography.')
  },
  parse(raw) {
    const result = parseJsonObject(raw)
    if (!Array.isArray(result.questions)) throw new AiOutputError()
    const questions = result.questions.slice(0, 40).map(item => {
      const entry = asObject(item)
      return { category: requiredText(entry.category), question: requiredText(entry.question) }
    })
    if (questions.length === 0) throw new AiOutputError()
    const output: ProjectQuestionsOutput = {
      categories: optionalTextList(result.categories, 20),
      questions,
      themes: optionalTextList(result.themes, 20),
    }
    const confidence = reportedConfidence(result.confidence)
    if (confidence !== undefined) output.confidence = confidence
    return output
  },
}

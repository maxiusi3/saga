import type { InterviewEventKind, InterventionLevel } from '@saga/shared/types/agents'

export type InterviewPhase =
  | 'opening'
  | 'warmup'
  | 'prior_story_recap'
  | 'story_listening'
  | 'transition'
  | 'closing'

export interface InterviewInterventionInput {
  interventionLevel: InterventionLevel
  phase: InterviewPhase
  storytellerName?: string
  currentPrompt?: string
  recentTranscript: string
  previousStorySummary: string | null
  previousPrompts: string[]
  silenceMs: number
}

export interface InterviewInterventionResult {
  shouldIntervene: boolean
  eventKind: InterviewEventKind | null
  triggerReason: string
  promptText: string
}

const MAX_PROMPT_LENGTH = 220
const EMOTIONAL_SUPPORT_SILENCE_MS = 3000
const NEGATIVE_EMOTION_PATTERN = /(painful|guilty|sad|grief|lonely|afraid|scared|ashamed|难过|内疚|伤心|害怕|孤独|痛苦)/i
const EXPLICIT_DISTRESS_PATTERN = /(need (?:a )?(?:break|pause)|can't (?:continue|talk)|cannot (?:continue|talk)|overwhelmed|崩溃|受不了|说不下去)/i

export function generateInterviewIntervention(input: InterviewInterventionInput): InterviewInterventionResult {
  if (input.interventionLevel === 'off') {
    return {
      shouldIntervene: false,
      eventKind: null,
      triggerReason: 'intervention_level_off',
      promptText: '',
    }
  }

  const name = input.storytellerName?.trim() || 'there'

  if (shouldOfferEmotionalSupport(input.recentTranscript, input.silenceMs)) {
    return {
      shouldIntervene: true,
      eventKind: 'emotional_support',
      triggerReason: 'negative_emotional_cue',
      promptText: 'We can pause for a moment if you want. Take your time; you do not have to rush this part.',
    }
  }

  if (input.phase === 'opening') {
    return {
      shouldIntervene: true,
      eventKind: 'opening',
      triggerReason: 'session_started',
      promptText: capPrompt(
        `Hi ${name}. I am here to listen and gently help if you get stuck. You can take your time. ${input.currentPrompt || 'Start wherever the memory begins for you.'}`,
      ),
    }
  }

  if (input.phase === 'warmup' && input.interventionLevel === 'high') {
    return {
      shouldIntervene: true,
      eventKind: 'warmup',
      triggerReason: 'high_level_warmup',
      promptText: 'Before the main story, what is one small detail from that time that still feels vivid to you?',
    }
  }

  if (input.phase === 'prior_story_recap' && input.previousStorySummary) {
    return {
      shouldIntervene: true,
      eventKind: 'prior_story_recap',
      triggerReason: 'previous_story_available',
      promptText: capPrompt(
        `${input.previousStorySummary} We can continue from there, or you can start with the moment that feels most important today.`,
      ),
    }
  }

  if (input.phase === 'story_listening') {
    const silenceThreshold = input.interventionLevel === 'high' ? 12000 : 20000
    if (input.silenceMs >= silenceThreshold) {
      const promptText = pickNonRepeatedPrompt(
        [
          'What happened next?',
          'Who else was there with you?',
          'Can you describe what the place looked or sounded like?',
          'What were you feeling in that moment?',
        ],
        input.previousPrompts,
      )
      if (!promptText) {
        return {
          shouldIntervene: false,
          eventKind: null,
          triggerReason: 'gentle_probe_exhausted',
          promptText: '',
        }
      }

      return {
        shouldIntervene: true,
        eventKind: 'gentle_probe',
        triggerReason: 'long_silence',
        promptText,
      }
    }
  }

  if (input.phase === 'transition' && input.interventionLevel === 'high') {
    return {
      shouldIntervene: true,
      eventKind: 'transition',
      triggerReason: 'high_level_transition',
      promptText: 'You just described an important turning point. We can stay with that moment and talk about what changed afterward.',
    }
  }

  if (input.phase === 'closing') {
    return {
      shouldIntervene: true,
      eventKind: 'closing',
      triggerReason: 'session_closing',
      promptText: 'Thank you for sharing that. Later, you can add names, dates, places, or photos if any details come back to you.',
    }
  }

  return {
    shouldIntervene: false,
    eventKind: null,
    triggerReason: 'listening_without_interrupting',
    promptText: '',
  }
}

function shouldOfferEmotionalSupport(recentTranscript: string, silenceMs: number) {
  return (
    EXPLICIT_DISTRESS_PATTERN.test(recentTranscript) ||
    (silenceMs >= EMOTIONAL_SUPPORT_SILENCE_MS && NEGATIVE_EMOTION_PATTERN.test(recentTranscript))
  )
}

function capPrompt(promptText: string) {
  const normalizedPrompt = promptText.trim().replace(/\s+/g, ' ')
  if (normalizedPrompt.length <= MAX_PROMPT_LENGTH) {
    return normalizedPrompt
  }

  return `${normalizedPrompt.slice(0, MAX_PROMPT_LENGTH - 3).trimEnd()}...`
}

function pickNonRepeatedPrompt(prompts: string[], previousPrompts: string[]) {
  const usedPrompts = new Set(previousPrompts.map(normalizePromptForComparison))

  return prompts.find(prompt => !usedPrompts.has(normalizePromptForComparison(prompt))) || null
}

function normalizePromptForComparison(prompt: string) {
  return prompt.trim().replace(/\s+/g, ' ').toLowerCase()
}

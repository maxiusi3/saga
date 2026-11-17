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
  locale?: string
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
const SELF_DEPRECATION_PATTERN = /(nothing special|boring life|ordinary life|not worth|nobody cares|没什么好说|平平淡淡|普通人|不值一提|没意思|没什么可讲)/i
const MEMORY_ANXIETY_PATTERN = /(can't remember when|cannot remember|forgot the year|memory is bad|getting old|记不清了|忘了哪一年|脑子不好使|记性不好|想不起来)/i

export function generateInterviewIntervention(input: InterviewInterventionInput): InterviewInterventionResult {
  if (input.interventionLevel === 'off') {
    return {
      shouldIntervene: false,
      eventKind: null,
      triggerReason: 'intervention_level_off',
      promptText: '',
    }
  }

  const isZh = Boolean(input.locale?.startsWith('zh') || /[\u4e00-\u9fff]/.test(input.recentTranscript))
  const name = input.storytellerName?.trim() || (isZh ? '' : 'there')

  const support = evaluatePsychologicalSafetySupport(input.recentTranscript, input.silenceMs, isZh)
  if (support) {
    return {
      shouldIntervene: true,
      eventKind: 'emotional_support',
      triggerReason: support.triggerReason,
      promptText: capPrompt(support.promptText),
    }
  }

  if (input.phase === 'opening') {
    return {
      shouldIntervene: true,
      eventKind: 'opening',
      triggerReason: 'session_started',
      promptText: capPrompt(
        isZh
          ? `${name ? `${name}，您好` : '您好'}。就像平时在家里聊天一样，想到哪儿说到哪儿，不用担心说错。${input.currentPrompt || '从您最有印象的画面开始吧。'}`
          : `Hi ${name}. Just chat naturally like sitting at the kitchen table—there is no right or wrong way, take your time. ${input.currentPrompt || 'Start wherever the memory begins for you.'}`,
      ),
    }
  }

  if (input.phase === 'warmup' && input.interventionLevel === 'high') {
    return {
      shouldIntervene: true,
      eventKind: 'warmup',
      triggerReason: 'high_level_warmup',
      promptText: isZh
        ? '正式聊之前，哪怕是一个很小的生活细节——比如当时的天气、味道或一句口头禅——都可以从那里聊起。'
        : 'Before the main story, what is one small, ordinary detail from that time—a smell, a room, or a routine—that still feels vivid?',
    }
  }

  if (input.phase === 'prior_story_recap' && input.previousStorySummary) {
    return {
      shouldIntervene: true,
      eventKind: 'prior_story_recap',
      triggerReason: 'previous_story_available',
      promptText: capPrompt(
        isZh
          ? `${input.previousStorySummary} 我们可以接着往下聊，也可以换一个您今天更想说的片段。`
          : `${input.previousStorySummary} We can continue from there, or you can start with whatever memory feels easiest today.`,
      ),
    }
  }

  if (input.phase === 'story_listening') {
    const silenceThreshold = input.interventionLevel === 'high' ? 12000 : 20000
    if (input.silenceMs >= silenceThreshold) {
      const candidatePrompts = isZh
        ? [
            '慢慢想，不着急。后来发生了什么？',
            '那时候身边还有谁陪着您？',
            '能说说那个地方当时看起来或者听起来是什么样的吗？',
            '当时心里是什么感觉？',
          ]
        : [
            'What happened next?',
            'Who else was there with you?',
            'Can you describe what the place looked or sounded like?',
            'What were you feeling in that moment?',
          ]
      const promptText = pickNonRepeatedPrompt(candidatePrompts, input.previousPrompts)
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
      promptText: isZh
        ? '您刚才讲的这个片段很有画面感。如果愿意的话，我们可以继续聊聊之后生活有了什么变化。'
        : 'You just shared a meaningful turning point. If you feel comfortable, we can stay with that moment and talk about what changed afterward.',
    }
  }

  if (input.phase === 'closing') {
    return {
      shouldIntervene: true,
      eventKind: 'closing',
      triggerReason: 'session_closing',
      promptText: isZh
        ? '谢谢您分享这些珍贵的记忆，您的原声已经稳稳保留下来。之后您或家人随时可以补充人名、大概年份或老照片。'
        : 'Thank you for sharing this piece of your story—your voice is safely saved. Later, you or your family can add names, rough years, or photos anytime.',
    }
  }

  return {
    shouldIntervene: false,
    eventKind: null,
    triggerReason: 'listening_without_interrupting',
    promptText: '',
  }
}

function evaluatePsychologicalSafetySupport(
  recentTranscript: string,
  silenceMs: number,
  isZh: boolean,
): { triggerReason: string; promptText: string } | null {
  if (
    EXPLICIT_DISTRESS_PATTERN.test(recentTranscript) ||
    (silenceMs >= EMOTIONAL_SUPPORT_SILENCE_MS && NEGATIVE_EMOTION_PATTERN.test(recentTranscript))
  ) {
    return {
      triggerReason: 'negative_emotional_cue',
      promptText: isZh
        ? '聊到这些心里一定不好受。咱们随时可以暂停（pause）休息一下，或者跳过这段，完全没关系的。'
        : 'We can pause for a moment if you want. Take your time; you do not have to rush this part.',
    }
  }

  if (silenceMs >= EMOTIONAL_SUPPORT_SILENCE_MS && SELF_DEPRECATION_PATTERN.test(recentTranscript)) {
    return {
      triggerReason: 'self_deprecation_reassurance',
      promptText: isZh
        ? '家里人最珍视的往往就是平平淡淡的日常点滴。哪怕是一件生活小事也很值得留下，您可以慢慢讲，随时可以暂停（pause）。'
        : 'Everyday moments and ordinary days are often what family members treasure most. Even a small detail from your daily life is worth keeping—take your time, or pause whenever you like.',
    }
  }

  if (silenceMs >= EMOTIONAL_SUPPORT_SILENCE_MS && MEMORY_ANXIETY_PATTERN.test(recentTranscript)) {
    return {
      triggerReason: 'memory_uncertainty_reassurance',
      promptText: isZh
        ? '记不清准确的年份或名字完全没关系，这不是考试。您只管聊聊印象里的画面，随时可以暂停（pause）。'
        : 'It is completely okay not to remember exact dates or names—this is not a test. Just share whatever image or feeling comes to mind, and pause whenever you need.',
    }
  }

  return null
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

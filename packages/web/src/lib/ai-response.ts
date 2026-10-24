/** Validate provider responses before they can become family archive content. */
export class InvalidAIResponseError extends Error {
  constructor() {
    super('Invalid response from AI service')
    this.name = 'InvalidAIResponseError'
  }
}

function responseObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidAIResponseError()
  }
  return value as Record<string, unknown>
}

function reportedConfidence(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : undefined
}

export function parseTranscriptionResponse(value: unknown) {
  const result = responseObject(value)
  // Empty text can represent silence; missing or non-text output is a failure.
  if (typeof result.text !== 'string') throw new InvalidAIResponseError()
  return {
    text: result.text,
    confidence: reportedConfidence(result.confidence),
    duration: typeof result.duration === 'number' && Number.isFinite(result.duration) && result.duration >= 0
      ? result.duration
      : undefined,
  }
}

export function parseGeneratedContent(value: unknown) {
  const result = responseObject(value)
  if (typeof result.title !== 'string' || !result.title.trim() ||
      typeof result.summary !== 'string' || !result.summary.trim()) {
    throw new InvalidAIResponseError()
  }
  // Follow-up questions are optional; never invent them for an otherwise valid draft.
  const questions = result.followUpQuestions === undefined ? [] : result.followUpQuestions
  if (!Array.isArray(questions) || questions.some(question => typeof question !== 'string')) {
    throw new InvalidAIResponseError()
  }
  return {
    title: result.title,
    summary: result.summary,
    followUpQuestions: questions.slice(0, 4) as string[],
    // This is a provider-reported score, not a measured accuracy guarantee.
    confidence: reportedConfidence(result.confidence),
  }
}

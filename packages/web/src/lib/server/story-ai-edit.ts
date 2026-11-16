import { createHash } from 'node:crypto'
import {
  STORY_EDIT_PROCESSOR_ID,
  StoryEditValidationError,
  factReviewTask,
  paragraphEditorTask,
  validateStoryEditSource,
  type StoryEditedParagraph,
  type StoryFactVerdict,
} from '@saga/shared'
import type { ReviewTranscript } from '@/lib/story-review-contract'
import { StoryAiEditError, type AiModelTarget, type StoryAiEditConfiguration } from '@/lib/story-ai-edit-contract'
import { APPROVED_CAPABILITY_CONFIG, verifyProviderPolicyEvidence } from './provider-policy-verification'
export { parseStoryAiEditRequest, StoryAiEditError } from '@/lib/story-ai-edit-contract'
type Env = Record<string, string | undefined>
type ConfigOptions = { env?: Env; now?: Date }
type Segment = ReviewTranscript['segments'][number]
export type EditedParagraph = StoryEditedParagraph
export type FactVerdict = StoryFactVerdict
export type AiModelResult = { paragraphs: EditedParagraph[]; verdicts: FactVerdict[]; metadata: { editor: ModelReceipt; reviewer: ModelReceipt } }
type ModelReceipt = AiModelTarget & { responseId: string; inputTokens: number | null; outputTokens: number | null }
export const aiHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const defaults = { editor: { provider: 'anthropic', model: 'claude-opus-5-5', region: 'us' }, reviewer: { provider: 'openai', model: 'gpt-6-astra', region: 'us' } } as const
function policy(options: ConfigOptions) {
  const env = options.env ?? process.env
  if (env.MEDIA_ASSETS_ENABLED !== 'true' || env.G2_AI_EDIT_ENABLED !== 'true') return null
  try {
    const editor: AiModelTarget = { ...defaults.editor, model: env.G2_AI_EDITOR_MODEL ?? defaults.editor.model, region: env.G2_AI_EDITOR_REGION ?? 'us' }
    const reviewer: AiModelTarget = { ...defaults.reviewer, model: env.G2_AI_REVIEWER_MODEL ?? defaults.reviewer.model, region: env.G2_AI_REVIEWER_REGION ?? 'us' }
    // Direct official endpoints only. Regional qualification must match the serving endpoint.
    if (editor.region !== 'us' || reviewer.region !== 'us' || editor.model !== APPROVED_CAPABILITY_CONFIG.story_extract_edit.defaultModelId || !APPROVED_CAPABILITY_CONFIG.story_fact_review.approvedModels.includes(reviewer.model)) return null
    const editorEvidence = verifyProviderPolicyEvidence(JSON.parse(env.G2_AI_EDITOR_POLICY_EVIDENCE ?? ''), { now: options.now, targetRegion: editor.region })
    const reviewerEvidence = verifyProviderPolicyEvidence(JSON.parse(env.G2_AI_REVIEWER_POLICY_EVIDENCE ?? ''), { now: options.now, targetRegion: reviewer.region })
    if (!editorEvidence.valid || !reviewerEvidence.valid || editorEvidence.parsed?.provider !== editor.provider || editorEvidence.parsed.modelId !== editor.model || reviewerEvidence.parsed?.provider !== reviewer.provider || reviewerEvidence.parsed.modelId !== reviewer.model) return null
    for (const key of [env.ANTHROPIC_API_KEY, env.OPENAI_API_KEY]) if (!key || /\s/.test(key)) return null
    const policyVersion = 'g2-ai-' + aiHash({ editor, reviewer, editorEvidence: editorEvidence.parsed, reviewerEvidence: reviewerEvidence.parsed, processor: STORY_EDIT_PROCESSOR_ID })
    return { editor, reviewer, policyVersion, editorKey: env.ANTHROPIC_API_KEY!, reviewerKey: env.OPENAI_API_KEY! }
  } catch { return null }
}
export function getStoryAiEditConfiguration(options: ConfigOptions = {}): StoryAiEditConfiguration {
  const p = policy(options)
  return { ready: !!p, requiresConsent: true, policyVersion: p?.policyVersion ?? null, editor: p?.editor ?? defaults.editor, reviewer: p?.reviewer ?? defaults.reviewer }
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new StoryAiEditError(502, 'provider_invalid_response')
  return value as Record<string, unknown>
}
function text(value: unknown, max = 10000): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max && !value.includes('\0')
}
function mapValidation<T>(fn: () => T): T {
  try {
    return fn()
  } catch (error) {
    if (
      error instanceof StoryEditValidationError ||
      (error instanceof Error &&
        error.name === 'StoryEditValidationError' &&
        typeof (error as Partial<StoryEditValidationError>).status === 'number' &&
        typeof (error as Partial<StoryEditValidationError>).code === 'string')
    ) {
      const validationError = error as StoryEditValidationError
      throw new StoryAiEditError(validationError.status, validationError.code)
    }
    throw error
  }
}
export function validateAiSource(segments: Segment[]) {
  mapValidation(() => validateStoryEditSource(segments))
}
export function parseEditedParagraphs(raw: unknown, segments: Segment[]): EditedParagraph[] {
  return mapValidation(() => paragraphEditorTask.parse(raw, segments))
}
export function parseFactReview(raw: unknown, paragraphs: EditedParagraph[]): FactVerdict[] {
  return mapValidation(() => factReviewTask.parse(raw, paragraphs))
}
async function boundedJson(response: Response, wait: <T>(p: PromiseLike<T>) => Promise<T>) {
  if (!response.ok || !response.body) throw new StoryAiEditError(502, 'provider_failed')
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0
  try {
    while (true) {
      const item = await wait(reader.read())
      if (item.done) break
      size += item.value.byteLength
      if (size > 700000) throw new StoryAiEditError(502, 'provider_invalid_response')
      chunks.push(item.value)
    }
    const bytes = new Uint8Array(size); let pos = 0
    for (const c of chunks) { bytes.set(c, pos); pos += c.length }
    return object(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))
  } finally { void reader.cancel().catch(() => {}); reader.releaseLock() }
}
function usage(value: unknown) {
  const u = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const count = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0 && Number(n) <= 10000000 ? Number(n) : null
  return { inputTokens: count(u.input_tokens), outputTokens: count(u.output_tokens) }
}
export async function callStoryAiModels(segments: Segment[], options: ConfigOptions & { fetch?: typeof fetch; signal?: AbortSignal; timeoutMs?: number; beforeSend: (stage: 'editor' | 'reviewer') => Promise<void> }): Promise<AiModelResult> {
  const p = policy(options); if (!p) throw new StoryAiEditError(503, 'unavailable'); validateAiSource(segments)
  const timeout = options.timeoutMs ?? 55000; if (!Number.isInteger(timeout) || timeout < 1 || timeout > 120000) throw new StoryAiEditError(503, 'unavailable')
  const controller = new AbortController(), abort = () => controller.abort(), timer = setTimeout(abort, timeout); options.signal?.addEventListener('abort', abort, { once: true }); if (options.signal?.aborted) abort()
  const wait = async <T>(promise: PromiseLike<T>): Promise<T> => {
    let onAbort = () => {}
    const interrupt = new Promise<never>((_, reject) => {
      onAbort = () => reject(new StoryAiEditError(503, 'outcome_unknown'))
      controller.signal.addEventListener('abort', onAbort, { once: true })
      if (controller.signal.aborted) onAbort()
    })
    try { return await Promise.race([promise, interrupt]) } finally { controller.signal.removeEventListener('abort', onAbort) }
  }
  const fetcher = options.fetch ?? fetch
  try {
    if (controller.signal.aborted) throw new StoryAiEditError(503, 'outcome_unknown')
    await wait(options.beforeSend('editor')); if (controller.signal.aborted) throw new StoryAiEditError(503, 'outcome_unknown')
    const edited = await boundedJson(await wait(fetcher('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': p.editorKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: p.editor.model,
        max_tokens: paragraphEditorTask.maxOutputTokens,
        system: paragraphEditorTask.systemPrompt,
        messages: [{ role: 'user', content: paragraphEditorTask.buildUserPayload(segments) }],
      }),
    })), wait)
    if (edited.model !== p.editor.model || edited.stop_reason !== 'end_turn' || !text(edited.id, 200) || !Array.isArray(edited.content) || edited.content.length !== 1) throw new StoryAiEditError(502, 'provider_invalid_response')
    const block = object(edited.content[0]); if (block.type !== 'text' || !text(block.text, 650000)) throw new StoryAiEditError(502, 'provider_invalid_response')
    const paragraphs = parseEditedParagraphs(JSON.parse(block.text), segments)
    await wait(options.beforeSend('reviewer')); if (controller.signal.aborted) throw new StoryAiEditError(503, 'outcome_unknown')
    const reviewed = await boundedJson(await wait(fetcher('https://api.openai.com/v1/responses', {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${p.reviewerKey}` },
      body: JSON.stringify({
        model: p.reviewer.model,
        store: false,
        max_output_tokens: factReviewTask.maxOutputTokens,
        instructions: factReviewTask.systemPrompt,
        input: factReviewTask.buildUserPayload(segments, paragraphs),
      }),
    })), wait)
    if (reviewed.model !== p.reviewer.model || reviewed.status !== 'completed' || !text(reviewed.id, 200) || !Array.isArray(reviewed.output)) throw new StoryAiEditError(502, 'review_invalid')
    const messages = reviewed.output.filter(v => object(v).type === 'message'); if (messages.length !== 1) throw new StoryAiEditError(502, 'review_invalid'); const message = object(messages[0])
    if (message.role !== 'assistant' || !Array.isArray(message.content) || message.content.length !== 1) throw new StoryAiEditError(502, 'review_invalid'); const content = object(message.content[0]); if (content.type !== 'output_text' || !text(content.text, 650000)) throw new StoryAiEditError(502, 'review_invalid')
    return { paragraphs, verdicts: parseFactReview(JSON.parse(content.text), paragraphs), metadata: { editor: { ...p.editor, responseId: edited.id, ...usage(edited.usage) }, reviewer: { ...p.reviewer, responseId: reviewed.id, ...usage(reviewed.usage) } } }
  } catch (error) {
    if (error instanceof StoryAiEditError) throw error
    if (error instanceof SyntaxError) throw new StoryAiEditError(502, 'provider_invalid_response')
    throw error
  } finally {
    clearTimeout(timer); options.signal?.removeEventListener('abort', abort); abort()
  }
}

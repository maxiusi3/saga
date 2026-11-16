import OpenAI from 'openai'
import type { AiModelTier, AiTaskDefinition } from '@saga/shared/ai'
import { completeAgentRun, createAgentRun, failAgentRun } from './agent-store'
import { getTextAiConfigForTier } from './text-ai-config'

/**
 * Single entry point for task-based text AI calls (OpenAI-compatible endpoint, e.g. OpenRouter).
 * Owns provider client creation, tier routing, timeouts, bounded retries, output validation,
 * optional agent_runs audit persistence, and content-free structured logging.
 */

export type AiTaskErrorCode =
  | 'unavailable'
  | 'invalid_request'
  | 'rate_limited'
  | 'quota_exceeded'
  | 'timeout'
  | 'invalid_response'
  | 'provider_failed'

export class AiTaskError extends Error {
  constructor(readonly code: AiTaskErrorCode, readonly taskId: string, readonly cause?: unknown) {
    super(`AI task ${taskId} failed: ${code}`)
    this.name = 'AiTaskError'
  }
}

interface TierPolicy {
  timeoutMs: number
  maxRetries: number
}

export const AI_TIER_POLICY: Record<AiModelTier, TierPolicy> = {
  realtime: { timeoutMs: 8_000, maxRetries: 0 },
  standard: { timeoutMs: 30_000, maxRetries: 1 },
  long_form: { timeoutMs: 60_000, maxRetries: 1 },
}

export interface AiTaskAuditContext {
  actorId: string
  projectId?: string | null
  storyId?: string | null
  interviewSessionId?: string | null
  recordingSessionId?: string | null
  inputSummary?: Record<string, unknown>
}

export interface AiTaskRunMetadata {
  taskId: string
  taskVersion: string
  tier: AiModelTier
  model: string
  latencyMs: number
  inputTokens: number | null
  outputTokens: number | null
  agentRunId: string | null
}

export interface AiTaskRunResult<Output> {
  output: Output
  metadata: AiTaskRunMetadata
}

export function isTextAiConfigured(tier: AiModelTier = 'standard'): boolean {
  return getTextAiConfigForTier(tier) !== null
}

function normalizeAuditId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function runAiTask<Input, Output>(
  task: AiTaskDefinition<Input, Output>,
  input: Input,
  options: { signal?: AbortSignal; audit?: AiTaskAuditContext } = {},
): Promise<AiTaskRunResult<Output>> {
  const config = getTextAiConfigForTier(task.tier)
  if (!config) throw new AiTaskError('unavailable', task.id)

  const actorId = normalizeAuditId(options.audit?.actorId)
  const projectId = normalizeAuditId(options.audit?.projectId)
  const storyId = normalizeAuditId(options.audit?.storyId)
  const interviewSessionId = normalizeAuditId(options.audit?.interviewSessionId)
  const recordingSessionId = normalizeAuditId(options.audit?.recordingSessionId)

  let agentRunId: string | null = null
  if (actorId && (projectId || storyId || interviewSessionId)) {
    const run = await createAgentRun({
      agentType: task.agentType,
      projectId,
      storyId,
      interviewSessionId,
      createdBy: actorId,
      // Keep contentHash null so task audit runs never collide with editor_librarian content-hash deduplication.
      contentHash: null,
      model: config.model,
      input: {
        taskId: task.id,
        taskVersion: task.version,
        tier: task.tier,
        ...(recordingSessionId ? { recordingSessionId } : {}),
        ...(options.audit?.inputSummary ?? {}),
      },
    })
    agentRunId = String(run.id)
  }

  const recordFailure = async (code: AiTaskErrorCode) => {
    if (!agentRunId) return
    await failAgentRun(agentRunId, code).catch(() => {})
  }

  const policy = AI_TIER_POLICY[task.tier]
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    timeout: policy.timeoutMs,
    maxRetries: policy.maxRetries,
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000',
      'X-Title': 'Saga Family Biography Platform',
    },
  })

  const startedAt = Date.now()
  let completion: Awaited<ReturnType<typeof client.chat.completions.create>>
  try {
    const request = {
      model: config.model,
      messages: task.buildMessages(input),
      temperature: task.temperature,
      max_tokens: task.maxOutputTokens,
      ...(task.responseFormat === 'json' ? { response_format: { type: 'json_object' as const } } : {}),
    }
    completion = options.signal
      ? await client.chat.completions.create(request, { signal: options.signal })
      : await client.chat.completions.create(request)
  } catch (error) {
    const code = classifyProviderError(error)
    await recordFailure(code)
    logRun(task, config.model, startedAt, { outcome: code, agentRunId })
    throw new AiTaskError(code, task.id, error)
  }

  const metadata: AiTaskRunMetadata = {
    taskId: task.id,
    taskVersion: task.version,
    tier: task.tier,
    model: config.model,
    latencyMs: Date.now() - startedAt,
    inputTokens: tokenCount(completion?.usage?.prompt_tokens),
    outputTokens: tokenCount(completion?.usage?.completion_tokens),
    agentRunId,
  }

  const raw = completion?.choices?.[0]?.message?.content
  if (typeof raw !== 'string' || !raw.trim()) {
    await recordFailure('invalid_response')
    logRun(task, config.model, startedAt, { outcome: 'invalid_response', reason: 'empty', agentRunId })
    throw new AiTaskError('invalid_response', task.id)
  }

  let output: Output
  try {
    output = task.parse(raw)
  } catch (error) {
    // Parsers are pure validators: any failure (AiOutputError, SyntaxError, ...) means unusable output.
    await recordFailure('invalid_response')
    logRun(task, config.model, startedAt, { outcome: 'invalid_response', reason: 'parse', agentRunId })
    throw new AiTaskError('invalid_response', task.id, error)
  }

  if (agentRunId) {
    await completeAgentRun(agentRunId, {
      taskId: task.id,
      taskVersion: task.version,
      tier: task.tier,
      model: metadata.model,
      latencyMs: metadata.latencyMs,
      inputTokens: metadata.inputTokens,
      outputTokens: metadata.outputTokens,
    })
  }

  logRun(task, config.model, startedAt, {
    outcome: 'ok',
    inputTokens: metadata.inputTokens,
    outputTokens: metadata.outputTokens,
    agentRunId,
  })
  return { output, metadata }
}

export function classifyProviderError(error: unknown): AiTaskErrorCode {
  const value = (error ?? {}) as {
    status?: number
    code?: string
    name?: string
    message?: string
    error?: { type?: string; code?: string }
  }
  const status = value.status
  const code = value.error?.code ?? value.code
  if (status === 429 || code === 'rate_limit_exceeded') return 'rate_limited'
  if (status === 402 || code === 'insufficient_quota') return 'quota_exceeded'
  if (value.name === 'APIConnectionTimeoutError' || code === 'ETIMEDOUT' || /timeout|timed out/i.test(value.message ?? '')) {
    return 'timeout'
  }
  if (status === 400 || value.error?.type === 'invalid_request_error') return 'invalid_request'
  return 'provider_failed'
}

/** Client-safe HTTP mapping for runner errors. Provider details are never echoed in production. */
export function aiTaskErrorResponse(error: AiTaskError): { status: number; error: string } {
  switch (error.code) {
    case 'unavailable':
      return { status: 503, error: 'Text AI service is not configured' }
    case 'invalid_request':
      return { status: 400, error: 'Invalid request to AI service' }
    case 'rate_limited':
      return { status: 429, error: 'Rate limit exceeded. Please try again later.' }
    case 'quota_exceeded':
      return { status: 402, error: 'AI provider quota exceeded. Please check your billing.' }
    case 'timeout':
      return { status: 504, error: 'Request timeout. Please try again.' }
    case 'invalid_response':
      return { status: 502, error: 'Invalid response from AI service' }
    default:
      return { status: 502, error: 'AI service request failed. Please try again.' }
  }
}

function tokenCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function logRun(
  task: Pick<AiTaskDefinition<unknown, unknown>, 'id' | 'version' | 'tier'>,
  model: string,
  startedAt: number,
  details: Record<string, unknown>,
) {
  // Structured, content-free log line: no transcripts or outputs.
  console.info(JSON.stringify({
    event: 'ai_task_run',
    taskId: task.id,
    taskVersion: task.version,
    tier: task.tier,
    model,
    latencyMs: Date.now() - startedAt,
    ...details,
  }))
}

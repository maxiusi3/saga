/**
 * Contracts for task-specific AI prompts.
 *
 * Every AI capability in Saga is a fixed, versioned task: a system prompt composed from the shared
 * base layer plus task instructions, a deterministic message builder, and a strict output parser.
 * Orchestration between tasks stays in code/workers, never in a free-roaming agent.
 */

import type { AgentType } from '../types/agents'

/** Routing hint. The server maps tiers to configured models, timeouts and retry budgets. */
export type AiModelTier = 'realtime' | 'standard' | 'long_form'

export interface AiMessage {
  role: 'system' | 'user'
  content: string
}

export interface AiTaskDefinition<Input, Output> {
  /** Stable identifier, e.g. `story_metadata`. */
  id: string
  /** Bump whenever prompt wording, parsing rules or output shape changes. */
  version: string
  agentType: AgentType
  tier: AiModelTier
  responseFormat: 'json' | 'text'
  temperature: number
  maxOutputTokens: number
  buildMessages(input: Input): AiMessage[]
  /** Validates raw provider text. Throws {@link AiOutputError} instead of substituting templates. */
  parse(raw: string): Output
}

/** The provider returned content that cannot safely become product data. */
export class AiOutputError extends Error {
  constructor(message = 'Invalid response from AI service') {
    super(message)
    this.name = 'AiOutputError'
  }
}

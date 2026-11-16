const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const DEFAULT_TEXT_MODEL = 'openai/gpt-oss-20b:free'

export interface TextAiConfig {
  apiKey: string
  baseURL: string
  model: string
}

export function normalizeOpenAiBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '')
  return trimmed.replace(/\/chat\/completions$/, '')
}

export function getTextAiConfig(): TextAiConfig | null {
  const apiKey = process.env.TEXT_API_KEY || process.env.OPENROUTER_API_KEY
  if (!apiKey) return null

  return {
    apiKey,
    baseURL: normalizeOpenAiBaseUrl(process.env.TEXT_API_BASE_URL || DEFAULT_OPENROUTER_BASE_URL),
    model: process.env.TEXT_MODEL || DEFAULT_TEXT_MODEL,
  }
}

export type TextAiTier = 'realtime' | 'standard' | 'long_form'

const TIER_MODEL_ENV: Record<TextAiTier, string> = {
  realtime: 'TEXT_MODEL_REALTIME',
  standard: 'TEXT_MODEL_STANDARD',
  long_form: 'TEXT_MODEL_LONG_FORM',
}

/** Same endpoint and key; an optional per-tier model override, falling back to TEXT_MODEL. */
export function getTextAiConfigForTier(tier: TextAiTier): TextAiConfig | null {
  const config = getTextAiConfig()
  if (!config) return null
  const override = process.env[TIER_MODEL_ENV[tier]]?.trim()
  return override ? { ...config, model: override } : config
}

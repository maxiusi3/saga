import { AiOutputError } from './types'

export function parseJsonObject(raw: string): Record<string, unknown> {
  let value: unknown
  try {
    value = JSON.parse(stripCodeFence(raw))
  } catch {
    throw new AiOutputError()
  }
  return asObject(value)
}

export function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AiOutputError()
  return value as Record<string, unknown>
}

export function requiredText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new AiOutputError()
  return value.trim()
}

export function optionalText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new AiOutputError()
  return value.trim() || undefined
}

/** Optional list of strings; omitted means empty, but a wrong type is a failure. */
export function optionalTextList(value: unknown, max: number): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) throw new AiOutputError()
  return (value as string[]).map(item => item.trim()).filter(Boolean).slice(0, max)
}

/** Provider-reported score: passed through only when in range, never raised or fabricated. */
export function reportedConfidence(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : undefined
}

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim()
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed)
  return match ? match[1] : trimmed
}

import { createHash, randomUUID } from 'crypto'
import { hasActiveConsent, type ConsentRecord } from './consent-deletion'

export type AiCapabilityKind = 'asr_transcribe' | 'story_extract_edit' | 'evidence_verify'

export interface ProviderPolicyDescriptor {
  provider: string
  model: string
  region: string
  policyVersion?: string
  trainingOptOut: boolean
  retentionDays: number
  isLocalWorker?: boolean
}

export interface CapabilityInvocationContext {
  projectId: string
  storyId: string
  actorId: string
  surface: 'formal_archive' | 'isolated_demo'
  isDemoMode?: boolean
  isDeletionBlocked?: boolean
  now?: string
  consentRecords: ConsentRecord[]
  policy: ProviderPolicyDescriptor
}

export interface RawAsrSegmentInput {
  speakerLabel?: string | null
  startMs?: number | null
  endMs?: number | null
  text: string
  confidence?: number | null
}

export interface TranscriptSegmentRecord {
  id: string
  projectId: string
  transcriptVersionId: string
  segmentIndex: number
  speakerLabel: string
  startMs: number | null
  endMs: number | null
  text: string
  confidence: number
  isHumanCorrected: boolean
}

export interface TranscriptVersionRecord {
  id: string
  projectId: string
  storyId: string
  assetId: string | null
  version: number
  language: string
  provider: string
  model: string
  alignmentStatus: 'aligned' | 'legacy_unaligned' | 'human_corrected'
  contentSha256: string
  fullText: string
  preserveAsShortClip: boolean
  isCurrent: boolean
  createdBy: string
  segments: TranscriptSegmentRecord[]
}

export interface AiUsageLedgerEntry {
  id: string
  projectId: string
  storyId: string
  capability: AiCapabilityKind
  provider: string
  model: string
  region: string
  usageUnits: number
  estimatedCostUsd: number
  providerRequestId: string | null
  recordedAt: string
}

const SIMULATED_OUTPUT_PATTERNS = [
  /\[mock[\s_-]?transcript\]/i,
  /\[simulated[\s_-]?ai\]/i,
  /lorem ipsum dolor sit amet/i,
]

export function assertCapabilityGatewayGuard(
  capability: AiCapabilityKind,
  ctx: CapabilityInvocationContext,
): void {
  if (ctx.surface === 'formal_archive' && ctx.isDemoMode) {
    throw new Error('zero_simulation_violation: formal archive paths forbid demo or simulated AI outputs')
  }
  if (ctx.isDeletionBlocked) {
    throw new Error('deletion_tombstone_active: AI capability invocation blocked by deletion tombstone')
  }
  if (!ctx.policy.trainingOptOut) {
    throw new Error(`provider_policy_rejected: provider ${ctx.policy.provider} must have trainingOptOut enabled`)
  }
  if (!Number.isFinite(ctx.policy.retentionDays) || ctx.policy.retentionDays < 0 || ctx.policy.retentionDays > 30) {
    throw new Error(`provider_policy_rejected: provider ${ctx.policy.provider} retentionDays exceeds 30-day boundary`)
  }

  if (!ctx.policy.isLocalWorker) {
    const consented = hasActiveConsent(ctx.consentRecords, {
      grantorId: ctx.actorId,
      subjectId: ctx.storyId,
      purpose: 'cloud_ai',
      policyVersion: ctx.policy.policyVersion ?? 'v1',
      provider: ctx.policy.provider,
      region: ctx.policy.region,
      at: ctx.now ?? new Date().toISOString(),
    })
    if (!consented) {
      throw new Error(`cloud_ai_consent_required: no active cloud_ai consent for ${ctx.policy.provider}/${ctx.policy.region} on ${capability}`)
    }
  }
}

export function assertNonSimulatedText(text: string): void {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error('invalid_ai_output: empty AI output')
  }
  for (const pattern of SIMULATED_OUTPUT_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw new Error('zero_simulation_violation: simulated placeholder text detected in formal AI output')
    }
  }
}

export function isShortGreetingOrLaughter(fullText: string, totalDurationMs: number | null): boolean {
  const normalized = fullText.trim()
  const wordCount = normalized.split(/\s+/).filter(Boolean).length
  const charCount = normalized.replace(/\s+/g, '').length
  const isBrief = (totalDurationMs !== null && totalDurationMs > 0 && totalDurationMs <= 12_000) || (wordCount <= 12 && charCount <= 40)
  const greetingOrLaughterPattern = /^(happy birthday|congratulations|haha|hehe|\[laughter\]|生日快乐|恭喜|哈哈|呵呵)/i
  return isBrief && (greetingOrLaughterPattern.test(normalized) || charCount <= 24)
}

export function buildVersionedTranscript(input: {
  transcriptVersionId?: string
  projectId: string
  storyId: string
  assetId?: string | null
  version: number
  language: string
  provider: string
  model: string
  createdBy: string
  isHumanCorrected?: boolean
  rawSegments: RawAsrSegmentInput[]
}): TranscriptVersionRecord {
  if (!Number.isSafeInteger(input.version) || input.version <= 0) {
    throw new Error('Transcript version must be a positive safe integer')
  }
  if (!Array.isArray(input.rawSegments) || input.rawSegments.length === 0) {
    throw new Error('Transcript requires at least one segment')
  }

  const transcriptVersionId = input.transcriptVersionId?.trim() || randomUUID()
  let hasCompleteTimestamps = true
  let previousStartMs = 0

  const segments: TranscriptSegmentRecord[] = input.rawSegments.map((seg, index) => {
    const cleanText = typeof seg.text === 'string' ? seg.text.trim() : ''
    assertNonSimulatedText(cleanText)

    const hasTimestamps = typeof seg.startMs === 'number' && typeof seg.endMs === 'number'
    if (!hasTimestamps) {
      hasCompleteTimestamps = false
    } else {
      if (!Number.isSafeInteger(seg.startMs) || !Number.isSafeInteger(seg.endMs) || seg.startMs! < 0 || seg.endMs! < seg.startMs!) {
        throw new Error(`Invalid audio timestamps on segment ${index}`)
      }
      if (seg.startMs! < previousStartMs) {
        throw new Error(`Non-monotonic segment timestamp on segment ${index}`)
      }
      previousStartMs = seg.startMs!
    }

    const confidence = typeof seg.confidence === 'number' ? seg.confidence : 1.0
    if (confidence < 0 || confidence > 1) {
      throw new Error(`Invalid segment confidence on segment ${index}`)
    }

    return {
      id: `${transcriptVersionId}-seg-${index}`,
      projectId: input.projectId,
      transcriptVersionId,
      segmentIndex: index,
      speakerLabel: seg.speakerLabel?.trim() || 'storyteller',
      startMs: hasTimestamps ? seg.startMs! : null,
      endMs: hasTimestamps ? seg.endMs! : null,
      text: cleanText,
      confidence,
      isHumanCorrected: Boolean(input.isHumanCorrected),
    }
  })

  // If any segment lacks reliable timestamps, mark the entire version as legacy_unaligned
  // and clear partial timestamps rather than fabricating alignment.
  if (!hasCompleteTimestamps) {
    for (const seg of segments) {
      seg.startMs = null
      seg.endMs = null
    }
  }

  const fullText = segments.map(s => s.text).join('\n')
  const canonicalPayload = JSON.stringify({
    storyId: input.storyId,
    version: input.version,
    language: input.language,
    segments: segments.map(s => [s.segmentIndex, s.speakerLabel, s.startMs, s.endMs, s.text]),
  })
  const contentSha256 = createHash('sha256').update(canonicalPayload).digest('hex')

  const lastEndMs = hasCompleteTimestamps ? segments[segments.length - 1]?.endMs ?? null : null
  const preserveAsShortClip = isShortGreetingOrLaughter(fullText, lastEndMs)

  return {
    id: transcriptVersionId,
    projectId: input.projectId,
    storyId: input.storyId,
    assetId: input.assetId ?? null,
    version: input.version,
    language: input.language,
    provider: input.provider,
    model: input.model,
    alignmentStatus: input.isHumanCorrected
      ? 'human_corrected'
      : hasCompleteTimestamps
        ? 'aligned'
        : 'legacy_unaligned',
    contentSha256,
    fullText,
    preserveAsShortClip,
    isCurrent: true,
    createdBy: input.createdBy,
    segments,
  }
}

export function createAiUsageLedgerEntry(input: {
  id?: string
  projectId: string
  storyId: string
  capability: AiCapabilityKind
  policy: ProviderPolicyDescriptor
  usageUnits: number
  unitRateUsd: number
  providerRequestId?: string | null
  now?: string
}): AiUsageLedgerEntry {
  if (!Number.isFinite(input.usageUnits) || input.usageUnits < 0) {
    throw new Error('usageUnits must be a non-negative number')
  }
  if (!Number.isFinite(input.unitRateUsd) || input.unitRateUsd < 0) {
    throw new Error('unitRateUsd must be a non-negative number')
  }
  const estimatedCostUsd = Number((input.usageUnits * input.unitRateUsd).toFixed(6))
  return {
    id: input.id ?? randomUUID(),
    projectId: input.projectId,
    storyId: input.storyId,
    capability: input.capability,
    provider: input.policy.provider,
    model: input.policy.model,
    region: input.policy.region,
    usageUnits: input.usageUnits,
    estimatedCostUsd,
    providerRequestId: input.providerRequestId ?? null,
    recordedAt: input.now ?? new Date().toISOString(),
  }
}

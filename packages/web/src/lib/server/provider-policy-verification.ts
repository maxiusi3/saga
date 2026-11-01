import {
  evaluateSyntheticProviderProbes,
  ProviderProbeTarget,
  SyntheticProbeResult,
} from './cutover-readiness'

export type SupportedProvider = 'elevenlabs' | 'anthropic' | 'voyage'
export type SupportedCapability = 'asr_transcribe' | 'story_extract_edit' | 'semantic_retrieval'

export interface ProviderPolicyEvidence {
  provider: SupportedProvider
  accountOrOrgId: string
  modelId: string
  allowedRegions: readonly string[]
  trainingOptOutConfirmed: boolean
  zeroDataRetentionConfirmed: boolean
  maxRetentionDaysAllowed: number
  evidenceDate: string // ISO 8601 UTC string e.g. "2026-10-15T00:00:00.000Z"
  evidenceReference: string
}

export interface VerificationResult {
  valid: boolean
  errors: string[]
  parsed?: ProviderPolicyEvidence
}

export const APPROVED_CAPABILITY_CONFIG: Record<
  SupportedCapability,
  {
    capability: SupportedCapability
    provider: SupportedProvider
    defaultModelId: string
    approvedModels: readonly string[]
    defaultRegion: string
    apiKeyEnvVar: string
  }
> = {
  asr_transcribe: {
    capability: 'asr_transcribe',
    provider: 'elevenlabs',
    defaultModelId: 'scribe_v2',
    approvedModels: ['scribe_v2'],
    defaultRegion: 'us',
    apiKeyEnvVar: 'ELEVENLABS_API_KEY',
  },
  story_extract_edit: {
    capability: 'story_extract_edit',
    provider: 'anthropic',
    defaultModelId: 'claude-opus-4-20250514',
    approvedModels: ['claude-opus-4-20250514', 'claude-opus-5-5'],
    defaultRegion: 'us',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
  },
  semantic_retrieval: {
    capability: 'semantic_retrieval',
    provider: 'voyage',
    defaultModelId: 'voyage-4-large',
    approvedModels: ['voyage-4-large'],
    defaultRegion: 'us',
    apiKeyEnvVar: 'VOYAGE_API_KEY',
  },
}

const SUPPORTED_PROVIDERS: readonly SupportedProvider[] = ['elevenlabs', 'anthropic', 'voyage']
const CONTROL_CHAR_REGEX = /[\x00-\x1F\x7F]/
const ISO_8601_UTC_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000 // 5 minutes
const MAX_EVIDENCE_AGE_MS = 90 * 24 * 60 * 60 * 1000 // 90 days
const MAX_RAW_EVIDENCE_ITEMS = 100

export function verifyProviderPolicyEvidence(
  evidence: unknown,
  options?: { now?: Date; targetRegion?: string },
): VerificationResult {
  const errors: string[] = []

  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return { valid: false, errors: ['invalid_evidence_structure'] }
  }

  const record = evidence as Record<string, unknown>

  // 1. Provider
  const provider = record.provider as SupportedProvider
  if (!provider || !SUPPORTED_PROVIDERS.includes(provider)) {
    errors.push('invalid_provider')
  }

  // 2. accountOrOrgId
  if (
    typeof record.accountOrOrgId !== 'string' ||
    record.accountOrOrgId.length > 256 ||
    record.accountOrOrgId.trim().length === 0 ||
    record.accountOrOrgId.trim().length > 128 ||
    CONTROL_CHAR_REGEX.test(record.accountOrOrgId)
  ) {
    errors.push('invalid_account_or_org_id')
  }

  // 3. modelId & capability matching
  const rawModelId = record.modelId
  if (
    typeof rawModelId !== 'string' ||
    rawModelId.length > 256 ||
    rawModelId.trim().length === 0 ||
    rawModelId.trim().length > 128 ||
    CONTROL_CHAR_REGEX.test(rawModelId)
  ) {
    errors.push('invalid_model_id')
  } else if (provider && SUPPORTED_PROVIDERS.includes(provider)) {
    const trimmedModelId = rawModelId.trim()
    const isApprovedModel = Object.values(APPROVED_CAPABILITY_CONFIG)
      .filter(c => c.provider === provider)
      .some(c => c.approvedModels.includes(trimmedModelId))

    if (!isApprovedModel) {
      errors.push('unapproved_model_id')
    }
  }

  // 4. allowedRegions
  let allowedRegions: string[] = []
  if (
    !Array.isArray(record.allowedRegions) ||
    record.allowedRegions.length === 0 ||
    record.allowedRegions.length > 32 ||
    !record.allowedRegions.every(
      r =>
        typeof r === 'string' &&
        r.length <= 64 &&
        r.trim().length > 0 &&
        r.trim().length <= 32 &&
        !CONTROL_CHAR_REGEX.test(r),
    )
  ) {
    errors.push('invalid_allowed_regions')
  } else {
    allowedRegions = record.allowedRegions.map(r => r.trim().toLowerCase())
    if (options?.targetRegion) {
      const target = options.targetRegion.trim().toLowerCase()
      if (!allowedRegions.includes(target)) {
        errors.push('target_region_not_allowed')
      }
    }
  }

  // 5. trainingOptOutConfirmed
  if (record.trainingOptOutConfirmed !== true) {
    errors.push('training_opt_out_unverified')
  }

  // 6. zeroDataRetentionConfirmed & maxRetentionDaysAllowed (Fail-closed)
  if (typeof record.zeroDataRetentionConfirmed !== 'boolean') {
    errors.push('invalid_zero_data_retention')
  }

  const zeroDataRetentionConfirmed = record.zeroDataRetentionConfirmed === true
  let maxRetentionDaysAllowed = 0

  if (!zeroDataRetentionConfirmed) {
    if (
      typeof record.maxRetentionDaysAllowed !== 'number' ||
      !Number.isFinite(record.maxRetentionDaysAllowed) ||
      !Number.isInteger(record.maxRetentionDaysAllowed) ||
      record.maxRetentionDaysAllowed < 0 ||
      record.maxRetentionDaysAllowed > 7
    ) {
      errors.push('retention_sla_unverified')
    } else {
      maxRetentionDaysAllowed = record.maxRetentionDaysAllowed
    }
  } else if (
    typeof record.maxRetentionDaysAllowed === 'number' &&
    Number.isFinite(record.maxRetentionDaysAllowed) &&
    Number.isInteger(record.maxRetentionDaysAllowed) &&
    record.maxRetentionDaysAllowed >= 0
  ) {
    maxRetentionDaysAllowed = record.maxRetentionDaysAllowed
  }

  // 7. evidenceDate (Strict ISO 8601 UTC & Calendar Validity)
  const now = options?.now ?? new Date()
  if (
    typeof record.evidenceDate !== 'string' ||
    record.evidenceDate.length > 64 ||
    !ISO_8601_UTC_REGEX.test(record.evidenceDate)
  ) {
    errors.push('invalid_evidence_date')
  } else {
    const timestamp = Date.parse(record.evidenceDate)
    if (isNaN(timestamp)) {
      errors.push('invalid_evidence_date')
    } else {
      const parsedDate = new Date(timestamp)
      // Check for non-existent calendar date rollover (e.g. 2026-02-30 -> 2026-03-02)
      if (parsedDate.toISOString().slice(0, 10) !== record.evidenceDate.slice(0, 10)) {
        errors.push('invalid_evidence_date')
      } else if (timestamp > now.getTime() + MAX_CLOCK_SKEW_MS) {
        errors.push('future_evidence_date')
      } else if (now.getTime() - timestamp > MAX_EVIDENCE_AGE_MS) {
        errors.push('evidence_expired')
      }
    }
  }

  // 8. evidenceReference
  if (
    typeof record.evidenceReference !== 'string' ||
    record.evidenceReference.length > 512 ||
    record.evidenceReference.trim().length === 0 ||
    record.evidenceReference.trim().length > 256 ||
    CONTROL_CHAR_REGEX.test(record.evidenceReference)
  ) {
    errors.push('invalid_evidence_reference')
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return {
    valid: true,
    errors: [],
    parsed: {
      provider,
      accountOrOrgId: (record.accountOrOrgId as string).trim(),
      modelId: (record.modelId as string).trim(),
      allowedRegions,
      trainingOptOutConfirmed: true,
      zeroDataRetentionConfirmed,
      maxRetentionDaysAllowed,
      evidenceDate: record.evidenceDate as string,
      evidenceReference: (record.evidenceReference as string).trim(),
    },
  }
}

export function loadVerifiedProviderProbeTargets(options?: {
  env?: Record<string, string | undefined>
  now?: Date
}): ProviderProbeTarget[] {
  const env = options?.env ?? process.env
  const now = options?.now ?? new Date()

  let rawList: unknown = null
  if (env.PROVIDER_POLICY_EVIDENCE_JSON && env.PROVIDER_POLICY_EVIDENCE_JSON.trim().length > 0) {
    try {
      rawList = JSON.parse(env.PROVIDER_POLICY_EVIDENCE_JSON)
    } catch {
      rawList = null
    }
  }

  // Composite key index: `${provider}::${modelId}`
  const evidenceByKey = new Map<string, ProviderPolicyEvidence>()
  if (Array.isArray(rawList)) {
    const items = rawList.slice(0, MAX_RAW_EVIDENCE_ITEMS)
    for (const item of items) {
      const verification = verifyProviderPolicyEvidence(item, { now })
      if (verification.valid && verification.parsed) {
        const key = `${verification.parsed.provider}::${verification.parsed.modelId}`
        evidenceByKey.set(key, verification.parsed)
      }
    }
  }

  return (Object.keys(APPROVED_CAPABILITY_CONFIG) as SupportedCapability[]).map(capKey => {
    const config = APPROVED_CAPABILITY_CONFIG[capKey]
    const evidenceKey = `${config.provider}::${config.defaultModelId}`
    const evidence = evidenceByKey.get(evidenceKey)

    let trainingOptOutConfirmed = false
    let zeroDataRetentionConfirmed = false

    if (evidence) {
      const regionAllowed = evidence.allowedRegions.includes(config.defaultRegion.toLowerCase())
      if (regionAllowed) {
        trainingOptOutConfirmed = true
        zeroDataRetentionConfirmed = evidence.zeroDataRetentionConfirmed || evidence.maxRetentionDaysAllowed <= 7
      }
    }

    const apiKeyConfigured = Boolean(env[config.apiKeyEnvVar])

    return {
      capability: config.capability,
      provider: config.provider,
      modelId: config.defaultModelId,
      region: config.defaultRegion,
      trainingOptOutConfirmed,
      zeroDataRetentionConfirmed,
      apiKeyConfigured,
    }
  })
}

export function buildVerifiedSyntheticProviderProbes(options?: {
  env?: Record<string, string | undefined>
  now?: Date
}): SyntheticProbeResult[] {
  const targets = loadVerifiedProviderProbeTargets(options)
  return evaluateSyntheticProviderProbes(targets)
}

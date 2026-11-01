import {
  verifyProviderPolicyEvidence,
  loadVerifiedProviderProbeTargets,
  buildVerifiedSyntheticProviderProbes,
  ProviderPolicyEvidence,
} from '../provider-policy-verification'

describe('provider-policy-verification', () => {
  const BASE_TIME = new Date('2026-11-01T10:00:00.000Z')

  const validElevenLabsEvidence: ProviderPolicyEvidence = {
    provider: 'elevenlabs',
    accountOrOrgId: 'org-saga-elevenlabs-enterprise',
    modelId: 'scribe_v2',
    allowedRegions: ['us', 'eu'],
    trainingOptOutConfirmed: true,
    zeroDataRetentionConfirmed: true,
    maxRetentionDaysAllowed: 0,
    evidenceDate: '2026-10-15T00:00:00.000Z',
    evidenceReference: 'DPA-ELEVENLABS-2026-10-v2',
  }

  const validAnthropicEvidence: ProviderPolicyEvidence = {
    provider: 'anthropic',
    accountOrOrgId: 'org-saga-anthropic-zdr',
    modelId: 'claude-opus-4-20250514',
    allowedRegions: ['us'],
    trainingOptOutConfirmed: true,
    zeroDataRetentionConfirmed: true,
    maxRetentionDaysAllowed: 0,
    evidenceDate: '2026-10-20T12:00:00.000Z',
    evidenceReference: 'DPA-ANTHROPIC-2026-ZDR',
  }

  const validVoyageEvidence: ProviderPolicyEvidence = {
    provider: 'voyage',
    accountOrOrgId: 'org-saga-voyage-optout',
    modelId: 'voyage-4-large',
    allowedRegions: ['us'],
    trainingOptOutConfirmed: true,
    zeroDataRetentionConfirmed: false,
    maxRetentionDaysAllowed: 7, // SLA <= 7 days accepted if ZDR is false
    evidenceDate: '2026-10-10T08:00:00.000Z',
    evidenceReference: 'TOS-VOYAGE-OPT-OUT-2026',
  }

  describe('verifyProviderPolicyEvidence', () => {
    it('accepts valid ElevenLabs evidence', () => {
      const result = verifyProviderPolicyEvidence(validElevenLabsEvidence, { now: BASE_TIME })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.parsed).toEqual(validElevenLabsEvidence)
    })

    it('accepts valid Anthropic evidence', () => {
      const result = verifyProviderPolicyEvidence(validAnthropicEvidence, { now: BASE_TIME })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('accepts valid Voyage evidence with <= 7 days retention SLA', () => {
      const result = verifyProviderPolicyEvidence(validVoyageEvidence, { now: BASE_TIME })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('rejects null, non-objects, and arrays', () => {
      expect(verifyProviderPolicyEvidence(null).valid).toBe(false)
      expect(verifyProviderPolicyEvidence('invalid string').valid).toBe(false)
      expect(verifyProviderPolicyEvidence([validElevenLabsEvidence]).valid).toBe(false)
    })

    it('rejects unapproved providers', () => {
      const result = verifyProviderPolicyEvidence(
        { ...validElevenLabsEvidence, provider: 'unapproved_vendor' as any },
        { now: BASE_TIME },
      )
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('invalid_provider')
    })

    it('rejects unapproved modelId for provider', () => {
      const result = verifyProviderPolicyEvidence(
        { ...validElevenLabsEvidence, modelId: 'gpt-4o' },
        { now: BASE_TIME },
      )
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('unapproved_model_id')
    })

    it('rejects empty or whitespace accountOrOrgId', () => {
      const result = verifyProviderPolicyEvidence(
        { ...validElevenLabsEvidence, accountOrOrgId: '   ' },
        { now: BASE_TIME },
      )
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('invalid_account_or_org_id')
    })

    it('rejects control characters or excessive length in accountOrOrgId', () => {
      const withControl = verifyProviderPolicyEvidence(
        { ...validElevenLabsEvidence, accountOrOrgId: 'org\nsecret\r\0' },
        { now: BASE_TIME },
      )
      expect(withControl.valid).toBe(false)
      expect(withControl.errors).toContain('invalid_account_or_org_id')

      const tooLong = verifyProviderPolicyEvidence(
        { ...validElevenLabsEvidence, accountOrOrgId: 'a'.repeat(150) },
        { now: BASE_TIME },
      )
      expect(tooLong.valid).toBe(false)
      expect(tooLong.errors).toContain('invalid_account_or_org_id')
    })

    it('rejects target region not in allowedRegions', () => {
      const result = verifyProviderPolicyEvidence(validElevenLabsEvidence, {
        now: BASE_TIME,
        targetRegion: 'ap-east-1',
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('target_region_not_allowed')
    })

    it('rejects invalid or empty allowedRegions', () => {
      const emptyRegions = verifyProviderPolicyEvidence(
        { ...validElevenLabsEvidence, allowedRegions: [] },
        { now: BASE_TIME },
      )
      expect(emptyRegions.valid).toBe(false)
      expect(emptyRegions.errors).toContain('invalid_allowed_regions')

      const nonArray = verifyProviderPolicyEvidence(
        { ...validElevenLabsEvidence, allowedRegions: 'us' as any },
        { now: BASE_TIME },
      )
      expect(nonArray.valid).toBe(false)
      expect(nonArray.errors).toContain('invalid_allowed_regions')
    })

    it('rejects when trainingOptOutConfirmed is false or not boolean true', () => {
      const falsyOptOut = verifyProviderPolicyEvidence(
        { ...validElevenLabsEvidence, trainingOptOutConfirmed: false },
        { now: BASE_TIME },
      )
      expect(falsyOptOut.valid).toBe(false)
      expect(falsyOptOut.errors).toContain('training_opt_out_unverified')

      const stringOptOut = verifyProviderPolicyEvidence(
        { ...validElevenLabsEvidence, trainingOptOutConfirmed: 'true' as any },
        { now: BASE_TIME },
      )
      expect(stringOptOut.valid).toBe(false)
      expect(stringOptOut.errors).toContain('training_opt_out_unverified')
    })

    it('rejects when zeroDataRetention is false AND retention SLA exceeds 7 days', () => {
      const longRetention = verifyProviderPolicyEvidence(
        { ...validElevenLabsEvidence, zeroDataRetentionConfirmed: false, maxRetentionDaysAllowed: 30 },
        { now: BASE_TIME },
      )
      expect(longRetention.valid).toBe(false)
      expect(longRetention.errors).toContain('retention_sla_unverified')
    })

    it('rejects when zeroDataRetention is false and retention SLA is missing, non-numeric, negative, or non-integer', () => {
      const missingSla = verifyProviderPolicyEvidence(
        { ...validElevenLabsEvidence, zeroDataRetentionConfirmed: false, maxRetentionDaysAllowed: undefined as any },
        { now: BASE_TIME },
      )
      expect(missingSla.valid).toBe(false)
      expect(missingSla.errors).toContain('retention_sla_unverified')

      const nullSla = verifyProviderPolicyEvidence(
        { ...validElevenLabsEvidence, zeroDataRetentionConfirmed: false, maxRetentionDaysAllowed: null as any },
        { now: BASE_TIME },
      )
      expect(nullSla.valid).toBe(false)
      expect(nullSla.errors).toContain('retention_sla_unverified')

      const stringSla = verifyProviderPolicyEvidence(
        { ...validElevenLabsEvidence, zeroDataRetentionConfirmed: false, maxRetentionDaysAllowed: '5' as any },
        { now: BASE_TIME },
      )
      expect(stringSla.valid).toBe(false)
      expect(stringSla.errors).toContain('retention_sla_unverified')

      const negativeSla = verifyProviderPolicyEvidence(
        { ...validElevenLabsEvidence, zeroDataRetentionConfirmed: false, maxRetentionDaysAllowed: -1 },
        { now: BASE_TIME },
      )
      expect(negativeSla.valid).toBe(false)
      expect(negativeSla.errors).toContain('retention_sla_unverified')

      const floatSla = verifyProviderPolicyEvidence(
        { ...validElevenLabsEvidence, zeroDataRetentionConfirmed: false, maxRetentionDaysAllowed: 5.5 },
        { now: BASE_TIME },
      )
      expect(floatSla.valid).toBe(false)
      expect(floatSla.errors).toContain('retention_sla_unverified')
    })

    it('rejects when zeroDataRetention is not a boolean', () => {
      const stringZdr = verifyProviderPolicyEvidence(
        { ...validElevenLabsEvidence, zeroDataRetentionConfirmed: 'true' as any },
        { now: BASE_TIME },
      )
      expect(stringZdr.valid).toBe(false)
      expect(stringZdr.errors).toContain('invalid_zero_data_retention')
    })

    it('rejects non-standard or non-ISO evidenceDate formats', () => {
      const slashDate = verifyProviderPolicyEvidence(
        { ...validElevenLabsEvidence, evidenceDate: '10/15/2026' },
        { now: BASE_TIME },
      )
      expect(slashDate.valid).toBe(false)
      expect(slashDate.errors).toContain('invalid_evidence_date')

      const nonExistentDate = verifyProviderPolicyEvidence(
        { ...validElevenLabsEvidence, evidenceDate: '2026-02-30T00:00:00.000Z' },
        { now: BASE_TIME },
      )
      expect(nonExistentDate.valid).toBe(false)
      expect(nonExistentDate.errors).toContain('invalid_evidence_date')
    })

    it('rejects invalid evidenceDate format', () => {
      const invalidDate = verifyProviderPolicyEvidence(
        { ...validElevenLabsEvidence, evidenceDate: 'invalid-date' },
        { now: BASE_TIME },
      )
      expect(invalidDate.valid).toBe(false)
      expect(invalidDate.errors).toContain('invalid_evidence_date')
    })

    it('rejects future dated evidence (> 5 minutes clock skew)', () => {
      const futureDate = verifyProviderPolicyEvidence(
        { ...validElevenLabsEvidence, evidenceDate: '2026-11-01T10:15:00.000Z' },
        { now: BASE_TIME },
      )
      expect(futureDate.valid).toBe(false)
      expect(futureDate.errors).toContain('future_evidence_date')
    })

    it('rejects expired evidence older than 90 days', () => {
      const expiredDate = verifyProviderPolicyEvidence(
        { ...validElevenLabsEvidence, evidenceDate: '2026-07-01T00:00:00.000Z' }, // 123 days prior
        { now: BASE_TIME },
      )
      expect(expiredDate.valid).toBe(false)
      expect(expiredDate.errors).toContain('evidence_expired')
    })

    it('rejects empty or whitespace evidenceReference', () => {
      const emptyRef = verifyProviderPolicyEvidence(
        { ...validElevenLabsEvidence, evidenceReference: '   ' },
        { now: BASE_TIME },
      )
      expect(emptyRef.valid).toBe(false)
      expect(emptyRef.errors).toContain('invalid_evidence_reference')
    })
  })

  describe('loadVerifiedProviderProbeTargets', () => {
    it('fails closed when no evidence environment variable is present', () => {
      const targets = loadVerifiedProviderProbeTargets({
        env: {
          ELEVENLABS_API_KEY: 'mock-key',
          ANTHROPIC_API_KEY: 'mock-key',
        },
        now: BASE_TIME,
      })

      expect(targets).toHaveLength(3)
      for (const target of targets) {
        expect(target.trainingOptOutConfirmed).toBe(false)
        expect(target.zeroDataRetentionConfirmed).toBe(false)
      }
      expect(targets.find(t => t.provider === 'elevenlabs')?.apiKeyConfigured).toBe(true)
      expect(targets.find(t => t.provider === 'anthropic')?.apiKeyConfigured).toBe(true)
      expect(targets.find(t => t.provider === 'voyage')?.apiKeyConfigured).toBe(false)
    })

    it('fails closed when PROVIDER_POLICY_EVIDENCE_JSON is malformed JSON', () => {
      const targets = loadVerifiedProviderProbeTargets({
        env: {
          PROVIDER_POLICY_EVIDENCE_JSON: '{ not valid json',
        },
        now: BASE_TIME,
      })

      expect(targets).toHaveLength(3)
      for (const target of targets) {
        expect(target.trainingOptOutConfirmed).toBe(false)
        expect(target.zeroDataRetentionConfirmed).toBe(false)
      }
    })

    it('loads verified policy for ElevenLabs and Anthropic while keeping Voyage blocked if absent', () => {
      const targets = loadVerifiedProviderProbeTargets({
        env: {
          PROVIDER_POLICY_EVIDENCE_JSON: JSON.stringify([
            validElevenLabsEvidence,
            validAnthropicEvidence,
          ]),
          ELEVENLABS_API_KEY: 'mock-elevenlabs-key',
        },
        now: BASE_TIME,
      })

      const el = targets.find(t => t.provider === 'elevenlabs')!
      expect(el.trainingOptOutConfirmed).toBe(true)
      expect(el.zeroDataRetentionConfirmed).toBe(true)
      expect(el.apiKeyConfigured).toBe(true)

      const ant = targets.find(t => t.provider === 'anthropic')!
      expect(ant.trainingOptOutConfirmed).toBe(true)
      expect(ant.zeroDataRetentionConfirmed).toBe(true)
      expect(ant.apiKeyConfigured).toBe(false)

      const voy = targets.find(t => t.provider === 'voyage')!
      expect(voy.trainingOptOutConfirmed).toBe(false)
      expect(voy.zeroDataRetentionConfirmed).toBe(false)
      expect(voy.apiKeyConfigured).toBe(false)
    })

    it('ensures order independence when multiple approved models exist for the same provider', () => {
      const claudeOpus55Evidence: ProviderPolicyEvidence = {
        ...validAnthropicEvidence,
        modelId: 'claude-opus-5-5',
        evidenceReference: 'DPA-ANTHROPIC-OPUS-5-5',
      }

      // Test order 1: opus 5-5 followed by opus 4
      const targetsOrder1 = loadVerifiedProviderProbeTargets({
        env: {
          PROVIDER_POLICY_EVIDENCE_JSON: JSON.stringify([claudeOpus55Evidence, validAnthropicEvidence]),
        },
        now: BASE_TIME,
      })
      const antOrder1 = targetsOrder1.find(t => t.provider === 'anthropic')!
      expect(antOrder1.trainingOptOutConfirmed).toBe(true)
      expect(antOrder1.zeroDataRetentionConfirmed).toBe(true)

      // Test order 2: opus 4 followed by opus 5-5 (must not overwrite default model evidence)
      const targetsOrder2 = loadVerifiedProviderProbeTargets({
        env: {
          PROVIDER_POLICY_EVIDENCE_JSON: JSON.stringify([validAnthropicEvidence, claudeOpus55Evidence]),
        },
        now: BASE_TIME,
      })
      const antOrder2 = targetsOrder2.find(t => t.provider === 'anthropic')!
      expect(antOrder2.trainingOptOutConfirmed).toBe(true)
      expect(antOrder2.zeroDataRetentionConfirmed).toBe(true)
    })

    it('loads verified policy for Voyage with non-ZDR but valid <= 7 days retention SLA', () => {
      const targets = loadVerifiedProviderProbeTargets({
        env: {
          PROVIDER_POLICY_EVIDENCE_JSON: JSON.stringify([validVoyageEvidence]),
          VOYAGE_API_KEY: 'mock-voyage-key',
        },
        now: BASE_TIME,
      })

      const voy = targets.find(t => t.provider === 'voyage')!
      expect(voy.trainingOptOutConfirmed).toBe(true)
      expect(voy.zeroDataRetentionConfirmed).toBe(true)
      expect(voy.apiKeyConfigured).toBe(true)
    })
  })

  describe('buildVerifiedSyntheticProviderProbes', () => {
    it('produces blocked_by_policy for unverified providers even if API key is configured', () => {
      const probes = buildVerifiedSyntheticProviderProbes({
        env: {
          ELEVENLABS_API_KEY: 'sk-live-key',
        },
        now: BASE_TIME,
      })

      const elProbe = probes.find(p => p.provider === 'elevenlabs')!
      expect(elProbe.status).toBe('blocked_by_policy')
      expect(elProbe.policyCompliant).toBe(false)
      expect(elProbe.readyForLiveProbe).toBe(false)
      expect(elProbe.syntheticSampleSha256).toMatch(/^[0-9a-f]{64}$/)
    })

    it('produces missing_api_key when policy is verified but API key is absent', () => {
      const probes = buildVerifiedSyntheticProviderProbes({
        env: {
          PROVIDER_POLICY_EVIDENCE_JSON: JSON.stringify([validAnthropicEvidence]),
        },
        now: BASE_TIME,
      })

      const antProbe = probes.find(p => p.provider === 'anthropic')!
      expect(antProbe.status).toBe('missing_api_key')
      expect(antProbe.policyCompliant).toBe(true)
      expect(antProbe.readyForLiveProbe).toBe(false)
    })

    it('produces ready_for_live_probe when both policy is verified and API key is present', () => {
      const probes = buildVerifiedSyntheticProviderProbes({
        env: {
          PROVIDER_POLICY_EVIDENCE_JSON: JSON.stringify([validElevenLabsEvidence]),
          ELEVENLABS_API_KEY: 'sk-verified-key',
        },
        now: BASE_TIME,
      })

      const elProbe = probes.find(p => p.provider === 'elevenlabs')!
      expect(elProbe.status).toBe('ready_for_live_probe')
      expect(elProbe.policyCompliant).toBe(true)
      expect(elProbe.readyForLiveProbe).toBe(true)
    })
  })
})

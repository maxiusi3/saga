/** @jest-environment node */
import { getTranscriptionConfiguration, parseElevenLabsTranscript, parseTranscriptionRequest } from '../story-transcription'

const now = new Date('2026-11-10T12:00:00Z')
const evidence = { provider: 'elevenlabs', accountOrOrgId: 'local-test-account', modelId: 'scribe_v2', allowedRegions: ['us'], trainingOptOutConfirmed: true, zeroDataRetentionConfirmed: true, maxRetentionDaysAllowed: 0, evidenceDate: '2026-11-01T00:00:00Z', evidenceReference: 'controlled-policy-fixture' }
const env = { MEDIA_ASSETS_ENABLED: 'true', G2_TRANSCRIPTION_ENABLED: 'true', ELEVENLABS_API_KEY: 'controlled-key', G2_ASR_POLICY_EVIDENCE: JSON.stringify(evidence), NEXT_PUBLIC_SUPABASE_URL: 'https://storage.example.test', SUPABASE_SERVICE_ROLE_KEY: 'controlled-storage-key' }
const requestId = '44444444-4444-4444-8444-444444444444'
const word = (text: string, start: number, end: number, speaker_id = 'speaker_0', type = 'word') => ({ text, start, end, speaker_id, type })

describe('configured ElevenLabs transcription boundary', () => {
  it('binds consent policy version to the verified account evidence, without exposing credentials', () => {
    const config = getTranscriptionConfiguration({ env, now })
    expect(config).toMatchObject({ ready: true, provider: 'elevenlabs', model: 'scribe_v2', region: 'us', requiresConsent: true })
    expect(config.policyVersion).toMatch(/^g2-asr-[a-f0-9]{64}$/)
    const changed = getTranscriptionConfiguration({ env: { ...env, G2_ASR_POLICY_EVIDENCE: JSON.stringify({ ...evidence, accountOrOrgId: 'different-account' }) }, now })
    expect(changed.policyVersion).not.toBe(config.policyVersion)
    expect(JSON.stringify(config)).not.toContain('controlled-key')
    expect(JSON.stringify(config)).not.toContain('local-test-account')
  })
  it.each([
    { G2_TRANSCRIPTION_ENABLED: 'false' }, { MEDIA_ASSETS_ENABLED: 'false' }, { ELEVENLABS_API_KEY: '' }, { G2_ASR_POLICY_EVIDENCE: '{}' },
    { G2_ASR_POLICY_EVIDENCE: JSON.stringify({ ...evidence, modelId: 'unknown' }) },
    { G2_ASR_POLICY_EVIDENCE: JSON.stringify({ ...evidence, allowedRegions: ['eu'] }) },
    { G2_ASR_POLICY_EVIDENCE: JSON.stringify({ ...evidence, evidenceDate: '2026-01-01T00:00:00Z' }) },
    { SUPABASE_SERVICE_ROLE_KEY: '' }, { ELEVENLABS_API_KEY: 'invalid\nkey' },
  ])('fails closed for incomplete server configuration %#', patch => {
    expect(getTranscriptionConfiguration({ env: { ...env, ...patch }, now }).ready).toBe(false)
  })
  it('retains speech, audio events and speaker boundaries with provider timings and unknown confidence', () => {
    const result = parseElevenLabsTranscript({ text: 'Grandma remembered. [laughter] Yes.', language_code: 'eng', words: [word('Grandma', 0, .5), word(' ', .5, .5, 'speaker_0', 'spacing'), word('remembered.', .5, 1), word(' ', 1, 1, 'speaker_0', 'spacing'), word('[laughter]', 1, 2, 'speaker_0', 'audio_event'), word(' ', 2, 2, 'speaker_0', 'spacing'), word('Yes.', 2.1, 2.5, 'speaker_1')] }, 3000)
    expect(result).toEqual({ language: 'eng', fullText: 'Grandma remembered. [laughter]\n\nYes.', segments: [
      { text: 'Grandma remembered. [laughter]', start_ms: 0, end_ms: 2000, confidence: null, speaker_label: 'speaker_0' },
      { text: 'Yes.', start_ms: 2100, end_ms: 2500, confidence: null, speaker_label: 'speaker_1' },
    ] })
  })
  it.each([
    { text: '', words: [] }, { text: '[mock transcript]', words: [word('[mock transcript]', 0, 1)] },
    { text: 'omitted words', words: [word('omitted', 0, 1)] }, { text: 'x', words: [word('x', -1, 1)] },
    { text: 'x', words: [word('x', 0, Infinity)] }, { text: 'x', words: [word('x', 0, 4)] },
    { text: 'x', words: [word('x', 1, .5)] }, { text: 'x', words: [word('x', 0, 0)] },
    { text: 'xy', words: [word('x', 1, 2), word('y', .5, 1)] }, { text: 'x', words: [word('x', 0, 1, 'speaker_0', 'unknown')] },
    { transcripts: [{ text: 'x', words: [word('x', 0, 1)] }] },
  ])('rejects incomplete, simulated or invalid timed output %#', body => {
    expect(() => parseElevenLabsTranscript({ language_code: 'eng', ...body }, 3000)).toThrow()
  })
  it('retains Chinese wording across speaker changes without requiring invented spaces', () => {
    const result = parseElevenLabsTranscript({ text: '她说记得。', language_code: 'zho', words: [word('她说', 0, 1), word('记得。', 1, 2, 'speaker_1')] }, 3000)
    expect(result.fullText).toBe('她说\n\n记得。')
  })
  it('splits a long speaker turn without dropping any words', () => {
    const words = Array.from({ length: 240 }, (_, index) => word(`word${index} `, index / 10, (index + 1) / 10))
    const result = parseElevenLabsTranscript({ text: words.map(w => w.text).join(''), language_code: 'eng', words }, 24000)
    expect(result.segments.length).toBeGreaterThan(1)
    expect(result.fullText.replace(/\s+/g, ' ').trim()).toBe(words.map(w => w.text).join('').trim())
    expect(result.segments.every(segment => segment.text.length <= 1200)).toBe(true)
  })
  it.each([
    { requestId, consent: true, policyVersion: 'p', provider: 'client' },
    { requestId, consent: true, policyVersion: 'p', url: 'https://attacker.test' },
    { requestId, consent: 'true', policyVersion: 'p' }, { requestId: 'bad', consent: true, policyVersion: 'p' },
    { requestId, consent: true }, { requestId, consent: true, policyVersion: 'p', expectedVersion: -1 },
    { requestId, consent: true, policyVersion: 'p', expectedVersion: null },
  ])('rejects client provider overrides or incomplete request %#', raw => expect(() => parseTranscriptionRequest(raw)).toThrow())
  it('defaults an initial transcript to edit version zero', () => expect(parseTranscriptionRequest({ requestId, consent: true, policyVersion: 'p' })).toEqual({ requestId, consent: true, policyVersion: 'p', expectedVersion: 0 }))
})

import { validateRecordingSaveMetadata, validateRecordingSaveLookup, validateRecordingSaveReceipt } from '../recording-save-contract'
const id = (n: string) => `${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`
const identity = { actorId: id('1'), projectId: id('2'), sessionId: id('3') }
const metadata = { title: 'A story', content: '', transcript: '', happenedAt: '2026-11-06T00:00:00.000Z', recordingMode: 'chat', isPublic: false }
const pinned = { ...identity, storyId: id('4'), assetId: id('5'), manifestSha256: 'a'.repeat(64) }
const receipt = { schemaVersion: 1, ...pinned, playbackUrl: `/api/media/assets/${pinned.assetId}/play`, canClearLocalDrafts: true }
it('accepts empty lookup but never gives cleanup authority', () => {
  const value = { schemaVersion: 1, ...identity, intent: null, canClearLocalDrafts: false }
  expect(validateRecordingSaveLookup(value, identity)).toEqual(value)
  expect(() => validateRecordingSaveReceipt(value, pinned)).toThrow()
})
it('requires a complete pinned cleanup receipt with a stable same-origin URL', () => {
  expect(validateRecordingSaveReceipt(receipt, pinned)).toEqual(receipt)
  for (const patch of [{ actorId: id('7') }, { storyId: id('7') }, { assetId: id('7') }, { manifestSha256: 'b'.repeat(64) },
    { playbackUrl: 'https://storage.invalid/secret' }, { canClearLocalDrafts: false }, { secret: 'key' }]) {
    expect(() => validateRecordingSaveReceipt({ ...receipt, ...patch }, pinned)).toThrow()
  }
})
it.each([{ title: 'x'.repeat(501) }, { content: 'x'.repeat(200001) }, { transcript: null }, { isPublic: 'false' },
  { happenedAt: '2026-02-30T00:00:00.000Z' }, { recordingMode: 'other' }, { recordingMode: ['chat'] }, { recordingMode: ['deep_dive'] }, { extra: true }])('rejects malformed metadata %#', patch => {
  expect(() => validateRecordingSaveMetadata({ ...metadata, ...patch })).toThrow()
})
it('validates and freezes nested lookup metadata without granting cleanup even after confirmation', () => {
  const value = { schemaVersion: 1, ...identity, intent: { storyId: pinned.storyId, metadata,
    manifestSha256: pinned.manifestSha256, assetId: pinned.assetId, confirmed: true }, canClearLocalDrafts: false }
  const result = validateRecordingSaveLookup(value, identity)
  expect(Object.isFrozen(result.intent?.metadata)).toBe(true)
  expect(() => validateRecordingSaveLookup({ ...value, canClearLocalDrafts: true }, identity)).toThrow()
  expect(() => validateRecordingSaveLookup({ ...value, intent: { ...value.intent, manifestSha256: null } }, identity)).toThrow()
})

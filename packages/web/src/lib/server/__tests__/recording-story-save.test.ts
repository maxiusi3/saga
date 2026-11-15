/** @jest-environment node */
import { lookupRecordingStorySave, reserveRecordingStorySave, confirmRecordingStorySave } from '../recording-story-save'
import { ACTOR, PROJECT, SESSION, STORY, OTHER, statusFixture, statusTransport } from '../test-support/recording-status-fixture'
const identity = { actorId: ACTOR, projectId: PROJECT, sessionId: SESSION }
const metadata = { title: 'Synthetic', content: '', transcript: '', happenedAt: '2026-11-06T00:00:00.000Z', recordingMode: 'chat' as const, isPublic: false }
function raw(state: 'succeeded' | 'failed' | 'queued' = 'succeeded') {
  const f = statusFixture(state)
  return { f, value: { lookup: { schemaVersion: 1, ...identity, intent: { storyId: STORY, metadata,
    manifestSha256: f.input.manifestSha256, assetId: f.sealed.task.assetId, confirmed: true }, canClearLocalDrafts: false }, snapshot: f.snapshot } }
}
it('returns the same story after a lost reserve reply and exposes sealed hash on lookup', async () => {
  const { value } = raw(); value.lookup.intent.confirmed = false
  const t = statusTransport(value)
  expect(await reserveRecordingStorySave(identity, metadata, { admin: t.admin })).toEqual(value.lookup)
  expect(await lookupRecordingStorySave(identity, { admin: t.admin })).toEqual(value.lookup)
  expect(t.requests.map(r => JSON.parse(String(r.init.body)).p_action)).toEqual(['reserve', 'lookup'])
})
it('grants cleanup only after validating the complete current terminal snapshot', async () => {
  const { f, value } = raw(), t = statusTransport(value)
  const receipt = await confirmRecordingStorySave(f.input, { admin: t.admin })
  expect(receipt).toEqual({ schemaVersion: 1, ...identity, storyId: STORY, assetId: f.sealed.task.assetId,
    manifestSha256: f.input.manifestSha256, playbackUrl: `/api/media/assets/${f.sealed.task.assetId}/play`, canClearLocalDrafts: true })
  expect(t.requests).toHaveLength(1)
})
it.each(['failed', 'queued'] as const)('never grants cleanup for %s even if SQL claims confirmed', async state => {
  const { f, value } = raw(state)
  await expect(confirmRecordingStorySave(f.input, { admin: statusTransport(value).admin })).rejects.toMatchObject({ status: 503 })
})
it.each(['candidate', 'attempt', 'asset', 'story', 'hash', 'extra'])('rejects corrupt %s before cleanup', async change => {
  const { f, value } = raw()
  if (change === 'candidate') f.candidate.sha256 = 'c'.repeat(64)
  if (change === 'attempt') f.attempt.result_state = 'running'
  if (change === 'asset') f.asset.duration_ms = 100
  if (change === 'story') value.lookup.intent.storyId = OTHER
  if (change === 'hash') value.lookup.intent.manifestSha256 = 'c'.repeat(64)
  if (change === 'extra') Object.assign(value, { cleanup: true })
  await expect(confirmRecordingStorySave(f.input, { admin: statusTransport(value).admin })).rejects.toMatchObject({ status: 503 })
})
it.each([['42501', 403], ['23505', 409], ['22023', 400], ['XX000', 503]])('hides SQL details for %s and never retries', async (code, status) => {
  const t = statusTransport(null)
  t.setResponse(() => new Response(JSON.stringify({ code, message: 'PRIVATE SQL' }), { status: 400 }))
  await expect(lookupRecordingStorySave(identity, { admin: t.admin })).rejects.toMatchObject({ status, message: 'Recording save is unavailable' })
  expect(t.requests).toHaveLength(1)
})
it('bounds an ignored abort and refuses an already aborted request', async () => {
  const t = statusTransport(null), controller = new AbortController(); controller.abort()
  await expect(lookupRecordingStorySave(identity, { admin: t.admin, signal: controller.signal })).rejects.toMatchObject({ status: 503 })
  expect(t.requests).toHaveLength(0)
  t.setHook(() => new Promise(() => {}))
  await expect(lookupRecordingStorySave(identity, { admin: t.admin, timeoutMs: 5 })).rejects.toMatchObject({ status: 503 })
  expect(t.requests).toHaveLength(1)
})

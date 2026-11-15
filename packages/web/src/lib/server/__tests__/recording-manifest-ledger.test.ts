/** @jest-environment node */
import { createHash } from 'node:crypto'
import type { getSupabaseAdmin } from '@/lib/supabase'
import { prepareRecordingSessionSeal } from '../recording-session-service'
import { persistRecordingManifest } from '../recording-manifest-ledger'

const input = () => prepareRecordingSessionSeal({ projectId: 'project-1', sessionId: 'session-1',
  actorId: 'user-1', actorRole: 'storyteller', actorActive: true, storyId: null, mimeType: 'audio/webm',
  chunks: [{ index: 0, chunkId: 'chunk-0', bucket: 'audio-recordings', objectKey: 'projects/project-1/sessions/session-1/0',
    byteSize: 10, sha256: 'a'.repeat(64) }] })
const receipt = (manifest: unknown) => ({ schemaVersion: 1, sessionId: 'session-1', state: 'sealing',
  manifestSha256: createHash('sha256').update(JSON.stringify(manifest)).digest('hex'), manifest, canClearLocalDrafts: false })
let response: (manifest: unknown) => { data: unknown; error: unknown }
let rpc: jest.Mock
let abortSignal: jest.Mock
let retry: jest.Mock
let admin: ReturnType<typeof getSupabaseAdmin>

beforeEach(() => {
  response = manifest => ({ data: receipt(manifest), error: null })
  retry = jest.fn()
  abortSignal = jest.fn()
  rpc = jest.fn((_name, args) => {
    const chain = { abortSignal, retry, then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
      Promise.resolve().then(() => response(args.p_manifest)).then(resolve, reject) }
    abortSignal.mockReturnValue(chain); retry.mockReturnValue(chain)
    return chain
  })
  admin = { rpc } as unknown as ReturnType<typeof getSupabaseAdmin>
})

it('pins normalized merge input and the derived physical Storage key in one non-retrying RPC', async () => {
  const bundle = input()
  const hash = await persistRecordingManifest(admin, bundle)
  expect(hash).toMatch(/^[a-f0-9]{64}$/)
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(rpc).toHaveBeenCalledWith('seal_recording_manifest', { p_manifest: {
    schemaVersion: 1, projectId: 'project-1', sessionId: 'session-1', userId: 'user-1', storyId: null,
    assetId: bundle.assetRecord.id, mimeType: 'audio/webm', chunks: [{ ...bundle.task.chunks[0],
      storageObjectKey: 'user-1/projects/project-1/sessions/session-1/0' }],
  } })
  expect(retry).toHaveBeenCalledWith(false)
  expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal))
})

it.each([
  ['42883', 503], ['PGRST202', 503], ['XX000', 503], ['23514', 409], ['23505', 409], ['42501', 403], ['22023', 400], ['22P02', 400],
])('fails closed for SQL error %s', async (code, status) => {
  response = () => ({ data: null, error: { code, message: 'private details' } })
  await expect(persistRecordingManifest(admin, input())).rejects.toMatchObject({ status })
  expect(rpc).toHaveBeenCalledTimes(1)
})

it.each([
  ['missing', () => null], ['schema', (m: unknown) => ({ ...receipt(m), schemaVersion: 2 })],
  ['session', (m: unknown) => ({ ...receipt(m), sessionId: 'other' })],
  ['state', (m: unknown) => ({ ...receipt(m), state: 'cloud_confirmed' })],
  ['hash', (m: unknown) => ({ ...receipt(m), manifestSha256: 'no' })],
  ['cleanup', (m: unknown) => ({ ...receipt(m), canClearLocalDrafts: true })],
  ['input', (m: unknown) => ({ ...receipt(m), manifest: { ...(m as object), userId: 'other' } })],
  ['extra', (m: unknown) => ({ ...receipt(m), accepted: true })],
] as const)('rejects %s receipt without pretending that registration is durable', async (_label, data) => {
  response = manifest => ({ data: data(manifest), error: null })
  await expect(persistRecordingManifest(admin, input())).rejects.toMatchObject({ status: 503 })
})

it('hides transport errors and does not retry unknown writes', async () => {
  response = () => { throw new Error('private') }
  await expect(persistRecordingManifest(admin, input())).rejects.toMatchObject({ status: 503 })
  expect(rpc).toHaveBeenCalledTimes(1)
})

it('does not start a write for an aborted request', async () => {
  const controller = new AbortController(); controller.abort()
  await expect(persistRecordingManifest(admin, input(), controller.signal)).rejects.toMatchObject({ status: 503 })
  expect(rpc).not.toHaveBeenCalled()
})

it('bounds even a transport that ignores cancellation', async () => {
  jest.useFakeTimers()
  try {
    rpc.mockReturnValue({ abortSignal: () => ({ retry: () => new Promise(() => {}) }) })
    const pending = expect(persistRecordingManifest(admin, input())).rejects.toMatchObject({ status: 503 })
    await jest.advanceTimersByTimeAsync(5001)
    await pending
    expect(rpc).toHaveBeenCalledTimes(1)
  } finally { jest.useRealTimers() }
})

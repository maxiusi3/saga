import {
  buildRecordingMergeTaskInput,
  verifyRecordingMergeCompletion,
  type RecordingMergeChunk,
  type RecordingMergeTaskInput,
} from '@/lib/server/recording-merge'

const baseChunks: RecordingMergeChunk[] = [
  { index: 0, chunkId: 'chunk-0', bucket: 'audio-recordings', objectKey: 'projects/project-1/sessions/session-1/0', byteSize: 10, sha256: 'a'.repeat(64) },
  { index: 1, chunkId: 'chunk-1', bucket: 'audio-recordings', objectKey: 'projects/project-1/sessions/session-1/1', byteSize: 20, sha256: 'b'.repeat(64) },
]

function task(overrides: Partial<Parameters<typeof buildRecordingMergeTaskInput>[0]> = {}): RecordingMergeTaskInput {
  return buildRecordingMergeTaskInput({
    projectId: 'project-1',
    sessionId: 'session-1',
    assetId: 'asset-1',
    inputVersion: 1,
    processorVersion: 'merge-container-v1',
    parameterVersion: 'params-v1',
    mimeType: 'audio/webm;codecs=opus',
    chunks: baseChunks,
    ...overrides,
  })
}

describe('recording merge task contract', () => {
  it('builds an ordered, project-bound task and stable idempotency key', () => {
    const result = task({ chunks: [...baseChunks].reverse() })
    expect(result).toMatchObject({
      projectId: 'project-1',
      sessionId: 'session-1',
      assetId: 'asset-1',
      jobType: 'recording_merge',
      mimeType: 'audio/webm;codecs=opus',
      chunks: baseChunks,
    })
    expect(result.idempotencyKey).toContain('recording_merge')
    expect(result.idempotencyKey).toBe(task().idempotencyKey)
  })

  it.each([
    ['a gap', [{ ...baseChunks[0] }, { ...baseChunks[1], index: 2 }]],
    ['a duplicate index', [{ ...baseChunks[0] }, { ...baseChunks[1], index: 0 }]],
    ['a zero byte chunk', [{ ...baseChunks[0], byteSize: 0 }, baseChunks[1]]],
    ['a malformed hash', [{ ...baseChunks[0], sha256: 'bad' }, baseChunks[1]]],
  ])('rejects %s in the ordered chunk manifest', (_label, chunks) => {
    expect(() => task({ chunks })).toThrow()
  })

  it('rejects a chunk that is not bound to the session path and project', () => {
    expect(() => task({ chunks: [{ ...baseChunks[0], objectKey: 'projects/other/sessions/s1/0' }, baseChunks[1]] })).toThrow(/project|session|object/i)
  })

  it('requires actual decoded output, matching asset identity, chunk evidence, duration, and output hash', () => {
    const input = task()
    expect(() => verifyRecordingMergeCompletion(input, {
      projectId: input.projectId,
      sessionId: input.sessionId,
      assetId: input.assetId,
      decoded: false,
      durationMs: 3000,
      outputByteSize: 30,
      outputSha256: 'c'.repeat(64),
      chunks: baseChunks,
    })).toThrow(/decode/i)

    expect(() => verifyRecordingMergeCompletion(input, {
      projectId: 'project-2', sessionId: input.sessionId, assetId: input.assetId,
      decoded: true, durationMs: 3000, outputByteSize: 30, outputSha256: 'c'.repeat(64), chunks: baseChunks,
    })).toThrow(/project/i)

    expect(() => verifyRecordingMergeCompletion(input, {
      projectId: input.projectId, sessionId: input.sessionId, assetId: input.assetId,
      decoded: true, durationMs: 0, outputByteSize: 30, outputSha256: 'c'.repeat(64), chunks: baseChunks,
    })).toThrow(/duration/i)
  })

  it('returns a ready completion only after all evidence matches the task', () => {
    const input = task()
    expect(verifyRecordingMergeCompletion(input, {
      projectId: input.projectId,
      sessionId: input.sessionId,
      assetId: input.assetId,
      decoded: true,
      durationMs: 3000,
      outputByteSize: 30,
      outputSha256: 'c'.repeat(64),
      chunks: baseChunks,
    })).toEqual({
      assetId: 'asset-1',
      state: 'ready',
      durationMs: 3000,
      byteSize: 30,
      sha256: 'c'.repeat(64),
    })
  })

  it('changes identity or input version when the merge source changes', () => {
    expect(task({ inputVersion: 2 }).idempotencyKey).not.toBe(task().idempotencyKey)
    expect(task({ assetId: 'asset-2' }).idempotencyKey).not.toBe(task().idempotencyKey)
    expect(task({ chunks: [{ ...baseChunks[0], sha256: 'd'.repeat(64) }, baseChunks[1]] }).idempotencyKey).not.toBe(task().idempotencyKey)
  })
})

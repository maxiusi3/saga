import { createHash } from 'crypto'

import { buildProcessingJobIdempotencyKey } from './processing-jobs'

export interface RecordingMergeChunk {
  index: number
  chunkId: string
  bucket: 'audio-recordings'
  objectKey: string
  byteSize: number
  sha256: string
}

export interface RecordingMergeTaskInput {
  projectId: string
  sessionId: string
  assetId: string
  inputVersion: number
  jobType: 'recording_merge'
  processorVersion: string
  parameterVersion: string
  mimeType: string
  chunks: RecordingMergeChunk[]
  totalInputBytes: number
  idempotencyKey: string
}

export interface RecordingMergeCompletionEvidence {
  projectId: string
  sessionId: string
  assetId: string
  decoded: boolean
  durationMs: number
  outputByteSize: number
  outputSha256: string
  chunks: RecordingMergeChunk[]
}

export interface RecordingMergeReadyResult {
  assetId: string
  state: 'ready'
  durationMs: number
  byteSize: number
  sha256: string
}

function required(value: string, label: string): string {
  if (typeof value !== 'string' || value.trim() === '' || value !== value.trim()) {
    throw new Error(`${label} is required`)
  }
  return value
}

function positiveSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`)
  }
  return value
}

function sha256(value: string, label: string): string {
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error(`${label} must be a 64-character hex digest`)
  return value.toLowerCase()
}

function sessionPath(projectId: string, sessionId: string, index: number): string {
  return `projects/${projectId}/sessions/${sessionId}/${index}`
}

function cloneChunk(chunk: RecordingMergeChunk): RecordingMergeChunk {
  return { ...chunk, sha256: chunk.sha256.toLowerCase() }
}

function validateChunk(chunk: RecordingMergeChunk, projectId: string, sessionId: string, expectedIndex: number): RecordingMergeChunk {
  if (!Number.isSafeInteger(chunk.index) || chunk.index !== expectedIndex || chunk.index < 0) {
    throw new Error('recording chunks must be contiguous and ordered')
  }
  required(chunk.chunkId, 'chunk id')
  if (chunk.bucket !== 'audio-recordings') throw new Error('recording chunk bucket is invalid')
  required(chunk.objectKey, 'chunk object key')
  if (chunk.objectKey !== sessionPath(projectId, sessionId, chunk.index)) {
    throw new Error('recording chunk object is not bound to the project and session')
  }
  positiveSafeInteger(chunk.byteSize, 'chunk byte size')
  return {
    index: chunk.index,
    chunkId: chunk.chunkId,
    bucket: chunk.bucket,
    objectKey: chunk.objectKey,
    byteSize: chunk.byteSize,
    sha256: sha256(chunk.sha256, 'chunk sha256'),
  }
}

function normalizeChunks(chunks: RecordingMergeChunk[], projectId: string, sessionId: string): RecordingMergeChunk[] {
  if (!Array.isArray(chunks) || chunks.length === 0) throw new Error('recording merge requires chunks')
  const normalized = chunks
    .map(cloneChunk)
    .sort((left, right) => left.index - right.index)
    .map((chunk, index) => validateChunk(chunk, projectId, sessionId, index))
  const ids = new Set(normalized.map(chunk => chunk.chunkId))
  if (ids.size !== normalized.length) throw new Error('recording chunks must have unique ids')
  return normalized
}

function canonicalChunks(chunks: RecordingMergeChunk[]): string {
  return JSON.stringify(chunks.map(chunk => [
    chunk.index, chunk.chunkId, chunk.bucket, chunk.objectKey, chunk.byteSize, chunk.sha256,
  ]))
}

function manifestDigest(chunks: RecordingMergeChunk[]): string {
  return createHash('sha256').update(canonicalChunks(chunks)).digest('hex')
}

export function buildRecordingMergeTaskInput(input: {
  projectId: string
  sessionId: string
  assetId: string
  inputVersion: number
  processorVersion: string
  parameterVersion: string
  mimeType: string
  chunks: RecordingMergeChunk[]
}): RecordingMergeTaskInput {
  const projectId = required(input.projectId, 'project id')
  const sessionId = required(input.sessionId, 'session id')
  const assetId = required(input.assetId, 'asset id')
  const processorVersion = required(input.processorVersion, 'processor version')
  const parameterVersion = required(input.parameterVersion, 'parameter version')
  const mimeType = required(input.mimeType, 'mime type')
  positiveSafeInteger(input.inputVersion, 'input version')
  const chunks = normalizeChunks(input.chunks, projectId, sessionId)
  const totalInputBytes = chunks.reduce((total, chunk) => total + chunk.byteSize, 0)
  const baseIdempotency = buildProcessingJobIdempotencyKey({
    projectId,
    assetId,
    inputVersion: input.inputVersion,
    jobType: 'recording_merge',
    processorVersion,
    modelConfigVersion: 'none',
    parameterVersion,
  })
  const idempotencyKey = `${baseIdempotency}:mime=${mimeType}:session=${sessionId}:chunks=${manifestDigest(chunks)}`
  return {
    projectId,
    sessionId,
    assetId,
    inputVersion: input.inputVersion,
    jobType: 'recording_merge',
    processorVersion,
    parameterVersion,
    mimeType,
    chunks,
    totalInputBytes,
    idempotencyKey,
  }
}

function sameChunks(expected: RecordingMergeChunk[], actual: RecordingMergeChunk[], projectId: string, sessionId: string): boolean {
  try {
    return canonicalChunks(expected) === canonicalChunks(normalizeChunks(actual, projectId, sessionId))
  } catch {
    return false
  }
}

export function verifyRecordingMergeCompletion(
  input: RecordingMergeTaskInput,
  evidence: RecordingMergeCompletionEvidence,
): RecordingMergeReadyResult {
  if (evidence.projectId !== input.projectId) throw new Error('recording merge project does not match asset')
  if (evidence.sessionId !== input.sessionId) throw new Error('recording merge session does not match task')
  if (evidence.assetId !== input.assetId) throw new Error('recording merge asset does not match task')
  if (evidence.decoded !== true) throw new Error('merged recording must be decoded successfully')
  positiveSafeInteger(evidence.durationMs, 'decoded duration')
  positiveSafeInteger(evidence.outputByteSize, 'output byte size')
  const outputSha256 = sha256(evidence.outputSha256, 'output sha256')
  if (!sameChunks(input.chunks, evidence.chunks, input.projectId, input.sessionId)) {
    throw new Error('recording merge chunk evidence does not match task')
  }
  return {
    assetId: input.assetId,
    state: 'ready',
    durationMs: evidence.durationMs,
    byteSize: evidence.outputByteSize,
    sha256: outputSha256,
  }
}

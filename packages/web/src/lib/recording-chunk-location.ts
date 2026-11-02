/** Logical merge identity and its owner-prefixed physical Storage location. */
export function recordingChunkLocation(input: { userId: string; projectId: string; sessionId: string; index: number }) {
  for (const value of [input.userId, input.projectId, input.sessionId]) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
      throw new Error('Invalid recording path identity')
    }
  }
  if (!Number.isSafeInteger(input.index) || input.index < 0 || input.index >= 2000) {
    throw new Error('Invalid recording chunk index')
  }
  const folder = `projects/${input.projectId}/sessions/${input.sessionId}`
  const fileName = String(input.index)
  const objectKey = `${folder}/${fileName}`
  return { folder, fileName, objectKey, storageObjectKey: `${input.userId}/${objectKey}` }
}

import { createHash } from 'crypto'

export function createStoryContentHash(input: {
  storyId: string
  title: string | null
  transcript: string
  createdAt: string
  transcriptVersion?: number
  transcriptSha256?: string
}) {
  const payload: Record<string, unknown> = {
    storyId: input.storyId,
    title: input.title,
    transcript: input.transcript,
    createdAt: input.createdAt,
  }
  if (typeof input.transcriptVersion === 'number') {
    payload.transcriptVersion = input.transcriptVersion
  }
  if (typeof input.transcriptSha256 === 'string' && input.transcriptSha256) {
    payload.transcriptSha256 = input.transcriptSha256
  }
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
}

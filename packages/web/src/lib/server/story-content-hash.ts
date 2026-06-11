import { createHash } from 'crypto'

export function createStoryContentHash(input: {
  storyId: string
  title: string | null
  transcript: string
  createdAt: string
}) {
  return createHash('sha256')
    .update(JSON.stringify({
      storyId: input.storyId,
      title: input.title,
      transcript: input.transcript,
      createdAt: input.createdAt,
    }))
    .digest('hex')
}

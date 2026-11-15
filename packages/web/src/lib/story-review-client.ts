import { useAuthStore } from '@/stores/auth-store'
import type { ReviewRequest, ReviewState } from './story-review-contract'

export class ReviewHttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

async function requestReview(storyId: string, body?: ReviewRequest): Promise<ReviewState> {
  const actorId = useAuthStore.getState().user?.id
  const token = await useAuthStore.getState().getAccessToken()
  if (!token || !actorId || useAuthStore.getState().user?.id !== actorId) throw new ReviewHttpError(401, 'Review session changed')
  const response = await fetch(`/api/stories/${encodeURIComponent(storyId)}/review`, {
    method: body ? 'POST' : 'GET', cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const result = await response.json()
  if (!response.ok) throw new ReviewHttpError(response.status, typeof result.error === 'string' ? result.error : 'Review unavailable')
  if (!result?.review || !Array.isArray(result.review.assertions) || !Array.isArray(result.review.approvedRevisions) || typeof result.review.sourceChanged !== 'boolean') {
    throw new Error('Invalid review response')
  }
  return result.review
}
export const readStoryReview = (storyId: string) => requestReview(storyId)
export const writeStoryReview = (storyId: string, body: ReviewRequest) => requestReview(storyId, body)

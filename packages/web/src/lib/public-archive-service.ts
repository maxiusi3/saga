import type { PublicArchiveContributionPreview, PublicArchiveApprovedEventSummary } from '@saga/shared/types/public-archive'
import { useAuthStore } from '@/stores/auth-store'

export interface PublicArchiveContributionStatus {
  id: string
  status: string
  wiki_status: string
  anonymized_text: string
}

export const publicArchiveService = {
  async generatePreview(storyId: string): Promise<PublicArchiveContributionPreview> {
    const response = await fetch(`/api/stories/${encodeURIComponent(storyId)}/public-archive/preview`, {
      method: 'POST',
      headers: await jsonHeaders(),
    })
    if (!response.ok) throw new Error('Failed to generate public archive preview')
    const data = await response.json()
    return data.preview
  },

  async getContributionStatus(storyId: string): Promise<PublicArchiveContributionStatus | null> {
    const response = await fetch(`/api/stories/${encodeURIComponent(storyId)}/public-archive`, {
      headers: await authHeaders(),
    })
    if (!response.ok) throw new Error('Failed to load public archive status')
    const data = await response.json()
    return data.contribution || null
  },

  async commitContribution(storyId: string, previewId: string) {
    const response = await fetch(`/api/stories/${encodeURIComponent(storyId)}/public-archive`, {
      method: 'POST',
      headers: await jsonHeaders(),
      body: JSON.stringify({ previewId }),
    })
    if (!response.ok) throw new Error('Failed to commit public archive contribution')
    return response.json()
  },

  async inviteStoryteller(storyId: string) {
    const response = await fetch(`/api/stories/${encodeURIComponent(storyId)}/public-archive/invitations`, {
      method: 'POST',
      headers: await jsonHeaders(),
      body: JSON.stringify({ message: 'This story may help others feel less alone.' }),
    })
    if (!response.ok) throw new Error('Failed to invite storyteller')
    return response.json()
  },

  async withdrawContribution(contributionId: string) {
    const response = await fetch(`/api/public-archive/contributions/${encodeURIComponent(contributionId)}/withdraw`, {
      method: 'POST',
      headers: await authHeaders(),
    })
    if (!response.ok) throw new Error('Failed to withdraw contribution')
    return response.json()
  },

  async getApprovedEvents(): Promise<PublicArchiveApprovedEventSummary[]> {
    const response = await fetch('/api/public-archive/events/approved', {
      headers: await authHeaders(),
    })
    if (!response.ok) throw new Error('Failed to load approved public archive events')
    const data = await response.json()
    return data.events || []
  },
}

async function jsonHeaders() {
  return { ...(await authHeaders()), 'Content-Type': 'application/json' }
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await useAuthStore.getState().getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

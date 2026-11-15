import { useAuthStore } from '@/stores/auth-store'
export interface SemanticReadiness { ready: boolean; provider: 'voyage'; region: string | null; policyVersion: string | null }
export async function readSemanticReadiness(projectId: string, signal?: AbortSignal): Promise<SemanticReadiness> {
  const token = await useAuthStore.getState().getAccessToken()
  signal?.throwIfAborted()
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/search?mode=semantic&readiness=1`, {
    signal, cache: 'no-store', redirect: 'error', credentials: 'same-origin', headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) throw new Error('Semantic search is unavailable')
  const data = (await response.json())?.semantic
  if (!data || typeof data.ready !== 'boolean' || data.provider !== 'voyage' ||
    (data.ready && (!['us', 'eu'].includes(data.region) || typeof data.policyVersion !== 'string' || !/^[a-f0-9]{64}$/.test(data.policyVersion)))) throw new Error('Invalid semantic readiness')
  return { ready: data.ready, provider: 'voyage', region: data.region, policyVersion: data.policyVersion }
}

import type { PublicationDeliveryStatus } from '@saga/shared/types/export'
import { useAuthStore } from '@/stores/auth-store'
import { isUuid } from '@/lib/invitation-acceptance-protocol'

function readStatus(value: unknown, project: string, job?: string): PublicationDeliveryStatus {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid publication response')
  const row = value as Record<string, unknown>
  const base = `/api/projects/${project}/export/jobs/${row.jobId}`
  if (!isUuid(row.jobId) || (job && row.jobId !== job) || row.snapshotId !== row.jobId ||
      !Number.isSafeInteger(row.snapshotVersion) || Number(row.snapshotVersion) < 1 ||
      !Number.isSafeInteger(row.attempt) || Number(row.attempt) < 0 ||
      !['queued', 'running', 'ready', 'failed', 'revoked'].includes(String(row.status)) ||
      !(row.errorCode === null || typeof row.errorCode === 'string') ||
      row.statusUrl !== base || row.downloadUrl !== `${base}/download`) throw new Error('Invalid publication response')
  return row as unknown as PublicationDeliveryStatus
}

async function operation(project: string, job: string | undefined, method: 'GET' | 'POST', signal?: AbortSignal) {
  if (!isUuid(project) || (job && !isUuid(job))) throw new Error('Invalid publication identity')
  const actor = useAuthStore.getState().user?.id
  const current = () => {
    signal?.throwIfAborted()
    if (!actor || useAuthStore.getState().user?.id !== actor) throw new Error('Publication session changed')
  }
  current()
  const token = await useAuthStore.getState().getAccessToken()
  current()
  if (!token) throw new Error('Publication session changed')
  const base = `/api/projects/${project}/export`
  const response = await fetch(job ? `${base}/jobs/${job}` : `${base}?durable=true`, {
    method, signal, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
    headers: { Authorization: `Bearer ${token}` },
  })
  current()
  if (!response.ok) throw new Error('Publication request failed')
  let body: unknown
  try { body = await response.json() } catch { throw new Error('Invalid publication response') }
  current()
  return readStatus(body, project, job)
}

export const requestPublication = (project: string, signal?: AbortSignal) => operation(project, undefined, 'POST', signal)
export const readPublication = (project: string, job: string, signal?: AbortSignal) => operation(project, job, 'GET', signal)
export const retryPublication = (project: string, job: string, signal?: AbortSignal) => operation(project, job, 'POST', signal)

import { useAuthStore } from '@/stores/auth-store'
export interface PurchaseOrder {
  orderId: string; packageId: string; amount: number; currency: string; mode: 'test'; status: string
  projectId?: string | null; hostingStartedAt?: string | null; hostingExpiresAt?: string | null; availableProjects?: { id: string; name: string }[]
  client_secret?: string | null; id?: string; paidAt?: string | null; refundedAt?: string | null; refundedAmount?: number
}
async function call(path: string, body?: unknown): Promise<PurchaseOrder> {
  const token = await useAuthStore.getState().getAccessToken()
  const response = await fetch(path, { method: body ? 'POST' : 'GET', cache: 'no-store', headers: {
    'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const value = await response.json()
  if (!response.ok) throw new Error(value.error || 'Payment status is uncertain. Retry the same request.')
  return value
}
export const startPurchase = (requestId: string) => call('/api/payments/create-intent', { requestId, packageId: 'digital_project_59' })
export const getPurchaseStatus = (orderId: string) => call('/api/payments/status?orderId=' + encodeURIComponent(orderId))

export const allocatePurchase = (orderId: string, project: { projectId: string } | { name: string; description?: string }) => call('/api/payments/allocate', { orderId, ...project })

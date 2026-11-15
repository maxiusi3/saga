'use client'
import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { startPurchase, getPurchaseStatus, allocatePurchase, type PurchaseOrder } from '@/lib/payments/client'
import { PurchaseCheckout } from './purchase-checkout'
const hostingDate = (value: string | null | undefined) => value
  ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
  : 'Pending'
export function PurchasePanel({ enabled, publishableKey = null }: { enabled: boolean; publishableKey?: string | null }) {
  const user = useAuthStore(s => s.user)
  const [order, setOrder] = useState<PurchaseOrder | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [projectChoice, setProjectChoice] = useState('new'), [projectName, setProjectName] = useState('')
  const requestId = useRef<string | null>(null), pending = useRef(false)
  const storageKey = user ? `saga-payment-v1:${user.id}` : null
  useEffect(() => {
    setOrder(null); requestId.current = null
    if (!storageKey) return
    let active = true
    try { const saved = JSON.parse(localStorage.getItem(storageKey) || 'null'); if (saved?.requestId) requestId.current = saved.requestId; if (saved?.orderId) getPurchaseStatus(saved.orderId).then(value => { if (active) setOrder(value) }).catch(() => { if (active) setError('Order status unavailable. Retry to recover the same purchase.') }) } catch { setError('Purchase recovery is unavailable in this browser.') }
    return () => { active = false }
  }, [storageKey])
  const refresh = async () => {
    if (!order || pending.current) return
    pending.current = true; setBusy(true); setError('')
    try { const next = await getPurchaseStatus(order.orderId); if (useAuthStore.getState().user?.id === user?.id) setOrder(next) } catch (e) { setError(e instanceof Error ? e.message : 'Order status unavailable.') }
    finally { pending.current = false; setBusy(false) }
  }
  const start = async () => {
    if (!storageKey || pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      requestId.current ??= crypto.randomUUID()
      const identity = requestId.current
      // Persist before I/O. A lost response, remount or reload must retain identity.
      localStorage.setItem(storageKey, JSON.stringify({ requestId: identity, orderId: order?.orderId }))
      const next = await startPurchase(identity)
      localStorage.setItem(storageKey, JSON.stringify({ requestId: identity, orderId: next.orderId }))
      if (useAuthStore.getState().user?.id === user?.id) setOrder(next)
    } catch (e) { setError(e instanceof Error ? e.message : 'Payment response is uncertain. Retry the same purchase.') }
    finally { pending.current = false; setBusy(false) }
  }
  const allocate = async () => {
    if (!order || pending.current) return
    pending.current = true; setBusy(true); setError('')
    try { const next = await allocatePurchase(order.orderId, projectChoice === 'new' ? { name: projectName } : { projectId: projectChoice }); if (useAuthStore.getState().user?.id === user?.id) setOrder(next) }
    catch (e) { setError(e instanceof Error ? e.message : 'Allocation is uncertain. Retry the same project.') }
    finally { pending.current = false; setBusy(false) }
  }
  return <main className="mx-auto max-w-2xl space-y-6 px-6 py-10">
    <h1 className="text-3xl font-semibold">Single-narrator digital biography</h1>
    <p className="text-4xl font-bold">US$59</p>
    <ul className="list-disc space-y-2 pl-5"><li>One project and one storyteller</li><li>Up to 120 minutes of audio and 20 photos</li><li>12 months of hosting</li><li>Downloadable family archive</li></ul>
    <p>Payment, hosting start, renewal and refund policies are awaiting release confirmation. Test orders do not establish a live service contract or a hosting start date.</p>
    <p>{enabled ? 'Test payments only. No real charge is made.' : 'Purchasing is currently unavailable. Live payments are disabled.'}</p>
    {!user && <p>Sign in to view or start your purchase.</p>}
    {order && <section className="space-y-2 rounded border p-4" aria-label="Order status"><p>Order: <span>{order.orderId}</span></p><p role="status">Payment status: {order.status}</p><p>Payment is confirmed only after the server verifies the provider event.</p>
      <button type="button" disabled={busy} onClick={refresh} className="rounded border px-4 py-2">Refresh order status</button>
    </section>}
    {order?.status === 'refund_review' && <p>A partial refund arrived before fulfillment. This order requires reconciliation; no new rights were granted.</p>}
    {order?.status === 'paid' && !order.projectId && <section className="space-y-3 rounded border p-4" aria-label="Allocate purchased project">
      <label className="block">Project<select className="block w-full rounded border p-3" value={projectChoice} onChange={e => setProjectChoice(e.target.value)}><option value="new">Create a new project</option>{order.availableProjects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      {projectChoice === 'new' && <label className="block">Project name<input className="block w-full rounded border p-3" value={projectName} maxLength={200} onChange={e => setProjectName(e.target.value)} /></label>}
      <p>Allocating this test order starts its fixed 12-month test hosting window. Live hosting terms remain pending.</p>
      <button type="button" disabled={busy || (projectChoice === 'new' && !projectName.trim())} onClick={allocate} className="rounded border px-4 py-2">Use purchase for this project</button>
    </section>}
    {order?.projectId && <section aria-label="Purchased project"><p>Project ready</p><p>Test hosting: {hostingDate(order.hostingStartedAt)} – {hostingDate(order.hostingExpiresAt)}</p><a className="underline" href={`projects/${order.projectId}`}>Open purchased project</a></section>}
    {error && <p role="alert">{error}</p>}
    {(!order || ['created', 'awaiting_payment', 'failed'].includes(order.status)) && <button type="button" onClick={start} disabled={!enabled || !user || busy} className="rounded bg-sage-700 px-5 py-3 text-white disabled:opacity-50">{busy ? 'Checking purchase…' : order || requestId.current ? 'Retry same purchase' : 'Start test purchase'}</button>}
    {order?.client_secret && ['awaiting_payment', 'failed'].includes(order.status) && (publishableKey?.startsWith('pk_test_') ? <PurchaseCheckout publishableKey={publishableKey} clientSecret={order.client_secret} onSubmitted={refresh} /> : <p>Card entry is unavailable in this test environment. Order status remains available.</p>)}
    {order && (['refunded', 'canceled'].includes(order.status) || (order.status === 'paid' && order.projectId)) && <button type="button" disabled={busy} className="rounded border px-4 py-2" onClick={() => { if (storageKey) localStorage.removeItem(storageKey); requestId.current = null; setOrder(null); setError('') }}>Start a separate purchase</button>}
  </main>
}

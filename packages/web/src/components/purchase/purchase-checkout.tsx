'use client'
import { useMemo, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js/pure'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
function Confirm({ onSubmitted }: { onSubmitted: () => void }) {
  const stripe = useStripe(), elements = useElements()
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  return <form onSubmit={async event => {
    event.preventDefault(); if (!stripe || !elements || busy) return
    setBusy(true); setError('')
    try {
      const result = await stripe.confirmPayment({ elements, redirect: 'if_required' })
      if (result.error) setError(result.error.message || 'Payment could not be confirmed.')
      else onSubmitted()
    } catch { setError('Payment response is uncertain. Check order status before retrying.') }
    finally { setBusy(false) }
  }} className="space-y-4">
    <PaymentElement />
    {error && <p role="alert">{error}</p>}
    <button className="rounded bg-sage-700 px-5 py-3 text-white" disabled={busy || !stripe || !elements}>{busy ? 'Checking payment…' : 'Confirm test payment'}</button>
  </form>
}
export function PurchaseCheckout({ publishableKey, clientSecret, onSubmitted }: { publishableKey: string; clientSecret: string; onSubmitted: () => void }) {
  const stripe = useMemo(() => loadStripe(publishableKey), [publishableKey])
  return <Elements stripe={stripe} options={{ clientSecret }}><Confirm onSubmitted={onSubmitted} /></Elements>
}

import { PurchasePanel } from '@/components/purchase/purchase-panel'
export default function PurchasePage() {
  const enabled = process.env.PAYMENTS_MODE === 'test' && Boolean(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) && Boolean(process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_'))
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  return <PurchasePanel enabled={enabled} publishableKey={enabled && key?.startsWith('pk_test_') ? key : null} />
}

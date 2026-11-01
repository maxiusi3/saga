import { NextRequest, NextResponse } from 'next/server'
import { evaluateAlertDeliveryStatus } from '@/lib/server/alert-delivery'
import { requireCronSecret } from '@/lib/server/cron'
import { evaluateSyntheticProviderProbes } from '@/lib/server/cutover-readiness'
import { loadOperationalSnapshot, operationalHealthFromSnapshot } from '@/lib/server/operational-snapshot'
import { loadVerifiedProviderProbeTargets } from '@/lib/server/provider-policy-verification'

export async function GET(request: NextRequest) {
  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') {
    return NextResponse.json(
      { error: 'Cutover readiness endpoint is not enabled' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const auth = requireCronSecret(request)
  if (!auth.ok) {
    auth.response.headers.set('Cache-Control', 'no-store')
    return auth.response
  }

  const operationalHealth = operationalHealthFromSnapshot(
    await loadOperationalSnapshot(request.signal),
    process.env.OPERATIONAL_PROJECT_COST_CAP_CENTS,
  )

  // API keys do not attest account-specific retention or training terms.
  // Evaluate probes against verified policy evidence ledger; fails closed by default.
  const providerProbes = evaluateSyntheticProviderProbes(loadVerifiedProviderProbeTargets())

  // Partial ledger observations cannot attest complete monitoring or cutover readiness.
  return NextResponse.json(
    {
      status: 'not_ready',
      operationalHealth,
      alertDelivery: evaluateAlertDeliveryStatus(),
      providerProbes,
    },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  )
}

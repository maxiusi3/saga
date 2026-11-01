import { NextRequest, NextResponse } from 'next/server'
import { evaluateAlertDeliveryStatus } from '@/lib/server/alert-delivery'
import { requireCronSecret } from '@/lib/server/cron'
import { evaluateSyntheticProviderProbes } from '@/lib/server/cutover-readiness'
import { loadOperationalSnapshot, operationalHealthFromSnapshot } from '@/lib/server/operational-snapshot'

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
  // Keep probes blocked until verified policy evidence is connected here.
  const providerProbes = evaluateSyntheticProviderProbes([
    {
      capability: 'asr_transcribe',
      provider: 'elevenlabs',
      modelId: 'scribe_v2',
      region: 'us',
      trainingOptOutConfirmed: false,
      zeroDataRetentionConfirmed: false,
      apiKeyConfigured: Boolean(process.env.ELEVENLABS_API_KEY),
    },
    {
      capability: 'story_extract_edit',
      provider: 'anthropic',
      modelId: 'claude-opus-4-20250514',
      region: 'us',
      trainingOptOutConfirmed: false,
      zeroDataRetentionConfirmed: false,
      apiKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    },
    {
      capability: 'semantic_retrieval',
      provider: 'voyage',
      modelId: 'voyage-4-large',
      region: 'us',
      trainingOptOutConfirmed: false,
      zeroDataRetentionConfirmed: false,
      apiKeyConfigured: Boolean(process.env.VOYAGE_API_KEY),
    },
  ])

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

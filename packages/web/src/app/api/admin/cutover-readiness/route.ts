import { NextRequest, NextResponse } from 'next/server'
import { requireCronSecret } from '@/lib/server/cron'
import { evaluateSyntheticProviderProbes } from '@/lib/server/cutover-readiness'

export async function GET(request: NextRequest) {
  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Cutover readiness endpoint is not enabled' }, { status: 503 })
  }

  const auth = requireCronSecret(request)
  if (!auth.ok) return auth.response

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

  // The PG rehearsal is not a live metrics source. Missing observations must
  // never be interpreted as zero failures or used to authorize a cutover.
  return NextResponse.json(
    {
      status: 'not_ready',
      operationalHealth: {
        status: 'unavailable',
        reason: 'operational_metrics_not_connected',
        containsPrivateFamilyText: false,
        alerts: [],
      },
      providerProbes,
    },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  )
}

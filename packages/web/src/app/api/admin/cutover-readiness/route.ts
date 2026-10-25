import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import {
  evaluateOperationalAlerts,
  evaluateSyntheticProviderProbes,
} from '@/lib/server/cutover-readiness'

export async function GET(request: NextRequest) {
  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Cutover readiness endpoint is not enabled' }, { status: 503 })
  }

  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const providerProbes = evaluateSyntheticProviderProbes([
    {
      capability: 'asr_transcribe',
      provider: 'elevenlabs',
      modelId: 'scribe_v2',
      region: 'us',
      trainingOptOutConfirmed: true,
      zeroDataRetentionConfirmed: true,
      apiKeyConfigured: Boolean(process.env.ELEVENLABS_API_KEY),
    },
    {
      capability: 'story_extract_edit',
      provider: 'anthropic',
      modelId: 'claude-opus-4-20250514',
      region: 'us',
      trainingOptOutConfirmed: true,
      zeroDataRetentionConfirmed: true,
      apiKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    },
    {
      capability: 'semantic_retrieval',
      provider: 'voyage',
      modelId: 'voyage-4-large',
      region: 'us',
      trainingOptOutConfirmed: true,
      zeroDataRetentionConfirmed: true,
      apiKeyConfigured: Boolean(process.env.VOYAGE_API_KEY),
    },
  ])

  const operationalHealth = evaluateOperationalAlerts({
    windowMinutes: 60,
    uploadAttempts: 0,
    uploadFailures: 0,
    stalledProcessingJobsCount: 0,
    maxJobBacklogAgeSeconds: 0,
    activeProjectMaxCostCents: 0,
    projectCostBudgetCapCents: 500,
    overdueDeletionRequestsOver7dCount: 0,
    failedExportsCount: 0,
  })

  return NextResponse.json(
    {
      operationalHealth,
      providerProbes,
    },
    { status: 200, headers: auth.headers },
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { getTextAiConfig } from '@/lib/server/text-ai-config'

export async function GET(_request: NextRequest) {
  const textConfig = getTextAiConfig()
  const transcriptionConfigured = Boolean(process.env.SILICONFLOW_API_KEY?.trim())
  const contentConfigured = Boolean(textConfig)
  // Configuration is observable here; provider reachability and quality require separate probes.
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    services: {
      transcription: transcriptionConfigured,
      content_generation: contentConfigured,
    },
    mode: transcriptionConfigured || contentConfigured ? 'configured' : 'unavailable',
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function OPTIONS(_request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

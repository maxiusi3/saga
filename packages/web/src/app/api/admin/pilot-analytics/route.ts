import { NextRequest, NextResponse } from 'next/server'
import { requireCronSecret } from '@/lib/server/cron'
import { getSupabaseAdmin } from '@/lib/supabase'
import { evaluatePilotCohortMetrics } from '@/lib/server/pilot-cohort-analytics'
import { parsePilotObservation, toPilotEntry } from '@/lib/server/pilot-ledger'
import { renderPilotReportHtml } from '@/lib/server/pilot-report-html'

const headers = { 'Cache-Control': 'no-store' }
export async function GET(request: NextRequest) {
  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') return NextResponse.json({ error: 'Pilot cohort analytics is not enabled' }, { status: 503, headers })
  const auth = requireCronSecret(request)
  if (!auth.ok) { auth.response.headers.set('Cache-Control', 'no-store'); return auth.response }
  const cohortKey = request.nextUrl.searchParams.get('cohort')
  const observationKind = request.nextUrl.searchParams.get('kind') ?? 'observed'
  const format = request.nextUrl.searchParams.get('format') ?? 'json'
  if (!cohortKey || !/^[a-zA-Z0-9_.:-]{1,100}$/.test(cohortKey) || !['synthetic', 'observed'].includes(observationKind) || !['json', 'html'].includes(format)) return NextResponse.json({ error: 'Specify a cohort, observed/synthetic kind and json/html format' }, { status: 400, headers })
  let admin
  try { admin = getSupabaseAdmin() }
  catch { return NextResponse.json({ error: 'Pilot cohort database is not configured' }, { status: 503, headers }) }
  try {
    // A single RPC gives one consistent snapshot, independent of the PostgREST table row cap.
    const { data, error } = await admin.rpc('read_pilot_cohort', { p_cohort: cohortKey, p_kind: observationKind })
    if (error || !data || !Array.isArray(data.entries) || !data.batch) return NextResponse.json({ error: 'Failed to load complete pilot cohort ledger' }, { status: 500, headers })
    const entries = data.entries.map((row: Record<string, unknown>) => {
      const { revision, recordedAt, ...fields } = row
      if (!Number.isInteger(revision) || typeof recordedAt !== 'string' || !Number.isFinite(Date.parse(recordedAt)) || Date.parse(recordedAt) > Date.now()) throw new Error('Invalid persisted pilot observation')
      const command = parsePilotObservation({ ...fields, action: 'record', expectedRevision: Number(revision) - 1, requestId: '00000000-0000-4000-8000-000000000000' }, new Date(recordedAt))
      if (command.action !== 'record' || command.cohortKey !== cohortKey || command.observationKind !== observationKind) throw new Error('Pilot cohort mismatch')
      return toPilotEntry(command)
    })
    const report = evaluatePilotCohortMetrics(entries, { cohortKey, observationKind: observationKind as 'observed' | 'synthetic', cohortClosedAt: data.batch.closedAt, erasedHouseholds: data.batch.erasedHouseholds })
    const legacyCount = Number(data.legacyUnclassifiedCount ?? 0)
    if (format === 'html') return new NextResponse(renderPilotReportHtml(report, legacyCount), { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'", 'X-Content-Type-Options': 'nosniff' } })
    return NextResponse.json({ ...report, legacyUnclassifiedCount: legacyCount, collectionMethod: 'operator_verified_evidence_ledger' }, { headers })
  } catch { return NextResponse.json({ error: 'Pilot ledger is unavailable or contains invalid evidence' }, { status: 500, headers }) }
}

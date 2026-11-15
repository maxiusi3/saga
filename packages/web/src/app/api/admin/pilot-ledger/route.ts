import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { requireCronSecret } from '@/lib/server/cron'
import { parsePilotObservation } from '@/lib/server/pilot-ledger'
import { readPaymentBody } from '@/lib/server/payment-request-body'

const headers = { 'Cache-Control': 'no-store' }
function authorize(request: NextRequest) {
  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') return NextResponse.json({ error: 'Pilot ledger is not enabled' }, { status: 503, headers })
  const auth = requireCronSecret(request)
  if (!auth.ok) { auth.response.headers.set('Cache-Control', 'no-store'); return auth.response }
}
export async function POST(request: NextRequest) {
  const denied = authorize(request)
  if (denied) return denied
  let command
  try { command = parsePilotObservation(JSON.parse(await readPaymentBody(request, 128 * 1024))) }
  catch { return NextResponse.json({ error: 'Invalid observation, chronology or evidence' }, { status: 400, headers }) }
  let admin
  try { admin = getSupabaseAdmin() }
  catch { return NextResponse.json({ error: 'Pilot database unavailable' }, { status: 503, headers }) }
  try {
    const { data, error } = await admin.rpc('record_pilot_observation', { p_command: command })
    if (error) {
      const status = ['23505', '40001', '55000'].includes(error.code) ? 409 : ['22023', '23503', '23514', '22P02'].includes(error.code) ? 400 : 500
      return NextResponse.json({ error: status === 409 ? 'Pilot request, revision or roster conflict' : 'Pilot observation could not be recorded' }, { status, headers })
    }
    return NextResponse.json(data, { status: 200, headers })
  } catch { return NextResponse.json({ error: 'Pilot ledger unavailable' }, { status: 503, headers }) }
}
export async function GET(request: NextRequest) {
  const denied = authorize(request)
  if (denied) return denied
  const household = request.nextUrl.searchParams.get('householdId')
  if (!household || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(household)) return NextResponse.json({ error: 'A householdId is required' }, { status: 400, headers })
  try {
    const { data, error } = await getSupabaseAdmin().rpc('read_pilot_history', { p_household: household })
    if (error) return NextResponse.json({ error: 'Pilot history unavailable' }, { status: 500, headers })
    return NextResponse.json({ revisions: data }, { headers })
  } catch { return NextResponse.json({ error: 'Pilot database unavailable' }, { status: 503, headers }) }
}

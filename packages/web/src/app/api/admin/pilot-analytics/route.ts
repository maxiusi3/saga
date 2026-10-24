import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { evaluatePilotCohortMetrics, type PilotHouseholdEntry } from '@/lib/server/pilot-cohort-analytics'

export async function GET(request: NextRequest) {
  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Pilot cohort analytics is not enabled' }, { status: 503 })
  }

  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  let admin: ReturnType<typeof getSupabaseAdmin>
  try {
    admin = getSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Pilot cohort database is not configured' }, { status: 503 })
  }

  const { data: rows, error } = await admin
    .from('pilot_households')
    .select('*')
    .order('enrolled_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to load pilot cohort ledger' }, { status: 500 })
  }

  const entries: PilotHouseholdEntry[] = (rows || []).map((r: any) => ({
    id: r.id,
    projectId: r.project_id,
    cohortType: r.cohort_type,
    pricingTier: r.pricing_tier,
    supportMode: r.support_mode,
    acquisitionChannel: r.acquisition_channel,
    country: r.country,
    productVersion: r.product_version,
    enrolledAt: r.enrolled_at,
    inviteAcceptedAt: r.invite_accepted_at,
    firstRecordingSavedAt: r.first_recording_saved_at,
    firstApprovedDownloadAt: r.first_approved_download_at,
    projectCompletedAt: r.project_completed_at,
    deliveredAt: r.delivered_at,
    replayedWithin14dAt: r.replayed_within_14d_at,
    withdrawnAt: r.withdrawn_at,
    incompleteReason: r.incomplete_reason,
    familyRevisionMinutes: Number(r.family_revision_minutes ?? 0),
    opsSupportMinutes: Number(r.ops_support_minutes ?? 0),
    paidAmountCents: Number(r.paid_amount_cents ?? 0),
    refundedAmountCents: Number(r.refunded_amount_cents ?? 0),
    paymentFeeCents: Number(r.payment_fee_cents ?? 0),
    aiAndStorageCostCents: Number(r.ai_and_storage_cost_cents ?? 0),
    npsScore: r.nps_score,
    wouldRecommend: r.would_recommend,
    referralsCount: Number(r.referrals_count ?? 0),
    severeDataIncidents: Number(r.severe_data_incidents ?? 0),
  }))

  const report = evaluatePilotCohortMetrics(entries)
  return NextResponse.json(report, { status: 200, headers: auth.headers })
}

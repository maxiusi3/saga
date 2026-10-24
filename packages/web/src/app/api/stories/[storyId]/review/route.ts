import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import {
  applyFamilyReviewDecision,
  approveStoryRevision,
  type StoryRevisionSnapshot,
  type VerifiedStoryAssertion,
} from '@/lib/server/provenance-editor'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

function reply(body: unknown, status: number, headers: Headers) {
  const response = NextResponse.json(body, { status })
  headers.forEach((value, key) => response.headers.set(key, value))
  response.headers.set('Cache-Control', 'no-store')
  return response
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> },
) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const { storyId } = await params
  if (!storyId || !/^[A-Za-z0-9_-]{3,128}$/.test(storyId)) {
    return reply({ error: 'Invalid story id' }, 400, auth.headers)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return reply({ error: 'Invalid request' }, 400, auth.headers)
  }
  if (!isRecord(body)) return reply({ error: 'Invalid request' }, 400, auth.headers)

  const operation = typeof body.operation === 'string' ? body.operation.trim() : ''
  if (operation !== 'decide_assertion' && operation !== 'approve_revision') {
    return reply({ error: 'operation must be decide_assertion or approve_revision' }, 400, auth.headers)
  }

  let admin: ReturnType<typeof getSupabaseAdmin>
  try {
    admin = getSupabaseAdmin()
  } catch {
    return reply({ error: 'Database service not configured' }, 503, auth.headers)
  }

  const { data: story, error: storyErr } = await admin
    .from('stories')
    .select('id, project_id')
    .eq('id', storyId)
    .maybeSingle()
  if (storyErr || !story) {
    return reply({ error: 'Story not found' }, 404, auth.headers)
  }

  const access = await requireProjectAccess(story.project_id, auth.user)
  if (!access.ok) {
    const errBody = await access.response.json()
    return reply(errBody, access.response.status, auth.headers)
  }

  const { data: tombstone } = await admin
    .from('deletion_requests')
    .select('id, tombstone_at')
    .eq('project_id', story.project_id)
    .eq('subject_id', storyId)
    .not('tombstone_at', 'is', null)
    .maybeSingle()
  if (tombstone?.tombstone_at) {
    return reply({ error: 'Story has an active deletion tombstone' }, 409, auth.headers)
  }

  if (operation === 'decide_assertion') {
    const assertionId = typeof body.assertionId === 'string' ? body.assertionId.trim() : ''
    const action = typeof body.action === 'string' ? body.action.trim() : ''
    if (
      !assertionId ||
      (action !== 'accept' &&
        action !== 'modify' &&
        action !== 'dispute' &&
        action !== 'skip' &&
        action !== 'reject')
    ) {
      return reply({ error: 'assertionId and valid action are required' }, 400, auth.headers)
    }

    const { data: row, error: rowErr } = await admin
      .from('story_assertions')
      .select('*')
      .eq('id', assertionId)
      .eq('story_id', storyId)
      .eq('project_id', story.project_id)
      .maybeSingle()
    if (rowErr || !row) {
      return reply({ error: 'Assertion not found' }, 404, auth.headers)
    }

    const currentAssertion: VerifiedStoryAssertion = {
      id: row.id,
      projectId: row.project_id,
      storyId: row.story_id,
      transcriptVersionId: row.transcript_version_id,
      segmentId: row.segment_id ?? null,
      assertionType: row.assertion_type,
      subject: row.subject,
      claimText: row.claim_text,
      sourceQuote: row.source_quote ?? null,
      startMs: row.start_ms ?? null,
      endMs: row.end_ms ?? null,
      datePrecision: row.date_precision ?? 'exact',
      memoryAttribution: row.memory_attribution ?? 'storyteller_memory',
      verificationStatus: row.verification_status,
      reviewDecision: row.review_decision,
      isSevereFabrication: Boolean(row.is_severe_fabrication),
      rejectionReason: null,
      disputedAlternativeText: row.disputed_alternative_text ?? null,
      disputedBy: row.disputed_by ?? null,
      reviewedBy: row.reviewed_by ?? null,
      reviewerNote: row.reviewer_note ?? null,
    }

    let updated: VerifiedStoryAssertion
    try {
      updated = applyFamilyReviewDecision(currentAssertion, {
        action,
        reviewerId: auth.user.id,
        modifiedClaimText: typeof body.modifiedClaimText === 'string' ? body.modifiedClaimText : undefined,
        disputedAlternativeText:
          typeof body.disputedAlternativeText === 'string' ? body.disputedAlternativeText : undefined,
        reviewerNote: typeof body.reviewerNote === 'string' ? body.reviewerNote : undefined,
      })
    } catch (err) {
      return reply({ error: err instanceof Error ? err.message : 'Invalid review decision' }, 409, auth.headers)
    }

    const { error: updateErr } = await admin
      .from('story_assertions')
      .update({
        claim_text: updated.claimText,
        memory_attribution: updated.memoryAttribution,
        verification_status: updated.verificationStatus,
        review_decision: updated.reviewDecision,
        is_severe_fabrication: updated.isSevereFabrication,
        disputed_alternative_text: updated.disputedAlternativeText,
        disputed_by: updated.disputedBy,
        reviewed_by: updated.reviewedBy,
        reviewer_note: updated.reviewerNote,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assertionId)
      .eq('story_id', storyId)
    if (updateErr) {
      return reply({ error: 'Failed to persist assertion review decision' }, 500, auth.headers)
    }

    return reply({ assertion: updated }, 200, auth.headers)
  }

  // operation === 'approve_revision'
  const revisionId = typeof body.revisionId === 'string' ? body.revisionId.trim() : ''
  if (!revisionId) {
    return reply({ error: 'revisionId is required' }, 400, auth.headers)
  }

  const { data: revRow, error: revErr } = await admin
    .from('story_revisions')
    .select('*')
    .eq('id', revisionId)
    .eq('story_id', storyId)
    .eq('project_id', story.project_id)
    .maybeSingle()
  if (revErr || !revRow) {
    return reply({ error: 'Story revision not found' }, 404, auth.headers)
  }

  const { data: assertionRows, error: assertionsErr } = await admin
    .from('story_assertions')
    .select('*')
    .eq('story_id', storyId)
    .eq('transcript_version_id', revRow.transcript_version_id)
  if (assertionsErr || !assertionRows) {
    return reply({ error: 'Failed to load story assertions for approval' }, 500, auth.headers)
  }

  const revisionSnapshot: StoryRevisionSnapshot = {
    id: revRow.id,
    projectId: revRow.project_id,
    storyId: revRow.story_id,
    transcriptVersionId: revRow.transcript_version_id,
    revisionNumber: revRow.revision_number,
    status: revRow.status,
    title: revRow.title,
    body: revRow.body,
    summary: revRow.summary,
    provenanceLinks: Array.isArray(revRow.provenance_links) ? revRow.provenance_links : [],
    contentSha256: revRow.content_sha256,
    createdBy: revRow.created_by,
    approvedBy: revRow.approved_by ?? null,
    approvedAt: revRow.approved_at ?? null,
  }

  const mappedAssertions: VerifiedStoryAssertion[] = assertionRows.map((row: any) => ({
    id: row.id,
    projectId: row.project_id,
    storyId: row.story_id,
    transcriptVersionId: row.transcript_version_id,
    segmentId: row.segment_id ?? null,
    assertionType: row.assertion_type,
    subject: row.subject,
    claimText: row.claim_text,
    sourceQuote: row.source_quote ?? null,
    startMs: row.start_ms ?? null,
    endMs: row.end_ms ?? null,
    datePrecision: row.date_precision ?? 'exact',
    memoryAttribution: row.memory_attribution ?? 'storyteller_memory',
    verificationStatus: row.verification_status,
    reviewDecision: row.review_decision,
    isSevereFabrication: Boolean(row.is_severe_fabrication),
    rejectionReason: null,
    disputedAlternativeText: row.disputed_alternative_text ?? null,
    disputedBy: row.disputed_by ?? null,
    reviewedBy: row.reviewed_by ?? null,
    reviewerNote: row.reviewer_note ?? null,
  }))

  let approved: StoryRevisionSnapshot
  try {
    approved = approveStoryRevision(revisionSnapshot, mappedAssertions, auth.user.id)
  } catch (err) {
    return reply(
      { error: err instanceof Error ? err.message : 'Revision blocked by G2 fidelity gate' },
      409,
      auth.headers,
    )
  }

  const { error: approveUpdateErr } = await admin
    .from('story_revisions')
    .update({
      status: 'approved',
      approved_by: approved.approvedBy,
      approved_at: approved.approvedAt,
      updated_at: approved.approvedAt,
    })
    .eq('id', revisionId)
    .eq('story_id', storyId)
  if (approveUpdateErr) {
    return reply({ error: 'Failed to persist approved revision' }, 500, auth.headers)
  }

  return reply({ revision: approved }, 200, auth.headers)
}

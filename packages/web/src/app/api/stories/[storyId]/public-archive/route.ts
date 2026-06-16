import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import type { PublicArchiveElementPreview } from '@saga/shared/types/public-archive'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireStoryContributionOwner } from '@/lib/server/public-archive-access'
import { createStoryContentHash } from '@/lib/server/story-content-hash'
import { getAgentArtifactByIdForStory } from '@/lib/server/agent-store'
import { processPublicContributionWithWikiAgent } from '@/lib/server/public-archive-wiki-runner'
import {
  createPublicArchiveAuditEvent,
  createPublicContribution,
  createPublicContributionElements,
  getOwnContributionForStory,
} from '@/lib/server/public-archive-store'

interface RouteContext {
  params: Promise<{ storyId: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const { storyId } = await context.params
  const access = await requireStoryContributionOwner(storyId, auth.user)
  if (!access.ok) return withAuthHeaders(access.response, auth.headers)

  const contribution = await getOwnContributionForStory(storyId, auth.user.id)
  return NextResponse.json({ contribution }, { headers: auth.headers })
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const { storyId } = await context.params
  const access = await requireStoryContributionOwner(storyId, auth.user)
  if (!access.ok) return withAuthHeaders(access.response, auth.headers)

  const body = await request.json().catch(() => ({}))
  const previewId = typeof body.previewId === 'string' ? body.previewId : null
  if (!previewId) {
    return NextResponse.json({ error: 'A previewId is required' }, { status: 400, headers: auth.headers })
  }

  const artifact = await getAgentArtifactByIdForStory(previewId, storyId)
  if (!artifact) {
    return NextResponse.json({ error: 'Preview not found' }, { status: 404, headers: auth.headers })
  }

  const story = access.story
  const sourceContentHash = createStoryContentHash({
    storyId: story.id,
    title: story.title,
    transcript: story.transcript || '',
    createdAt: story.created_at,
  })

  const payload = (artifact.payload || {}) as {
    sourceContentHash?: string
    consentCopyVersion?: string
    anonymizedTitle?: string
    anonymizedText?: string
    anonymizedSummary?: string
    elements?: PublicArchiveElementPreview[]
  }

  if (payload.sourceContentHash !== sourceContentHash) {
    return NextResponse.json(
      { error: 'The story changed since this preview was generated. Please regenerate the preview.' },
      { status: 409, headers: auth.headers },
    )
  }

  const contribution = await createPublicContribution({
    sourceProjectId: story.project_id,
    sourceStoryId: story.id,
    sourceUserId: auth.user.id,
    sourceStoryHash: hashStoryReference(story.id),
    sourceContentHash,
    consentCopyVersion: payload.consentCopyVersion || 'public-archive-consent-v1',
    anonymizedTitle: payload.anonymizedTitle || '',
    anonymizedText: payload.anonymizedText || '',
    anonymizedSummary: payload.anonymizedSummary || '',
  })

  const elements = payload.elements || []
  await createPublicContributionElements(
    String(contribution.id),
    elements.map(element => ({
      elementType: element.elementType,
      value: element.value,
      normalizedValue: element.normalizedValue,
      sourceQuote: element.sourceQuote,
      confidence: element.confidence,
    })),
  )

  await createPublicArchiveAuditEvent({
    eventType: 'opted_in',
    actorUserId: auth.user.id,
    publicContributionId: String(contribution.id),
    publicEventClusterId: null,
    consentCopyVersion: payload.consentCopyVersion || 'public-archive-consent-v1',
    metadata: { storyId: story.id },
  })

  void processPublicContributionWithWikiAgent({
    contributionId: String(contribution.id),
    actorUserId: auth.user.id,
  }).catch(error => {
    console.error('Failed to process public contribution with Wiki Editor Agent', error)
  })

  return NextResponse.json({ contribution, elementsCount: elements.length }, { headers: auth.headers })
}

function hashStoryReference(storyId: string) {
  return createHash('sha256').update(`public-archive-story:${storyId}`).digest('hex')
}

function withAuthHeaders(response: NextResponse, headers: Headers) {
  headers.forEach((value, key) => response.headers.set(key, value))
  return response
}

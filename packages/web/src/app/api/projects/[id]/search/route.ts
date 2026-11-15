import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import { parseSourceSearchInput, searchAuthoritativeSources, SourceSearchError } from '@/lib/server/authoritative-search'
import { readSemanticSearchRequest, searchSemanticSources, semanticReadiness } from '@/lib/server/semantic-search'
function reply(body: unknown, status: number, headers: Headers) {
  const response = NextResponse.json(body, { status, headers })
  response.headers.set('Cache-Control', 'no-store')
  return response
}
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) { auth.response.headers.set('Cache-Control', 'no-store'); return auth.response }
  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') return reply({ error: 'Source search is not enabled' }, 503, auth.headers)
  try {
    const { id: projectId } = await params
    const query = new URL(request.url).searchParams
    const readiness = query.get('mode') === 'semantic' && query.get('readiness') === '1'
    if (query.has('mode') && !readiness && query.get('mode') !== 'literal') throw new SourceSearchError(400, 'Use the explicit semantic search action')
    const filters = readiness ? null : parseSourceSearchInput(query)
    const access = await requireProjectAccess(projectId, auth.user)
    if (!access.ok) return reply(await access.response.json(), access.response.status, auth.headers)
    if (!filters) return reply({ semantic: semanticReadiness() }, 200, auth.headers)
    return reply(await searchAuthoritativeSources(auth.user.id, projectId, filters), 200, auth.headers)
  } catch (error) {
    return reply({ error: error instanceof SourceSearchError ? error.message : 'Source search is unavailable' },
      error instanceof SourceSearchError ? error.status : 500, auth.headers)
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) { auth.response.headers.set('Cache-Control', 'no-store'); return auth.response }
  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') return reply({ error: 'Source search is not enabled' }, 503, auth.headers)
  try {
    const { id: projectId } = await params
    const access = await requireProjectAccess(projectId, auth.user)
    if (!access.ok) return reply(await access.response.json(), access.response.status, auth.headers)
    const input = await readSemanticSearchRequest(request)
    return reply(await searchSemanticSources(auth.user.id, projectId, input, { signal: request.signal }), 200, auth.headers)
  } catch (error) {
    return reply({ error: error instanceof SourceSearchError ? error.message : 'Semantic search is unavailable' },
      error instanceof SourceSearchError ? error.status : 500, auth.headers)
  }
}

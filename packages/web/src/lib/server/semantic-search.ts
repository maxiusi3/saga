import { createHash } from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/supabase'
import { parseSourceCitation, SourceSearchError, type SourceSearchInput } from './authoritative-search'
import { verifyProviderPolicyEvidence } from './provider-policy-verification'

type Environment = Record<string, string | undefined>
const fail = (status: number, message: string): never => { throw new SourceSearchError(status, message) }
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const SEMANTIC_LIMITS = { documents: 256, sourceCharacters: 1200, sourceBytes: 65536, responseBytes: 4 * 1024 * 1024, timeoutMs: 30000 } as const

function configuration(env: Environment, now: Date) {
  if (env.SEMANTIC_SEARCH_ENABLED !== 'true' || !env.VOYAGE_API_KEY?.trim() || /\s/.test(env.VOYAGE_API_KEY)) return null
  const embeddingModel = env.VOYAGE_EMBEDDING_MODEL || 'voyage-4-large', rerankModel = env.VOYAGE_RERANK_MODEL || 'rerank-2.5'
  const region = env.VOYAGE_REGION || 'us', baseUrl = env.VOYAGE_BASE_URL || 'https://api.voyageai.com/v1'
  // The selected endpoint's regional assurance belongs in policy evidence. Do not
  // let a typo/custom proxy silently receive family sources or the provider key.
  if (baseUrl !== 'https://api.voyageai.com/v1' || !['us', 'eu'].includes(region) || embeddingModel !== 'voyage-4-large' || rerankModel !== 'rerank-2.5') return null
  let raw: unknown
  try { raw = JSON.parse(env.PROVIDER_POLICY_EVIDENCE_JSON || '') } catch { return null }
  if (!Array.isArray(raw) || raw.length > 100) return null
  const evidence = [embeddingModel, rerankModel].map(model => raw.map(item => verifyProviderPolicyEvidence(item, { now, targetRegion: region }))
    .find(item => item.valid && item.parsed?.provider === 'voyage' && item.parsed.modelId === model)?.parsed)
  if (!evidence[0] || !evidence[1] || evidence[0].accountOrOrgId !== evidence[1].accountOrOrgId) return null
  const policyVersion = digest({ embeddingModel, rerankModel, region, baseUrl, evidence })
  return { embeddingModel, rerankModel, region, baseUrl, evidence, policyVersion, key: env.VOYAGE_API_KEY }
}
export function semanticReadiness(env: Environment = process.env, now = new Date()) {
  const config = configuration(env, now)
  return { ready: !!config, provider: 'voyage', region: config?.region ?? null, policyVersion: config?.policyVersion ?? null,
    embeddingModel: config?.embeddingModel ?? null, rerankModel: config?.rerankModel ?? null,
    limits: SEMANTIC_LIMITS, reason: config ? null : 'Semantic search requires configured models and verified provider policy. Literal search remains available.' }
}
interface RpcResult { data: unknown; error: { code?: string } | null }
interface RpcQuery extends PromiseLike<RpcResult> { abortSignal(signal: AbortSignal): RpcQuery; retry(value: false): RpcQuery }
export interface SemanticExecutionOptions { env?: Environment; now?: () => Date; fetch?: typeof fetch; signal?: AbortSignal; timeoutMs?: number; admin?: { rpc(name: string, args: Record<string, unknown>): RpcQuery } }
function operation(caller: AbortSignal | undefined, ms: number) {
  const controller = new AbortController(), abort = () => controller.abort()
  caller?.addEventListener('abort', abort, { once: true }); if (caller?.aborted) abort()
  const timer = setTimeout(abort, ms)
  return { signal: controller.signal, async wait<T>(value: PromiseLike<T>): Promise<T> {
    if (controller.signal.aborted) return fail(503, 'Semantic search timed out or was cancelled')
    let rejectAbort = () => {}
    const aborted = new Promise<never>((_, reject) => { rejectAbort = () => reject(new SourceSearchError(503, 'Semantic search timed out or was cancelled')); controller.signal.addEventListener('abort', rejectAbort, { once: true }) })
    try { const result = await Promise.race([value, aborted]); if (controller.signal.aborted) return fail(503, 'Semantic search timed out or was cancelled'); return result }
    finally { controller.signal.removeEventListener('abort', rejectAbort) }
  }, close() { clearTimeout(timer); caller?.removeEventListener('abort', abort); abort() } }
}
async function providerJson(url: string, body: unknown, key: string, transport: typeof fetch, scope: ReturnType<typeof operation>) {
  let response: Response
  try { response = await scope.wait(transport(url, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: scope.signal, redirect: 'error', cache: 'no-store' })) }
  catch (error) { if (error instanceof SourceSearchError) throw error; return fail(502, 'Semantic provider is unavailable') }
  const declared = response.headers.get('content-length')
  if (response.status !== 200 || response.redirected || !response.body || !response.headers.get('content-type')?.startsWith('application/json') ||
    (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > SEMANTIC_LIMITS.responseBytes))) {
    void response.body?.cancel().catch(() => {}); return fail(502, 'Invalid semantic provider response')
  }
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let total = 0
  try {
    while (true) { const part = await scope.wait(reader.read()); if (part.done) break; total += part.value.byteLength
      if (total > SEMANTIC_LIMITS.responseBytes) return fail(502, 'Semantic provider response exceeds limit'); chunks.push(part.value) }
    const bytes = Buffer.concat(chunks)
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown }
    catch { return fail(502, 'Invalid semantic provider JSON') }
  } finally { void reader.cancel().catch(() => {}) }
}
function responseData(value: unknown, count: number, model: string) {
  if (!record(value) || value.model !== model || !Array.isArray(value.data) || value.data.length !== count) return fail(502, 'Invalid semantic provider output')
  const seen = new Set<number>()
  return value.data.map(item => {
    if (!record(item) || !Number.isSafeInteger(item.index) || Number(item.index) < 0 || Number(item.index) >= count || seen.has(Number(item.index))) return fail(502, 'Invalid semantic provider index')
    seen.add(Number(item.index)); return item
  })
}
function vectors(value: unknown, count: number, model: string) {
  const output: number[][] = new Array(count)
  for (const item of responseData(value, count, model)) {
    if (!Array.isArray(item.embedding) || item.embedding.length !== 1024 || !item.embedding.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1e6) || !item.embedding.some(n => n !== 0)) return fail(502, 'Invalid semantic embedding')
    output[Number(item.index)] = item.embedding
  }
  return output
}
export function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  if (!left.length || left.length !== right.length) return fail(502, 'Incompatible semantic embeddings')
  let dot = 0, a = 0, b = 0
  for (let i = 0; i < left.length; i++) { dot += left[i] * right[i]; a += left[i] ** 2; b += right[i] ** 2 }
  const result = dot / Math.sqrt(a * b)
  if (!Number.isFinite(result)) return fail(502, 'Invalid semantic similarity')
  return result
}
export async function searchSemanticSources(actorId: string, projectId: string, input: SourceSearchInput, options: SemanticExecutionOptions = {}) {
  const env = options.env ?? process.env, now = options.now ?? (() => new Date()), config = configuration(env, now())
  if (!config) return fail(503, 'Semantic search is not configured. Use literal search.')
  if (!input.consent) return fail(403, 'Consent is required before sending family sources to Voyage')
  if (input.policyVersion !== config.policyVersion) return fail(409, 'Semantic search policy changed. Reload and review consent.')
  if (!input.query?.trim() || input.query.length > 240) return fail(400, 'Enter a semantic search query')
  const scope = operation(options.signal, options.timeoutMs ?? SEMANTIC_LIMITS.timeoutMs)
  const admin = options.admin ?? getSupabaseAdmin(), transport = options.fetch ?? fetch
  try {
    const snapshot = async (grant: boolean) => {
      if (JSON.stringify(configuration(env, now())) !== JSON.stringify(config)) return fail(409, 'Semantic search policy changed')
      const { data, error } = await scope.wait<RpcResult>(admin.rpc('semantic_source_snapshot', { p_actor_id: actorId, p_project_id: projectId,
        p_policy: config.policyVersion, p_region: config.region, p_grant: grant }).abortSignal(scope.signal).retry(false))
      if (error) return fail(error.code === '42501' ? 403 : error.code === '54000' ? 422 : 503,
        error.code === '54000' ? 'Semantic archive exceeds 256 sources, 1200 characters per source or 64 KiB. Use literal search.' : 'Current semantic sources or consent are unavailable')
      if (!record(data) || !Array.isArray(data.entries) || data.entries.length > SEMANTIC_LIMITS.documents || data.hasMore !== false || typeof data.consentId !== 'string') return fail(503, 'Invalid semantic source snapshot')
      const entries = data.entries.map(row => parseSourceCitation(row, projectId))
      if (new Set(entries.map(row => row.entryId)).size !== entries.length || entries.some(row => row.excerptStart !== 0) ||
        entries.reduce((sum, row) => sum + Buffer.byteLength(row.quotedText), 0) > SEMANTIC_LIMITS.sourceBytes) return fail(422, 'Semantic source corpus exceeds limit')
      return { entries, consentId: data.consentId }
    }
    const initial = await snapshot(true), fingerprint = digest(initial)
    const recheck = async () => { if (digest(await snapshot(false)) !== fingerprint) return fail(409, 'Family sources or consent changed. Search again.') }
    const sources = initial.entries.filter(row => [input.person, input.date, input.place].every(filter => !filter || row.quotedText.toLowerCase().includes(filter.toLowerCase())))
    if (!sources.length) { await recheck(); return result([]) }
    await recheck()
    const queryVectors = vectors(await providerJson(`${config.baseUrl}/embeddings`, { input: [input.query], model: config.embeddingModel, input_type: 'query', output_dimension: 1024, truncation: false }, config.key, transport, scope), 1, config.embeddingModel)
    await recheck()
    const sourceVectors = vectors(await providerJson(`${config.baseUrl}/embeddings`, { input: sources.map(row => row.quotedText), model: config.embeddingModel, input_type: 'document', output_dimension: 1024, truncation: false }, config.key, transport, scope), sources.length, config.embeddingModel)
    // Whole authorized corpus is embedded first; shortlist is actual cosine ranking.
    const ranked = sources.map((source, index) => ({ source, similarity: cosineSimilarity(queryVectors[0], sourceVectors[index]) }))
      .sort((a, b) => b.similarity - a.similarity || a.source.entryId.localeCompare(b.source.entryId)).slice(0, 50)
    await recheck()
    const reranked = responseData(await providerJson(`${config.baseUrl}/rerank`, { query: input.query, documents: ranked.map(row => row.source.quotedText),
      model: config.rerankModel, top_k: ranked.length, return_documents: false, truncation: false }, config.key, transport, scope), ranked.length, config.rerankModel)
      .map(item => { if (typeof item.relevance_score !== 'number' || !Number.isFinite(item.relevance_score) || item.relevance_score < 0 || item.relevance_score > 1) return fail(502, 'Invalid semantic relevance score')
        return { ...ranked[Number(item.index)].source, score: item.relevance_score } })
      .sort((a, b) => b.score - a.score || a.entryId.localeCompare(b.entryId))
    await recheck()
    return result(reranked.slice(0, 12), ranked.length > 12)
  } finally { scope.close() }
  function result(citations: ReturnType<typeof parseSourceCitation>[], hasMore = false) { return { status: citations.length ? 'source_matches' as const : 'no_matching_sources' as const,
    query: input.query, searchMode: 'semantic' as const, semanticSearch: 'configured_unqualified' as const, hasMore,
    answerText: citations.length ? `Ranked ${citations.length} related source excerpt(s). Similarity does not verify historical facts.` : 'No current family sources match the selected filters.', citations } }
}

export async function readSemanticSearchRequest(request: Request): Promise<SourceSearchInput> {
  const scope = operation(request.signal, 10000), reader = request.body?.getReader()
  if (!reader) { scope.close(); return fail(400, 'Invalid semantic search request') }
  try {
    const chunks: Uint8Array[] = []; let bytes = 0
    while (true) { const part = await scope.wait(reader.read()); if (part.done) break; bytes += part.value.byteLength
      if (bytes > 4096) return fail(413, 'Semantic search request is too large'); chunks.push(part.value) }
    let value: unknown
    try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))) } catch { return fail(400, 'Invalid semantic search request') }
    if (!record(value) || Object.keys(value).some(k => !['query', 'person', 'date', 'place', 'mode', 'consent', 'policyVersion'].includes(k)) ||
      value.mode !== 'semantic' || typeof value.consent !== 'boolean' || typeof value.policyVersion !== 'string' || !/^[a-f0-9]{64}$/.test(value.policyVersion)) return fail(400, 'Invalid semantic search request')
    for (const [key, limit] of [['query', 240], ['person', 80], ['date', 4], ['place', 80]] as const) {
      if (value[key] !== undefined && (typeof value[key] !== 'string' || value[key].length > limit || /[\u0000-\u001f\u007f]/.test(value[key]))) return fail(400, 'Invalid semantic search filters')
    }
    if (typeof value.query !== 'string' || !value.query.trim() || (value.date && !/^[0-9]{4}$/.test(String(value.date)))) return fail(400, 'Enter a semantic query and valid filters')
    return value as unknown as SourceSearchInput
  } finally { void reader.cancel().catch(() => {}); scope.close() }
}

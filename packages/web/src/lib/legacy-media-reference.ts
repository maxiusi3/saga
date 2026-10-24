export type LegacyMediaMappingStatus = 'mapped' | 'missing' | 'ambiguous' | 'unresolved'

export interface LegacyMediaReferenceInput {
  sourceTable: string
  sourceRowId: string
  sourceField: string
  legacyValue: string
  verifiedStorageHost?: string
  verifiedBucket?: string
}

export interface LegacyMediaReferenceResult {
  status: LegacyMediaMappingStatus
  bucket?: 'saga' | 'audio-recordings'
  objectKey?: string
  reason?: string
}

const allowedBuckets = new Set(['saga', 'audio-recordings'])

/**
 * Resolve an exact locator, not an asset or proof of object existence/ownership.
 * A basename or an unverified host is never enough. Never normalize a Storage key.
 */
export function resolveLegacyMediaReference(input: LegacyMediaReferenceInput): LegacyMediaReferenceResult {
  const raw = input.legacyValue
  if (!raw) return { status: 'unresolved', reason: 'empty legacy value' }
  if (raw !== raw.trim() || /[\u0000-\u001f\u007f-\u009f]/.test(raw)) {
    return { status: 'unresolved', reason: 'ambiguous object path' }
  }

  let path = raw
  let bucket = input.verifiedBucket
  let exactUrl = false
  if (/^https?:\/\//i.test(raw)) {
    let url: URL
    try { url = new URL(raw) } catch { return { status: 'unresolved', reason: 'invalid URL' } }
    if (!input.verifiedStorageHost || url.host !== input.verifiedStorageHost) {
      return { status: 'unresolved', reason: 'storage host was not verified' }
    }
    // URL.pathname would silently remove dot segments; extract from the raw URL.
    const match = /^https:\/\/([^/?#]+)\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/?#]+)\/([^?#]*)(?:\?[^#]*)?$/.exec(raw)
    if (!match || url.username || url.password || match[1] !== url.host) {
      return { status: 'unresolved', reason: 'unsupported storage URL' }
    }
    if (bucket && bucket !== match[2]) {
      return { status: 'unresolved', reason: 'conflicting bucket evidence' }
    }
    bucket = match[2]
    path = match[3]
    exactUrl = true
  }

  if (!bucket || !allowedBuckets.has(bucket)) {
    return { status: 'unresolved', reason: 'bucket was not verified' }
  }
  if (!exactUrl && path.indexOf('/') < 0) {
    return { status: 'ambiguous', reason: 'ambiguous object path' }
  }
  if (!path || path !== path.trim() || path.split('/').some(part => !part || part === '.' || part === '..')) {
    return { status: 'unresolved', reason: 'ambiguous object path' }
  }
  if (path.includes('%') || /[?#:\\\u0000-\u001f\u007f-\u009f]/.test(path)) {
    return { status: 'unresolved', reason: 'encoded or unsafe object path' }
  }
  return { status: 'mapped', bucket: bucket as 'saga' | 'audio-recordings', objectKey: path }
}

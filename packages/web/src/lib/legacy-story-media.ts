import { resolveLegacyMediaReference, type LegacyMediaReferenceResult } from './legacy-media-reference'

export type LegacyStoryMediaField = 'audio_url' | 'mastered_audio_url' | 'photo_url' | 'photo_urls' | 'images'
export interface LegacyStoryMediaContext {
  verifiedStorageHost?: string
  verifiedBucketsByField?: Partial<Record<LegacyStoryMediaField, 'saga' | 'audio-recordings'>>
}
export interface LegacyStoryMediaObservation {
  sourceTable: 'stories'
  sourceRowId: string
  projectId: string
  sourceField: LegacyStoryMediaField
  sourcePath: string
  kind: 'original_audio' | 'derived_audio' | 'original_image' | 'thumbnail'
  rawValue: unknown
  locator: LegacyMediaReferenceResult
}
export interface LegacyStoryMediaPlan {
  schemaCompatible: boolean
  issues: string[]
  references: LegacyStoryMediaObservation[]
}

/**
 * Project a trusted DB row into reviewable locator observations. No I/O, asset
 * creation, authorization, existence checks or inference from filenames.
 * rawValue may contain a historic signed URL: keep observations out of public logs.
 */
export function planLegacyStoryMedia(
  row: Readonly<Record<string, unknown>>,
  context: LegacyStoryMediaContext,
): LegacyStoryMediaPlan {
  const issues: string[] = []
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
  for (const field of ['id', 'project_id', 'storyteller_id']) {
    if (typeof row[field] !== 'string' || !uuid.test(row[field])) issues.push(`invalid ${field}`)
  }
  if (typeof row.title !== 'string') issues.push('invalid title')
  const schemaCompatible = issues.length === 0
  const references: LegacyStoryMediaObservation[] = []

  function append(field: LegacyStoryMediaField, sourcePath: string,
    kind: LegacyStoryMediaObservation['kind'], rawValue: unknown, reason?: string) {
    const sourceRowId = typeof row.id === 'string' ? row.id : ''
    const projectId = typeof row.project_id === 'string' ? row.project_id : ''
    const blocked = !schemaCompatible ? 'incompatible story identity or required fields' : reason
    const locator: LegacyMediaReferenceResult = blocked
      ? { status: 'unresolved', reason: blocked }
      : typeof rawValue !== 'string'
        ? { status: 'unresolved', reason: 'media reference is not a string' }
        : resolveLegacyMediaReference({ sourceTable: 'stories', sourceRowId,
          sourceField: field, legacyValue: rawValue, verifiedStorageHost: context.verifiedStorageHost,
          verifiedBucket: context.verifiedBucketsByField?.[field] })
    const observation: LegacyStoryMediaObservation = {
      sourceTable: 'stories', sourceRowId, projectId, sourceField: field, sourcePath,
      kind, rawValue, locator,
    }
    references.push(observation)
    return observation
  }

  for (const [field, kind] of [
    ['audio_url', 'original_audio'], ['mastered_audio_url', 'derived_audio'], ['photo_url', 'original_image'],
  ] as const) {
    if (row[field] != null) append(field, `/${field}`, kind, row[field])
  }

  for (const field of ['photo_urls', 'images'] as const) {
    const values = row[field]
    if (values == null) continue
    if (!Array.isArray(values)) {
      append(field, `/${field}`, 'original_image', values, 'expected a database array')
      continue
    }
    // Use index iteration so a sparse caller array cannot silently skip a source.
    for (let index = 0; index < values.length; index++) {
      const value: unknown = values[index]
      const pointer = `/${field}/${index}`
      if (field === 'photo_urls' || typeof value === 'string' || value == null ||
        typeof value !== 'object' || Array.isArray(value)) {
        append(field, pointer, 'original_image', value)
        continue
      }
      const item = value as Record<string, unknown>
      for (const [kind, keys] of [
        ['original_image', ['url', 'path']], ['thumbnail', ['thumbUrl', 'thumbPath']],
      ] as const) {
        const present = keys.filter(key => Object.prototype.hasOwnProperty.call(item, key))
        if (!present.length && kind === 'original_image') {
          append(field, pointer, kind, value, 'original reference missing or unsupported image shape')
        }
        const group = present.map(key => append(field, `${pointer}/${key}`, kind, item[key]))
        if (group.length < 2) continue
        const resolved = group.every(r => r.locator.status === 'mapped')
        const locators = new Set(group.map(r => JSON.stringify([r.locator.bucket, r.locator.objectKey])))
        if (!resolved || locators.size !== 1) {
          for (const ref of group) ref.locator = {
            status: 'ambiguous', reason: resolved ? 'conflicting image aliases' : 'unresolved competing image alias',
          }
        }
      }
    }
  }
  return { schemaCompatible, issues, references }
}

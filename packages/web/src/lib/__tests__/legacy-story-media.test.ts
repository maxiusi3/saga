import { planLegacyStoryMedia } from '@/lib/legacy-story-media'

const id = '10000000-0000-4000-8000-000000000001'
const project = '20000000-0000-4000-8000-000000000001'
const user = '30000000-0000-4000-8000-000000000001'
const row = { id, project_id: project, storyteller_id: user, title: 'Synthetic story' }
const context = { verifiedStorageHost: 'fixture.supabase.co', verifiedBucketsByField: {
  audio_url: 'audio-recordings', mastered_audio_url: 'audio-recordings',
  images: 'saga', photo_urls: 'saga', photo_url: 'saga',
} } as const

describe('legacy stories media projection', () => {
  it('preserves every field, array position and duplicate source without promoting derivatives', () => {
    const plan = planLegacyStoryMedia({ ...row, audio_url: 'stories/same.webm',
      mastered_audio_url: 'alice/mastered/same.webm', photo_url: 'alice/images/same.jpg',
      photo_urls: ['alice/images/same.jpg', 'bob/images/same.jpg'],
      images: [{ url: 'alice/images/original.jpg', thumbUrl: 'alice/images/thumb.jpg' }, 'alice/images/same.jpg'],
    }, context)
    expect(plan.schemaCompatible).toBe(true)
    expect(plan.references.map(r => [r.sourcePath, r.kind, r.locator.objectKey])).toEqual([
      ['/audio_url', 'original_audio', 'stories/same.webm'],
      ['/mastered_audio_url', 'derived_audio', 'alice/mastered/same.webm'],
      ['/photo_url', 'original_image', 'alice/images/same.jpg'],
      ['/photo_urls/0', 'original_image', 'alice/images/same.jpg'],
      ['/photo_urls/1', 'original_image', 'bob/images/same.jpg'],
      ['/images/0/url', 'original_image', 'alice/images/original.jpg'],
      ['/images/0/thumbUrl', 'thumbnail', 'alice/images/thumb.jpg'],
      ['/images/1', 'original_image', 'alice/images/same.jpg'],
    ])
    expect(plan.references[0]).toMatchObject({ sourceTable: 'stories', sourceRowId: id,
      projectId: project, sourceField: 'audio_url', rawValue: 'stories/same.webm' })
    expect(plan.references.every(r => !('assetId' in r))).toBe(true)
  })

  it('keeps matching URL and path observations separate while excluding signed query from the locator', () => {
    const plan = planLegacyStoryMedia({ ...row, images: [{
      url: 'https://fixture.supabase.co/storage/v1/object/sign/saga/alice/images/a.jpg?token=synthetic',
      path: 'alice/images/a.jpg',
    }] }, context)
    expect(plan.references).toHaveLength(2)
    expect(plan.references.map(r => r.locator)).toEqual([
      { status: 'mapped', bucket: 'saga', objectKey: 'alice/images/a.jpg' },
      { status: 'mapped', bucket: 'saga', objectKey: 'alice/images/a.jpg' },
    ])
  })

  it('does not choose between conflicting URL/path aliases on the same image', () => {
    const plan = planLegacyStoryMedia({ ...row, images: [{
      url: 'alice/images/a.jpg', path: 'bob/images/a.jpg', thumbUrl: 'alice/images/t.jpg',
    }] }, context)
    expect(plan.references.map(r => r.locator.status)).toEqual(['ambiguous', 'ambiguous', 'mapped'])
    expect(plan.references[0].locator.objectKey).toBeUndefined()
  })

  it('does not let a valid alias hide an unresolved competing source', () => {
    const plan = planLegacyStoryMedia({ ...row, images: [{url: 'a.jpg', path: 'alice/images/a.jpg'}] }, context)
    expect(plan.references.every(r => r.locator.status !== 'mapped')).toBe(true)
  })

  it('reports a missing original instead of using its thumbnail', () => {
    const plan = planLegacyStoryMedia({ ...row, images: [{ thumbUrl: 'alice/images/t.jpg' }] }, context)
    expect(plan.references.map(r => [r.kind, r.locator.status])).toEqual([
      ['original_image', 'unresolved'], ['thumbnail', 'mapped'],
    ])
  })

  it('keeps invalid and null array entries at their original positions', () => {
    const plan = planLegacyStoryMedia({ ...row, images: [null, 4, ['alice/a.jpg'], { futureUrl: 'alice/b.jpg' }],
      photo_urls: [null, '', 5] }, context)
    expect(plan.references.map(r => r.sourcePath)).toEqual([
      '/photo_urls/0', '/photo_urls/1', '/photo_urls/2', '/images/0', '/images/1', '/images/2', '/images/3',
    ])
    expect(plan.references.every(r => r.locator.status === 'unresolved')).toBe(true)
    expect(plan.references[3].rawValue).toBeNull()
  })

  it.each(['[{"url":"alice/a.jpg"}]', { url: 'alice/a.jpg' }, 7])('does not guess an array from a malformed field: %j', images => {
    const plan = planLegacyStoryMedia({ ...row, images }, context)
    expect(plan.references).toHaveLength(1)
    expect(plan.references[0]).toMatchObject({ sourcePath: '/images', rawValue: images, locator: { status: 'unresolved' } })
  })

  it('does not default a raw path bucket when field evidence is absent', () => {
    const plan = planLegacyStoryMedia({ ...row, audio_url: 'stories/a.webm' }, {})
    expect(plan.references[0].locator.status).toBe('unresolved')
  })

  it('does not use user_id as a replacement for missing storyteller_id', () => {
    const plan = planLegacyStoryMedia({ ...row, storyteller_id: null, user_id: user, audio_url: 'stories/a.webm' }, context)
    expect(plan.schemaCompatible).toBe(false)
    expect(plan.references[0].locator.status).toBe('unresolved')
  })

  it.each([{ title: null }, { id: '' }, { project_id: 'wrong' }])('blocks a schema-incompatible identity: %j', invalid => {
    const plan = planLegacyStoryMedia({ ...row, ...invalid, photo_url: 'alice/images/a.jpg' }, context)
    expect(plan.schemaCompatible).toBe(false)
    expect(plan.references[0].locator.status).toBe('unresolved')
  })

  it('does not read content or metadata and never mutates the caller projection', () => {
    const images = Object.freeze([Object.freeze({ url: 'alice/images/a.jpg', caption: 'Retained externally' })])
    const input = Object.freeze({ ...row, images, content: 'https://external.invalid/private',
      metadata: { photo_url: 'alice/unrelated.jpg' } })
    const before = JSON.stringify(input)
    const result = planLegacyStoryMedia(input, context)
    expect(result.references).toHaveLength(1)
    expect(result.references[0].sourcePath).toBe('/images/0/url')
    expect(JSON.stringify(input)).toBe(before)
  })

  it('treats SQL null and empty arrays as absent fields', () => {
    expect(planLegacyStoryMedia({ ...row, images: [], photo_urls: null, audio_url: null }, context).references).toEqual([])
  })
})

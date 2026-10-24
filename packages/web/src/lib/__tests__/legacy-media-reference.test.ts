import { resolveLegacyMediaReference } from '@/lib/legacy-media-reference'

describe('legacy media reference mapping', () => {
  const base = {
    sourceTable: 'stories',
    sourceRowId: 'story-a',
    sourceField: 'audio_url',
  }

  it('maps a verified exact bucket and key without guessing a basename', () => {
    expect(resolveLegacyMediaReference({
      ...base,
      legacyValue: 'alice/projects/family-a/stories/story-a.webm',
      verifiedBucket: 'audio-recordings',
    })).toEqual({
      status: 'mapped',
      bucket: 'audio-recordings',
      objectKey: 'alice/projects/family-a/stories/story-a.webm',
    })
  })

  it.each([
    { legacyValue: 'story-a.webm', verifiedBucket: 'audio-recordings', reason: 'ambiguous object path' },
    { legacyValue: 'https://evil.example/object/public/saga/a.png', reason: 'storage host was not verified' },
    { legacyValue: 'alice/projects/family-a/%2e%2e/a.webm', verifiedBucket: 'audio-recordings', reason: 'encoded or unsafe object path' },
    { legacyValue: 'alice/a.webm', verifiedBucket: 'unknown', reason: 'bucket was not verified' },
  ])('leaves unsafe or ambiguous values unresolved: %j', value => {
    expect(resolveLegacyMediaReference({ ...base, ...value })).toMatchObject({ status: expect.not.stringMatching(/^mapped$/), reason: value.reason })
  })

  it.each(['public', 'sign', 'authenticated'])('preserves the exact key in a standard %s Storage URL', mode => {
    const result = resolveLegacyMediaReference({
      ...base, verifiedStorageHost: 'fixture.supabase.co',
      legacyValue: `https://fixture.supabase.co/storage/v1/object/${mode}/saga/alice/images/a.png?token=fixture-only`,
    })
    expect(result).toEqual({ status: 'mapped', bucket: 'saga', objectKey: 'alice/images/a.png' })
    expect(JSON.stringify(result)).not.toContain('fixture-only')
  })

  it.each([
    ' alice/images/a.png', 'alice/images/a.png ',
    'https://fixture.supabase.co/storage/v1/object/public/saga/alice/../a.png',
    'https://fixture.supabase.co/storage/v1/object/public/saga/alice/%2e%2e/a.png',
    'https://fixture.supabase.co/storage/v1/object/public/saga/alice//a.png',
    'https://fixture.supabase.co/storage/v1/object/public/saga/alice/a.png#fragment',
    'https://fixture.supabase.co/storage/v1/object/public/saga/alice/\\a.png',
    'https://fixture.supabase.co/storage/v1/object/public/saga/alice/\na.png',
    'https://user:secret@fixture.supabase.co/storage/v1/object/public/saga/alice/a.png',
    'http://fixture.supabase.co/storage/v1/object/public/saga/alice/a.png',
    'https://fixture.supabase.co/other/object/saga/alice/a.png',
    'https://fixture.supabase.co/storage/v1/object/render/saga/alice/a.png',
    'https://fixture.supabase.co/storage/v1/object/public/unknown/alice/a.png',
    'https://fixture.supabase.co.attacker.invalid/storage/v1/object/public/saga/alice/a.png',
  ])('does not normalize an ambiguous locator: %s', legacyValue => {
    expect(resolveLegacyMediaReference({ ...base, legacyValue,
      verifiedStorageHost: 'fixture.supabase.co', verifiedBucket: 'saga',
    }).status).not.toBe('mapped')
  })

  it('rejects a URL whose bucket conflicts with the supplied bucket evidence', () => {
    expect(resolveLegacyMediaReference({ ...base, verifiedStorageHost: 'fixture.supabase.co',
      verifiedBucket: 'audio-recordings',
      legacyValue: 'https://fixture.supabase.co/storage/v1/object/public/saga/alice/a.png',
    }).status).toBe('unresolved')
  })

  it('accepts an exact root key in a verified full URL without guessing a raw basename', () => {
    expect(resolveLegacyMediaReference({ ...base, verifiedStorageHost: 'fixture.supabase.co',
      legacyValue: 'https://fixture.supabase.co/storage/v1/object/public/saga/root.jpg',
    })).toEqual({ status: 'mapped', bucket: 'saga', objectKey: 'root.jpg' })
  })
})

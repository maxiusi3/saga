import { buildVersionedTranscript } from '@/lib/server/ai-capability-gateway'
import {
  buildSearchIndexEntries,
  executeProvenanceSearch,
  switchActiveSearchIndexVersion,
} from '@/lib/server/provenance-search'

describe('T10 Permission-Filtered Provenance Retrieval & Search Service', () => {
  const transcript = buildVersionedTranscript({
    storyId: 'story-search-1',
    projectId: 'proj-search-1',
    mediaAssetId: 'asset-search-1',
    version: 1,
    provider: 'elevenlabs_scribe_v2',
    modelId: 'scribe_v2',
    language: 'en',
    rawSegments: [
      {
        startMs: 0,
        endMs: 4800,
        text: 'In 1968 Grandma Eleanor moved to Chicago with Uncle Bob.',
        confidence: 0.98,
      },
      {
        startMs: 4800,
        endMs: 9600,
        text: 'In 1974 Aunt Clara opened a bakery in Boston.',
        confidence: 0.96,
      },
    ],
  })
  const { segments } = transcript

  const entries = buildSearchIndexEntries({
    projectId: 'proj-search-1',
    storyId: 'story-search-1',
    storyTitle: 'Midwest & New England Memories',
    transcriptVersionId: transcript.id,
    storyRevisionId: 'rev-1',
    mediaAssetId: 'asset-search-1',
    indexVersion: 1,
    segments,
  })

  it('rejects cross-family or revoked members before searching', () => {
    expect(() =>
      executeProvenanceSearch({
        actorId: 'user-outsider',
        projectId: 'proj-search-1',
        isActiveMember: false,
        query: 'Chicago 1968',
        entries,
      }),
    ).toThrow(/search_access_denied/)
  })

  it('recalls grounded citations with exact [startMs, endMs] audio offsets for people, dates, and places', () => {
    const res = executeProvenanceSearch({
      actorId: 'user-member-1',
      projectId: 'proj-search-1',
      isActiveMember: true,
      query: 'Where did Grandma Eleanor move in 1968?',
      entries,
    })

    expect(res.status).toBe('grounded_answer')
    expect(res.citations.length).toBeGreaterThanOrEqual(1)
    expect(res.citations[0].segmentId).toBe(segments[0].id)
    expect(res.citations[0].startMs).toBe(0)
    expect(res.citations[0].endMs).toBe(4800)
    expect(res.citations[0].quotedText).toContain('Grandma Eleanor')
  })

  it('never fabricates an answer when no records match or when the source is tombstoned', () => {
    const noMatch = executeProvenanceSearch({
      actorId: 'user-member-1',
      projectId: 'proj-search-1',
      isActiveMember: true,
      query: 'Paris 1999 submarine voyage',
      entries,
    })
    expect(noMatch.status).toBe('no_matching_sources')
    expect(noMatch.citations).toHaveLength(0)
    expect(noMatch.answerText).toContain('No matching family records were found')

    const tombstoned = executeProvenanceSearch({
      actorId: 'user-member-1',
      projectId: 'proj-search-1',
      isActiveMember: true,
      query: 'Chicago 1968',
      entries,
      tombstonedSubjectIds: new Set(['asset-search-1']),
    })
    expect(tombstoned.status).toBe('no_matching_sources')
    expect(tombstoned.citations).toHaveLength(0)
  })

  it('atomically switches active index version', () => {
    const v2Entries = buildSearchIndexEntries({
      projectId: 'proj-search-1',
      storyId: 'story-search-1',
      storyTitle: 'Midwest & New England Memories (Corrected)',
      transcriptVersionId: transcript.id,
      storyRevisionId: 'rev-2',
      mediaAssetId: 'asset-search-1',
      indexVersion: 2,
      isActiveIndex: false,
      segments: [
        {
          ...segments[0],
          text: 'In 1969 Grandma Eleanor moved to Seattle with Uncle Bob.',
        },
      ],
    })
    const switched = switchActiveSearchIndexVersion([...entries, ...v2Entries], 'proj-search-1', 2)

    const resOld = executeProvenanceSearch({
      actorId: 'user-member-1',
      projectId: 'proj-search-1',
      isActiveMember: true,
      query: 'Chicago 1968',
      entries: switched,
    })
    expect(resOld.status).toBe('no_matching_sources')

    const resNew = executeProvenanceSearch({
      actorId: 'user-member-1',
      projectId: 'proj-search-1',
      isActiveMember: true,
      query: 'Seattle 1969',
      entries: switched,
    })
    expect(resNew.status).toBe('grounded_answer')
    expect(resNew.activeIndexVersion).toBe(2)
  })
})

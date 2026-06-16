import { processWikiEventDraft } from '../wiki-editor-agent'

describe('wiki-editor-agent', () => {
  it('creates a candidate for one active contribution', () => {
    const result = processWikiEventDraft({
      existingClusters: [],
      contributions: [
        {
          id: 'contribution-1',
          anonymized_title: '1976 Guangzhou market memory',
          anonymized_text: 'In 1976 a child remembered a Guangzhou market.',
          anonymized_summary: 'A market memory.',
          elements: [
            { element_type: 'time', value: '1976', normalized_value: '1976', confidence: 0.9 },
            { element_type: 'place', value: 'Guangzhou', normalized_value: 'Guangzhou', confidence: 0.8 },
            { element_type: 'event', value: 'market visit', normalized_value: 'market visit', confidence: 0.7 },
          ],
        },
      ],
    })

    expect(result.status).toBe('candidate')
    expect(result.eventLabel).toBe('1976 Guangzhou market visit memories')
    expect(result.activeContributionIds).toEqual(['contribution-1'])
  })

  it('upgrades matching contributions to a draft', () => {
    const result = processWikiEventDraft({
      existingClusters: [],
      contributions: [
        {
          id: 'contribution-1',
          anonymized_title: '1976 Guangzhou market memory',
          anonymized_text: 'In 1976 a child remembered a Guangzhou market.',
          anonymized_summary: 'A market memory.',
          elements: [
            { element_type: 'time', value: '1976', normalized_value: '1976', confidence: 0.9 },
            { element_type: 'place', value: 'Guangzhou', normalized_value: 'Guangzhou', confidence: 0.8 },
            { element_type: 'event', value: 'market visit', normalized_value: 'market visit', confidence: 0.7 },
          ],
        },
        {
          id: 'contribution-2',
          anonymized_title: 'Guangzhou market in 1976',
          anonymized_text: 'Another contributor remembered going to a Guangzhou market in 1976.',
          anonymized_summary: 'Another market memory.',
          elements: [
            { element_type: 'time', value: '1976', normalized_value: '1976', confidence: 0.9 },
            { element_type: 'place', value: 'Guangzhou', normalized_value: 'Guangzhou', confidence: 0.8 },
            { element_type: 'event', value: 'market visit', normalized_value: 'market visit', confidence: 0.7 },
          ],
        },
      ],
    })

    expect(result.status).toBe('draft')
    expect(result.activeContributionIds).toEqual(['contribution-1', 'contribution-2'])
    expect(result.representativeExcerpts).toHaveLength(2)
    expect(result.uncertaintyNotes).toContain('derived from 2 active contributions')
  })

  it('keeps low-confidence mismatches as separate candidates by selecting only the strongest contribution group', () => {
    const result = processWikiEventDraft({
      existingClusters: [],
      contributions: [
        {
          id: 'contribution-1',
          anonymized_title: '1976 Guangzhou memory',
          anonymized_text: 'Guangzhou in 1976.',
          anonymized_summary: 'Guangzhou memory.',
          elements: [
            { element_type: 'time', value: '1976', normalized_value: '1976', confidence: 0.9 },
            { element_type: 'place', value: 'Guangzhou', normalized_value: 'Guangzhou', confidence: 0.8 },
          ],
        },
        {
          id: 'contribution-2',
          anonymized_title: '2020 Taipei school closure',
          anonymized_text: 'Taipei school closure in 2020.',
          anonymized_summary: 'School closure memory.',
          elements: [
            { element_type: 'time', value: '2020', normalized_value: '2020', confidence: 0.9 },
            { element_type: 'place', value: 'Taipei', normalized_value: 'Taipei', confidence: 0.8 },
          ],
        },
      ],
    })

    expect(result.status).toBe('candidate')
    expect(result.activeContributionIds).toEqual(['contribution-1'])
  })
})

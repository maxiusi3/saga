import { buildContributionPreview, sanitizePublicArchiveText } from '../anonymizer'

describe('public archive anonymizer', () => {
  it('removes direct identifiers while preserving event context', () => {
    const result = sanitizePublicArchiveText(
      'My name is Alice Chen. Email alice@example.com. Phone 555-123-4567. In 1976 my mother took me to Guangzhou after the earthquake.',
      ['Alice Chen'],
    )

    expect(result).not.toContain('Alice Chen')
    expect(result).not.toContain('alice@example.com')
    expect(result).not.toContain('555-123-4567')
    expect(result).toContain('[person]')
    expect(result).toContain('1976')
    expect(result).toContain('Guangzhou')
    expect(result).toContain('earthquake')
  })

  it('redacts Chinese mobile numbers and resident IDs while keeping the year', () => {
    const result = sanitizePublicArchiveText(
      'In 1976 my phone was 13812345678 and my ID was 11010119760307123X.',
    )

    expect(result).not.toContain('13812345678')
    expect(result).not.toContain('11010119760307123X')
    expect(result).toContain('[phone]')
    expect(result).toContain('[id]')
    expect(result).toContain('1976')
  })

  it('generalizes media references without removing surrounding context', () => {
    const result = sanitizePublicArchiveText(
      'In 1976 we kept a photo of Mei at the station, a voice memo from Uncle Kai, an audio recording of the parade, and a media file from the reunion.',
    )

    expect(result).toBe(
      'In 1976 we kept a [photo], a [voice], an [audio], and a [media].',
    )
  })

  it('builds a preview with text and structured elements only', () => {
    const preview = buildContributionPreview({
      previewId: 'artifact-1',
      story: {
        id: 'story-1',
        title: 'Alice at 123 Pine Street',
        transcript: 'Alice visited 123 Pine Street in Guangzhou in 1976.',
        created_at: '2026-01-02T03:04:05.000Z',
      },
      sourceContentHash: 'hash-1',
      elements: [
        {
          id: 'element-1',
          element_type: 'person',
          value: 'Alice',
          normalized_value: 'Alice',
          source_quote: 'Alice',
          confidence: 0.9,
        },
        {
          id: 'element-2',
          element_type: 'place',
          value: 'Guangzhou',
          normalized_value: 'Guangzhou',
          source_quote: 'Guangzhou',
          confidence: 0.8,
        },
      ],
    })

    expect(preview).toEqual({
      previewId: 'artifact-1',
      storyId: 'story-1',
      sourceContentHash: 'hash-1',
      consentScope: ['text', 'structured_elements'],
      consentCopyVersion: 'public-archive-consent-v1',
      anonymizedTitle: '[person] at [address]',
      anonymizedText: '[person] visited [address] in Guangzhou in 1976.',
      anonymizedSummary: '[person] visited [address] in Guangzhou in 1976.',
      elements: [
        {
          elementType: 'person',
          value: '[person]',
          normalizedValue: '[person]',
          sourceQuote: '[person]',
          confidence: 0.9,
        },
        {
          elementType: 'place',
          value: 'Guangzhou',
          normalizedValue: 'Guangzhou',
          sourceQuote: 'Guangzhou',
          confidence: 0.8,
        },
      ],
      excludedDataTypes: ['voice', 'audio', 'photos', 'media_derivatives', 'exact_identity'],
    })
  })

  it('generalizes person source quotes even when they include names not in the element value', () => {
    const preview = buildContributionPreview({
      previewId: 'artifact-2',
      story: {
        id: 'story-2',
        title: 'Family gathering',
        transcript: 'Auntie Lin remembered the winter market.',
        created_at: '2026-01-02T03:04:05.000Z',
      },
      sourceContentHash: 'hash-2',
      elements: [
        {
          id: 'element-1',
          element_type: 'person',
          value: 'Auntie',
          normalized_value: 'Auntie',
          source_quote: 'Auntie Lin Mei',
          confidence: 0.9,
        },
      ],
    })

    expect(preview.elements[0]).toEqual({
      elementType: 'person',
      value: '[person]',
      normalizedValue: '[person]',
      sourceQuote: '[person]',
      confidence: 0.9,
    })
  })
})

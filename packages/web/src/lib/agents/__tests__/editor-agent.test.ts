import { processStoryForBiography } from '../editor-agent'

describe('processStoryForBiography', () => {
  it('creates a standalone story and required story element types', () => {
    const result = processStoryForBiography({
      storyId: 'story-1',
      projectId: 'project-1',
      title: 'Leaving Home',
      transcript:
        'In 1976, I left Guangzhou with my brother. I felt afraid, but I decided to keep going. That choice changed my life.',
      createdAt: '2026-06-11T00:00:00.000Z',
    })

    expect(result.standaloneStory.title).toBe('Leaving Home')
    expect(result.standaloneStory.body).toContain('In 1976')
    expect(result.elements.map(element => element.elementType)).toEqual(
      expect.arrayContaining(['time', 'place', 'person', 'emotion', 'decision', 'consequence']),
    )
  })

  it('keeps source quotes for every extracted element', () => {
    const result = processStoryForBiography({
      storyId: 'story-1',
      projectId: 'project-1',
      title: 'Factory',
      transcript: 'My first job was in a factory. I learned discipline there.',
      createdAt: '2026-06-11T00:00:00.000Z',
    })

    expect(result.elements.length).toBeGreaterThan(0)
    expect(result.elements.every(element => element.sourceQuote.length > 0)).toBe(true)
  })

  it('keeps source quotes aligned with original transcript offsets when display text is trimmed', () => {
    const transcript =
      '\n\n  In 1976, I left Guangzhou. My brother stayed with me, and that family promise changed my life.  \n'
    const result = processStoryForBiography({
      storyId: 'story-1',
      projectId: 'project-1',
      title: 'Leaving Home',
      transcript,
      createdAt: '2026-06-11T00:00:00.000Z',
    })

    expect(result.standaloneStory.body).toBe(transcript.trim())
    expect(result.elements.length).toBeGreaterThan(0)
    for (const element of result.elements) {
      expect(element.sourceQuote).toBe(
        transcript.slice(element.sourceStartOffset, element.sourceEndOffset),
      )
    }
  })

  it('extracts Chinese story elements without relying on English word boundaries', () => {
    const result = processStoryForBiography({
      storyId: 'story-1',
      projectId: 'project-1',
      title: '离家',
      transcript: '1976年，我和我的哥哥离开广州。我很害怕，但我决定继续走下去。这个决定改变了我的人生。我明白了家人的重要。',
      createdAt: '2026-06-11T00:00:00.000Z',
    })

    expect(result.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ elementType: 'person', value: '我的哥哥' }),
        expect.objectContaining({ elementType: 'emotion', value: '害怕' }),
        expect.objectContaining({ elementType: 'decision', value: '我决定继续走下去' }),
        expect.objectContaining({ elementType: 'consequence', value: '改变了我的人生' }),
        expect.objectContaining({ elementType: 'reflection', value: '我明白了家人的重要' }),
      ]),
    )
  })
})

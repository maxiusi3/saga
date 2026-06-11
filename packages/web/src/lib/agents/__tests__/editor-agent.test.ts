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
})

import {
  AGENT_TYPES,
  INTERVENTION_LEVELS,
  INTERVIEW_EVENT_KINDS,
  STORY_ELEMENT_TYPES,
  type AgentType,
  type InterventionLevel,
  type StoryElementType,
} from '../agents'

describe('agent shared types', () => {
  it('defines Phase 1 agent types only', () => {
    const values: AgentType[] = [...AGENT_TYPES]
    expect(values).toEqual(['interview', 'editor_librarian'])
  })

  it('defines the supported Interview Agent intervention levels', () => {
    const values: InterventionLevel[] = [...INTERVENTION_LEVELS]
    expect(values).toEqual(['off', 'low', 'high'])
  })

  it('defines host intervention event kinds', () => {
    expect(INTERVIEW_EVENT_KINDS).toEqual([
      'opening',
      'warmup',
      'prior_story_recap',
      'gentle_probe',
      'transition',
      'emotional_support',
      'closing',
    ])
  })

  it('defines required private biography element types', () => {
    const values: StoryElementType[] = [...STORY_ELEMENT_TYPES]
    expect(values).toEqual([
      'time',
      'place',
      'person',
      'event',
      'theme',
      'emotion',
      'decision',
      'consequence',
      'reflection',
    ])
  })
})

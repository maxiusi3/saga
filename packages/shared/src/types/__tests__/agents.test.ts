import {
  AGENT_TYPES,
  INTERVENTION_LEVELS,
  INTERVIEW_EVENT_KINDS,
  STORY_ELEMENT_TYPES,
  type AgentType,
  type InterventionLevel,
  type StoryElementType,
} from '../agents'
import * as PackageRoot from '../../index'
import * as TypesBarrel from '../index'
import type { AgentType as PackageRootAgentType } from '../../index'
import type { AgentType as TypesBarrelAgentType } from '../index'

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

  it('exports agent types through the public type barrels', () => {
    const typeBarrelValue: TypesBarrelAgentType = TypesBarrel.AGENT_TYPES[0]
    const packageRootValue: PackageRootAgentType = PackageRoot.AGENT_TYPES[0]

    expect(typeBarrelValue).toBe('interview')
    expect(packageRootValue).toBe('interview')
    expect(TypesBarrel.AGENT_TYPES).toBe(AGENT_TYPES)
    expect(PackageRoot.AGENT_TYPES).toBe(AGENT_TYPES)
  })
})

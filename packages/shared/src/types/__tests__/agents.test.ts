import {
  AGENT_TYPES,
  INTERVENTION_LEVELS,
  INTERVIEW_EVENT_KINDS,
  STORY_ELEMENT_TYPES,
  type AgentArtifact,
  type AgentRun,
  type AgentType,
  type InterviewEvent,
  type InterviewSession,
  type InterventionLevel,
  type StoryElement,
  type StoryElementType,
} from '../agents'
import * as PackageRoot from '../../index'
import * as TypesBarrel from '../index'
import type { AgentType as PackageRootAgentType } from '../../index'
import type { AgentType as TypesBarrelAgentType } from '../index'

describe('agent shared types', () => {
  it('defines Phase 2 agent types', () => {
    const values: AgentType[] = [...AGENT_TYPES]
    expect(values).toEqual(['interview', 'editor_librarian', 'wiki_editor'])
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

  it('accepts nullable database-backed Phase 1 agent row fields', () => {
    const agentRun: AgentRun = {
      id: 'run-1',
      agent_type: 'editor_librarian',
      status: 'completed',
      project_id: null,
      story_id: null,
      interview_session_id: null,
      content_hash: null,
      input: {},
      output: null,
      model: null,
      error: null,
      started_at: '2026-06-11T00:00:00.000Z',
      completed_at: null,
      created_by: 'user-1',
    }

    const artifact: AgentArtifact = {
      id: 'artifact-1',
      agent_run_id: agentRun.id,
      project_id: 'project-1',
      story_id: null,
      artifact_type: 'story_summary',
      payload: {},
      source_refs: [],
      review_status: 'unreviewed',
      confidence: 0.8,
      created_at: '2026-06-11T00:00:00.000Z',
      updated_at: '2026-06-11T00:00:00.000Z',
    }

    const session: InterviewSession = {
      id: 'session-1',
      project_id: 'project-1',
      storyteller_id: 'user-1',
      prompt_text: null,
      recording_mode: 'deep_dive',
      intervention_level: 'low',
      status: 'completed',
      started_at: '2026-06-11T00:00:00.000Z',
      completed_at: null,
    }

    const event: InterviewEvent = {
      id: 'event-1',
      interview_session_id: session.id,
      project_id: 'project-1',
      storyteller_id: 'user-1',
      event_kind: 'gentle_probe',
      intervention_level: 'low',
      trigger_reason: 'silence_detected',
      prompt_text: 'What happened next?',
      transcript_window: null,
      transcript_start_offset: null,
      transcript_end_offset: null,
      accepted: null,
      created_at: '2026-06-11T00:00:00.000Z',
    }

    const storyElement: StoryElement = {
      id: 'element-1',
      project_id: 'project-1',
      story_id: 'story-1',
      agent_run_id: agentRun.id,
      element_type: 'place',
      value: 'Taipei',
      normalized_value: null,
      source_quote: 'We were in Taipei.',
      source_start_offset: null,
      source_end_offset: null,
      confidence: 0.8,
      review_status: 'unreviewed',
      created_at: '2026-06-11T00:00:00.000Z',
      updated_at: '2026-06-11T00:00:00.000Z',
    }

    expect(agentRun.content_hash).toBeNull()
    expect(artifact.story_id).toBeNull()
    expect(session.prompt_text).toBeNull()
    expect(event.accepted).toBeNull()
    expect(storyElement.normalized_value).toBeNull()
  })
})
